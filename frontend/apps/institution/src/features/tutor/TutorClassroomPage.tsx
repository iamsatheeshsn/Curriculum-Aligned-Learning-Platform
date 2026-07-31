import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import {
  Button,
  FormActions,
  Panel,
  SelectField,
  StatStrip,
  TextAreaField,
  useFeedback,
  validateFormFields,
} from '@stemora/ui';
import { StatusPill, TutorShell, formatWhen, personName } from './shared';

type Participant = {
  id: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  role?: string;
  attendance_status?: string | null;
  attendance_notes?: string | null;
};

type ClassroomPayload = {
  session_id: number;
  provider?: string | null;
  join_url?: string | null;
  external_id?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  status?: string;
  language?: string | null;
  session_type?: string | null;
  subject?: { id: number; code?: string; name_en?: string } | null;
  tutor?: { id: number; first_name?: string; last_name?: string; email?: string } | null;
  participants?: Participant[];
  note?: {
    id?: number;
    notes?: string | null;
    follow_up?: string | null;
    visible_to_parent?: boolean;
  } | null;
  permissions?: {
    mark_attendance?: boolean;
    save_notes?: boolean;
    complete?: boolean;
  };
};

const ATTENDANCE_OPTIONS = [
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'absent', label: 'Absent' },
  { value: 'excused', label: 'Excused' },
] as const;

