import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@stemora/auth';
import { Button, Panel, StatStrip, useFeedback } from '@stemora/ui';
import {
  EmptyState,
  ErrorBanner,
  Pill,
  TEACHER_API,
  TeacherShell,
  formatDate,
  initials,
  todayIso,
} from './shared';

const STATUSES = ['present', 'absent', 'late', 'excused'] as const;

/** Stacking order for the history bars: attending marks first, then the exceptions. */
const BAR_ORDER = ['present', 'late', 'absent', 'excused'] as const;

type AttendanceStatus = (typeof STATUSES)[number];

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  excused: 'Excused',
};

const STATUS_COLOUR: Record<AttendanceStatus, string> = {
  present: '#2e7d62',
  late: '#d97706',
  absent: '#dc2626',
  excused: '#64748b',
};

type RosterRow = {
  student_user_id: number;
  student: string;
  email: string;
  status: AttendanceStatus;
  notes: string | null;
  recorded: boolean;
};

type SessionSummary = {
  date: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
};

type SectionOption = { id: number; label: string; students_count: number };

type AttendanceStats = {
  students: number;
  recorded: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  rate: number | null;
};

type AttendanceResponse = {
  data: { roster: RosterRow[]; history: SessionSummary[] };
  meta: {
    class_section_id: number;
    date: string;
    sections: SectionOption[];
    stats: AttendanceStats;
  };
};

const emptyStats: AttendanceStats = {
  students: 0,
  recorded: 0,
  present: 0,
  absent: 0,
  late: 0,
  excused: 0,
  rate: null,
};

