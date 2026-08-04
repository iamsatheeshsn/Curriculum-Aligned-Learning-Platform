import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
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
import {
  institutionPortalLoginUrl,
  learnerPortalLoginUrl,
  publicSchoolSiteUrl,
} from '../../portalOrigins';
import type { PlanSummary, SuperAdminDashboardData, TenantRow } from '../../types';
import { statusLabel } from '../../types';

const emptyProvision = {
  organization_name: '',
  slug: '',
  country_code: 'SA',
  plan_code: 'starter',
  email: '',
  password: '',
  first_name: '',
  last_name: '',
  phone: '',
  school_name: '',
};

type TabId = 'directory' | 'provision' | 'plans';

type ListMeta = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};


/**
 * Dedicated Super Admin tenants workspace — directory, provision, plan changes.
 */
export function TenantsPage() {
  const { isSuperAdmin, hasPermission } = useAuth();
  if (!isSuperAdmin && !hasPermission('platform.tenants.manage')) {
    return <Navigate to="/" replace />;
  }

  return (
    <ControlLayout
      title="Tenants"
      subtitle="Provision schools, manage lifecycle, and assign subscription plans"
    >
      <TenantsWorkspace />
    </ControlLayout>
  );
}

function TenantsWorkspace() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [tab, setTab] = useState<TabId>('directory');
  const [data, setData] = useState<SuperAdminDashboardData | null>(null);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [provision, setProvision] = useState(emptyProvision);
  const [provisioning, setProvisioning] = useState(false);
  const [planTenantId, setPlanTenantId] = useState<number | ''>('');
  const [planCode, setPlanCode] = useState('growth');
  const [changingPlan, setChangingPlan] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      params.set('per_page', '10');
      params.set('page', String(page));

      const [dash, list] = await Promise.all([
        api.get<{ data: SuperAdminDashboardData }>('/control/dashboard'),
        api.get<{ data: TenantRow[]; meta: ListMeta }>(`/control/tenants?${params.toString()}`),
      ]);
      setData(dash.data);
      setTenants(list.data);
      setMeta(list.meta ?? null);
      setPlanTenantId((current) => current || list.data[0]?.id || '');
      setSelectedId((current) => {
        if (current && list.data.some((t) => t.id === current)) return current;
        return list.data[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tenants');
    } finally {
      setLoading(false);
    }
  }, [api, search, statusFilter, page]);

  useEffect(() => {
    void load();
  }, [api, statusFilter, page]);

  const selected = useMemo(
    () => tenants.find((t) => t.id === selectedId) ?? null,
    [tenants, selectedId],
  );

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    if (page !== 1) setPage(1);
    else await load();
  }

  async function setTenantStatus(tenant: TenantRow, status: string) {
    try {
      await api.request(`/control/tenants/${tenant.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await feedback.success({
        title: 'Status updated',
        message: `${tenant.name} is now ${statusLabel(status)}.`,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update status');
    }
  }

  async function deleteTenant(tenant: TenantRow) {
    try {
      await api.request(`/control/tenants/${tenant.id}`, { method: 'DELETE' });
      await feedback.success({
        title: 'Tenant deleted',
        message: `${tenant.name} was soft-deleted and closed.`,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete tenant');
    }
  }

  async function onProvision(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateFormFields(e.currentTarget)) return;
    setProvisioning(true);
    setError(null);
    try {
      const body = {
        ...provision,
        slug: provision.slug || undefined,
        school_name: provision.school_name || provision.organization_name,
      };
      const res = await api.post<{ message: string; data: TenantRow }>('/control/tenants', body);
      setProvision(emptyProvision);
      setTab('directory');
      setPage(1);
      await feedback.success({
        title: 'Tenant provisioned',
        message: `${res.data.name} (${res.data.slug}) is ready on a trial subscription.`,
      });
      await load();
      setSelectedId(res.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not provision tenant.');
    } finally {
      setProvisioning(false);
    }
  }

  async function onChangePlan() {
    if (!planTenantId) return;
    setChangingPlan(true);
    setError(null);
    try {
      const res = await api.post<{
        message: string;
        data: { subscription: { plan: { code: string; name_en: string } } };
      }>('/control/subscription/change-plan', {
        plan_code: planCode,
        tenant_id: planTenantId,
      });
      await feedback.success({
        title: 'Plan updated',
        message: `Switched to ${res.data.subscription.plan.name_en} (${res.data.subscription.plan.code}).`,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change plan.');
    } finally {
      setChangingPlan(false);
    }
  }

  if (loading && !data) {
    return <p className="tn-muted">Loading tenants…</p>;
  }

  if (error && !data) {
    return (
      <Panel title="Unable to load tenants">
        <p style={{ color: 'var(--stem-danger)', marginTop: 0 }}>{error}</p>
        <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
          Retry
        </Button>
      </Panel>
    );
  }

  const stats = data?.stats;

  return (
    <div className="tn-page">
      <section className="tn-hero stem-animate-rise">
        <div>
          <p className="tn-eyebrow">Control · Tenant management</p>
          <h2 className="tn-hero-title">Schools & organisations</h2>
          <p className="tn-hero-lead">
            Provision new school organisations, manage lifecycle status, and assign subscription
            plans from one control workspace.
          </p>
        </div>
        <div className="tn-hero-actions">
          <div className="tn-action-row">
            <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button size="sm" type="button" variant="apricot" onClick={() => setTab('provision')}>
              + Provision tenant
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="tn-alert" role="alert">
          <span>{error}</span>
          <Button size="sm" type="button" variant="secondary" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <StatStrip
        items={[
          { label: 'Tenants', value: String(stats?.total_tenants ?? '—'), hint: meta ? `${meta.total} listed` : undefined },
          { label: 'Active', value: String(stats?.active ?? '—') },
          { label: 'Trial', value: String(stats?.trial ?? '—') },
          { label: 'Suspended', value: String(stats?.suspended ?? '—') },
        ]}
      />

      <div className="tn-tabs" role="tablist" aria-label="Tenant tools">
        {(
          [
            { id: 'directory', label: 'Directory', hint: 'Browse & lifecycle' },
            { id: 'provision', label: 'Provision', hint: 'Create organisation' },
            { id: 'plans', label: 'Plans', hint: 'Assign & catalogue' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? 'is-active' : undefined}
            onClick={() => setTab(item.id)}
          >
            <strong>{item.label}</strong>
            <span>{item.hint}</span>
          </button>
        ))}
      </div>

      {tab === 'directory' ? (
        <Panel
          title="Tenant directory"
          description="Search, filter, and manage lifecycle for every school organisation."
          action={
            <Toolbar as="form" onSubmit={onSearch}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or slug"
                aria-label="Search tenants"
              />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setPage(1);
                  setStatusFilter(e.target.value);
                }}
                aria-label="Filter by status"
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="suspended">Suspended</option>
                <option value="closed">Closed</option>
              </select>
              <Button type="submit" variant="secondary" size="sm">
                Apply
              </Button>
            </Toolbar>
          }
        >
          <div className="tn-split">
            <div>
              <div className="tn-table-wrap">
                <table className="tn-table">
                  <thead>
                    <tr>
                      <th>Organisation</th>
                      <th>Status</th>
                      <th>Plan</th>
                      <th>Schools</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="tn-empty">
                          No tenants match this filter.
                        </td>
                      </tr>
                    ) : (
                      tenants.map((row) => (
                        <tr
                          key={row.id}
                          className={selectedId === row.id ? 'is-selected' : undefined}
                          onClick={() => setSelectedId(row.id)}
                        >
                          <td>
                            <strong>{row.name}</strong>
                            <div className="tn-slug">
                              <code>{row.slug}</code>
                            </div>
                          </td>
                          <td>
                            <StatusPill status={row.status} />
                          </td>
                          <td>{row.subscription?.plan?.name_en ?? '—'}</td>
                          <td>{row.schools_count ?? 0}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {meta && meta.last_page > 1 ? (
                <div className="tn-pager">
                  <span>
                    Page {meta.current_page} of {meta.last_page} · {meta.total} total
                  </span>
                  <div className="tn-action-row">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={page <= 1 || loading}
                      onClick={() => setPage((p) => Math.max(1, p - 1))} size="sm"
                    >
                      Previous
                    </Button>
                    <Button size="sm"
                      type="button"
                      variant="secondary"
                      disabled={page >= meta.last_page || loading}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            <aside className="tn-detail" aria-live="polite">
              {selected ? (
                <>
                  <div className="tn-detail-head">
                    <span className="tn-detail-mark" aria-hidden>
                      {selected.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <h3>{selected.name}</h3>
                      <p>
                        <code>{selected.slug}</code>
                      </p>
                    </div>
                  </div>

                  <dl className="tn-meta">
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <StatusPill status={selected.status} />
                      </dd>
                    </div>
                    <div>
                      <dt>Plan</dt>
                      <dd>{selected.subscription?.plan?.name_en ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Schools</dt>
                      <dd>{selected.schools_count ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Locale</dt>
                      <dd>{selected.default_locale ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Timezone</dt>
                      <dd>{selected.default_timezone ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Trial ends</dt>
                      <dd>
                        {selected.trial_ends_at
                          ? new Date(selected.trial_ends_at).toLocaleDateString()
                          : '—'}
                      </dd>
                    </div>
                  </dl>

                  <div className="tn-actions">
                    {selected.status === 'trial' || selected.status === 'suspended' ? (
                      <ConfirmButton size="sm"
                        title="Activate tenant?"
                        message={`Set ${selected.name} to active so Institution and Learner portals can operate.`}
                        confirmLabel="Activate"
                        tone="primary"
                        variant="primary"
                        onConfirm={() => setTenantStatus(selected, 'active')}
                      >
                        Approve / Activate
                      </ConfirmButton>
                    ) : null}
                    {selected.status !== 'suspended' && selected.status !== 'closed' ? (
                      <ConfirmButton size="sm"
                        title="Suspend tenant?"
                        message={`${selected.name} will lose Institution and Learner access until reactivated.`}
                        confirmLabel="Suspend"
                        tone="warn"
                        variant="secondary"
                        onConfirm={() => setTenantStatus(selected, 'suspended')}
                      >
                        Suspend
                      </ConfirmButton>
                    ) : null}
                    <Button
                      type="button"
                      variant="secondary" size="sm"
                      onClick={() => {
                        setPlanTenantId(selected.id);
                        setPlanCode(selected.subscription?.plan?.code ?? 'starter');
                        setTab('plans');
                      }}
                    >
                      Change plan
                    </Button>
                    <ConfirmButton size="sm"
                      title="Delete tenant?"
                      message="This soft-deletes the tenant and marks it closed. This cannot be easily undone."
                      confirmLabel="Delete"
                      tone="danger"
                      variant="danger"
                      onConfirm={() => deleteTenant(selected)}
                    >
                      Delete
                    </ConfirmButton>
                  </div>

                  <div className="tn-links">
                    <a href={publicSchoolSiteUrl(selected.slug)} target="_blank" rel="noreferrer">
                      Public site
                    </a>
                    <a href={institutionPortalLoginUrl(selected.slug)} target="_blank" rel="noreferrer">
                      Institution
                    </a>
                    <a href={learnerPortalLoginUrl(selected.slug)} target="_blank" rel="noreferrer">
                      Learner
                    </a>
                  </div>
                </>
              ) : (
                <p className="tn-empty">Select a tenant to review details and actions.</p>
              )}
            </aside>
          </div>
        </Panel>
      ) : null}

      {tab === 'provision' ? (
        <Panel
          title="Provision tenant"
          description="Creates organisation, owner account, main school, branding defaults, and a trial subscription."
        >
          <form onSubmit={onProvision} className="tn-provision" noValidate>
            <div className="tn-form-grid">
              <TextField
                label="Organisation name"
                required
                value={provision.organization_name}
                onChange={(e) => setProvision((p) => ({ ...p, organization_name: e.target.value }))}
              />
              <TextField
                label="Slug"
                value={provision.slug}
                placeholder="auto from name"
                hint="Lowercase letters, numbers, hyphens"
                onChange={(e) =>
                  setProvision((p) => ({
                    ...p,
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                  }))
                }
              />
              <SelectField
                label="Country"
                required
                value={provision.country_code}
                onChange={(e) => setProvision((p) => ({ ...p, country_code: e.target.value }))}
              >
                <option value="SA">Saudi Arabia (SA)</option>
                <option value="AE">United Arab Emirates (AE)</option>
              </SelectField>
              <SelectField
                label="Plan"
                value={provision.plan_code}
                onChange={(e) => setProvision((p) => ({ ...p, plan_code: e.target.value }))}
              >
                {(data?.plans ?? [{ code: 'starter', name_en: 'Starter' }]).map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name_en}
                  </option>
                ))}
              </SelectField>
              <TextField
                label="Owner first name"
                required
                value={provision.first_name}
                onChange={(e) => setProvision((p) => ({ ...p, first_name: e.target.value }))}
              />
              <TextField
                label="Owner last name"
                required
                value={provision.last_name}
                onChange={(e) => setProvision((p) => ({ ...p, last_name: e.target.value }))}
              />
              <TextField
                label="Owner email"
                type="email"
                required
                value={provision.email}
                onChange={(e) => setProvision((p) => ({ ...p, email: e.target.value }))}
              />
              <TextField
                label="Owner password"
                type="password"
                required
                minLength={8}
                hint="At least 8 characters"
                value={provision.password}
                onChange={(e) => setProvision((p) => ({ ...p, password: e.target.value }))}
              />
              <TextField
                label="Phone"
                value={provision.phone}
                onChange={(e) => setProvision((p) => ({ ...p, phone: e.target.value }))}
              />
              <TextField
                label="Main school name"
                value={provision.school_name}
                placeholder="Defaults to organisation"
                onChange={(e) => setProvision((p) => ({ ...p, school_name: e.target.value }))}
              />
            </div>
            <FormActions>
              <Button size="sm" type="submit" variant="apricot" disabled={provisioning}>
                {provisioning ? 'Provisioning…' : 'Provision tenant'}
              </Button>
              <Button size="sm" type="button" variant="secondary" onClick={() => setTab('directory')}>
                Cancel
              </Button>
            </FormActions>
          </form>
        </Panel>
      ) : null}

      {tab === 'plans' ? (
        <div className="tn-plans-grid">
          <Panel title="Assign plan" description="Change the active subscription for any tenant.">
            <form
              className="tn-plan-form"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                if (!validateFormFields(e.currentTarget)) return;
                void onChangePlan();
              }}
            >
              <SelectField
                label="Tenant"
                required
                value={planTenantId === '' ? '' : String(planTenantId)}
                onChange={(e) => setPlanTenantId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">Select tenant</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.slug})
                  </option>
                ))}
              </SelectField>
              <SelectField label="Plan" required value={planCode} onChange={(e) => setPlanCode(e.target.value)}>
                {(data?.plans ?? []).map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name_en}
                  </option>
                ))}
              </SelectField>
              <FormActions>
                <Button size="sm" type="submit" variant="primary" disabled={changingPlan}>
                  {changingPlan ? 'Updating…' : 'Apply plan'}
                </Button>
              </FormActions>
            </form>
          </Panel>

          <Panel title="Catalogue" description="Active plans available for provisioning and upgrades.">
            <div className="tn-plan-cards">
              {(data?.plans ?? []).map((plan) => (
                <PlanCard
                  key={plan.code}
                  plan={plan}
                  onSelect={() => {
                    setPlanCode(plan.code);
                  }}
                  selected={planCode === plan.code}
                />
              ))}
            </div>
          </Panel>

          <Panel title="Subscription health" description="Active subscriptions by plan code.">
            {(data?.plan_health?.length ?? 0) === 0 ? (
              <p className="tn-muted">No active subscriptions yet.</p>
            ) : (
              <ul className="tn-list">
                {data!.plan_health.map((row) => (
                  <li key={row.plan_code}>
                    <strong>{row.plan_name}</strong>
                    <span>{row.active_subscriptions} active</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Trials ending soon" description="Within the next 7 days.">
            {(data?.trials_ending_soon?.length ?? 0) === 0 ? (
              <p className="tn-muted">No trials ending soon.</p>
            ) : (
              <ul className="tn-list">
                {data!.trials_ending_soon.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      className="tn-list-btn"
                      onClick={() => {
                        setSelectedId(t.id);
                        setTab('directory');
                      }}
                    >
                      <strong>{t.name}</strong>
                      <span>{new Date(t.trial_ends_at).toLocaleDateString()}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      ) : null}

      <style>{tenantsStyles}</style>
    </div>
  );
}

function PlanCard({
  plan,
  onSelect,
  selected,
}: {
  plan: PlanSummary;
  onSelect?: () => void;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      className={`tn-plan-card ${selected ? 'is-selected' : ''}`}
      onClick={onSelect}
    >
      <strong>{plan.name_en}</strong>
      <p>
        {plan.currency ?? 'SAR'} {plan.price ?? '0'} · {plan.max_schools ?? '—'} schools ·{' '}
        {plan.max_students ?? '—'} students
      </p>
    </button>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`tn-pill status-${status}`}>{statusLabel(status)}</span>;
}

const tenantsStyles = `
.tn-page { display: grid; gap: 1rem; }
.tn-hero {
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
.tn-eyebrow {
  margin: 0 0 0.3rem;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--stem-teal-deep);
}
.tn-hero-title {
  margin: 0 0 0.35rem;
  font-family: var(--stem-font-display);
  font-size: clamp(1.35rem, 1.8vw, 1.55rem);
  letter-spacing: -0.03em;
}
.tn-hero-lead {
  margin: 0;
  color: var(--stem-ink-soft);
  line-height: 1.5;
  max-width: 42rem;
  font-size: var(--stem-text-base);
}
.tn-hero-actions { display: grid; gap: 0.75rem; justify-items: end; }
.tn-action-row { display: flex; flex-wrap: wrap; gap: 0.45rem; justify-content: flex-end; }
.tn-alert {
  display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;
  padding: 0.85rem 1rem; border-radius: 12px; background: #fef3f2; color: var(--stem-danger);
  border: 1px solid #fecdca; font-size: var(--stem-text-base);
}
.tn-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.55rem;
}
.tn-tabs button {
  display: grid; gap: 0.15rem; text-align: left;
  border: 1px solid var(--stem-line);
  background: #fff;
  padding: 0.85rem 1rem;
  border-radius: 14px;
  font: inherit;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}
.tn-tabs button strong { font-size: var(--stem-text-base); color: var(--stem-ink); }
.tn-tabs button span { font-size: var(--stem-text-sm); color: var(--stem-ink-soft); }
.tn-tabs button.is-active {
  background: linear-gradient(145deg, var(--portal-accent-soft), #fff 70%);
  border-color: rgba(12, 124, 128, 0.35);
  box-shadow: 0 10px 22px rgba(5, 84, 86, 0.08);
}
.tn-tabs button.is-active strong { color: var(--stem-teal-deep); }
.tn-split {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(260px, 0.85fr);
  gap: 1rem;
  align-items: start;
}
.tn-table-wrap { overflow-x: auto; }
.tn-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--stem-text-base);
  min-width: 480px;
}
.tn-table th {
  text-align: left;
  padding: 0.65rem 0.55rem;
  border-bottom: 1px solid var(--stem-line);
  color: var(--stem-ink-soft);
  font-size: var(--stem-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 700;
}
.tn-table td {
  padding: 0.85rem 0.55rem;
  border-bottom: 1px solid var(--stem-line);
  vertical-align: middle;
}
.tn-table tbody tr {
  cursor: pointer;
  transition: background 0.12s ease;
}
.tn-table tbody tr:hover { background: var(--stem-mint-soft); }
.tn-table tbody tr.is-selected {
  background: linear-gradient(90deg, var(--portal-accent-soft), #fff 70%);
}
.tn-slug { margin-top: 0.25rem; }
.tn-slug code,
.tn-detail code {
  font-size: var(--stem-text-sm);
  background: var(--stem-mint-soft);
  padding: 0.15rem 0.4rem;
  border-radius: 6px;
  border: 1px solid var(--stem-line);
}
.tn-detail {
  border: 1px solid var(--stem-line);
  border-radius: 16px;
  padding: 1.15rem;
  background: linear-gradient(180deg, #fff, var(--stem-mint-soft));
  min-height: 280px;
  position: sticky;
  top: 5.5rem;
}
.tn-detail-head {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 1rem;
}
.tn-detail-mark {
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
.tn-detail h3 { margin: 0; font-size: 1.15rem; }
.tn-detail p { margin: 0.25rem 0 0; color: var(--stem-ink-soft); font-size: var(--stem-text-md); }
.tn-meta {
  display: grid;
  gap: 0.65rem;
  margin: 0 0 1rem;
}
.tn-meta > div {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: var(--stem-text-base);
}
.tn-meta dt { color: var(--stem-ink-soft); margin: 0; }
.tn-meta dd { margin: 0; font-weight: 600; text-align: right; }
.tn-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.85rem;
}
.tn-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem;
  font-size: var(--stem-text-md);
  font-weight: 600;
  color: var(--stem-teal-deep);
  padding-top: 0.75rem;
  border-top: 1px solid var(--stem-line);
}
.tn-links a { color: inherit; text-decoration: none; }
.tn-links a:hover { text-decoration: underline; }
.tn-empty, .tn-muted { margin: 0; color: var(--stem-ink-soft); }
.tn-pager {
  display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;
  margin-top: 0.85rem; padding-top: 0.85rem; border-top: 1px solid var(--stem-line);
  font-size: var(--stem-text-md); color: var(--stem-ink-soft);
}
.tn-form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.85rem;
  align-items: start;
}
.tn-plans-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}
.tn-plan-form { display: grid; gap: 0.85rem; }
.tn-plan-cards { display: grid; gap: 0.65rem; }
.tn-plan-card {
  display: grid; gap: 0.2rem; text-align: left; width: 100%;
  padding: 0.9rem 1rem;
  border-radius: 12px;
  border: 1px solid var(--stem-line);
  background: #fff;
  font: inherit;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
}
.tn-plan-card:hover, .tn-plan-card.is-selected {
  border-color: rgba(12, 124, 128, 0.4);
  background: var(--stem-mint-soft);
}
.tn-plan-card p {
  margin: 0;
  font-size: var(--stem-text-md);
  color: var(--stem-ink-soft);
  overflow-wrap: anywhere;
}
.tn-plan-card strong,
.tn-plan-card span {
  overflow-wrap: anywhere;
  word-break: break-word;
}
.tn-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.55rem;
}
.tn-list li,
.tn-list-btn {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.65rem 0.75rem;
  border-radius: 10px;
  background: var(--stem-mint-soft);
  border: 1px solid var(--stem-line);
  font-size: var(--stem-text-base);
  width: 100%;
  font: inherit;
  color: inherit;
  cursor: pointer;
}
.tn-list span { color: var(--stem-ink-soft); }
.tn-list-btn:hover { border-color: rgba(12, 124, 128, 0.35); }
.tn-pill {
  display: inline-flex;
  padding: 0.18rem 0.55rem;
  border-radius: 999px;
  font-size: var(--stem-text-xs);
  font-weight: 700;
  border: 1px solid transparent;
}
.tn-pill.status-active { background: #ecfdf3; color: #067647; border-color: #abefc6; }
.tn-pill.status-trial { background: #eff8ff; color: #175cd3; border-color: #b2ddff; }
.tn-pill.status-suspended { background: #fef3f2; color: #b42318; border-color: #fecdca; }
.tn-pill.status-closed { background: #f5f5f5; color: #525252; border-color: #e5e5e5; }
@media (max-width: 960px) {
  .tn-hero, .tn-split, .tn-tabs { grid-template-columns: 1fr; }
  .tn-hero-actions { justify-items: start; }
  .tn-action-row { justify-content: flex-start; }
  .tn-detail { position: static; }
}
`;
