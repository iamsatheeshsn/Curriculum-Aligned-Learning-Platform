/** Stemora teal list+detail page styles (CountriesPage pattern) with a CSS prefix per page. */
export function schoolOpsPageStyles(prefix: string): string {
  const p = prefix;
  return `
.${p}page { display: grid; gap: 1rem; }
.${p}hero {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem 1.25rem;
  padding: 1.2rem 1.35rem;
  border-radius: 18px;
  border: 1px solid var(--stem-line);
  background:
    radial-gradient(120% 90% at 100% 0%, rgba(12, 124, 128, 0.14), transparent 55%),
    linear-gradient(145deg, #f3faf8, #eef5f2);
}
.${p}eyebrow {
  margin: 0 0 0.35rem;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--stem-teal-deep);
}
.${p}hero-title {
  margin: 0 0 0.35rem;
  font-family: var(--stem-font-display);
  font-size: clamp(1.2rem, 1.6vw, 1.4rem);
  letter-spacing: -0.03em;
}
.${p}hero-lead {
  margin: 0;
  color: var(--stem-ink-soft);
  line-height: 1.5;
  max-width: 40rem;
  font-size: var(--stem-text-base);
}
.${p}hero-copy { flex: 1 1 16rem; min-width: 0; }
.${p}hero-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-end;
  flex: 0 1 auto;
  margin-left: auto;
}
.${p}action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-end;
  align-items: center;
}
.${p}action-row > .stem-btn,
.${p}action-row > a.stem-btn {
  flex: 0 0 auto;
  align-self: center;
}
.${p}ghost-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-height: 40px;
  padding: 0.55rem 0.9rem;
  border-radius: 10px;
  border: 1px solid rgba(12, 124, 128, 0.22);
  background: #fff;
  font-size: var(--stem-text-md);
  line-height: 1.25;
  font-weight: 600;
  color: var(--stem-teal-deep);
  text-decoration: none;
  white-space: nowrap;
}
.${p}ghost-link:hover {
  background: rgba(12, 124, 128, 0.06);
  border-color: rgba(12, 124, 128, 0.35);
}
.${p}alert {
  display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;
  padding: 0.85rem 1rem; border-radius: 12px; background: #fef3f2; color: var(--stem-danger);
  border: 1px solid #fecdca; font-size: var(--stem-text-base);
}
.${p}layout {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(260px, 0.85fr);
  gap: 1rem;
  align-items: start;
}
.${p}table-wrap {
  overflow-x: auto;
  margin: 0 -0.15rem;
  max-width: 100%;
  -webkit-overflow-scrolling: touch;
}
.${p}table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--stem-text-base);
  table-layout: fixed;
}
.${p}table th {
  text-align: left;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--stem-ink-soft);
  padding: 0.55rem 0.65rem;
  border-bottom: 1px solid var(--stem-line);
  white-space: nowrap;
}
.${p}table td {
  padding: 0.7rem 0.65rem;
  border-bottom: 1px solid var(--stem-line);
  vertical-align: top;
  overflow-wrap: anywhere;
  word-break: break-word;
  min-width: 0;
}
.${p}table tbody tr {
  cursor: pointer;
  transition: background 0.15s ease;
}
.${p}table tbody tr:hover { background: rgba(18, 160, 171, 0.04); }
.${p}table tbody tr.is-selected { background: rgba(12, 124, 128, 0.08); }
.${p}table td strong {
  display: block;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.${p}slug {
  margin-top: 0.15rem;
  font-size: var(--stem-text-sm);
  color: var(--stem-ink-soft);
  overflow-wrap: anywhere;
  word-break: break-word;
}
.${p}slug code { font-size: var(--stem-text-sm); word-break: break-all; }
.${p}chip {
  display: inline-flex;
  align-items: center;
  padding: 0.12rem 0.45rem;
  border-radius: 999px;
  font-size: var(--stem-text-xs);
  font-weight: 700;
  background: rgba(12, 124, 128, 0.12);
  color: var(--stem-teal-deep);
}
.${p}chip.soft { background: #eef5f2; color: #055456; }
.${p}check-row {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  font-size: var(--stem-text-md);
}
.${p}check-row label { display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer; }
.${p}empty { text-align: center; color: var(--stem-ink-soft); padding: 1.5rem 0.75rem !important; }
.${p}side { position: sticky; top: 0.75rem; min-width: 0; max-width: 100%; }
.${p}detail {
  display: grid;
  gap: 1rem;
  padding: 1.1rem 1.15rem;
  border-radius: 16px;
  border: 1px solid var(--stem-line);
  background: #fff;
  min-width: 0;
  overflow: hidden;
}
.${p}detail-empty { min-height: 180px; align-content: center; justify-items: start; gap: 0.85rem; }
.${p}detail-head {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  min-width: 0;
}
.${p}detail-mark {
  flex: 0 0 auto;
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
.${p}detail-head > div { min-width: 0; flex: 1; }
.${p}detail-head h3 {
  margin: 0;
  font-size: var(--stem-text-xl);
  letter-spacing: -0.02em;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.${p}detail-head p {
  margin: 0.15rem 0 0;
  font-size: var(--stem-text-md);
  color: var(--stem-ink-soft);
  overflow-wrap: anywhere;
  word-break: break-word;
}
.${p}meta {
  display: grid;
  gap: 0.55rem;
  margin: 0;
}
.${p}meta > div {
  display: grid;
  grid-template-columns: 7.5rem minmax(0, 1fr);
  gap: 0.5rem;
  align-items: baseline;
}
.${p}meta dt {
  margin: 0;
  font-size: var(--stem-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--stem-ink-soft);
}
.${p}meta dd {
  margin: 0;
  font-size: var(--stem-text-base);
  overflow-wrap: anywhere;
  word-break: break-word;
  min-width: 0;
}
.${p}link-list {
  list-style: none;
  margin: 0;
  padding: 0.75rem 0 0;
  border-top: 1px solid var(--stem-line);
  display: grid;
  gap: 0.45rem;
}
.${p}link-list li {
  display: grid;
  gap: 0.1rem;
  font-size: var(--stem-text-md);
}
.${p}link-list span { color: var(--stem-ink-soft); font-size: var(--stem-text-sm); }
.${p}actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--stem-line);
}
.${p}links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--stem-line);
}
.${p}links a {
  font-size: var(--stem-text-md);
  font-weight: 600;
  color: var(--stem-teal-deep);
  text-decoration: none;
}
.${p}links a:hover { text-decoration: underline; }
.${p}links .${p}ghost-link {
  text-decoration: none;
}
.${p}links .${p}ghost-link:hover {
  text-decoration: none;
}
.${p}form { display: grid; gap: 0.85rem; }
.${p}pill {
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
.${p}pill.status-active { background: #ecfdf5; color: #047857; }
.${p}pill.status-pending { background: #fffbeb; color: #b45309; }
.${p}pill.status-transfer { background: #eff6ff; color: #1d4ed8; }
.${p}pill.status-rejected { background: #fef3f2; color: #b42318; }
.${p}pill.status-alumni,
.${p}pill.status-completed,
.${p}pill.status-withdrawn { background: #f3f4f6; color: #4b5563; }
.${p}pill.status-inactive { background: #f3f4f6; color: #4b5563; }
.${p}pill.status-archived { background: #fef3c7; color: #92400e; }
.${p}pill.status-suspended { background: #fef3f2; color: #b42318; }
.${p}pill.status-draft { background: #f3f4f6; color: #4b5563; }
.${p}pill.status-published { background: #ecfdf5; color: #047857; }
.${p}pill.status-closed { background: #f3f4f6; color: #4b5563; }
.${p}pill.status-present { background: #ecfdf5; color: #047857; }
.${p}pill.status-absent { background: #fef3f2; color: #b42318; }
.${p}pill.status-late { background: #fffbeb; color: #b45309; }
.${p}pill.status-leave { background: #eff6ff; color: #1d4ed8; }
.${p}pill.status-scheduled { background: #eff6ff; color: #1d4ed8; }
.${p}pill.status-paid { background: #ecfdf5; color: #047857; }
.${p}pill.status-issued { background: #eff6ff; color: #1d4ed8; }
.${p}pill.status-overdue { background: #fef3f2; color: #b42318; }
.${p}pill.status-void,
.${p}pill.status-cancelled { background: #f3f4f6; color: #4b5563; }
.${p}pill.status-sent { background: #ecfdf5; color: #047857; }
.${p}filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  align-items: end;
  width: 100%;
}
.${p}filter-submit {
  display: flex;
  align-items: end;
  padding-bottom: 0.1rem;
  min-height: 2.5rem;
}
.${p}check {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: var(--stem-text-md);
  cursor: pointer;
}
.${p}empty-side {
  padding: 1.25rem 1.15rem;
  border-radius: 16px;
  border: 1px dashed var(--stem-line);
  color: var(--stem-ink-soft);
  background: #f8fbfa;
  min-height: 140px;
  display: grid;
  align-content: center;
}
.${p}muted { color: var(--stem-ink-soft); font-size: var(--stem-text-base); margin: 0; }
@media (max-width: 960px) {
  .${p}layout { grid-template-columns: 1fr; }
  .${p}hero-actions { align-items: flex-start; margin-left: 0; width: 100%; }
  .${p}action-row { justify-content: flex-start; }
  .${p}side { position: static; }
}
`;
}
