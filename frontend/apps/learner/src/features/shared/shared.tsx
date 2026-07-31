import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import { PortalShell, SelectField, useResolvedTenant } from '@stemora/ui';
import { useLearnerNav } from '../../nav';

export const STUDENT_API = '/learner/student';
export const PARENT_API = '/learner/parent';
export const LEARNER_API = '/learner';

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

export function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
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
  if (['active', 'published', 'scheduled', 'confirmed', 'completed', 'paid', 'present', 'sent', 'passed'].includes(s))
    return 'ok';
  if (['draft', 'pending', 'in_progress', 'late', 'open', 'submitted'].includes(s)) return 'info';
  if (['cancelled', 'closed', 'inactive', 'absent', 'void', 'overdue', 'failed'].includes(s)) return 'muted';
  return 'warn';
}

export function StatusPill({ status }: { status: string }) {
  return <span className={`lp-pill is-${statusTone(status)}`}>{status.replace(/_/g, ' ')}</span>;
}

export function LearnerShell({
  title,
  subtitle,
  mode = 'student',
  children,
  headerActions,
}: {
  title: string;
  subtitle?: string;
  mode?: 'student' | 'parent';
  children: ReactNode;
  headerActions?: ReactNode;
}) {
  const { tenantSlug = 'al-noor' } = useParams();
  const { session, logout } = useAuth();
  const nav = useLearnerNav(tenantSlug);
  const tenant = useResolvedTenant();

  return (
    <PortalShell
      portal="learner"
      brandCaption={mode === 'parent' ? 'Parent portal' : 'Student portal'}
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
      <style>{learnerStyles}</style>
    </PortalShell>
  );
}

export type ChildRow = {
  id: number;
  first_name?: string;
  last_name?: string;
  email?: string;
};

export function useParentChildren() {
  const { api } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const childParam = searchParams.get('child');
  const selectedId = childParam ? Number(childParam) : children[0]?.id ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: ChildRow[] }>(`${PARENT_API}/children`);
      const rows = res.data ?? [];
      setChildren(rows);
      if (rows.length && (!childParam || !rows.some((c) => c.id === Number(childParam)))) {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set('child', String(rows[0].id));
          return next;
        }, { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load children.');
    } finally {
      setLoading(false);
    }
  }, [api, childParam, setSearchParams]);

  useEffect(() => {
    void load();
  }, [load]);

  function setChildId(id: number) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('child', String(id));
      return next;
    });
  }

  const selected = children.find((c) => c.id === selectedId) ?? null;

  return { children, selected, selectedId, loading, error, load, setChildId };
}

export function ChildPicker({
  children,
  selectedId,
  onChange,
  disabled,
}: {
  children: ChildRow[];
  selectedId: number | null;
  onChange: (id: number) => void;
  disabled?: boolean;
}) {
  if (children.length === 0) return null;
  return (
    <div className="lp-toolbar" style={{ marginBottom: 0 }}>
      <SelectField
        label="Child"
        value={selectedId != null ? String(selectedId) : ''}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {children.map((c) => (
          <option key={c.id} value={c.id}>
            {personName(c.first_name, c.last_name, c.email)}
          </option>
        ))}
      </SelectField>
    </div>
  );
}

