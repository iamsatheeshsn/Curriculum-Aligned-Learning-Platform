import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
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

type UsageReport = {
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

export function UsageReportPage() {
  const { isSuperAdmin, hasPermission } = useAuth();
  if (!isSuperAdmin && !hasPermission(['platform.tenants.manage', 'nav.control.reports'])) {
    return <Navigate to="/" replace />;
  }

  return (
    <ControlLayout
      title="Usage Report"
      subtitle="Exportable platform usage — tenants, subscriptions, growth, and lifecycle mix"
    >
      <UsageReportWorkspace />
    </ControlLayout>
  );
}

function UsageReportWorkspace() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [months, setMonths] = useState(6);
  const [data, setData] = useState<UsageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: UsageReport }>(`/control/reports/usage?months=${months}`);
      setData(res.data);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Could not load usage report.');
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
          `usage-report-${data.period.months}m`,
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
            ...data.top_tenants.map((r) => ['Top tenants', r.name, r.schools_count]),
            ...data.recent_signups.map((r) => ['Recent signup', r.name, r.created_at ?? '']),
          ],
        );
      } else {
        const kpiCells = [
          ['Tenants', data.kpis.total_tenants],
          ['Active', data.kpis.active_tenants],
          ['MRR', money(data.kpis.mrr, currency)],
          ['Conversion', `${data.kpis.conversion_rate}%`],
        ]
          .map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`)
          .join('');
        const statusRows = data.status_mix
          .map((r) => `<tr><td>${statusLabel(r.status)}</td><td>${r.count}</td><td>${r.percent}%</td></tr>`)
          .join('');
        const growthRows = data.tenant_growth
          .map((r) => `<tr><td>${r.label}</td><td>${r.new_tenants}</td></tr>`)
          .join('');
        exportPdfDocument({
          title: 'Usage Report',
          subtitle: `${data.period.months}-month platform overview`,
          bodyHtml: `<div class="kpi">${kpiCells}</div>
            <h2>Status mix</h2>
            <table><thead><tr><th>Status</th><th>Count</th><th>Share</th></tr></thead><tbody>${statusRows || '<tr><td colspan="3">No data</td></tr>'}</tbody></table>
            <h2>Tenant growth</h2>
            <table><thead><tr><th>Month</th><th>New tenants</th></tr></thead><tbody>${growthRows || '<tr><td colspan="2">No data</td></tr>'}</tbody></table>`,
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
        message: err instanceof Error ? err.message : 'Could not export usage report.',
        confirmLabel: 'OK',
        cancelLabel: 'Close',
        tone: 'warn',
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="ur-page">
      <section className="ur-hero stem-animate-rise">
        <div>
          <p className="ur-eyebrow">Control · Reports</p>
          <h2 className="ur-hero-title">Usage report</h2>
          <p className="ur-hero-lead">
            Tenant lifecycle, subscription mix, and platform growth signals. Adjust the period,
            refresh data, or export for leadership reviews.
          </p>
        </div>
        <div className="ur-hero-actions">
          <SelectField
            label="Period"
            value={String(months)}
            onChange={(e) => setMonths(Number(e.target.value))}
          >
            <option value="3">Last 3 months</option>
            <option value="6">Last 6 months</option>
            <option value="12">Last 12 months</option>
          </SelectField>
          <div className="ur-action-row">
            <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button
              size="sm"
              type="button"
              variant="secondary"
              disabled={!data || exporting}
              onClick={() => void runExport('excel')}
            >
              Export Excel
            </Button>
            <Button
              size="sm"
              type="button"
              variant="primary"
              disabled={!data || exporting}
              onClick={() => void runExport('pdf')}
            >
              Export PDF
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="ur-alert" role="alert">
          <span>{error}</span>
          <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : null}

      {loading && !data ? <p className="ur-muted">Loading usage report…</p> : null}

      {data ? (
        <>
          <StatStrip
            items={[
              {
                label: 'Tenants',
                value: String(data.kpis.total_tenants),
                hint: `${data.kpis.new_tenants_period} new in period`,
              },
              {
                label: 'Active',
                value: String(data.kpis.active_tenants),
                hint: `${data.kpis.trial_tenants} on trial`,
              },
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
              {
                label: 'Schools',
                value: String(data.kpis.schools),
                hint: `${data.kpis.users} users`,
              },
              {
                label: 'Paid revenue',
                value: money(data.kpis.paid_revenue_period, currency),
                hint: `${data.period.months}-month window`,
              },
            ]}
          />

          <div className="ur-grid-2">
            <Panel title="Status mix" description="Current tenant lifecycle distribution">
              <div className="ur-status-list">
                {data.status_mix.map((row) => (
                  <div key={row.status} className="ur-status-row">
                    <div className="ur-status-head">
                      <StatusPill status={row.status} />
                      <span>
                        {row.count} · {row.percent}%
                      </span>
                    </div>
                    <div className="ur-bar-track">
                      <div
                        className={`ur-bar-fill status-${row.status}`}
                        style={{ width: `${row.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Plan mix & MRR" description="Active subscriptions by catalogue plan">
              {data.plan_mix.length === 0 ? (
                <p className="ur-muted">No active subscriptions yet.</p>
              ) : (
                <div className="ur-bars">
                  {data.plan_mix.map((row) => (
                    <div key={row.plan_code} className="ur-plan-row">
                      <div className="ur-plan-head">
                        <strong>{row.plan_name}</strong>
                        <span>
                          {row.subscriptions} · {money(row.mrr, currency)} MRR
                        </span>
                      </div>
                      <div className="ur-bar-track">
                        <div
                          className="ur-bar-fill is-sky"
                          style={{ width: `${(row.subscriptions / planMax) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <div className="ur-grid-2">
            <Panel
              title="Tenant growth"
              description={`New organisations created · ${data.period.from} to ${data.period.to}`}
            >
              <div className="ur-bars" role="img" aria-label="Tenant growth by month">
                {data.tenant_growth.map((row) => (
                  <div key={row.month} className="ur-bar-row">
                    <span className="ur-bar-label">{row.label}</span>
                    <div className="ur-bar-track">
                      <div
                        className="ur-bar-fill is-teal"
                        style={{ width: `${(row.new_tenants / growthMax) * 100}%` }}
                      />
                    </div>
                    <strong className="ur-bar-value">{row.new_tenants}</strong>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Invoice revenue" description={`Paid invoice totals by month (${currency})`}>
              <div className="ur-bars" role="img" aria-label="Revenue by month">
                {data.revenue_trend.map((row) => (
                  <div key={row.month} className="ur-bar-row">
                    <span className="ur-bar-label">{row.label}</span>
                    <div className="ur-bar-track">
                      <div
                        className="ur-bar-fill is-apricot"
                        style={{ width: `${(row.revenue / revenueMax) * 100}%` }}
                      />
                    </div>
                    <strong className="ur-bar-value">{money(row.revenue, currency)}</strong>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <div className="ur-grid-2">
            <Panel title="Top tenants by schools" description="Largest footprints on the platform">
              {data.top_tenants.length === 0 ? (
                <p className="ur-muted">No tenants yet.</p>
              ) : (
                <div className="ur-table-wrap">
                  <table className="ur-table">
                    <thead>
                      <tr>
                        <th>Tenant</th>
                        <th>Status</th>
                        <th>Schools</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.top_tenants.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <strong>{row.name}</strong>
                            <div className="ur-sub">{row.slug}</div>
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

            <Panel title="Recent signups" description="Newest organisations on the platform">
              {data.recent_signups.length === 0 ? (
                <p className="ur-muted">No recent signups.</p>
              ) : (
                <ul className="ur-signup-list">
                  {data.recent_signups.map((row) => (
                    <li key={row.id}>
                      <div>
                        <strong>{row.name}</strong>
                        <span className="ur-sub">
                          {row.slug} · {row.schools_count} schools
                        </span>
                      </div>
                      <div className="ur-signup-meta">
                        <StatusPill status={row.status} />
                        <time>
                          {row.created_at ? new Date(row.created_at).toLocaleDateString() : '—'}
                        </time>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <Panel title="Invoice pipeline" description="All-time invoice counts by status">
            {data.invoice_summary.length === 0 ? (
              <p className="ur-muted">No invoices generated yet.</p>
            ) : (
              <div className="ur-table-wrap">
                <table className="ur-table">
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
            <div className="ur-quick-links">
              <Link to="/reports/revenue">Revenue report</Link>
              <Link to="/reports/schools">Schools report</Link>
              <Link to="/reports/students">Students report</Link>
              <Link to="/dashboard/revenue">Revenue dashboard</Link>
              <Link to="/dashboard/saas-analytics">SaaS analytics</Link>
            </div>
          </Panel>

          <p className="ur-generated">
            Generated {new Date(data.generated_at).toLocaleString()} · Period {data.period.from} →{' '}
            {data.period.to}
          </p>
        </>
      ) : null}
      <style>{urStyles}</style>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`ur-pill status-${status}`}>{statusLabel(status)}</span>;
}

const urStyles = `
.ur-page { display: grid; gap: 1rem; }
.ur-hero {
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
.ur-eyebrow {
  margin: 0 0 0.3rem;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--stem-teal-deep);
}
.ur-hero-title {
  margin: 0 0 0.35rem;
  font-family: var(--stem-font-display);
  font-size: clamp(1.35rem, 1.8vw, 1.55rem);
  letter-spacing: -0.03em;
}
.ur-hero-lead {
  margin: 0;
  color: var(--stem-ink-soft);
  line-height: 1.5;
  max-width: 42rem;
  font-size: var(--stem-text-base);
}
.ur-hero-actions { display: grid; gap: 0.75rem; }
.ur-action-row { display: flex; flex-wrap: wrap; gap: 0.45rem; justify-content: flex-end; }
.ur-alert {
  display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;
  padding: 0.85rem 1rem; border-radius: 12px; background: #fef3f2; color: var(--stem-danger);
  border: 1px solid #fecdca;
}
.ur-muted { margin: 0; color: var(--stem-ink-soft); }
.ur-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}
.ur-bars, .ur-status-list { display: grid; gap: 0.7rem; }
.ur-bar-row, .ur-plan-row { display: grid; gap: 0.35rem; }
.ur-bar-row {
  grid-template-columns: 72px minmax(0, 1fr) auto;
  align-items: center; gap: 0.55rem;
}
.ur-bar-label { font-size: var(--stem-text-sm); color: var(--stem-ink-soft); font-weight: 600; }
.ur-bar-value { font-size: var(--stem-text-md); min-width: 4.5rem; text-align: right; }
.ur-bar-track {
  height: 10px; border-radius: 999px; background: rgba(10, 31, 43, 0.06); overflow: hidden;
}
.ur-bar-fill {
  height: 100%; border-radius: 999px; min-width: 0; transition: width 0.35s ease;
}
.ur-bar-fill.is-teal { background: linear-gradient(90deg, #0c7c80, #12a0ab); }
.ur-bar-fill.is-apricot { background: linear-gradient(90deg, #c96a2e, #e98945); }
.ur-bar-fill.is-sky { background: linear-gradient(90deg, #2f7ea3, #3b93bc); }
.ur-bar-fill.status-active { background: #0f7a45; }
.ur-bar-fill.status-trial { background: #175cd3; }
.ur-bar-fill.status-suspended { background: #b42318; }
.ur-bar-fill.status-closed { background: #667085; }
.ur-status-row { display: grid; gap: 0.35rem; }
.ur-status-head, .ur-plan-head {
  display: flex; justify-content: space-between; gap: 0.75rem; align-items: center;
  font-size: var(--stem-text-md);
}
.ur-plan-head span, .ur-status-head span { color: var(--stem-ink-soft); font-size: var(--stem-text-sm); }
.ur-table-wrap { overflow-x: auto; }
.ur-table {
  width: 100%; border-collapse: collapse; font-size: var(--stem-text-base); min-width: 320px;
}
.ur-table th {
  text-align: left; padding: 0.55rem 0.4rem; border-bottom: 1px solid var(--stem-line);
  font-size: var(--stem-text-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--stem-ink-soft);
}
.ur-table td {
  padding: 0.7rem 0.4rem; border-bottom: 1px solid var(--stem-line); vertical-align: middle;
}
.ur-sub { font-size: var(--stem-text-sm); color: var(--stem-ink-soft); margin-top: 0.15rem; }
.ur-pill {
  display: inline-flex; padding: 0.18rem 0.5rem; border-radius: 999px; font-size: var(--stem-text-xs);
  font-weight: 700; border: 1px solid transparent;
}
.ur-pill.status-active { background: #ecfdf3; color: #067647; border-color: #abefc6; }
.ur-pill.status-trial { background: #eff8ff; color: #175cd3; border-color: #b2ddff; }
.ur-pill.status-suspended { background: #fef3f2; color: #b42318; border-color: #fecdca; }
.ur-pill.status-closed { background: #f5f5f5; color: #525252; border-color: #e5e5e5; }
.ur-signup-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.7rem; }
.ur-signup-list li {
  display: flex; justify-content: space-between; gap: 0.85rem; align-items: center;
  padding: 0.65rem 0.75rem; border-radius: 12px; border: 1px solid var(--stem-line);
  background: linear-gradient(165deg, #fff, var(--stem-mint-soft));
}
.ur-signup-list li > div { display: grid; gap: 0.15rem; }
.ur-signup-meta { display: grid; gap: 0.35rem; justify-items: end; font-size: var(--stem-text-sm); color: var(--stem-ink-soft); }
.ur-quick-links {
  display: flex; flex-wrap: wrap; gap: 0.65rem; margin-top: 1rem; padding-top: 0.85rem;
  border-top: 1px solid var(--stem-line);
}
.ur-quick-links a {
  color: var(--stem-teal-deep); font-weight: 600; font-size: var(--stem-text-md); text-decoration: none;
}
.ur-quick-links a:hover { text-decoration: underline; }
.ur-generated {
  margin: 0; font-size: var(--stem-text-sm); color: var(--stem-ink-soft); text-align: right;
}
@media (max-width: 960px) {
  .ur-hero, .ur-grid-2 { grid-template-columns: 1fr; }
  .ur-action-row { justify-content: flex-start; }
  .ur-bar-row { grid-template-columns: 64px minmax(0, 1fr); }
  .ur-bar-value { grid-column: 2; text-align: left; }
}
`;