/** Shifts a `YYYY-MM-DD` value by whole days without crossing into UTC. */
function shiftDate(value: string, days: number) {
  const parts = value.split('-').map(Number);
  const date = new Date(parts[0] ?? 1970, (parts[1] ?? 1) - 1, parts[2] ?? 1);
  date.setDate(date.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function statusesFrom(rows: RosterRow[]) {
  const map: Record<number, AttendanceStatus> = {};
  rows.forEach((row) => {
    map[row.student_user_id] = row.status;
  });
  return map;
}

export function TeacherAttendancePage() {
  const { api } = useAuth();
  const feedback = useFeedback();

  const [sectionId, setSectionId] = useState('');
  const [date, setDate] = useState(todayIso());

  const [sections, setSections] = useState<SectionOption[]>([]);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [history, setHistory] = useState<SessionSummary[]>([]);
  const [stats, setStats] = useState<AttendanceStats>(emptyStats);
  const [activeSectionId, setActiveSectionId] = useState<number | null>(null);

  const [draft, setDraft] = useState<Record<number, AttendanceStatus>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (sectionId) params.set('class_section_id', sectionId);
      params.set('date', date);
      const res = await api.get<AttendanceResponse>(`${TEACHER_API}/attendance?${params.toString()}`);
      const rows = res.data?.roster ?? [];
      setRoster(rows);
      setHistory(res.data?.history ?? []);
      setSections(res.meta?.sections ?? []);
      setStats(res.meta?.stats ?? emptyStats);
      setActiveSectionId(res.meta?.class_section_id ?? null);
      setDraft(statusesFrom(rows));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the attendance register.');
    } finally {
      setLoading(false);
    }
  }, [api, sectionId, date]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedSection = sectionId || (activeSectionId ? String(activeSectionId) : '');
  const targetSectionId = Number(selectedSection) || null;
  const sectionLabel = sections.find((section) => String(section.id) === selectedSection)?.label ?? null;

  const changedCount = useMemo(
    () => roster.filter((row) => (draft[row.student_user_id] ?? row.status) !== row.status).length,
    [roster, draft]
  );
  const unmarkedCount = useMemo(() => roster.filter((row) => !row.recorded).length, [roster]);

  // A register that has never been saved is worth submitting even when every default is kept.
  const dirty = changedCount > 0 || unmarkedCount > 0;

  function setStatus(studentUserId: number, status: AttendanceStatus) {
    setDraft((prev) => ({ ...prev, [studentUserId]: status }));
  }

  function markAll(status: AttendanceStatus) {
    const map: Record<number, AttendanceStatus> = {};
    roster.forEach((row) => {
      map[row.student_user_id] = status;
    });
    setDraft(map);
  }

  function resetDraft() {
    setDraft(statusesFrom(roster));
  }

  async function save() {
    if (!targetSectionId || roster.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.post<{ message: string; data: { count: number; date: string } }>(
        `${TEACHER_API}/attendance`,
        {
          class_section_id: targetSectionId,
          attendance_date: date,
          entries: roster.map((row) => ({
            student_user_id: row.student_user_id,
            status: draft[row.student_user_id] ?? row.status,
            notes: row.notes,
          })),
        }
      );
      await load();
      await feedback.success({
        title: 'Register saved',
        message: `${res.data.count} student${res.data.count === 1 ? '' : 's'} recorded for ${formatDate(
          res.data.date
        )}.`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the attendance register.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <TeacherShell
      title="Attendance"
      subtitle="Mark and review the daily class register"
      headerActions={
        <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      }
    >
      <div className="tp-page">
        <section className="tp-hero stem-animate-rise">
          <div className="tp-hero-copy">
            <p className="tp-eyebrow">Teacher portal · Attendance</p>
            <h2 className="tp-hero-title">Daily register</h2>
            <p className="tp-hero-lead">
              Pick a class and a date, then mark each learner as present, absent, late, or excused. Use the
              shortcuts to set the whole class at once and adjust the exceptions before you save.
            </p>
          </div>
        </section>

        <ErrorBanner error={error} onDismiss={() => setError(null)} />

        <StatStrip
          items={[
            { label: 'Students', value: String(stats.students), hint: sectionLabel ?? 'Enrolled in this class' },
            { label: 'Present', value: String(stats.present), hint: `${stats.late} late · ${stats.excused} excused` },
            { label: 'Absent', value: String(stats.absent), hint: `${stats.recorded} of ${stats.students} marked` },
            {
              label: 'Attendance rate',
              value: stats.rate === null ? '—' : `${stats.rate}%`,
              hint: 'Present and late as a share of marks',
            },
          ]}
        />

        <div className="tk-toolbar">
          <label className="tk-field tk-field-grow">
            <span>Class</span>
            <select value={selectedSection} onChange={(event) => setSectionId(event.target.value)}>
              {sections.length === 0 ? <option value="">No classes available</option> : null}
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.label} · {section.students_count} student{section.students_count === 1 ? '' : 's'}
                </option>
              ))}
            </select>
          </label>
          <label className="tk-field">
            <span>Date</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <div className="tk-toolbar-actions">
            <Button size="sm" type="button" variant="secondary" onClick={() => setDate(shiftDate(date, -1))}>
              Previous day
            </Button>
            <Button size="sm" type="button" variant="secondary" onClick={() => setDate(shiftDate(date, 1))}>
              Next day
            </Button>
            <Button size="sm" type="button" variant="ghost" onClick={() => setDate(todayIso())}>
              Today
            </Button>
          </div>
        </div>

        <div className="tp-layout">
          <Panel
            title="Register"
            description={
              loading
                ? 'Loading…'
                : `${formatDate(date)}${sectionLabel ? ` · ${sectionLabel}` : ''} — ${roster.length} learner${
                    roster.length === 1 ? '' : 's'
                  }`
            }
          >
            {roster.length === 0 && !loading ? (
              <EmptyState
                title="No learners in this class"
                message="Once students are enrolled in this section they will appear here ready to be marked."
              />
            ) : (
              <>
                <div className="tk-row" style={{ marginBottom: '0.85rem' }}>
                  <Button size="sm" type="button" variant="secondary" onClick={() => markAll('present')}>
                    Mark all present
                  </Button>
                  <Button size="sm" type="button" variant="secondary" onClick={() => markAll('absent')}>
                    Mark all absent
                  </Button>
                  <Button size="sm" type="button" variant="ghost" onClick={resetDraft} disabled={changedCount === 0}>
                    Reset
                  </Button>
                  <span className="tk-spacer" />
                  <span className="tp-muted" style={{ fontSize: '0.85rem' }}>
                    {changedCount > 0
                      ? `${changedCount} unsaved change${changedCount === 1 ? '' : 's'}`
                      : unmarkedCount > 0
                        ? `${unmarkedCount} learner${unmarkedCount === 1 ? '' : 's'} not yet marked`
                        : 'All marks saved'}
                  </span>
                </div>

                <div className="tk-roster">
                  {roster.map((row) => {
                    const status = draft[row.student_user_id] ?? row.status;
                    return (
                      <div
                        className={`tk-roster-row${status === 'present' ? '' : ` is-${status}`}`}
                        key={row.student_user_id}
                      >
                        <div className="tk-row" style={{ gap: '0.6rem' }}>
                          <div className="tk-person">
                            <span className="tk-avatar" aria-hidden="true">
                              {initials(row.student)}
                            </span>
                            <div>
                              <strong>{row.student}</strong>
                              <span>{row.email}</span>
                            </div>
                          </div>
                          {row.recorded ? null : <Pill label="unmarked" tone="muted" />}
                        </div>
                        <div className="tk-segmented" role="group" aria-label={`Attendance for ${row.student}`}>
                          {STATUSES.map((option) => (
                            <button
                              key={option}
                              type="button"
                              className={status === option ? 'is-active' : undefined}
                              data-status={option}
                              aria-pressed={status === option}
                              onClick={() => setStatus(row.student_user_id, option)}
                            >
                              {STATUS_LABEL[option]}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="tk-row" style={{ marginTop: '1rem' }}>
                  <Button
                    size="sm"
                    type="button"
                    variant="primary"
                    disabled={!dirty || saving || !targetSectionId}
                    onClick={() => void save()}
                  >
                    {saving ? 'Saving…' : 'Save register'}
                  </Button>
                  <Button
                    size="sm"
                    type="button"
                    variant="secondary"
                    disabled={changedCount === 0 || saving}
                    onClick={resetDraft}
                  >
                    Discard changes
                  </Button>
                </div>
              </>
            )}
          </Panel>

          <aside>
            <Panel title="Last 15 sessions" description="Recorded marks for this class, most recent first.">
              {history.length === 0 ? (
                <p className="tp-muted">No sessions have been recorded for this class yet.</p>
              ) : (
                <>
                  <div className="tk-bar-list">
                    {history.map((session) => {
                      const total = session.present + session.absent + session.late + session.excused;
                      const share = (count: number) => (total > 0 ? (count / total) * 100 : 0);
                      const rate = total > 0 ? Math.round(((session.present + session.late) / total) * 100) : 0;
                      return (
                        <div className="tk-bar-row" key={session.date}>
                          <span>{formatDate(session.date)}</span>
                          <span
                            className="tk-bar-track"
                            title={`${session.present} present · ${session.late} late · ${session.absent} absent · ${session.excused} excused`}
                          >
                            {BAR_ORDER.map((option) => (
                              <span
                                key={option}
                                className={`tk-bar-seg is-${option}`}
                                style={{ width: `${share(session[option])}%` }}
                              />
                            ))}
                          </span>
                          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{rate}%</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="tk-legend" style={{ marginTop: '0.85rem' }}>
                    {BAR_ORDER.map((option) => (
                      <span key={option}>
                        <i style={{ background: STATUS_COLOUR[option] }} aria-hidden="true" />
                        {STATUS_LABEL[option]}
                      </span>
                    ))}
                  </div>
                  <p className="tp-muted" style={{ marginTop: '0.75rem', fontSize: '0.82rem' }}>
                    The percentage on the right counts present and late marks as attending.
                  </p>
                </>
              )}
            </Panel>
          </aside>
        </div>
      </div>
    </TeacherShell>
  );
}
