import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import {
  Button,
  FormActions,
  Panel,
  SelectField,
  StatStrip,
  TextAreaField,
  TextField,
  useFeedback,
  validateFormFields,
} from '@stemora/ui';
import {
  LEARNER_API,
  LearnerShell,
  STUDENT_API,
  StatusPill,
  formatWhen,
  personName,
} from '../shared/shared';

const TIMEZONES = [
  'Asia/Riyadh',
  'Asia/Dubai',
  'Asia/Kuwait',
  'Asia/Bahrain',
  'Asia/Qatar',
  'Asia/Muscat',
  'Africa/Cairo',
  'Europe/London',
  'UTC',
];

type SessionRow = {
  id: number;
  starts_at?: string | null;
  ends_at?: string | null;
  status?: string;
  meeting_url?: string | null;
  subject?: { name_en?: string } | string | null;
  tutor?: {
    user?: { first_name?: string | null; last_name?: string | null };
  } | null;
};

type TutorRow = {
  id: number;
  status?: string;
  bio_en?: string | null;
  ratings_avg_rating?: number | string | null;
  user?: { first_name?: string | null; last_name?: string | null; email?: string | null };
  subjects?: { id: number; name_en?: string; code?: string }[];
};

type MessageRow = {
  id: number;
  subject?: string;
  body?: string;
  direction?: string;
  read_at?: string | null;
  created_at?: string | null;
};

type NotificationRow = {
  id: string;
  type?: string;
  data?: Record<string, unknown>;
  read_at?: string | null;
  created_at?: string | null;
};

function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: T[] }).data;
  }
  return [];
}

function subjectLabel(row: SessionRow) {
  if (typeof row.subject === 'string') return row.subject;
  return row.subject?.name_en || 'Tutoring session';
}

function tutorName(row: SessionRow) {
  const u = row.tutor?.user;
  return personName(u?.first_name, u?.last_name) || 'Tutor';
}

