import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import { PortalShell, useResolvedTenant } from '@stemora/ui';
import { useInstitutionNav } from '../../nav';
import { pillLabel, tutorStyles } from '../tutor/shared';

export const TEACHER_API = '/org/teacher';

export type TeacherSection = {
  id: number;
  name: string;
  section_code: string | null;
  status: string;
  grade: string | null;
  class_name: string | null;
  class_code: string | null;
  label: string;
  students_count: number;
};

export type TeacherSubject = {
  id: number;
  code: string;
  name_en: string;
  name_ar: string | null;
  status: string;
};

export type TeacherContext = {
  school: { id: number; name_en: string; name_ar: string | null; code: string; timezone: string | null };
  teacher: { id: number; name: string; email: string };
  academic_year: { id: number; name: string; is_current: boolean } | null;
  scope: 'assigned' | 'school';
  sections: TeacherSection[];
  subjects: TeacherSubject[];
  capabilities: {
    assign: boolean;
    manage_content: boolean;
    manage_assessments: boolean;
    grade: boolean;
    view_progress: boolean;
  };
};

/**
 * Shared bootstrap payload. Cached for the tab so switching between the 13 teacher
 * pages does not refetch the same section/subject lists on every navigation.
 */
let contextCache: TeacherContext | null = null;
let contextPromise: Promise<TeacherContext> | null = null;

export function useTeacherContext() {
  const { api } = useAuth();
  const [context, setContext] = useState<TeacherContext | null>(contextCache);
  const [loading, setLoading] = useState(!contextCache);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (contextCache) return;
    contextPromise ??= api
      .get<{ data: TeacherContext }>(`${TEACHER_API}/context`)
      .then((res) => {
        contextCache = res.data;
        return res.data;
      })
      .finally(() => {
        contextPromise = null;
      });

    setLoading(true);
    contextPromise
      .then((data) => {
        if (mounted.current) setContext(data);
      })
      .catch((err: unknown) => {
        if (mounted.current) setError(err instanceof Error ? err.message : 'Could not load your classes.');
      })
      .finally(() => {
        if (mounted.current) setLoading(false);
      });
  }, [api]);

  return { context, loading, error };
}

export function TeacherShell({
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
  const { session, logout, roles } = useAuth();
  const nav = useInstitutionNav(tenantSlug);
  const tenant = useResolvedTenant();
  const isTutorOnly = roles.includes('tutor') && !roles.includes('teacher');

  return (
    <PortalShell
      portal="institution"
      brandCaption={isTutorOnly ? 'Tutor portal' : 'Teacher portal'}
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
      <style>{teacherStyles}</style>
    </PortalShell>
  );
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return value;
  }
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString(undefined, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

export function formatRelativeDue(value: string | null | undefined) {
  if (!value) return { label: '—', tone: 'muted' as const };
  const due = new Date(value).getTime();
  if (Number.isNaN(due)) return { label: value, tone: 'muted' as const };
  const days = Math.round((due - Date.now()) / 86_400_000);
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, tone: 'warn' as const };
  if (days === 0) return { label: 'Due today', tone: 'warn' as const };
  if (days === 1) return { label: 'Due tomorrow', tone: 'info' as const };
  if (days <= 7) return { label: `In ${days} days`, tone: 'info' as const };
  return { label: formatDate(value), tone: 'muted' as const };
}

/** Converts an ISO timestamp into the value a `datetime-local` input expects. */
export function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
}

export function todayIso() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Records without a real translation carry the English title in `title_ar`. Showing that
 * back under an "Arabic title" label is worse than showing nothing.
 */
export function arabicTitle(titleAr: string | null | undefined, titleEn: string) {
  const value = (titleAr ?? '').trim();
  return value && value !== titleEn.trim() ? value : null;
}

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

export function statusTone(status: string | null | undefined) {
  const value = (status ?? '').toLowerCase();
  if (['active', 'published', 'graded', 'completed', 'present', 'sent'].includes(value)) return 'ok';
  if (['draft', 'scheduled', 'submitted', 'in_progress', 'late'].includes(value)) return 'info';
  if (['closed', 'archived', 'inactive', 'excused'].includes(value)) return 'muted';
  if (['absent', 'overdue'].includes(value)) return 'warn';
  return 'info';
}

