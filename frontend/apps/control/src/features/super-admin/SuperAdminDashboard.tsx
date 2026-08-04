import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { useAuth } from '@stemora/auth';
import { Button, ConfirmButton, FormActions, Panel, SelectField, StatStrip, TextField, Toolbar, useFeedback, validateFormFields } from '@stemora/ui';
import type { PlanSummary, SuperAdminDashboardData, TenantRow } from '../../types';
import { statusLabel } from '../../types';

const RECENT_LIMIT = 5;

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

export function SuperAdminDashboard() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [data, setData] = useState<SuperAdminDashboardData | null>(null);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [provision, setProvision] = useState(emptyProvision);
  const [provisioning, setProvisioning] = useState(false);
  const [planTenantId, setPlanTenantId] = useState<number | ''>('');
  const [planCode, setPlanCode] = useState('growth');
  const [changingPlan, setChangingPlan] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      params.set('per_page', '10');

      const [dash, list] = await Promise.all([
        api.get<{ data: SuperAdminDashboardData }>('/control/dashboard'),
        api.get<{ data: TenantRow[] }>(`/control/tenants?${params.toString()}`),
      ]);
      setData(dash.data);
      setTenants(list.data);
      setPlanTenantId((current) => current || list.data[0]?.id || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [api, search, statusFilter]);

  useEffect(() => {
    void load();
  }, [api, statusFilter]);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    await load();
  }

  async function setTenantStatus(tenant: TenantRow, status: string) {
    await api.request(`/control/tenants/${tenant.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    await feedback.success({
      title: 'Status updated',
      message: `${tenant.name} is now ${statusLabel(status)}.`,
    });
    await load();
  }

  async function deleteTenant(tenant: TenantRow) {
    await api.request(`/control/tenants/${tenant.id}`, { method: 'DELETE' });
    await feedback.success({
      title: 'Tenant deleted',
      message: `${tenant.name} was soft-deleted and closed.`,
    });
    await load();
  }

  async function onProvision(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateFormFields(e.currentTarget)) return;
    setProvisioning(true);
    try {
      const body = {
        ...provision,
        slug: provision.slug || undefined,
        school_name: provision.school_name || provision.organization_name,
      };
      const res = await api.post<{ message: string; data: TenantRow }>('/control/tenants', body);
      setProvision(emptyProvision);
      await feedback.success({
        title: 'Tenant provisioned',
        message: `${res.data.name} (${res.data.slug}) is ready on a trial subscription.`,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not provision tenant.');
    } finally {
      setProvisioning(false);
    }
  }

  async function onChangePlan() {
    if (!planTenantId) return;
    setChangingPlan(true);
    try {
      const res = await api.post<{ message: string; data: { subscription: { plan: { code: string; name_en: string } } } }>(
        '/control/subscription/change-plan',
        { plan_code: planCode, tenant_id: planTenantId },
      );
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
    return <p style={{ color: 'var(--stem-ink-soft)' }}>Loading Super Admin dashboard…</p>;
  }

  if (error && !data) {
    return (
      <Panel title="Unable to load">
        <p style={{ color: 'var(--stem-danger)' }}>{error}</p>
        <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
          Retry
        </Button>
      </Panel>
    );
  }

  const stats = data?.stats;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {error ? (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 12,
            background: '#fef3f2',
            color: 'var(--stem-danger)',
            border: '1px solid #fecdca',
          }}
        >
          {error}
        </div>
      ) : null}

      <StatStrip
        items={[
          { label: 'Tenants', value: String(stats?.total_tenants ?? '—') },
          { label: 'Active', value: String(stats?.active ?? '—') },
          { label: 'Trial', value: String(stats?.trial ?? '—') },
          { label: 'Suspended', value: String(stats?.suspended ?? '—') },
        ]}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
        }}
      >
        <Panel
          title="Subscription health"
          action={
            <Button size="sm" to="/tenants/subscriptions" variant="secondary">
              View more
            </Button>
          }
        >
          {(data?.plan_health?.length ?? 0) === 0 ? (
            <p style={{ margin: 0, color: 'var(--stem-ink-soft)' }}>No active subscriptions yet.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '1.1rem', color: 'var(--stem-ink-soft)', lineHeight: 1.85 }}>
              {data!.plan_health.slice(0, RECENT_LIMIT).map((row) => (
                <li key={row.plan_code}>
                  <strong style={{ color: 'var(--stem-ink)' }}>{row.plan_name}</strong> · {row.active_subscriptions}{' '}
                  active
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Catalogue plans"
          action={
            <Button size="sm" to="/subscription" variant="secondary">
              View more
            </Button>
          }
        >
          <div style={{ display: 'grid', gap: '0.65rem' }}>
            {(data?.plans ?? []).slice(0, RECENT_LIMIT).map((plan) => (
              <PlanCard key={plan.code} plan={plan} />
            ))}
          </div>
        </Panel>

        <Panel
          title="Trials ending soon"
          action={
            <Button size="sm" to="/tenants/trials" variant="secondary">
              View more
            </Button>
          }
        >
          {(data?.trials_ending_soon?.length ?? 0) === 0 ? (
            <p style={{ margin: 0, color: 'var(--stem-ink-soft)' }}>No trials ending in the next 7 days.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '1.1rem', color: 'var(--stem-ink-soft)', lineHeight: 1.85 }}>
              {data!.trials_ending_soon.slice(0, RECENT_LIMIT).map((t) => (
                <li key={t.id}>
                  {t.name} · <code style={codeStyle}>{t.slug}</code> ·{' '}
                  {new Date(t.trial_ends_at).toLocaleDateString()}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Manage plan for tenant">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!validateFormFields(e.currentTarget)) return;
            void onChangePlan();
          }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '0.85rem',
            alignItems: 'start',
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
          <FormActions fieldRow>
            <Button size="sm" type="submit" variant="primary" disabled={changingPlan}>
              {changingPlan ? 'Updating…' : 'Apply plan'}
            </Button>
          </FormActions>
        </form>
      </Panel>

      <Panel title="Provision tenant">
        <form onSubmit={onProvision} style={{ display: 'grid', gap: '0.85rem' }} noValidate>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '0.85rem',
              alignItems: 'start',
            }}
          >
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
              minLength={6}
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
          </FormActions>
        </form>
      </Panel>

      <Panel
        title="Tenant directory"
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
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="suspended">Suspended</option>
              <option value="closed">Closed</option>
            </select>
            <Button size="sm" type="submit" variant="secondary">
              Filter
            </Button>
            <Button size="sm" to="/tenants" variant="secondary">
              View more
            </Button>
          </Toolbar>
        }
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem', minWidth: 720 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--stem-ink-soft)' }}>
                <th style={th}>Tenant</th>
                <th style={th}>Slug</th>
                <th style={th}>Status</th>
                <th style={th}>Plan</th>
                <th style={th}>Schools</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ ...td, color: 'var(--stem-ink-soft)' }}>
                    No tenants match this filter.
                  </td>
                </tr>
              ) : (
                tenants.slice(0, RECENT_LIMIT).map((row) => (
                  <tr key={row.id}>
                    <td style={td}>
                      <strong>{row.name}</strong>
                    </td>
                    <td style={td}>
                      <code style={codeStyle}>{row.slug}</code>
                    </td>
                    <td style={td}>
                      <StatusPill status={row.status} />
                    </td>
                    <td style={td}>{row.subscription?.plan?.name_en ?? '—'}</td>
                    <td style={td}>{row.schools_count ?? 0}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {row.status === 'trial' || row.status === 'suspended' ? (
                          <ConfirmButton size="sm"
                            title="Activate tenant?"
                            message={`Set ${row.name} to active.`}
                            confirmLabel="Activate"
                            tone="primary"
                            variant="primary"
                            onConfirm={() => setTenantStatus(row, 'active')}
                          >
                            Approve
                          </ConfirmButton>
                        ) : null}
                        {row.status !== 'suspended' && row.status !== 'closed' ? (
                          <ConfirmButton size="sm"
                            title="Suspend tenant?"
                            message={`${row.name} will lose Institution and Learner access until reactivated.`}
                            confirmLabel="Suspend"
                            tone="warn"
                            variant="secondary"
                            onConfirm={() => setTenantStatus(row, 'suspended')}
                          >
                            Suspend
                          </ConfirmButton>
                        ) : null}
                        <ConfirmButton size="sm"
                          title="Delete tenant?"
                          message="This soft-deletes the tenant and marks it closed. This cannot be easily undone."
                          confirmLabel="Delete"
                          tone="danger"
                          variant="danger"
                          onConfirm={() => deleteTenant(row)}
                        >
                          Delete
                        </ConfirmButton>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function PlanCard({ plan }: { plan: PlanSummary }) {
  return (
    <div
      style={{
        padding: '0.75rem 0.85rem',
        borderRadius: 12,
        border: '1px solid var(--stem-line)',
        background: 'var(--stem-mint-soft)',
      }}
    >
      <strong>{plan.name_en}</strong>
      <div style={{ fontSize: '0.85rem', color: 'var(--stem-ink-soft)', marginTop: 4 }}>
        {plan.currency ?? 'SAR'} {plan.price ?? '0'} · {plan.max_schools ?? '—'} schools · {plan.max_students ?? '—'}{' '}
        students
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const colors =
    status === 'active'
      ? { bg: '#ecfdf3', fg: '#067647', border: '#abefc6' }
      : status === 'trial'
        ? { bg: '#eff8ff', fg: '#175cd3', border: '#b2ddff' }
        : status === 'suspended'
          ? { bg: '#fef3f2', fg: '#b42318', border: '#fecdca' }
          : { bg: '#f5f5f5', fg: '#525252', border: '#e5e5e5' };

  return (
    <span
      className="sa-pill"
      style={{ background: colors.bg, color: colors.fg, border: `1px solid ${colors.border}` }}
    >
      {statusLabel(status)}
    </span>
  );
}

const th: CSSProperties = {
  padding: '0.65rem 0.5rem',
  borderBottom: '1px solid var(--stem-line)',
  fontWeight: 600,
  fontSize: 'var(--stem-text-sm)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};
const td: CSSProperties = {
  padding: '0.85rem 0.5rem',
  borderBottom: '1px solid var(--stem-line)',
  verticalAlign: 'middle',
};
const codeStyle: CSSProperties = {
  fontSize: '0.82rem',
  background: 'var(--stem-mint-soft)',
  padding: '0.2rem 0.45rem',
  borderRadius: 6,
};
