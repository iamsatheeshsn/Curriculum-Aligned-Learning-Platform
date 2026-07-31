import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import {
  Button,
  FormActions,
  Panel,
  SelectField,
  StatStrip,
  TextField,
  useFeedback,
  validateFormFields,
} from '@stemora/ui';
import {
  StatusPill,
  TUTOR_API,
  TutorShell,
  formatWhen,
  personName,
} from './shared';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type StudentRow = {
  user_id: number;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  status?: string;
  sessions_count: number;
  last_session_at: string | null;
  upcoming_count: number;
};

type SessionRow = {
  id: number;
  starts_at?: string | null;
  ends_at?: string | null;
  status: string;
  meeting_url?: string | null;
  subject?: { name_en?: string } | string | null;
  participants?: { id: number; first_name?: string; last_name?: string; email?: string }[];
  students?: string[];
};

function subjectLabel(s: SessionRow) {
  if (typeof s.subject === 'string') return s.subject;
  return s.subject?.name_en || 'Tutoring session';
}

function studentLabels(s: SessionRow) {
  if (s.students?.length) return s.students.join(', ');
  return (s.participants ?? [])
    .map((p) => personName(p.first_name, p.last_name, p.email))
    .join(', ') || '—';
}

async function loadTutorProfileId(api: { get: <T>(url: string) => Promise<T> }) {
  const res = await api.get<{ data: { tutor_profile?: { id: number } | null } }>(`${TUTOR_API}/profile`);
  return res.data.tutor_profile?.id ?? null;
}

