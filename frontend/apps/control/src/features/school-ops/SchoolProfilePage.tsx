import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
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
import { ControlLayout } from '../../layout/ControlLayout';
import { statusLabel } from '../../types';

type SchoolProfile = {
  id: number;
  tenant_id: number;
  code: string;
  name_en: string;
  name_ar: string;
  timezone: string | null;
  status: string;
  country: { id: number; code: string; name_en: string } | null;
  campuses: { id: number; code: string; name_en: string; status: string }[];
};

type ProfileForm = {
  code: string;
  name_en: string;
  name_ar: string;
  timezone: string;
  status: string;
};

const TIMEZONES = [
  'Asia/Riyadh',
  'Asia/Dubai',
  'Asia/Kuwait',
  'Asia/Bahrain',
  'Asia/Qatar',
  'Asia/Muscat',
  'Asia/Amman',
  'Asia/Beirut',
  'Africa/Cairo',
  'UTC',
];

const SCHOOL_LINKS = [
  { to: '/school/campuses', label: 'Campuses' },
  { to: '/school/academic-years', label: 'Academic years' },
  { to: '/school/terms', label: 'Terms' },
] as const;

function canAccessSchoolOps(
  isSuperAdmin: boolean,
  isTenantOwner: boolean,
  hasPermission: (code: string | string[]) => boolean,
) {
  return (
    isSuperAdmin ||
    isTenantOwner ||
    hasPermission([
      'tenant.schools.manage',
      'school.settings.manage',
      'school.campuses.manage',
      'school.academics.manage',
      'nav.control.school-management',
    ])
  );
}

/**
 * View and edit the active school profile for the current tenant context.
 */
export function SchoolProfilePage() {
  const { isSuperAdmin, isTenantOwner, hasPermission } = useAuth();
  if (!canAccessSchoolOps(isSuperAdmin, isTenantOwner, hasPermission)) {
    return <Navigate to="/" replace />;
  }

  return (
    <ControlLayout
      title="School profile"
      subtitle="Manage your school identity, timezone, and lifecycle status"
    >
      <SchoolProfileWorkspace />
    </ControlLayout>
  );
}

