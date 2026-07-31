import { printHtmlDocument } from '@stemora/ui';
import type { BillingContact } from '../../types';
import { statusLabel } from '../../types';

export type PrintableInvoice = {
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
  items: {
    id?: number;
    description: string;
    quantity: number | string;
    unit_price: number | string;
    line_total: number | string;
  }[];
  tenant: {
    id: number;
    name: string;
    legal_name?: string | null;
    slug: string;
  };
  billing_contact?: BillingContact;
  payments?: {
    id: number;
    amount: number | string;
    currency: string;
    method?: string | null;
    reference?: string | null;
    paid_at?: string | null;
  }[];
};

function money(currency: string, value: number | string) {
  const n = typeof value === 'string' ? Number(value) : value;
  return `${currency} ${Number.isFinite(n) ? n.toFixed(2) : value}`;
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

const INVOICE_PRINT_CSS = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #e8eef0;
    color: #0a1f2b;
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .inv-wrap { max-width: 860px; margin: 24px auto; padding: 0 16px 32px; }
  .inv-sheet {
    background: #fff;
    border-radius: 18px;
    border: 1px solid #d5e0da;
    box-shadow: 0 12px 32px rgba(10, 31, 43, 0.08);
    padding: 2rem 2.1rem 1.75rem;
  }
  .inv-sheet-header {
    display: flex;
    justify-content: space-between;
    gap: 1.5rem;
    padding-bottom: 1.25rem;
    border-bottom: 3px solid #0c7c80;
    margin-bottom: 1.5rem;
  }
  .inv-brand {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 1.85rem;
    font-weight: 700;
    color: #055456;
  }
  .inv-brand-sub { margin: 0.25rem 0 0; color: #4a6574; font-size: var(--stem-text-base); }
  .inv-sheet-meta { text-align: right; }
  .inv-sheet-meta h1 { margin: 0; font-size: 1.8rem; letter-spacing: -0.02em; }
  .inv-sheet-meta p { margin: 0.25rem 0 0; }
  .inv-status { color: #0c7c80; font-weight: 700; font-size: var(--stem-text-base); }
  .inv-parties {
    display: grid;
    grid-template-columns: 1.2fr 0.8fr;
    gap: 1.5rem;
    margin-bottom: 1.5rem;
  }
  .inv-parties h2 {
    margin: 0 0 0.45rem;
    font-size: var(--stem-text-sm);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #4a6574;
  }
  .inv-parties p { margin: 0.15rem 0; font-size: var(--stem-text-base); }
  .inv-party-name { font-weight: 700; font-size: var(--stem-text-xl) !important; }
  .inv-muted { color: #4a6574; }
  .inv-dates {
    display: grid;
    gap: 0.65rem;
    align-content: start;
    padding: 0.85rem 1rem;
    border-radius: 12px;
    background: #eef8f6;
    border: 1px solid rgba(10, 31, 43, 0.08);
  }
  .inv-dates > div {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    font-size: var(--stem-text-base);
  }
  .inv-dates span { color: #4a6574; }
  .inv-lines {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1.25rem;
    font-size: var(--stem-text-base);
  }
  .inv-lines th {
    text-align: left;
    padding: 0.7rem 0.55rem;
    border-bottom: 2px solid rgba(10, 31, 43, 0.12);
    font-size: var(--stem-text-xs);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #4a6574;
  }
  .inv-lines td {
    padding: 0.8rem 0.55rem;
    border-bottom: 1px solid rgba(10, 31, 43, 0.08);
    vertical-align: top;
  }
  .inv-lines th:nth-child(2),
  .inv-lines td:nth-child(2),
  .inv-lines th:nth-child(3),
  .inv-lines td:nth-child(3),
  .inv-lines th:nth-child(4),
  .inv-lines td:nth-child(4) {
    text-align: right;
    white-space: nowrap;
  }
  .inv-totals {
    margin-left: auto;
    width: min(280px, 100%);
    display: grid;
    gap: 0.45rem;
  }
  .inv-totals > div {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    font-size: var(--stem-text-base);
  }
  .inv-total-row {
    margin-top: 0.35rem;
    padding-top: 0.55rem;
    border-top: 2px solid #0c7c80;
    font-size: 1.1rem !important;
  }
  .inv-notes {
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(10, 31, 43, 0.08);
  }
  .inv-notes h2 {
    margin: 0 0 0.4rem;
    font-size: var(--stem-text-md);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #4a6574;
  }
  .inv-notes p, .inv-notes li {
    margin: 0.2rem 0;
    color: #4a6574;
    font-size: var(--stem-text-base);
  }
  .inv-notes ul { margin: 0; padding-left: 1.1rem; }
  .inv-footer {
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px dashed rgba(10, 31, 43, 0.15);
    color: #4a6574;
    font-size: var(--stem-text-md);
  }
  .inv-footer p { margin: 0.2rem 0; }
  @page { margin: 12mm; }
  @media print {
    html, body { background: #fff !important; }
    .inv-wrap { margin: 0; padding: 0; max-width: none; }
    .inv-sheet { border: none; border-radius: 0; box-shadow: none; padding: 0; }
    .inv-dates { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

function buildInvoicePrintHtml(invoice: PrintableInvoice): string {
  const contact = invoice.billing_contact;
  const contactName =
    [contact?.first_name, contact?.last_name].filter(Boolean).join(' ') || 'Billing contact';
  const items = invoice.items?.length
    ? invoice.items
    : [{ description: 'No line items', quantity: 0, unit_price: 0, line_total: 0 }];

  const itemRows = items
    .map(
      (item) => `<tr>
        <td>${escape(item.description)}</td>
        <td>${escape(item.quantity)}</td>
        <td>${escape(money(invoice.currency, item.unit_price))}</td>
        <td>${escape(money(invoice.currency, item.line_total))}</td>
      </tr>`,
    )
    .join('');

  const payments =
    (invoice.payments?.length ?? 0) > 0
      ? `<div class="inv-notes"><h2>Payments</h2><ul>${invoice
          .payments!.map((p) => {
            const bits = [
              money(p.currency || invoice.currency, p.amount),
              p.method || null,
              p.reference ? `Ref ${p.reference}` : null,
              p.paid_at ? fmtDate(p.paid_at) : null,
            ].filter(Boolean);
            return `<li>${escape(bits.join(' · '))}</li>`;
          })
          .join('')}</ul></div>`
      : '';

  const notes = invoice.notes
    ? `<div class="inv-notes"><h2>Notes</h2><p>${escape(invoice.notes)}</p></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Invoice ${escape(invoice.number)}</title>
  <style>${INVOICE_PRINT_CSS}</style>
</head>
<body>
  <div class="inv-wrap">
    <article class="inv-sheet">
      <header class="inv-sheet-header">
        <div>
          <div class="inv-brand">Stemora</div>
          <p class="inv-brand-sub">Learning &amp; tutoring platform</p>
        </div>
        <div class="inv-sheet-meta">
          <h1>Invoice</h1>
          <p><strong>${escape(invoice.number)}</strong></p>
          <p class="inv-status">Status · ${escape(statusLabel(invoice.status))}</p>
        </div>
      </header>
      <div class="inv-parties">
        <div>
          <h2>Bill to</h2>
          <p class="inv-party-name">${escape(invoice.tenant.legal_name || invoice.tenant.name)}</p>
          <p>${escape(invoice.tenant.name)}</p>
          <p class="inv-muted">Tenant · ${escape(invoice.tenant.slug)}</p>
          ${
            contact
              ? `<p>${escape(contactName)}</p>
                 ${contact.email ? `<p>${escape(contact.email)}</p>` : ''}
                 ${contact.phone ? `<p>${escape(contact.phone)}</p>` : ''}`
              : ''
          }
        </div>
        <div class="inv-dates">
          <div><span>Issued</span><strong>${escape(fmtDate(invoice.issued_at))}</strong></div>
          <div><span>Due</span><strong>${escape(fmtDate(invoice.due_at))}</strong></div>
          <div><span>Paid</span><strong>${escape(fmtDate(invoice.paid_at))}</strong></div>
        </div>
      </div>
      <table class="inv-lines">
        <thead>
          <tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div class="inv-totals">
        <div><span>Subtotal</span><strong>${escape(money(invoice.currency, invoice.subtotal))}</strong></div>
        <div><span>Tax</span><strong>${escape(money(invoice.currency, invoice.tax_total))}</strong></div>
        <div class="inv-total-row"><span>Total</span><strong>${escape(money(invoice.currency, invoice.total))}</strong></div>
      </div>
      ${notes}
      ${payments}
      <footer class="inv-footer">
        <p>Thank you for partnering with Stemora.</p>
        <p>Generated from the Control portal · ${escape(new Date().toLocaleString())}</p>
      </footer>
    </article>
  </div>
</body>
</html>`;
}

function escape(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function InvoicePrintView({
  invoice,
  onClose,
}: {
  invoice: PrintableInvoice;
  onClose: () => void;
}) {
  const contact = invoice.billing_contact;
  const contactName =
    [contact?.first_name, contact?.last_name].filter(Boolean).join(' ') || 'Billing contact';

  function handlePrint() {
    printHtmlDocument(buildInvoicePrintHtml(invoice));
  }

  function handleDownloadPdf() {
    printHtmlDocument(buildInvoicePrintHtml(invoice), { preview: true });
  }

  return (
    <div className="inv-print-root" role="dialog" aria-modal="true" aria-label={`Invoice ${invoice.number}`}>
      <div className="inv-print-toolbar no-print">
        <div>
          <strong>Invoice {invoice.number}</strong>
          <span> · Preview · Print or save as PDF</span>
        </div>
        <div className="inv-print-toolbar-actions">
          <button type="button" className="inv-btn inv-btn-primary" onClick={handlePrint}>
            Print
          </button>
          <button type="button" className="inv-btn inv-btn-secondary" onClick={handleDownloadPdf}>
            Download PDF
          </button>
          <button type="button" className="inv-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <div className="inv-sheet" id="stemora-invoice-print">
        <header className="inv-sheet-header">
          <div>
            <div className="inv-brand">Stemora</div>
            <p className="inv-brand-sub">Learning & tutoring platform</p>
          </div>
          <div className="inv-sheet-meta">
            <h1>Invoice</h1>
            <p>
              <strong>{invoice.number}</strong>
            </p>
            <p className="inv-status">Status · {statusLabel(invoice.status)}</p>
          </div>
        </header>

        <div className="inv-parties">
          <div>
            <h2>Bill to</h2>
            <p className="inv-party-name">{invoice.tenant.legal_name || invoice.tenant.name}</p>
            <p>{invoice.tenant.name}</p>
            <p className="inv-muted">Tenant · {invoice.tenant.slug}</p>
            {contact ? (
              <>
                <p>{contactName}</p>
                {contact.email ? <p>{contact.email}</p> : null}
                {contact.phone ? <p>{contact.phone}</p> : null}
              </>
            ) : null}
          </div>
          <div className="inv-dates">
            <div>
              <span>Issued</span>
              <strong>{fmtDate(invoice.issued_at)}</strong>
            </div>
            <div>
              <span>Due</span>
              <strong>{fmtDate(invoice.due_at)}</strong>
            </div>
            <div>
              <span>Paid</span>
              <strong>{fmtDate(invoice.paid_at)}</strong>
            </div>
          </div>
        </div>

        <table className="inv-lines">
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit price</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.items?.length
              ? invoice.items
              : [{ description: 'No line items', quantity: 0, unit_price: 0, line_total: 0 }]
            ).map((item, idx) => (
              <tr key={item.id ?? idx}>
                <td>{item.description}</td>
                <td>{item.quantity}</td>
                <td>{money(invoice.currency, item.unit_price)}</td>
                <td>{money(invoice.currency, item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="inv-totals">
          <div>
            <span>Subtotal</span>
            <strong>{money(invoice.currency, invoice.subtotal)}</strong>
          </div>
          <div>
            <span>Tax</span>
            <strong>{money(invoice.currency, invoice.tax_total)}</strong>
          </div>
          <div className="inv-total-row">
            <span>Total</span>
            <strong>{money(invoice.currency, invoice.total)}</strong>
          </div>
        </div>

        {invoice.notes ? (
          <div className="inv-notes">
            <h2>Notes</h2>
            <p>{invoice.notes}</p>
          </div>
        ) : null}

        {(invoice.payments?.length ?? 0) > 0 ? (
          <div className="inv-notes">
            <h2>Payments</h2>
            <ul>
              {invoice.payments!.map((p) => (
                <li key={p.id}>
                  {money(p.currency || invoice.currency, p.amount)}
                  {p.method ? ` · ${p.method}` : ''}
                  {p.reference ? ` · Ref ${p.reference}` : ''}
                  {p.paid_at ? ` · ${fmtDate(p.paid_at)}` : ''}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <footer className="inv-footer">
          <p>Thank you for partnering with Stemora.</p>
          <p>This document was generated from the Control portal · {new Date().toLocaleString()}</p>
        </footer>
      </div>

      <style>{screenStyles}</style>
    </div>
  );
}

const screenStyles = `
.inv-print-root {
  position: fixed;
  inset: 0;
  z-index: 80;
  background:
    radial-gradient(120% 80% at 100% 0%, rgba(18, 160, 171, 0.18), transparent 55%),
    rgba(10, 31, 43, 0.52);
  overflow: auto;
  padding: 1.25rem;
  backdrop-filter: blur(2px);
}
.inv-print-toolbar {
  max-width: 860px;
  margin: 0 auto 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  padding: 0.85rem 1rem;
  border-radius: 14px;
  background: #fff;
  border: 1px solid var(--stem-line);
  box-shadow: var(--stem-shadow);
}
.inv-print-toolbar span { color: var(--stem-ink-soft); font-size: var(--stem-text-base); }
.inv-print-toolbar-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.inv-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--stem-line);
  background: #fff;
  border-radius: 10px;
  padding: 0.55rem 0.9rem;
  min-height: 40px;
  box-sizing: border-box;
  font: inherit;
  font-weight: 600;
  font-size: var(--stem-text-md);
  cursor: pointer;
  color: var(--stem-teal-deep);
}
.inv-btn-primary {
  background: linear-gradient(135deg, var(--stem-teal-bright), var(--stem-teal-deep));
  color: #fff;
  border-color: transparent;
}
.inv-btn-secondary {
  background: #eef8f6;
  border-color: rgba(12, 124, 128, 0.28);
}
.inv-sheet {
  max-width: 860px;
  margin: 0 auto 2rem;
  background: #fff;
  border-radius: 18px;
  border: 1px solid var(--stem-line);
  box-shadow: var(--stem-shadow-lg);
  padding: 2rem 2.1rem 1.75rem;
  color: #0a1f2b;
}
.inv-sheet-header {
  display: flex;
  justify-content: space-between;
  gap: 1.5rem;
  padding-bottom: 1.25rem;
  border-bottom: 3px solid #0c7c80;
  margin-bottom: 1.5rem;
}
.inv-brand {
  font-family: var(--stem-font-display);
  font-size: 1.85rem;
  font-weight: 700;
  color: #055456;
}
.inv-brand-sub { margin: 0.25rem 0 0; color: #4a6574; font-size: var(--stem-text-base); }
.inv-sheet-meta { text-align: right; }
.inv-sheet-meta h1 {
  margin: 0;
  font-size: 1.8rem;
  letter-spacing: -0.02em;
}
.inv-sheet-meta p { margin: 0.25rem 0 0; }
.inv-status { color: #0c7c80; font-weight: 700; font-size: var(--stem-text-base); }
.inv-parties {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}
.inv-parties h2 {
  margin: 0 0 0.45rem;
  font-size: var(--stem-text-sm);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #4a6574;
}
.inv-parties p { margin: 0.15rem 0; font-size: var(--stem-text-base); }
.inv-party-name { font-weight: 700; font-size: var(--stem-text-xl) !important; }
.inv-muted { color: #4a6574; }
.inv-dates {
  display: grid;
  gap: 0.65rem;
  align-content: start;
  padding: 0.85rem 1rem;
  border-radius: 12px;
  background: #eef8f6;
  border: 1px solid rgba(10, 31, 43, 0.08);
}
.inv-dates > div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: var(--stem-text-base);
}
.inv-dates span { color: #4a6574; }
.inv-lines {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1.25rem;
  font-size: var(--stem-text-base);
}
.inv-lines th {
  text-align: left;
  padding: 0.7rem 0.55rem;
  border-bottom: 2px solid rgba(10, 31, 43, 0.12);
  font-size: var(--stem-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #4a6574;
}
.inv-lines td {
  padding: 0.8rem 0.55rem;
  border-bottom: 1px solid rgba(10, 31, 43, 0.08);
  vertical-align: top;
}
.inv-lines th:nth-child(2),
.inv-lines td:nth-child(2),
.inv-lines th:nth-child(3),
.inv-lines td:nth-child(3),
.inv-lines th:nth-child(4),
.inv-lines td:nth-child(4) {
  text-align: right;
  white-space: nowrap;
}
.inv-totals {
  margin-left: auto;
  width: min(280px, 100%);
  display: grid;
  gap: 0.45rem;
}
.inv-totals > div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: var(--stem-text-base);
}
.inv-total-row {
  margin-top: 0.35rem;
  padding-top: 0.55rem;
  border-top: 2px solid #0c7c80;
  font-size: 1.1rem !important;
}
.inv-notes {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(10, 31, 43, 0.08);
}
.inv-notes h2 {
  margin: 0 0 0.4rem;
  font-size: var(--stem-text-md);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #4a6574;
}
.inv-notes p, .inv-notes li {
  margin: 0.2rem 0;
  color: #4a6574;
  font-size: var(--stem-text-base);
}
.inv-notes ul { margin: 0; padding-left: 1.1rem; }
.inv-footer {
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px dashed rgba(10, 31, 43, 0.15);
  color: #4a6574;
  font-size: var(--stem-text-md);
}
.inv-footer p { margin: 0.2rem 0; }
@media (max-width: 720px) {
  .inv-parties { grid-template-columns: 1fr; }
  .inv-sheet-header { flex-direction: column; }
  .inv-sheet-meta { text-align: left; }
}
`;