export function Pill({ label, tone = 'info' }: { label: string; tone?: 'ok' | 'info' | 'warn' | 'muted' }) {
  return <span className={`tp-pill is-${tone}`}>{pillLabel(label)}</span>;
}

export function StatusPill({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="tp-pill is-muted">—</span>;
  return <Pill label={status} tone={statusTone(status)} />;
}

/** Small horizontal bar used in grade book and progress tables. */
export function ScoreBar({ value }: { value: number | null }) {
  if (value === null || Number.isNaN(value)) return <span className="tk-dash">—</span>;
  const tone = value >= 80 ? 'ok' : value >= 50 ? 'info' : 'warn';
  return (
    <span className="tk-score">
      <span className={`tk-score-track is-${tone}`}>
        <span className="tk-score-fill" style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
      </span>
      <span className="tk-score-value">{value}%</span>
    </span>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="tk-empty-state">
      <div className="tk-empty-mark" aria-hidden="true">
        ✦
      </div>
      <h3>{title}</h3>
      <p>{message}</p>
      {action ? <div className="tp-actions" style={{ justifyContent: 'center' }}>{action}</div> : null}
    </div>
  );
}

export function ErrorBanner({ error, onDismiss }: { error: string | null; onDismiss?: () => void }) {
  if (!error) return null;
  return (
    <div className="tp-alert" role="alert">
      <span>{error}</span>
      {onDismiss ? (
        <button type="button" className="tk-alert-dismiss" onClick={onDismiss}>
          Dismiss
        </button>
      ) : null}
    </div>
  );
}

/** Section + subject filter pair shared by most teacher pages. */
export function useSectionFilter(context: TeacherContext | null) {
  const [sectionId, setSectionId] = useState<number | null>(null);
  const resolved = useMemo(() => {
    if (sectionId !== null) return sectionId;
    return context?.sections[0]?.id ?? null;
  }, [sectionId, context]);

  const select = useCallback((value: number | null) => setSectionId(value), []);

  return { sectionId: resolved, setSectionId: select };
}

export const teacherStyles = `
.tk-toolbar {
  display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: flex-end;
  padding: 0.85rem 1rem; border-radius: 14px; border: 1px solid var(--stem-line);
  background: #fff;
}
.tk-field { display: grid; gap: 0.3rem; min-width: 0; }
.tk-field > span {
  font-size: 0.72rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
  color: var(--stem-ink-soft);
}
.tk-field input, .tk-field select, .tk-field textarea {
  min-height: 40px; border-radius: 10px; border: 1px solid rgba(12,124,128,0.25);
  padding: 0.55rem 0.9rem; background: #fff; box-sizing: border-box;
  font: inherit; font-size: var(--stem-text-md); line-height: 1.25; color: var(--stem-ink);
}
.tk-field input:focus-visible, .tk-field select:focus-visible, .tk-field textarea:focus-visible {
  outline: 2px solid var(--stem-teal-bright); outline-offset: 1px;
}
.tk-field-grow { flex: 1 1 12rem; }
.tk-toolbar-actions { display: flex; gap: 0.45rem; align-items: center; margin-left: auto; }

/* The tab group shares a toolbar row with the search field and subject select,
   so the outer pill has to land on the same 40px height they do. */
.tk-tabs {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem;
  padding: 0.25rem; border-radius: 12px; background: rgba(12,124,128,0.07);
  min-height: 40px; box-sizing: border-box;
}
.tk-tabs button {
  border: 1px solid transparent; background: transparent; cursor: pointer;
  min-height: 32px; padding: 0.3rem 0.9rem; border-radius: 9px;
  font: inherit; font-size: var(--stem-text-md); font-weight: 600; color: var(--stem-ink-soft);
}
.tk-tabs button:hover { color: var(--stem-teal-deep); }
.tk-tabs button.is-active { background: #fff; color: var(--stem-teal-deep); border-color: rgba(12,124,128,0.18); box-shadow: 0 1px 2px rgba(15,23,42,0.06); }
.tk-tabs .tk-tab-count { margin-left: 0.4rem; font-size: 0.75rem; opacity: 0.75; }

.tk-empty-state { display: grid; gap: 0.4rem; justify-items: center; text-align: center; padding: 2.5rem 1.25rem; }
.tk-empty-mark {
  width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center; font-size: 1.2rem;
  background: rgba(12,124,128,0.1); color: var(--stem-teal-deep); margin-bottom: 0.35rem;
}
.tk-empty-state h3 { margin: 0; font-size: 1rem; }
.tk-empty-state p { margin: 0; color: var(--stem-ink-soft); max-width: 24rem; }

.tk-alert-dismiss {
  border: 1px solid #f3c4bc; background: #fff; color: #8a1f11; cursor: pointer;
  min-height: 32px; padding: 0.25rem 0.7rem; border-radius: 8px; font: inherit; font-weight: 600; font-size: 0.85rem;
}

.tk-score { display: inline-flex; align-items: center; gap: 0.5rem; min-width: 7.5rem; }
.tp-table .tk-score { min-width: 6.25rem; width: 100%; }
.tk-score-track { flex: 1; height: 6px; border-radius: 999px; background: rgba(15,23,42,0.09); overflow: hidden; }
.tk-score-fill { display: block; height: 100%; border-radius: 999px; background: currentColor; }
.tk-score-track.is-ok { color: #1f6b4a; }
.tk-score-track.is-info { color: #1d4ed8; }
.tk-score-track.is-warn { color: #b45309; }
.tk-score-value { font-variant-numeric: tabular-nums; font-weight: 600; font-size: 0.85rem; min-width: 2.6rem; text-align: right; }
.tk-dash { color: var(--stem-ink-soft); }

.tk-avatar {
  width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; flex: 0 0 auto;
  background: linear-gradient(145deg, var(--stem-teal-bright), var(--stem-teal-deep));
  color: #fff; font-weight: 700; font-size: 0.78rem;
}
.tk-person { display: flex; align-items: center; gap: 0.6rem; min-width: 0; }
.tk-person > div { min-width: 0; }
.tk-person strong, .tk-person span:not(.tk-avatar) {
  display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; overflow-wrap: normal;
}
.tk-person strong { font-weight: 600; }
.tk-person span:not(.tk-avatar) { color: var(--stem-ink-soft); font-size: 0.8rem; }

.tk-grid { display: grid; gap: 0.85rem; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
.tk-card {
  display: grid; gap: 0.55rem; align-content: start; padding: 1rem;
  border-radius: 14px; border: 1px solid var(--stem-line); background: #fff;
  cursor: pointer; text-align: left; font: inherit; color: inherit;
  transition: border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease;
}
.tk-card:hover { border-color: rgba(12,124,128,0.35); box-shadow: 0 6px 18px rgba(15,23,42,0.07); transform: translateY(-1px); }
.tk-card.is-selected { border-color: var(--stem-teal-deep); box-shadow: 0 0 0 1px var(--stem-teal-deep); }
.tk-card-head { display: flex; justify-content: space-between; gap: 0.6rem; align-items: flex-start; }
.tk-card-title { margin: 0; font-size: 0.98rem; font-weight: 700; line-height: 1.35; }
.tk-card-sub { margin: 0; color: var(--stem-ink-soft); font-size: 0.85rem; }
.tk-card-foot { display: flex; flex-wrap: wrap; gap: 0.4rem 0.9rem; align-items: center; color: var(--stem-ink-soft); font-size: 0.82rem; }
.tk-card-foot strong { color: var(--stem-ink); font-weight: 600; }

.tk-roster { display: grid; gap: 0.5rem; }
.tk-roster-row {
  display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.75rem; align-items: center;
  padding: 0.6rem 0.75rem; border-radius: 12px; border: 1px solid rgba(12,124,128,0.1);
  background: rgba(12,124,128,0.03);
}
.tk-roster-row.is-absent { background: rgba(220,38,38,0.05); border-color: rgba(220,38,38,0.18); }
.tk-roster-row.is-late { background: rgba(180,83,9,0.06); border-color: rgba(180,83,9,0.2); }
.tk-roster-row.is-excused { background: rgba(100,116,139,0.07); border-color: rgba(100,116,139,0.2); }
.tk-segmented { display: inline-flex; gap: 0.2rem; padding: 0.2rem; border-radius: 10px; background: rgba(15,23,42,0.05); }
.tk-segmented button {
  border: 1px solid transparent; background: transparent; cursor: pointer; border-radius: 8px;
  min-height: 32px; padding: 0.25rem 0.7rem; font: inherit; font-size: 0.82rem; font-weight: 600;
  color: var(--stem-ink-soft); white-space: nowrap;
}
.tk-segmented button.is-active { background: #fff; box-shadow: 0 1px 2px rgba(15,23,42,0.08); }
.tk-segmented button.is-active[data-status="present"] { color: #1f6b4a; }
.tk-segmented button.is-active[data-status="absent"] { color: #b42318; }
.tk-segmented button.is-active[data-status="late"] { color: #b45309; }
.tk-segmented button.is-active[data-status="excused"] { color: #475569; }

.tk-matrix-wrap { overflow: auto; border-radius: 12px; border: 1px solid rgba(12,124,128,0.12); max-height: 32rem; }
.tk-matrix { border-collapse: separate; border-spacing: 0; width: 100%; font-size: 0.86rem; }
.tk-matrix th, .tk-matrix td { padding: 0.55rem 0.7rem; border-bottom: 1px solid rgba(12,124,128,0.1); white-space: nowrap; }
.tk-matrix thead th {
  position: sticky; top: 0; z-index: 2; background: #f3faf8; text-align: left;
  font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--stem-ink-soft);
}
.tk-matrix .tk-sticky-col { position: sticky; left: 0; z-index: 1; background: #fff; border-right: 1px solid rgba(12,124,128,0.12); }
.tk-matrix thead .tk-sticky-col { z-index: 3; background: #f3faf8; }
.tk-matrix tbody tr:hover td { background: rgba(12,124,128,0.035); }
.tk-matrix tbody tr:hover .tk-sticky-col { background: #f7fdfb; }
.tk-matrix td.tk-num { text-align: right; font-variant-numeric: tabular-nums; }
.tk-cell-good { color: #1f6b4a; font-weight: 600; }
.tk-cell-mid { color: #1d4ed8; font-weight: 600; }
.tk-cell-low { color: #b42318; font-weight: 700; }
.tk-col-head { display: grid; gap: 0.1rem; }
.tk-col-head span { font-size: 0.68rem; text-transform: none; letter-spacing: 0; opacity: 0.8; }

.tk-tree { display: grid; gap: 0.6rem; }
.tk-tree-group { border: 1px solid var(--stem-line); border-radius: 14px; background: #fff; overflow: hidden; }
.tk-tree-head {
  display: flex; gap: 0.75rem; align-items: center; width: 100%; text-align: left;
  padding: 0.85rem 1rem; background: transparent; border: 0; cursor: pointer; font: inherit;
}
.tk-tree-head:hover { background: rgba(12,124,128,0.04); }
.tk-tree-head .tk-caret { color: var(--stem-teal-deep); font-size: 0.75rem; transition: transform 140ms ease; }
.tk-tree-head[aria-expanded="true"] .tk-caret { transform: rotate(90deg); }
.tk-tree-title { flex: 1; min-width: 0; }
.tk-tree-title strong { display: block; font-size: 0.95rem; }
.tk-tree-title span { display: block; color: var(--stem-ink-soft); font-size: 0.82rem; }
.tk-tree-body { border-top: 1px solid rgba(12,124,128,0.1); padding: 0.5rem; display: grid; gap: 0.35rem; }
.tk-lesson-row {
  display: flex; gap: 0.75rem; align-items: center; width: 100%; text-align: left;
  padding: 0.6rem 0.75rem; border-radius: 10px; border: 1px solid transparent;
  background: transparent; cursor: pointer; font: inherit;
}
.tk-lesson-row:hover { background: rgba(12,124,128,0.05); }
.tk-lesson-row.is-selected { background: rgba(12,124,128,0.09); border-color: rgba(12,124,128,0.25); }
.tk-lesson-seq {
  width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; flex: 0 0 auto;
  background: rgba(12,124,128,0.1); color: var(--stem-teal-deep); font-size: 0.75rem; font-weight: 700;
}
.tk-lesson-main { flex: 1; min-width: 0; }
.tk-lesson-main strong { display: block; font-weight: 600; }
.tk-lesson-main span { display: block; color: var(--stem-ink-soft); font-size: 0.8rem; }

.tk-thread { display: grid; gap: 0.5rem; max-height: 26rem; overflow: auto; padding-right: 0.15rem; }
.tk-message {
  display: grid; gap: 0.3rem; width: 100%; text-align: left; padding: 0.75rem 0.85rem;
  border-radius: 12px; border: 1px solid rgba(12,124,128,0.12); background: #fff; cursor: pointer; font: inherit;
}
.tk-message:hover { border-color: rgba(12,124,128,0.3); }
.tk-message.is-selected { border-color: var(--stem-teal-deep); background: rgba(12,124,128,0.05); }
.tk-message.is-unread { border-left: 3px solid var(--stem-teal-bright); }
.tk-message-head { display: flex; justify-content: space-between; gap: 0.6rem; align-items: baseline; }
.tk-message-head strong { font-size: 0.92rem; }
.tk-message-head time { color: var(--stem-ink-soft); font-size: 0.78rem; white-space: nowrap; }
.tk-message-preview {
  margin: 0; color: var(--stem-ink-soft); font-size: 0.85rem;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.tk-message-body { white-space: pre-wrap; line-height: 1.6; margin: 0; }

.tk-detail-scroll { max-height: 34rem; overflow: auto; padding-right: 0.15rem; }
.tk-note { margin: 0; white-space: pre-wrap; line-height: 1.6; color: var(--stem-ink); }
.tk-note-block { display: grid; gap: 0.3rem; }
.tk-note-block h4 {
  margin: 0; font-size: 0.72rem; letter-spacing: 0.05em; text-transform: uppercase; color: var(--stem-ink-soft);
}
.tk-stack { display: grid; gap: 0.85rem; }
.tk-row { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
.tk-spacer { flex: 1 1 auto; }
.tk-legend { display: flex; flex-wrap: wrap; gap: 0.75rem; font-size: 0.8rem; color: var(--stem-ink-soft); }
.tk-legend span { display: inline-flex; align-items: center; gap: 0.35rem; }
.tk-legend i { width: 9px; height: 9px; border-radius: 3px; display: inline-block; }
.tk-bar-list { display: grid; gap: 0.45rem; }
.tk-bar-row { display: grid; grid-template-columns: 5.5rem 1fr auto; gap: 0.6rem; align-items: center; font-size: 0.84rem; }
.tk-bar-track { height: 8px; border-radius: 999px; background: rgba(15,23,42,0.08); overflow: hidden; display: flex; }
.tk-bar-seg { height: 100%; }
.tk-bar-seg.is-present { background: #2e7d62; }
.tk-bar-seg.is-late { background: #d97706; }
.tk-bar-seg.is-absent { background: #dc2626; }
.tk-bar-seg.is-excused { background: #64748b; }

.tk-check {
  display: inline-flex; align-items: center; gap: 0.45rem; min-height: 40px;
  font-size: 0.9rem; color: var(--stem-ink); cursor: pointer; white-space: nowrap;
}
.tk-check input { width: 16px; height: 16px; margin: 0; accent-color: var(--stem-teal-deep); }

.tk-flags { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.4rem; }
.tk-flags li {
  display: flex; gap: 0.5rem; align-items: flex-start; font-size: 0.86rem; line-height: 1.45;
}
.tk-flags li::before {
  content: '!'; flex: 0 0 auto; width: 16px; height: 16px; margin-top: 0.1rem;
  border-radius: 5px; display: grid; place-items: center;
  background: rgba(180,83,9,0.14); color: #9a3412; font-size: 0.7rem; font-weight: 700;
}
`;
