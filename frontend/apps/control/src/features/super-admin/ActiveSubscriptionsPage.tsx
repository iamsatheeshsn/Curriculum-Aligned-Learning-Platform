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
  Toolbar,
  useFeedback,
} from '@stemora/ui';
import { ControlLayout } from '../../layout/ControlLayout';
import { statusLabel } from '../../types';

type PlanOption = {
  code: string;
  name_en: string;
  price?: string | number;
  currency?: string;
};

type SubscriptionRow = {
  id: number;
  status: string;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  tenant_id: number;
  plan_id: number;
  tenant: {
    id: number;
    name: string;
    slug: string;
    status: string;
    trial_ends_at?: string | null;
    default_timezone?: string | null;
  } | null;
  plan: {
    id: number;
    code: string;
    name_en: string;
    name_ar?: string;
    price?: string | number;
    currency?: string;
    limits?: {
      max_schools?: number;
      max_campuses?: number;
      max_students?: number;
      max_teachers?: number;
      max_storage_mb?: number;
    };
    modules?: Record<string, boolean> | null;
  } | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type SubStats = {
  total: number;
  active: number;
  cancelled: number;
  expired: number;
  mrr: number;
  arr: number;
  currency: string;
  by_plan: { plan_code: string; plan_name: string; count: number; mrr: number }[];
  tenants_without_active: number;
};


function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

/**
 * Cross-tenant directory of SaaS subscriptions for Super Admin control.
 */
export function ActiveSubscriptionsPage() {
  const { isSuperAdmin, hasPermission } = useAuth();
  if (
    !isSuperAdmin &&
    !hasPermission(['platform.tenants.manage', 'platform.plans.manage'])
  ) {
    return <Navigate to="/" replace />;
  }

  return (
    <ControlLayout
      title="Active Subscriptions"
      subtitle="Monitor plans across every organisation and change or cancel subscriptions"
    >
      <ActiveSubscriptionsWorkspace />
    </ControlLayout>
  );
}

function ActiveSubscriptionsWorkspace() {
  const { api, isSuperAdmin } = useAuth();
  const feedback = useFeedback();
  const [rows, setRows] = useState<SubscriptionRow[]>([]);
  const listPage = useClientPagination(rows);

  const [stats, setStats] = useState<SubStats | null>(null);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [planFilter, setPlanFilter] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('growth');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (planFilter) params.set('plan_code', planFilter);
      const qs = params.toString();
      const res = await api.get<{
        data: SubscriptionRow[];
        meta: { stats: SubStats; plans: PlanOption[] };
      }>(`/control/subscriptions${qs ? `?${qs}` : ''}`);
      setRows(res.data);
      setStats(res.meta.stats);
      setPlans(res.meta.plans);
      setSelectedId((current) => {
        if (current && res.data.some((r) => r.id === current)) return current;
        return res.data[0]?.id ?? null;
      });
      setSelectedPlan((current) => {
        if (current && res.meta.plans.some((p) => p.code === current)) return current;
        return res.meta.plans[0]?.code ?? current;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  }, [api, search, statusFilter, planFilter]);

  useEffect(() => {
    void load();
  }, [api, statusFilter, planFilter]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void (async () => {
      try {
        const res = await api.get<{ data: SubscriptionRow }>(
          `/control/subscriptions/${selectedId}`,
        );
        if (!cancelled) {
          setDetail(res.data);
          if (res.data.plan?.code) setSelectedPlan(res.data.plan.code);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load subscription');
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, selectedId, rows]);

  const selectedSummary = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );

  const activeDetail = detail ?? selectedSummary;

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    await load();
  }

  async function changePlan() {
    if (!activeDetail?.tenant?.id || !selectedPlan) return;
    setBusy('plan');
    setError(null);
    try {
      const res = await api.post<{
        data: { subscription: { id: number; plan: { name_en: string; code: string } } };
      }>('/control/subscription/change-plan', {
        plan_code: selectedPlan,
        tenant_id: activeDetail.tenant.id,
      });
      await feedback.success({
        title: 'Plan updated',
        message: `${activeDetail.tenant.name} is now on ${res.data.subscription.plan.name_en}.`,
      });
      setSelectedId(res.data.subscription.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change plan');
    } finally {
      setBusy(null);
    }
  }

  async function cancelSubscription(row: SubscriptionRow) {
    setBusy('cancel');
    setError(null);
    try {
      await api.post(`/control/subscriptions/${row.id}/cancel`);
      await feedback.success({
        title: 'Subscription cancelled',
        message: `${row.tenant?.name ?? 'Organisation'} no longer has an active subscription.`,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel subscription');
    } finally {
      setBusy(null);
    }
  }

  if (loading && rows.length === 0 && !stats) {
    return <p className="as-muted">Loading subscriptions…</p>;
  }

  if (error && !stats && rows.length === 0) {
    return (
      <Panel title="Unable to load subscriptions">
        <p style={{ color: 'var(--stem-danger)', marginTop: 0 }}>{error}</p>
        <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
          Retry
        </Button>
      </Panel>
    );
  }

  const currency = stats?.currency ?? 'SAR';

  return (
    <div className="as-page">
      <section className="as-hero stem-animate-rise">
        <div>
          <p className="as-eyebrow">Control · Tenant management</p>
          <h2 className="as-hero-title">Active subscriptions</h2>
          <p className="as-hero-lead">
            See every organisation’s plan at a glance, track recurring revenue, and change or cancel
            subscriptions from one directory.
          </p>
        </div>
        <div className="as-hero-actions">
          <div className="as-action-row">
            <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Link to="/subscription" className="as-ghost-link">
              Plans & billing
            </Link>
            <Link to="/dashboard/revenue" className="as-ghost-link">
              Revenue
            </Link>
          </div>
        </div>
      </section>

      {error ? (
        <div className="as-alert" role="alert">
          <span>{error}</span>
          <Button size="sm" type="button" variant="secondary" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <StatStrip
        items={[
          { label: 'Active', value: String(stats?.active ?? '—') },
          { label: 'MRR', value: stats ? money(stats.mrr, currency) : '—' },
          { label: 'ARR', value: stats ? money(stats.arr, currency) : '—' },
          {
            label: 'No active plan',
            value: String(stats?.tenants_without_active ?? '—'),
            hint: `${stats?.cancelled ?? 0} cancelled`,
          },
        ]}
      />

      {(stats?.by_plan?.length ?? 0) > 0 ? (
        <div className="as-plan-mix" aria-label="Plan mix">
          {stats!.by_plan.map((p) => (
            <button
              key={p.plan_code}
              type="button"
              className={`as-mix-chip ${planFilter === p.plan_code ? 'is-on' : ''}`}
              onClick={() => setPlanFilter((cur) => (cur === p.plan_code ? '' : p.plan_code))}
            >
              <strong>{p.plan_name}</strong>
              <span>
                {p.count} · {money(p.mrr, currency)}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="as-layout">
        <Panel
          title="Subscription directory"
          description="Filter by status or plan, then select a row for lifecycle actions."
          action={
            <Toolbar as="form" onSubmit={onSearch}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search organisation or plan"
                aria-label="Search subscriptions"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="cancelled">Cancelled</option>
                <option value="expired">Expired</option>
              </select>
              <select
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value)}
                aria-label="Filter by plan"
              >
                <option value="">All plans</option>
                {plans.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name_en}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="secondary" size="sm">
                Apply
              </Button>
            </Toolbar>
          }
        >
          <div className="as-table-wrap">
            <table className="as-table">
              <thead>
                <tr>
                  <th>Organisation</th>
                  <th>Plan</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Started</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="as-empty">
                      No subscriptions match this filter.
                    </td>
                  </tr>
                ) : (
                  listPage.pageItems.map((row) => (
                    <tr
                      key={row.id}
                      className={selectedId === row.id ? 'is-selected' : undefined}
                      onClick={() => setSelectedId(row.id)}
                    >
                      <td>
                        <strong>{row.tenant?.name ?? '—'}</strong>
                        <div className="as-slug">
                          <code>{row.tenant?.slug ?? '—'}</code>
                        </div>
                      </td>
                      <td>{row.plan?.name_en ?? '—'}</td>
                      <td>
                        {row.plan
                          ? `${row.plan.currency ?? 'SAR'} ${row.plan.price ?? 0}`
                          : '—'}
                      </td>
                      <td>
                        <StatusPill status={row.status} />
                      </td>
                      <td>
                        {row.starts_at ? new Date(row.starts_at).toLocaleDateString() : '—'}
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

        <aside className="as-side" aria-live="polite">
          {activeDetail ? (
            <div className="as-detail">
              <div className="as-detail-head">
                <span className="as-detail-mark" aria-hidden>
                  {(activeDetail.tenant?.name ?? '?').slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <h3>{activeDetail.tenant?.name ?? 'Subscription'}</h3>
                  <p>
                    <code>{activeDetail.tenant?.slug ?? '—'}</code>
                    {activeDetail.tenant?.status
                      ? ` · Org ${statusLabel(activeDetail.tenant.status)}`
                      : ''}
                  </p>
                </div>
              </div>

              {detailLoading && !detail ? (
                <p className="as-muted">Loading details…</p>
              ) : (
                <>
                  <dl className="as-meta">
                    <div>
                      <dt>Plan</dt>
                      <dd>{activeDetail.plan?.name_en ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <StatusPill status={activeDetail.status} />
                      </dd>
                    </div>
                    <div>
                      <dt>Price</dt>
                      <dd>
                        {activeDetail.plan
                          ? `${activeDetail.plan.currency ?? 'SAR'} ${activeDetail.plan.price ?? 0}`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Started</dt>
                      <dd>
                        {activeDetail.starts_at
                          ? new Date(activeDetail.starts_at).toLocaleDateString()
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Ended</dt>
                      <dd>
                        {activeDetail.ends_at
                          ? new Date(activeDetail.ends_at).toLocaleDateString()
                          : '—'}
                      </dd>
                    </div>
                  </dl>

                  {activeDetail.plan?.limits ? (
                    <ul className="as-limits">
                      <li>Schools · {activeDetail.plan.limits.max_schools ?? '—'}</li>
                      <li>Campuses · {activeDetail.plan.limits.max_campuses ?? '—'}</li>
                      <li>Students · {activeDetail.plan.limits.max_students ?? '—'}</li>
                      <li>Teachers · {activeDetail.plan.limits.max_teachers ?? '—'}</li>
                    </ul>
                  ) : null}

                  {activeDetail.plan?.modules ? (
                    <div className="as-modules">
                      {Object.entries(activeDetail.plan.modules).map(([key, on]) => (
                        <span key={key} className={on ? 'is-on' : undefined}>
                          {key.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {isSuperAdmin && activeDetail.status === 'active' ? (
                    <div className="as-change">
                      <SelectField
                        label="Change plan"
                        value={selectedPlan}
                        onChange={(e) => setSelectedPlan(e.target.value)}
                      >
                        {plans.map((p) => (
                          <option key={p.code} value={p.code}>
                            {p.name_en} · {p.currency ?? 'SAR'} {p.price ?? 0}
                          </option>
                        ))}
                      </SelectField>
                      <FormActions>
                        <ConfirmButton size="sm"
                          title="Apply plan change?"
                          message={`Switch ${activeDetail.tenant?.name ?? 'this organisation'} to the selected plan.`}
                          confirmLabel="Apply"
                          tone="primary"
                          variant="primary"
                          onConfirm={changePlan}
                        >
                          {busy === 'plan' ? 'Updating…' : 'Apply plan'}
                        </ConfirmButton>
                        <ConfirmButton size="sm"
                          title="Cancel subscription?"
                          message={`${activeDetail.tenant?.name ?? 'This organisation'} will lose active plan entitlements until a new plan is assigned.`}
                          confirmLabel="Cancel subscription"
                          tone="danger"
                          variant="danger"
                          onConfirm={() => cancelSubscription(activeDetail)}
                        >
                          {busy === 'cancel' ? 'Working…' : 'Cancel'}
                        </ConfirmButton>
                      </FormActions>
                    </div>
                  ) : activeDetail.status !== 'active' ? (
                    <div className="as-change">
                      <p className="as-muted">
                        This subscription is {statusLabel(activeDetail.status)}. Assign a new plan
                        to reactivate billing entitlements.
                      </p>
                      {isSuperAdmin && activeDetail.tenant?.id ? (
                        <>
                          <SelectField
                            label="Assign plan"
                            value={selectedPlan}
                            onChange={(e) => setSelectedPlan(e.target.value)}
                          >
                            {plans.map((p) => (
                              <option key={p.code} value={p.code}>
                                {p.name_en} · {p.currency ?? 'SAR'} {p.price ?? 0}
                              </option>
                            ))}
                          </SelectField>
                          <FormActions>
                            <ConfirmButton size="sm"
                              title="Activate plan?"
                              message={`Create a new active subscription on the selected plan for ${activeDetail.tenant.name}.`}
                              confirmLabel="Activate"
                              tone="primary"
                              variant="primary"
                              onConfirm={changePlan}
                            >
                              {busy === 'plan' ? 'Updating…' : 'Activate plan'}
                            </ConfirmButton>
                          </FormActions>
                        </>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="as-links">
                    <Link to="/subscription">Open billing workspace</Link>
                    <Link to="/tenants">Tenant directory</Link>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="as-detail as-detail-empty">
              <p className="as-empty">Select a subscription to review details and actions.</p>
            </div>
          )}
        </aside>
      </div>

      <style>{activeSubsStyles}</style>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`as-pill status-${status}`}>{statusLabel(status)}</span>;
}

const activeSubsStyles = `
.as-page { display: grid; gap: 1rem; }
.as-hero {
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
.as-eyebrow {
  margin: 0 0 0.3rem;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--stem-teal-deep);
}
.as-hero-title {
  margin: 0 0 0.35rem;
  font-family: var(--stem-font-display);
  font-size: clamp(1.35rem, 1.8vw, 1.55rem);
  letter-spacing: -0.03em;
}
.as-hero-lead {
  margin: 0;
  color: var(--stem-ink-soft);
  line-height: 1.5;
  max-width: 42rem;
  font-size: var(--stem-text-base);
}
.as-hero-actions { display: grid; gap: 0.75rem; justify-items: end; }
.as-action-row { display: flex; flex-wrap: wrap; gap: 0.45rem; justify-content: flex-end; align-items: center; }
.as-ghost-link {
  display: inline-flex; align-items: center; min-height: 40px; padding: 0 0.75rem;
  font-size: var(--stem-text-md); font-weight: 600; color: var(--stem-teal-deep); text-decoration: none;
}
.as-ghost-link:hover { text-decoration: underline; }
.as-alert {
  display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;
  padding: 0.85rem 1rem; border-radius: 12px; background: #fef3f2; color: var(--stem-danger);
  border: 1px solid #fecdca; font-size: var(--stem-text-base);
}
.as-plan-mix {
  display: flex; flex-wrap: wrap; gap: 0.55rem;
}
.as-mix-chip {
  display: grid; gap: 0.1rem; text-align: left;
  padding: 0.65rem 0.85rem;
  border-radius: 12px;
  border: 1px solid var(--stem-line);
  background: #fff;
  font: inherit;
  cursor: pointer;
  min-width: 140px;
}
.as-mix-chip strong { font-size: var(--stem-text-base); }
.as-mix-chip span { font-size: var(--stem-text-sm); color: var(--stem-ink-soft); }
.as-mix-chip.is-on,
.as-mix-chip:hover {
  border-color: rgba(12, 124, 128, 0.4);
  background: var(--stem-mint-soft);
}
.as-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(300px, 0.9fr);
  gap: 1rem;
  align-items: start;
}
.as-table-wrap { overflow-x: auto; }
.as-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--stem-text-base);
  min-width: 560px;
}
.as-table th {
  text-align: left;
  padding: 0.65rem 0.55rem;
  border-bottom: 1px solid var(--stem-line);
  color: var(--stem-ink-soft);
  font-size: var(--stem-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 700;
}
.as-table td {
  padding: 0.85rem 0.55rem;
  border-bottom: 1px solid var(--stem-line);
  vertical-align: middle;
}
.as-table tbody tr {
  cursor: pointer;
  transition: background 0.12s ease;
}
.as-table tbody tr:hover { background: var(--stem-mint-soft); }
.as-table tbody tr.is-selected {
  background: linear-gradient(90deg, var(--portal-accent-soft), #fff 70%);
}
.as-slug { margin-top: 0.25rem; }
.as-slug code,
.as-detail code {
  font-size: var(--stem-text-sm);
  background: var(--stem-mint-soft);
  padding: 0.15rem 0.4rem;
  border-radius: 6px;
  border: 1px solid var(--stem-line);
}
.as-side { min-width: 0; }
.as-detail {
  border: 1px solid var(--stem-line);
  border-radius: 16px;
  padding: 1.15rem;
  background: linear-gradient(180deg, #fff, var(--stem-mint-soft));
  min-height: 320px;
  position: sticky;
  top: 5.5rem;
}
.as-detail-empty {
  display: grid;
  place-content: center;
  text-align: center;
}
.as-detail-head {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 1rem;
}
.as-detail-mark {
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
.as-detail h3 { margin: 0; font-size: 1.15rem; }
.as-detail p { margin: 0.25rem 0 0; color: var(--stem-ink-soft); font-size: var(--stem-text-md); }
.as-meta {
  display: grid;
  gap: 0.65rem;
  margin: 0 0 1rem;
}
.as-meta > div {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: var(--stem-text-base);
}
.as-meta dt { color: var(--stem-ink-soft); margin: 0; }
.as-meta dd { margin: 0; font-weight: 600; text-align: right; }
.as-limits {
  list-style: none;
  margin: 0 0 0.85rem;
  padding: 0;
  display: grid;
  gap: 0.35rem;
}
.as-limits li {
  padding: 0.5rem 0.7rem;
  border-radius: 10px;
  background: #fff;
  border: 1px solid var(--stem-line);
  font-size: var(--stem-text-md);
}
.as-modules {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 1rem;
}
.as-modules span {
  font-size: var(--stem-text-xs);
  font-weight: 700;
  text-transform: capitalize;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  border: 1px solid #e5e5e5;
  background: #f5f5f5;
  color: #737373;
}
.as-modules span.is-on {
  background: #ecfdf3;
  color: #067647;
  border-color: #abefc6;
}
.as-change {
  display: grid;
  gap: 0.75rem;
  margin-bottom: 0.85rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--stem-line);
}
.as-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem;
  font-size: var(--stem-text-md);
  font-weight: 600;
  color: var(--stem-teal-deep);
  padding-top: 0.75rem;
  border-top: 1px solid var(--stem-line);
}
.as-links a { color: inherit; text-decoration: none; }
.as-links a:hover { text-decoration: underline; }
.as-empty, .as-muted { margin: 0; color: var(--stem-ink-soft); }
.as-pill {
  display: inline-flex;
  padding: 0.18rem 0.55rem;
  border-radius: 999px;
  font-size: var(--stem-text-xs);
  font-weight: 700;
  border: 1px solid transparent;
}
.as-pill.status-active { background: #ecfdf3; color: #067647; border-color: #abefc6; }
.as-pill.status-cancelled { background: #fef3f2; color: #b42318; border-color: #fecdca; }
.as-pill.status-expired { background: #f5f5f5; color: #525252; border-color: #e5e5e5; }
@media (max-width: 960px) {
  .as-hero, .as-layout { grid-template-columns: 1fr; }
  .as-hero-actions { justify-items: start; }
  .as-action-row { justify-content: flex-start; }
  .as-detail { position: static; }
}
`;
