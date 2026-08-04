import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import {
  Button,
  FormActions,
  PaginationBar,
  Panel,
  SelectField,
  StatStrip,
  TextAreaField,
  TextField,
  useClientPagination,
  useFeedback,
  validateFormFields,
} from '@stemora/ui';
import {
  StatusPill,
  TUTOR_API,
  TutorShell,
  formatMoney,
  formatWhen,
  personName,
} from './shared';

type StudentOption = {
  user_id: number;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
};

export function TutorProgressPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { api } = useAuth();
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentId, setStudentId] = useState(searchParams.get('student') || '');
  const [data, setData] = useState<{
    student: StudentOption & { user_id: number };
    sessions: { id: number; starts_at?: string | null; status: string; subject?: string | null; attendance?: string | null }[];
    attendance_summary: Record<string, number>;
    stats: { sessions: number; completed: number; upcoming: number };
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get<{ data: StudentOption[] }>(`${TUTOR_API}/students`);
        setStudents(res.data ?? []);
        if (!studentId && res.data[0]) setStudentId(String(res.data[0].user_id));
      } catch {
        /* roster may be empty */
      }
    })();
  }, [api, studentId]);

  const load = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: NonNullable<typeof data> }>(
        `${TUTOR_API}/student-progress?student_user_id=${encodeURIComponent(studentId)}`,
      );
      setData(res.data);
      setSearchParams({ student: studentId });
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Failed to load progress.');
    } finally {
      setLoading(false);
    }
  }, [api, studentId, setSearchParams]);

  useEffect(() => {
    void load();
  }, [load]);

  const listPage = useClientPagination(data?.sessions ?? []);

  return (
    <TutorShell title="Student Progress" subtitle="Attendance and session history by learner">
      <div className="tp-page">
        <section className="tp-hero stem-animate-rise">
          <div>
            <p className="tp-eyebrow">Tutor portal · Progress</p>
            <h2 className="tp-hero-title">Student progress</h2>
            <p className="tp-hero-lead">Review how a learner is engaging across your tutoring sessions.</p>
          </div>
        </section>
        <div className="tp-toolbar">
          <label>
            Student
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">Select student</option>
              {students.map((s) => (
                <option key={s.user_id} value={s.user_id}>
                  {personName(s.first_name, s.last_name, s.email)}
                </option>
              ))}
            </select>
          </label>
          <Button size="sm" type="button" variant="secondary" disabled={loading || !studentId} onClick={() => void load()}>
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
        </div>
        {error ? <div className="tp-alert">{error}</div> : null}
        {data ? (
          <>
            <StatStrip
              items={[
                { label: 'Sessions', value: String(data.stats.sessions) },
                { label: 'Completed', value: String(data.stats.completed) },
                { label: 'Upcoming', value: String(data.stats.upcoming) },
              ]}
            />
            <div className="tp-layout">
              <Panel
                title={personName(data.student.first_name, data.student.last_name, data.student.email)}
                description={data.student.email ?? undefined}
              >
                <div className="tp-table-wrap">
                  <table className="tp-table">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Subject</th>
                        <th>Status</th>
                        <th>Attendance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listPage.pageItems.map((s) => (
                        <tr key={s.id}>
                          <td>{formatWhen(s.starts_at)}</td>
                          <td>{s.subject || '—'}</td>
                          <td>
                            <StatusPill status={s.status} />
                          </td>
                          <td>{s.attendance ? <StatusPill status={s.attendance} /> : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <PaginationBar
                  page={listPage.page}
                  lastPage={listPage.lastPage}
                  total={listPage.total}
                  onPageChange={listPage.setPage}
                  disabled={loading}
                />
              </Panel>
              <aside>
                <Panel title="Attendance summary">
                  {Object.keys(data.attendance_summary).length === 0 ? (
                    <p className="tp-muted">No attendance marked yet.</p>
                  ) : (
                    <dl className="tp-meta">
                      {Object.entries(data.attendance_summary).map(([k, v]) => (
                        <div key={k}>
                          <dt>{k}</dt>
                          <dd>{v}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </Panel>
              </aside>
            </div>
          </>
        ) : (
          !loading && <p className="tp-muted">Choose a student to view progress.</p>
        )}
      </div>
    </TutorShell>
  );
}

export function TutorEarningsPage() {
  const { api } = useAuth();
  const [rows, setRows] = useState<
    {
      id: number;
      amount: number;
      currency: string;
      status: string;
      period_start?: string | null;
      period_end?: string | null;
      paid_at?: string | null;
      reference?: string | null;
    }[]
  >([]);
  const [stats, setStats] = useState<{ paid_total: number; pending_total: number; currency: string; total: number } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: typeof rows; meta?: { stats?: typeof stats } }>(`${TUTOR_API}/earnings`);
      setRows(res.data ?? []);
      setStats(res.meta?.stats ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load earnings.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const currency = stats?.currency ?? 'SAR';
  const listPage = useClientPagination(rows);

  return (
    <TutorShell title="Earnings" subtitle="Payments linked to your tutor profile">
      <div className="tp-page">
        <section className="tp-hero stem-animate-rise">
          <div>
            <p className="tp-eyebrow">Tutor portal · Finance</p>
            <h2 className="tp-hero-title">Earnings</h2>
            <p className="tp-hero-lead">Track paid and pending tutor payments for your profile.</p>
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
            { label: 'Paid', value: formatMoney(stats?.paid_total ?? 0, currency) },
            { label: 'Pending', value: formatMoney(stats?.pending_total ?? 0, currency) },
            { label: 'Records', value: String(stats?.total ?? rows.length) },
          ]}
        />
        <Panel title="Payment history">
          <div className="tp-table-wrap">
            <table className="tp-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Paid</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="tp-empty">
                      {loading ? 'Loading…' : 'No payment records yet.'}
                    </td>
                  </tr>
                ) : (
                  listPage.pageItems.map((row) => (
                    <tr key={row.id}>
                      <td>
                        {row.period_start || '—'} → {row.period_end || '—'}
                      </td>
                      <td>{formatMoney(row.amount, row.currency)}</td>
                      <td>
                        <StatusPill status={row.status} />
                      </td>
                      <td>{formatWhen(row.paid_at)}</td>
                      <td>{row.reference || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <PaginationBar
            page={listPage.page}
            lastPage={listPage.lastPage}
            total={listPage.total}
            onPageChange={listPage.setPage}
            disabled={loading}
          />
        </Panel>
      </div>
    </TutorShell>
  );
}

export function TutorNotificationsPage() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [rows, setRows] = useState<
    { id: string; type: string; data?: Record<string, unknown>; read_at?: string | null; created_at?: string | null }[]
  >([]);
  const [stats, setStats] = useState<{ total: number; unread: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: typeof rows; meta?: { stats?: { total: number; unread: number } } }>(
        `${TUTOR_API}/notifications`,
      );
      setRows(res.data ?? []);
      setStats(res.meta?.stats ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(id: string) {
    try {
      await api.post(`${TUTOR_API}/notifications/${id}/read`);
      await load();
    } catch (err) {
      await feedback.error({
        title: 'Update failed',
        message: err instanceof Error ? err.message : 'Could not mark as read.',
      });
    }
  }

  async function markAll() {
    try {
      await api.post(`${TUTOR_API}/notifications/read-all`);
      await feedback.success({ title: 'All read', message: 'Notifications marked as read.' });
      await load();
    } catch (err) {
      await feedback.error({
        title: 'Update failed',
        message: err instanceof Error ? err.message : 'Could not mark all as read.',
      });
    }
  }

  return (
    <TutorShell title="Notifications" subtitle="Alerts for your tutor account">
      <div className="tp-page">
        <section className="tp-hero stem-animate-rise">
          <div>
            <p className="tp-eyebrow">Tutor portal · Inbox</p>
            <h2 className="tp-hero-title">Notifications</h2>
            <p className="tp-hero-lead">Stay on top of session changes, payments, and school notices.</p>
          </div>
          <div className="tp-hero-actions">
            <Button size="sm" type="button" variant="secondary" onClick={() => void markAll()}>
              Mark all read
            </Button>
            <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>
        </section>
        {error ? <div className="tp-alert">{error}</div> : null}
        <StatStrip
          items={[
            { label: 'Total', value: String(stats?.total ?? rows.length) },
            { label: 'Unread', value: String(stats?.unread ?? '—') },
          ]}
        />
        <Panel title="Inbox">
          {rows.length === 0 ? (
            <p className="tp-empty">{loading ? 'Loading…' : 'No notifications yet.'}</p>
          ) : (
            <ul className="tp-list">
              {rows.map((row) => {
                const title =
                  (typeof row.data?.title === 'string' && row.data.title) ||
                  (typeof row.data?.message === 'string' && row.data.message) ||
                  row.type;
                return (
                  <li key={row.id}>
                    <div>
                      <strong>{title}</strong>
                      <span>{formatWhen(row.created_at)}</span>
                    </div>
                    <div className="tp-actions">
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
      </div>
    </TutorShell>
  );
}

export function TutorProfilePage() {
  const { tenantSlug = 'al-noor' } = useParams();
  const { api } = useAuth();
  const feedback = useFeedback();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [subjects, setSubjects] = useState<{ id: number; code?: string; name_en?: string }[]>([]);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [form, setForm] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    locale: 'en',
    timezone: 'Asia/Riyadh',
    bio_en: '',
    bio_ar: '',
    hourly_rate: '',
    status: '',
    school: '',
    school_code: '',
    user_status: '',
  });

  const patch = useCallback(<K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setDirty(true);
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{
        data: {
          user: {
            email: string;
            first_name?: string;
            last_name?: string;
            phone?: string | null;
            locale?: string;
            timezone?: string | null;
            status?: string;
          };
          tutor_profile?: {
            id?: number;
            status?: string;
            bio_en?: string | null;
            bio_ar?: string | null;
            hourly_rate?: number | null;
            subjects?: { id: number; code?: string; name_en?: string }[];
          } | null;
          school?: { name_en?: string; code?: string };
        };
      }>(`${TUTOR_API}/profile`);
      const u = res.data.user;
      const p = res.data.tutor_profile;
      setProfileId(p?.id ?? null);
      setSubjects(p?.subjects ?? []);
      setForm({
        email: u.email ?? '',
        first_name: u.first_name ?? '',
        last_name: u.last_name ?? '',
        phone: u.phone ?? '',
        locale: u.locale ?? 'en',
        timezone: u.timezone || 'Asia/Riyadh',
        bio_en: p?.bio_en ?? '',
        bio_ar: p?.bio_ar ?? '',
        hourly_rate: p?.hourly_rate != null ? String(p.hourly_rate) : '',
        status: p?.status ?? '',
        school: res.data.school?.name_en ?? '',
        school_code: res.data.school?.code ?? '',
        user_status: u.status ?? '',
      });
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile.');
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
      await api.put(`${TUTOR_API}/profile`, {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim() || null,
        locale: form.locale,
        timezone: form.timezone.trim() || null,
        bio_en: form.bio_en.trim() || null,
        bio_ar: form.bio_ar.trim() || null,
        hourly_rate: form.hourly_rate === '' ? null : Number(form.hourly_rate),
      });
      await feedback.success({ title: 'Profile saved', message: 'Your tutor profile was updated.' });
      await load();
    } catch (err) {
      await feedback.error({
        title: 'Save failed',
        message: err instanceof Error ? err.message : 'Could not update profile.',
      });
    } finally {
      setSaving(false);
    }
  }

  const displayName = personName(form.first_name, form.last_name, form.email);
  const initials = [form.first_name, form.last_name]
    .map((p) => p.trim().charAt(0))
    .join('')
    .toUpperCase() || form.email.slice(0, 2).toUpperCase() || 'T';
  const rateLabel =
    form.hourly_rate !== '' && !Number.isNaN(Number(form.hourly_rate))
      ? formatMoney(Number(form.hourly_rate))
      : '—';
  const timezoneOptions =
    form.timezone && !TIMEZONES.includes(form.timezone)
      ? [form.timezone, ...TIMEZONES]
      : TIMEZONES;

  return (
    <TutorShell
      title="Profile"
      subtitle="Your tutor account and public bio"
      headerActions={
        <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      }
    >
      <div className="tp-page">
        <section className="tp-hero stem-animate-rise">
          <div className="tp-hero-copy">
            <p className="tp-eyebrow">Tutor portal · Account</p>
            <h2 className="tp-hero-title">Your profile</h2>
            <p className="tp-hero-lead">
              Keep contact details and tutoring bios current so families and school admins see accurate information.
            </p>
            <div className="tp-chip-row">
              {form.school ? <span className="tp-chip">{form.school}</span> : null}
              {form.status ? (
                <span className="tp-chip">
                  Profile · {form.status.replace(/_/g, ' ')}
                </span>
              ) : (
                <span className="tp-chip">No tutor profile linked</span>
              )}
              {profileId ? <span className="tp-chip">ID · {profileId}</span> : null}
            </div>
          </div>
          <div className="tp-hero-actions">
            <Button size="sm" to={`/${tenantSlug}/change-password`} variant="secondary">
              Change password
            </Button>
            <Button size="sm" to={`/${tenantSlug}/availability`} variant="secondary">
              Availability
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
            { label: 'Hourly rate', value: rateLabel },
            { label: 'Subjects', value: String(subjects.length) },
            { label: 'Locale', value: form.locale === 'ar' ? 'Arabic' : 'English' },
            { label: 'Timezone', value: form.timezone || '—' },
          ]}
        />

        <div className="tp-layout">
          <form className="tp-form" onSubmit={onSave} noValidate style={{ display: 'grid', gap: '1rem' }}>
            <Panel title="Account details" description="Name and contact shown across the institution portals.">
              <div className="tp-form-grid">
                <TextField label="Email" value={form.email} disabled hint="Managed by your school administrator." />
                <TextField
                  label="Phone"
                  value={form.phone}
                  placeholder="+966…"
                  onChange={(e) => patch('phone', e.target.value)}
                />
                <TextField
                  label="First name"
                  required
                  value={form.first_name}
                  onChange={(e) => patch('first_name', e.target.value)}
                />
                <TextField
                  label="Last name"
                  value={form.last_name}
                  onChange={(e) => patch('last_name', e.target.value)}
                />
              </div>
            </Panel>

            <Panel title="Preferences" description="Language and timezone for scheduling and notifications.">
              <div className="tp-form-grid">
                <SelectField label="Locale" value={form.locale} onChange={(e) => patch('locale', e.target.value)}>
                  <option value="en">English</option>
                  <option value="ar">Arabic</option>
                </SelectField>
                <SelectField
                  label="Timezone"
                  value={form.timezone}
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

            <Panel
              title="Tutoring bio"
              description="Visible to parents and school staff when they review your tutor profile."
            >
              <div className="tp-form-grid">
                <TextField
                  label="Hourly rate (SAR)"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.hourly_rate}
                  placeholder="e.g. 120"
                  onChange={(e) => patch('hourly_rate', e.target.value)}
                />
                <div />
              </div>
              <TextAreaField
                label="Bio (English)"
                rows={4}
                value={form.bio_en}
                placeholder="Subjects, teaching style, and experience…"
                onChange={(e) => patch('bio_en', e.target.value)}
              />
              <TextAreaField
                label="Bio (Arabic)"
                rows={4}
                value={form.bio_ar}
                placeholder="نبذة مختصرة…"
                onChange={(e) => patch('bio_ar', e.target.value)}
              />
            </Panel>

            <FormActions>
              <Button
                size="sm"
                type="button"
                variant="secondary"
                disabled={loading || saving || !dirty}
                onClick={() => void load()}
              >
                Discard
              </Button>
              <Button size="sm" type="submit" variant="primary" disabled={saving || loading || !dirty}>
                {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
              </Button>
            </FormActions>
          </form>

          <aside className="tp-side">
            <div className="tp-detail">
              <div className="tp-detail-head">
                <span className="tp-detail-mark" aria-hidden>
                  {initials}
                </span>
                <div>
                  <h3>{loading ? 'Loading…' : displayName}</h3>
                  <p>{form.email || '—'}</p>
                </div>
              </div>
              <dl className="tp-meta">
                <div>
                  <dt>School</dt>
                  <dd>
                    {form.school || '—'}
                    {form.school_code ? ` (${form.school_code})` : ''}
                  </dd>
                </div>
                <div>
                  <dt>Profile</dt>
                  <dd>{form.status ? <StatusPill status={form.status} /> : 'Not linked'}</dd>
                </div>
                <div>
                  <dt>Account</dt>
                  <dd>{form.user_status ? <StatusPill status={form.user_status} /> : '—'}</dd>
                </div>
                <div>
                  <dt>Rate</dt>
                  <dd>{rateLabel}</dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>{form.phone || '—'}</dd>
                </div>
              </dl>
              <div className="tp-actions">
                <Button size="sm" to={`/${tenantSlug}/change-password`} variant="secondary">
                  Change password
                </Button>
                <Button size="sm" to={`/${tenantSlug}/notifications`} variant="secondary">
                  Notifications
                </Button>
              </div>
            </div>

            <Panel title="Subjects" description="Assigned by your school for tutoring sessions.">
              {subjects.length === 0 ? (
                <p className="tp-muted">No subjects linked yet. Ask your school admin to assign subjects to your tutor profile.</p>
              ) : (
                <ul className="tp-subject-list">
                  {subjects.map((s) => (
                    <li key={s.id}>
                      <strong>{s.name_en || s.code || `Subject #${s.id}`}</strong>
                      {s.code ? <span>{s.code}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </aside>
        </div>
      </div>
    </TutorShell>
  );
}

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
