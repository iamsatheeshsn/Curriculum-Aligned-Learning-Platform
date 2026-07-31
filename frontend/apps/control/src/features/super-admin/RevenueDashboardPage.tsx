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

type RevenueAnalytics = {
  period: { months: number; from: string; to: string };
  kpis: {
    mrr: number;
    arr: number;
    currency: string;
    paid_revenue_period: number;
    payments_collected: number;
    outstanding_amount: number;
    collection_rate: number;
    avg_paid_invoice: number;
    paid_invoices: number;
    active_subscriptions: number;
    paying_tenants: number;
  };
  revenue_trend: { month: string; label: string; revenue: number }[];
  payments_trend: { month: string; label: string; amount: number }[];
  revenue_by_plan: {
    plan_code: string;
    plan_name: string;
    subscriptions: number;
    unit_price: number;
    mrr: number;
    arr: number;
  }[];
  invoice_pipeline: { status: string; count: number; amount: number }[];
  top_paying_tenants: {
    tenant_id: number;
    name: string;
    slug: string;
    invoices_paid: number;
    revenue: number;
  }[];
  outstanding_invoices: {
    id: number;
    number: string;
    status: string;
    total: number;
    currency: string;
    due_at: string | null;
    issued_at: string | null;
    days_overdue: number;
    tenant: { id: number; name: string; slug: string } | null;
  }[];
  recent_payments: {
    id: number;
    amount: number;
    currency: string;
    method: string | null;
    reference: string | null;
    paid_at: string | null;
    invoice_number: string | null;
    tenant: { id: number; name: string; slug: string } | null;
  }[];
  generated_at: string;
};

function money(amount: number, currency: string, digits = 0) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: digits,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function maxOf(values: number[]) {
  return Math.max(1, ...values);
}