export const learnerStyles = `
.lp-page { display: grid; gap: 1.25rem; min-width: 0; }
.lp-hero {
  display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: 1rem 1.25rem;
  padding: 1.2rem 1.35rem; border-radius: 18px;
  border: 1px solid var(--stem-line);
  background:
    radial-gradient(120% 90% at 100% 0%, rgba(12, 124, 128, 0.14), transparent 55%),
    linear-gradient(145deg, #f3faf8, #eef5f2);
  color: var(--stem-ink);
}
.lp-hero-copy { flex: 1 1 16rem; min-width: 0; }
.lp-eyebrow {
  margin: 0 0 0.35rem; font-size: 0.78rem; letter-spacing: 0.08em; text-transform: uppercase;
  font-weight: 700; color: var(--stem-teal-deep);
}
.lp-hero-title {
  margin: 0; font-family: var(--stem-font-display);
  font-size: clamp(1.2rem, 1.6vw, 1.4rem); letter-spacing: -0.03em;
}
.lp-hero-lead { margin: 0.45rem 0 0; max-width: 46rem; color: var(--stem-ink-soft); line-height: 1.5; }
.lp-hero-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: flex-start; }
.lp-chip-row { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.75rem; }
.lp-chip {
  padding: 0.35rem 0.65rem; border-radius: 999px;
  background: rgba(12, 124, 128, 0.1);
  border: 1px solid rgba(12, 124, 128, 0.18);
  color: var(--stem-teal-deep);
  font-size: 0.8rem; font-weight: 600;
}
.lp-layout {
  display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(280px, 0.7fr);
  gap: 1.1rem; min-width: 0; align-items: start;
}
@media (max-width: 980px) { .lp-layout { grid-template-columns: 1fr; } }
.lp-profile-form { display: grid; gap: 1rem; min-width: 0; }
.lp-profile-intro {
  margin: 0 0 0.15rem; color: var(--stem-ink); line-height: 1.5; max-width: 40rem; opacity: 0.82;
}
.lp-profile-aside .lp-actions { flex-direction: column; align-items: stretch; margin-top: 0.15rem; }
.lp-profile-aside .lp-actions > * { width: 100%; justify-content: center; }
.lp-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.85rem; }
.lp-card {
  display: grid; gap: 0.45rem; padding: 1rem 1.05rem; border-radius: 14px;
  border: 1px solid var(--stem-line); background: #fff; min-width: 0;
}
.lp-card h3 { margin: 0; font-size: 1.02rem; overflow-wrap: anywhere; }
.lp-card p { margin: 0; color: var(--stem-ink-soft); font-size: 0.9rem; }
.lp-child-list { display: grid; gap: 0.85rem; min-width: 0; max-width: 48rem; }
.lp-child-card {
  display: grid; gap: 0.85rem; padding: 1.15rem 1.25rem; border-radius: 16px;
  border: 1px solid var(--stem-line); background: #fff; min-width: 0;
  height: fit-content; align-content: start;
}
.lp-child-card-top {
  display: flex; flex-wrap: wrap; gap: 0.75rem 1rem;
  align-items: center; justify-content: space-between; min-width: 0;
}
.lp-child-card-top .lp-detail-head { flex: 1 1 14rem; min-width: 0; }
.lp-child-nav {
  display: grid; gap: 0.45rem;
  padding-top: 0.85rem; border-top: 1px solid rgba(12,124,128,0.1);
}
.lp-child-nav-label {
  margin: 0; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.04em;
  text-transform: uppercase; color: var(--stem-ink-soft);
}
.lp-child-links { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.lp-child-links a, .lp-child-links .stem-btn { flex: 0 1 auto; }
.lp-progress {
  height: 8px; border-radius: 999px; background: rgba(12,124,128,0.1); overflow: hidden;
}
.lp-progress > span {
  display: block; height: 100%; border-radius: inherit;
  background: linear-gradient(90deg, var(--stem-teal-bright), var(--stem-teal-deep));
}
.lp-table-wrap { overflow: auto; border-radius: 12px; border: 1px solid rgba(12,124,128,0.12); min-width: 0; }
.lp-table { width: 100%; border-collapse: collapse; font-size: 0.92rem; table-layout: fixed; }
.lp-table th, .lp-table td {
  padding: 0.7rem 0.85rem; text-align: left; border-bottom: 1px solid rgba(12,124,128,0.1);
  vertical-align: top; overflow-wrap: anywhere;
}
.lp-table th {
  font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--stem-ink-soft); background: rgba(12,124,128,0.04);
}
.lp-table tr { cursor: pointer; }
.lp-table tr:hover td { background: rgba(12,124,128,0.04); }
.lp-table tr.is-selected td { background: rgba(12,124,128,0.08); }
.lp-muted { color: var(--stem-ink-soft); margin: 0; }
.lp-empty { padding: 1.25rem; color: var(--stem-ink-soft); }
.lp-alert {
  display: flex; justify-content: space-between; gap: 0.75rem; align-items: center; flex-wrap: wrap;
  padding: 0.75rem 1rem; border-radius: 12px; background: #fff4f2; color: #8a1f11; border: 1px solid #f3c4bc;
}
.lp-form { display: grid; gap: 0.75rem; }
.lp-form-grid {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.85rem;
}
@media (max-width: 720px) { .lp-form-grid { grid-template-columns: 1fr; } }
.lp-meta { display: grid; gap: 0.65rem; margin: 0; }
.lp-meta > div {
  display: grid; grid-template-columns: 6.25rem minmax(0, 1fr); gap: 0.5rem 0.75rem;
  align-items: baseline; min-width: 0;
}
.lp-meta dt { color: var(--stem-ink-soft); font-size: 0.82rem; font-weight: 600; }
.lp-meta dd { margin: 0; font-weight: 600; overflow-wrap: anywhere; font-size: 0.92rem; }
.lp-pill {
  display: inline-flex; align-items: center; padding: 0.18rem 0.55rem; border-radius: 999px;
  font-size: 0.75rem; font-weight: 600; text-transform: capitalize;
  background: rgba(12,124,128,0.12); color: var(--stem-teal-deep);
}
.lp-pill.is-ok { background: rgba(46,125,98,0.14); color: #1f6b4a; }
.lp-pill.is-info { background: rgba(37,99,235,0.12); color: #1d4ed8; }
.lp-pill.is-warn { background: rgba(180,83,9,0.14); color: #9a3412; }
.lp-pill.is-muted { background: rgba(100,116,139,0.14); color: #475569; }
.lp-actions { display: flex; flex-wrap: wrap; gap: 0.45rem; margin-top: 0.85rem; }
.lp-side {
  display: grid; gap: 1rem; position: sticky; top: 0.75rem; min-width: 0; align-self: start;
}
.lp-detail {
  display: grid; gap: 1rem; padding: 1.15rem 1.2rem; border-radius: 16px;
  border: 1px solid var(--stem-line); background: #fff; min-width: 0; height: fit-content;
}
.lp-detail-head { display: flex; gap: 0.85rem; align-items: center; min-width: 0; }
.lp-detail-mark {
  width: 48px; height: 48px; border-radius: 14px; display: grid; place-items: center; flex-shrink: 0;
  background: linear-gradient(145deg, var(--stem-teal-bright), var(--stem-teal-deep));
  color: #fff; font-weight: 700; font-size: 0.95rem;
}
.lp-detail-head > div { min-width: 0; flex: 1; }
.lp-detail-head h3 { margin: 0; font-size: 1.05rem; overflow-wrap: anywhere; line-height: 1.25; }
.lp-detail-head p { margin: 0.2rem 0 0; color: var(--stem-ink-soft); font-size: 0.88rem; overflow-wrap: anywhere; }
.lp-detail .lp-actions { margin-top: 0.15rem; }
.lp-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.55rem; }
.lp-list li {
  display: flex; justify-content: space-between; gap: 0.75rem; align-items: flex-start;
  padding: 0.7rem 0.8rem; border-radius: 12px; background: rgba(12,124,128,0.04); border: 1px solid rgba(12,124,128,0.08);
}
.lp-list strong { display: block; overflow-wrap: anywhere; }
.lp-list span { color: var(--stem-ink-soft); font-size: 0.85rem; }
.lp-toolbar { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: end; margin-bottom: 0.75rem; }
.lp-toolbar label { display: grid; gap: 0.25rem; font-size: 0.8rem; color: var(--stem-ink-soft); }
.lp-toolbar input, .lp-toolbar select {
  min-height: 38px; border-radius: 10px; border: 1px solid rgba(12,124,128,0.25);
  padding: 0.4rem 0.65rem; background: #fff;
}
.lp-check {
  display: inline-flex; align-items: center; gap: 0.5rem;
  color: var(--stem-ink-soft); font-size: 0.9rem; font-weight: 600;
}
.lp-room {
  min-height: 280px; border-radius: 16px; border: 1px dashed rgba(12,124,128,0.28);
  background: radial-gradient(circle at 20% 20%, rgba(18,160,171,0.14), transparent 45%),
    linear-gradient(160deg, #f7fbfb, #eef6f5);
  display: grid; place-items: center; padding: 1.5rem; text-align: center;
}
.lp-room.is-live {
  border-style: solid; border-color: rgba(12,124,128,0.35);
  box-shadow: inset 0 0 0 1px rgba(12,124,128,0.06);
}
.lp-room.is-closed { opacity: 0.92; filter: saturate(0.85); }
.lp-room-stage { display: grid; gap: 0.65rem; justify-items: center; max-width: 28rem; }
.lp-room-avatar {
  width: 64px; height: 64px; border-radius: 18px; display: grid; place-items: center;
  background: linear-gradient(145deg, var(--stem-teal-bright), var(--stem-teal-deep));
  color: #fff; font-weight: 700; font-size: 1.15rem;
}
.lp-room-title { margin: 0; font-size: 1.15rem; font-weight: 700; }
.lp-room-controls { display: flex; flex-wrap: wrap; gap: 0.45rem; justify-content: center; margin-top: 0.35rem; }
.lp-star-row { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.lp-star-row button {
  min-width: 2.4rem; min-height: 2.4rem; border-radius: 10px;
  border: 1px solid rgba(12,124,128,0.22); background: #fff; cursor: pointer; font-weight: 700;
  color: var(--stem-ink-soft);
}
.lp-star-row button.is-on {
  background: rgba(232,137,74,0.16); border-color: rgba(232,137,74,0.45); color: #c96a2e;
}
`;
