import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import {
  Button,
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

type TenantSchoolOption = {
  id: number;
  name: string;
  slug: string;
  status: string;
  schools: { id: number; code: string; name_en: string; status: string }[];
};

type CampusRow = {
  id: number;
  code: string;
  name_en: string;
  name_ar: string;
  timezone: string | null;
  address: string | null;
  status: string;
  tenant_id: number;
  school_id: number;
  tenant: { id: number; name: string; slug: string; status: string } | null;
  school: {
    id: number;
    code: string;
    name_en: string;
    name_ar?: string | null;
    status: string;
    timezone?: string | null;
  } | null;
  plan_limit?: {
    max_campuses: number | null;
    current: number;
    plan_code?: string | null;
    plan_name?: string | null;
  };
  created_at?: string | null;
  updated_at?: string | null;
};

type CampusStats = {
  total_campuses: number;
  active: number;
  inactive: number;
  schools: number;
  tenants_with_campuses: number;
};

type CampusForm = {
  school_id: number | '';
  code: string;
  name_en: string;
  name_ar: string;
  timezone: string;
  address: string;
  status: string;
};

const emptyForm = (): CampusForm => ({
  school_id: '',
  code: '',
  name_en: '',
  name_ar: '',
  timezone: 'Asia/Riyadh',
  address: '',
  status: 'active',
});


const TIMEZONES = [
  'Asia/Riyadh',
  'Asia/Dubai',
  'Asia/Kuwait',
  'Asia/Bahrain',
  'Asia/Qatar',
  'Asia/Muscat',
  'UTC',
];

/**
 * Control workspace for campuses across all school organisations.
 */
export function CampusesPage() {
  const { isSuperAdmin, hasPermission } = useAuth();
  if (!isSuperAdmin && !hasPermission('platform.tenants.manage')) {
    return <Navigate to="/" replace />;
  }

  return (
    <ControlLayout
      title="Campuses"
      subtitle="Browse and manage physical campuses across every school organisation"
    >
      <CampusesWorkspace />
    </ControlLayout>
  );
}

function CampusesWorkspace() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [campuses, setCampuses] = useState<CampusRow[]>([]);
  const [stats, setStats] = useState<CampusStats | null>(null);
  const [tenants, setTenants] = useState<TenantSchoolOption[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<CampusRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view');
  const [form, setForm] = useState<CampusForm>(emptyForm);

  const schoolOptions = useMemo(
    () =>
      tenants.flatMap((t) =>
        t.schools.map((s) => ({
          id: s.id,
          label: `${t.name} · ${s.name_en}`,
          tenantSlug: t.slug,
          schoolCode: s.code,
          status: s.status,
        })),
      ),
    [tenants],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (tenantFilter) params.set('tenant_id', tenantFilter);
      const qs = params.toString();
      const res = await api.get<{
        data: CampusRow[];
        meta: { stats: CampusStats; tenants: TenantSchoolOption[] };
      }>(`/control/campuses${qs ? `?${qs}` : ''}`);
      setCampuses(res.data);
      setStats(res.meta.stats);
      setTenants(res.meta.tenants);
      setSelectedId((current) => {
        if (current && res.data.some((c) => c.id === current)) return current;
        return res.data[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campuses');
    } finally {
      setLoading(false);
    }
  }, [api, search, statusFilter, tenantFilter]);

  useEffect(() => {
    void load();
  }, [api, statusFilter, tenantFilter]);

  useEffect(() => {
    if (!selectedId || mode === 'create') {
      if (mode !== 'create') setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void (async () => {
      try {
        const res = await api.get<{ data: CampusRow }>(`/control/campuses/${selectedId}`);
        if (!cancelled) setDetail(res.data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load campus details');
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, selectedId, mode, campuses]);

  const selectedSummary = useMemo(
    () => campuses.find((c) => c.id === selectedId) ?? null,
    [campuses, selectedId],
  );

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    await load();
  }

  function startCreate() {
    setMode('create');
    const firstSchool = schoolOptions[0]?.id ?? '';
    setForm({ ...emptyForm(), school_id: firstSchool });
    setSelectedId(null);
    setDetail(null);
  }

  function startEdit(campus: CampusRow) {
    setMode('edit');
    setForm({
      school_id: campus.school_id,
      code: campus.code,
      name_en: campus.name_en,
      name_ar: campus.name_ar ?? '',
      timezone: campus.timezone ?? 'Asia/Riyadh',
      address: campus.address ?? '',
      status: campus.status,
    });
  }

  function cancelForm() {
    setMode('view');
    setForm(emptyForm());
    if (selectedSummary) setSelectedId(selectedSummary.id);
    else if (campuses[0]) setSelectedId(campuses[0].id);
  }

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateFormFields(e.currentTarget)) return;
    if (!form.school_id) {
      setError('Select a school for this campus.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        school_id: Number(form.school_id),
        code: form.code.trim() || undefined,
        name_en: form.name_en.trim(),
        name_ar: form.name_ar.trim() || form.name_en.trim(),
        timezone: form.timezone || null,
        address: form.address.trim() || null,
        status: form.status,
      };

      if (mode === 'create') {
        const res = await api.post<{ message: string; data: CampusRow }>('/control/campuses', body);
        await feedback.success({
          title: 'Campus created',
          message: `${res.data.name_en} (${res.data.code}) is ready.`,
        });
        setMode('view');
        setSelectedId(res.data.id);
      } else if (mode === 'edit' && selectedId) {
        const res = await api.request<{ message: string; data: CampusRow }>(
          `/control/campuses/${selectedId}`,
          { method: 'PUT', body: JSON.stringify(body) },
        );
        await feedback.success({
          title: 'Campus updated',
          message: `${res.data.name_en} was saved.`,
        });
        setMode('view');
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save campus');
    } finally {
      setSaving(false);
    }
  }

  async function deleteCampus(campus: CampusRow) {
    try {
      await api.request(`/control/campuses/${campus.id}`, { method: 'DELETE' });
      await feedback.success({
        title: 'Campus deleted',
        message: `${campus.name_en} was soft-deleted.`,
      });
      if (selectedId === campus.id) {
        setSelectedId(null);
        setDetail(null);
      }
      setMode('view');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete campus');
    }
  }

  async function setCampusStatus(campus: CampusRow, status: string) {
    try {
      await api.request(`/control/campuses/${campus.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      await feedback.success({
        title: 'Status updated',
        message: `${campus.name_en} is now ${statusLabel(status)}.`,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update status');
    }
  }

  if (loading && campuses.length === 0 && !stats) {
    return <p className="cp-muted">Loading campuses…</p>;
  }

  if (error && !stats && campuses.length === 0) {
    return (
      <Panel title="Unable to load campuses">
        <p style={{ color: 'var(--stem-danger)', marginTop: 0 }}>{error}</p>
        <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
          Retry
        </Button>
      </Panel>
    );
  }

  const showingForm = mode === 'create' || mode === 'edit';
  const activeDetail = detail ?? selectedSummary;

  return (
    <div className="cp-page">
      <section className="cp-hero stem-animate-rise">
        <div>
          <p className="cp-eyebrow">Control · Tenant management</p>
          <h2 className="cp-hero-title">Campuses</h2>
          <p className="cp-hero-lead">
            Manage physical locations for every school organisation — address, timezone, and
            lifecycle status in one place.
          </p>
        </div>
        <div className="cp-hero-actions">
          <div className="cp-action-row">
            <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Link to="/tenants" className="cp-ghost-link">
              Tenants
            </Link>
            <Button type="button" variant="apricot" onClick={startCreate} size="sm">
              + New campus
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="cp-alert" role="alert">
          <span>{error}</span>
          <Button size="sm" type="button" variant="secondary" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <StatStrip
        items={[
          { label: 'Campuses', value: String(stats?.total_campuses ?? '—') },
          { label: 'Active', value: String(stats?.active ?? '—') },
          { label: 'Schools', value: String(stats?.schools ?? '—') },
          { label: 'Orgs with campuses', value: String(stats?.tenants_with_campuses ?? '—') },
        ]}
      />

      <div className="cp-layout">
        <Panel
          title="Campus directory"
          description="Search and filter campuses across all organisations."
          action={
            <Toolbar as="form" onSubmit={onSearch}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, code, address"
                aria-label="Search campuses"
              />
              <select
                value={tenantFilter}
                onChange={(e) => setTenantFilter(e.target.value)}
                aria-label="Filter by organisation"
              >
                <option value="">All organisations</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
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
          <div className="cp-table-wrap">
            <table className="cp-table">
              <thead>
                <tr>
                  <th>Campus</th>
                  <th>Organisation</th>
                  <th>School</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {campuses.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="cp-empty">
                      No campuses match this filter. Create one to get started.
                    </td>
                  </tr>
                ) : (
                  campuses.map((row) => (
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
                        <div className="cp-slug">
                          <code>{row.code}</code>
                        </div>
                      </td>
                      <td>
                        {row.tenant?.name ?? '—'}
                        {row.tenant?.slug ? (
                          <div className="cp-slug">
                            <code>{row.tenant.slug}</code>
                          </div>
                        ) : null}
                      </td>
                      <td>{row.school?.name_en ?? '—'}</td>
                      <td>
                        <StatusPill status={row.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <aside className="cp-side" aria-live="polite">
          {showingForm ? (
            <Panel
              title={mode === 'create' ? 'Create campus' : 'Edit campus'}
              description={
                mode === 'create'
                  ? 'Attach a new location to a school organisation.'
                  : 'Update campus details and lifecycle status.'
              }
            >
              <form onSubmit={onSave} className="cp-form" noValidate>
                <SelectField
                  label="School"
                  required
                  value={form.school_id === '' ? '' : String(form.school_id)}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      school_id: e.target.value ? Number(e.target.value) : '',
                    }))
                  }
                >
                  <option value="">Select school</option>
                  {schoolOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label} ({s.schoolCode})
                    </option>
                  ))}
                </SelectField>

                <div className="cp-form-grid">
                  <TextField
                    label="Campus name (EN)"
                    required
                    value={form.name_en}
                    onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
                  />
                  <TextField
                    label="Campus name (AR)"
                    value={form.name_ar}
                    onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))}
                  />
                  <TextField
                    label="Code"
                    value={form.code}
                    placeholder="auto from name"
                    hint="Uppercase letters, numbers, underscores"
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''),
                      }))
                    }
                  />
                  <SelectField
                    label="Status"
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </SelectField>
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
                </div>

                <TextField
                  label="Address"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                />

                <FormActions>
                  <Button type="button" variant="secondary" onClick={cancelForm} size="sm">
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" disabled={saving} size="sm">
                    {saving ? 'Saving…' : mode === 'create' ? 'Create campus' : 'Save changes'}
                  </Button>
                </FormActions>
              </form>
            </Panel>
          ) : activeDetail ? (
            <div className="cp-detail">
              <div className="cp-detail-head">
                <span className="cp-detail-mark" aria-hidden>
                  {activeDetail.name_en.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <h3>{activeDetail.name_en}</h3>
                  <p>
                    <code>{activeDetail.code}</code>
                    {activeDetail.name_ar ? ` · ${activeDetail.name_ar}` : ''}
                  </p>
                </div>
              </div>

              {detailLoading && !detail ? (
                <p className="cp-muted">Loading details…</p>
              ) : (
                <>
                  <dl className="cp-meta">
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <StatusPill status={activeDetail.status} />
                      </dd>
                    </div>
                    <div>
                      <dt>Organisation</dt>
                      <dd>{activeDetail.tenant?.name ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>School</dt>
                      <dd>{activeDetail.school?.name_en ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Timezone</dt>
                      <dd>{activeDetail.timezone ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Updated</dt>
                      <dd>
                        {activeDetail.updated_at
                          ? new Date(activeDetail.updated_at).toLocaleDateString()
                          : '—'}
                      </dd>
                    </div>
                    {detail?.plan_limit ? (
                      <div>
                        <dt>Plan usage</dt>
                        <dd>
                          {detail.plan_limit.current}
                          {detail.plan_limit.max_campuses != null
                            ? ` / ${detail.plan_limit.max_campuses}`
                            : ''}
                          {detail.plan_limit.plan_name
                            ? ` · ${detail.plan_limit.plan_name}`
                            : ''}
                        </dd>
                      </div>
                    ) : null}
                  </dl>

                  {activeDetail.address ? (
                    <p className="cp-desc">{activeDetail.address}</p>
                  ) : (
                    <p className="cp-muted">No address on file.</p>
                  )}

                  <div className="cp-actions">
                    <Button
                      type="button"
                      variant="primary" size="sm"
                      onClick={() => startEdit(detail ?? activeDetail)}
                    >
                      Edit
                    </Button>
                    {activeDetail.status === 'inactive' ? (
                      <ConfirmButton size="sm"
                        title="Activate campus?"
                        message={`Mark ${activeDetail.name_en} as active.`}
                        confirmLabel="Activate"
                        tone="primary"
                        variant="secondary"
                        onConfirm={() => setCampusStatus(activeDetail, 'active')}
                      >
                        Activate
                      </ConfirmButton>
                    ) : (
                      <ConfirmButton size="sm"
                        title="Deactivate campus?"
                        message={`${activeDetail.name_en} will be marked inactive.`}
                        confirmLabel="Deactivate"
                        tone="warn"
                        variant="secondary"
                        onConfirm={() => setCampusStatus(activeDetail, 'inactive')}
                      >
                        Deactivate
                      </ConfirmButton>
                    )}
                    <ConfirmButton size="sm"
                      title="Delete campus?"
                      message="This soft-deletes the campus. Related operational data may still reference it."
                      confirmLabel="Delete"
                      tone="danger"
                      variant="danger"
                      onConfirm={() => deleteCampus(activeDetail)}
                    >
                      Delete
                    </ConfirmButton>
                  </div>

                  {activeDetail.tenant?.slug ? (
                    <div className="cp-links">
                      <Link to="/tenants">Open tenants</Link>
                      <span>
                        Org slug <code>{activeDetail.tenant.slug}</code>
                      </span>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : (
            <div className="cp-detail cp-detail-empty">
              <p className="cp-empty">Select a campus or create a new one to get started.</p>
              <Button type="button" variant="apricot" onClick={startCreate} size="sm">
                + New campus
              </Button>
            </div>
          )}
        </aside>
      </div>

      <style>{campusesStyles}</style>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`cp-pill status-${status}`}>{statusLabel(status)}</span>;
}

const campusesStyles = `
.cp-page { display: grid; gap: 1rem; }
.cp-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(220px, 0.7fr);
  gap: 1.25rem;
  align-items: end;
  padding: 1.25rem 1.35rem;
  border-radius: 18px;
  border: 1px solid var(--stem-line);
  background:
    radial-gradient(120% 90% at 100% 0%, rgba(18, 160, 171, 0.12), transparent 55%),
    linear-gradient(145deg, #f3faf8, #eef5f2);
}
.cp-eyebrow {
  margin: 0 0 0.3rem;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--stem-teal-deep);
}
.cp-hero-title {
  margin: 0 0 0.35rem;
  font-family: var(--stem-font-display);
  font-size: clamp(1.35rem, 1.8vw, 1.55rem);
  letter-spacing: -0.03em;
}
.cp-hero-lead {
  margin: 0;
  color: var(--stem-ink-soft);
  line-height: 1.5;
  max-width: 42rem;
  font-size: var(--stem-text-base);
}
.cp-hero-actions { display: grid; gap: 0.75rem; justify-items: end; }
.cp-action-row { display: flex; flex-wrap: wrap; gap: 0.45rem; justify-content: flex-end; align-items: center; }
.cp-ghost-link {
  display: inline-flex; align-items: center; min-height: 40px; padding: 0 0.75rem;
  font-size: var(--stem-text-md); font-weight: 600; color: var(--stem-teal-deep); text-decoration: none;
}
.cp-ghost-link:hover { text-decoration: underline; }
.cp-alert {
  display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;
  padding: 0.85rem 1rem; border-radius: 12px; background: #fef3f2; color: var(--stem-danger);
  border: 1px solid #fecdca; font-size: var(--stem-text-base);
}
.cp-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(300px, 0.9fr);
  gap: 1rem;
  align-items: start;
}
.cp-table-wrap { overflow-x: auto; }
.cp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--stem-text-base);
  min-width: 480px;
}
.cp-table th {
  text-align: left;
  padding: 0.65rem 0.55rem;
  border-bottom: 1px solid var(--stem-line);
  color: var(--stem-ink-soft);
  font-size: var(--stem-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 700;
}
.cp-table td {
  padding: 0.85rem 0.55rem;
  border-bottom: 1px solid var(--stem-line);
  vertical-align: middle;
}
.cp-table tbody tr {
  cursor: pointer;
  transition: background 0.12s ease;
}
.cp-table tbody tr:hover { background: var(--stem-mint-soft); }
.cp-table tbody tr.is-selected {
  background: linear-gradient(90deg, var(--portal-accent-soft), #fff 70%);
}
.cp-slug { margin-top: 0.25rem; }
.cp-slug code,
.cp-detail code {
  font-size: var(--stem-text-sm);
  background: var(--stem-mint-soft);
  padding: 0.15rem 0.4rem;
  border-radius: 6px;
  border: 1px solid var(--stem-line);
}
.cp-side { min-width: 0; }
.cp-detail {
  border: 1px solid var(--stem-line);
  border-radius: 16px;
  padding: 1.15rem;
  background: linear-gradient(180deg, #fff, var(--stem-mint-soft));
  min-height: 320px;
  position: sticky;
  top: 5.5rem;
}
.cp-detail-empty {
  display: grid;
  gap: 0.85rem;
  place-content: center;
  text-align: center;
}
.cp-detail-head {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 1rem;
}
.cp-detail-mark {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: linear-gradient(145deg, var(--stem-teal-bright), var(--stem-teal-deep));
  color: #fff;
  font-weight: 700;
  flex-shrink: 0;
}
.cp-detail h3 { margin: 0; font-size: 1.15rem; }
.cp-detail p { margin: 0.25rem 0 0; color: var(--stem-ink-soft); font-size: var(--stem-text-md); }
.cp-meta {
  display: grid;
  gap: 0.65rem;
  margin: 0 0 1rem;
}
.cp-meta > div {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: var(--stem-text-base);
}
.cp-meta dt { color: var(--stem-ink-soft); margin: 0; }
.cp-meta dd { margin: 0; font-weight: 600; text-align: right; }
.cp-detail .cp-desc {
  margin: 0 0 1rem;
  font-size: var(--stem-text-base);
  color: var(--stem-ink-soft);
  line-height: 1.45;
}
.cp-detail .cp-muted {
  margin: 0 0 1rem;
}
.cp-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  margin: 0.15rem 0 0.85rem;
}
.cp-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem;
  align-items: center;
  font-size: var(--stem-text-md);
  font-weight: 600;
  color: var(--stem-teal-deep);
  padding-top: 0.75rem;
  border-top: 1px solid var(--stem-line);
}
.cp-links a { color: inherit; text-decoration: none; }
.cp-links a:hover { text-decoration: underline; }
.cp-form { display: grid; gap: 0.85rem; }
.cp-form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.75rem;
}
.cp-empty, .cp-muted { margin: 0; color: var(--stem-ink-soft); }
.cp-pill {
  display: inline-flex;
  padding: 0.18rem 0.55rem;
  border-radius: 999px;
  font-size: var(--stem-text-xs);
  font-weight: 700;
  border: 1px solid transparent;
}
.cp-pill.status-active { background: #ecfdf3; color: #067647; border-color: #abefc6; }
.cp-pill.status-inactive { background: #f5f5f5; color: #525252; border-color: #e5e5e5; }
@media (max-width: 960px) {
  .cp-hero, .cp-layout { grid-template-columns: 1fr; }
  .cp-hero-actions { justify-items: start; }
  .cp-action-row { justify-content: flex-start; }
  .cp-detail { position: static; }
}
`;