export function RevenueDashboardPage() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [months, setMonths] = useState(6);
  const [data, setData] = useState<RevenueAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: RevenueAnalytics }>(
        `/control/analytics/revenue?months=${months}`,
      );
      setData(res.data);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Could not load revenue analytics.');
    } finally {
      setLoading(false);
    }
  }, [api, months]);

  useEffect(() => {
    void load();
  }, [load]);

  const currency = data?.kpis.currency ?? 'SAR';
  const revenueMax = useMemo(
    () => maxOf((data?.revenue_trend ?? []).map((r) => r.revenue)),
    [data],
  );
  const paymentsMax = useMemo(
    () => maxOf((data?.payments_trend ?? []).map((r) => r.amount)),
    [data],
  );
  const planMax = useMemo(
    () => maxOf((data?.revenue_by_plan ?? []).map((r) => r.mrr)),
    [data],
  );

  async function runExport(kind: 'excel' | 'pdf') {
    if (!data) return;
    setExporting(true);
    try {
      if (kind === 'excel') {
        downloadExcelCsv(
          `revenue-dashboard-${data.period.months}m`,
          ['Section', 'Metric', 'Value'],
          [
            ...Object.entries(data.kpis).map(([k, v]) => ['KPI', k, v]),
            ...data.revenue_trend.map((r) => ['Revenue trend', r.label, r.revenue]),
            ...data.payments_trend.map((r) => ['Payments', r.label, r.amount]),
            ...data.revenue_by_plan.map((r) => [
              'Plan MRR',
              r.plan_name,
              `${r.subscriptions} · ${r.mrr}`,
            ]),
            ...data.top_paying_tenants.map((r) => ['Top paying', r.name, r.revenue]),
            ...data.outstanding_invoices.map((r) => [
              'Outstanding',
              r.number,
              `${r.total} (${r.status})`,
            ]),
            ...data.recent_payments.map((r) => [
              'Payment',
              r.invoice_number ?? String(r.id),
              r.amount,
            ]),
          ],
        );
      } else {
        const kpiCells = [
          ['MRR', money(data.kpis.mrr, currency)],
          ['ARR', money(data.kpis.arr, currency)],
          ['Paid', money(data.kpis.paid_revenue_period, currency)],
          ['Outstanding', money(data.kpis.outstanding_amount, currency)],
        ]
          .map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`)
          .join('');
        const trendRows = data.revenue_trend
          .map((r) => `<tr><td>${r.label}</td><td>${money(r.revenue, currency)}</td></tr>`)
          .join('');
        const planRows = data.revenue_by_plan
          .map(
            (r) =>
              `<tr><td>${r.plan_name}</td><td>${r.subscriptions}</td><td>${money(r.mrr, currency)}</td></tr>`,
          )
          .join('');
        exportPdfDocument({
          title: 'Revenue Dashboard',
          subtitle: `${data.period.months}-month billing overview`,
          bodyHtml: `<div class="kpi">${kpiCells}</div>
            <h2>Revenue trend</h2>
            <table><thead><tr><th>Month</th><th>Paid revenue</th></tr></thead><tbody>${trendRows || '<tr><td colspan="2">No data</td></tr>'}</tbody></table>
            <h2>Plan MRR</h2>
            <table><thead><tr><th>Plan</th><th>Subs</th><th>MRR</th></tr></thead><tbody>${planRows || '<tr><td colspan="3">No data</td></tr>'}</tbody></table>`,
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
        message: err instanceof Error ? err.message : 'Could not export revenue data.',
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
      title="Revenue Dashboard"
      subtitle="MRR, collections, outstanding invoices, and plan contribution"
    >
      <div className="rev-page">
        <section className="rev-hero stem-animate-rise">
          <div>
            <p className="rev-eyebrow">Control · Billing intelligence</p>
            <h2 className="rev-hero-title">Revenue performance</h2>
            <p className="rev-hero-lead">
              Track recurring revenue, paid invoices, payment collections, and receivables across
              Stemora tenants. Filter by period and export for finance reviews.
            </p>
          </div>
          <div className="rev-hero-actions">
            <SelectField
              label="Period"
              value={String(months)}
              onChange={(e) => setMonths(Number(e.target.value))}
            >
              <option value="3">Last 3 months</option>
              <option value="6">Last 6 months</option>
              <option value="12">Last 12 months</option>
            </SelectField>
            <div className="rev-action-row">
              <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
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
          <div className="rev-alert" role="alert">
            <span>{error}</span>
            <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : null}

        {loading && !data ? <p className="rev-muted">Loading revenue dashboard…</p> : null}

        {data ? (
          <>
            <StatStrip
              items={[
                {
                  label: 'MRR',
                  value: money(data.kpis.mrr, currency),
                  hint: `${data.kpis.active_subscriptions} active subs`,
                },
                {
                  label: 'ARR',
                  value: money(data.kpis.arr, currency),
                  hint: 'Annualised MRR',
                },
                {
                  label: 'Paid revenue',
                  value: money(data.kpis.paid_revenue_period, currency),
                  hint: `${data.kpis.paid_invoices} invoices · ${data.period.months}m`,
                },
                {
                  label: 'Collected',
                  value: money(data.kpis.payments_collected, currency),
                  hint: 'Payment records',
                },
                {
                  label: 'Outstanding',
                  value: money(data.kpis.outstanding_amount, currency),
                  hint: `${data.kpis.collection_rate}% collected vs open`,
                },
                {
                  label: 'Avg invoice',
                  value: money(data.kpis.avg_paid_invoice, currency),
                  hint: `${data.kpis.paying_tenants} paying tenants`,
                },
              ]}
            />

            <div className="rev-grid-2">
              <Panel
                title="Paid revenue trend"
                description={`Invoice totals marked paid · ${data.period.from} to ${data.period.to}`}
              >
                <div className="rev-bars" role="img" aria-label="Paid revenue by month">
                  {data.revenue_trend.map((row) => (
                    <div key={row.month} className="rev-bar-row">
                      <span className="rev-bar-label">{row.label}</span>
                      <div className="rev-bar-track">
                        <div
                          className="rev-bar-fill is-teal"
                          style={{ width: `${(row.revenue / revenueMax) * 100}%` }}
                        />
                      </div>
                      <strong className="rev-bar-value">{money(row.revenue, currency)}</strong>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Payments collected" description={`Cash recorded via payment entries (${currency})`}>
                <div className="rev-bars" role="img" aria-label="Payments by month">
                  {data.payments_trend.map((row) => (
                    <div key={row.month} className="rev-bar-row">
                      <span className="rev-bar-label">{row.label}</span>
                      <div className="rev-bar-track">
                        <div
                          className="rev-bar-fill is-apricot"
                          style={{ width: `${(row.amount / paymentsMax) * 100}%` }}
                        />
                      </div>
                      <strong className="rev-bar-value">{money(row.amount, currency)}</strong>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>

            <div className="rev-grid-2">
              <Panel title="MRR by plan" description="Recurring revenue contribution from active subscriptions">
                {data.revenue_by_plan.length === 0 ? (
                  <p className="rev-muted">No active subscriptions yet.</p>
                ) : (
                  <div className="rev-bars">
                    {data.revenue_by_plan.map((row) => (
                      <div key={row.plan_code} className="rev-plan-row">
                        <div className="rev-plan-head">
                          <strong>{row.plan_name}</strong>
                          <span>
                            {row.subscriptions} · {money(row.mrr, currency)} MRR
                          </span>
                        </div>
                        <div className="rev-bar-track">
                          <div
                            className="rev-bar-fill is-sky"
                            style={{ width: `${(row.mrr / planMax) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              <Panel title="Invoice pipeline" description="All-time invoice amounts by status">
                {data.invoice_pipeline.length === 0 ? (
                  <p className="rev-muted">No invoices generated yet.</p>
                ) : (
                  <div className="rev-table-wrap">
                    <table className="rev-table">
                      <thead>
                        <tr>
                          <th>Status</th>
                          <th>Count</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.invoice_pipeline.map((row) => (
                          <tr key={row.status}>
                            <td>
                              <InvoicePill status={row.status} />
                            </td>
                            <td>{row.count}</td>
                            <td>
                              <strong>{money(row.amount, currency)}</strong>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            </div>

            <div className="rev-grid-2">
              <Panel
                title="Top paying tenants"
                description={`Highest paid invoice totals in the last ${data.period.months} months`}
                action={
                  <Link to="/tenants" className="rev-inline-link">
                    Manage tenants
                  </Link>
                }
              >
                {data.top_paying_tenants.length === 0 ? (
                  <p className="rev-muted">No paid invoices in this period.</p>
                ) : (
                  <div className="rev-table-wrap">
                    <table className="rev-table">
                      <thead>
                        <tr>
                          <th>Tenant</th>
                          <th>Invoices</th>
                          <th>Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.top_paying_tenants.map((row) => (
                          <tr key={row.tenant_id}>
                            <td>
                              <strong>{row.name}</strong>
                              <div className="rev-sub">{row.slug}</div>
                            </td>
                            <td>{row.invoices_paid}</td>
                            <td>
                              <strong>{money(row.revenue, currency)}</strong>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>

              <Panel title="Outstanding invoices" description="Draft, sent, and overdue receivables">
                {data.outstanding_invoices.length === 0 ? (
                  <p className="rev-muted">No open invoices. Receivables are clear.</p>
                ) : (
                  <div className="rev-table-wrap">
                    <table className="rev-table">
                      <thead>
                        <tr>
                          <th>Invoice</th>
                          <th>Status</th>
                          <th>Due</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.outstanding_invoices.map((row) => (
                          <tr key={row.id}>
                            <td>
                              <strong>{row.number}</strong>
                              <div className="rev-sub">{row.tenant?.name ?? '—'}</div>
                            </td>
                            <td>
                              <InvoicePill status={row.status} />
                            </td>
                            <td>
                              {row.due_at ? new Date(row.due_at).toLocaleDateString() : '—'}
                              {row.days_overdue > 0 ? (
                                <div className="rev-overdue">{row.days_overdue}d overdue</div>
                              ) : null}
                            </td>
                            <td>
                              <strong>{money(row.total, row.currency || currency)}</strong>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            </div>

            <Panel title="Recent payments" description="Latest payment records across the platform">
              {data.recent_payments.length === 0 ? (
                <p className="rev-muted">No payments recorded in this period.</p>
              ) : (
                <div className="rev-table-wrap">
                  <table className="rev-table">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Tenant</th>
                        <th>Invoice</th>
                        <th>Method</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recent_payments.map((row) => (
                        <tr key={row.id}>
                          <td>
                            {row.paid_at ? new Date(row.paid_at).toLocaleString() : '—'}
                          </td>
                          <td>
                            <strong>{row.tenant?.name ?? '—'}</strong>
                            <div className="rev-sub">{row.tenant?.slug}</div>
                          </td>
                          <td>
                            <code className="rev-code">{row.invoice_number ?? '—'}</code>
                          </td>
                          <td>{row.method ? statusLabel(row.method) : '—'}</td>
                          <td>
                            <strong>{money(row.amount, row.currency || currency, 2)}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="rev-quick-links">
                <Link to="/">Platform dashboard</Link>
                <Link to="/dashboard/saas-analytics">SaaS analytics</Link>
                <Link to="/subscription">Subscription plans</Link>
                <Link to="/billing/invoices">Invoices</Link>
              </div>
            </Panel>

            <p className="rev-generated">
              Generated {new Date(data.generated_at).toLocaleString()} · Period {data.period.from} →{' '}
              {data.period.to}
            </p>
          </>
        ) : null}
      </div>
      <style>{revStyles}</style>
    </ControlLayout>
  );
}

function InvoicePill({ status }: { status: string }) {
  return <span className={`rev-pill status-${status}`}>{statusLabel(status)}</span>;
}

const revStyles = `
.rev-page { display: grid; gap: 1rem; }
.rev-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(240px, 0.85fr);
  gap: 1.25rem;
  align-items: end;
  padding: 1.25rem 1.35rem;
  border-radius: 18px;
  border: 1px solid var(--stem-line);
  background:
    radial-gradient(120% 90% at 100% 0%, rgba(233, 137, 69, 0.12), transparent 55%),
    linear-gradient(145deg, #f7faf8, #eef4f1);
}
.rev-eyebrow {
  margin: 0 0 0.3rem;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--stem-teal-deep);
}
.rev-hero-title {
  margin: 0 0 0.35rem;
  font-family: var(--stem-font-display);
  font-size: clamp(1.35rem, 1.8vw, 1.55rem);
  letter-spacing: -0.03em;
}
.rev-hero-lead {
  margin: 0;
  color: var(--stem-ink-soft);
  line-height: 1.5;
  max-width: 42rem;
  font-size: var(--stem-text-base);
}
.rev-hero-actions { display: grid; gap: 0.75rem; }
.rev-action-row { display: flex; flex-wrap: wrap; gap: 0.45rem; justify-content: flex-end; }
.rev-alert {
  display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;
  padding: 0.85rem 1rem; border-radius: 12px; background: #fef3f2; color: var(--stem-danger);
  border: 1px solid #fecdca;
}
.rev-muted { margin: 0; color: var(--stem-ink-soft); }
.rev-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}
.rev-bars { display: grid; gap: 0.7rem; }
.rev-bar-row {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) auto;
  align-items: center; gap: 0.55rem;
}
.rev-plan-row { display: grid; gap: 0.35rem; }
.rev-bar-label { font-size: var(--stem-text-sm); color: var(--stem-ink-soft); font-weight: 600; }
.rev-bar-value { font-size: var(--stem-text-md); min-width: 4.75rem; text-align: right; }
.rev-bar-track {
  height: 10px; border-radius: 999px; background: rgba(10, 31, 43, 0.06); overflow: hidden;
}
.rev-bar-fill {
  height: 100%; border-radius: 999px; min-width: 0; transition: width 0.35s ease;
}
.rev-bar-fill.is-teal { background: linear-gradient(90deg, #0c7c80, #12a0ab); }
.rev-bar-fill.is-apricot { background: linear-gradient(90deg, #c96a2e, #e98945); }
.rev-bar-fill.is-sky { background: linear-gradient(90deg, #2f7ea3, #3b93bc); }
.rev-plan-head {
  display: flex; justify-content: space-between; gap: 0.75rem; align-items: center;
  font-size: var(--stem-text-md);
}
.rev-plan-head span { color: var(--stem-ink-soft); font-size: var(--stem-text-sm); }
.rev-table-wrap { overflow-x: auto; }
.rev-table {
  width: 100%; border-collapse: collapse; font-size: var(--stem-text-base); min-width: 320px;
}
.rev-table th {
  text-align: left; padding: 0.55rem 0.4rem; border-bottom: 1px solid var(--stem-line);
  font-size: var(--stem-text-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--stem-ink-soft);
}
.rev-table td {
  padding: 0.7rem 0.4rem; border-bottom: 1px solid var(--stem-line); vertical-align: middle;
}
.rev-sub { font-size: var(--stem-text-sm); color: var(--stem-ink-soft); margin-top: 0.15rem; }
.rev-overdue { font-size: var(--stem-text-xs); color: var(--stem-danger); font-weight: 600; margin-top: 0.15rem; }
.rev-code {
  font-size: var(--stem-text-sm); background: var(--stem-mint-soft); padding: 0.15rem 0.4rem; border-radius: 6px;
}
.rev-pill {
  display: inline-flex; padding: 0.18rem 0.5rem; border-radius: 999px; font-size: var(--stem-text-xs);
  font-weight: 700; border: 1px solid transparent;
}
.rev-pill.status-paid { background: #ecfdf3; color: #067647; border-color: #abefc6; }
.rev-pill.status-sent { background: #eff8ff; color: #175cd3; border-color: #b2ddff; }
.rev-pill.status-draft { background: #f5f5f5; color: #525252; border-color: #e5e5e5; }
.rev-pill.status-overdue { background: #fef3f2; color: #b42318; border-color: #fecdca; }
.rev-pill.status-void { background: #f5f5f5; color: #667085; border-color: #e5e5e5; }
.rev-quick-links {
  display: flex; flex-wrap: wrap; gap: 0.65rem; margin-top: 1rem; padding-top: 0.85rem;
  border-top: 1px solid var(--stem-line);
}
.rev-quick-links a, .rev-inline-link {
  color: var(--stem-teal-deep); font-weight: 600; font-size: var(--stem-text-md); text-decoration: none;
}
.rev-quick-links a:hover, .rev-inline-link:hover { text-decoration: underline; }
.rev-generated {
  margin: 0; font-size: var(--stem-text-sm); color: var(--stem-ink-soft); text-align: right;
}
@media (max-width: 960px) {
  .rev-hero, .rev-grid-2 { grid-template-columns: 1fr; }
  .rev-action-row { justify-content: flex-start; }
  .rev-bar-row { grid-template-columns: 64px minmax(0, 1fr); }
  .rev-bar-value { grid-column: 2; text-align: left; }
}
`;
