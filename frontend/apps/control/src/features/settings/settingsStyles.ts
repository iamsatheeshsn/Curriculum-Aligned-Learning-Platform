export const psStyles = `
.ps-page { display: grid; gap: 1rem; }
.ps-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(220px, 0.85fr);
  gap: 1.25rem;
  align-items: end;
  padding: 1.25rem 1.35rem;
  border-radius: 18px;
  border: 1px solid var(--stem-line);
  background:
    radial-gradient(120% 90% at 100% 0%, rgba(18, 160, 171, 0.12), transparent 55%),
    linear-gradient(145deg, #f4faf8, #eef5f2);
}
.ps-eyebrow {
  margin: 0 0 0.3rem;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--stem-teal-deep);
}
.ps-hero-title {
  margin: 0 0 0.35rem;
  font-family: var(--stem-font-display);
  font-size: clamp(1.35rem, 1.8vw, 1.55rem);
  letter-spacing: -0.03em;
}
.ps-hero-lead {
  margin: 0;
  color: var(--stem-ink-soft);
  line-height: 1.5;
  max-width: 42rem;
  font-size: var(--stem-text-base);
}
.ps-hero-meta {
  margin: 0.75rem 0 0;
  font-size: var(--stem-text-sm);
  color: var(--stem-ink-soft);
}
.ps-hero-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  justify-content: flex-end;
}
.ps-nav-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  border: 1px solid var(--stem-line);
  background: #fff;
  color: var(--stem-teal-deep);
  font-size: var(--stem-text-sm);
  font-weight: 600;
  text-decoration: none;
  transition: border-color 0.15s, background 0.15s;
}
.ps-nav-pill:hover {
  border-color: rgba(18, 160, 171, 0.35);
  background: var(--stem-mint-soft);
}
.ps-nav-pill.is-active {
  background: var(--stem-teal);
  border-color: var(--stem-teal);
  color: #fff;
}
.ps-alert {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1rem;
  border-radius: 12px;
  background: #fef3f2;
  color: var(--stem-danger);
  border: 1px solid #fecdca;
}
.ps-muted { margin: 0; color: var(--stem-ink-soft); }
.ps-form {
  display: grid;
  gap: 0.85rem;
}
.ps-form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.85rem;
}
.ps-fieldset {
  margin: 0;
  padding: 0.85rem 0.95rem;
  border: 1px solid var(--stem-line);
  border-radius: 14px;
  background: linear-gradient(165deg, #fff, var(--stem-mint-soft));
}
.ps-fieldset legend {
  padding: 0 0.35rem;
  font-size: var(--stem-text-sm);
  font-weight: 700;
  color: var(--stem-ink);
}
.ps-check {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: var(--stem-text-base);
  color: var(--stem-ink);
  cursor: pointer;
  user-select: none;
}
.ps-check input {
  width: 1rem;
  height: 1rem;
  accent-color: var(--stem-teal);
}
.ps-check-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem 1.25rem;
}
.ps-color-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.65rem;
  align-items: end;
}
.ps-color-swatch {
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid var(--stem-line);
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
}
.ps-color-swatch::-webkit-color-swatch-wrapper { padding: 4px; }
.ps-color-swatch::-webkit-color-swatch {
  border: none;
  border-radius: 8px;
}
.ps-brand-preview {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.85rem 0.95rem;
  border-radius: 14px;
  border: 1px solid var(--stem-line);
  background: #fff;
}
.ps-brand-preview-swatch {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  border: 1px solid var(--stem-line);
}
.ps-brand-preview-copy {
  display: grid;
  gap: 0.15rem;
  font-size: var(--stem-text-sm);
  color: var(--stem-ink-soft);
}
.ps-brand-preview-copy strong {
  font-size: var(--stem-text-base);
  color: var(--stem-ink);
}
.ps-readonly-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.65rem;
}
.ps-readonly-card {
  display: grid;
  gap: 0.2rem;
  padding: 0.75rem 0.8rem;
  border-radius: 12px;
  border: 1px solid var(--stem-line);
  background: #fff;
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
}
.ps-readonly-card span {
  font-size: var(--stem-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--stem-ink-soft);
  overflow-wrap: anywhere;
}
.ps-readonly-card strong {
  font-size: var(--stem-text-base);
  word-break: break-word;
  overflow-wrap: anywhere;
  min-width: 0;
}
.ps-status-pill {
  display: inline-flex;
  padding: 0.18rem 0.55rem;
  border-radius: 999px;
  font-size: var(--stem-text-xs);
  font-weight: 700;
  border: 1px solid transparent;
  text-transform: capitalize;
}
.ps-status-pill.is-completed {
  background: #ecfdf3;
  color: #067647;
  border-color: #abefc6;
}
.ps-status-pill.is-failed {
  background: #fef3f2;
  color: #b42318;
  border-color: #fecdca;
}
.ps-status-pill.is-neutral {
  background: var(--stem-mint-soft);
  color: var(--stem-ink-soft);
  border-color: var(--stem-line);
}
.ps-backup-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  align-items: center;
  justify-content: space-between;
  padding-top: 0.5rem;
  border-top: 1px solid var(--stem-line);
  margin-top: 0.35rem;
}
.ps-quick-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-top: 0.85rem;
  padding-top: 0.85rem;
  border-top: 1px solid var(--stem-line);
}
.ps-quick-links a {
  color: var(--stem-teal-deep);
  font-weight: 600;
  font-size: var(--stem-text-md);
  text-decoration: none;
}
.ps-quick-links a:hover { text-decoration: underline; }
@media (max-width: 960px) {
  .ps-hero { grid-template-columns: 1fr; }
  .ps-hero-nav { justify-content: flex-start; }
}
`;
