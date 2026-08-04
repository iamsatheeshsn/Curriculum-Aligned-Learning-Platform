import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import {
  Button,
  PaginationBar,
  useClientPagination,
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

type AcademicYearOption = {
  id: number;
  name: string;
};

type TermRow = {
  id: number;
  academic_year_id: number;
  name_en: string;
  name_ar: string;
  sequence: number;
  starts_on: string;
  ends_on: string;
  status: string;
  academic_year: AcademicYearOption | null;
};

type TermStats = {
  total: number;
  active: number;
  upcoming: number;
};

type TermForm = {
  academic_year_id: string;
  name_en: string;
  name_ar: string;
  sequence: string;
  starts_on: string;
  ends_on: string;
  status: string;
};

const emptyForm = (): TermForm => ({
  academic_year_id: '',
  name_en: '',
  name_ar: '',
  sequence: '1',
  starts_on: '',
  ends_on: '',
  status: 'upcoming',
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
 * List, create, and edit terms across all academic years.
 */
export function SchoolTermsPage() {
  const { isSuperAdmin, isTenantOwner, hasPermission } = useAuth();
  if (!canAccessSchoolOps(isSuperAdmin, isTenantOwner, hasPermission)) {
    return <Navigate to="/" replace />;
  }

  return (
    <ControlLayout
      title="Terms"
      subtitle="Manage term calendars within academic years for scheduling and enrollments"
    >
      <TermsWorkspace />
    </ControlLayout>
  );
}

function TermsWorkspace() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [rows, setRows] = useState<TermRow[]>([]);
  const listPage = useClientPagination(rows);

  const [years, setYears] = useState<AcademicYearOption[]>([]);
  const [stats, setStats] = useState<TermStats | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [yearFilter, setYearFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view');
  const [form, setForm] = useState<TermForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadYears = useCallback(async () => {
    try {
      const res = await api.get<{ data: { id: number; name: string }[] }>(
        '/control/school-ops/academic-years',
      );
      setYears(res.data.map((y) => ({ id: y.id, name: y.name })));
    } catch {
      /* years list is optional for filters */
    }
  }, [api]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (yearFilter) params.set('academic_year_id', yearFilter);
      if (statusFilter) params.set('status', statusFilter);
      const qs = params.toString();
      const res = await api.get<{ data: TermRow[]; meta: { stats: TermStats } }>(
        `/control/school-ops/terms${qs ? `?${qs}` : ''}`,
      );
      setRows(res.data);
      setStats(res.meta.stats);
      setSelectedId((current) => {
        if (mode === 'create') return current;
        if (current && res.data.some((r) => r.id === current)) return current;
        return res.data[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load terms');
    } finally {
      setLoading(false);
    }
  }, [api, yearFilter, statusFilter, mode]);

  useEffect(() => {
    void loadYears();
  }, [loadYears]);

  useEffect(() => {
    void load();
  }, [api, yearFilter, statusFilter]);

  const selectedRow = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );
  const showingForm = mode === 'create' || mode === 'edit';

  async function onFilter(e: FormEvent) {
    e.preventDefault();
    await load();
  }

  function startCreate() {
    setMode('create');
    setForm({
      ...emptyForm(),
      academic_year_id: yearFilter || years[0]?.id?.toString() || '',
    });
    setSelectedId(null);
  }

  function startEdit(row: TermRow) {
    setMode('edit');
    setSelectedId(row.id);
    setForm({
      academic_year_id: String(row.academic_year_id),
      name_en: row.name_en,
      name_ar: row.name_ar ?? '',
      sequence: String(row.sequence),
      starts_on: row.starts_on,
      ends_on: row.ends_on,
      status: row.status,
    });
  }

  function cancelForm() {
    setMode('view');
    setForm(emptyForm());
    if (!selectedId && rows[0]) setSelectedId(rows[0].id);
  }

  function buildPayload(includeYear: boolean) {
    const payload: Record<string, unknown> = {
      name_en: form.name_en.trim(),
      name_ar: form.name_ar.trim() || form.name_en.trim(),
      sequence: Number(form.sequence) || 1,
      starts_on: form.starts_on,
      ends_on: form.ends_on,
      status: form.status,
    };
    if (includeYear && form.academic_year_id) {
      payload.academic_year_id = Number(form.academic_year_id);
    }
    return payload;
  }

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateFormFields(e.currentTarget)) return;

    if (mode === 'create' && !form.academic_year_id) {
      setError('Select an academic year for the new term.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (mode === 'create') {
        const res = await api.post<{ data: TermRow; message: string }>(
          '/control/school-ops/terms',
          buildPayload(true),
        );
        setMode('view');
        setSelectedId(res.data.id);
        await load();
        await feedback.success({
          title: 'Term created',
          message: res.message || `${res.data.name_en} was added.`,
        });
      } else if (selectedId) {
        const res = await api.request<{ data: TermRow; message: string }>(
          `/control/school-ops/terms/${selectedId}`,
          { method: 'PUT', body: JSON.stringify(buildPayload(false)) },
        );
        setMode('view');
        await load();
        await feedback.success({
          title: 'Term updated',
          message: res.message || `${res.data.name_en} has been saved.`,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save term');
    } finally {
      setSaving(false);
    }
  }

  if (loading && rows.length === 0 && !stats) {
    return <p className="st-muted">Loading terms…</p>;
  }

  if (error && !stats && rows.length === 0) {
    return (
      <Panel title="Unable to load terms">
        <p style={{ color: 'var(--stem-danger)', marginTop: 0 }}>{error}</p>
        <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
          Retry
        </Button>
      </Panel>
    );
  }

  return (
    <div className="st-page">
      <section className="st-hero stem-animate-rise">
        <div>
          <p className="st-eyebrow">Control · School management</p>
          <h2 className="st-hero-title">Terms</h2>
          <p className="st-hero-lead">
            Create and adjust term windows within academic years — used for scheduling, reporting,
            and enrollment boundaries.
          </p>
        </div>
        <div className="st-hero-actions">
          <div className="st-action-row">
            <Button
              size="sm"
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => void load()}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Link to="/school/profile" className="st-ghost-link">
              School profile
            </Link>
            <Link to="/school/campuses" className="st-ghost-link">
              Campuses
            </Link>
            <Link to="/school/academic-years" className="st-ghost-link">
              Academic years
            </Link>
            <Button type="button" variant="apricot" onClick={startCreate} size="sm">
              + New term
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="st-alert" role="alert">
          <span>{error}</span>
          <Button size="sm" type="button" variant="secondary" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <StatStrip
        items={[
          { label: 'Terms', value: String(stats?.total ?? '—') },
          { label: 'Active', value: String(stats?.active ?? '—') },
          { label: 'Upcoming', value: String(stats?.upcoming ?? '—') },
        ]}
      />

      <div className="st-layout">
        <Panel
          title="Term directory"
          description="Filter by year or status, then select a row to edit."
          action={
            <Toolbar as="form" onSubmit={onFilter}>
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                aria-label="Filter by academic year"
              >
                <option value="">All years</option>
                {years.map((y) => (
                  <option key={y.id} value={String(y.id)}>
                    {y.name}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
              >
                <option value="">All statuses</option>
                <option value="upcoming">Upcoming</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
              </select>
              <Button type="submit" variant="secondary" size="sm">
                Apply
              </Button>
            </Toolbar>
          }
        >
          <div className="st-table-wrap">
            <table className="st-table">
              <thead>
                <tr>
                  <th>Term</th>
                  <th>Academic year</th>
                  <th>Dates</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="st-empty">
                      No terms match this filter. Create one to get started.
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
                        <strong>
                          {row.sequence}. {row.name_en}
                        </strong>
                        {row.name_ar ? (
                          <div className="st-slug">{row.name_ar}</div>
                        ) : null}
                      </td>
                      <td>{row.academic_year?.name ?? `#${row.academic_year_id}`}</td>
                      <td>{formatRange(row.starts_on, row.ends_on)}</td>
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

        <aside className="st-side" aria-live="polite">
          {showingForm ? (
            <Panel
              title={mode === 'create' ? 'Create term' : 'Edit term'}
              description={
                mode === 'create'
                  ? 'Add a term within an academic year date range.'
                  : 'Update term names, dates, sequence, or status.'
              }
            >
              <form onSubmit={onSave} className="st-form" noValidate>
                {mode === 'create' ? (
                  <SelectField
                    label="Academic year"
                    required
                    value={form.academic_year_id}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, academic_year_id: e.target.value }))
                    }
                  >
                    <option value="">Select year…</option>
                    {years.map((y) => (
                      <option key={y.id} value={String(y.id)}>
                        {y.name}
                      </option>
                    ))}
                  </SelectField>
                ) : null}
                <TextField
                  label="English name"
                  required
                  value={form.name_en}
                  onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
                />
                <TextField
                  label="Arabic name"
                  required
                  value={form.name_ar}
                  onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))}
                />
                <TextField
                  label="Sequence"
                  type="number"
                  min={1}
                  value={form.sequence}
                  onChange={(e) => setForm((f) => ({ ...f, sequence: e.target.value }))}
                />
                <div className="st-form-row">
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
                  <option value="upcoming">Upcoming</option>
                  <option value="active">Active</option>
                  <option value="closed">Closed</option>
                </SelectField>
                <FormActions>
                  <Button size="sm" type="button" variant="secondary" onClick={cancelForm}>
                    Cancel
                  </Button>
                  <Button size="sm" type="submit" variant="primary" disabled={saving}>
                    {saving ? 'Saving…' : mode === 'create' ? 'Create term' : 'Save changes'}
                  </Button>
                </FormActions>
              </form>
            </Panel>
          ) : selectedRow ? (
            <div className="st-detail">
              <div className="st-detail-head">
                <span className="st-detail-mark" aria-hidden>
                  T{selectedRow.sequence}
                </span>
                <div>
                  <h3>{selectedRow.name_en}</h3>
                  <p>{selectedRow.name_ar || '—'}</p>
                </div>
              </div>

              <dl className="st-meta">
                <div>
                  <dt>Academic year</dt>
                  <dd>{selectedRow.academic_year?.name ?? `#${selectedRow.academic_year_id}`}</dd>
                </div>
                <div>
                  <dt>Sequence</dt>
                  <dd>{selectedRow.sequence}</dd>
                </div>
                <div>
                  <dt>Dates</dt>
                  <dd>{formatRange(selectedRow.starts_on, selectedRow.ends_on)}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <StatusPill status={selectedRow.status} />
                  </dd>
                </div>
              </dl>

              <div className="st-actions">
                <Button size="sm" type="button" variant="secondary" onClick={() => startEdit(selectedRow)}>
                  Edit
                </Button>
              </div>

              <div className="st-links">
                <Link to="/school/profile">School profile</Link>
                <Link to="/school/campuses">Campuses</Link>
                <Link to="/school/academic-years">Academic years</Link>
              </div>
            </div>
          ) : (
            <div className="st-detail st-detail-empty">
              <p className="st-empty">Select a term to review details and actions.</p>
              <Button size="sm" type="button" variant="apricot" onClick={startCreate}>
                + New term
              </Button>
            </div>
          )}
        </aside>
      </div>

      <style>{termStyles}</style>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`st-pill status-${status}`}>{statusLabel(status)}</span>;
}

