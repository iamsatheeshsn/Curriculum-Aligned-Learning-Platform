/**
 * Shared printable / “Export PDF” helpers for all Stemora portals.
 * Uses a hidden iframe (no blank popup tabs) and a print-ready HTML shell.
 */

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function downloadExcelCsv(filename: string, headers: string[], rows: unknown[][]) {
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.map(escape).join(','), ...rows.map((row) => row.map(escape).join(','))];
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function kpiHtml(items: { label: string; value: string | number }[]) {
  return `<div class="stem-print-kpi">${items
    .map(
      (i) =>
        `<div><span>${escapeHtml(i.label)}</span><strong>${escapeHtml(String(i.value))}</strong></div>`,
    )
    .join('')}</div>`;
}

export function tableHtml(headers: string[], rows: unknown[][]) {
  const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const body = rows
    .map(
      (row) =>
        `<tr>${row.map((c) => `<td>${escapeHtml(c == null ? '' : String(c))}</td>`).join('')}</tr>`,
    )
    .join('');
  return `<table class="stem-print-table"><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${Math.max(headers.length, 1)}">No data</td></tr>`}</tbody></table>`;
}

const PRINT_STYLES = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #e8eef0;
    color: #0a1f2b;
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    font-size: 14px;
    line-height: 1.45;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .stem-print-page {
    max-width: 920px;
    margin: 24px auto;
    padding: 0 16px 32px;
  }
  .stem-print-sheet {
    background: #fff;
    border: 1px solid #d5e0da;
    border-radius: 16px;
    box-shadow: 0 12px 32px rgba(10, 31, 43, 0.08);
    overflow: hidden;
  }
  .stem-print-banner {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 1rem;
    padding: 1.35rem 1.6rem 1.15rem;
    background: linear-gradient(135deg, #055456 0%, #0c7c80 55%, #12a0ab 100%);
    color: #fff;
  }
  .stem-print-brand {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .stem-print-mark {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    background: rgba(255,255,255,0.18);
    border: 1px solid rgba(255,255,255,0.28);
    font-weight: 700;
    font-size: 1rem;
  }
  .stem-print-brand-name {
    font-family: Georgia, "Times New Roman", serif;
    font-size: var(--stem-text-2xl);
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .stem-print-brand-sub {
    margin: 0.1rem 0 0;
    font-size: var(--stem-text-sm);
    opacity: 0.88;
  }
  .stem-print-doc-type {
    text-align: right;
    font-size: var(--stem-text-xs);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.85;
  }
  .stem-print-body { padding: 1.35rem 1.6rem 1.5rem; }
  .stem-print-title {
    margin: 0 0 0.35rem;
    font-family: Georgia, "Times New Roman", serif;
    font-size: var(--stem-text-2xl);
    letter-spacing: -0.02em;
    color: #0a1f2b;
  }
  .stem-print-meta {
    margin: 0 0 1.15rem;
    color: #4a6574;
    font-size: var(--stem-text-md);
  }
  .stem-print-body h2 {
    margin: 1.25rem 0 0.45rem;
    font-size: 1rem;
    color: #055456;
    letter-spacing: -0.01em;
  }
  .stem-print-kpi,
  .kpi {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 0.65rem;
    margin: 0.85rem 0 1.15rem;
  }
  .stem-print-kpi > div,
  .kpi > div {
    border: 1px solid #d5e0da;
    border-radius: 12px;
    padding: 0.7rem 0.8rem;
    background: linear-gradient(180deg, #f7fbf8, #eef6f1);
  }
  .stem-print-kpi span,
  .kpi span {
    display: block;
    font-size: var(--stem-text-xs);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #5a6b63;
    font-weight: 650;
  }
  .stem-print-kpi strong,
  .kpi strong {
    display: block;
    margin-top: 0.2rem;
    font-size: 1.15rem;
    color: #0a1f2b;
  }
  .stem-print-table,
  .stem-print-body > table,
  .stem-print-body table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--stem-text-md);
    margin: 0.55rem 0 1.15rem;
  }
  .stem-print-table th,
  .stem-print-table td,
  .stem-print-body table th,
  .stem-print-body table td {
    border: 1px solid #d5e0da;
    padding: 0.5rem 0.6rem;
    text-align: left;
    vertical-align: top;
  }
  .stem-print-table th,
  .stem-print-body table th {
    background: #eef6f1;
    color: #055456;
    font-weight: 650;
    font-size: var(--stem-text-xs);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .stem-print-table tbody tr:nth-child(even) td,
  .stem-print-body table tbody tr:nth-child(even) td { background: #fafcfb; }
  .stem-print-footer {
    margin-top: 1.5rem;
    padding-top: 0.85rem;
    border-top: 1px dashed #c5d4cc;
    color: #4a6574;
    font-size: var(--stem-text-sm);
  }
  .stem-print-footer p { margin: 0.15rem 0; }
  .stem-print-hint {
    margin: 16px auto 0;
    max-width: 920px;
    padding: 0 16px;
    color: #4a6574;
    font-size: var(--stem-text-md);
    text-align: center;
  }
  @page { margin: 12mm; size: auto; }
  @media print {
    html, body { background: #fff !important; }
    .stem-print-page { margin: 0; padding: 0; max-width: none; }
    .stem-print-sheet {
      border: none;
      border-radius: 0;
      box-shadow: none;
    }
    .stem-print-hint { display: none !important; }
    .stem-print-banner {
      background: #055456 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .stem-print-table th,
    .stem-print-kpi > div {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
`;

