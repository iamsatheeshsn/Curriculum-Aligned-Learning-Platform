import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import {
  Button,
  PaginationBar,
  useClientPagination,
  ConfirmButton,
  FormActions,
  Panel,
  SelectField,
  StatStrip,
  TextField,
  Toolbar,
  useFeedback,
  validateFormFields,
} from '@stemora/ui';
import { ControlLayout } from '../../layout/ControlLayout';
import { statusLabel } from '../../types';

type TermRow = {
  id: number;
  academic_year_id: number;
  name_en: string;
  name_ar: string;
  sequence: number;
  starts_on: string;
  ends_on: string;
  status: string;
};

type YearRow = {
  id: number;
  name: string;
  starts_on: string;
  ends_on: string;
  is_current: boolean;
  status: string;
  terms: TermRow[];
};

type YearStats = {
  total: number;
  current: number;
  active: number;
};

type TermDraft = {
  name_en: string;
  name_ar: string;
  sequence: string;
  starts_on: string;
  ends_on: string;
};

type YearForm = {
  name: string;
  starts_on: string;
  ends_on: string;
  status: string;
  is_current: boolean;
  terms: TermDraft[];
};

const emptyTerm = (): TermDraft => ({
  name_en: '',
  name_ar: '',
  sequence: '1',
  starts_on: '',
  ends_on: '',
});

const emptyForm = (): YearForm => ({
  name: '',
  starts_on: '',
  ends_on: '',
  status: 'planned',
  is_current: false,
  terms: [],
});

function canAccessSchoolOps(
  isSuperAdmin: boolean,
  isTenantOwner: boolean,
  hasPermission: (code: string | string[]) => boolean,
) {
  return (
    isSuperAdmin ||
    isTenantOwner ||
    hasPermission([
      'tenant.schools.manage',
      'school.settings.manage',
      'school.campuses.manage',
      'school.academics.manage',
      'nav.control.school-management',
    ])
  );
}

function formatRange(start: string, end: string) {
  return `${start} → ${end}`;
}

/**
 * Manage academic years, embedded terms, and the current year flag.
 */
export function AcademicYearsPage() {
  const { isSuperAdmin, isTenantOwner, hasPermission } = useAuth();
  if (!canAccessSchoolOps(isSuperAdmin, isTenantOwner, hasPermission)) {
    return <Navigate to="/" replace />;
  }

  return (
    <ControlLayout
      title="Academic years"
      subtitle="Define school years, seed terms, and mark the current academic cycle"
    >
      <AcademicYearsWorkspace />
    </ControlLayout>
  );
}

