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

type CampusRow = {
  id: number;
  code: string;
  name_en: string;
  name_ar: string | null;
  timezone: string | null;
  address: string | null;
  status: string;
  school_id: number;
  tenant_id: number;
};

type CampusStats = {
  total: number;
  active: number;
  inactive: number;
};

type CampusForm = {
  code: string;
  name_en: string;
  name_ar: string;
  timezone: string;
  address: string;
  status: string;
};

const TIMEZONES = [
  'Asia/Riyadh',
  'Asia/Dubai',
  'Asia/Kuwait',
  'Asia/Bahrain',
  'Asia/Qatar',
  'Asia/Muscat',
  'Asia/Amman',
  'Asia/Beirut',
  'Africa/Cairo',
  'UTC',
];

const emptyForm = (): CampusForm => ({
  code: '',
  name_en: '',
  name_ar: '',
  timezone: 'Asia/Riyadh',
  address: '',
  status: 'active',
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

/**
 * List and manage campuses for the active school.
 */
export function SchoolCampusesPage() {
  const { isSuperAdmin, isTenantOwner, hasPermission } = useAuth();
  if (!canAccessSchoolOps(isSuperAdmin, isTenantOwner, hasPermission)) {
    return <Navigate to="/" replace />;
  }

  return (
    <ControlLayout
      title="Campuses"
      subtitle="Manage physical locations, timezones, and campus lifecycle for your school"
    >
      <CampusesWorkspace />
    </ControlLayout>
  );
}

function CampusesWorkspace() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [rows, setRows] = useState<CampusRow[]>([]);
  const listPage = useClientPagination(rows);

  const [stats, setStats] = useState<CampusStats | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view');
  const [form, setForm] = useState<CampusForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      const qs = params.toString();
      const res = await api.get<{ data: CampusRow[]; meta: { stats: CampusStats } }>(
        `/control/school-ops/campuses${qs ? `?${qs}` : ''}`,
      );
      setRows(res.data);
      setStats(res.meta.stats);
      setSelectedId((current) => {
        if (mode === 'create') return current;
        if (current && res.data.some((r) => r.id === current)) return current;
        return res.data[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campuses');
    } finally {
      setLoading(false);
    }
  }, [api, search, statusFilter, mode]);

  useEffect(() => {
    void load();
  }, [api, statusFilter]);

  const selectedRow = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );
  const showingForm = mode === 'create' || mode === 'edit';

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    await load();
  }

  function startCreate() {
    setMode('create');
    setForm(emptyForm());
    setSelectedId(null);
  }

  function startEdit(row: CampusRow) {
    setMode('edit');
    setSelectedId(row.id);
    setForm({
      code: row.code ?? '',
      name_en: row.name_en,
      name_ar: row.name_ar ?? '',
      timezone: row.timezone || 'Asia/Riyadh',
      address: row.address ?? '',
      status: row.status,
    });
  }

  function cancelForm() {
    setMode('view');
    setForm(emptyForm());
    if (!selectedId && rows[0]) setSelectedId(rows[0].id);
  }

  function buildPayload() {
    return {
      code: form.code.trim() || undefined,
      name_en: form.name_en.trim(),
      name_ar: form.name_ar.trim() || undefined,
      timezone: form.timezone,
      address: form.address.trim() || undefined,
      status: form.status,
    };
  }

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateFormFields(e.currentTarget)) return;

    setSaving(true);
    setError(null);
    try {
      if (mode === 'create') {
        const res = await api.post<{ data: CampusRow; message: string }>(
          '/control/school-ops/campuses',
          buildPayload(),
        );
        setMode('view');
        setSelectedId(res.data.id);
        await load();
        await feedback.success({
          title: 'Campus created',
          message: res.message || `${res.data.name_en} is ready.`,
        });
      } else if (selectedId) {
        const res = await api.request<{ data: CampusRow; message: string }>(
          `/control/school-ops/campuses/${selectedId}`,
          { method: 'PUT', body: JSON.stringify(buildPayload()) },
        );
        setMode('view');
        await load();
        await feedback.success({
          title: 'Campus updated',
          message: res.message || `${res.data.name_en} has been saved.`,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save campus');
    } finally {
      setSaving(false);
    }
  }

  async function deleteCampus(row: CampusRow) {
    try {
      await api.request(`/control/school-ops/campuses/${row.id}`, { method: 'DELETE' });
      await feedback.success({
        title: 'Campus deleted',
        message: `${row.name_en} was removed.`,
      });
      setSelectedId(null);
      setMode('view');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete campus');
    }
  }

  if (loading && rows.length === 0 && !stats) {
    return <p className="sc-muted">Loading campuses…</p>;
  }

  if (error && !stats && rows.length === 0) {
    return (
      <Panel title="Unable to load campuses">
        <p style={{ color: 'var(--stem-danger)', marginTop: 0 }}>{error}</p>
        <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
          Retry
        </Button>
      </Panel>
    );
  }

  return (
    <div className="sc-page">
      <section className="sc-hero stem-animate-rise">
        <div>
          <p className="sc-eyebrow">Control · School management</p>
          <h2 className="sc-hero-title">Campuses</h2>
          <p className="sc-hero-lead">
            Add and maintain campus locations with their own timezone and address — the foundation
            for classes, sections, and local operations.
          </p>
        </div>
        <div className="sc-hero-actions">
          <div className="sc-action-row">
            <Button
              size="sm"
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => void load()}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Link to="/school/profile" className="sc-ghost-link">
              School profile
            </Link>
            <Link to="/school/academic-years" className="sc-ghost-link">
              Academic years
            </Link>
            <Link to="/school/terms" className="sc-ghost-link">
              Terms
            </Link>
            <Button type="button" variant="apricot" onClick={startCreate} size="sm">
              + New campus
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="sc-alert" role="alert">
          <span>{error}</span>
          <Button size="sm" type="button" variant="secondary" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <StatStrip
        items={[
          { label: 'Campuses', value: String(stats?.total ?? '—') },
          { label: 'Active', value: String(stats?.active ?? '—') },
          { label: 'Inactive', value: String(stats?.inactive ?? '—') },
        ]}
      />

      <div className="sc-layout">
        <Panel
          title="Campus directory"
          description="Search by code or name, then select a row to edit or remove."
          action={
            <Toolbar as="form" onSubmit={onSearch}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search code or name"
                aria-label="Search campuses"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <Button type="submit" variant="secondary" size="sm">
                Apply
              </Button>
            </Toolbar>
          }
        >
          <div className="sc-table-wrap">
            <table className="sc-table">
              <thead>
                <tr>
                  <th>Campus</th>
                  <th>Timezone</th>
                  <th>Address</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="sc-empty">
                      No campuses match this filter. Add one to get started.
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
                        <strong>{row.name_en}</strong>
                        <div className="sc-slug">
                          <code>{row.code || '—'}</code>
                          {row.name_ar ? <span> · {row.name_ar}</span> : null}
                        </div>
                      </td>
                      <td>{row.timezone ?? '—'}</td>
                      <td>{row.address ? row.address.slice(0, 48) : '—'}</td>
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

        <aside className="sc-side" aria-live="polite">
          {showingForm ? (
            <Panel
              title={mode === 'create' ? 'Create campus' : 'Edit campus'}
              description={
                mode === 'create'
                  ? 'Add a campus location with timezone and optional address.'
                  : 'Update campus details or lifecycle status.'
              }
            >
              <form onSubmit={onSave} className="sc-form" noValidate>
                <TextField
                  label="Campus code"
                  value={form.code}
                  maxLength={64}
                  placeholder="MAIN"
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  hint="Optional short identifier"
                />
                <TextField
                  label="English name"
                  required
                  value={form.name_en}
                  onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
                />
                <TextField
                  label="Arabic name"
                  value={form.name_ar}
                  onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))}
                />
                <SelectField
                  label="Timezone"
                  value={form.timezone}
                  onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </SelectField>
                <TextField
                  label="Address"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  hint="Optional — street, city, or campus directions"
                />
                <SelectField
                  label="Status"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </SelectField>
                <FormActions>
                  <Button size="sm" type="button" variant="secondary" onClick={cancelForm}>
                    Cancel
                  </Button>
                  <Button size="sm" type="submit" variant="primary" disabled={saving}>
                    {saving ? 'Saving…' : mode === 'create' ? 'Create campus' : 'Save changes'}
                  </Button>
                </FormActions>
              </form>
            </Panel>
          ) : selectedRow ? (
            <div className="sc-detail">
              <div className="sc-detail-head">
                <span className="sc-detail-mark" aria-hidden>
                  {selectedRow.code?.slice(0, 3) || 'CP'}
                </span>
                <div>
                  <h3>{selectedRow.name_en}</h3>
                  <p>
                    <code>{selectedRow.code || '—'}</code>
                    {selectedRow.name_ar ? ` · ${selectedRow.name_ar}` : ''}
                  </p>
                </div>
              </div>

              <dl className="sc-meta">
                <div>
                  <dt>Status</dt>
                  <dd>
                    <StatusPill status={selectedRow.status} />
                  </dd>
                </div>
                <div>
                  <dt>Timezone</dt>
                  <dd>{selectedRow.timezone ?? '—'}</dd>
                </div>
                <div>
                  <dt>Address</dt>
                  <dd>{selectedRow.address || '—'}</dd>
                </div>
              </dl>

              <div className="sc-actions">
                <Button size="sm" type="button" variant="secondary" onClick={() => startEdit(selectedRow)}>
                  Edit
                </Button>
                <ConfirmButton
                  size="sm"
                  title="Delete campus?"
                  message={`${selectedRow.name_en} will be permanently removed.`}
                  confirmLabel="Delete"
                  tone="danger"
                  variant="danger"
                  onConfirm={() => deleteCampus(selectedRow)}
                >
                  Delete
                </ConfirmButton>
              </div>

              <div className="sc-links">
                <Link to="/school/profile">School profile</Link>
                <Link to="/school/academic-years">Academic years</Link>
                <Link to="/school/terms">Terms</Link>
              </div>
            </div>
          ) : (
            <div className="sc-detail sc-detail-empty">
              <p className="sc-empty">Select a campus to review details and actions.</p>
              <Button size="sm" type="button" variant="apricot" onClick={startCreate}>
                + New campus
              </Button>
            </div>
          )}
        </aside>
      </div>

      <style>{campusStyles}</style>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`sc-pill status-${status}`}>{statusLabel(status)}</span>;
}