export type PrintDocumentOptions = {
  title: string;
  subtitle?: string;
  generatedAt?: string;
  bodyHtml: string;
  documentLabel?: string;
  /** When true, open a preview tab instead of silently printing via iframe. */
  preview?: boolean;
};

export function buildPrintDocumentHtml(opts: PrintDocumentOptions): string {
  const when = opts.generatedAt ?? new Date().toLocaleString();
  const subtitle = opts.subtitle?.trim() ?? '';
  const label = opts.documentLabel ?? 'Report';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(opts.title)}</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>
  <div class="stem-print-page">
    <article class="stem-print-sheet">
      <header class="stem-print-banner">
        <div class="stem-print-brand">
          <span class="stem-print-mark" aria-hidden="true">S</span>
          <div>
            <div class="stem-print-brand-name">Stemora</div>
            <p class="stem-print-brand-sub">Learning &amp; tutoring platform</p>
          </div>
        </div>
        <div class="stem-print-doc-type">${escapeHtml(label)}</div>
      </header>
      <div class="stem-print-body">
        <h1 class="stem-print-title">${escapeHtml(opts.title)}</h1>
        <p class="stem-print-meta">${escapeHtml(subtitle)}${subtitle ? ' · ' : ''}Generated ${escapeHtml(when)}</p>
        ${opts.bodyHtml}
        <footer class="stem-print-footer">
          <p>Stemora Control &amp; Institution reports · Confidential</p>
          <p>Use your browser print dialog and choose “Save as PDF” to download.</p>
        </footer>
      </div>
    </article>
  </div>
  <p class="stem-print-hint">If the print dialog did not open, use your browser’s Print command (Ctrl/Cmd+P).</p>
</body>
</html>`;
}

/**
 * Opens a professional printable document and triggers the browser print dialog
 * (user can choose “Save as PDF”). Avoids blank tabs from noopener + document.write.
 */
export function exportPdfDocument(opts: PrintDocumentOptions): void {
  const html = buildPrintDocumentHtml(opts);
  printHtmlDocument(html, { preview: opts.preview });
}

/**
 * Print arbitrary HTML (e.g. invoice sheet) via a reliable iframe pipeline.
 */
export function printHtmlDocument(
  html: string,
  options?: { preview?: boolean; autoPrint?: boolean },
): void {
  const autoPrint = options?.autoPrint !== false;

  if (options?.preview) {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
      URL.revokeObjectURL(url);
      throw new Error('Pop-up blocked. Allow pop-ups to export or print this document.');
    }
    const revoke = () => URL.revokeObjectURL(url);
    win.addEventListener('beforeunload', revoke);
    setTimeout(revoke, 120_000);
    if (autoPrint) {
      const tryPrint = () => {
        try {
          win.focus();
          win.print();
        } catch {
          /* ignore */
        }
      };
      // Blob documents fire load asynchronously.
      setTimeout(tryPrint, 400);
    }
    return;
  }

  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'Stemora print document');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    // Last-resort fallback: blob preview tab.
    printHtmlDocument(html, { preview: true, autoPrint });
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    setTimeout(() => iframe.remove(), 800);
  };

  win.addEventListener('afterprint', cleanup);

  const trigger = () => {
    try {
      win.focus();
      if (autoPrint) win.print();
    } catch {
      cleanup();
      printHtmlDocument(html, { preview: true, autoPrint });
      return;
    }
    // Safety cleanup if afterprint never fires (some browsers).
    setTimeout(cleanup, 60_000);
  };

  if (doc.readyState === 'complete') {
    setTimeout(trigger, 200);
  } else {
    win.addEventListener('load', () => setTimeout(trigger, 200), { once: true });
    setTimeout(trigger, 600);
  }
}
