import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import { Button, Panel, StatStrip } from '@stemora/ui';
import {
  LearnerShell,
  STUDENT_API,
  StatusPill,
  formatWhen,
  personName,
} from '../shared/shared';

type DashboardStats = {
  assigned_lessons?: number;
  lessons_completed?: number;
  lessons_in_progress?: number;
  homework_open?: number;
  assessments_available?: number;
  certificates?: number;
  unread_notifications?: number;
};

type TutoringRow = {
  id: number;
  starts_at?: string | null;
  status?: string;
  subject?: { name_en?: string } | string | null;
  tutor?: { user?: { first_name?: string; last_name?: string } } | null;
};

type ProgressRow = {
  id?: number;
  interactive_lesson_id?: number;
  status?: string;
  progress_percent?: number | string | null;
  updated_at?: string | null;
  lesson?: { title_en?: string } | null;
};

type DashboardData = {
  student?: {
    id?: number;
    first_name?: string;
    last_name?: string;
    email?: string;
  };
  stats?: DashboardStats;
  upcoming_tutoring?: TutoringRow[];
  recent_progress?: ProgressRow[];
};

function subjectLabel(row: TutoringRow) {
  if (typeof row.subject === 'string') return row.subject;
  return row.subject?.name_en || 'Tutoring session';
}

function tutorLabel(row: TutoringRow) {
  const u = row.tutor?.user;
  return personName(u?.first_name, u?.last_name) || 'Tutor';
}

export function StudentDashboard() {
  const { tenantSlug = 'al-noor' } = useParams();
  const { api, session } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: DashboardData }>(`${STUDENT_API}/dashboard`);
      setData(res.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = data?.stats ?? {};
  const upcoming = data?.upcoming_tutoring ?? [];
  const recent = data?.recent_progress ?? [];
  const student = data?.student;
  const greet =
    personName(student?.first_name, student?.last_name, student?.email) ||
    session?.user.name ||
    'Learner';

  return (
    <LearnerShell
      title="Dashboard"
      subtitle="Your learning at a glance"
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
            <p className="lp-eyebrow">Student portal · Home</p>
            <h2 className="lp-hero-title">Welcome back, {greet}</h2>
            <p className="lp-hero-lead">
              Continue lessons, clear open homework, and join upcoming tutoring sessions from one place.
            </p>
            <div className="lp-chip-row">
              <span className="lp-chip">
                {loading ? 'Loading…' : `${stats.lessons_completed ?? 0} lessons completed`}
              </span>
              {(stats.homework_open ?? 0) > 0 ? (
                <span className="lp-chip">{stats.homework_open} homework open</span>
              ) : (
                <span className="lp-chip">Homework clear</span>
              )}
            </div>
          </div>
          <div className="lp-hero-actions">
            <Button size="sm" to={`/${tenantSlug}/student/courses`} variant="primary">
              My courses
            </Button>
            <Button size="sm" to={`/${tenantSlug}/student/homework`} variant="secondary">
              Homework
            </Button>
            <Button size="sm" to={`/${tenantSlug}/student/tutoring`} variant="secondary">
              Tutoring
            </Button>
            <Button size="sm" to={`/${tenantSlug}/student/notifications`} variant="secondary">
              Notifications
            </Button>
          </div>
        </section>

        {error ? (
          <div className="lp-alert" role="alert">
            <span>{error}</span>
            <Button size="sm" type="button" variant="secondary" onClick={() => setError(null)}>
              Dismiss
            </Button>
          </div>
        ) : null}

        <StatStrip
          items={[
            { label: 'Assigned lessons', value: loading ? '—' : String(stats.assigned_lessons ?? 0) },
            { label: 'Completed', value: loading ? '—' : String(stats.lessons_completed ?? 0) },
            { label: 'In progress', value: loading ? '—' : String(stats.lessons_in_progress ?? 0) },
            { label: 'Open homework', value: loading ? '—' : String(stats.homework_open ?? 0) },
            { label: 'Assessments', value: loading ? '—' : String(stats.assessments_available ?? 0) },
            { label: 'Unread', value: loading ? '—' : String(stats.unread_notifications ?? 0) },
          ]}
        />

        <div className="lp-layout">
          <Panel
            title="Upcoming tutoring"
            description="Next sessions you are booked for."
            action={
              <Button size="sm" to={`/${tenantSlug}/student/tutoring`} variant="secondary">
                View more
              </Button>
            }
          >
            {upcoming.length === 0 ? (
              <p className="lp-empty">{loading ? 'Loading…' : 'No upcoming tutoring sessions.'}</p>
            ) : (
              <ul className="lp-list">
                {upcoming.slice(0, 5).map((row) => (
                  <li key={row.id}>
                    <div>
                      <strong>{subjectLabel(row)}</strong>
                      <span>
                        {formatWhen(row.starts_at)} · {tutorLabel(row)}
                      </span>
                    </div>
                    <div className="lp-actions">
                      {row.status ? <StatusPill status={row.status} /> : null}
                      <Button size="sm" to={`/${tenantSlug}/student/tutoring`} variant="secondary">
                        Open
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <aside className="lp-side">
            <Panel
              title="Recent progress"
              description="Latest lesson activity."
              action={
                <Button size="sm" to={`/${tenantSlug}/student/lessons`} variant="secondary">
                  View more
                </Button>
              }
            >
              {recent.length === 0 ? (
                <p className="lp-empty">{loading ? 'Loading…' : 'No progress recorded yet.'}</p>
              ) : (
                <ul className="lp-list">
                  {recent.slice(0, 5).map((row, idx) => (
                    <li key={row.id ?? row.interactive_lesson_id ?? idx}>
                      <div>
                        <strong>{row.lesson?.title_en || `Lesson ${row.interactive_lesson_id ?? ''}`}</strong>
                        <span>
                          {row.progress_percent != null ? `${row.progress_percent}%` : '—'} ·{' '}
                          {formatWhen(row.updated_at)}
                        </span>
                      </div>
                      {row.status ? <StatusPill status={row.status} /> : null}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Quick links">
              <div className="lp-actions">
                <Button size="sm" to={`/${tenantSlug}/student/lessons`} variant="secondary">
                  Lessons
                </Button>
                <Button size="sm" to={`/${tenantSlug}/student/quizzes`} variant="secondary">
                  Quizzes
                </Button>
                <Button size="sm" to={`/${tenantSlug}/student/labs`} variant="secondary">
                  Virtual labs
                </Button>
                <Button size="sm" to={`/${tenantSlug}/student/results`} variant="secondary">
                  Results
                </Button>
              </div>
            </Panel>
          </aside>
        </div>
      </div>
    </LearnerShell>
  );
}