function AcademicYearsWorkspace() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [rows, setRows] = useState<YearRow[]>([]);
  const listPage = useClientPagination(rows);

  const [stats, setStats] = useState<YearStats | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [mode, setMode] = useState<'view' | 'create'>('view');
  const [form, setForm] = useState<YearForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const qs = params.toString();
      const res = await api.get<{ data: YearRow[]; meta: { stats: YearStats } }>(
        `/control/school-ops/academic-years${qs ? `?${qs}` : ''}`,
      );
      setRows(res.data);
      setStats(res.meta.stats);
      setSelectedId((current) => {
        if (mode === 'create') return current;
        if (current && res.data.some((r) => r.id === current)) return current;
        return res.data[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load academic years');
    } finally {
      setLoading(false);
    }
  }, [api, statusFilter, mode]);

  useEffect(() => {
    void load();
  }, [api, statusFilter]);

  const selectedRow = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );

  function startCreate() {
    setMode('create');
    setForm(emptyForm());
    setSelectedId(null);
  }

  function cancelForm() {
    setMode('view');
    setForm(emptyForm());
    if (!selectedId && rows[0]) setSelectedId(rows[0].id);
  }

  function addTermRow() {
    setForm((f) => ({ ...f, terms: [...f.terms, emptyTerm()] }));
  }

  function updateTermRow(index: number, patch: Partial<TermDraft>) {
    setForm((f) => ({
      ...f,
      terms: f.terms.map((t, i) => (i === index ? { ...t, ...patch } : t)),
    }));
  }

  function removeTermRow(index: number) {
    setForm((f) => ({ ...f, terms: f.terms.filter((_, i) => i !== index) }));
  }

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateFormFields(e.currentTarget)) return;

    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        starts_on: form.starts_on,
        ends_on: form.ends_on,
        status: form.status,
        is_current: form.is_current,
      };

      if (form.terms.length > 0) {
        payload.terms = form.terms.map((t, i) => ({
          name_en: t.name_en.trim(),
          name_ar: t.name_ar.trim() || t.name_en.trim(),
          sequence: Number(t.sequence) || i + 1,
          starts_on: t.starts_on,
          ends_on: t.ends_on,
        }));
      }

      const res = await api.post<{ data: YearRow; message: string }>(
        '/control/school-ops/academic-years',
        payload,
      );
      setMode('view');
      setSelectedId(res.data.id);
      await load();
      await feedback.success({
        title: 'Academic year created',
        message: res.message || `${res.data.name} is ready.`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create academic year');
    } finally {
      setSaving(false);
    }
  }

  async function setCurrentYear(row: YearRow) {
    try {
      const res = await api.post<{ data: YearRow; message: string }>(
        `/control/school-ops/academic-years/${row.id}/current`,
        {},
      );
      await feedback.success({
        title: 'Current year updated',
        message: res.message || `${res.data.name} is now the current academic year.`,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set current year');
    }
  }

  if (loading && rows.length === 0 && !stats) {
    return <p className="sy-muted">Loading academic years…</p>;
  }

  if (error && !stats && rows.length === 0) {
    return (
      <Panel title="Unable to load academic years">
        <p style={{ color: 'var(--stem-danger)', marginTop: 0 }}>{error}</p>
        <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
          Retry
        </Button>
      </Panel>
    );
  }

  return (
    <div className="sy-page">
      <section className="sy-hero stem-animate-rise">
        <div>
          <p className="sy-eyebrow">Control · School management</p>
          <h2 className="sy-hero-title">Academic years</h2>
          <p className="sy-hero-lead">
            Plan school-year calendars, optionally seed terms on create, and designate which year
            is active for enrollments and scheduling.
          </p>
        </div>
        <div className="sy-hero-actions">
          <div className="sy-action-row">
            <Button
              size="sm"
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => void load()}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Link to="/school/profile" className="sy-ghost-link">
              School profile
            </Link>
            <Link to="/school/campuses" className="sy-ghost-link">
              Campuses
            </Link>
            <Link to="/school/terms" className="sy-ghost-link">
              Terms
            </Link>
            <Button type="button" variant="apricot" onClick={startCreate} size="sm">
              + New year
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="sy-alert" role="alert">
          <span>{error}</span>
          <Button size="sm" type="button" variant="secondary" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <StatStrip
        items={[
          { label: 'Years', value: String(stats?.total ?? '—') },
          { label: 'Current', value: String(stats?.current ?? '—') },
          { label: 'Active status', value: String(stats?.active ?? '—') },
        ]}
      />

      <div className="sy-layout">
        <Panel
          title="Academic year directory"
          description="Select a year to review its terms and set it as current."
          action={
            <Toolbar as="form" onSubmit={(e) => { e.preventDefault(); void load(); }}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
              >
                <option value="">All statuses</option>
                <option value="planned">Planned</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
              <Button type="submit" variant="secondary" size="sm">
                Apply
              </Button>
            </Toolbar>
          }
        >
          <div className="sy-table-wrap">
            <table className="sy-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Dates</th>
                  <th>Terms</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="sy-empty">
                      No academic years yet. Create one to get started.
                    </td>
                  </tr>
                ) : (
                  listPage.pageItems.map((row) => (
                    <tr
                      key={row.id}
                      className={
                        selectedId === row.id && mode !== 'create' ? 'is-selected' : undefined
                      }
                      onClick={() => {
                        setMode('view');
                        setSelectedId(row.id);
                      }}
                    >
                      <td>
                        <strong>{row.name}</strong>
                        {row.is_current ? (
                          <span className="sy-current-badge">Current</span>
                        ) : null}
                      </td>
                      <td>{formatRange(row.starts_on, row.ends_on)}</td>
                      <td>{row.terms.length}</td>
                      <td>
                        <StatusPill status={row.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <PaginationBar
            page={listPage.page}
            lastPage={listPage.lastPage}
            total={listPage.total}
            onPageChange={listPage.setPage}
            disabled={loading}
          />
        </Panel>

        <aside className="sy-side" aria-live="polite">
          {mode === 'create' ? (
            <Panel
              title="Create academic year"
              description="Define the year span and optionally add initial terms."
            >
              <form onSubmit={onSave} className="sy-form" noValidate>
                <TextField
                  label="Year name"
                  required
                  value={form.name}
                  placeholder="2025–2026"
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
                <div className="sy-form-row">
                  <TextField
                    label="Starts on"
                    required
                    type="date"
                    value={form.starts_on}
                    onChange={(e) => setForm((f) => ({ ...f, starts_on: e.target.value }))}
                  />
                  <TextField
                    label="Ends on"
                    required
                    type="date"
                    value={form.ends_on}
                    onChange={(e) => setForm((f) => ({ ...f, ends_on: e.target.value }))}
                  />
                </div>
                <SelectField
                  label="Status"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="planned">Planned</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </SelectField>
                <label className="sy-check">
                  <input
                    type="checkbox"
                    checked={form.is_current}
                    onChange={(e) => setForm((f) => ({ ...f, is_current: e.target.checked }))}
                  />
                  <span>Set as current academic year</span>
                </label>

                <fieldset className="sy-fieldset">
                  <legend>Initial terms (optional)</legend>
                  {form.terms.length === 0 ? (
                    <p className="sy-muted">No terms yet — add rows or create them later on the Terms page.</p>
                  ) : (
                    <div className="sy-term-rows">
                      {form.terms.map((term, index) => (
                        <div key={index} className="sy-term-row">
                          <TextField
                            label="English name"
                            required
                            value={term.name_en}
                            onChange={(e) => updateTermRow(index, { name_en: e.target.value })}
                          />
                          <TextField
                            label="Arabic name"
                            required
                            value={term.name_ar}
                            onChange={(e) => updateTermRow(index, { name_ar: e.target.value })}
                          />
                          <TextField
                            label="Sequence"
                            type="number"
                            min={1}
                            value={term.sequence}
                            onChange={(e) => updateTermRow(index, { sequence: e.target.value })}
                          />
                          <TextField
                            label="Starts on"
                            required
                            type="date"
                            value={term.starts_on}
                            onChange={(e) => updateTermRow(index, { starts_on: e.target.value })}
                          />
                          <TextField
                            label="Ends on"
                            required
                            type="date"
                            value={term.ends_on}
                            onChange={(e) => updateTermRow(index, { ends_on: e.target.value })}
                          />
                          <Button
                            size="sm"
                            type="button"
                            variant="secondary"
                            onClick={() => removeTermRow(index)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button size="sm" type="button" variant="secondary" onClick={addTermRow}>
                    + Add term
                  </Button>
                </fieldset>

                <FormActions>
                  <Button size="sm" type="button" variant="secondary" onClick={cancelForm}>
                    Cancel
                  </Button>
                  <Button size="sm" type="submit" variant="primary" disabled={saving}>
                    {saving ? 'Creating…' : 'Create year'}
                  </Button>
                </FormActions>
              </form>
            </Panel>
          ) : selectedRow ? (
            <div className="sy-detail">
              <div className="sy-detail-head">
                <span className="sy-detail-mark" aria-hidden>
                  {selectedRow.name.slice(0, 4)}
                </span>
                <div>
                  <h3>{selectedRow.name}</h3>
                  <p>{formatRange(selectedRow.starts_on, selectedRow.ends_on)}</p>
                </div>
              </div>

              <dl className="sy-meta">
                <div>
                  <dt>Status</dt>
                  <dd>
                    <StatusPill status={selectedRow.status} />
                  </dd>
                </div>
                <div>
                  <dt>Current year</dt>
                  <dd>{selectedRow.is_current ? 'Yes' : 'No'}</dd>
                </div>
                <div>
                  <dt>Terms</dt>
                  <dd>{selectedRow.terms.length}</dd>
                </div>
              </dl>

              {selectedRow.terms.length > 0 ? (
                <ul className="sy-term-list">
                  {selectedRow.terms.map((t) => (
                    <li key={t.id}>
                      <strong>
                        {t.sequence}. {t.name_en}
                      </strong>
                      <span>
                        {formatRange(t.starts_on, t.ends_on)} · {statusLabel(t.status)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="sy-muted">No terms in this year yet.</p>
              )}

              <div className="sy-actions">
                {!selectedRow.is_current ? (
                  <ConfirmButton
                    size="sm"
                    title="Set as current year?"
                    message={`${selectedRow.name} will become the active academic year for the school.`}
                    confirmLabel="Set current"
                    tone="primary"
                    variant="primary"
                    onConfirm={() => setCurrentYear(selectedRow)}
                  >
                    Set as current
                  </ConfirmButton>
                ) : (
                  <Button size="sm" type="button" variant="secondary" disabled>
                    Current year
                  </Button>
                )}
                <Link to="/school/terms" className="sy-inline-link">
                  Manage all terms
                </Link>
              </div>

              <div className="sy-links">
                <Link to="/school/profile">School profile</Link>
                <Link to="/school/campuses">Campuses</Link>
                <Link to="/school/terms">Terms</Link>
              </div>
            </div>
          ) : (
            <div className="sy-detail sy-detail-empty">
              <p className="sy-empty">Select an academic year to review terms and actions.</p>
              <Button size="sm" type="button" variant="apricot" onClick={startCreate}>
                + New year
              </Button>
            </div>
          )}
        </aside>
      </div>

      <style>{yearStyles}</style>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`sy-pill status-${status}`}>{statusLabel(status)}</span>;
}

const yearStyles = `
.sy-page { display: grid; gap: 1rem; }
.sy-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(220px, 0.7fr);
  gap: 1.25rem;
  align-items: end;
  padding: 1.25rem 1.35rem;
  border-radius: 18px;
  border: 1px solid var(--stem-line);
  background:
    radial-gradient(120% 90% at 100% 0%, rgba(12, 124, 128, 0.14), transparent 55%),
    linear-gradient(145deg, #f3faf8, #eef5f2);
}
.sy-eyebrow {
  margin: 0 0 0.3rem;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--stem-teal-deep);
}
.sy-hero-title {
  margin: 0 0 0.35rem;
  font-family: var(--stem-font-display);
  font-size: clamp(1.35rem, 1.8vw, 1.55rem);
  letter-spacing: -0.03em;
}
.sy-hero-lead {
  margin: 0;
  color: var(--stem-ink-soft);
  line-height: 1.5;
  max-width: 42rem;
  font-size: var(--stem-text-base);
}
.sy-hero-actions { display: grid; gap: 0.75rem; justify-items: end; }
.sy-action-row { display: flex; flex-wrap: wrap; gap: 0.45rem; justify-content: flex-end; align-items: center; }
.sy-ghost-link, .sy-inline-link {
  display: inline-flex; align-items: center; min-height: 40px; padding: 0 0.75rem;
  font-size: var(--stem-text-md); font-weight: 600; color: var(--stem-teal-deep); text-decoration: none;
}
.sy-ghost-link:hover, .sy-inline-link:hover { text-decoration: underline; }
.sy-alert {
  display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;
  padding: 0.85rem 1rem; border-radius: 12px; background: #fef3f2; color: var(--stem-danger);
  border: 1px solid #fecdca; font-size: var(--stem-text-base);
}
.sy-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(280px, 0.85fr);
  gap: 1rem;
  align-items: start;
}
.sy-table-wrap { overflow-x: auto; margin: 0 -0.15rem; }
.sy-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--stem-text-base);
}
.sy-table th {
  text-align: left;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--stem-ink-soft);
  padding: 0.55rem 0.65rem;
  border-bottom: 1px solid var(--stem-line);
  white-space: nowrap;
}
.sy-table td {
  padding: 0.7rem 0.65rem;
  border-bottom: 1px solid var(--stem-line);
  vertical-align: top;
}
.sy-table tbody tr {
  cursor: pointer;
  transition: background 0.15s ease;
}
.sy-table tbody tr:hover { background: rgba(18, 160, 171, 0.04); }
.sy-table tbody tr.is-selected { background: rgba(12, 124, 128, 0.08); }
.sy-current-badge {
  display: inline-flex;
  margin-left: 0.45rem;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  font-size: var(--stem-text-xs);
  font-weight: 700;
  background: #eef8f6;
  color: #055456;
  border: 1px solid rgba(12, 124, 128, 0.22);
  vertical-align: middle;
}
.sy-empty { text-align: center; color: var(--stem-ink-soft); padding: 1.5rem 0.75rem !important; }
.sy-side { position: sticky; top: 0.75rem; }
.sy-detail {
  display: grid;
  gap: 1rem;
  padding: 1.1rem 1.15rem;
  border-radius: 16px;
  border: 1px solid var(--stem-line);
  background: #fff;
}
.sy-detail-empty { min-height: 180px; align-content: center; justify-items: start; gap: 0.85rem; }
.sy-detail-head {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}
.sy-detail-mark {
  min-width: 2.75rem;
  height: 2.5rem;
  padding: 0 0.55rem;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: var(--stem-text-sm);
  letter-spacing: 0.04em;
  background: #eef8f6;
  color: #055456;
  border: 1px solid rgba(12, 124, 128, 0.22);
}
.sy-detail-head h3 {
  margin: 0;
  font-size: var(--stem-text-xl);
  letter-spacing: -0.02em;
}
.sy-detail-head p {
  margin: 0.15rem 0 0;
  font-size: var(--stem-text-md);
  color: var(--stem-ink-soft);
}
.sy-meta {
  display: grid;
  gap: 0.55rem;
  margin: 0;
}
.sy-meta > div {
  display: grid;
  grid-template-columns: 7.5rem minmax(0, 1fr);
  gap: 0.5rem;
  align-items: baseline;
}
.sy-meta dt {
  margin: 0;
  font-size: var(--stem-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--stem-ink-soft);
}
.sy-meta dd { margin: 0; font-size: var(--stem-text-base); }
.sy-term-list {
  list-style: none;
  margin: 0;
  padding: 0.75rem 0 0;
  border-top: 1px solid var(--stem-line);
  display: grid;
  gap: 0.45rem;
}
.sy-term-list li { display: grid; gap: 0.1rem; font-size: var(--stem-text-md); }
.sy-term-list span { color: var(--stem-ink-soft); font-size: var(--stem-text-sm); }
.sy-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  padding-top: 0.35rem;
  border-top: 1px solid var(--stem-line);
}
.sy-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  padding-top: 0.25rem;
}
.sy-links a {
  font-size: var(--stem-text-md);
  font-weight: 600;
  color: var(--stem-teal-deep);
  text-decoration: none;
}
.sy-links a:hover { text-decoration: underline; }
.sy-form { display: grid; gap: 0.85rem; }
.sy-form-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}
.sy-fieldset {
  margin: 0;
  padding: 0.75rem 0.85rem;
  border: 1px solid var(--stem-line);
  border-radius: 12px;
  display: grid;
  gap: 0.65rem;
}
.sy-fieldset legend {
  padding: 0 0.25rem;
  font-size: var(--stem-text-sm);
  font-weight: 700;
  color: var(--stem-ink-soft);
}
.sy-term-rows { display: grid; gap: 0.85rem; }
.sy-term-row {
  display: grid;
  gap: 0.65rem;
  padding: 0.65rem;
  border-radius: 10px;
  background: #f8fafb;
  border: 1px solid var(--stem-line);
}
.sy-check {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: var(--stem-text-md);
  cursor: pointer;
}
.sy-check input { accent-color: var(--stem-teal-deep); }
.sy-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: var(--stem-text-xs);
  font-weight: 700;
  letter-spacing: 0.02em;
  background: #f3f4f6;
  color: #374151;
}
.sy-pill.status-planned { background: #eff6ff; color: #1d4ed8; }
.sy-pill.status-active { background: #ecfdf5; color: #047857; }
.sy-pill.status-archived { background: #f3f4f6; color: #4b5563; }
.sy-muted { color: var(--stem-ink-soft); font-size: var(--stem-text-base); margin: 0; }
@media (max-width: 960px) {
  .sy-hero, .sy-layout, .sy-form-row { grid-template-columns: 1fr; }
  .sy-hero-actions { justify-items: start; }
  .sy-action-row { justify-content: flex-start; }
  .sy-side { position: static; }
}
`;
