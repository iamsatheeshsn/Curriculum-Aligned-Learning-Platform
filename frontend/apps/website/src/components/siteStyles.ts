export const siteStyles = `
.sw-root {
  background:
    radial-gradient(ellipse 80% 50% at 100% -10%, rgba(18,160,171,0.12), transparent 55%),
    radial-gradient(ellipse 60% 40% at 0% 100%, rgba(232,137,74,0.08), transparent 50%),
    linear-gradient(180deg, #f3faf8 0%, #eef5f2 40%, #f7fbfa 100%);
  color: var(--stem-ink);
  overflow-x: hidden;
}
.sw-main { flex: 1; min-width: 0; }
.sw-header {
  position: sticky; top: 0; z-index: 40;
  backdrop-filter: blur(14px);
  background: rgba(243, 250, 248, 0.9);
  border-bottom: 1px solid rgba(12,124,128,0.12);
}
.sw-nav {
  max-width: 1120px; margin: 0 auto; padding: 0.9rem 1.25rem;
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
}
.sw-brand { min-width: 0; text-decoration: none; }
.sw-nav-links {
  display: flex; flex-wrap: wrap; gap: 0.2rem; justify-content: center; min-width: 0;
}
.sw-nav-link {
  padding: 0.45rem 0.7rem; border-radius: 10px;
  font-size: 0.88rem; font-weight: 500; color: var(--stem-ink-soft);
  transition: background 0.15s ease, color 0.15s ease;
}
.sw-nav-link:hover { color: var(--stem-teal-deep); background: rgba(12,124,128,0.06); }
.sw-nav-link.is-active {
  color: var(--stem-teal-deep); background: rgba(12,124,128,0.12); font-weight: 600;
}
.sw-nav-actions { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
.sw-lang {
  display: inline-flex; align-items: center; justify-content: center;
  box-sizing: border-box; min-height: 40px; padding: 0.55rem 0.9rem;
  border: 1px solid rgba(12,124,128,0.22); background: #fff; border-radius: 10px;
  font: inherit; font-size: var(--stem-text-md); line-height: 1.25;
  cursor: pointer; font-weight: 600; color: var(--stem-ink-soft); white-space: nowrap;
}
.sw-footer {
  --sw-footer-ink: #e8f4f0;
  margin-top: auto;
  background: linear-gradient(160deg, #055456 0%, #0a3644 55%, #0e4a52 100%);
  color: var(--sw-footer-ink);
  padding: 3rem 1.25rem 1.5rem;
}
.sw-footer-inner {
  max-width: 1120px; margin: 0 auto;
  display: grid; grid-template-columns: 1.4fr repeat(3, minmax(0, 1fr)); gap: 2rem 1.5rem;
}
.sw-footer-brand { min-width: 0; }
.sw-footer-lead,
.sw-footer-col,
.sw-footer-col h3,
.sw-footer-col a,
.sw-footer-col p,
.sw-footer-meta,
.sw-footer-bar,
.sw-footer-bar p {
  color: var(--sw-footer-ink);
  opacity: 1;
}
.sw-footer-lead {
  margin: 0.9rem 0 0; max-width: 28rem; font-size: 0.95rem; line-height: 1.55;
}
.sw-footer-col { display: grid; gap: 0.45rem; align-content: start; min-width: 0; }
.sw-footer-col nav { display: grid; gap: 0.45rem; }
.sw-footer-col h3 {
  margin: 0 0 0.35rem; font-size: 0.78rem; letter-spacing: 0.08em; text-transform: uppercase;
  font-weight: 700;
}
.sw-footer-col a, .sw-footer-col .sw-footer-meta {
  display: block;
  color: var(--sw-footer-ink); text-decoration: none; font-size: 0.92rem;
  overflow-wrap: anywhere;
}
.sw-footer-col a:hover,
.sw-footer-col a:focus-visible {
  text-decoration: underline;
  color: #ffffff;
}
.sw-footer-col a.is-active { color: var(--sw-footer-ink); font-weight: 600; }
.sw-footer-meta { margin: 0; }
.sw-footer-bar {
  max-width: 1120px; margin: 2rem auto 0; padding-top: 1.25rem;
  border-top: 1px solid rgba(255,255,255,0.12);
  display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.5rem 1rem;
  font-size: 0.8rem;
}
.sw-footer-bar p { margin: 0; }

/* Shared page chrome */
.sw-page { padding: 0 0 4rem; min-width: 0; }
.sw-wrap { max-width: 1120px; margin: 0 auto; padding-inline: 1.25rem; min-width: 0; }
.sw-page-hero {
  padding: 2.75rem 0 2rem;
  border-bottom: 1px solid rgba(12,124,128,0.1);
  margin-bottom: 2.25rem;
  background:
    radial-gradient(90% 80% at 100% 0%, rgba(12,124,128,0.1), transparent 55%),
    linear-gradient(180deg, rgba(243,250,248,0.6), transparent);
}
.sw-eyebrow {
  margin: 0 0 0.55rem; font-size: 0.78rem; letter-spacing: 0.08em; text-transform: uppercase;
  font-weight: 700; color: var(--stem-teal-deep);
}
.sw-page-hero h1 {
  margin: 0; font-family: var(--stem-font-display);
  font-size: clamp(1.85rem, 3.5vw, 2.65rem); letter-spacing: -0.03em; line-height: 1.15;
}
.sw-page-hero p {
  margin: 0.75rem 0 0; max-width: 40rem; color: var(--stem-ink-soft);
  font-size: 1.05rem; line-height: 1.55;
}
.sw-section { margin-top: 2.5rem; }
.sw-section h2 {
  margin: 0 0 0.5rem; font-family: var(--stem-font-display);
  font-size: clamp(1.35rem, 2.2vw, 1.7rem); letter-spacing: -0.02em;
}
.sw-section-lead { margin: 0 0 1.35rem; color: var(--stem-ink-soft); max-width: 36rem; line-height: 1.5; }
.sw-feature-grid {
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.5rem 1.75rem;
}
.sw-feature {
  min-width: 0; padding: 0 0 0.25rem;
  border-top: 2px solid rgba(12,124,128,0.28); padding-top: 1rem;
}
.sw-feature h3 { margin: 0 0 0.45rem; font-size: 1.12rem; overflow-wrap: anywhere; word-break: break-word; }
.sw-feature p { margin: 0; color: var(--stem-ink-soft); font-size: 0.95rem; line-height: 1.5; overflow-wrap: anywhere; word-break: break-word; }
.sw-plan-grid {
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.15rem; align-items: stretch;
}
.sw-plan {
  min-width: 0; max-width: 100%; padding: 1.5rem 1.35rem; border-radius: 18px;
  border: 1px solid rgba(12,124,128,0.14);
  background: rgba(255,255,255,0.72);
  display: grid; gap: 0.65rem; align-content: start;
  overflow-wrap: anywhere; word-break: break-word;
}
.sw-plan.is-featured {
  background: linear-gradient(160deg, var(--stem-teal-deep) 0%, #0a3644 100%);
  color: #e8f6f3; border: none;
  box-shadow: 0 18px 40px rgba(5,84,86,0.22);
}
.sw-plan h3 { margin: 0; font-size: 1.25rem; overflow-wrap: anywhere; word-break: break-word; }
.sw-plan-price {
  margin: 0; font-family: var(--stem-font-display); font-size: 1.55rem; font-weight: 700;
  overflow-wrap: anywhere;
}
.sw-plan p { margin: 0; font-size: 0.95rem; opacity: 0.92; line-height: 1.45; overflow-wrap: anywhere; }
.sw-plan.is-featured p { opacity: 0.9; }
.sw-row-list { display: grid; gap: 0.85rem; }
.sw-row {
  display: grid; grid-template-columns: 8.5rem 1fr; gap: 1rem; align-items: baseline;
  padding: 1.05rem 0; border-bottom: 1px solid rgba(12,124,128,0.12); min-width: 0;
}
.sw-row strong { color: var(--stem-teal-deep); overflow-wrap: anywhere; }
.sw-row span { color: var(--stem-ink-soft); line-height: 1.5; overflow-wrap: anywhere; }
.sw-tutor-grid {
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.35rem;
}
.sw-tutor {
  min-width: 0; max-width: 100%; padding: 1.25rem 0 0; border-top: 2px solid rgba(12,124,128,0.22);
  overflow-wrap: anywhere; word-break: break-word;
}
.sw-tutor-mark {
  width: 48px; height: 48px; border-radius: 14px; display: grid; place-items: center;
  margin-bottom: 0.85rem; color: #fff; font-weight: 700;
  background: linear-gradient(145deg, var(--stem-teal-bright), var(--stem-teal-deep));
}
.sw-tutor h3 { margin: 0 0 0.3rem; font-size: 1.15rem; overflow-wrap: anywhere; }
.sw-tutor .focus { margin: 0 0 0.25rem; color: var(--stem-teal-deep); font-weight: 600; font-size: 0.95rem; overflow-wrap: anywhere; }
.sw-tutor .langs { margin: 0; color: var(--stem-ink-soft); font-size: 0.9rem; overflow-wrap: anywhere; }
.sw-contact-grid {
  display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr); gap: 2rem; align-items: start;
}
.sw-contact-form {
  display: grid; gap: 0.85rem; padding: 1.4rem 1.35rem; border-radius: 18px;
  border: 1px solid rgba(12,124,128,0.14); background: rgba(255,255,255,0.78);
  min-width: 0; max-width: 100%; overflow-wrap: anywhere;
}
.sw-aside { min-width: 0; }
.sw-aside h2 { margin: 0 0 0.75rem; font-size: 1.25rem; }
.sw-aside p { margin: 0 0 0.55rem; color: var(--stem-ink-soft); line-height: 1.5; }
.sw-aside ul { margin: 0.75rem 0 0; padding: 0; list-style: none; display: grid; gap: 0.45rem; }
.sw-aside a { color: var(--stem-teal-deep); font-weight: 600; overflow-wrap: anywhere; }

@media (max-width: 980px) {
  .sw-nav { flex-wrap: wrap; }
  .sw-nav-links { order: 3; width: 100%; justify-content: flex-start; }
  .sw-footer-inner { grid-template-columns: 1fr 1fr; }
  .sw-feature-grid, .sw-plan-grid, .sw-tutor-grid { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 720px) {
  .sw-footer-inner { grid-template-columns: 1fr; gap: 1.5rem; }
  .sw-feature-grid, .sw-plan-grid, .sw-tutor-grid, .sw-contact-grid { grid-template-columns: 1fr; }
  .sw-row { grid-template-columns: 1fr; gap: 0.35rem; }
}
`;
