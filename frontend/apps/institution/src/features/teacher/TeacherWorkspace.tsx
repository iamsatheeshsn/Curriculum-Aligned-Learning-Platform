import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import {
  Button,
  ConfirmButton,
  FormActions,
  Panel,
  PortalShell,
  SelectField,
  StatStrip,
  TextField,
  useFeedback,
  useResolvedTenant,
  validateFormFields,
} from '@stemora/ui';
import { useInstitutionNav } from '../../nav';

type TabId = 'classes' | 'assignments' | 'tutoring';

type WorkspaceData = {
  school: { id: number; name_en: string; name_ar?: string; code: string; timezone?: string | null };
  capabilities: {
    classes: boolean;
    assignments: boolean;
    grading: boolean;
    tutoring: boolean;
    manage_availability: boolean;
  };
  tutor_profile: { id: number; status: string; bio_en?: string | null } | null;
  stats: {
    classes: number;
    assignments: number;
    to_grade: number;
    upcoming_sessions: number;
    open_slots: number;
    weekly_slots: number;
  };
  classes: {
    id: number;
    code: string;
    name_en: string;
    status: string;
    grade?: string | null;
    campus?: string | null;
    sections: { id: number; name: string; section_code?: string | null; status: string }[];
  }[];
  homework: {
    id: number;
    title_en: string;
    status: string;
    due_at: string | null;
    submissions_count: number;
    max_score?: number | null;
    is_scored?: boolean;
  }[];
  assessments: {
    id: number;
    title_en: string;
    type: string;
    status: string;
    due_at: string | null;
  }[];
  sessions: {
    id: number;
    starts_at: string | null;
    ends_at: string | null;
    status: string;
    language: string | null;
    session_type: string | null;
    meeting_url: string | null;
    subject: string | null;
    tutor: string | null;
    students: string[];
  }[];
  availability: {
    weekly: {
      id: number;
      weekday: number;
      start_time: string;
      end_time: string;
      slot_minutes: number;
      is_active: boolean;
      timezone?: string | null;
    }[];
    open_slots: { starts_at?: string; ends_at?: string; start?: string; end?: string }[];
    slot_date: string;
  };
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatWhen(iso: string | null | undefined) {
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

function statusTone(status: string) {
  const s = status.toLowerCase();
  if (['active', 'published', 'scheduled', 'confirmed', 'completed'].includes(s)) return 'ok';
  if (['draft', 'in_progress'].includes(s)) return 'info';
  if (['cancelled', 'closed', 'inactive', 'no_show'].includes(s)) return 'muted';
  return 'warn';
}

export function TeacherWorkspace() {
  const { tenantSlug = 'al-noor' } = useParams();
  const { session, logout, api, roles } = useAuth();
  const feedback = useFeedback();
  const nav = useInstitutionNav(tenantSlug);
  const tenant = useResolvedTenant();
  const isTutor = roles.includes('tutor') && !roles.includes('teacher');
  const brandCaption = isTutor ? 'Tutor portal' : 'Institution portal';
  const brandName = tenant?.name || tenantSlug;
  const pageTitle = isTutor ? 'Tutor workspace' : 'Teacher workspace';
  const pageSubtitle = isTutor
    ? 'Students, sessions, availability, and earnings'
    : 'Classes, assignments, tutoring slots';

  const [tab, setTab] = useState<TabId>('classes');
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slotDate, setSlotDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState<string | null>(null);

  const [hwTitle, setHwTitle] = useState('');
  const [hwDue, setHwDue] = useState('');
  const [hwStatus, setHwStatus] = useState('published');

  const [weekday, setWeekday] = useState('3');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('12:00');
  const [slotMinutes, setSlotMinutes] = useState('60');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = slotDate ? `?slot_date=${encodeURIComponent(slotDate)}` : '';
      const res = await api.get<{ data: WorkspaceData }>(`/org/teacher/workspace${qs}`);
      setData(res.data);
      if (!slotDate && res.data.availability.slot_date) {
        setSlotDate(res.data.availability.slot_date);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load teacher workspace');
    } finally {
      setLoading(false);
    }
  }, [api, slotDate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data) return;
    if (tab === 'assignments' && !data.capabilities.assignments && data.capabilities.tutoring) {
      // keep tab; show empty state with capability message
    }
  }, [data, tab]);

  const schoolName = data?.school.name_en ?? 'School';

  const openSlots = useMemo(() => {
    return (data?.availability.open_slots ?? []).map((slot, index) => {
      const start = slot.starts_at ?? slot.start ?? null;
      const end = slot.ends_at ?? slot.end ?? null;
      return { id: `${start}-${index}`, start, end };
    });
  }, [data?.availability.open_slots]);

  async function createHomework(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateFormFields(e.currentTarget)) return;
    setBusy('homework');
    setError(null);
    try {
      await api.post('/org/teacher/homework', {
        title_en: hwTitle.trim(),
        title_ar: hwTitle.trim(),
        due_at: hwDue || null,
        status: hwStatus,
      });
      setHwTitle('');
      setHwDue('');
      await feedback.success({ title: 'Assignment published', message: 'Students can now see this homework.' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create assignment');
    } finally {
      setBusy(null);
    }
  }

  async function createAvailability(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateFormFields(e.currentTarget)) return;
    setBusy('availability');
    setError(null);
    try {
      await api.post('/org/teacher/availability', {
        weekday: Number(weekday),
        start_time: startTime,
        end_time: endTime,
        slot_minutes: Number(slotMinutes) || 60,
      });
      await feedback.success({ title: 'Slot added', message: 'Weekly tutoring availability was updated.' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save availability');
    } finally {
      setBusy(null);
    }
  }

  async function openClassroom(sessionId: number) {
    setBusy(`class-${sessionId}`);
    try {
      const res = await api.get<{ data: { meeting_url?: string; join_url?: string; url?: string } }>(
        `/org/tutoring-sessions/${sessionId}/classroom`,
      );
      const url = res.data.join_url ?? res.data.meeting_url ?? res.data.url;
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
        await feedback.success({ title: 'Classroom ready', message: 'Opened the live tutoring classroom link.' });
      } else {
        await feedback.success({ title: 'Classroom', message: 'Classroom payload received — no meeting URL yet.' });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open classroom');
    } finally {
      setBusy(null);
    }
  }

  async function completeSession(sessionId: number) {
    setBusy(`done-${sessionId}`);
    try {
      await api.post(`/org/tutoring-sessions/${sessionId}/complete`);
      await feedback.success({ title: 'Session completed', message: 'Attendance and minutes can be reviewed in reports.' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete session');
    } finally {
      setBusy(null);
    }
  }

  return (
    <PortalShell
      portal="institution"
      brandCaption={brandCaption}
      brandName={brandName}
      title={pageTitle}
      subtitle={`${schoolName} · ${pageSubtitle}`}
      nav={nav}
      userLabel={session?.user.email}
      userName={session?.user.name}
      onLogout={logout}
      changePasswordTo={`/${tenantSlug}/change-password`}
      collapsible
    >
      <div className="tw">
        {error ? <div className="tw-alert">{error}</div> : null}

        <section className="tw-hero stem-animate-rise">
          <div>
            <p className="tw-eyebrow">Teaching desk</p>
            <h2 className="tw-title">Plan classes, publish work, run live tutoring</h2>
            <p className="tw-lead">
              Your operational board for {schoolName}. Switch between class structure, student assignments, and tutoring
              availability without leaving this page.
            </p>
            <div className="tw-hero-actions">
              <Button size="sm" type="button" variant="primary" onClick={() => setTab('tutoring')}>
                Manage tutoring slots
              </Button>
              <Button size="sm" type="button" variant="secondary" onClick={() => setTab('assignments')}>
                Review assignments
              </Button>
              <Link className="tw-link" to={`/${tenantSlug}`}>
                ← Back to school home
              </Link>
            </div>
          </div>
          <div className="tw-hero-aside" aria-hidden>
            <span>Today</span>
            <strong>{data?.stats.upcoming_sessions ?? '—'} upcoming</strong>
            <p>
              {data?.stats.open_slots ?? 0} open slots · {data?.stats.to_grade ?? 0} to grade
            </p>
          </div>
        </section>

        {loading && !data ? (
          <p className="tw-muted">Loading workspace…</p>
        ) : (
          <>
            <StatStrip
              items={[
                { label: 'My classes', value: String(data?.stats.classes ?? '—') },
                { label: 'Assignments', value: String(data?.stats.assignments ?? '—') },
                { label: 'To grade', value: String(data?.stats.to_grade ?? '—') },
                { label: 'Open slots', value: String(data?.stats.open_slots ?? data?.stats.weekly_slots ?? '—') },
              ]}
            />

            <div className="tw-tabs" role="tablist" aria-label="Teacher workspace">
              {(
                [
                  { id: 'classes', label: 'Classes' },
                  { id: 'assignments', label: 'Assignments' },
                  { id: 'tutoring', label: 'Tutoring slots' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.id}
                  className={tab === item.id ? 'is-active' : undefined}
                  onClick={() => setTab(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {tab === 'classes' ? (
              <Panel
                title="Classes & sections"
                description={
                  data?.capabilities.classes
                    ? 'Active class groups for this school campus.'
                    : 'Your role cannot view class structure yet.'
                }
              >
                {!data?.capabilities.classes ? (
                  <p className="tw-muted">Ask a school admin to grant curriculum or academics access.</p>
                ) : data.classes.length === 0 ? (
                  <p className="tw-muted">No classes are set up yet.</p>
                ) : (
                  <div className="tw-class-grid">
                    {data.classes.map((cls) => (
                      <article key={cls.id} className="tw-class-card">
                        <header>
                          <div>
                            <strong>{cls.name_en}</strong>
                            <span>
                              {cls.code}
                              {cls.grade ? ` · ${cls.grade}` : ''}
                              {cls.campus ? ` · ${cls.campus}` : ''}
                            </span>
                          </div>
                          <em className={`tw-badge is-${statusTone(cls.status)}`}>{cls.status}</em>
                        </header>
                        <ul>
                          {cls.sections.length === 0 ? (
                            <li className="tw-muted">No sections</li>
                          ) : (
                            cls.sections.map((section) => (
                              <li key={section.id}>
                                <span>
                                  {section.name}
                                  {section.section_code ? ` (${section.section_code})` : ''}
                                </span>
                                <em className={`tw-badge is-${statusTone(section.status)}`}>{section.status}</em>
                              </li>
                            ))
                          )}
                        </ul>
                      </article>
                    ))}
                  </div>
                )}
              </Panel>
            ) : null}

            {tab === 'assignments' ? (
              <div className="tw-grid">
                <Panel title="Homework & assessments" description="Published work and items awaiting review.">
                  {!data?.capabilities.assignments && !data?.capabilities.grading ? (
                    <p className="tw-muted">
                      Assignment publishing needs the <code>learning.content.assign</code> permission. Tutors can still
                      run tutoring from the Tutoring slots tab.
                    </p>
                  ) : (
                    <>
                      <h3 className="tw-subhead">Homework</h3>
                      {data.homework.length === 0 ? (
                        <p className="tw-muted">No homework yet.</p>
                      ) : (
                        <ul className="tw-list">
                          {data.homework.map((hw) => (
                            <li key={hw.id}>
                              <div>
                                <strong>{hw.title_en}</strong>
                                <span>
                                  {hw.submissions_count} submission(s)
                                  {hw.due_at ? ` · due ${formatWhen(hw.due_at)}` : ''}
                                </span>
                              </div>
                              <em className={`tw-badge is-${statusTone(hw.status)}`}>{hw.status}</em>
                            </li>
                          ))}
                        </ul>
                      )}

                      <h3 className="tw-subhead">Assessments</h3>
                      {data.assessments.length === 0 ? (
                        <p className="tw-muted">No assessments listed.</p>
                      ) : (
                        <ul className="tw-list">
                          {data.assessments.map((a) => (
                            <li key={a.id}>
                              <div>
                                <strong>{a.title_en}</strong>
                                <span>
                                  {a.type}
                                  {a.due_at ? ` · until ${formatWhen(a.due_at)}` : ''}
                                </span>
                              </div>
                              <em className={`tw-badge is-${statusTone(a.status)}`}>{a.status}</em>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </Panel>

                <Panel title="Publish homework" description="Create a quick assignment for your classes.">
                  {!data?.capabilities.assignments ? (
                    <p className="tw-muted">Your role cannot publish assignments.</p>
                  ) : (
                    <form className="tw-form" onSubmit={createHomework} noValidate>
                      <TextField
                        label="Title"
                        required
                        value={hwTitle}
                        onChange={(e) => setHwTitle(e.target.value)}
                        placeholder="Week 4 — Algebra practice"
                      />
                      <TextField
                        label="Due at"
                        type="datetime-local"
                        value={hwDue}
                        onChange={(e) => setHwDue(e.target.value)}
                      />
                      <SelectField label="Status" value={hwStatus} onChange={(e) => setHwStatus(e.target.value)}>
                        <option value="published">Published</option>
                        <option value="draft">Draft</option>
                        <option value="closed">Closed</option>
                      </SelectField>
                      <FormActions>
                        <Button size="sm" type="submit" variant="apricot" disabled={busy === 'homework'}>
                          {busy === 'homework' ? 'Publishing…' : 'Publish assignment'}
                        </Button>
                      </FormActions>
                    </form>
                  )}
                </Panel>
              </div>
            ) : null}

            {tab === 'tutoring' ? (
              <div className="tw-grid tw-grid-wide">
                <Panel title="Sessions" description="Your tutoring timeline for this school.">
                  {!data?.capabilities.tutoring ? (
                    <p className="tw-muted">Tutoring tools are not enabled for your role.</p>
                  ) : data.sessions.length === 0 ? (
                    <p className="tw-muted">No tutoring sessions yet.</p>
                  ) : (
                    <ul className="tw-session-list">
                      {data.sessions.map((s) => (
                        <li key={s.id}>
                          <div className="tw-session-main">
                            <strong>{s.subject || 'Tutoring session'}</strong>
                            <span>
                              {formatWhen(s.starts_at)}
                              {s.language ? ` · ${s.language.toUpperCase()}` : ''}
                              {s.students?.length ? ` · ${s.students.join(', ')}` : ''}
                            </span>
                            <em className={`tw-badge is-${statusTone(s.status)}`}>{s.status}</em>
                          </div>
                          <div className="tw-session-actions">
                            <Button size="sm"
                              type="button"
                              variant="secondary"
                              disabled={busy === `class-${s.id}`}
                              onClick={() => void openClassroom(s.id)}
                            >
                              {busy === `class-${s.id}` ? 'Opening…' : 'Open classroom'}
                            </Button>
                            {s.status !== 'completed' && s.status !== 'cancelled' ? (
                              <ConfirmButton size="sm"
                                title="Mark session complete?"
                                message="This closes the live session and records completion for reports."
                                confirmLabel="Complete"
                                tone="primary"
                                variant="primary"
                                onConfirm={() => completeSession(s.id)}
                              >
                                {busy === `done-${s.id}` ? 'Saving…' : 'Complete'}
                              </ConfirmButton>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>

                <div className="tw-stack">
                  <Panel title="Weekly availability" description="Recurring windows students can book.">
                    {data?.availability.weekly.length ? (
                      <ul className="tw-list">
                        {data.availability.weekly.map((slot) => (
                          <li key={slot.id}>
                            <div>
                              <strong>{WEEKDAYS[slot.weekday] ?? `Day ${slot.weekday}`}</strong>
                              <span>
                                {slot.start_time}–{slot.end_time} · {slot.slot_minutes} min
                                {slot.timezone ? ` · ${slot.timezone}` : ''}
                              </span>
                            </div>
                            <em className={`tw-badge is-${slot.is_active ? 'ok' : 'muted'}`}>
                              {slot.is_active ? 'active' : 'off'}
                            </em>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="tw-muted">No weekly slots yet. Add one below.</p>
                    )}
                  </Panel>

                  <Panel title="Open slots" description="Bookable times for the selected date.">
                    <div className="tw-slot-date">
                      <TextField
                        label="Date"
                        type="date"
                        value={slotDate}
                        onChange={(e) => setSlotDate(e.target.value)}
                      />
                      <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
                        Load slots
                      </Button>
                    </div>
                    {openSlots.length === 0 ? (
                      <p className="tw-muted">No open slots on this date.</p>
                    ) : (
                      <div className="tw-chip-row">
                        {openSlots.map((slot) => (
                          <span key={slot.id} className="tw-chip">
                            {formatWhen(slot.start)}
                          </span>
                        ))}
                      </div>
                    )}
                  </Panel>

                  <Panel title="Add tutoring slot" description="Create a weekly availability window.">
                    {!data?.capabilities.manage_availability ? (
                      <p className="tw-muted">You cannot edit availability.</p>
                    ) : !data.tutor_profile ? (
                      <p className="tw-muted">No tutor profile is linked to your account yet.</p>
                    ) : (
                      <form className="tw-form" onSubmit={createAvailability} noValidate>
                        <SelectField label="Weekday" required value={weekday} onChange={(e) => setWeekday(e.target.value)}>
                          {WEEKDAYS.map((label, index) => (
                            <option key={label} value={index}>
                              {label}
                            </option>
                          ))}
                        </SelectField>
                        <div className="tw-form-row">
                          <TextField
                            label="Start"
                            type="time"
                            required
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                          />
                          <TextField
                            label="End"
                            type="time"
                            required
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                          />
                        </div>
                        <SelectField
                          label="Slot length"
                          value={slotMinutes}
                          onChange={(e) => setSlotMinutes(e.target.value)}
                        >
                          <option value="30">30 minutes</option>
                          <option value="45">45 minutes</option>
                          <option value="60">60 minutes</option>
                          <option value="90">90 minutes</option>
                        </SelectField>
                        <FormActions>
                          <Button size="sm" type="submit" variant="apricot" disabled={busy === 'availability'}>
                            {busy === 'availability' ? 'Saving…' : 'Add weekly slot'}
                          </Button>
                        </FormActions>
                      </form>
                    )}
                  </Panel>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      <style>{teacherStyles}</style>
    </PortalShell>
  );
}

const teacherStyles = `
.tw { display: grid; gap: 1rem; }
.tw-alert {
  padding: 0.75rem 1rem;
  border-radius: 12px;
  background: #fef3f2;
  color: var(--stem-danger);
  border: 1px solid #fecdca;
  font-size: var(--stem-text-base);
}
.tw-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(200px, 0.65fr);
  gap: 1.1rem;
  padding: 1.3rem 1.35rem;
  border-radius: 22px;
  border: 1px solid var(--stem-line);
  background:
    radial-gradient(ellipse 50% 80% at 0% 0%, rgba(232,137,74,0.14), transparent 55%),
    linear-gradient(145deg, #fff, rgba(238,248,246,0.92));
  box-shadow: var(--stem-shadow);
}
.tw-eyebrow {
  margin: 0 0 0.35rem;
  font-size: var(--stem-text-sm);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--stem-apricot-deep);
}
.tw-title {
  margin: 0 0 0.5rem;
  font-family: var(--stem-font-display);
  font-size: clamp(1.45rem, 2.6vw, 1.95rem);
  line-height: 1.2;
}
.tw-lead {
  margin: 0 0 1rem;
  max-width: 48ch;
  color: var(--stem-ink-soft);
  font-size: 0.96rem;
  line-height: 1.55;
}
.tw-hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  align-items: center;
}
.tw-link {
  font-size: var(--stem-text-md);
  font-weight: 600;
  color: var(--stem-teal-deep);
}
.tw-hero-aside {
  border-radius: 18px;
  padding: 1.1rem;
  color: #fff;
  background: linear-gradient(145deg, #055456, #0c7c80 55%, #e98945);
  display: grid;
  align-content: end;
  gap: 0.2rem;
  min-height: 150px;
}
.tw-hero-aside span {
  font-size: var(--stem-text-xs);
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  opacity: 0.85;
}
.tw-hero-aside strong {
  font-family: var(--stem-font-display);
  font-size: var(--stem-text-2xl);
}
.tw-hero-aside p { margin: 0; font-size: var(--stem-text-md); opacity: 0.9; }
.tw-tabs {
  display: inline-flex;
  gap: 0.35rem;
  padding: 0.3rem;
  border-radius: 14px;
  background: rgba(255,255,255,0.85);
  border: 1px solid var(--stem-line);
  width: fit-content;
  flex-wrap: wrap;
}
.tw-tabs button {
  border: none;
  background: transparent;
  padding: 0.55rem 1rem;
  border-radius: 10px;
  font: inherit;
  font-weight: 600;
  font-size: var(--stem-text-md);
  color: var(--stem-ink-soft);
  cursor: pointer;
}
.tw-tabs button.is-active {
  background: linear-gradient(135deg, var(--stem-teal-bright), var(--stem-teal-deep));
  color: #fff;
  box-shadow: 0 8px 18px rgba(5, 84, 86, 0.18);
}
.tw-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(260px, 0.85fr);
  gap: 1rem;
  align-items: start;
}
.tw-grid-wide { grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.9fr); }
.tw-stack { display: grid; gap: 1rem; }
.tw-class-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
  gap: 0.75rem;
}
.tw-class-card {
  border: 1px solid var(--stem-line);
  border-radius: 16px;
  background: #fff;
  padding: 0.95rem;
  display: grid;
  gap: 0.7rem;
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
}
.tw-class-card header {
  display: flex;
  justify-content: space-between;
  gap: 0.6rem;
  align-items: start;
  min-width: 0;
}
.tw-class-card header > *:first-child {
  min-width: 0;
  flex: 1 1 auto;
}
.tw-class-card strong {
  display: block;
  font-size: 1rem;
  overflow-wrap: anywhere;
}
.tw-class-card span, .tw-list span {
  display: block;
  margin-top: 0.2rem;
  font-size: var(--stem-text-md);
  color: var(--stem-ink-soft);
  overflow-wrap: anywhere;
}
.tw-class-card ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.4rem;
  min-width: 0;
}
.tw-class-card li {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  align-items: center;
  padding: 0.45rem 0.55rem;
  border-radius: 10px;
  min-width: 0;
  background: var(--stem-mint-soft);
  font-size: var(--stem-text-md);
}
.tw-class-card li > *:first-child {
  min-width: 0;
  flex: 1 1 auto;
  overflow-wrap: anywhere;
}
.tw-badge {
  font-style: normal;
  text-transform: capitalize;
}
.tw-badge.is-ok { background: rgba(15,122,69,0.12); color: #0f7a45; }
.tw-badge.is-info { background: rgba(12,124,128,0.12); color: var(--stem-teal-deep); }
.tw-badge.is-warn { background: rgba(232,137,74,0.16); color: var(--stem-apricot-deep); }
.tw-badge.is-muted { background: #f2f4f7; color: #667085; }
.tw-list, .tw-session-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.55rem;
}
.tw-list li, .tw-session-list li {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: flex-start;
  padding: 0.7rem 0.15rem;
  border-bottom: 1px solid var(--stem-line);
}
.tw-list li:last-child, .tw-session-list li:last-child { border-bottom: none; }
.tw-session-list li {
  flex-direction: column;
  align-items: stretch;
  gap: 0.65rem;
}
.tw-session-main { display: grid; gap: 0.25rem; }
.tw-session-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}
.tw-subhead {
  margin: 0.85rem 0 0.45rem;
  font-size: var(--stem-text-md);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--stem-ink-soft);
}
.tw-form { display: grid; gap: 0.85rem; }
.tw-form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.65rem;
}
.tw-slot-date {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.65rem;
  align-items: end;
  margin-bottom: 0.75rem;
}
.tw-chip-row { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.tw-chip {
  display: inline-flex;
  padding: 0.35rem 0.65rem;
  border-radius: 999px;
  background: var(--stem-mint-soft);
  border: 1px solid rgba(12,124,128,0.18);
  font-size: var(--stem-text-sm);
  font-weight: 600;
  color: var(--stem-teal-deep);
}
.tw-muted { margin: 0; color: var(--stem-ink-soft); }
.tw-muted code {
  font-size: var(--stem-text-sm);
  background: var(--stem-mint-soft);
  padding: 0.1rem 0.35rem;
  border-radius: 6px;
}
@media (max-width: 980px) {
  .tw-hero, .tw-grid, .tw-grid-wide, .tw-form-row, .tw-slot-date { grid-template-columns: 1fr; }
}
`;