const campusStyles = `
.sc-page { display: grid; gap: 1rem; }
.sc-hero {
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
.sc-eyebrow {
  margin: 0 0 0.3rem;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--stem-teal-deep);
}
.sc-hero-title {
  margin: 0 0 0.35rem;
  font-family: var(--stem-font-display);
  font-size: clamp(1.35rem, 1.8vw, 1.55rem);
  letter-spacing: -0.03em;
}
.sc-hero-lead {
  margin: 0;
  color: var(--stem-ink-soft);
  line-height: 1.5;
  max-width: 42rem;
  font-size: var(--stem-text-base);
}
.sc-hero-actions { display: grid; gap: 0.75rem; justify-items: end; }
.sc-action-row { display: flex; flex-wrap: wrap; gap: 0.45rem; justify-content: flex-end; align-items: center; }
.sc-ghost-link {
  display: inline-flex; align-items: center; min-height: 40px; padding: 0 0.75rem;
  font-size: var(--stem-text-md); font-weight: 600; color: var(--stem-teal-deep); text-decoration: none;
}
.sc-ghost-link:hover { text-decoration: underline; }
.sc-alert {
  display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;
  padding: 0.85rem 1rem; border-radius: 12px; background: #fef3f2; color: var(--stem-danger);
  border: 1px solid #fecdca; font-size: var(--stem-text-base);
}
.sc-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(280px, 0.85fr);
  gap: 1rem;
  align-items: start;
}
.sc-table-wrap { overflow-x: auto; margin: 0 -0.15rem; }
.sc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--stem-text-base);
}
.sc-table th {
  text-align: left;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--stem-ink-soft);
  padding: 0.55rem 0.65rem;
  border-bottom: 1px solid var(--stem-line);
  white-space: nowrap;
}
.sc-table td {
  padding: 0.7rem 0.65rem;
  border-bottom: 1px solid var(--stem-line);
  vertical-align: top;
}
.sc-table tbody tr {
  cursor: pointer;
  transition: background 0.15s ease;
}
.sc-table tbody tr:hover { background: rgba(18, 160, 171, 0.04); }
.sc-table tbody tr.is-selected { background: rgba(12, 124, 128, 0.08); }
.sc-slug { margin-top: 0.15rem; font-size: var(--stem-text-sm); color: var(--stem-ink-soft); }
.sc-slug code { font-size: var(--stem-text-sm); }
.sc-empty { text-align: center; color: var(--stem-ink-soft); padding: 1.5rem 0.75rem !important; }
.sc-side { position: sticky; top: 0.75rem; }
.sc-detail {
  display: grid;
  gap: 1rem;
  padding: 1.1rem 1.15rem;
  border-radius: 16px;
  border: 1px solid var(--stem-line);
  background: #fff;
}
.sc-detail-empty { min-height: 180px; align-content: center; justify-items: start; gap: 0.85rem; }
.sc-detail-head {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}
.sc-detail-mark {
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
.sc-detail-head h3 {
  margin: 0;
  font-size: var(--stem-text-xl);
  letter-spacing: -0.02em;
}
.sc-detail-head p {
  margin: 0.15rem 0 0;
  font-size: var(--stem-text-md);
  color: var(--stem-ink-soft);
}
.sc-meta {
  display: grid;
  gap: 0.55rem;
  margin: 0;
}
.sc-meta > div {
  display: grid;
  grid-template-columns: 7.5rem minmax(0, 1fr);
  gap: 0.5rem;
  align-items: baseline;
}
.sc-meta dt {
  margin: 0;
  font-size: var(--stem-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--stem-ink-soft);
}
.sc-meta dd { margin: 0; font-size: var(--stem-text-base); }
.sc-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--stem-line);
}
.sc-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  padding-top: 0.25rem;
}
.sc-links a {
  font-size: var(--stem-text-md);
  font-weight: 600;
  color: var(--stem-teal-deep);
  text-decoration: none;
}
.sc-links a:hover { text-decoration: underline; }
.sc-form { display: grid; gap: 0.85rem; }
.sc-pill {
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
.sc-pill.status-active { background: #ecfdf5; color: #047857; }
.sc-pill.status-inactive { background: #f3f4f6; color: #4b5563; }
.sc-muted { color: var(--stem-ink-soft); font-size: var(--stem-text-base); margin: 0; }
@media (max-width: 960px) {
  .sc-hero, .sc-layout { grid-template-columns: 1fr; }
  .sc-hero-actions { justify-items: start; }
  .sc-action-row { justify-content: flex-start; }
  .sc-side { position: static; }
}
`;