export function TutorStudentsPage() {
  const { tenantSlug = 'al-noor' } = useParams();
  const { api } = useAuth();
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [stats, setStats] = useState<{ total: number; with_upcoming: number } | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: StudentRow[]; meta?: { stats?: { total: number; with_upcoming: number } } }>(
        `${TUTOR_API}/students`,
      );
      setRows(res.data ?? []);
      setStats(res.meta?.stats ?? null);
      setSelectedId((cur) => cur ?? res.data[0]?.user_id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load students.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      personName(r.first_name, r.last_name, r.email).toLowerCase().includes(q) ||
      (r.email ?? '').toLowerCase().includes(q),
    );
  }, [rows, search]);

  const selected = filtered.find((r) => r.user_id === selectedId) ?? null;

  return (
    <TutorShell title="My Students" subtitle="Learners linked to your tutoring sessions">
      <div className="tp-page">
        <section className="tp-hero stem-animate-rise">
          <div>
            <p className="tp-eyebrow">Tutor portal · Roster</p>
            <h2 className="tp-hero-title">My students</h2>
            <p className="tp-hero-lead">
              Students who have booked or attended sessions with you. Open progress to review attendance history.
            </p>
          </div>
          <div className="tp-hero-actions">
            <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>
        </section>
        {error ? <div className="tp-alert">{error}</div> : null}
        <StatStrip
          items={[
            { label: 'Students', value: String(stats?.total ?? rows.length) },
            { label: 'With upcoming', value: String(stats?.with_upcoming ?? '—') },
          ]}
        />
        <div className="tp-layout">
          <Panel
            title="Student directory"
            description="Select a student to review session activity."
            action={
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or email"
                aria-label="Search students"
                style={{ minHeight: 38, borderRadius: 10, border: '1px solid rgba(12,124,128,0.25)', padding: '0.4rem 0.65rem' }}
              />
            }
          >
            <div className="tp-table-wrap">
              <table className="tp-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Sessions</th>
                    <th>Upcoming</th>
                    <th>Last session</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="tp-empty">
                        {loading ? 'Loading…' : 'No students linked to your sessions yet.'}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((row) => (
                      <tr
                        key={row.user_id}
                        className={selectedId === row.user_id ? 'is-selected' : undefined}
                        onClick={() => setSelectedId(row.user_id)}
                      >
                        <td>
                          <strong>{personName(row.first_name, row.last_name, row.email)}</strong>
                          <div className="tp-muted">{row.email}</div>
                        </td>
                        <td>{row.sessions_count}</td>
                        <td>{row.upcoming_count}</td>
                        <td>{formatWhen(row.last_session_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
          <aside>
            {selected ? (
              <Panel title={personName(selected.first_name, selected.last_name, selected.email)}>
                <dl className="tp-meta">
                  <div>
                    <dt>Email</dt>
                    <dd>{selected.email ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Sessions</dt>
                    <dd>{selected.sessions_count}</dd>
                  </div>
                  <div>
                    <dt>Upcoming</dt>
                    <dd>{selected.upcoming_count}</dd>
                  </div>
                  <div>
                    <dt>Last session</dt>
                    <dd>{formatWhen(selected.last_session_at)}</dd>
                  </div>
                </dl>
                <div className="tp-actions">
                  <Button size="sm" to={`/${tenantSlug}/student-progress?student=${selected.user_id}`} variant="primary">
                    View progress
                  </Button>
                  <Button size="sm" to={`/${tenantSlug}/session-schedule`} variant="secondary">
                    Schedule
                  </Button>
                </div>
              </Panel>
            ) : (
              <Panel title="Student detail">
                <p className="tp-muted">Select a student from the directory.</p>
              </Panel>
            )}
          </aside>
        </div>
      </div>
    </TutorShell>
  );
}

export function TutorSchedulePage() {
  const { tenantSlug = 'al-noor' } = useParams();
  const { api } = useAuth();
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const profileId = await loadTutorProfileId(api);
      const params = new URLSearchParams({ per_page: '50' });
      if (profileId) params.set('tutor_profile_id', String(profileId));
      if (status) params.set('status', status);
      const res = await api.get<{ data: SessionRow[] } | SessionRow[]>(`/org/tutoring-sessions?${params}`);
      const list = Array.isArray(res) ? res : (res as { data: SessionRow[] }).data ?? [];
      // Laravel paginator returns { data: [...] } at top level sometimes
      const items = Array.isArray((res as { data?: SessionRow[] }).data)
        ? (res as { data: SessionRow[] }).data
        : list;
      setRows(items);
      setSelectedId((cur) => cur ?? items[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schedule.');
    } finally {
      setLoading(false);
    }
  }, [api, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  return (
    <TutorShell title="Session Schedule" subtitle="Plan and review your tutoring timetable">
      <div className="tp-page">
        <section className="tp-hero stem-animate-rise">
          <div>
            <p className="tp-eyebrow">Tutor portal · Schedule</p>
            <h2 className="tp-hero-title">Session schedule</h2>
            <p className="tp-hero-lead">All sessions assigned to you, newest first. Filter by status to focus on what matters today.</p>
          </div>
          <div className="tp-hero-actions">
            <Button size="sm" to={`/${tenantSlug}/live-sessions`} variant="primary">
              Live sessions
            </Button>
            <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>
        </section>
        {error ? <div className="tp-alert">{error}</div> : null}
        <div className="tp-toolbar">
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              <option value="scheduled">Scheduled</option>
              <option value="confirmed">Confirmed</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        </div>
        <div className="tp-layout">
          <Panel title="Schedule" description={`${rows.length} sessions`}>
            <div className="tp-table-wrap">
              <table className="tp-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Subject</th>
                    <th>Students</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="tp-empty">
                        {loading ? 'Loading…' : 'No sessions found.'}
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr
                        key={row.id}
                        className={selectedId === row.id ? 'is-selected' : undefined}
                        onClick={() => setSelectedId(row.id)}
                      >
                        <td>{formatWhen(row.starts_at)}</td>
                        <td>{subjectLabel(row)}</td>
                        <td>{studentLabels(row)}</td>
                        <td>
                          <StatusPill status={row.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
          <aside>
            <Panel title="Session detail">
              {!selected ? (
                <p className="tp-muted">Select a session.</p>
              ) : (
                <>
                  <dl className="tp-meta">
                    <div>
                      <dt>Subject</dt>
                      <dd>{subjectLabel(selected)}</dd>
                    </div>
                    <div>
                      <dt>Starts</dt>
                      <dd>{formatWhen(selected.starts_at)}</dd>
                    </div>
                    <div>
                      <dt>Ends</dt>
                      <dd>{formatWhen(selected.ends_at)}</dd>
                    </div>
                    <div>
                      <dt>Students</dt>
                      <dd>{studentLabels(selected)}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <StatusPill status={selected.status} />
                      </dd>
                    </div>
                  </dl>
                  <div className="tp-actions">
                    <Button size="sm" to={`/${tenantSlug}/live-sessions?session=${selected.id}`} variant="primary">
                      Open live tools
                    </Button>
                    <Button size="sm" to={`/${tenantSlug}/session-notes?session=${selected.id}`} variant="secondary">
                      Notes
                    </Button>
                  </div>
                </>
              )}
            </Panel>
          </aside>
        </div>
      </div>
    </TutorShell>
  );
}

export function TutorAvailabilityPage() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [weekly, setWeekly] = useState<
    { id: number; weekday: number; start_time: string; end_time: string; slot_minutes: number; is_active: boolean }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weekday, setWeekday] = useState('3');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('12:00');
  const [slotMinutes, setSlotMinutes] = useState('60');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: { availability: { weekly: typeof weekly } } }>(`${TUTOR_API}/workspace`);
      setWeekly(res.data.availability?.weekly ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load availability.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateFormFields(e.currentTarget)) return;
    setSaving(true);
    try {
      await api.post(`${TUTOR_API}/availability`, {
        weekday: Number(weekday),
        start_time: startTime,
        end_time: endTime,
        slot_minutes: Number(slotMinutes),
      });
      await feedback.success({ title: 'Slot added', message: 'Weekly availability updated.' });
      await load();
    } catch (err) {
      await feedback.error({
        title: 'Could not save',
        message: err instanceof Error ? err.message : 'Unable to add availability.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <TutorShell title="Availability" subtitle="Weekly windows students can book">
      <div className="tp-page">
        <section className="tp-hero stem-animate-rise">
          <div>
            <p className="tp-eyebrow">Tutor portal · Availability</p>
            <h2 className="tp-hero-title">Set your open hours</h2>
            <p className="tp-hero-lead">
              Publish recurring weekly slots. Families and booking tools use these windows when scheduling sessions.
            </p>
          </div>
        </section>
        {error ? <div className="tp-alert">{error}</div> : null}
        <StatStrip items={[{ label: 'Weekly slots', value: String(weekly.length) }]} />
        <div className="tp-layout">
          <Panel title="Weekly schedule" description={loading ? 'Loading…' : `${weekly.length} active windows`}>
            <div className="tp-table-wrap">
              <table className="tp-table">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Slot</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {weekly.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="tp-empty">
                        No weekly availability yet.
                      </td>
                    </tr>
                  ) : (
                    weekly.map((row) => (
                      <tr key={row.id}>
                        <td>{WEEKDAYS[row.weekday] ?? row.weekday}</td>
                        <td>{row.start_time}</td>
                        <td>{row.end_time}</td>
                        <td>{row.slot_minutes} min</td>
                        <td>
                          <StatusPill status={row.is_active ? 'active' : 'inactive'} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
          <aside>
            <Panel title="Add weekly slot">
              <form className="tp-form" onSubmit={onSave} noValidate>
                <SelectField label="Weekday" required value={weekday} onChange={(e) => setWeekday(e.target.value)}>
                  {WEEKDAYS.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </SelectField>
                <TextField label="Start" required type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                <TextField label="End" required type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                <TextField
                  label="Slot minutes"
                  required
                  type="number"
                  min={15}
                  value={slotMinutes}
                  onChange={(e) => setSlotMinutes(e.target.value)}
                />
                <FormActions>
                  <Button size="sm" type="submit" variant="primary" disabled={saving}>
                    {saving ? 'Saving…' : 'Add slot'}
                  </Button>
                </FormActions>
              </form>
            </Panel>
          </aside>
        </div>
      </div>
    </TutorShell>
  );
}
