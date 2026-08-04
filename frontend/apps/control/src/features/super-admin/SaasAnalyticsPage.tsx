import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import {
  Button,
  Panel,
  SelectField,
  StatStrip,
  downloadExcelCsv,
  exportPdfDocument,
  useFeedback,
} from '@stemora/ui';
import { ControlLayout } from '../../layout/ControlLayout';
import { statusLabel } from '../../types';

type SaasAnalytics = {
  period: { months: number; from: string; to: string };
  kpis: {
    total_tenants: number;
    active_tenants: number;
    trial_tenants: number;
    suspended_tenants: number;
    closed_tenants: number;
    new_tenants_period: number;
    conversion_rate: number;
    mrr: number;
    currency: string;
    schools: number;
    users: number;
    active_subscriptions: number;
    paid_revenue_period: number;
  };
  status_mix: { status: string; count: number; percent: number }[];
  plan_mix: {
    plan_code: string;
    plan_name: string;
    subscriptions: number;
    unit_price: number;
    mrr: number;
  }[];
  tenant_growth: { month: string; label: string; new_tenants: number }[];
  revenue_trend: { month: string; label: string; revenue: number }[];
  invoice_summary: { status: string; count: number; amount: number }[];
  trials_ending_soon: {
    id: number;
    name: string;
    slug: string;
    status: string;
    trial_ends_at: string | null;
    days_remaining: number | null;
  }[];
  recent_signups: {
    id: number;
    name: string;
    slug: string;
    status: string;
    schools_count: number;
    created_at: string | null;
  }[];
  top_tenants: {
    id: number;
    name: string;
    slug: string;
    status: string;
    schools_count: number;
  }[];
  generated_at: string;
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

function maxOf(values: number[]) {
  return Math.max(1, ...values);
}

export function SaasAnalyticsPage() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [months, setMonths] = useState(6);
  const [data, setData] = useState<SaasAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: SaasAnalytics }>(`/control/analytics/saas?months=${months}`);
      setData(res.data);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Could not load SaaS analytics.');
    } finally {
      setLoading(false);
    }
  }, [api, months]);

  useEffect(() => {
    void load();
  }, [load]);

  const currency = data?.kpis.currency ?? 'SAR';
  const growthMax = useMemo(
    () => maxOf((data?.tenant_growth ?? []).map((r) => r.new_tenants)),
    [data],
  );
  const revenueMax = useMemo(
    () => maxOf((data?.revenue_trend ?? []).map((r) => r.revenue)),
    [data],
  );
  const planMax = useMemo(
    () => maxOf((data?.plan_mix ?? []).map((r) => r.subscriptions)),
    [data],
  );

  async function runExport(kind: 'excel' | 'pdf') {
    if (!data) return;
    setExporting(true);
    try {
      if (kind === 'excel') {
        downloadExcelCsv(
          `saas-analytics-${data.period.months}m`,
          ['Section', 'Metric', 'Value'],
          [
            ...Object.entries(data.kpis).map(([k, v]) => ['KPI', k, v]),
            ...data.status_mix.map((r) => ['Status mix', r.status, `${r.count} (${r.percent}%)`]),
            ...data.plan_mix.map((r) => [
              'Plan mix',
              r.plan_name,
              `${r.subscriptions} subs · MRR ${r.mrr}`,
            ]),
            ...data.tenant_growth.map((r) => ['Tenant growth', r.label, r.new_tenants]),
            ...data.revenue_trend.map((r) => ['Revenue', r.label, r.revenue]),
            ...data.trials_ending_soon.map((r) => [
              'Trials ending',
              r.name,
              r.trial_ends_at ?? '',
            ]),
            ...data.top_tenants.map((r) => ['Top tenants', r.name, r.schools_count]),
          ],
        );
      } else {
        const kpiCells = [
          ['Tenants', data.kpis.total_tenants],
          ['Active', data.kpis.active_tenants],
          ['MRR', money(data.kpis.mrr, currency)],
          ['Conversion', `${data.kpis.conversion_rate}%`],
        ]
          .map(
            ([label, value]) =>
              `<div><span>${label}</span><strong>${value}</strong></div>`,
          )
          .join('');
        const growthRows = data.tenant_growth
          .map((r) => `<tr><td>${r.label}</td><td>${r.new_tenants}</td></tr>`)
          .join('');
        const planRows = data.plan_mix
          .map(
            (r) =>
              `<tr><td>${r.plan_name}</td><td>${r.subscriptions}</td><td>${money(r.mrr, currency)}</td></tr>`,
          )
          .join('');
        exportPdfDocument({
          title: 'SaaS Analytics',
          subtitle: `${data.period.months}-month platform overview`,
          bodyHtml: `<div class="kpi">${kpiCells}</div>
            <h2>Tenant growth</h2>
            <table><thead><tr><th>Month</th><th>New tenants</th></tr></thead><tbody>${growthRows || '<tr><td colspan="2">No data</td></tr>'}</tbody></table>
            <h2>Plan mix</h2>
            <table><thead><tr><th>Plan</th><th>Subscriptions</th><th>MRR</th></tr></thead><tbody>${planRows || '<tr><td colspan="3">No data</td></tr>'}</tbody></table>`,
        });
      }
      if (kind === 'excel') {
        await feedback.success({
          title: 'Excel ready',
          message: 'Your spreadsheet download has started.',
        });
      }
    } catch (err) {
      await feedback.confirm({
        title: 'Export failed',
        message: err instanceof Error ? err.message : 'Could not export analytics.',
        confirmLabel: 'OK',
        cancelLabel: 'Close',
        tone: 'warn',
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <ControlLayout
      title="SaaS Analytics"
      subtitle="Tenant growth, subscription mix, and platform revenue health"
    >
      <div className="saas-page">
        <section className="saas-hero stem-animate-rise">
          <div>
            <p className="saas-eyebrow">Control · Platform intelligence</p>
            <h2 className="saas-hero-title">SaaS performance</h2>
            <p className="saas-hero-lead">
              Live tenant, subscription, and invoice signals for the Stemora control plane.
              Adjust the period, refresh data, or export for leadership reviews.
            </p>
          </div>
          <div className="saas-hero-actions">
            <SelectField
              label="Period"
              value={String(months)}
              onChange={(e) => setMonths(Number(e.target.value))}
            >
              <option value="3">Last 3 months</option>
              <option value="6">Last 6 months</option>
              <option value="12">Last 12 months</option>
            </SelectField>
            <div className="saas-action-row">
              <Button size="sm"
                type="button"
                variant="secondary"
                disabled={loading}
                onClick={() => void load()}
              >
                {loading ? 'Refreshing…' : 'Refresh'}
              </Button>
              <Button size="sm"
                type="button"
                variant="secondary"
                disabled={!data || exporting}
                onClick={() => void runExport('excel')}
              >
                Export Excel
              </Button>
              <Button size="sm"
                type="button"
                variant="primary"
                disabled={!data || exporting}
                onClick={() => void runExport('pdf')}
              >
                Download PDF
              </Button>
            </div>
          </div>
        </section>

        {error ? (
          <div className="saas-alert" role="alert">
            <span>{error}</span>
            <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : null}

        {loading && !data ? <p className="saas-muted">Loading SaaS analytics…</p> : null}

        {data ? (
          <>
            <StatStrip
              items={[
                { label: 'Tenants', value: String(data.kpis.total_tenants), hint: `${data.kpis.new_tenants_period} new in period` },
                { label: 'Active', value: String(data.kpis.active_tenants), hint: `${data.kpis.trial_tenants} on trial` },
                {
                  label: 'MRR',
                  value: money(data.kpis.mrr, currency),
                  hint: `${data.kpis.active_subscriptions} active subs`,
                },
                {
                  label: 'Conversion',
                  value: `${data.kpis.conversion_rate}%`,
                  hint: 'Active / (active + trial)',
                },
                { label: 'Schools', value: String(data.kpis.schools), hint: `${data.kpis.users} users` },
                {
                  label: 'Paid revenue',
                  value: money(data.kpis.paid_revenue_period, currency),
                  hint: `${data.period.months}-month window`,
                },
              ]}
            />

            <div className="saas-grid-2">
              <Panel
                title="Tenant growth"
                description={`New organisations created · ${data.period.from} to ${data.period.to}`}
              >
                <div className="saas-bars" role="img" aria-label="Tenant growth by month">
                  {data.tenant_growth.map((row) => (
                    <div key={row.month} className="saas-bar-row">
                      <span className="saas-bar-label">{row.label}</span>
                      <div className="saas-bar-track">
                        <div
                          className="saas-bar-fill is-teal"
                          style={{ width: `${(row.new_tenants / growthMax) * 100}%` }}
                        />
                      </div>
                      <strong className="saas-bar-value">{row.new_tenants}</strong>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Invoice revenue" description={`Paid invoice totals by month (${currency})`}>
                <div className="saas-bars" role="img" aria-label="Revenue by month">
                  {data.revenue_trend.map((row) => (
                    <div key={row.month} className="saas-bar-row">
                      <span className="saas-bar-label">{row.label}</span>
                      <div className="saas-bar-track">
                        <div
                          className="saas-bar-fill is-apricot"
                          style={{ width: `${(row.revenue / revenueMax) * 100}%` }}
                        />
                      </div>
                      <strong className="saas-bar-value">{money(row.revenue, currency)}</strong>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>

            <div className="saas-grid-2">
              <Panel title="Status mix" description="Current tenant lifecycle distribution">
                <div className="saas-status-list">
                  {data.status_mix.map((row) => (
                    <div key={row.status} className="saas-status-row">
                      <div className="saas-status-head">
                        <StatusPill status={row.status} />
                        <span>
                          {row.count} · {row.percent}%
                        </span>
                      </div>
                      <div className="saas-bar-track">
                        <div
                          className={`saas-bar-fill status-${row.status}`}
                          style={{ width: `${row.percent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Plan mix & MRR" description="Active subscriptions by catalogue plan">
                {(data.plan_mix.length ?? 0) === 0 ? (
                  <p className="saas-muted">No active subscriptions yet.</p>
                ) : (
                  <div className="saas-bars">
                    {data.plan_mix.map((row) => (
                      <div key={row.plan_code} className="saas-plan-row">
                        <div className="saas-plan-head">
                          <strong>{row.plan_name}</strong>
                          <span>
                            {row.subscriptions} · {money(row.mrr, currency)} MRR
                          </span>
                        </div>
                        <div className="saas-bar-track">
                          <div
                            className="saas-bar-fill is-sky"
                            style={{ width: `${(row.subscriptions / planMax) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </div>

            <div className="saas-grid-2">
              <Panel
                title="Trials ending soon"
                description="Trials due within 14 days"
                action={
                  <Link to="/tenants/trials" className="saas-inline-link">
                    View more
                  </Link>
                }
              >
                {data.trials_ending_soon.length === 0 ? (
                  <p className="saas-muted">No trials ending in the next two weeks.</p>
                ) : (
                  <div className="saas-table-wrap">
                    <table className="saas-table">
                      <thead>
                        <tr>
                          <th>Tenant</th>
                          <th>Ends</th>
                          <th>Days</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.trials_ending_soon.slice(0, 5).map((row) => (
                          <tr key={row.id}>
                            <td>
                              <strong>{row.name}</strong>
                              <div className="saas-sub">{row.slug}</div>
                            </td>
                            <td>
                              {row.trial_ends_at
                                ? new Date(row.trial_ends_at).toLocaleDateString()
                                : '—'}
                            </td>
                            <td>
                              <span
                                className={`saas-days ${
                                  (row.days_remaining ?? 99) <= 3 ? 'is-urgent' : ''
                                }`}
                              >
                                {row.days_remaining ?? '—'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>

              <Panel
                title="Top tenants by schools"
                description="Largest footprints on the platform"
                action={
                  <Link to="/tenants" className="saas-inline-link">
                    View more
                  </Link>
                }
              >
                {data.top_tenants.length === 0 ? (
                  <p className="saas-muted">No tenants yet.</p>
                ) : (
                  <div className="saas-table-wrap">
                    <table className="saas-table">
                      <thead>
                        <tr>
                          <th>Tenant</th>
                          <th>Status</th>
                          <th>Schools</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.top_tenants.slice(0, 5).map((row) => (
                          <tr key={row.id}>
                            <td>
                              <strong>{row.name}</strong>
                              <div className="saas-sub">{row.slug}</div>
                            </td>
                            <td>
                              <StatusPill status={row.status} />
                            </td>
                            <td>
                              <strong>{row.schools_count}</strong>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            </div>

            <div className="saas-grid-2">
              <Panel
                title="Recent signups"
                description="Newest organisations on the platform"
                action={
                  <Link to="/tenants" className="saas-inline-link">
                    View more
                  </Link>
                }
              >
                {data.recent_signups.length === 0 ? (
                  <p className="saas-muted">No recent signups.</p>
                ) : (
                  <ul className="saas-signup-list">
                    {data.recent_signups.slice(0, 5).map((row) => (
                      <li key={row.id}>
                        <div>
                          <strong>{row.name}</strong>
                          <span className="saas-sub">
                            {row.slug} · {row.schools_count} schools
                          </span>
                        </div>
                        <div className="saas-signup-meta">
                          <StatusPill status={row.status} />
                          <time>
                            {row.created_at
                              ? new Date(row.created_at).toLocaleDateString()
                              : '—'}
                          </time>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel title="Invoice pipeline" description="All-time invoice counts by status">
                {data.invoice_summary.length === 0 ? (
                  <p className="saas-muted">No invoices generated yet.</p>
                ) : (
                  <div className="saas-table-wrap">
                    <table className="saas-table">
                      <thead>
                        <tr>
                          <th>Status</th>
                          <th>Count</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.invoice_summary.map((row) => (
                          <tr key={row.status}>
                            <td>{statusLabel(row.status)}</td>
                            <td>{row.count}</td>
                            <td>{money(row.amount, currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="saas-quick-links">
                  <Link to="/">Platform dashboard</Link>
                  <Link to="/tenants">Schools</Link>
                  <Link to="/subscription">Subscription plans</Link>
                  <Link to="/dashboard/revenue">Revenue dashboard</Link>
                </div>
              </Panel>
            </div>

            <p className="saas-generated">
              Generated {new Date(data.generated_at).toLocaleString()} · Period{' '}
              {data.period.from} → {data.period.to}
            </p>
          </>
        ) : null}
      </div>
      <style>{saasStyles}</style>
    </ControlLayout>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`saas-pill status-${status}`}>{statusLabel(status)}</span>;
}

const saasStyles = `
.saas-page { display: grid; gap: 1rem; }
.saas-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(240px, 0.85fr);
  gap: 1.25rem;
  align-items: end;
  padding: 1.25rem 1.35rem;
  border-radius: 18px;
  border: 1px solid var(--stem-line);
  background:
    radial-gradient(120% 90% at 100% 0%, rgba(18, 160, 171, 0.12), transparent 55%),
    linear-gradient(145deg, #f3faf8, #eef5f2);
}
.saas-eyebrow {
  margin: 0 0 0.3rem;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--stem-teal-deep);
}
.saas-hero-title {
  margin: 0 0 0.35rem;
  font-family: var(--stem-font-display);
  font-size: clamp(1.35rem, 1.8vw, 1.55rem);
  letter-spacing: -0.03em;
}
.saas-hero-lead {
  margin: 0;
  color: var(--stem-ink-soft);
  line-height: 1.5;
  max-width: 42rem;
  font-size: var(--stem-text-base);
}
.saas-hero-actions { display: grid; gap: 0.75rem; }
.saas-action-row { display: flex; flex-wrap: wrap; gap: 0.45rem; justify-content: flex-end; }
.saas-alert {
  display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;
  padding: 0.85rem 1rem; border-radius: 12px; background: #fef3f2; color: var(--stem-danger);
  border: 1px solid #fecdca;
}
.saas-muted { margin: 0; color: var(--stem-ink-soft); }
.saas-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}
.saas-bars, .saas-status-list { display: grid; gap: 0.7rem; }
.saas-bar-row, .saas-plan-row { display: grid; gap: 0.35rem; }
.saas-bar-row {
  grid-template-columns: 72px minmax(0, 1fr) auto;
  align-items: center; gap: 0.55rem;
}
.saas-bar-label { font-size: var(--stem-text-sm); color: var(--stem-ink-soft); font-weight: 600; }
.saas-bar-value { font-size: var(--stem-text-md); min-width: 4.5rem; text-align: right; }
.saas-bar-track {
  height: 10px; border-radius: 999px; background: rgba(10, 31, 43, 0.06); overflow: hidden;
}
.saas-bar-fill {
  height: 100%; border-radius: 999px; min-width: 0; transition: width 0.35s ease;
}
.saas-bar-fill.is-teal { background: linear-gradient(90deg, #0c7c80, #12a0ab); }
.saas-bar-fill.is-apricot { background: linear-gradient(90deg, #c96a2e, #e98945); }
.saas-bar-fill.is-sky { background: linear-gradient(90deg, #2f7ea3, #3b93bc); }
.saas-bar-fill.status-active { background: #0f7a45; }
.saas-bar-fill.status-trial { background: #175cd3; }
.saas-bar-fill.status-suspended { background: #b42318; }
.saas-bar-fill.status-closed { background: #667085; }
.saas-status-row { display: grid; gap: 0.35rem; }
.saas-status-head, .saas-plan-head {
  display: flex; justify-content: space-between; gap: 0.75rem; align-items: center;
  font-size: var(--stem-text-md);
}
.saas-plan-head span, .saas-status-head span { color: var(--stem-ink-soft); font-size: var(--stem-text-sm); }
.saas-table-wrap { overflow-x: auto; }
.saas-table {
  width: 100%; border-collapse: collapse; font-size: var(--stem-text-base); min-width: 320px;
}
.saas-table th {
  text-align: left; padding: 0.55rem 0.4rem; border-bottom: 1px solid var(--stem-line);
  font-size: var(--stem-text-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--stem-ink-soft);
}
.saas-table td {
  padding: 0.7rem 0.4rem; border-bottom: 1px solid var(--stem-line); vertical-align: middle;
}
.saas-sub { font-size: var(--stem-text-sm); color: var(--stem-ink-soft); margin-top: 0.15rem; }
.saas-days {
  display: inline-flex; min-width: 2rem; justify-content: center; padding: 0.15rem 0.45rem;
  border-radius: 8px; background: var(--stem-mint-soft); font-weight: 700; font-size: var(--stem-text-md);
}
.saas-days.is-urgent { background: #fef3f2; color: var(--stem-danger); }
.saas-pill {
  display: inline-flex; padding: 0.18rem 0.5rem; border-radius: 999px; font-size: var(--stem-text-xs);
  font-weight: 700; border: 1px solid transparent;
}
.saas-pill.status-active { background: #ecfdf3; color: #067647; border-color: #abefc6; }
.saas-pill.status-trial { background: #eff8ff; color: #175cd3; border-color: #b2ddff; }
.saas-pill.status-suspended { background: #fef3f2; color: #b42318; border-color: #fecdca; }
.saas-pill.status-closed { background: #f5f5f5; color: #525252; border-color: #e5e5e5; }
.saas-signup-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.7rem; }
.saas-signup-list li {
  display: flex; justify-content: space-between; gap: 0.85rem; align-items: center;
  padding: 0.65rem 0.75rem; border-radius: 12px; border: 1px solid var(--stem-line);
  background: linear-gradient(165deg, #fff, var(--stem-mint-soft));
}
.saas-signup-list li > div { display: grid; gap: 0.15rem; }
.saas-signup-meta { display: grid; gap: 0.35rem; justify-items: end; font-size: var(--stem-text-sm); color: var(--stem-ink-soft); }
.saas-quick-links {
  display: flex; flex-wrap: wrap; gap: 0.65rem; margin-top: 1rem; padding-top: 0.85rem;
  border-top: 1px solid var(--stem-line);
}
.saas-quick-links a, .saas-inline-link {
  color: var(--stem-teal-deep); font-weight: 600; font-size: var(--stem-text-md); text-decoration: none;
}
.saas-quick-links a:hover, .saas-inline-link:hover { text-decoration: underline; }
.saas-generated {
  margin: 0; font-size: var(--stem-text-sm); color: var(--stem-ink-soft); text-align: right;
}
@media (max-width: 960px) {
  .saas-hero, .saas-grid-2 { grid-template-columns: 1fr; }
  .saas-action-row { justify-content: flex-start; }
  .saas-bar-row { grid-template-columns: 64px minmax(0, 1fr); }
  .saas-bar-value { grid-column: 2; text-align: left; }
}
`;
