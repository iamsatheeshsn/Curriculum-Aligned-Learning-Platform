import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import { Button, Panel, StatStrip, Toolbar } from '@stemora/ui';
import { ControlLayout } from '../../layout/ControlLayout';
import { statusLabel } from '../../types';

type PaymentRow = {
  id: number;
  amount: number | string;
  currency: string;
  method: string | null;
  reference: string | null;
  paid_at?: string | null;
  tenant?: {
    id: number;
    name: string;
    slug: string;
    legal_name?: string | null;
  } | null;
  invoice?: {
    id: number;
    number: string;
    status: string;
    total: number | string;
    currency: string;
  } | null;
  created_at?: string | null;
};

type PaymentStats = {
  total: number;
  amount_sum: number;
  currency: string;
  by_method: Record<string, number>;
};

function money(currency: string, value: number | string, digits = 2) {
  const n = typeof value === 'string' ? Number(value) : value;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: digits,
    }).format(n);
  } catch {
    return `${currency} ${Number.isFinite(n) ? n.toFixed(digits) : value}`;
  }
}

function fmtDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return value;
  }
}

function fmtDateTime(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

/**
 * Read-only platform payment directory with search and method filters.
 */
export function PaymentsPage() {
  const { isSuperAdmin, hasPermission } = useAuth();
  if (
    !isSuperAdmin &&
    !hasPermission([
      'platform.plans.manage',
      'platform.tenants.manage',
      'nav.control.billing',
    ])
  ) {
    return <Navigate to="/" replace />;
  }

  return (
    <ControlLayout
      title="Payments"
      subtitle="Browse recorded invoice payments across all organisations"
    >
      <PaymentsWorkspace />
    </ControlLayout>
  );
}

function PaymentsWorkspace() {
  const { api } = useAuth();
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<PaymentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (methodFilter) params.set('method', methodFilter);
      if (tenantFilter) params.set('tenant_id', tenantFilter);
      const qs = params.toString();
      const res = await api.get<{ data: PaymentRow[]; meta: { stats: PaymentStats } }>(
        `/control/billing/payments${qs ? `?${qs}` : ''}`,
      );
      setRows(res.data);
      setStats(res.meta.stats);
      setSelectedId((current) => {
        if (current && res.data.some((r) => r.id === current)) return current;
        return res.data[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [api, search, methodFilter, tenantFilter]);

  useEffect(() => {
    void load();
  }, [api, methodFilter, tenantFilter]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void (async () => {
      try {
        const res = await api.get<{ data: PaymentRow }>(`/control/billing/payments/${selectedId}`);
        if (!cancelled) setDetail(res.data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load payment details');
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
  const displayCurrency = stats?.currency ?? rows[0]?.currency ?? 'SAR';

  const tenantOptions = useMemo(() => {
    const map = new Map<number, { id: number; name: string; slug: string }>();
    for (const row of rows) {
      if (row.tenant) map.set(row.tenant.id, row.tenant);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const methodOptions = useMemo(() => {
    const fromStats = Object.keys(stats?.by_method ?? {});
    const fromRows = rows.map((r) => r.method).filter(Boolean) as string[];
    return [...new Set([...fromStats, ...fromRows])].sort();
  }, [stats, rows]);

  const methodBreakdown = useMemo(() => {
    if (!stats?.by_method) return '—';
    const parts = Object.entries(stats.by_method)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([method, count]) => `${statusLabel(method)} ${count}`);
    return parts.length ? parts.join(' · ') : '—';
  }, [stats]);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    await load();
  }

  if (loading && rows.length === 0 && !stats) {
    return <p className="bpay-muted">Loading payments…</p>;
  }

  if (error && !stats && rows.length === 0) {
    return (
      <Panel title="Unable to load payments">
        <p style={{ color: 'var(--stem-danger)', marginTop: 0 }}>{error}</p>
        <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
          Retry
        </Button>
      </Panel>
    );
  }

  return (
    <div className="bpay-page">
      <section className="bpay-hero stem-animate-rise">
        <div>
          <p className="bpay-eyebrow">Control · Billing</p>
          <h2 className="bpay-hero-title">Payments</h2>
          <p className="bpay-hero-lead">
            Read-only directory of invoice payments — search by reference, filter by method or
            organisation, and inspect linked invoices.
          </p>
        </div>
        <div className="bpay-hero-actions">
          <div className="bpay-action-row">
            <Button
              size="sm"
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => void load()}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Link to="/billing/invoices" className="bpay-ghost-link">
              Invoices
            </Link>
            <Link to="/billing/plans" className="bpay-ghost-link">
              Plans
            </Link>
          </div>
        </div>
      </section>

      {error ? (
        <div className="bpay-alert" role="alert">
          <span>{error}</span>
          <Button size="sm" type="button" variant="secondary" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <StatStrip
        items={[
          { label: 'Payments', value: String(stats?.total ?? '—') },
          {
            label: 'Collected',
            value: money(displayCurrency, stats?.amount_sum ?? 0),
            hint: 'Sum of all payments',
          },
          { label: 'Currency', value: displayCurrency },
          { label: 'By method', value: methodBreakdown, hint: 'Top methods' },
        ]}
      />

      <div className="bpay-layout">
        <Panel
          title="Payment directory"
          description="Search by reference, invoice number, or organisation. Select a row for full details."
          action={
            <Toolbar as="form" onSubmit={onSearch}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search reference or invoice"
                aria-label="Search payments"
              />
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                aria-label="Filter by method"
              >
                <option value="">All methods</option>
                {methodOptions.map((m) => (
                  <option key={m} value={m}>
                    {statusLabel(m)}
                  </option>
                ))}
              </select>
              <select
                value={tenantFilter}
                onChange={(e) => setTenantFilter(e.target.value)}
                aria-label="Filter by organisation"
              >
                <option value="">All organisations</option>
                {tenantOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="secondary" size="sm">
                Apply
              </Button>
            </Toolbar>
          }
        >
          <div className="bpay-table-wrap">
            <table className="bpay-table">
              <thead>
                <tr>
                  <th>Payment</th>
                  <th>Organisation</th>
                  <th>Invoice</th>
                  <th>Method</th>
                  <th>Paid</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="bpay-empty">
                      No payments match this filter.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      className={selectedId === row.id ? 'is-selected' : undefined}
                      onClick={() => setSelectedId(row.id)}
                    >
                      <td>
                        <strong>{money(row.currency, row.amount)}</strong>
                        <div className="bpay-slug">
                          {row.reference ? `Ref ${row.reference}` : `ID ${row.id}`}
                        </div>
                      </td>
                      <td>
                        {row.tenant ? (
                          <>
                            <strong>{row.tenant.name}</strong>
                            <div className="bpay-slug">
                              <code>{row.tenant.slug}</code>
                            </div>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {row.invoice ? (
                          <>
                            <strong>{row.invoice.number}</strong>
                            <div className="bpay-slug">{statusLabel(row.invoice.status)}</div>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{row.method ? statusLabel(row.method) : '—'}</td>
                      <td>{fmtDate(row.paid_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <aside className="bpay-side" aria-live="polite">
          {activeDetail ? (
            <div className="bpay-detail">
              <div className="bpay-detail-head">
                <span className="bpay-detail-mark" aria-hidden>
                  {activeDetail.currency}
                </span>
                <div>
                  <h3>{money(activeDetail.currency, activeDetail.amount)}</h3>
                  <p>
                    {activeDetail.method ? statusLabel(activeDetail.method) : 'Payment'}
                    {activeDetail.reference ? ` · Ref ${activeDetail.reference}` : ''}
                  </p>
                </div>
              </div>

              {detailLoading && !detail ? (
                <p className="bpay-muted">Loading details…</p>
              ) : (
                <>
                  <dl className="bpay-meta">
                    <div>
                      <dt>Amount</dt>
                      <dd>
                        <strong>{money(activeDetail.currency, activeDetail.amount)}</strong>
                      </dd>
                    </div>
                    <div>
                      <dt>Method</dt>
                      <dd>{activeDetail.method ? statusLabel(activeDetail.method) : '—'}</dd>
                    </div>
                    <div>
                      <dt>Reference</dt>
                      <dd>{activeDetail.reference || '—'}</dd>
                    </div>
                    <div>
                      <dt>Paid at</dt>
                      <dd>{fmtDateTime(activeDetail.paid_at)}</dd>
                    </div>
                    <div>
                      <dt>Recorded</dt>
                      <dd>{fmtDateTime(activeDetail.created_at)}</dd>
                    </div>
                    <div>
                      <dt>Organisation</dt>
                      <dd>
                        {activeDetail.tenant ? (
                          <>
                            {activeDetail.tenant.name}
                            <span className="bpay-inline-muted">
                              {' '}
                              · <code>{activeDetail.tenant.slug}</code>
                            </span>
                          </>
                        ) : (
                          '—'
                        )}
                      </dd>
                    </div>
                    {activeDetail.tenant?.legal_name ? (
                      <div>
                        <dt>Legal name</dt>
                        <dd>{activeDetail.tenant.legal_name}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>Invoice</dt>
                      <dd>
                        {activeDetail.invoice ? (
                          <>
                            {activeDetail.invoice.number}
                            <span className="bpay-inline-muted">
                              {' '}
                              · {money(activeDetail.invoice.currency, activeDetail.invoice.total)}{' '}
                              · {statusLabel(activeDetail.invoice.status)}
                            </span>
                          </>
                        ) : (
                          '—'
                        )}
                      </dd>
                    </div>
                  </dl>

                  <div className="bpay-links">
                    <Link to="/billing/invoices">Open invoices</Link>
                    <Link to="/dashboard/revenue">Revenue dashboard</Link>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="bpay-detail bpay-detail-empty">
              <p className="bpay-empty">Select a payment to review details.</p>
            </div>
          )}
        </aside>
      </div>

      <style>{paymentStyles}</style>
    </div>
  );
}

const paymentStyles = `
.bpay-page { display: grid; gap: 1rem; }
.bpay-hero {
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
.bpay-eyebrow {
  margin: 0 0 0.3rem;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--stem-teal-deep);
}
.bpay-hero-title {
  margin: 0 0 0.35rem;
  font-family: var(--stem-font-display);
  font-size: clamp(1.35rem, 1.8vw, 1.55rem);
  letter-spacing: -0.03em;
}
.bpay-hero-lead {
  margin: 0;
  color: var(--stem-ink-soft);
  line-height: 1.5;
  max-width: 42rem;
  font-size: var(--stem-text-base);
}
.bpay-hero-actions { display: grid; gap: 0.75rem; justify-items: end; }
.bpay-action-row { display: flex; flex-wrap: wrap; gap: 0.45rem; justify-content: flex-end; align-items: center; }
.bpay-ghost-link {
  display: inline-flex; align-items: center; min-height: 40px; padding: 0 0.75rem;
  font-size: var(--stem-text-md); font-weight: 600; color: var(--stem-teal-deep); text-decoration: none;
}
.bpay-ghost-link:hover { text-decoration: underline; }
.bpay-alert {
  display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;
  padding: 0.85rem 1rem; border-radius: 12px; background: #fef3f2; color: var(--stem-danger);
  border: 1px solid #fecdca; font-size: var(--stem-text-base);
}
.bpay-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(280px, 0.85fr);
  gap: 1rem;
  align-items: start;
}
.bpay-table-wrap { overflow-x: auto; margin: 0 -0.15rem; }
.bpay-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--stem-text-base);
}
.bpay-table th {
  text-align: left;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--stem-ink-soft);
  padding: 0.55rem 0.65rem;
  border-bottom: 1px solid var(--stem-line);
  white-space: nowrap;
}
.bpay-table td {
  padding: 0.7rem 0.65rem;
  border-bottom: 1px solid var(--stem-line);
  vertical-align: top;
}
.bpay-table tbody tr {
  cursor: pointer;
  transition: background 0.15s ease;
}
.bpay-table tbody tr:hover { background: rgba(18, 160, 171, 0.04); }
.bpay-table tbody tr.is-selected { background: rgba(12, 124, 128, 0.08); }
.bpay-slug { margin-top: 0.15rem; font-size: var(--stem-text-sm); color: var(--stem-ink-soft); }
.bpay-slug code { font-size: var(--stem-text-sm); }
.bpay-empty { text-align: center; color: var(--stem-ink-soft); padding: 1.5rem 0.75rem !important; }
.bpay-side { position: sticky; top: 0.75rem; }
.bpay-detail {
  display: grid;
  gap: 1rem;
  padding: 1.1rem 1.15rem;
  border-radius: 16px;
  border: 1px solid var(--stem-line);
  background: #fff;
}
.bpay-detail-empty { min-height: 180px; align-content: center; justify-items: start; gap: 0.85rem; }
.bpay-detail-head {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}
.bpay-detail-mark {
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
.bpay-detail-head h3 {
  margin: 0;
  font-size: var(--stem-text-xl);
  letter-spacing: -0.02em;
}
.bpay-detail-head p {
  margin: 0.15rem 0 0;
  font-size: var(--stem-text-md);
  color: var(--stem-ink-soft);
}
.bpay-meta {
  display: grid;
  gap: 0.55rem;
  margin: 0;
}
.bpay-meta > div {
  display: grid;
  grid-template-columns: 7.5rem minmax(0, 1fr);
  gap: 0.5rem;
  align-items: baseline;
}
.bpay-meta dt {
  margin: 0;
  font-size: var(--stem-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--stem-ink-soft);
}
.bpay-meta dd { margin: 0; font-size: var(--stem-text-base); }
.bpay-inline-muted { color: var(--stem-ink-soft); font-size: var(--stem-text-sm); }
.bpay-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  padding-top: 0.25rem;
  border-top: 1px solid var(--stem-line);
}
.bpay-links a {
  font-size: var(--stem-text-md);
  font-weight: 600;
  color: var(--stem-teal-deep);
  text-decoration: none;
}
.bpay-links a:hover { text-decoration: underline; }
.bpay-muted { color: var(--stem-ink-soft); font-size: var(--stem-text-base); margin: 0; }
@media (max-width: 960px) {
  .bpay-hero, .bpay-layout { grid-template-columns: 1fr; }
  .bpay-hero-actions { justify-items: start; }
  .bpay-action-row { justify-content: flex-start; }
  .bpay-side { position: static; }
}
`;