export function StudentTutoringPage() {
  const { tenantSlug = 'al-noor' } = useParams();
  const navigate = useNavigate();
  const { api } = useAuth();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [tutors, setTutors] = useState<TutorRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sessRes, tutorRes] = await Promise.allSettled([
        api.get<{ data?: SessionRow[] } | SessionRow[]>(`${LEARNER_API}/tutoring/sessions`),
        api.get<{ data?: TutorRow[] }>(`${LEARNER_API}/tutors`),
      ]);

      if (sessRes.status === 'fulfilled') {
        const payload = sessRes.value;
        const items = unwrapList<SessionRow>(
          payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload,
        );
        setSessions(items);
        setSelectedId((cur) => cur ?? items[0]?.id ?? null);
      } else {
        setSessions([]);
        throw sessRes.reason;
      }

      if (tutorRes.status === 'fulfilled') {
        setTutors(tutorRes.value.data ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tutoring sessions.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = sessions.find((s) => s.id === selectedId) ?? null;
  const upcoming = sessions.filter((s) =>
    ['scheduled', 'confirmed', 'in_progress'].includes((s.status || '').toLowerCase()),
  );

  async function joinSession(id: number) {
    setBusy(`join-${id}`);
    try {
      const res = await api.get<{
        data?: { join_url?: string | null; external_id?: string | null; session_id?: number };
        join_url?: string;
      }>(`${LEARNER_API}/tutoring/sessions/${id}/join`);
      const url = res.data?.join_url ?? res.join_url;
      const externalId = res.data?.external_id;
      if (externalId) {
        navigate(`/${tenantSlug}/student/classroom/${externalId}?session=${id}`);
        return;
      }
      if (url) {
        try {
          const parsed = new URL(url, window.location.origin);
          if (parsed.origin === window.location.origin) {
            navigate(`${parsed.pathname}${parsed.search}`);
            return;
          }
        } catch {
          /* open absolute external URL below */
        }
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }
      setError('This session does not have a meeting URL yet.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join the session.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <LearnerShell
      title="Tutor Sessions"
      subtitle="Upcoming and past tutoring"
      mode="student"
      headerActions={
        <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      }
    >
      <div className="lp-page">
        <section className="lp-hero stem-animate-rise">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">Student portal · Tutoring</p>
            <h2 className="lp-hero-title">Tutor sessions</h2>
            <p className="lp-hero-lead">Join live sessions and browse active tutors available at your school.</p>
            <div className="lp-chip-row">
              <span className="lp-chip">{upcoming.length} upcoming</span>
              <span className="lp-chip">{tutors.length} tutors</span>
            </div>
          </div>
        </section>
        {error ? <div className="lp-alert">{error}</div> : null}
        <StatStrip
          items={[
            { label: 'Sessions', value: loading ? '—' : String(sessions.length) },
            { label: 'Upcoming', value: loading ? '—' : String(upcoming.length) },
            { label: 'Tutors', value: loading ? '—' : String(tutors.length) },
          ]}
        />
        <div className="lp-layout">
          <Panel title="My sessions" description="Select a session to join when the link is ready.">
            <div className="lp-table-wrap">
              <table className="lp-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Subject</th>
                    <th>Tutor</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="lp-empty">
                        {loading ? 'Loading…' : 'No tutoring sessions yet.'}
                      </td>
                    </tr>
                  ) : (
                    sessions.map((row) => (
                      <tr
                        key={row.id}
                        className={selectedId === row.id ? 'is-selected' : undefined}
                        onClick={() => setSelectedId(row.id)}
                      >
                        <td>{formatWhen(row.starts_at)}</td>
                        <td>{subjectLabel(row)}</td>
                        <td>{tutorName(row)}</td>
                        <td>
                          <StatusPill status={row.status || 'scheduled'} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
          <aside className="lp-side">
            <Panel title="Session actions">
              {!selected ? (
                <p className="lp-muted">Select a session.</p>
              ) : (
                <>
                  <dl className="lp-meta">
                    <div>
                      <dt>Subject</dt>
                      <dd>{subjectLabel(selected)}</dd>
                    </div>
                    <div>
                      <dt>Tutor</dt>
                      <dd>{tutorName(selected)}</dd>
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
                      <dt>Status</dt>
                      <dd>
                        <StatusPill status={selected.status || 'scheduled'} />
                      </dd>
                    </div>
                  </dl>
                  <div className="lp-actions">
                    <Button
                      size="sm"
                      type="button"
                      variant="primary"
                      disabled={busy === `join-${selected.id}` || selected.status === 'cancelled'}
                      onClick={() => void joinSession(selected.id)}
                    >
                      {busy === `join-${selected.id}` ? 'Opening…' : 'Join session'}
                    </Button>
                  </div>
                </>
              )}
            </Panel>
            <Panel title="Available tutors">
              {tutors.length === 0 ? (
                <p className="lp-empty">{loading ? 'Loading…' : 'No active tutors listed.'}</p>
              ) : (
                <ul className="lp-list">
                  {tutors.slice(0, 6).map((t) => (
                    <li key={t.id}>
                      <div>
                        <strong>{personName(t.user?.first_name, t.user?.last_name, t.user?.email)}</strong>
                        <span>
                          {(t.subjects ?? []).map((s) => s.name_en || s.code).filter(Boolean).join(', ') ||
                            'General'}
                          {t.ratings_avg_rating != null ? ` · ★ ${Number(t.ratings_avg_rating).toFixed(1)}` : ''}
                        </span>
                      </div>
                      {t.status ? <StatusPill status={t.status} /> : null}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </aside>
        </div>
      </div>
    </LearnerShell>
  );
}

type JoinPayload = {
  session_id?: number;
  provider?: string | null;
  join_url?: string | null;
  external_id?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  status?: string;
  language?: string | null;
  session_type?: string | null;
  subject?: { id?: number; code?: string; name_en?: string } | null;
  tutor?: { id?: number; first_name?: string; last_name?: string; email?: string } | null;
  attendance?: { status?: string | null; notes?: string | null; marked_at?: string | null } | null;
  note?: { notes?: string | null; follow_up?: string | null } | null;
  rating?: { rating?: number; feedback?: string | null } | null;
  permissions?: { can_join?: boolean; can_rate?: boolean };
};

function elapsedLabel(fromMs: number | null) {
  if (!fromMs) return '—';
  const total = Math.max(0, Math.floor((Date.now() - fromMs) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function StudentClassroomPage() {
  const { tenantSlug = 'al-noor', roomId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const sessionId = Number(searchParams.get('session') || 0);
  const navigate = useNavigate();
  const { api } = useAuth();
  const feedback = useFeedback();
  const [data, setData] = useState<JoinPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [joinedAt, setJoinedAt] = useState<number | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false);
  const [nowTick, setNowTick] = useState(0);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingFeedback, setRatingFeedback] = useState('');

  const load = useCallback(async () => {
    if (!sessionId) {
      setLoading(false);
      setError('Missing session reference for this classroom.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data?: JoinPayload }>(`${LEARNER_API}/tutoring/sessions/${sessionId}/join`);
      const payload = res.data ?? null;
      setData(payload);
      if (payload?.rating?.rating) setRatingValue(payload.rating.rating);
      if (payload?.rating?.feedback) setRatingFeedback(payload.rating.feedback || '');
      if (payload?.status === 'in_progress') {
        setJoined(true);
        setJoinedAt((prev) => prev ?? Date.now());
      }
      if (payload?.status === 'completed') {
        setJoined(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open classroom.');
    } finally {
      setLoading(false);
    }
  }, [api, sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!joined) return;
    const id = window.setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [joined]);

  const closed = data?.status === 'completed' || data?.status === 'cancelled';
  const roomMismatch = Boolean(data?.external_id && roomId && data.external_id !== roomId);
  const subjectLabel = data?.subject?.name_en || data?.subject?.code || 'Tutoring session';
  const tutorLabel = personName(data?.tutor?.first_name, data?.tutor?.last_name, data?.tutor?.email);
  const tutorInitials =
    [data?.tutor?.first_name, data?.tutor?.last_name]
      .map((p) => (p ?? '').trim().charAt(0))
      .join('')
      .toUpperCase() || (data?.tutor?.email ?? 'T').slice(0, 2).toUpperCase();
  const elapsed = joined ? elapsedLabel(joinedAt) : '—';
  void nowTick;

  async function copyLink() {
    const url = data?.join_url || window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      await feedback.success({ title: 'Link copied', message: 'Classroom link copied to your clipboard.' });
    } catch {
      await feedback.error({ title: 'Copy failed', message: 'Could not copy the classroom link.' });
    }
  }

  function enterRoom() {
    if (closed || !data?.permissions?.can_join) return;
    setJoined(true);
    setJoinedAt(Date.now());
  }

  function leaveRoom() {
    setJoined(false);
    setMicOn(true);
    setCamOn(false);
    navigate(`/${tenantSlug}/student/tutoring`);
  }

  async function submitRating(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!data?.permissions?.can_rate) return;
    if (!validateFormFields(e.currentTarget)) return;
    setBusy('rate');
    try {
      await api.post(`${LEARNER_API}/tutoring/sessions/${sessionId}/rate`, {
        rating: ratingValue,
        feedback: ratingFeedback.trim() || null,
      });
      await feedback.success({ title: 'Thanks for your feedback', message: 'Your session rating was saved.' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit rating.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <LearnerShell
      title="Live classroom"
      subtitle={subjectLabel}
      mode="student"
      headerActions={
        <>
          <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Button size="sm" type="button" variant="secondary" to={`/${tenantSlug}/student/tutoring`}>
            Back to sessions
          </Button>
        </>
      }
    >
      <div className="lp-page">
        <section className="lp-hero stem-animate-rise">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">Student portal · Classroom</p>
            <h2 className="lp-hero-title">{subjectLabel}</h2>
            <p className="lp-hero-lead">
              Session #{sessionId || '—'}
              {data?.status ? (
                <>
                  {' '}
                  · <StatusPill status={data.status} />
                </>
              ) : null}
            </p>
            <div className="lp-chip-row">
              <span className="lp-chip">Room · {data?.external_id || roomId || '—'}</span>
              {data?.language ? <span className="lp-chip">{data.language.toUpperCase()}</span> : null}
              {data?.session_type ? (
                <span className="lp-chip">{data.session_type.replace(/_/g, ' ')}</span>
              ) : null}
              <span className="lp-chip">Provider · {data?.provider || 'local'}</span>
            </div>
          </div>
          <div className="lp-hero-actions">
            <Button size="sm" type="button" variant="secondary" disabled={!data} onClick={() => void copyLink()}>
              Copy join link
            </Button>
          </div>
        </section>

        {error ? (
          <div className="lp-alert" role="alert">
            <span>{error}</span>
            <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : null}

        {roomMismatch ? (
          <div className="lp-alert" role="alert">
            <span>
              Room ID in the URL does not match this session’s meeting room ({data?.external_id}). Use Copy join link
              for the correct URL.
            </span>
            <Button size="sm" type="button" variant="secondary" onClick={() => navigate(`/${tenantSlug}/student/tutoring`)}>
              Sessions
            </Button>
          </div>
        ) : null}

        <StatStrip
          items={[
            { label: 'Starts', value: formatWhen(data?.starts_at) },
            { label: 'Ends', value: formatWhen(data?.ends_at) },
            { label: 'Attendance', value: data?.attendance?.status || '—' },
            { label: 'Elapsed', value: elapsed },
          ]}
        />

        <div className="lp-layout">
          <div style={{ display: 'grid', gap: '1rem' }}>
            <Panel
              title="Session room"
              description={
                loading
                  ? 'Connecting…'
                  : closed
                    ? 'This session is closed. You can review notes and leave a rating.'
                    : joined
                      ? 'You are in the local classroom. Media is stubbed until an external provider is configured.'
                      : 'Enter the room when your tutor is ready.'
              }
            >
              <div className={`lp-room ${joined ? 'is-live' : ''} ${closed ? 'is-closed' : ''}`}>
                <div className="lp-room-stage">
                  <div className="lp-room-avatar" aria-hidden>
                    {tutorInitials}
                  </div>
                  <p className="lp-room-title">
                    {closed ? 'Session ended' : joined ? 'You are in the classroom' : 'Ready to join'}
                  </p>
                  <p className="lp-muted">
                    Tutor · {tutorLabel || '—'}
                    {joined ? ` · Elapsed ${elapsed}` : null}
                  </p>
                  <div className="lp-room-controls">
                    {!joined && !closed ? (
                      <Button
                        size="sm"
                        type="button"
                        variant="primary"
                        disabled={loading || !data || !data.permissions?.can_join}
                        onClick={enterRoom}
                      >
                        Enter classroom
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      type="button"
                      variant={joined && !closed && micOn ? 'primary' : 'secondary'}
                      disabled={!joined || closed}
                      onClick={() => setMicOn((v) => !v)}
                    >
                      Mic {joined && !closed && micOn ? 'on' : 'off'}
                    </Button>
                    <Button
                      size="sm"
                      type="button"
                      variant={joined && !closed && camOn ? 'primary' : 'secondary'}
                      disabled={!joined || closed}
                      onClick={() => setCamOn((v) => !v)}
                    >
                      Camera {joined && !closed && camOn ? 'on' : 'off'}
                    </Button>
                    <Button size="sm" type="button" variant="secondary" onClick={leaveRoom}>
                      Leave
                    </Button>
                  </div>
                </div>
              </div>
            </Panel>

            {data?.note ? (
              <Panel title="Tutor notes" description="Shared with you by your tutor for this session.">
                <dl className="lp-meta">
                  <div>
                    <dt>Notes</dt>
                    <dd>{data.note.notes || '—'}</dd>
                  </div>
                  <div>
                    <dt>Follow-up</dt>
                    <dd>{data.note.follow_up || '—'}</dd>
                  </div>
                </dl>
              </Panel>
            ) : null}

            {data?.permissions?.can_rate ? (
              <Panel
                title="Rate this session"
                description={
                  data.rating
                    ? 'You already rated this session. Submit again to update your feedback.'
                    : 'Tell us how the tutoring session went.'
                }
              >
                <form className="lp-form" onSubmit={(e) => void submitRating(e)} noValidate>
                  <div>
                    <p className="lp-muted" style={{ marginBottom: '0.45rem' }}>
                      Rating (required)
                    </p>
                    <div className="lp-star-row" role="group" aria-label="Session rating">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={ratingValue >= n ? 'is-on' : undefined}
                          aria-pressed={ratingValue === n}
                          onClick={() => setRatingValue(n)}
                        >
                          {n}★
                        </button>
                      ))}
                    </div>
                  </div>
                  <TextAreaField
                    label="Feedback"
                    rows={3}
                    value={ratingFeedback}
                    placeholder="What helped most? Anything to improve?"
                    onChange={(e) => setRatingFeedback(e.target.value)}
                  />
                  <FormActions>
                    <Button size="sm" type="submit" variant="primary" disabled={busy === 'rate'}>
                      {busy === 'rate' ? 'Saving…' : data.rating ? 'Update rating' : 'Submit rating'}
                    </Button>
                  </FormActions>
                </form>
              </Panel>
            ) : null}
          </div>

          <aside className="lp-side">
            <Panel title="Session details">
              <dl className="lp-meta">
                <div>
                  <dt>Session</dt>
                  <dd>#{data?.session_id ?? (sessionId || '—')}</dd>
                </div>
                <div>
                  <dt>Subject</dt>
                  <dd>{subjectLabel}</dd>
                </div>
                <div>
                  <dt>Tutor</dt>
                  <dd>{tutorLabel || '—'}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{data?.status ? <StatusPill status={data.status} /> : '—'}</dd>
                </div>
                <div>
                  <dt>Starts</dt>
                  <dd>{formatWhen(data?.starts_at)}</dd>
                </div>
                <div>
                  <dt>Ends</dt>
                  <dd>{formatWhen(data?.ends_at)}</dd>
                </div>
                <div>
                  <dt>Connection</dt>
                  <dd>{joined && !closed ? 'Connected' : closed ? 'Closed' : 'Not connected'}</dd>
                </div>
              </dl>
              <div className="lp-actions">
                <Button size="sm" to={`/${tenantSlug}/student/tutoring`} variant="secondary">
                  All sessions
                </Button>
                <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
                  Refresh status
                </Button>
              </div>
            </Panel>

            <Panel title="Your attendance" description="Marked by your tutor during the live session.">
              {data?.attendance?.status ? (
                <dl className="lp-meta">
                  <div>
                    <dt>Status</dt>
                    <dd>
                      <StatusPill status={data.attendance.status} />
                    </dd>
                  </div>
                  <div>
                    <dt>Marked</dt>
                    <dd>{formatWhen(data.attendance.marked_at)}</dd>
                  </div>
                  <div>
                    <dt>Notes</dt>
                    <dd>{data.attendance.notes || '—'}</dd>
                  </div>
                </dl>
              ) : (
                <p className="lp-muted">{loading ? 'Loading…' : 'Attendance has not been marked yet.'}</p>
              )}
            </Panel>
          </aside>
        </div>
      </div>
    </LearnerShell>
  );
}

export function StudentMessagesPage() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [rows, setRows] = useState<MessageRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data?: MessageRow[] }>(`${STUDENT_API}/messages`);
      const items = res.data ?? [];
      setRows(items);
      setSelectedId((cur) => cur ?? items[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const unread = rows.filter((r) => !r.read_at && (r.direction || '') !== 'outbound').length;

  async function markRead(id: number) {
    try {
      await api.post(`${STUDENT_API}/messages/${id}/read`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mark message read.');
    }
  }

  async function sendMessage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateFormFields(e.currentTarget)) return;
    setBusy(true);
    try {
      await api.post(`${STUDENT_API}/messages`, {
        subject: subject.trim(),
        body: body.trim(),
      });
      setSubject('');
      setBody('');
      await feedback.success({ title: 'Message sent', message: 'Your message was delivered to the school inbox.' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send message.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <LearnerShell
      title="Messages"
      subtitle="School messaging"
      mode="student"
      headerActions={
        <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      }
    >
      <div className="lp-page">
        <section className="lp-hero stem-animate-rise">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">Student portal · Messages</p>
            <h2 className="lp-hero-title">Messages</h2>
            <p className="lp-hero-lead">Send notes to your school and keep track of replies in one thread list.</p>
            <div className="lp-chip-row">
              <span className="lp-chip">{rows.length} messages</span>
              <span className="lp-chip">{unread} unread</span>
            </div>
          </div>
        </section>
        {error ? <div className="lp-alert">{error}</div> : null}
        <StatStrip
          items={[
            { label: 'Total', value: loading ? '—' : String(rows.length) },
            { label: 'Unread', value: loading ? '—' : String(unread) },
          ]}
        />
        <div className="lp-layout">
          <Panel title="Inbox" description="Select a message to read or mark as read.">
            {rows.length === 0 ? (
              <p className="lp-empty">{loading ? 'Loading…' : 'No messages yet.'}</p>
            ) : (
              <ul className="lp-list">
                {rows.map((row) => (
                  <li
                    key={row.id}
                    style={{ cursor: 'pointer', outline: selectedId === row.id ? '2px solid rgba(12,124,128,0.35)' : undefined }}
                    onClick={() => {
                      setSelectedId(row.id);
                      if (!row.read_at && row.direction !== 'outbound') void markRead(row.id);
                    }}
                  >
                    <div>
                      <strong>{row.subject || 'Untitled'}</strong>
                      <span>
                        {formatWhen(row.created_at)} · {row.direction || 'message'}
                      </span>
                    </div>
                    <StatusPill status={row.read_at ? 'read' : 'unread'} />
                  </li>
                ))}
              </ul>
            )}
            {selected ? (
              <div className="lp-detail" style={{ marginTop: '1rem' }}>
                <h3 style={{ margin: 0 }}>{selected.subject}</h3>
                <p className="lp-muted">{formatWhen(selected.created_at)}</p>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{selected.body}</p>
                {!selected.read_at && selected.direction !== 'outbound' ? (
                  <div className="lp-actions">
                    <Button size="sm" type="button" variant="secondary" onClick={() => void markRead(selected.id)}>
                      Mark read
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </Panel>
          <aside className="lp-side">
            <Panel title="Compose" description="Send a new message to your school.">
              <form className="lp-form" onSubmit={sendMessage} noValidate>
                <TextField
                  label="Subject"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="How can we help?"
                />
                <TextAreaField
                  label="Message"
                  required
                  rows={6}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your message…"
                />
                <FormActions>
                  <Button size="sm" type="submit" variant="primary" disabled={busy}>
                    {busy ? 'Sending…' : 'Send message'}
                  </Button>
                </FormActions>
              </form>
            </Panel>
          </aside>
        </div>
      </div>
    </LearnerShell>
  );
}

export function StudentNotificationsPage() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data?: NotificationRow[] } | NotificationRow[]>(
        `${STUDENT_API}/notifications?per_page=50`,
      );
      const items = unwrapList<NotificationRow>(
        res && typeof res === 'object' && 'data' in res ? res.data : res,
      );
      setRows(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const unread = rows.filter((r) => !r.read_at).length;

  async function markRead(id: string) {
    try {
      await api.post(`${STUDENT_API}/notifications/${id}/read`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mark as read.');
    }
  }

  async function markAll() {
    try {
      await api.post(`${STUDENT_API}/notifications/read-all`);
      await feedback.success({ title: 'All read', message: 'Notifications marked as read.' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mark all as read.');
    }
  }

  return (
    <LearnerShell
      title="Notifications"
      subtitle="Alerts for your learner account"
      mode="student"
      headerActions={
        <>
          <Button size="sm" type="button" variant="secondary" onClick={() => void markAll()}>
            Mark all read
          </Button>
          <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
        </>
      }
    >
      <div className="lp-page">
        <section className="lp-hero stem-animate-rise">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">Student portal · Notifications</p>
            <h2 className="lp-hero-title">Notifications</h2>
            <p className="lp-hero-lead">Stay informed about homework, sessions, and school notices.</p>
            <div className="lp-chip-row">
              <span className="lp-chip">{rows.length} total</span>
              <span className="lp-chip">{unread} unread</span>
            </div>
          </div>
          <div className="lp-hero-actions">
            <Button size="sm" type="button" variant="secondary" onClick={() => void markAll()}>
              Mark all read
            </Button>
          </div>
        </section>
        {error ? <div className="lp-alert">{error}</div> : null}
        <StatStrip
          items={[
            { label: 'Total', value: loading ? '—' : String(rows.length) },
            { label: 'Unread', value: loading ? '—' : String(unread) },
          ]}
        />
        <div className="lp-layout">
          <Panel title="Inbox">
            {rows.length === 0 ? (
              <p className="lp-empty">{loading ? 'Loading…' : 'No notifications yet.'}</p>
            ) : (
              <ul className="lp-list">
                {rows.map((row) => {
                  const title =
                    (typeof row.data?.title === 'string' && row.data.title) ||
                    (typeof row.data?.message === 'string' && row.data.message) ||
                    row.type ||
                    'Notification';
                  return (
                    <li key={row.id}>
                      <div>
                        <strong>{title}</strong>
                        <span>{formatWhen(row.created_at)}</span>
                      </div>
                      <div className="lp-actions">
                        <StatusPill status={row.read_at ? 'read' : 'unread'} />
                        {!row.read_at ? (
                          <Button size="sm" type="button" variant="secondary" onClick={() => void markRead(row.id)}>
                            Mark read
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
          <aside className="lp-side">
            <Panel title="Tips">
              <p className="lp-muted">
                Unread counts also appear on your dashboard. Mark items read after you have acted on them.
              </p>
            </Panel>
          </aside>
        </div>
      </div>
    </LearnerShell>
  );
}

function profileSeedFromSession(session: { user?: { name?: string; email?: string } } | null) {
  const parts = (session?.user?.name || '').trim().split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0] || '',
    last_name: parts.slice(1).join(' '),
    phone: '',
    locale: 'en',
    timezone: 'Asia/Riyadh',
    email: session?.user?.email || '',
  };
}

export function StudentProfilePage() {
  const { tenantSlug = 'al-noor' } = useParams();
  const { api, session } = useAuth();
  const feedback = useFeedback();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [baseline, setBaseline] = useState(() => profileSeedFromSession(session));
  const [form, setForm] = useState(baseline);

  const patch = useCallback(<K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setDirty(true);
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let next = profileSeedFromSession(session);

      try {
        const res = await api.get<{
          data?: {
            user?: {
              email?: string;
              first_name?: string;
              last_name?: string;
              phone?: string | null;
              locale?: string;
              timezone?: string | null;
              name?: string;
            };
            email?: string;
            first_name?: string;
            last_name?: string;
            phone?: string | null;
            locale?: string;
            timezone?: string | null;
          };
        }>('/auth/me');
        const u = res.data?.user ?? res.data;
        if (u) {
          let first = u.first_name ?? '';
          let last = u.last_name ?? '';
          if (!first && !last) {
            const name = ('name' in u ? u.name : undefined) || session?.user.name || '';
            const parts = name.trim().split(/\s+/).filter(Boolean);
            first = parts[0] || '';
            last = parts.slice(1).join(' ');
          }
          next = {
            email: u.email ?? next.email,
            first_name: first,
            last_name: last,
            phone: u.phone ?? '',
            locale: u.locale ?? 'en',
            timezone: u.timezone || 'Asia/Riyadh',
          };
        }
      } catch {
        next = profileSeedFromSession(session);
      }

      setBaseline(next);
      setForm(next);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  }, [api, session?.user.email, session?.user.name]);

  useEffect(() => {
    void load();
  }, [load]);

  function discard() {
    setForm(baseline);
    setDirty(false);
  }

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateFormFields(e.currentTarget)) return;
    setSaving(true);
    try {
      await api.put(`${STUDENT_API}/profile`, {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim() || null,
        phone: form.phone.trim() || null,
        locale: form.locale,
        timezone: form.timezone.trim() || null,
      });
      await feedback.success({ title: 'Profile saved', message: 'Your student profile was updated.' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  }

  const displayName = personName(form.first_name, form.last_name, form.email);
  const initials =
    [form.first_name, form.last_name]
      .map((p) => p.trim().charAt(0))
      .filter(Boolean)
      .join('')
      .toUpperCase() ||
    form.email.slice(0, 2).toUpperCase() ||
    'S';
  const timezoneOptions = useMemo(
    () => (form.timezone && !TIMEZONES.includes(form.timezone) ? [form.timezone, ...TIMEZONES] : TIMEZONES),
    [form.timezone],
  );

  const localeLabel = form.locale === 'ar' ? 'Arabic' : 'English';

  return (
    <LearnerShell
      title="Profile"
      subtitle="Contact details and preferences for your learner account"
      mode="student"
      headerActions={
        <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      }
    >
      <div className="lp-page">
        {error ? (
          <div className="lp-alert" role="alert">
            <span>{error}</span>
            <Button size="sm" type="button" variant="secondary" onClick={() => setError(null)}>
              Dismiss
            </Button>
          </div>
        ) : null}

        <div className="lp-layout stem-animate-rise">
          <form className="lp-profile-form" onSubmit={onSave} noValidate>
            <p className="lp-profile-intro">
              Keep contact details, language, and timezone current for scheduling and school notices.
              {dirty ? ' You have unsaved changes.' : ''}
            </p>

            <Panel title="Contact" description="Name and contact shown across the learner portal.">
              <div className="lp-form-grid">
                <TextField
                  label="First name"
                  required
                  value={form.first_name}
                  disabled={loading || saving}
                  onChange={(e) => patch('first_name', e.target.value)}
                />
                <TextField
                  label="Last name"
                  value={form.last_name}
                  disabled={loading || saving}
                  onChange={(e) => patch('last_name', e.target.value)}
                />
                <TextField label="Email" value={form.email} disabled hint="Managed by your school administrator." />
                <TextField
                  label="Phone"
                  value={form.phone}
                  placeholder="+966…"
                  disabled={loading || saving}
                  onChange={(e) => patch('phone', e.target.value)}
                />
              </div>
            </Panel>

            <Panel title="Preferences" description="Language and timezone for scheduling and notifications.">
              <div className="lp-form-grid">
                <SelectField
                  label="Locale"
                  value={form.locale}
                  disabled={loading || saving}
                  onChange={(e) => patch('locale', e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="ar">Arabic</option>
                </SelectField>
                <SelectField
                  label="Timezone"
                  value={form.timezone}
                  disabled={loading || saving}
                  onChange={(e) => patch('timezone', e.target.value)}
                >
                  {timezoneOptions.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </SelectField>
              </div>
            </Panel>

            <FormActions>
              <Button size="sm" type="button" variant="secondary" disabled={!dirty || saving || loading} onClick={discard}>
                Discard
              </Button>
              <Button size="sm" type="submit" variant="primary" disabled={saving || !dirty || loading}>
                {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
              </Button>
            </FormActions>
          </form>

          <aside className="lp-side lp-profile-aside">
            <div className="lp-detail">
              <div className="lp-detail-head">
                <span className="lp-detail-mark" aria-hidden>
                  {initials}
                </span>
                <div>
                  <h3>{displayName || 'Student account'}</h3>
                  <p>{form.email || '—'}</p>
                </div>
              </div>
              <dl className="lp-meta">
                <div>
                  <dt>Phone</dt>
                  <dd>{form.phone || '—'}</dd>
                </div>
                <div>
                  <dt>Locale</dt>
                  <dd>{localeLabel}</dd>
                </div>
                <div>
                  <dt>Timezone</dt>
                  <dd>{form.timezone || '—'}</dd>
                </div>
              </dl>
              <div className="lp-actions">
                <Button size="sm" to={`/${tenantSlug}/notifications`} variant="secondary">
                  Notifications
                </Button>
                <Button size="sm" to={`/${tenantSlug}/change-password`} variant="secondary">
                  Change password
                </Button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </LearnerShell>
  );
}
