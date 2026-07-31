import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import { Button, Panel, StatStrip, useResolvedTenant } from '@stemora/ui';
import { LearnerShell, PARENT_API, personName, StatusPill } from '../shared/shared';

type ChildSummary = {
  student: {
    id: number;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  };
  stats: {
    lessons_completed?: number;
    avg_progress_percent?: number;
    homework_pending?: number;
    recent_assessment_score?: number | null;
    upcoming_sessions?: number;
  };
};

type DashboardData = {
  parent?: {
    id: number;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  };
  children?: ChildSummary[];
  unread_notifications?: number;
};

export function ParentDashboard() {
  const { tenantSlug = 'al-noor' } = useParams();
  const { api, session } = useAuth();
  const tenant = useResolvedTenant();
  const brand = tenant?.name || tenantSlug;
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: DashboardData }>(`${PARENT_API}/dashboard`);
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

  const children = data?.children ?? [];
  const unread = data?.unread_notifications ?? 0;
  const pendingHw = children.reduce((n, c) => n + (c.stats?.homework_pending ?? 0), 0);
  const upcoming = children.reduce((n, c) => n + (c.stats?.upcoming_sessions ?? 0), 0);
  const parentName =
    personName(data?.parent?.first_name, data?.parent?.last_name, data?.parent?.email) ||
    session?.user.name ||
    'Parent';

  const base = `/${tenantSlug}/parent`;

  return (
    <LearnerShell
      title="Dashboard"
      subtitle={`Family learning · ${brand}`}
      mode="parent"
      headerActions={
        <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      }
    >
      <div className="lp-page">
        <section className="lp-hero stem-animate-rise">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">Parent portal · Overview</p>
            <h2 className="lp-hero-title">Welcome, {parentName}</h2>
            <p className="lp-hero-lead">
              Follow each child’s progress, homework, tutoring, and fees from one place at {brand}.
            </p>
            <div className="lp-chip-row">
              <span className="lp-chip">
                {children.length} linked {children.length === 1 ? 'child' : 'children'}
              </span>
              {unread > 0 ? <span className="lp-chip">{unread} unread</span> : null}
            </div>
          </div>
          <div className="lp-hero-actions">
            <Button size="sm" to={`${base}/children`} variant="primary">
              My children
            </Button>
            <Button size="sm" to={`${base}/fees`} variant="secondary">
              Fee payments
            </Button>
            <Button size="sm" to={`${base}/notifications`} variant="secondary">
              Notifications
            </Button>
          </div>
        </section>

        {error ? (
          <div className="lp-alert">
            <span>{error}</span>
            <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : null}

        <StatStrip
          items={[
            { label: 'Children', value: loading && !data ? '…' : String(children.length) },
            { label: 'Open homework', value: loading && !data ? '…' : String(pendingHw) },
            { label: 'Upcoming sessions', value: loading && !data ? '…' : String(upcoming) },
            { label: 'Unread', value: loading && !data ? '…' : String(unread) },
          ]}
        />

        <div className="lp-layout">
          <Panel title="Children" description="Quick snapshot for each linked student">
            {loading && !data ? (
              <p className="lp-empty">Loading family summary…</p>
            ) : children.length === 0 ? (
              <p className="lp-empty">No children are linked to this parent account yet.</p>
            ) : (
              <div className="lp-cards">
                {children.map((row) => {
                  const name = personName(row.student.first_name, row.student.last_name, row.student.email);
                  const pct = Number(row.stats?.avg_progress_percent ?? 0);
                  const q = `?child=${row.student.id}`;
                  return (
                    <article key={row.student.id} className="lp-card">
                      <h3>{name}</h3>
                      <p>{row.student.email || 'Student'}</p>
                      <div className="lp-progress" aria-hidden>
                        <span style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
                      </div>
                      <p className="lp-muted">
                        {row.stats?.lessons_completed ?? 0} lessons done · {pct}% avg ·{' '}
                        {row.stats?.homework_pending ?? 0} homework open
                      </p>
                      {row.stats?.recent_assessment_score != null ? (
                        <p className="lp-muted">Latest score: {row.stats.recent_assessment_score}</p>
                      ) : null}
                      <div className="lp-actions">
                        <Button size="sm" to={`${base}/progress${q}`} variant="secondary">
                          Progress
                        </Button>
                        <Button size="sm" to={`${base}/attendance${q}`} variant="secondary">
                          Attendance
                        </Button>
                        <Button size="sm" to={`${base}/homework${q}`} variant="secondary">
                          Homework
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </Panel>

          <aside className="lp-side">
            <div className="lp-detail">
              <div className="lp-detail-head">
                <span className="lp-detail-mark" aria-hidden>
                  {(parentName || 'P').slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <h3>Shortcuts</h3>
                  <p>Jump to the most used parent tools</p>
                </div>
              </div>
              <ul className="lp-list">
                <li>
                  <div>
                    <strong>Notifications</strong>
                    <span>{unread ? `${unread} unread` : 'Inbox clear'}</span>
                  </div>
                  {unread > 0 ? <StatusPill status="unread" /> : <StatusPill status="read" />}
                </li>
                <li>
                  <Link to={`${base}/results`}>
                    <strong>Results</strong>
                    <span>Assessment scores</span>
                  </Link>
                </li>
                <li>
                  <Link to={`${base}/tutoring`}>
                    <strong>Tutor sessions</strong>
                    <span>Schedule &amp; history</span>
                  </Link>
                </li>
                <li>
                  <Link to={`${base}/notices`}>
                    <strong>School notices</strong>
                    <span>Announcements</span>
                  </Link>
                </li>
                <li>
                  <Link to={`${base}/fees`}>
                    <strong>Fee payments</strong>
                    <span>Invoices &amp; statements</span>
                  </Link>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </LearnerShell>
  );
}

export { ParentDashboard as ParentHome };
