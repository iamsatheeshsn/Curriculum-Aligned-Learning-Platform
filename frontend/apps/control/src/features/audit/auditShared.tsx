import { Navigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import type { AuditRow } from './types';

export const AUDIT_PERMISSIONS = [
  'platform.tenants.manage',
  'platform.audit.view',
  'audit.logs.view',
  'nav.control.audit',
] as const;

export function AuditAccessGuard({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin, hasPermission } = useAuth();
  if (!isSuperAdmin && !hasPermission([...AUDIT_PERMISSIONS])) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export function formatWhen(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function formatAction(action: string) {
  return action
    .split('.')
    .map((part) => part.replace(/_/g, ' '))
    .join(' · ');
}

export function actorLabel(row: AuditRow) {
  if (row.actor?.name) return row.actor.name;
  if (row.actor?.email) return row.actor.email;
  if (row.actor_user_id) return `User #${row.actor_user_id}`;
  return '—';
}

export function actorSub(row: AuditRow) {
  if (row.actor?.email && row.actor?.name) return row.actor.email;
  return null;
}

export function tenantLabel(row: AuditRow) {
  if (row.tenant?.name) return row.tenant.name;
  if (row.tenant_id) return `Tenant #${row.tenant_id}`;
  return 'Platform';
}

export function tenantSub(row: AuditRow) {
  if (row.tenant?.slug) return row.tenant.slug;
  return null;
}

export function propertiesJson(value: AuditRow['properties']) {
  if (value == null) return '—';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

type AuditNav = 'activity' | 'logins' | 'logs';

const NAV_ITEMS: { key: AuditNav; to: string; label: string }[] = [
  { key: 'activity', to: '/audit/activity', label: 'Activity' },
  { key: 'logins', to: '/audit/logins', label: 'Login history' },
  { key: 'logs', to: '/audit/logs', label: 'Audit logs' },
];

export function AuditCrossLinks({
  current,
  prefix,
}: {
  current: AuditNav;
  prefix: string;
}) {
  return (
    <nav className={`${prefix}-cross-links`} aria-label="Audit sections">
      {NAV_ITEMS.map((item) =>
        item.key === current ? (
          <span key={item.key} className={`${prefix}-cross-current`} aria-current="page">
            {item.label}
          </span>
        ) : (
          <Link key={item.key} to={item.to} className={`${prefix}-ghost-link`}>
            {item.label}
          </Link>
        ),
      )}
    </nav>
  );
}

export function auditPageStyles(prefix: string) {
  return `
.${prefix}-page { display: grid; gap: 1rem; }
.${prefix}-hero {
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
.${prefix}-eyebrow {
  margin: 0 0 0.3rem;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--stem-teal-deep);
}
.${prefix}-hero-title {
  margin: 0 0 0.35rem;
  font-family: var(--stem-font-display);
  font-size: clamp(1.35rem, 1.8vw, 1.55rem);
  letter-spacing: -0.03em;
}
.${prefix}-hero-lead {
  margin: 0;
  color: var(--stem-ink-soft);
  line-height: 1.5;
  max-width: 42rem;
  font-size: var(--stem-text-base);
}
.${prefix}-hero-actions { display: grid; gap: 0.75rem; justify-items: end; }
.${prefix}-action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  justify-content: flex-end;
  align-items: center;
}
.${prefix}-ghost-link {
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  padding: 0 0.75rem;
  font-size: var(--stem-text-md);
  font-weight: 600;
  color: var(--stem-teal-deep);
  text-decoration: none;
}
.${prefix}-ghost-link:hover { text-decoration: underline; }
.${prefix}-cross-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.65rem;
  align-items: center;
}
.${prefix}-cross-current {
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  padding: 0 0.75rem;
  font-size: var(--stem-text-md);
  font-weight: 700;
  color: var(--stem-ink);
  background: rgba(12, 124, 128, 0.1);
  border-radius: 999px;
}
.${prefix}-alert {
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
  font-size: var(--stem-text-base);
}
.${prefix}-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(280px, 0.85fr);
  gap: 1rem;
  align-items: start;
}
.${prefix}-layout-single {
  display: grid;
  gap: 1rem;
}
.${prefix}-table-wrap { overflow-x: auto; margin: 0 -0.15rem; }
.${prefix}-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--stem-text-base);
}
.${prefix}-table th {
  text-align: left;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--stem-ink-soft);
  padding: 0.55rem 0.65rem;
  border-bottom: 1px solid var(--stem-line);
  white-space: nowrap;
}
.${prefix}-table td {
  padding: 0.7rem 0.65rem;
  border-bottom: 1px solid var(--stem-line);
  vertical-align: top;
}
.${prefix}-table tbody tr {
  cursor: pointer;
  transition: background 0.15s ease;
}
.${prefix}-table tbody tr:hover { background: rgba(18, 160, 171, 0.04); }
.${prefix}-table tbody tr.is-selected { background: rgba(12, 124, 128, 0.08); }
.${prefix}-slug { margin-top: 0.15rem; font-size: var(--stem-text-sm); color: var(--stem-ink-soft); }
.${prefix}-empty { text-align: center; color: var(--stem-ink-soft); padding: 1.5rem 0.75rem !important; }
.${prefix}-side { position: sticky; top: 0.75rem; }
.${prefix}-detail {
  display: grid;
  gap: 1rem;
  padding: 1.1rem 1.15rem;
  border-radius: 16px;
  border: 1px solid var(--stem-line);
  background: #fff;
}
.${prefix}-detail-empty {
  min-height: 180px;
  align-content: center;
  justify-items: start;
  gap: 0.85rem;
}
.${prefix}-detail-head {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}
.${prefix}-detail-mark {
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
.${prefix}-detail-head h3 {
  margin: 0;
  font-size: var(--stem-text-xl);
  letter-spacing: -0.02em;
}
.${prefix}-detail-head p {
  margin: 0.15rem 0 0;
  font-size: var(--stem-text-md);
  color: var(--stem-ink-soft);
}
.${prefix}-meta {
  display: grid;
  gap: 0.55rem;
  margin: 0;
}
.${prefix}-meta > div {
  display: grid;
  grid-template-columns: 7.5rem minmax(0, 1fr);
  gap: 0.5rem;
  align-items: baseline;
}
.${prefix}-meta dt {
  margin: 0;
  font-size: var(--stem-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--stem-ink-soft);
}
.${prefix}-meta dd { margin: 0; font-size: var(--stem-text-base); word-break: break-word; }
.${prefix}-props {
  margin: 0;
  padding: 0.75rem;
  border-radius: 10px;
  background: #f8fafb;
  border: 1px solid var(--stem-line);
  font-size: var(--stem-text-sm);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 220px;
  overflow: auto;
}
.${prefix}-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  padding-top: 0.25rem;
  border-top: 1px solid var(--stem-line);
}
.${prefix}-links a {
  font-size: var(--stem-text-md);
  font-weight: 600;
  color: var(--stem-teal-deep);
  text-decoration: none;
}
.${prefix}-links a:hover { text-decoration: underline; }
.${prefix}-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: var(--stem-text-xs);
  font-weight: 700;
  letter-spacing: 0.02em;
  background: #eef8f6;
  color: #055456;
}
.${prefix}-pill.is-synth { background: #fef3c7; color: #92400e; }
.${prefix}-muted { color: var(--stem-ink-soft); font-size: var(--stem-text-base); margin: 0; }
.${prefix}-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
}
.${prefix}-filters input,
.${prefix}-filters select {
  min-height: 40px;
  padding: 0.55rem 0.9rem;
  border-radius: 10px;
  border: 1px solid var(--stem-line);
  font: inherit;
  font-size: var(--stem-text-md);
  line-height: 1.25;
  box-sizing: border-box;
  background: #fff;
}
@media (max-width: 960px) {
  .${prefix}-hero, .${prefix}-layout { grid-template-columns: 1fr; }
  .${prefix}-hero-actions { justify-items: start; }
  .${prefix}-action-row { justify-content: flex-start; }
  .${prefix}-side { position: static; }
}
`;
}

export function AuditDetailPanel({
  row,
  prefix,
  loading,
  extra,
}: {
  row: AuditRow | null;
  prefix: string;
  loading?: boolean;
  extra?: React.ReactNode;
}) {
  if (!row) {
    return (
      <div className={`${prefix}-detail ${prefix}-detail-empty`}>
        <p className={`${prefix}-empty`}>Select a row to review event details.</p>
      </div>
    );
  }

  return (
    <div className={`${prefix}-detail`}>
      <div className={`${prefix}-detail-head`}>
        <span className={`${prefix}-detail-mark`} aria-hidden>
          {row.action.split('.').pop()?.slice(0, 3).toUpperCase() ?? 'EVT'}
        </span>
        <div>
          <h3>{formatAction(row.action)}</h3>
          <p>{formatWhen(row.created_at)}</p>
        </div>
      </div>

      {loading ? (
        <p className={`${prefix}-muted`}>Loading details…</p>
      ) : (
        <>
          <dl className={`${prefix}-meta`}>
            <div>
              <dt>Actor</dt>
              <dd>
                {actorLabel(row)}
                {actorSub(row) ? (
                  <div className={`${prefix}-slug`}>{actorSub(row)}</div>
                ) : null}
              </dd>
            </div>
            <div>
              <dt>Tenant</dt>
              <dd>
                {tenantLabel(row)}
                {tenantSub(row) ? (
                  <div className={`${prefix}-slug`}>{tenantSub(row)}</div>
                ) : null}
              </dd>
            </div>
            {row.auditable_type ? (
              <div>
                <dt>Target</dt>
                <dd>
                  {row.auditable_type}
                  {row.auditable_id != null ? ` #${row.auditable_id}` : ''}
                </dd>
              </div>
            ) : null}
            <div>
              <dt>IP address</dt>
              <dd>{row.ip_address ?? '—'}</dd>
            </div>
            <div>
              <dt>User agent</dt>
              <dd>{row.user_agent ?? '—'}</dd>
            </div>
            {row.synthesized ? (
              <div>
                <dt>Source</dt>
                <dd>
                  <span className={`${prefix}-pill is-synth`}>Synthesized</span>
                </dd>
              </div>
            ) : null}
            {row.id != null ? (
              <div>
                <dt>Log ID</dt>
                <dd>{row.id}</dd>
              </div>
            ) : null}
          </dl>

          {(row.properties && Object.keys(row.properties as object).length > 0) ||
          (Array.isArray(row.properties) && row.properties.length > 0) ? (
            <div>
              <dt className={`${prefix}-muted`} style={{ marginBottom: '0.35rem' }}>
                Properties
              </dt>
              <pre className={`${prefix}-props`}>{propertiesJson(row.properties)}</pre>
            </div>
          ) : null}

          {extra}
        </>
      )}
    </div>
  );
}
