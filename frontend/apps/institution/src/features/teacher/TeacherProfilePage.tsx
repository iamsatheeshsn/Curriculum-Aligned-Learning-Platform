import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
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
  EmptyState,
  ErrorBanner,
  StatusPill,
  TEACHER_API,
  TeacherShell,
  initials,
  useTeacherContext,
} from './shared';

type ProfileUser = {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  locale: string | null;
  timezone: string | null;
  status: string;
};

type TutorProfile = {
  id: number;
  status: string;
  bio_en: string | null;
  bio_ar: string | null;
  hourly_rate: number | null;
  subjects: { id: number; code: string; name_en: string }[];
};

type Profile = {
  user: ProfileUser;
  tutor_profile: TutorProfile | null;
  school: { id: number; name_en: string; code: string };
};

type ProfileForm = {
  first_name: string;
  last_name: string;
  phone: string;
  locale: string;
  timezone: string;
  bio_en: string;
  bio_ar: string;
  hourly_rate: string;
};

const TIMEZONES = [
  'Asia/Riyadh',
  'Asia/Dubai',
  'Asia/Qatar',
  'Asia/Kuwait',
  'Africa/Cairo',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'UTC',
];

const emptyForm = (): ProfileForm => ({
  first_name: '',
  last_name: '',
  phone: '',
  locale: 'en',
  timezone: '',
  bio_en: '',
  bio_ar: '',
  hourly_rate: '',
});

function toForm(profile: Profile): ProfileForm {
  return {
    first_name: profile.user.first_name ?? '',
    last_name: profile.user.last_name ?? '',
    phone: profile.user.phone ?? '',
    locale: profile.user.locale ?? 'en',
    timezone: profile.user.timezone ?? '',
    bio_en: profile.tutor_profile?.bio_en ?? '',
    bio_ar: profile.tutor_profile?.bio_ar ?? '',
    hourly_rate: profile.tutor_profile?.hourly_rate != null ? String(profile.tutor_profile.hourly_rate) : '',
  };
}

