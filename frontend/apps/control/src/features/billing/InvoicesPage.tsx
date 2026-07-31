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
import type { BillingContact } from '../../types';
import { statusLabel } from '../../types';
import { InvoicePrintView, type PrintableInvoice } from './InvoicePrintView';

type InvoiceItem = {
  id?: number;
  description: string;
  quantity: number | string;
  unit_price: number | string;
  line_total: number | string;
};

type InvoiceRow = {
  id: number;
  number: string;
  currency: string;
  subtotal: number | string;
  tax_total: number | string;
  total: number | string;
  status: string;
  issued_at?: string | null;
  due_at?: string | null;
  paid_at?: string | null;
  notes?: string | null;
  items: InvoiceItem[];
  tenant: {
    id: number;
    name: string;
    legal_name?: string | null;
    slug: string;
  } | null;
  payments?: {
    id: number;
    amount: number | string;
    currency: string;
    method?: string | null;
    reference?: string | null;
    paid_at?: string | null;
  }[];
  billing_contact?: BillingContact;
};

type InvoiceStats = {
  total: number;
  draft: number;
  sent: number;
  paid: number;
  overdue: number;
  void: number;
  outstanding_total: number;
};

type TenantOption = { id: number; name: string; slug: string };

type PaymentForm = {
  amount: string;
  method: string;
  reference: string;
  currency: string;
  paid_at: string;
};

const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'overdue', 'void'] as const;

const PAYMENT_METHODS = [
  { value: 'manual', label: 'Manual' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'card', label: 'Card' },
  { value: 'cheque', label: 'Cheque' },
];

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

function emptyPaymentForm(invoice?: InvoiceRow | null): PaymentForm {
  const total = invoice ? String(invoice.total) : '';
  return {
    amount: total,
    method: 'manual',
    reference: '',
    currency: invoice?.currency ?? 'SAR',
    paid_at: '',
  };
}

/**
 * Platform invoice directory — search, generate, send, record payments, and print.
 */
export function InvoicesPage() {
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
      title="Invoices"
      subtitle="Review platform invoices, send drafts, record payments, and print statements"
    >
      <InvoicesWorkspace />
    </ControlLayout>
  );
}