const termStyles = `
.st-page { display: grid; gap: 1rem; }
.st-hero {
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
.st-eyebrow {
  margin: 0 0 0.3rem;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--stem-teal-deep);
}
.st-hero-title {
  margin: 0 0 0.35rem;
  font-family: var(--stem-font-display);
  font-size: clamp(1.35rem, 1.8vw, 1.55rem);
  letter-spacing: -0.03em;
}
.st-hero-lead {
  margin: 0;
  color: var(--stem-ink-soft);
  line-height: 1.5;
  max-width: 42rem;
  font-size: var(--stem-text-base);
}
.st-hero-actions { display: grid; gap: 0.75rem; justify-items: end; }
.st-action-row { display: flex; flex-wrap: wrap; gap: 0.45rem; justify-content: flex-end; align-items: center; }
.st-ghost-link {
  display: inline-flex; align-items: center; min-height: 40px; padding: 0 0.75rem;
  font-size: var(--stem-text-md); font-weight: 600; color: var(--stem-teal-deep); text-decoration: none;
}
.st-ghost-link:hover { text-decoration: underline; }
.st-alert {
  display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;
  padding: 0.85rem 1rem; border-radius: 12px; background: #fef3f2; color: var(--stem-danger);
  border: 1px solid #fecdca; font-size: var(--stem-text-base);
}
.st-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(280px, 0.85fr);
  gap: 1rem;
  align-items: start;
}
.st-table-wrap { overflow-x: auto; margin: 0 -0.15rem; }
.st-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--stem-text-base);
}
.st-table th {
  text-align: left;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--stem-ink-soft);
  padding: 0.55rem 0.65rem;
  border-bottom: 1px solid var(--stem-line);
  white-space: nowrap;
}
.st-table td {
  padding: 0.7rem 0.65rem;
  border-bottom: 1px solid var(--stem-line);
  vertical-align: top;
}
.st-table tbody tr {
  cursor: pointer;
  transition: background 0.15s ease;
}
.st-table tbody tr:hover { background: rgba(18, 160, 171, 0.04); }
.st-table tbody tr.is-selected { background: rgba(12, 124, 128, 0.08); }
.st-slug { margin-top: 0.15rem; font-size: var(--stem-text-sm); color: var(--stem-ink-soft); }
.st-empty { text-align: center; color: var(--stem-ink-soft); padding: 1.5rem 0.75rem !important; }
.st-side { position: sticky; top: 0.75rem; }
.st-detail {
  display: grid;
  gap: 1rem;
  padding: 1.1rem 1.15rem;
  border-radius: 16px;
  border: 1px solid var(--stem-line);
  background: #fff;
}
.st-detail-empty { min-height: 180px; align-content: center; justify-items: start; gap: 0.85rem; }
.st-detail-head {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}
.st-detail-mark {
  min-width: 2.75rem;
  height: 2.5rem;
  padding: 0 0.55rem;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: var(--stem-text-md);
  letter-spacing: 0.04em;
  background: #eef8f6;
  color: #055456;
  border: 1px solid rgba(12, 124, 128, 0.22);
}
.st-detail-head h3 {
  margin: 0;
  font-size: var(--stem-text-xl);
  letter-spacing: -0.02em;
}
.st-detail-head p {
  margin: 0.15rem 0 0;
  font-size: var(--stem-text-md);
  color: var(--stem-ink-soft);
}
.st-meta {
  display: grid;
  gap: 0.55rem;
  margin: 0;
}
.st-meta > div {
  display: grid;
  grid-template-columns: 7.5rem minmax(0, 1fr);
  gap: 0.5rem;
  align-items: baseline;
}
.st-meta dt {
  margin: 0;
  font-size: var(--stem-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--stem-ink-soft);
}
.st-meta dd { margin: 0; font-size: var(--stem-text-base); }
.st-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--stem-line);
}
.st-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  padding-top: 0.25rem;
}
.st-links a {
  font-size: var(--stem-text-md);
  font-weight: 600;
  color: var(--stem-teal-deep);
  text-decoration: none;
}
.st-links a:hover { text-decoration: underline; }
.st-form { display: grid; gap: 0.85rem; }
.st-form-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}
.st-pill {
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
.st-pill.status-upcoming { background: #eff6ff; color: #1d4ed8; }
.st-pill.status-active { background: #ecfdf5; color: #047857; }
.st-pill.status-closed { background: #f3f4f6; color: #4b5563; }
.st-muted { color: var(--stem-ink-soft); font-size: var(--stem-text-base); margin: 0; }
@media (max-width: 960px) {
  .st-hero, .st-layout, .st-form-row { grid-template-columns: 1fr; }
  .st-hero-actions { justify-items: start; }
  .st-action-row { justify-content: flex-start; }
  .st-side { position: static; }
}
`;