function SchoolProfileWorkspace() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [profile, setProfile] = useState<SchoolProfile | null>(null);
  const [form, setForm] = useState<ProfileForm>({
    code: '',
    name_en: '',
    name_ar: '',
    timezone: 'Asia/Riyadh',
    status: 'active',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: SchoolProfile }>('/control/school-ops/school');
      setProfile(res.data);
      setForm({
        code: res.data.code ?? '',
        name_en: res.data.name_en ?? '',
        name_ar: res.data.name_ar ?? '',
        timezone: res.data.timezone || 'Asia/Riyadh',
        status: res.data.status || 'active',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load school profile');
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
    setError(null);
    try {
      const res = await api.request<{ data: SchoolProfile; message: string }>(
        '/control/school-ops/school',
        {
          method: 'PUT',
          body: JSON.stringify({
            code: form.code.trim(),
            name_en: form.name_en.trim(),
            name_ar: form.name_ar.trim() || form.name_en.trim(),
            timezone: form.timezone,
            status: form.status,
          }),
        },
      );
      setProfile(res.data);
      setEditing(false);
      await feedback.success({
        title: 'School profile saved',
        message: res.message || `${res.data.name_en} has been updated.`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save school profile');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !profile) {
    return <p className="sp-muted">Loading school profile…</p>;
  }

  if (error && !profile) {
    return (
      <Panel title="Unable to load school profile">
        <p style={{ color: 'var(--stem-danger)', marginTop: 0 }}>{error}</p>
        <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
          Retry
        </Button>
      </Panel>
    );
  }

  return (
    <div className="sp-page">
      <section className="sp-hero stem-animate-rise">
        <div>
          <p className="sp-eyebrow">Control · School management</p>
          <h2 className="sp-hero-title">{profile?.name_en ?? 'School profile'}</h2>
          <p className="sp-hero-lead">
            Configure how your school appears across campuses, academic calendars, and user
            experiences — including default timezone and status.
          </p>
        </div>
        <div className="sp-hero-actions">
          <div className="sp-action-row">
            <Button
              size="sm"
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => void load()}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            {SCHOOL_LINKS.map((link) => (
              <Link key={link.to} to={link.to} className="sp-ghost-link">
                {link.label}
              </Link>
            ))}
            {!editing ? (
              <Button size="sm" type="button" variant="apricot" onClick={() => setEditing(true)}>
                Edit profile
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      {error ? (
        <div className="sp-alert" role="alert">
          <span>{error}</span>
          <Button size="sm" type="button" variant="secondary" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <StatStrip
        items={[
          { label: 'Campuses', value: String(profile?.campuses.length ?? '—') },
          { label: 'Country', value: profile?.country?.name_en ?? '—' },
          { label: 'Timezone', value: profile?.timezone ?? '—' },
          { label: 'Status', value: profile ? statusLabel(profile.status) : '—' },
        ]}
      />

      <div className="sp-layout">
        <Panel
          title={editing ? 'Edit school profile' : 'School details'}
          description={
            editing
              ? 'Update names, timezone, or lifecycle status for your school.'
              : 'Review core school settings. Select Edit to make changes.'
          }
        >
          {editing ? (
            <form onSubmit={onSave} className="sp-form" noValidate>
              <TextField
                label="School code"
                required
                value={form.code}
                maxLength={64}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              />
              <TextField
                label="English name"
                required
                value={form.name_en}
                onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
              />
              <TextField
                label="Arabic name"
                value={form.name_ar}
                onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))}
                hint="Optional — defaults to English name"
              />
              <SelectField
                label="Timezone"
                value={form.timezone}
                onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Status"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </SelectField>
              <FormActions>
                <Button
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditing(false);
                    if (profile) {
                      setForm({
                        code: profile.code,
                        name_en: profile.name_en,
                        name_ar: profile.name_ar ?? '',
                        timezone: profile.timezone || 'Asia/Riyadh',
                        status: profile.status,
                      });
                    }
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" type="submit" variant="primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </Button>
              </FormActions>
            </form>
          ) : (
            <dl className="sp-meta">
              <div>
                <dt>Code</dt>
                <dd>
                  <code>{profile?.code}</code>
                </dd>
              </div>
              <div>
                <dt>English name</dt>
                <dd>{profile?.name_en}</dd>
              </div>
              <div>
                <dt>Arabic name</dt>
                <dd>{profile?.name_ar || '—'}</dd>
              </div>
              <div>
                <dt>Country</dt>
                <dd>
                  {profile?.country
                    ? `${profile.country.name_en} (${profile.country.code})`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>Timezone</dt>
                <dd>{profile?.timezone ?? '—'}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <StatusPill status={profile?.status ?? 'active'} />
                </dd>
              </div>
            </dl>
          )}
        </Panel>

        <aside className="sp-side">
          <div className="sp-detail">
            <h3>Linked campuses</h3>
            {(profile?.campuses.length ?? 0) === 0 ? (
              <p className="sp-muted">No campuses yet. Add one from the campuses page.</p>
            ) : (
              <ul className="sp-campus-list">
                {profile!.campuses.map((c) => (
                  <li key={c.id}>
                    <strong>{c.name_en}</strong>
                    <span>
                      <code>{c.code}</code> · {statusLabel(c.status)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="sp-links">
              <Link to="/school/campuses">Manage campuses</Link>
              <Link to="/school/academic-years">Academic years</Link>
              <Link to="/school/terms">Terms</Link>
            </div>
          </div>
        </aside>
      </div>

      <style>{profileStyles}</style>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`sp-pill status-${status}`}>{statusLabel(status)}</span>;
}

const profileStyles = `
.sp-page { display: grid; gap: 1rem; }
.sp-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(220px, 0.7fr);
  gap: 1.25rem;
  align-items: end;
  padding: 1.25rem 1.35rem;
  border-radius: 18px;
  border: 1px solid var(--stem-line);
  background:
    radial-gradient(120% 90% at 100% 0%, rgba(12, 124, 128, 0.14), transparent 55%),
    linear-gradient(145deg, #f3faf8, #eef5f2);
}
.sp-eyebrow {
  margin: 0 0 0.3rem;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--stem-teal-deep);
}
.sp-hero-title {
  margin: 0 0 0.35rem;
  font-family: var(--stem-font-display);
  font-size: clamp(1.35rem, 1.8vw, 1.55rem);
  letter-spacing: -0.03em;
}
.sp-hero-lead {
  margin: 0;
  color: var(--stem-ink-soft);
  line-height: 1.5;
  max-width: 42rem;
  font-size: var(--stem-text-base);
}
.sp-hero-actions { display: grid; gap: 0.75rem; justify-items: end; }
.sp-action-row { display: flex; flex-wrap: wrap; gap: 0.45rem; justify-content: flex-end; align-items: center; }
.sp-ghost-link {
  display: inline-flex; align-items: center; min-height: 40px; padding: 0 0.75rem;
  font-size: var(--stem-text-md); font-weight: 600; color: var(--stem-teal-deep); text-decoration: none;
}
.sp-ghost-link:hover { text-decoration: underline; }
.sp-alert {
  display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;
  padding: 0.85rem 1rem; border-radius: 12px; background: #fef3f2; color: var(--stem-danger);
  border: 1px solid #fecdca; font-size: var(--stem-text-base);
}
.sp-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(280px, 0.85fr);
  gap: 1rem;
  align-items: start;
}
.sp-side { position: sticky; top: 0.75rem; }
.sp-detail {
  display: grid;
  gap: 0.85rem;
  padding: 1.1rem 1.15rem;
  border-radius: 16px;
  border: 1px solid var(--stem-line);
  background: #fff;
}
.sp-detail h3 { margin: 0; font-size: var(--stem-text-lg); letter-spacing: -0.02em; }
.sp-meta {
  display: grid;
  gap: 0.55rem;
  margin: 0;
}
.sp-meta > div {
  display: grid;
  grid-template-columns: 7.5rem minmax(0, 1fr);
  gap: 0.5rem;
  align-items: baseline;
}
.sp-meta dt {
  margin: 0;
  font-size: var(--stem-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--stem-ink-soft);
}
.sp-meta dd { margin: 0; font-size: var(--stem-text-base); }
.sp-campus-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.45rem;
}
.sp-campus-list li { display: grid; gap: 0.1rem; font-size: var(--stem-text-md); }
.sp-campus-list span { color: var(--stem-ink-soft); font-size: var(--stem-text-sm); }
.sp-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--stem-line);
}
.sp-links a {
  font-size: var(--stem-text-md);
  font-weight: 600;
  color: var(--stem-teal-deep);
  text-decoration: none;
}
.sp-links a:hover { text-decoration: underline; }
.sp-form { display: grid; gap: 0.85rem; }
.sp-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: var(--stem-text-xs);
  font-weight: 700;
  letter-spacing: 0.02em;
  background: #f3f4f6;
  color: #374151;
}
.sp-pill.status-active { background: #ecfdf5; color: #047857; }
.sp-pill.status-inactive { background: #f3f4f6; color: #4b5563; }
.sp-muted { color: var(--stem-ink-soft); font-size: var(--stem-text-base); margin: 0; }
@media (max-width: 960px) {
  .sp-hero, .sp-layout { grid-template-columns: 1fr; }
  .sp-hero-actions { justify-items: start; }
  .sp-action-row { justify-content: flex-start; }
  .sp-side { position: static; }
}
`;