function InvoicesWorkspace() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [stats, setStats] = useState<InvoiceStats | null>(null);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<InvoiceRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [generateTenantId, setGenerateTenantId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [printInvoice, setPrintInvoice] = useState<PrintableInvoice | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>(emptyPaymentForm());
  const [recordingPayment, setRecordingPayment] = useState(false);

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
        data: InvoiceRow[];
        meta: { stats: InvoiceStats; tenants: TenantOption[] };
      }>(`/control/billing/invoices${qs ? `?${qs}` : ''}`);
      setRows(res.data);
      setStats(res.meta.stats);
      setTenants(res.meta.tenants ?? []);
      setSelectedId((current) => {
        if (current && res.data.some((r) => r.id === current)) return current;
        return res.data[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [api, search, statusFilter, tenantFilter]);

  useEffect(() => {
    void load();
  }, [api, statusFilter, tenantFilter]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setShowPaymentForm(false);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void (async () => {
      try {
        const res = await api.get<{ data: InvoiceRow }>(`/control/billing/invoices/${selectedId}`);
        if (!cancelled) {
          setDetail(res.data);
          setPaymentForm(emptyPaymentForm(res.data));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load invoice details');
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
  const displayCurrency = activeDetail?.currency ?? rows[0]?.currency ?? 'SAR';

  const canSend = activeDetail?.status === 'draft';
  const canPay =
    activeDetail?.status === 'draft' ||
    activeDetail?.status === 'sent' ||
    activeDetail?.status === 'overdue';

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    await load();
  }

  async function generateInvoice() {
    if (!generateTenantId) {
      setError('Select an organisation before generating an invoice.');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const res = await api.post<{ data: InvoiceRow }>('/control/billing/invoices/generate', {
        tenant_id: Number(generateTenantId),
      });
      const newId = res.data.id;
      await load();
      setSelectedId(newId);
      await feedback.success({
        title: 'Invoice generated',
        message: `Invoice ${res.data.number} was created as a draft.`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate invoice');
    } finally {
      setGenerating(false);
    }
  }

  async function sendInvoice() {
    if (!selectedId) return;
    setActionBusy('send');
    setError(null);
    try {
      await api.post(`/control/billing/invoices/${selectedId}/send`);
      await feedback.success({
        title: 'Invoice sent',
        message: 'The invoice status is now sent.',
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send invoice');
    } finally {
      setActionBusy(null);
    }
  }

  async function recordPayment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedId || !validateFormFields(e.currentTarget)) return;
    setRecordingPayment(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        amount: Number(paymentForm.amount),
        method: paymentForm.method,
        reference: paymentForm.reference.trim() || undefined,
      };
      if (paymentForm.currency.trim()) payload.currency = paymentForm.currency.trim();
      if (paymentForm.paid_at.trim()) payload.paid_at = paymentForm.paid_at.trim();

      await api.post(`/control/billing/invoices/${selectedId}/pay`, payload);
      await feedback.success({
        title: 'Payment recorded',
        message: 'The invoice payment has been saved.',
      });
      setShowPaymentForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record payment');
    } finally {
      setRecordingPayment(false);
    }
  }

  async function openPrint() {
    if (!selectedId) return;
    setActionBusy('print');
    setError(null);
    try {
      let invoice: PrintableInvoice;
      if (detail && detail.id === selectedId) {
        invoice = detail as PrintableInvoice;
      } else {
        const res = await api.get<{ data: PrintableInvoice }>(
          `/control/billing/invoices/${selectedId}`,
        );
        invoice = res.data;
      }
      if (!invoice.tenant) {
        throw new Error('Invoice is missing tenant details required for printing.');
      }
      setPrintInvoice({ ...invoice, tenant: invoice.tenant });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load invoice for printing');
    } finally {
      setActionBusy(null);
    }
  }

  if (loading && rows.length === 0 && !stats) {
    return <p className="bi-muted">Loading invoices…</p>;
  }

  if (error && !stats && rows.length === 0) {
    return (
      <Panel title="Unable to load invoices">
        <p style={{ color: 'var(--stem-danger)', marginTop: 0 }}>{error}</p>
        <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
          Retry
        </Button>
      </Panel>
    );
  }

  return (
    <div className="bi-page">
      <section className="bi-hero stem-animate-rise">
        <div>
          <p className="bi-eyebrow">Control · Billing</p>
          <h2 className="bi-hero-title">Invoices</h2>
          <p className="bi-hero-lead">
            Search platform invoices, generate drafts from subscriptions, send to organisations,
            record payments, and print professional statements.
          </p>
        </div>
        <div className="bi-hero-actions">
          <div className="bi-action-row">
            <Button
              size="sm"
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => void load()}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Link to="/billing/payments" className="bi-ghost-link">
              Payments
            </Link>
            <Link to="/billing/plans" className="bi-ghost-link">
              Plans
            </Link>
          </div>
          <div className="bi-generate-bar">
            <SelectField
              label="Generate for organisation"
              value={generateTenantId}
              onChange={(e) => setGenerateTenantId(e.target.value)}
            >
              <option value="">Select organisation</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.slug})
                </option>
              ))}
            </SelectField>
            <ConfirmButton
              size="sm"
              title="Generate invoice?"
              message="Create a draft invoice from the organisation's current subscription plan."
              confirmLabel="Generate"
              tone="primary"
              variant="apricot"
              onConfirm={() => {
                if (!generateTenantId || generating) return;
                return generateInvoice();
              }}
            >
              {generating ? 'Generating…' : '+ Generate invoice'}
            </ConfirmButton>
          </div>
        </div>
      </section>

      {error ? (
        <div className="bi-alert" role="alert">
          <span>{error}</span>
          <Button size="sm" type="button" variant="secondary" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <StatStrip
        items={[
          { label: 'Invoices', value: String(stats?.total ?? '—') },
          { label: 'Draft', value: String(stats?.draft ?? '—') },
          { label: 'Sent', value: String(stats?.sent ?? '—') },
          { label: 'Paid', value: String(stats?.paid ?? '—') },
          { label: 'Overdue', value: String(stats?.overdue ?? '—') },
          { label: 'Void', value: String(stats?.void ?? '—') },
          {
            label: 'Outstanding',
            value: money(displayCurrency, stats?.outstanding_total ?? 0),
            hint: 'Draft + sent + overdue',
          },
        ]}
      />

      <div className="bi-layout">
        <Panel
          title="Invoice directory"
          description="Search by number or organisation, filter by status, then select a row for actions."
          action={
            <Toolbar as="form" onSubmit={onSearch}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search number or tenant"
                aria-label="Search invoices"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
              >
                <option value="">All statuses</option>
                {INVOICE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
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
              <Button type="submit" variant="secondary" size="sm">
                Apply
              </Button>
            </Toolbar>
          }
        >
          <div className="bi-table-wrap">
            <table className="bi-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Organisation</th>
                  <th>Total</th>
                  <th>Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="bi-empty">
                      No invoices match this filter. Generate one to get started.
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
                        <strong>{row.number}</strong>
                        <div className="bi-slug">Issued {fmtDate(row.issued_at)}</div>
                      </td>
                      <td>
                        {row.tenant ? (
                          <>
                            <strong>{row.tenant.name}</strong>
                            <div className="bi-slug">
                              <code>{row.tenant.slug}</code>
                            </div>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{money(row.currency, row.total)}</td>
                      <td>{fmtDate(row.due_at)}</td>
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

        <aside className="bi-side" aria-live="polite">
          {activeDetail ? (
            <div className="bi-detail">
              <div className="bi-detail-head">
                <span className="bi-detail-mark" aria-hidden>
                  {activeDetail.currency}
                </span>
                <div>
                  <h3>{activeDetail.number}</h3>
                  <p>
                    {activeDetail.tenant?.name ?? 'Unknown organisation'}
                    {activeDetail.tenant ? ` · ${activeDetail.tenant.slug}` : ''}
                  </p>
                </div>
              </div>

              {detailLoading && !detail ? (
                <p className="bi-muted">Loading details…</p>
              ) : (
                <>
                  <dl className="bi-meta">
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <StatusPill status={activeDetail.status} />
                      </dd>
                    </div>
                    <div>
                      <dt>Subtotal</dt>
                      <dd>{money(activeDetail.currency, activeDetail.subtotal)}</dd>
                    </div>
                    <div>
                      <dt>Tax</dt>
                      <dd>{money(activeDetail.currency, activeDetail.tax_total)}</dd>
                    </div>
                    <div>
                      <dt>Total</dt>
                      <dd>
                        <strong>{money(activeDetail.currency, activeDetail.total)}</strong>
                      </dd>
                    </div>
                    <div>
                      <dt>Issued</dt>
                      <dd>{fmtDate(activeDetail.issued_at)}</dd>
                    </div>
                    <div>
                      <dt>Due</dt>
                      <dd>{fmtDate(activeDetail.due_at)}</dd>
                    </div>
                    <div>
                      <dt>Paid</dt>
                      <dd>{fmtDate(activeDetail.paid_at)}</dd>
                    </div>
                  </dl>

                  {(activeDetail.items?.length ?? 0) > 0 ? (
                    <div className="bi-lines">
                      <h4>Line items</h4>
                      <table>
                        <thead>
                          <tr>
                            <th>Description</th>
                            <th>Qty</th>
                            <th>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeDetail.items.map((item, idx) => (
                            <tr key={item.id ?? idx}>
                              <td>{item.description}</td>
                              <td>{item.quantity}</td>
                              <td>{money(activeDetail.currency, item.line_total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}

                  {(activeDetail.payments?.length ?? 0) > 0 ? (
                    <ul className="bi-payment-list">
                      <li className="bi-payment-list-head">Payments</li>
                      {activeDetail.payments!.map((p) => (
                        <li key={p.id}>
                          <strong>{money(p.currency || activeDetail.currency, p.amount)}</strong>
                          <span>
                            {p.method ? statusLabel(p.method) : 'Payment'}
                            {p.reference ? ` · Ref ${p.reference}` : ''}
                            {p.paid_at ? ` · ${fmtDate(p.paid_at)}` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {activeDetail.notes ? (
                    <div className="bi-notes">
                      <h4>Notes</h4>
                      <p>{activeDetail.notes}</p>
                    </div>
                  ) : null}

                  <div className="bi-actions bi-actions-primary">
                    <Button
                      size="sm"
                      type="button"
                      variant="primary"
                      disabled={actionBusy === 'print'}
                      onClick={() => void openPrint()}
                    >
                      {actionBusy === 'print' ? 'Loading…' : 'Print invoice'}
                    </Button>
                    {canSend ? (
                      <ConfirmButton
                        size="sm"
                        title="Send invoice?"
                        message={`Mark ${activeDetail.number} as sent and ready for payment.`}
                        confirmLabel="Send"
                        tone="primary"
                        variant="secondary"
                        onConfirm={() => {
                          if (actionBusy === 'send') return;
                          return sendInvoice();
                        }}
                      >
                        {actionBusy === 'send' ? 'Sending…' : 'Send'}
                      </ConfirmButton>
                    ) : null}
                    {canPay ? (
                      <Button
                        size="sm"
                        type="button"
                        variant="secondary"
                        onClick={() => setShowPaymentForm((v) => !v)}
                      >
                        {showPaymentForm ? 'Hide payment form' : 'Record payment'}
                      </Button>
                    ) : null}
                  </div>

                  {showPaymentForm && canPay ? (
                    <form onSubmit={recordPayment} className="bi-form" noValidate>
                      <TextField
                        label="Amount"
                        required
                        type="number"
                        step="0.01"
                        min="0"
                        value={paymentForm.amount}
                        onChange={(e) =>
                          setPaymentForm((f) => ({ ...f, amount: e.target.value }))
                        }
                      />
                      <SelectField
                        label="Method"
                        value={paymentForm.method}
                        onChange={(e) =>
                          setPaymentForm((f) => ({ ...f, method: e.target.value }))
                        }
                      >
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </SelectField>
                      <TextField
                        label="Reference"
                        value={paymentForm.reference}
                        onChange={(e) =>
                          setPaymentForm((f) => ({ ...f, reference: e.target.value }))
                        }
                        hint="Optional payment reference or receipt ID"
                      />
                      <TextField
                        label="Currency"
                        value={paymentForm.currency}
                        maxLength={3}
                        onChange={(e) =>
                          setPaymentForm((f) => ({
                            ...f,
                            currency: e.target.value.toUpperCase().slice(0, 3),
                          }))
                        }
                      />
                      <TextField
                        label="Paid at"
                        type="datetime-local"
                        value={paymentForm.paid_at}
                        onChange={(e) =>
                          setPaymentForm((f) => ({ ...f, paid_at: e.target.value }))
                        }
                        hint="Optional — defaults to now"
                      />
                      <FormActions>
                        <Button
                          size="sm"
                          type="button"
                          variant="secondary"
                          onClick={() => setShowPaymentForm(false)}
                        >
                          Cancel
                        </Button>
                        <Button size="sm" type="submit" variant="primary" disabled={recordingPayment}>
                          {recordingPayment ? 'Saving…' : 'Save payment'}
                        </Button>
                      </FormActions>
                    </form>
                  ) : null}

                  <div className="bi-links">
                    <Link to="/billing/payments">Open payments</Link>
                    <Link to="/billing/plans">Billing plans</Link>
                    <Link to="/dashboard/revenue">Revenue dashboard</Link>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="bi-detail bi-detail-empty">
              <p className="bi-empty">Select an invoice to review line items and actions.</p>
            </div>
          )}
        </aside>
      </div>

      {printInvoice ? (
        <InvoicePrintView invoice={printInvoice} onClose={() => setPrintInvoice(null)} />
      ) : null}

      <style>{invoiceStyles}</style>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`bi-pill status-${status}`}>{statusLabel(status)}</span>;
}

const invoiceStyles = `
.bi-page { display: grid; gap: 1rem; }
.bi-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(240px, 0.85fr);
  gap: 1.25rem;
  align-items: end;
  padding: 1.25rem 1.35rem;
  border-radius: 18px;
  border: 1px solid var(--stem-line);
  background:
    radial-gradient(120% 90% at 100% 0%, rgba(12, 124, 128, 0.14), transparent 55%),
    linear-gradient(145deg, #f3faf8, #eef5f2);
}
.bi-eyebrow {
  margin: 0 0 0.3rem;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--stem-teal-deep);
}
.bi-hero-title {
  margin: 0 0 0.35rem;
  font-family: var(--stem-font-display);
  font-size: clamp(1.35rem, 1.8vw, 1.55rem);
  letter-spacing: -0.03em;
}
.bi-hero-lead {
  margin: 0;
  color: var(--stem-ink-soft);
  line-height: 1.5;
  max-width: 42rem;
  font-size: var(--stem-text-base);
}
.bi-hero-actions { display: grid; gap: 0.85rem; justify-items: end; }
.bi-action-row { display: flex; flex-wrap: wrap; gap: 0.45rem; justify-content: flex-end; align-items: center; }
.bi-generate-bar {
  display: grid;
  gap: 0.55rem;
  width: min(100%, 320px);
  justify-items: stretch;
}
.bi-ghost-link {
  display: inline-flex; align-items: center; min-height: 40px; padding: 0 0.75rem;
  font-size: var(--stem-text-md); font-weight: 600; color: var(--stem-teal-deep); text-decoration: none;
}
.bi-ghost-link:hover { text-decoration: underline; }
.bi-alert {
  display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;
  padding: 0.85rem 1rem; border-radius: 12px; background: #fef3f2; color: var(--stem-danger);
  border: 1px solid #fecdca; font-size: var(--stem-text-base);
}
.bi-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(280px, 0.85fr);
  gap: 1rem;
  align-items: start;
}
.bi-table-wrap { overflow-x: auto; margin: 0 -0.15rem; }
.bi-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--stem-text-base);
}
.bi-table th {
  text-align: left;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--stem-ink-soft);
  padding: 0.55rem 0.65rem;
  border-bottom: 1px solid var(--stem-line);
  white-space: nowrap;
}
.bi-table td {
  padding: 0.7rem 0.65rem;
  border-bottom: 1px solid var(--stem-line);
  vertical-align: top;
}
.bi-table tbody tr {
  cursor: pointer;
  transition: background 0.15s ease;
}
.bi-table tbody tr:hover { background: rgba(18, 160, 171, 0.04); }
.bi-table tbody tr.is-selected { background: rgba(12, 124, 128, 0.08); }
.bi-slug { margin-top: 0.15rem; font-size: var(--stem-text-sm); color: var(--stem-ink-soft); }
.bi-slug code { font-size: var(--stem-text-sm); }
.bi-empty { text-align: center; color: var(--stem-ink-soft); padding: 1.5rem 0.75rem !important; }
.bi-side { position: sticky; top: 0.75rem; }
.bi-detail {
  display: grid;
  gap: 1rem;
  padding: 1.1rem 1.15rem;
  border-radius: 16px;
  border: 1px solid var(--stem-line);
  background: #fff;
}
.bi-detail-empty { min-height: 180px; align-content: center; justify-items: start; gap: 0.85rem; }
.bi-detail-head {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}
.bi-detail-mark {
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
.bi-detail-head h3 {
  margin: 0;
  font-size: var(--stem-text-xl);
  letter-spacing: -0.02em;
}
.bi-detail-head p {
  margin: 0.15rem 0 0;
  font-size: var(--stem-text-md);
  color: var(--stem-ink-soft);
}
.bi-meta {
  display: grid;
  gap: 0.55rem;
  margin: 0;
}
.bi-meta > div {
  display: grid;
  grid-template-columns: 7.5rem minmax(0, 1fr);
  gap: 0.5rem;
  align-items: baseline;
}
.bi-meta dt {
  margin: 0;
  font-size: var(--stem-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--stem-ink-soft);
}
.bi-meta dd { margin: 0; font-size: var(--stem-text-base); }
.bi-lines h4, .bi-notes h4 {
  margin: 0 0 0.45rem;
  font-size: var(--stem-text-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--stem-ink-soft);
}
.bi-lines table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--stem-text-sm);
}
.bi-lines th, .bi-lines td {
  padding: 0.45rem 0.35rem;
  border-bottom: 1px solid var(--stem-line);
  text-align: left;
}
.bi-lines th:nth-child(2), .bi-lines td:nth-child(2),
.bi-lines th:nth-child(3), .bi-lines td:nth-child(3) { text-align: right; }
.bi-payment-list {
  list-style: none;
  margin: 0;
  padding: 0.75rem 0 0;
  border-top: 1px solid var(--stem-line);
  display: grid;
  gap: 0.45rem;
}
.bi-payment-list-head {
  font-size: var(--stem-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--stem-ink-soft);
  font-weight: 700;
}
.bi-payment-list li {
  display: grid;
  gap: 0.1rem;
  font-size: var(--stem-text-md);
}
.bi-payment-list span { color: var(--stem-ink-soft); font-size: var(--stem-text-sm); }
.bi-notes p { margin: 0; color: var(--stem-ink-soft); font-size: var(--stem-text-base); line-height: 1.45; }
.bi-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--stem-line);
}
.bi-actions-primary { padding-top: 0.65rem; }
.bi-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  padding-top: 0.25rem;
}
.bi-links a {
  font-size: var(--stem-text-md);
  font-weight: 600;
  color: var(--stem-teal-deep);
  text-decoration: none;
}
.bi-links a:hover { text-decoration: underline; }
.bi-form { display: grid; gap: 0.85rem; padding-top: 0.35rem; border-top: 1px dashed var(--stem-line); }
.bi-pill {
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
.bi-pill.status-draft { background: #f3f4f6; color: #4b5563; }
.bi-pill.status-sent { background: #eef8f6; color: #055456; }
.bi-pill.status-paid { background: #ecfdf5; color: #047857; }
.bi-pill.status-overdue { background: #fef3f2; color: #b42318; }
.bi-pill.status-void { background: #f3f4f6; color: #6b7280; }
.bi-muted { color: var(--stem-ink-soft); font-size: var(--stem-text-base); margin: 0; }
@media (max-width: 960px) {
  .bi-hero, .bi-layout { grid-template-columns: 1fr; }
  .bi-hero-actions { justify-items: start; }
  .bi-action-row { justify-content: flex-start; }
  .bi-generate-bar { width: 100%; }
  .bi-side { position: static; }
}
`;
