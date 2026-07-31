import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import { Button, ConfirmButton, Panel, PortalShell, StatStrip, useFeedback } from '@stemora/ui';
import { learnerPortalLoginUrl, publicSchoolSiteUrl } from '../../portalOrigins';
import { useInstitutionNav } from '../../nav';

export { useInstitutionNav, institutionNav } from '../../nav';


type DashboardData = {
  tenant: {
    id: number;
    slug: string;
    name: string;
    status: string;
    default_locale: string;
    default_timezone: string;
  };
  user: {
    id: number;
    name: string;
    email: string;
    roles: string[];
    permissions: string[];
  };
  stats: {
    schools: number;
    campuses: number;
    active_classes: number;
    staff: number;
    students: number;
    sessions_today: number;
    curricula_pending: number;
  };
  schools: { id: number; code: string; name_en: string; name_ar?: string; status: string }[];
  upcoming_sessions: {
    id: number;
    starts_at: string | null;
    ends_at: string | null;
    status: string;
    language: string | null;
    subject: string | null;
    tutor: string | null;
  }[];
  curricula: { id: number; name_en: string; status: string; version?: string | number; updated_at?: string }[];
  attention: { id: string; tone: string; title: string; body: string }[];
};

function formatWhen(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return iso;
  }
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function SchoolDashboard() {
  const { tenantSlug = 'al-noor' } = useParams();
  const { session, logout, api, roles } = useAuth();
  const feedback = useFeedback();
  const nav = useInstitutionNav(tenantSlug);

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: DashboardData }>('/org/dashboard');
      setData(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load school home');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const displayName = data?.user.name || session?.user.name || 'Colleague';
  const orgName = data?.tenant.name || tenantSlug;
  const roleLabel = useMemo(() => {
    const list = data?.user.roles?.length ? data.user.roles : roles;
    return list.map((r) => r.replace(/_/g, ' ')).join(' · ') || 'Staff';
  }, [data?.user.roles, roles]);

  const isTutorOnly = useMemo(() => {
    const list = data?.user.roles?.length ? data.user.roles : roles;
    const elevated = [
      'school_owner',
      'school_admin',
      'campus_admin',
      'principal',
      'academic_coordinator',
      'finance_manager',
      'teacher',
    ];
    return list.includes('tutor') && !list.some((r) => elevated.includes(r));
  }, [data?.user.roles, roles]);

  if (isTutorOnly) {
    return <Navigate to={`/${tenantSlug}/teacher`} replace />;
  }

  async function approvePublish() {
    setBusy('publish');
    try {
      await feedback.success({
        title: 'Publish approved',
        message: 'Curriculum publish is queued for this school. Open Reports to track completion.',
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function suspendEnrolment() {
    setBusy('enrol');
    try {
      await feedback.success({
        title: 'Enrolment paused',
        message: 'New joins are suspended for the selected class until you reopen enrolment.',
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <PortalShell
      portal="institution"
      brandCaption="Institution portal"
      title="School home"
      subtitle={`${orgName} · ${tenantSlug}`}
      nav={nav}
      userLabel={session?.user.email}
      userName={session?.user.name}
      onLogout={logout}
      changePasswordTo={`/${tenantSlug}/change-password`}
      collapsible
    >
      <div className="school-home">
        {error ? <div className="school-alert">{error}</div> : null}

        <section className="school-hero stem-animate-rise">
          <div className="school-hero-copy">
            <p className="school-eyebrow">{greeting()}</p>
            <h2 className="school-hero-title">{displayName}</h2>
            <p className="school-hero-lead">
              Run day-to-day learning for <strong>{orgName}</strong> — classes, tutoring, curriculum, and family
              progress in one workspace.
            </p>
            <div className="school-hero-meta">
              <span className="school-pill">{roleLabel}</span>
              <span className="school-pill is-soft">{data?.tenant.status ?? '…'}</span>
              <span className="school-pill is-soft">{data?.tenant.default_timezone ?? '—'}</span>
            </div>
            <div className="school-hero-actions">
              <Button size="sm" to={`/${tenantSlug}/teacher`} variant="primary">
                Open teacher workspace
              </Button>
              <Button size="sm" to={`/${tenantSlug}/reports`} variant="secondary">
                View analytics
              </Button>
            </div>
          </div>
          <div className="school-hero-visual stem-animate-fade" aria-hidden>
            <div className="school-hero-orb" />
            <div className="school-hero-panel">
              <span>Live operations</span>
              <strong>{data?.stats.sessions_today ?? '—'} sessions today</strong>
              <p>
                {data?.stats.active_classes ?? '—'} active classes · {data?.stats.students ?? '—'} students
              </p>
            </div>
          </div>
        </section>

        {loading && !data ? (
          <p className="school-muted">Loading school operations…</p>
        ) : (
          <>
            <StatStrip
              items={[
                { label: 'Students', value: String(data?.stats.students ?? '—') },
                { label: 'Staff', value: String(data?.stats.staff ?? '—') },
                { label: 'Active classes', value: String(data?.stats.active_classes ?? '—') },
                { label: 'Sessions today', value: String(data?.stats.sessions_today ?? '—') },
              ]}
            />

            <div className="school-grid">
              <Panel
                title="Needs attention"
                description="Operational items that keep the school week moving."
              >
                {data?.attention?.length ? (
                  <ul className="school-attention">
                    {data.attention.map((item) => (
                      <li key={item.id} className={`is-${item.tone}`}>
                        <strong>{item.title}</strong>
                        <span>{item.body}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="school-muted">Nothing urgent — your school board is clear.</p>
                )}
                <div className="school-approvals">
                  <ConfirmButton size="sm"
                    title="Approve curriculum publish?"
                    message="Pending curriculum versions will be marked ready for live teaching in this school."
                    confirmLabel="Approve"
                    tone="primary"
                    variant="primary"
                    onConfirm={approvePublish}
                  >
                    {busy === 'publish' ? 'Working…' : 'Approve publish'}
                  </ConfirmButton>
                  <ConfirmButton size="sm"
                    title="Suspend class enrolment?"
                    message="New students will not be able to join until enrolment is reopened."
                    confirmLabel="Suspend"
                    tone="warn"
                    variant="secondary"
                    onConfirm={suspendEnrolment}
                  >
                    {busy === 'enrol' ? 'Working…' : 'Suspend enrolment'}
                  </ConfirmButton>
                </div>
              </Panel>

              <Panel title="Upcoming tutoring" description="Next live sessions across campuses.">
                {data?.upcoming_sessions?.length ? (
                  <ul className="school-list">
                    {data.upcoming_sessions.map((s) => (
                      <li key={s.id}>
                        <div>
                          <strong>{s.subject || 'Tutoring session'}</strong>
                          <span>
                            {s.tutor ? `${s.tutor} · ` : ''}
                            {s.language?.toUpperCase() || 'EN'} · {s.status}
                          </span>
                        </div>
                        <time>{formatWhen(s.starts_at)}</time>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="school-muted">No upcoming sessions scheduled. Book from the tutoring module.</p>
                )}
                <Link className="school-inline-link" to={`/${tenantSlug}/teacher`}>
                  Manage sessions in teacher workspace →
                </Link>
              </Panel>
            </div>

            <div className="school-grid">
              <Panel title="Schools & campuses" description={`${data?.stats.campuses ?? 0} campus locations`}>
                {data?.schools?.length ? (
                  <ul className="school-list">
                    {data.schools.map((school) => (
                      <li key={school.id}>
                        <div>
                          <strong>{school.name_en}</strong>
                          <span>
                            {school.code} · {school.status}
                            {school.name_ar ? ` · ${school.name_ar}` : ''}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="school-muted">No schools provisioned for this organisation yet.</p>
                )}
              </Panel>

              <Panel title="Curriculum pulse" description="Recent curriculum versions for this tenant.">
                {data?.curricula?.length ? (
                  <ul className="school-list">
                    {data.curricula.map((c) => (
                      <li key={c.id}>
                        <div>
                          <strong>{c.name_en}</strong>
                          <span>
                            v{c.version ?? '—'} · {c.status}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="school-muted">No curricula published yet.</p>
                )}
                <Link className="school-inline-link" to={`/${tenantSlug}/reports`}>
                  Open curriculum completion report →
                </Link>
              </Panel>
            </div>

            <Panel title="Shortcuts" description="Jump to the workspaces you use every day.">
              <div className="school-shortcuts">
                <Link to={`/${tenantSlug}/teacher`} className="school-shortcut">
                  <strong>Teacher workspace</strong>
                  <span>Classes, grading queue, and tutoring slots</span>
                </Link>
                <Link to={`/${tenantSlug}/reports`} className="school-shortcut">
                  <strong>Reports</strong>
                  <span>Student, tutor, and school analytics</span>
                </Link>
                <a href={publicSchoolSiteUrl(tenantSlug)} className="school-shortcut" target="_blank" rel="noreferrer">
                  <strong>Public school site</strong>
                  <span>Marketing pages for families</span>
                </a>
                <a href={learnerPortalLoginUrl(tenantSlug)} className="school-shortcut" target="_blank" rel="noreferrer">
                  <strong>Learner portal</strong>
                  <span>Student and parent sign-in</span>
                </a>
              </div>
            </Panel>
          </>
        )}
      </div>

      <style>{schoolHomeStyles}</style>
    </PortalShell>
  );
}

const schoolHomeStyles = `
.school-home { display: grid; gap: 1rem; }
.school-alert {
  padding: 0.75rem 1rem;
  border-radius: 12px;
  background: #fef3f2;
  color: var(--stem-danger);
  border: 1px solid #fecdca;
  font-size: var(--stem-text-base);
}
.school-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(220px, 0.75fr);
  gap: 1.25rem;
  align-items: stretch;
  padding: 1.35rem 1.4rem;
  border-radius: 22px;
  border: 1px solid var(--stem-line);
  background:
    radial-gradient(ellipse 55% 80% at 100% 0%, rgba(18,160,171,0.16), transparent 55%),
    linear-gradient(145deg, rgba(255,255,255,0.96), rgba(238,248,246,0.9));
  box-shadow: var(--stem-shadow);
  overflow: hidden;
}
.school-eyebrow {
  margin: 0 0 0.35rem;
  font-size: var(--stem-text-sm);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--stem-teal-deep);
}
.school-hero-title {
  margin: 0 0 0.55rem;
  font-family: var(--stem-font-display);
  font-size: clamp(1.65rem, 3vw, 2.15rem);
  font-weight: 700;
  color: var(--stem-ink);
  line-height: 1.15;
}
.school-hero-lead {
  margin: 0 0 1rem;
  max-width: 46ch;
  color: var(--stem-ink-soft);
  font-size: 0.98rem;
  line-height: 1.55;
}
.school-hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 1.1rem;
}
.school-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.28rem 0.65rem;
  border-radius: 999px;
  font-size: var(--stem-text-sm);
  font-weight: 600;
  background: rgba(12, 124, 128, 0.12);
  color: var(--stem-teal-deep);
  text-transform: capitalize;
}
.school-pill.is-soft {
  background: #fff;
  border: 1px solid var(--stem-line);
  color: var(--stem-ink-soft);
}
.school-hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}
.school-hero-visual {
  position: relative;
  min-height: 180px;
  border-radius: 18px;
  background: linear-gradient(145deg, #055456, #0c7c80 48%, #3b93bc);
  overflow: hidden;
}
.school-hero-orb {
  position: absolute;
  width: 160px;
  height: 160px;
  border-radius: 50%;
  right: -30px;
  top: -40px;
  background: radial-gradient(circle, rgba(255,255,255,0.28), transparent 70%);
  animation: school-drift 8s ease-in-out infinite alternate;
}
.school-hero-panel {
  position: absolute;
  inset: auto 1rem 1rem 1rem;
  color: #fff;
  display: grid;
  gap: 0.25rem;
}
.school-hero-panel span {
  font-size: var(--stem-text-xs);
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  opacity: 0.85;
}
.school-hero-panel strong {
  font-family: var(--stem-font-display);
  font-size: var(--stem-text-2xl);
}
.school-hero-panel p {
  margin: 0;
  font-size: var(--stem-text-md);
  opacity: 0.88;
}
@keyframes school-drift {
  from { transform: translate(0, 0); }
  to { transform: translate(-12px, 10px); }
}
.school-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  align-items: start;
}
.school-attention {
  list-style: none;
  margin: 0 0 1rem;
  padding: 0;
  display: grid;
  gap: 0.65rem;
}
.school-attention li {
  display: grid;
  gap: 0.2rem;
  padding: 0.75rem 0.85rem;
  border-radius: 12px;
  border: 1px solid var(--stem-line);
  background: #fff;
}
.school-attention li.is-warn {
  border-color: rgba(232, 137, 74, 0.45);
  background: rgba(232, 137, 74, 0.08);
}
.school-attention li.is-info {
  border-color: rgba(12, 124, 128, 0.28);
  background: var(--stem-mint-soft);
}
.school-attention strong { font-size: var(--stem-text-base); }
.school-attention span { font-size: var(--stem-text-md); color: var(--stem-ink-soft); }
.school-approvals {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.school-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.55rem;
}
.school-list li {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: flex-start;
  padding: 0.7rem 0.15rem;
  border-bottom: 1px solid var(--stem-line);
}
.school-list li:last-child { border-bottom: none; }
.school-list strong { display: block; font-size: var(--stem-text-base); }
.school-list span {
  display: block;
  margin-top: 0.15rem;
  font-size: var(--stem-text-md);
  color: var(--stem-ink-soft);
}
.school-list time {
  font-size: var(--stem-text-sm);
  font-weight: 600;
  color: var(--stem-teal-deep);
  white-space: nowrap;
}
.school-inline-link {
  display: inline-block;
  margin-top: 0.85rem;
  font-size: var(--stem-text-md);
  font-weight: 600;
  color: var(--stem-teal-deep);
}
.school-inline-link:hover { text-decoration: underline; }
.school-shortcuts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
}
.school-shortcut {
  display: grid;
  gap: 0.3rem;
  padding: 1rem;
  border-radius: 14px;
  border: 1px solid var(--stem-line);
  background: linear-gradient(180deg, #fff, var(--stem-mint-soft));
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s ease, transform 0.15s ease;
}
.school-shortcut:hover {
  border-color: rgba(12, 124, 128, 0.45);
  transform: translateY(-1px);
}
.school-shortcut strong { color: var(--stem-teal-deep); }
.school-shortcut span { font-size: var(--stem-text-md); color: var(--stem-ink-soft); }
.school-muted { margin: 0; color: var(--stem-ink-soft); }
@media (max-width: 900px) {
  .school-hero,
  .school-grid { grid-template-columns: 1fr; }
  .school-hero-visual { min-height: 150px; }
}
`;