function elapsedLabel(startsAt?: string | null) {
  if (!startsAt) return '—';
  const ms = Date.now() - new Date(startsAt).getTime();
  if (Number.isNaN(ms)) return '—';
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Local classroom room for tutoring sessions.
 * Video/audio is provider-stubbed; session conduct (attendance, notes, complete) is live.
 */
export function TutorClassroomPage() {
  const { tenantSlug = 'al-noor', roomId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const sessionId = Number(searchParams.get('session') || 0);
  const { api } = useAuth();
  const feedback = useFeedback();

  const [data, setData] = useState<ClassroomPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false);
  const [nowTick, setNowTick] = useState(0);
  const [notes, setNotes] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [visibleToParent, setVisibleToParent] = useState(true);
  const [attendanceDraft, setAttendanceDraft] = useState<Record<number, string>>({});
  const [joinedAt, setJoinedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!sessionId) {
      setLoading(false);
      setError('Missing session reference for this classroom.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: ClassroomPayload }>(`/org/tutoring-sessions/${sessionId}/classroom`);
      const payload = res.data ?? null;
      setData(payload);
      setNotes(payload?.note?.notes ?? '');
      setFollowUp(payload?.note?.follow_up ?? '');
      setVisibleToParent(payload?.note?.visible_to_parent ?? true);
      const draft: Record<number, string> = {};
      for (const p of payload?.participants ?? []) {
        draft[p.id] = p.attendance_status || 'present';
      }
      setAttendanceDraft(draft);
      if (payload?.status === 'in_progress' || payload?.status === 'completed') {
        setJoined(true);
        setJoinedAt((prev) => prev ?? Date.now());
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
  const roomMismatch =
    Boolean(data?.external_id && roomId && data.external_id !== roomId);
  const presentCount = useMemo(
    () => (data?.participants ?? []).filter((p) => (attendanceDraft[p.id] || p.attendance_status) === 'present').length,
    [attendanceDraft, data?.participants],
  );
  const subjectLabel = data?.subject?.name_en || data?.subject?.code || 'Tutoring session';
  const tutorLabel = personName(data?.tutor?.first_name, data?.tutor?.last_name, data?.tutor?.email);
  const tutorInitials =
    [data?.tutor?.first_name, data?.tutor?.last_name]
      .map((p) => (p ?? '').trim().charAt(0))
      .join('')
      .toUpperCase() || (data?.tutor?.email ?? 'T').slice(0, 2).toUpperCase();
  const elapsed = joined && joinedAt ? elapsedLabel(new Date(joinedAt).toISOString()) : '—';
  void nowTick;

  async function copyLink() {
    const url = data?.join_url || window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      await feedback.success({ title: 'Link copied', message: 'Share this classroom link with participants.' });
    } catch {
      await feedback.error({ title: 'Copy failed', message: 'Could not copy the classroom link.' });
    }
  }

  async function enterRoom() {
    setJoined(true);
    setJoinedAt(Date.now());
    if (data?.status === 'scheduled' || data?.status === 'confirmed') {
      await load();
    }
  }

  async function markAttendance(studentId: number, status: string) {
    if (!data?.permissions?.mark_attendance || closed) return;
    setBusy(`att-${studentId}`);
    setAttendanceDraft((d) => ({ ...d, [studentId]: status }));
    try {
      await api.post(`/org/tutoring-sessions/${sessionId}/attendance`, {
        student_user_id: studentId,
        status,
      });
      await load();
      await feedback.success({ title: 'Attendance saved', message: `Marked as ${status}.` });
    } catch (err) {
      await feedback.error({
        title: 'Attendance failed',
        message: err instanceof Error ? err.message : 'Could not mark attendance.',
      });
    } finally {
      setBusy(null);
    }
  }

  async function saveNotes(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateFormFields(e.currentTarget)) return;
    if (!data?.permissions?.save_notes) return;
    setBusy('notes');
    try {
      await api.post(`/org/tutoring-sessions/${sessionId}/notes`, {
        notes: notes.trim(),
        follow_up: followUp.trim() || null,
        visible_to_parent: visibleToParent,
      });
      await load();
      await feedback.success({ title: 'Notes saved', message: 'Session notes were updated.' });
    } catch (err) {
      await feedback.error({
        title: 'Save failed',
        message: err instanceof Error ? err.message : 'Could not save notes.',
      });
    } finally {
      setBusy(null);
    }
  }

  async function completeSession() {
    if (!data?.permissions?.complete || closed) return;
    const ok = await feedback.confirm({
      title: 'Mark session complete?',
      message: 'This ends the live classroom for tutoring session #' + sessionId + '.',
      confirmLabel: 'Mark complete',
    });
    if (!ok) return;
    setBusy('complete');
    try {
      await api.post(`/org/tutoring-sessions/${sessionId}/complete`);
      await feedback.success({ title: 'Session completed', message: 'Classroom session marked complete.' });
      await load();
    } catch (err) {
      await feedback.error({
        title: 'Complete failed',
        message: err instanceof Error ? err.message : 'Could not complete session.',
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <TutorShell
      title="Live classroom"
      subtitle="In-session tutoring room"
      headerActions={
        <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      }
    >
      <div className="tp-page">
        <section className="tp-hero stem-animate-rise">
          <div className="tp-hero-copy">
            <p className="tp-eyebrow">Tutor portal · Classroom</p>
            <h2 className="tp-hero-title">{subjectLabel}</h2>
            <p className="tp-hero-lead">
              Local classroom for session #{sessionId || '—'}
              {data?.status ? (
                <>
                  {' '}
                  · <StatusPill status={data.status} />
                </>
              ) : null}
            </p>
            <div className="tp-chip-row">
              <span className="tp-chip">Room · {data?.external_id || roomId || '—'}</span>
              {data?.language ? <span className="tp-chip">{data.language.toUpperCase()}</span> : null}
              {data?.session_type ? (
                <span className="tp-chip">{data.session_type.replace(/_/g, ' ')}</span>
              ) : null}
              <span className="tp-chip">Provider · {data?.provider || 'local'}</span>
            </div>
          </div>
          <div className="tp-hero-actions">
            <Button size="sm" type="button" variant="secondary" onClick={() => void copyLink()}>
              Copy join link
            </Button>
            <Button size="sm" to={`/${tenantSlug}/live-sessions?session=${sessionId || ''}`} variant="secondary">
              Live sessions
            </Button>
          </div>
        </section>

        {error ? (
          <div className="tp-alert" role="alert">
            <span>{error}</span>
            <Button size="sm" type="button" variant="secondary" onClick={() => setError(null)}>
              Dismiss
            </Button>
          </div>
        ) : null}

        {roomMismatch ? (
          <div className="tp-alert" role="alert">
            <span>
              Room ID in the URL does not match this session’s meeting room ({data?.external_id}). Use Copy join link
              for the correct URL.
            </span>
          </div>
        ) : null}

        <StatStrip
          items={[
            { label: 'Starts', value: formatWhen(data?.starts_at) },
            { label: 'Ends', value: formatWhen(data?.ends_at) },
            { label: 'Learners', value: String(data?.participants?.length ?? 0) },
            { label: 'Present', value: String(presentCount) },
          ]}
        />

        <div className="tp-layout">
          <div style={{ display: 'grid', gap: '1rem' }}>
            <Panel
              title="Session room"
              description={
                loading
                  ? 'Connecting…'
                  : closed
                    ? 'This session is closed. You can still review attendance and notes.'
                    : joined
                      ? 'You are in the local classroom. Media is stubbed until an external provider is configured.'
                      : 'Enter the room to start conducting this session.'
              }
            >
              <div className={`tp-room ${joined ? 'is-live' : ''} ${closed ? 'is-closed' : ''}`}>
                <div className="tp-room-stage">
                  <div className="tp-room-avatar" aria-hidden>
                    {tutorInitials}
                  </div>
                  <p className="tp-room-title">
                    {closed ? 'Session ended' : joined ? 'You are in the classroom' : 'Ready to join'}
                  </p>
                  <p className="tp-muted">
                    Tutor · {tutorLabel}
                    {joined ? ` · Elapsed ${elapsed}` : null}
                  </p>
                  <div className="tp-room-controls">
                    {!joined && !closed ? (
                      <Button size="sm" type="button" variant="primary" disabled={loading || !data} onClick={() => void enterRoom()}>
                        Enter classroom
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      type="button"
                      variant={micOn ? 'primary' : 'secondary'}
                      disabled={!joined || closed}
                      onClick={() => setMicOn((v) => !v)}
                    >
                      Mic {micOn ? 'on' : 'off'}
                    </Button>
                    <Button
                      size="sm"
                      type="button"
                      variant={camOn ? 'primary' : 'secondary'}
                      disabled={!joined || closed}
                      onClick={() => setCamOn((v) => !v)}
                    >
                      Camera {camOn ? 'on' : 'off'}
                    </Button>
                    {data?.permissions?.complete && !closed ? (
                      <Button
                        size="sm"
                        type="button"
                        variant="secondary"
                        disabled={busy === 'complete'}
                        onClick={() => void completeSession()}
                      >
                        {busy === 'complete' ? 'Completing…' : 'Mark complete'}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="Session notes" description="Visible to school staff; optionally share with parents.">
              <form className="tp-form" onSubmit={saveNotes} noValidate>
                <TextAreaField
                  label="Notes"
                  required
                  rows={4}
                  value={notes}
                  disabled={!data?.permissions?.save_notes || closed}
                  placeholder="What was covered, student progress, next steps…"
                  onChange={(e) => setNotes(e.target.value)}
                />
                <TextAreaField
                  label="Follow-up"
                  rows={3}
                  value={followUp}
                  disabled={!data?.permissions?.save_notes || closed}
                  placeholder="Homework reminders or topics for the next session…"
                  onChange={(e) => setFollowUp(e.target.value)}
                />
                <label className="tp-check">
                  <input
                    type="checkbox"
                    checked={visibleToParent}
                    disabled={!data?.permissions?.save_notes || closed}
                    onChange={(e) => setVisibleToParent(e.target.checked)}
                  />
                  Visible to parent
                </label>
                {data?.permissions?.save_notes && !closed ? (
                  <FormActions>
                    <Button size="sm" type="submit" variant="primary" disabled={busy === 'notes' || !notes.trim()}>
                      {busy === 'notes' ? 'Saving…' : 'Save notes'}
                    </Button>
                  </FormActions>
                ) : null}
              </form>
            </Panel>
          </div>

          <aside className="tp-side">
            <Panel title="Session details">
              <dl className="tp-meta">
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
                  <dd>{tutorLabel}</dd>
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
              </dl>
              <div className="tp-actions">
                <Button size="sm" to={`/${tenantSlug}/session-notes?session=${sessionId || ''}`} variant="secondary">
                  All notes
                </Button>
                <Button size="sm" to={`/${tenantSlug}/session-schedule`} variant="secondary">
                  Schedule
                </Button>
              </div>
            </Panel>

            <Panel title="Participants" description="Mark attendance for learners in this session.">
              {(data?.participants?.length ?? 0) === 0 ? (
                <p className="tp-muted">{loading ? 'Loading…' : 'No learners linked to this session.'}</p>
              ) : (
                <ul className="tp-participant-list">
                  {(data?.participants ?? []).map((p) => {
                    const name = personName(p.first_name, p.last_name, p.email);
                    const status = attendanceDraft[p.id] || p.attendance_status || '';
                    return (
                      <li key={p.id}>
                        <div className="tp-participant-head">
                          <span className="tp-detail-mark" aria-hidden>
                            {name
                              .split(/\s+/)
                              .map((w) => w[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase() || 'S'}
                          </span>
                          <div>
                            <strong>{name}</strong>
                            <span className="tp-muted">{p.email || p.role || 'Learner'}</span>
                          </div>
                          {status ? <StatusPill status={status} /> : null}
                        </div>
                        {data?.permissions?.mark_attendance && !closed ? (
                          <div className="tp-participant-actions">
                            <SelectField
                              label="Attendance"
                              value={status || 'present'}
                              disabled={busy === `att-${p.id}`}
                              onChange={(e) => void markAttendance(p.id, e.target.value)}
                            >
                              {ATTENDANCE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </SelectField>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </aside>
        </div>
      </div>
    </TutorShell>
  );
}
