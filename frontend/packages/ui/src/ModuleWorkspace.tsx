import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Panel } from './PortalShell';
import { Button } from './Brand';

function titleFromPath(pathname: string) {
  const last = pathname.split('/').filter(Boolean).pop() ?? 'module';
  return last
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function ModuleWorkspace({
  title,
  description,
  pathname,
  homeTo,
  extras,
}: {
  title?: string;
  description?: string;
  pathname: string;
  homeTo?: string;
  extras?: ReactNode;
}) {
  const heading = title ?? titleFromPath(pathname);

  return (
    <div className="stem-module">
      <section className="stem-module-hero stem-animate-rise">
        <p className="stem-module-eyebrow">Module workspace</p>
        <h2 className="stem-module-title">{heading}</h2>
        <p className="stem-module-lead">
          {description ??
            'This module is available in your role menu. Live data screens continue to roll out behind the same RBAC permissions.'}
        </p>
        {homeTo ? (
          <Button to={homeTo} variant="secondary" size="sm" style={{ marginTop: '0.85rem' }}>
            Back to dashboard
          </Button>
        ) : null}
      </section>

      <Panel title="Access" description="Your role can open this area based on RBAC menu permissions.">
        <ul className="stem-module-meta">
          <li>
            <span>Path</span>
            <code>{pathname}</code>
          </li>
          <li>
            <span>Status</span>
            <strong>Menu enabled</strong>
          </li>
        </ul>
        {extras}
      </Panel>

      <style>{styles}</style>
    </div>
  );
}

export function ModuleLinkGrid({
  items,
}: {
  items: { to: string; label: string; blurb?: string }[];
}) {
  if (!items.length) return null;
  return (
    <div className="stem-module-grid">
      {items.map((item) => (
        <Link key={item.to} to={item.to} className="stem-module-card">
          <strong>{item.label}</strong>
          {item.blurb ? <span>{item.blurb}</span> : null}
        </Link>
      ))}
      <style>{styles}</style>
    </div>
  );
}

const styles = `
.stem-module { display: grid; gap: 1rem; }
.stem-module-hero {
  padding: 1.25rem 1.35rem;
  border-radius: 18px;
  border: 1px solid var(--stem-line);
  background:
    radial-gradient(120% 80% at 100% 0%, rgba(20, 145, 155, 0.1), transparent 55%),
    linear-gradient(145deg, #f4faf7, #eef5f1);
}
.stem-module-eyebrow {
  margin: 0 0 0.3rem;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--stem-teal-deep);
}
.stem-module-title {
  margin: 0 0 0.35rem;
  font-size: clamp(1.35rem, 2vw, 1.7rem);
  letter-spacing: -0.03em;
}
.stem-module-lead { margin: 0; color: var(--stem-ink-soft); line-height: 1.5; max-width: 40rem; }
.stem-module-meta { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.65rem; }
.stem-module-meta li { display: grid; gap: 0.15rem; }
.stem-module-meta span { font-size: var(--stem-text-xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--stem-ink-soft); }
.stem-module-meta code { font-size: var(--stem-text-md); }
.stem-module-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
  gap: 0.75rem;
  margin-top: 0.75rem;
}
@media (min-width: 520px) {
  .stem-module-grid {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  }
}
.stem-module-card {
  display: grid; gap: 0.3rem;
  padding: 0.9rem 1rem;
  border-radius: 12px;
  border: 1px solid var(--stem-line);
  text-decoration: none;
  color: inherit;
  background: #fff;
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.stem-module-card:hover { border-color: rgba(46,125,98,0.35); }
.stem-module-card strong,
.stem-module-card span {
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.stem-module-card span { font-size: var(--stem-text-md); color: var(--stem-ink-soft); }
`;
