import { type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import { PortalShell, useResolvedTenant } from '@stemora/ui';
import { useInstitutionNav } from '../../nav';

export const TUTOR_API = '/org/teacher';

export function formatWhen(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function formatMoney(amount: number, currency = 'SAR') {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export function personName(first?: string | null, last?: string | null, email?: string | null) {
  const n = [first, last].filter(Boolean).join(' ').trim();
  return n || email || '—';
}

export function statusTone(status: string) {
  const s = status.toLowerCase();
  if (['active', 'published', 'scheduled', 'confirmed', 'completed', 'paid', 'present'].includes(s)) return 'ok';
  if (['draft', 'pending', 'in_progress', 'late'].includes(s)) return 'info';
  if (['cancelled', 'closed', 'inactive', 'absent', 'void'].includes(s)) return 'muted';
  return 'warn';
}

export function TutorShell({
  title,
  subtitle,
  children,
  headerActions,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  headerActions?: ReactNode;
}) {
  const { tenantSlug = 'al-noor' } = useParams();
  const { session, logout } = useAuth();
  const nav = useInstitutionNav(tenantSlug);
  const tenant = useResolvedTenant();

  return (
    <PortalShell
      portal="institution"
      brandCaption="Tutor portal"
      brandName={tenant?.name || tenantSlug}
      title={title}
      subtitle={subtitle}
      nav={nav}
      userLabel={session?.user.email}
      userName={session?.user.name}
      onLogout={logout}
      changePasswordTo={`/${tenantSlug}/change-password`}
      headerActions={headerActions}
      collapsible
    >
      {children}
      <style>{tutorStyles}</style>
    </PortalShell>
  );
}

export function StatusPill({ status }: { status: string }) {
  return <span className={`tp-pill is-${statusTone(status)}`}>{status.replace(/_/g, ' ')}</span>;
}

export const tutorStyles = `
.tp-page { display: grid; gap: 1.25rem; }
.tp-hero {
  display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: 1rem 1.25rem;
  padding: 1.2rem 1.35rem; border-radius: 18px;
  border: 1px solid var(--stem-line);
  background:
    radial-gradient(120% 90% at 100% 0%, rgba(12, 124, 128, 0.14), transparent 55%),
    linear-gradient(145deg, #f3faf8, #eef5f2);
  color: var(--stem-ink);
}
.tp-eyebrow {
  margin: 0 0 0.35rem; font-size: 0.78rem; letter-spacing: 0.08em; text-transform: uppercase;
  font-weight: 700; color: var(--stem-teal-deep);
}
.tp-hero-title {
  margin: 0; font-family: var(--stem-font-display);
  font-size: clamp(1.2rem, 1.6vw, 1.4rem); letter-spacing: -0.03em;
}
.tp-hero-lead { margin: 0.45rem 0 0; max-width: 46rem; color: var(--stem-ink-soft); line-height: 1.5; }
.tp-hero-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: flex-start; }
.tp-layout { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.85fr); gap: 1rem; }
@media (max-width: 980px) { .tp-layout { grid-template-columns: 1fr; } }
.tp-table-wrap { overflow: auto; border-radius: 12px; border: 1px solid rgba(12,124,128,0.12); }
.tp-table { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
.tp-table th, .tp-table td { padding: 0.7rem 0.85rem; text-align: left; border-bottom: 1px solid rgba(12,124,128,0.1); vertical-align: top; }
.tp-table th { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--stem-ink-soft); background: rgba(12,124,128,0.04); }
.tp-table tr { cursor: pointer; }
.tp-table tr:hover td { background: rgba(12,124,128,0.04); }
.tp-table tr.is-selected td { background: rgba(12,124,128,0.08); }
.tp-muted { color: var(--stem-ink-soft); margin: 0; }
.tp-empty { padding: 1.25rem; color: var(--stem-ink-soft); }
.tp-alert {
  display: flex; justify-content: space-between; gap: 0.75rem; align-items: center;
  padding: 0.75rem 1rem; border-radius: 12px; background: #fff4f2; color: #8a1f11; border: 1px solid #f3c4bc;
}
.tp-form { display: grid; gap: 0.75rem; }
.tp-meta { display: grid; gap: 0.55rem; margin: 0; }
.tp-meta > div { display: grid; grid-template-columns: 7.5rem 1fr; gap: 0.5rem; }
.tp-meta dt { color: var(--stem-ink-soft); font-size: 0.85rem; }
.tp-meta dd { margin: 0; font-weight: 600; }
.tp-pill {
  display: inline-flex; align-items: center; padding: 0.18rem 0.55rem; border-radius: 999px;
  font-size: 0.75rem; font-weight: 600; text-transform: capitalize;
  background: rgba(12,124,128,0.12); color: var(--stem-teal-deep);
}
.tp-pill.is-ok { background: rgba(46,125,98,0.14); color: #1f6b4a; }
.tp-pill.is-info { background: rgba(37,99,235,0.12); color: #1d4ed8; }
.tp-pill.is-warn { background: rgba(180,83,9,0.14); color: #9a3412; }
.tp-pill.is-muted { background: rgba(100,116,139,0.14); color: #475569; }
.tp-actions { display: flex; flex-wrap: wrap; gap: 0.45rem; margin-top: 0.85rem; }
.tp-detail-head { display: flex; gap: 0.85rem; align-items: center; margin-bottom: 0.85rem; }
.tp-detail-mark {
  width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center;
  background: linear-gradient(145deg, var(--stem-teal-bright), var(--stem-teal-deep)); color: #fff; font-weight: 700;
}
.tp-detail-head h3 { margin: 0; font-size: 1.05rem; }
.tp-detail-head p { margin: 0.15rem 0 0; color: var(--stem-ink-soft); font-size: 0.9rem; }
.tp-chip-row { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.75rem; }
.tp-chip {
  padding: 0.35rem 0.65rem; border-radius: 999px;
  background: rgba(12, 124, 128, 0.1);
  border: 1px solid rgba(12, 124, 128, 0.18);
  color: var(--stem-teal-deep);
  font-size: 0.8rem; font-weight: 600;
}
.tp-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.55rem; }
.tp-list li {
  display: flex; justify-content: space-between; gap: 0.75rem; align-items: flex-start;
  padding: 0.7rem 0.8rem; border-radius: 12px; background: rgba(12,124,128,0.04); border: 1px solid rgba(12,124,128,0.08);
}
.tp-list strong { display: block; }
.tp-list span { color: var(--stem-ink-soft); font-size: 0.85rem; }
.tp-toolbar { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: end; margin-bottom: 0.75rem; }
.tp-toolbar label { display: grid; gap: 0.25rem; font-size: 0.8rem; color: var(--stem-ink-soft); }
.tp-toolbar input, .tp-toolbar select {
  min-height: 38px; border-radius: 10px; border: 1px solid rgba(12,124,128,0.25);
  padding: 0.4rem 0.65rem; background: #fff;
}
.tp-hero-copy { flex: 1 1 16rem; min-width: 0; }
.tp-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
}
@media (max-width: 720px) { .tp-form-grid { grid-template-columns: 1fr; } }
.tp-side { display: grid; gap: 1rem; position: sticky; top: 0.75rem; min-width: 0; }
.tp-detail {
  display: grid; gap: 1rem; padding: 1.1rem 1.15rem; border-radius: 16px;
  border: 1px solid var(--stem-line); background: #fff; min-width: 0;
}
.tp-subject-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.45rem; }
.tp-subject-list li {
  display: flex; justify-content: space-between; gap: 0.75rem; align-items: baseline;
  padding: 0.65rem 0.75rem; border-radius: 12px;
  background: rgba(12,124,128,0.04); border: 1px solid rgba(12,124,128,0.08);
}
.tp-subject-list span { color: var(--stem-ink-soft); font-size: 0.85rem; font-weight: 600; }
.tp-room {
  min-height: 280px; border-radius: 16px; border: 1px dashed rgba(12,124,128,0.28);
  background: radial-gradient(circle at 20% 20%, rgba(18,160,171,0.14), transparent 45%),
    linear-gradient(160deg, #f7fbfb, #eef6f5);
  display: grid; place-items: center; padding: 1.5rem; text-align: center;
}
.tp-room.is-live {
  border-style: solid; border-color: rgba(12,124,128,0.35);
  box-shadow: inset 0 0 0 1px rgba(12,124,128,0.06);
}
.tp-room.is-closed { opacity: 0.92; filter: saturate(0.85); }
.tp-room-stage { display: grid; gap: 0.65rem; justify-items: center; max-width: 28rem; }
.tp-room-avatar {
  width: 64px; height: 64px; border-radius: 18px; display: grid; place-items: center;
  background: linear-gradient(145deg, var(--stem-teal-bright), var(--stem-teal-deep));
  color: #fff; font-weight: 700; font-size: 1.15rem;
}
.tp-room-title { margin: 0; font-size: 1.15rem; font-weight: 700; }
.tp-room-controls { display: flex; flex-wrap: wrap; gap: 0.45rem; justify-content: center; margin-top: 0.35rem; }
.tp-check {
  display: inline-flex; align-items: center; gap: 0.5rem;
  color: var(--stem-ink-soft); font-size: 0.9rem; font-weight: 600;
}
.tp-participant-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.65rem; }
.tp-participant-list > li {
  padding: 0.75rem; border-radius: 14px; background: rgba(12,124,128,0.04);
  border: 1px solid rgba(12,124,128,0.08); display: grid; gap: 0.55rem;
}
.tp-participant-head { display: flex; gap: 0.65rem; align-items: center; }
.tp-participant-head > div { flex: 1; min-width: 0; }
.tp-participant-head strong { display: block; }
.tp-participant-head .tp-muted { display: block; font-size: 0.82rem; margin-top: 0.1rem; }
.tp-participant-actions { min-width: 0; }
`;
