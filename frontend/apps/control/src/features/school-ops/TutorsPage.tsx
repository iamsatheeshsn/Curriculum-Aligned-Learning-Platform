import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import {
  Button,
  PaginationBar,
  useClientPagination,
  FormActions,
  Panel,
  SelectField,
  StatStrip,
  TextField,
  useFeedback,
  validateFormFields,
} from '@stemora/ui';
import { ControlLayout } from '../../layout/ControlLayout';
import { schoolOpsPageStyles } from './schoolOpsStyles';
import {
  SCHOOL_OPS_API,
  SchoolOpsGuard,
  StatusPill,
  initials,
  personName,
  useEnrollmentLookups,
} from './shared';
import type { StaffRow, TutorRow, TutorStats } from './types';

const P = 'tut-';

type TutorForm = {
  user_id: number | '';
  bio_en: string;
  status: string;
};

/**
 * Tutor profiles for supplemental tutoring.
 */
export function TutorsPage() {
  return (
    <SchoolOpsGuard navPermission="nav.control.teacher-management">
      <ControlLayout
        title="Tutors"
        subtitle="Manage tutor profiles, subjects, and availability"
      >
        <TutorsWorkspace />
      </ControlLayout>
    </SchoolOpsGuard>
  );
}

function TutorsWorkspace() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const { subjects } = useEnrollmentLookups();
  const [rows, setRows] = useState<TutorRow[]>([]);
  const listPage = useClientPagination(rows);

  const [stats, setStats] = useState<TutorStats | null>(null);
  const [teachers, setTeachers] = useState<StaffRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view');
  const [form, setForm] = useState<TutorForm>({ user_id: '', bio_en: '', status: 'active' });
  const [editStatus, setEditStatus] = useState('active');
  const [editBio, setEditBio] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tutors, staff] = await Promise.all([
        api.get<{ data: TutorRow[]; meta: { stats: TutorStats } }>(`${SCHOOL_OPS_API}/tutors`),
        api.get<{ data: StaffRow[] }>(`${SCHOOL_OPS_API}/teachers`),
      ]);
      setRows(tutors.data);
      setStats(tutors.meta.stats);
      setTeachers(staff.data);
      setSelectedId((current) => {
        if (mode === 'create') return current;
        if (current && tutors.data.some((r) => r.id === current)) return current;
        return tutors.data[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tutors');
    } finally {
      setLoading(false);
    }
  }, [api, mode]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );

  function startCreate() {
    setMode('create');
    setForm({ user_id: '', bio_en: '', status: 'active' });
    setSelectedId(null);
  }

  function startEdit(row: TutorRow) {
    setMode('edit');
    setSelectedId(row.id);
    setEditStatus(row.status);
    setEditBio(row.bio_en ?? '');
  }

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateFormFields(e.currentTarget)) return;
    if (!form.user_id) {
      setError('Select a user for the tutor profile.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await api.post<{ data: TutorRow }>(`${SCHOOL_OPS_API}/tutors`, {
        user_id: form.user_id,
        bio_en: form.bio_en.trim() || undefined,
        status: form.status,
      });
      setMode('view');
      setSelectedId(res.data.id);
      await load();
      await feedback.success({ title: 'Tutor created', message: 'Tutor profile is active.' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create tutor');
    } finally {
      setSaving(false);
    }
  }

  async function onUpdate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedId) return;

    setSaving(true);
    setError(null);
    try {
      await api.request(`${SCHOOL_OPS_API}/tutors/${selectedId}`, {
        method: 'PUT',
        body: JSON.stringify({ bio_en: editBio.trim() || null, status: editStatus }),
      });
      setMode('view');
      await load();
      await feedback.success({ title: 'Tutor updated', message: 'Profile saved.' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update tutor');
    } finally {
      setSaving(false);
    }
  }

  if (loading && rows.length === 0) {
    return (
      <div className={`${P}page`}>
        <p className={`${P}muted`}>Loading tutors…</p>
        <style>{schoolOpsPageStyles(P)}</style>
      </div>
    );
  }

  return (
    <div className={`${P}page`}>
      <section className={`${P}hero stem-animate-rise`}>
        <div className={`${P}hero-copy`}>
          <p className={`${P}eyebrow`}>Control · Teacher management</p>
          <p className={`${P}hero-lead`}>
            Tutor profiles for one-to-one sessions — link existing staff or teachers as tutors.
          </p>
        </div>
        <div className={`${P}hero-actions`}>
          <div className={`${P}action-row`}>
            <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button type="button" variant="primary" onClick={startCreate} size="sm">
              + Add tutor
            </Button>
          </div>
          <div className={`${P}action-row`}>
            <Link to="/teachers" className={`${P}ghost-link`}>
              Teachers
            </Link>
            <Link to="/teachers/assignments" className={`${P}ghost-link`}>
              Assignments
            </Link>
          </div>
        </div>
      </section>

      {error ? (
        <div className={`${P}alert`} role="alert">
          <span>{error}</span>
          <Button size="sm" type="button" variant="secondary" onClick={() => setError(null)}>Dismiss</Button>
        </div>
      ) : null}

      <StatStrip
        items={[
          { label: 'Tutors', value: String(stats?.total ?? rows.length) },
          { label: 'Active', value: String(stats?.active ?? '—') },
          { label: 'Subjects', value: String(subjects.length), hint: 'Available' },
        ]}
      />

      <div className={`${P}layout`}>
        <Panel title="Tutor directory" description="Select a tutor to view or edit their profile.">
          <div className={`${P}table-wrap`}>
            <table className={`${P}table`}>
              <thead>
                <tr>
                  <th>Tutor</th>
                  <th>Subjects</th>
                  <th>Rating</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={4} className={`${P}empty`}>No tutor profiles yet.</td></tr>
                ) : (
                  listPage.pageItems.map((row) => (
                    <tr
                      key={row.id}
                      className={selectedId === row.id && mode !== 'create' ? 'is-selected' : undefined}
                      onClick={() => { setMode('view'); setSelectedId(row.id); }}
                    >
                      <td>
                        <strong>{personName(row.user?.first_name, row.user?.last_name, row.user?.email)}</strong>
                        <div className={`${P}slug`}>{row.user?.email}</div>
                      </td>
                      <td>{row.subjects?.length ?? 0}</td>
                      <td>{row.ratings_avg_rating ? Number(row.ratings_avg_rating).toFixed(1) : '—'}</td>
                      <td><StatusPill prefix={P} status={row.status} /></td>
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

        <aside className={`${P}side`}>
          {mode === 'create' ? (
            <Panel title="Create tutor profile">
              <form onSubmit={onCreate} className={`${P}form`} noValidate>
                <SelectField label="User" required value={String(form.user_id)} onChange={(e) => setForm((f) => ({ ...f, user_id: Number(e.target.value) }))}>
                  <option value="">Select teacher/staff user</option>
                  {teachers.map((t) => (
                    <option key={t.user_id} value={t.user_id}>{personName(t.first_name, t.last_name, t.email)}</option>
                  ))}
                </SelectField>
                <TextField label="Bio (English)" value={form.bio_en} onChange={(e) => setForm((f) => ({ ...f, bio_en: e.target.value }))} />
                <SelectField label="Status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </SelectField>
                <FormActions>
                  <Button size="sm" type="button" variant="secondary" onClick={() => setMode('view')}>Cancel</Button>
                  <Button size="sm" type="submit" variant="primary" disabled={saving}>{saving ? 'Saving…' : 'Create tutor'}</Button>
                </FormActions>
              </form>
            </Panel>
          ) : mode === 'edit' && selected ? (
            <Panel title="Edit tutor profile">
              <form onSubmit={onUpdate} className={`${P}form`} noValidate>
                <TextField label="Bio (English)" value={editBio} onChange={(e) => setEditBio(e.target.value)} />
                <SelectField label="Status" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </SelectField>
                <FormActions>
                  <Button size="sm" type="button" variant="secondary" onClick={() => setMode('view')}>Cancel</Button>
                  <Button size="sm" type="submit" variant="primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
                </FormActions>
              </form>
            </Panel>
          ) : selected ? (
            <div className={`${P}detail`}>
              <div className={`${P}detail-head`}>
                <span className={`${P}detail-mark`} aria-hidden>
                  {initials(selected.user?.first_name, selected.user?.last_name, selected.user?.email)}
                </span>
                <div>
                  <h3>{personName(selected.user?.first_name, selected.user?.last_name, selected.user?.email)}</h3>
                  <p>{selected.user?.email}</p>
                </div>
              </div>
              <dl className={`${P}meta`}>
                <div><dt>Status</dt><dd><StatusPill prefix={P} status={selected.status} /></dd></div>
                <div><dt>Rating</dt><dd>{selected.ratings_avg_rating ? Number(selected.ratings_avg_rating).toFixed(1) : '—'}</dd></div>
                {selected.bio_en ? <div><dt>Bio</dt><dd>{selected.bio_en}</dd></div> : null}
              </dl>
              {(selected.subjects?.length ?? 0) > 0 ? (
                <ul className={`${P}link-list`}>
                  {selected.subjects!.map((s) => (
                    <li key={s.id}><strong>{s.name_en}</strong><span>{s.code}</span></li>
                  ))}
                </ul>
              ) : null}
              <div className={`${P}actions`}>
                <Button size="sm" type="button" variant="secondary" onClick={() => startEdit(selected)}>Edit</Button>
              </div>
              <div className={`${P}links`}>
                <Link to="/teachers">Teachers</Link>
                <Link to="/teachers/assignments">Teaching assignments</Link>
              </div>
            </div>
          ) : (
            <div className={`${P}detail ${P}detail-empty`}>
              <p className={`${P}empty`}>Select a tutor to review.</p>
              <Button size="sm" type="button" variant="primary" onClick={startCreate}>
                + Add tutor
              </Button>
            </div>
          )}
        </aside>
      </div>
      <style>{schoolOpsPageStyles(P)}</style>
    </div>
  );
}