export function TeacherProfilePage() {
  const { tenantSlug = 'al-noor' } = useParams();
  const { api } = useAuth();
  const feedback = useFeedback();
  const { context } = useTeacherContext();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<ProfileForm>(emptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: Profile }>(`${TEACHER_API}/profile`);
      setProfile(res.data);
      setForm(toForm(res.data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your profile.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const fullName = useMemo(() => {
    const name = [form.first_name, form.last_name].filter(Boolean).join(' ').trim();
    return name || context?.teacher.name || profile?.user.email || 'Your profile';
  }, [form.first_name, form.last_name, context, profile]);

  /** Keep a saved timezone selectable even when it is outside the shortlist. */
  const timezoneOptions = useMemo(() => {
    if (form.timezone && !TIMEZONES.includes(form.timezone)) return [form.timezone, ...TIMEZONES];
    return TIMEZONES;
  }, [form.timezone]);

  const studentTotal = useMemo(
    () => (context?.sections ?? []).reduce((sum, section) => sum + section.students_count, 0),
    [context]
  );

  function patch(field: keyof ProfileForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateFormFields(event.currentTarget)) return;
    setSaving(true);
    setError(null);

    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim() || null,
      phone: form.phone.trim() || null,
      locale: form.locale || null,
      timezone: form.timezone || null,
      bio_en: form.bio_en.trim() || null,
      bio_ar: form.bio_ar.trim() || null,
      hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null,
    };

    try {
      const res = await api.request<{ message: string; data: Profile }>(`${TEACHER_API}/profile`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setProfile(res.data);
      setForm(toForm(res.data));
      await feedback.success({ title: 'Profile updated', message: 'Your details have been saved.' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  const tutorProfile = profile?.tutor_profile ?? null;

  return (
    <TeacherShell
      title="Profile"
      subtitle="Your account and teaching details"
      headerActions={
        <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      }
    >
      <div className="tp-page">
        <section className="tp-hero stem-animate-rise">
          <div className="tp-hero-copy">
            <p className="tp-eyebrow">Teacher portal · Account</p>
            <div className="tk-person">
              <span
                className="tk-avatar"
                aria-hidden="true"
                style={{ width: '64px', height: '64px', borderRadius: '18px', fontSize: '1.4rem' }}
              >
                {initials(fullName)}
              </span>
              <div>
                <h2 className="tp-hero-title">{loading && !profile ? 'Loading…' : fullName}</h2>
                <span>{profile?.user.email ?? '—'}</span>
              </div>
            </div>
            <p className="tp-hero-lead">
              {profile ? `${profile.school.name_en} · ${profile.school.code}` : 'Your school details load with your profile.'}
            </p>
          </div>
          <div className="tp-hero-actions">
            <StatusPill status={profile?.user.status} />
          </div>
        </section>

        <ErrorBanner error={error} onDismiss={() => setError(null)} />

        <StatStrip
          items={[
            { label: 'Classes', value: String(context?.sections.length ?? 0), hint: 'Sections you teach' },
            { label: 'Students', value: String(studentTotal), hint: 'Across all your sections' },
            { label: 'Subjects', value: String(context?.subjects.length ?? 0), hint: 'Assigned to you' },
          ]}
        />

        <div className="tp-layout">
          <form className="tp-form" onSubmit={onSave} noValidate style={{ display: 'grid', gap: '1rem' }}>
            <Panel title="Personal details" description="Shown to colleagues, students, and parents across the portal.">
              <div className="tp-form-grid">
                <TextField
                  label="First name"
                  required
                  maxLength={100}
                  value={form.first_name}
                  onChange={(event) => patch('first_name', event.target.value)}
                />
                <TextField
                  label="Last name"
                  maxLength={100}
                  value={form.last_name}
                  onChange={(event) => patch('last_name', event.target.value)}
                />
                <TextField
                  label="Email"
                  type="email"
                  value={profile?.user.email ?? ''}
                  disabled
                  readOnly
                  hint="Your sign-in email cannot be changed here — ask your school administrator."
                />
                <TextField
                  label="Phone"
                  type="tel"
                  value={form.phone}
                  placeholder="+966…"
                  onChange={(event) => patch('phone', event.target.value)}
                />
                <SelectField
                  label="Language"
                  value={form.locale}
                  onChange={(event) => patch('locale', event.target.value)}
                >
                  <option value="en">English</option>
                  <option value="ar">العربية</option>
                </SelectField>
                <SelectField
                  label="Timezone"
                  value={form.timezone}
                  onChange={(event) => patch('timezone', event.target.value)}
                  hint="Used for lesson times and reminders."
                >
                  <option value="">Use the school timezone</option>
                  {timezoneOptions.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </SelectField>
              </div>
            </Panel>

            <Panel
              title="Tutoring profile"
              description="Optional — these details are only used if you also take tutoring sessions."
            >
              {tutorProfile ? null : (
                <p className="tp-muted">
                  You do not have a tutoring profile yet. Anything you add here will be used if your school enrols you
                  as a tutor.
                </p>
              )}
              <div className="tp-form">
                <TextAreaField
                  label="Bio (English)"
                  rows={4}
                  value={form.bio_en}
                  placeholder="Subjects, teaching style, and experience…"
                  onChange={(event) => patch('bio_en', event.target.value)}
                />
                <TextAreaField
                  label="Bio (Arabic)"
                  rows={4}
                  value={form.bio_ar}
                  placeholder="نبذة مختصرة…"
                  onChange={(event) => patch('bio_ar', event.target.value)}
                />
                <TextField
                  label="Hourly rate"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.hourly_rate}
                  placeholder="e.g. 120"
                  onChange={(event) => patch('hourly_rate', event.target.value)}
                  hint="Charged per tutoring hour, in your school's currency."
                />
              </div>
              {tutorProfile ? (
                <>
                  <div className="tp-chip-row">
                    <span className="tp-chip">Profile · {tutorProfile.status.replace(/_/g, ' ')}</span>
                    {tutorProfile.subjects.map((subject) => (
                      <span key={subject.id} className="tp-chip">
                        {subject.name_en} · {subject.code}
                      </span>
                    ))}
                  </div>
                  {tutorProfile.subjects.length === 0 ? (
                    <p className="tp-muted">No tutoring subjects linked yet.</p>
                  ) : null}
                </>
              ) : null}
            </Panel>

            <FormActions>
              <Button size="sm" type="submit" variant="primary" disabled={saving || loading}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </FormActions>
          </form>

          <aside className="tp-side">
            <Panel title="My classes" description="Sections assigned to you this academic year.">
              {context && context.sections.length > 0 ? (
                <ul className="tp-list">
                  {context.sections.map((section) => (
                    <li key={section.id}>
                      <strong>{section.label}</strong>
                      <span>
                        {section.students_count} student{section.students_count === 1 ? '' : 's'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="No classes yet"
                  message="Once your school assigns you to a section it will be listed here."
                />
              )}
            </Panel>

            <Panel title="Subjects" description="What you are approved to teach.">
              {context && context.subjects.length > 0 ? (
                <div className="tp-chip-row">
                  {context.subjects.map((subject) => (
                    <span key={subject.id} className="tp-chip">
                      {subject.name_en}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="tp-muted">No subjects assigned yet.</p>
              )}
            </Panel>

            <Panel title="Security" description="Keep your account safe.">
              <p className="tp-muted">
                Choose a password you do not use anywhere else, and change it straight away if you think someone else
                knows it.
              </p>
              <div className="tp-actions">
                <Button size="sm" variant="secondary" to={`/${tenantSlug}/change-password`}>
                  Change password
                </Button>
              </div>
            </Panel>
          </aside>
        </div>
      </div>
    </TeacherShell>
  );
}
