import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import { Button, Panel, StatStrip, useFeedback } from '@stemora/ui';
import { StatusPill, TutorShell, TUTOR_API, formatWhen } from './shared';

type Workspace = {
  school: { name_en: string; code: string };
  tutor_profile: { id: number; status: string; bio_en?: string | null } | null;
  stats: {
    upcoming_sessions: number;
    open_slots: number;
    weekly_slots: number;
    assignments: number;
    to_grade: number;
  };
  sessions: {
    id: number;
    starts_at: string | null;
    status: string;
    subject: string | null;
    students: string[];
    meeting_url: string | null;
  }[];
  homework: { id: number; title_en: string; status: string; due_at: string | null; submissions_count: number }[];
  assessments: { id: number; title_en: string; type: string; status: string; due_at: string | null }[];
  availability: { weekly: { id: number }[]; open_slots: unknown[]; slot_date: string };
};

export function TutorDashboardPage() {
  const { tenantSlug = 'al-noor' } = useParams();
  const { api } = useAuth();
  const feedback = useFeedback();
  const [data, setData] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: Workspace }>(`${TUTOR_API}/workspace`);
      setData(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load tutor dashboard.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openClassroom(sessionId: number) {
    setBusy(sessionId);
    try {
      const res = await api.get<{ join_url?: string; data?: { join_url?: string } }>(
        `/org/tutoring-sessions/${sessionId}/classroom`,
      );
      const url = res.join_url ?? res.data?.join_url;
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
      await feedback.success({ title: 'Classroom ready', message: 'Opened the live session link.' });
    } catch (err) {
      await feedback.error({
        title: 'Could not open classroom',
        message: err instanceof Error ? err.message : 'Try again shortly.',
      });
    } finally {
      setBusy(null);
    }
  }

  const upcoming = (data?.sessions ?? []).filter((s) =>
    ['scheduled', 'confirmed', 'in_progress'].includes(s.status),
  );

  return (
    <TutorShell
      title="Dashboard"
      subtitle={`${data?.school.name_en ?? 'School'} · Tutor overview`}
      headerActions={
        <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      }
    >
      <div className="tp-page">
        <section className="tp-hero stem-animate-rise">
          <div>
            <p className="tp-eyebrow">Tutor portal</p>
            <h2 className="tp-hero-title">Your teaching desk</h2>
            <p className="tp-hero-lead">
              Track upcoming sessions, student work, and availability from one place. Jump into live classrooms or
              review homework without leaving the portal.
            </p>
            <div className="tp-chip-row">
              <span className="tp-chip">{data?.tutor_profile ? `Profile · ${data.tutor_profile.status}` : 'No tutor profile'}</span>
              <span className="tp-chip">{data?.stats.weekly_slots ?? 0} weekly slots</span>
            </div>
          </div>
          <div className="tp-hero-actions">
            <Button size="sm" to={`/${tenantSlug}/session-schedule`} variant="primary">
              Session schedule
            </Button>
            <Button size="sm" to={`/${tenantSlug}/availability`} variant="secondary">
              Availability
            </Button>
            <Button size="sm" to={`/${tenantSlug}/my-students`} variant="secondary">
              My students
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

        <StatStrip
          items={[
            { label: 'Upcoming', value: String(data?.stats.upcoming_sessions ?? '—') },
            { label: 'Open slots', value: String(data?.stats.open_slots ?? '—') },
            { label: 'Assignments', value: String(data?.stats.assignments ?? '—') },
            { label: 'To grade', value: String(data?.stats.to_grade ?? '—') },
          ]}
        />

        <div className="tp-layout">
          <Panel title="Upcoming sessions" description="Next tutoring sessions assigned to you.">
            {loading && !data ? <p className="tp-muted">Loading…</p> : null}
            {!loading && upcoming.length === 0 ? <p className="tp-empty">No upcoming sessions yet.</p> : null}
            {upcoming.length ? (
              <ul className="tp-list">
                {upcoming.slice(0, 6).map((s) => (
                  <li key={s.id}>
                    <div>
                      <strong>{s.subject || 'Tutoring session'}</strong>
                      <span>
                        {formatWhen(s.starts_at)} · {s.students.join(', ') || 'No students listed'}
                      </span>
                    </div>
                    <div className="tp-actions">
                      <StatusPill status={s.status} />
                      <Button
                        size="sm"
                        type="button"
                        variant="primary"
                        disabled={busy === s.id}
                        onClick={() => void openClassroom(s.id)}
                      >
                        {busy === s.id ? 'Opening…' : 'Join'}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="tp-actions">
              <Link to={`/${tenantSlug}/live-sessions`}>Live sessions</Link>
              <Link to={`/${tenantSlug}/session-schedule`}>Full schedule</Link>
            </div>
          </Panel>

          <div style={{ display: 'grid', gap: '1rem' }}>
            <Panel title="Homework pulse" description="Recent homework activity.">
              {(data?.homework ?? []).length === 0 ? (
                <p className="tp-muted">No homework items yet.</p>
              ) : (
                <ul className="tp-list">
                  {data!.homework.slice(0, 4).map((hw) => (
                    <li key={hw.id}>
                      <div>
                        <strong>{hw.title_en}</strong>
                        <span>
                          Due {formatWhen(hw.due_at)} · {hw.submissions_count} submissions
                        </span>
                      </div>
                      <StatusPill status={hw.status} />
                    </li>
                  ))}
                </ul>
              )}
              <div className="tp-actions">
                <Link to={`/${tenantSlug}/homework`}>Open homework</Link>
              </div>
            </Panel>

            <Panel title="Assessments" description="Quizzes and exams in your school.">
              {(data?.assessments ?? []).length === 0 ? (
                <p className="tp-muted">No assessments listed.</p>
              ) : (
                <ul className="tp-list">
                  {data!.assessments.slice(0, 4).map((a) => (
                    <li key={a.id}>
                      <div>
                        <strong>{a.title_en}</strong>
                        <span>
                          {a.type} · {formatWhen(a.due_at)}
                        </span>
                      </div>
                      <StatusPill status={a.status} />
                    </li>
                  ))}
                </ul>
              )}
              <div className="tp-actions">
                <Link to={`/${tenantSlug}/assessments`}>Open assessments</Link>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </TutorShell>
  );
}
