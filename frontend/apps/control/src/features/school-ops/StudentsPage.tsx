import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import {
  Button,
  PaginationBar,
  useClientPagination,
  ConfirmButton,
  FormActions,
  Panel,
  SelectField,
  StatStrip,
  TextField,
  Toolbar,
  useFeedback,
  validateFormFields,
} from '@stemora/ui';
import { ControlLayout } from '../../layout/ControlLayout';
import { schoolOpsPageStyles } from './schoolOpsStyles';
import {
  SCHOOL_OPS_API,
  SchoolOpsGuard,
  StatusPill,
  formatWhen,
  initials,
  personName,
  useEnrollmentLookups,
} from './shared';
import type { StudentRow, StudentStats } from './types';

const P = 'stu-';

type StudentForm = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  academic_year_id: number | '';
  grade_id: number | '';
  class_section_id: number | '';
  status: string;
  enrolled_on: string;
};

const emptyForm = (): StudentForm => ({
  email: '',
  password: '',
  first_name: '',
  last_name: '',
  academic_year_id: '',
  grade_id: '',
  class_section_id: '',
  status: 'active',
  enrolled_on: new Date().toISOString().slice(0, 10),
});

/**
 * Directory of enrolled students for the current school.
 */
export function StudentsPage() {
  return (
    <SchoolOpsGuard navPermission="nav.control.student-management">
      <ControlLayout
        title="Students"
        subtitle="Browse and manage enrolled students across your school"
      >
        <StudentsWorkspace />
      </ControlLayout>
    </SchoolOpsGuard>
  );
}

function StudentsWorkspace() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const { grades, sections, years } = useEnrollmentLookups();
  const [rows, setRows] = useState<StudentRow[]>([]);
  const listPage = useClientPagination(rows);

  const [stats, setStats] = useState<StudentStats | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<StudentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view');
  const [form, setForm] = useState<StudentForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: StudentRow[]; meta: { stats: StudentStats } }>(
        `${SCHOOL_OPS_API}/students?status=active`,
      );
      let data = res.data;
      const term = search.trim().toLowerCase();
      if (term) {
        data = data.filter(
          (r) =>
            personName(r.first_name, r.last_name, r.email).toLowerCase().includes(term) ||
            (r.email ?? '').toLowerCase().includes(term),
        );
      }
      setRows(data);
      setStats(res.meta.stats);
      setSelectedId((current) => {
        if (mode === 'create') return current;
        if (current && data.some((r) => r.user_id === current)) return current;
        return data[0]?.user_id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [api, search, mode]);

  useEffect(() => {
    void load();
  }, [api]);

  useEffect(() => {
    if (!selectedId || mode === 'create') {
      if (mode !== 'create') setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void (async () => {
      try {
        const res = await api.get<{ data: StudentRow }>(`${SCHOOL_OPS_API}/students/${selectedId}`);
        if (!cancelled) setDetail(res.data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load student details');
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, selectedId, rows, mode]);

  const selectedSummary = useMemo(
    () => rows.find((r) => r.user_id === selectedId) ?? null,
    [rows, selectedId],
  );
  const activeDetail = detail ?? selectedSummary;
  const showingForm = mode === 'create' || mode === 'edit';

  const filteredSections = useMemo(() => {
    if (!form.grade_id && !form.academic_year_id) return sections;
    return sections.filter(
      (s) =>
        (!form.grade_id || s.grade_id === form.grade_id) &&
        (!form.academic_year_id || s.academic_year_id === form.academic_year_id),
    );
  }, [sections, form.grade_id, form.academic_year_id]);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    await load();
  }

  function startCreate() {
    const currentYear = years.find((y) => y.is_current) ?? years[0];
    setMode('create');
    setForm({ ...emptyForm(), academic_year_id: currentYear?.id ?? '' });
    setSelectedId(null);
    setDetail(null);
  }

  function startEdit(row: StudentRow) {
    setMode('edit');
    setSelectedId(row.user_id);
    setForm({
      email: row.email ?? '',
      password: '',
      first_name: row.first_name ?? '',
      last_name: row.last_name ?? '',
      academic_year_id: row.academic_year?.id ?? '',
      grade_id: row.grade?.id ?? '',
      class_section_id: row.class_section?.id ?? '',
      status: row.status,
      enrolled_on: row.enrolled_on ?? new Date().toISOString().slice(0, 10),
    });
  }

  function cancelForm() {
    setMode('view');
    setForm(emptyForm());
    if (!selectedId && rows[0]) setSelectedId(rows[0].user_id);
  }

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateFormFields(e.currentTarget)) return;
    if (!form.academic_year_id || !form.grade_id || !form.class_section_id) {
      setError('Select academic year, grade, and section.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (mode === 'create') {
        const res = await api.post<{ data: StudentRow }>(`${SCHOOL_OPS_API}/students`, {
          email: form.email.trim(),
          password: form.password,
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          academic_year_id: form.academic_year_id,
          grade_id: form.grade_id,
          class_section_id: form.class_section_id,
          status: form.status,
          enrolled_on: form.enrolled_on,
        });
        setMode('view');
        setSelectedId(res.data.user_id);
        await load();
        await feedback.success({
          title: 'Student enrolled',
          message: `${personName(res.data.first_name, res.data.last_name, res.data.email)} is now enrolled.`,
        });
      } else if (selectedId) {
        await api.request(`${SCHOOL_OPS_API}/students/${selectedId}`, {
          method: 'PUT',
          body: JSON.stringify({
            first_name: form.first_name.trim(),
            last_name: form.last_name.trim(),
            enrollment: {
              academic_year_id: form.academic_year_id,
              grade_id: form.grade_id,
              class_section_id: form.class_section_id,
              status: form.status,
              enrolled_on: form.enrolled_on,
            },
          }),
        });
        setMode('view');
        await load();
        await feedback.success({ title: 'Student updated', message: 'Enrollment details saved.' });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save student');
    } finally {
      setSaving(false);
    }
  }

  if (loading && rows.length === 0 && !stats) {
    return (
      <div className={`${P}page`}>
        <p className={`${P}muted`}>Loading students…</p>
        <style>{schoolOpsPageStyles(P)}</style>
      </div>
    );
  }

  return (
    <div className={`${P}page`}>
      <section className={`${P}hero stem-animate-rise`}>
        <div className={`${P}hero-copy`}>
          <p className={`${P}eyebrow`}>Control · Student management</p>
          <p className={`${P}hero-lead`}>
            Active enrollments for your school — search the directory, enroll new students, or
            update placement.
          </p>
        </div>
        <div className={`${P}hero-actions`}>
          <div className={`${P}action-row`}>
            <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button type="button" variant="primary" onClick={startCreate} size="sm">
              + Enroll student
            </Button>
          </div>
          <div className={`${P}action-row`}>
            <Link to="/students/admissions" className={`${P}ghost-link`}>
              Admissions
            </Link>
            <Link to="/students/transfers" className={`${P}ghost-link`}>
              Transfers
            </Link>
            <Link to="/students/alumni" className={`${P}ghost-link`}>
              Alumni
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
          { label: 'Active', value: String(stats?.active ?? '—') },
          { label: 'Enrollments', value: String(stats?.total_enrollments ?? '—') },
          { label: 'Pending', value: String(stats?.pending ?? '—'), hint: 'Admissions queue' },
          { label: 'Alumni', value: String(stats?.alumni ?? '—') },
        ]}
      />

      <div className={`${P}layout`}>
        <Panel
          title="Student directory"
          description="Select a row to view enrollment details or edit placement."
          action={
            <Toolbar as="form" onSubmit={onSearch}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or email"
                aria-label="Search students"
              />
              <Button type="submit" variant="secondary" size="sm">Apply</Button>
            </Toolbar>
          }
        >
          <div className={`${P}table-wrap`}>
            <table className={`${P}table`}>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Grade</th>
                  <th>Section</th>
                  <th>Year</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={5} className={`${P}empty`}>No active students found.</td></tr>
                ) : (
                  listPage.pageItems.map((row) => (
                    <tr
                      key={row.user_id}
                      className={selectedId === row.user_id && mode !== 'create' ? 'is-selected' : undefined}
                      onClick={() => { setMode('view'); setSelectedId(row.user_id); }}
                    >
                      <td>
                        <strong>{personName(row.first_name, row.last_name, row.email)}</strong>
                        <div className={`${P}slug`}>{row.email}</div>
                      </td>
                      <td>{row.grade?.name_en ?? '—'}</td>
                      <td>{row.class_section?.name ?? '—'}</td>
                      <td>{row.academic_year?.name ?? '—'}</td>
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

        <aside className={`${P}side`} aria-live="polite">
          {showingForm ? (
            <Panel title={mode === 'create' ? 'Enroll student' : 'Edit student'}>
              <form onSubmit={onSave} className={`${P}form`} noValidate>
                {mode === 'create' ? (
                  <>
                    <TextField label="Email" required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                    <TextField
                      label="Password"
                      required
                      type="password"
                      minLength={8}
                      autoComplete="new-password"
                      hint="At least 8 characters. The student can change this after first login."
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    />
                    <TextField label="First name" required value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} />
                    <TextField label="Last name" value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} />
                  </>
                ) : (
                  <>
                    <TextField label="First name" required value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} />
                    <TextField label="Last name" value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} />
                  </>
                )}
                <SelectField label="Academic year" required value={String(form.academic_year_id)} onChange={(e) => setForm((f) => ({ ...f, academic_year_id: Number(e.target.value) }))}>
                  <option value="">Select year</option>
                  {years.map((y) => <option key={y.id} value={y.id}>{y.name}{y.is_current ? ' (current)' : ''}</option>)}
                </SelectField>
                <SelectField label="Grade" required value={String(form.grade_id)} onChange={(e) => setForm((f) => ({ ...f, grade_id: Number(e.target.value) }))}>
                  <option value="">Select grade</option>
                  {grades.map((g) => <option key={g.id} value={g.id}>{g.name_en}</option>)}
                </SelectField>
                <SelectField label="Section" required value={String(form.class_section_id)} onChange={(e) => setForm((f) => ({ ...f, class_section_id: Number(e.target.value) }))}>
                  <option value="">Select section</option>
                  {filteredSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </SelectField>
                <TextField label="Enrolled on" type="date" value={form.enrolled_on} onChange={(e) => setForm((f) => ({ ...f, enrolled_on: e.target.value }))} />
                <FormActions>
                  <Button size="sm" type="button" variant="secondary" onClick={cancelForm}>Cancel</Button>
                  <Button size="sm" type="submit" variant="primary" disabled={saving}>
                    {saving ? 'Saving…' : mode === 'create' ? 'Enroll' : 'Save changes'}
                  </Button>
                </FormActions>
              </form>
            </Panel>
          ) : activeDetail ? (
            <div className={`${P}detail`}>
              <div className={`${P}detail-head`}>
                <span className={`${P}detail-mark`} aria-hidden>
                  {initials(activeDetail.first_name, activeDetail.last_name, activeDetail.email)}
                </span>
                <div>
                  <h3>{personName(activeDetail.first_name, activeDetail.last_name, activeDetail.email)}</h3>
                  <p>{activeDetail.email}</p>
                </div>
              </div>
              {detailLoading && !detail ? (
                <p className={`${P}muted`}>Loading details…</p>
              ) : (
                <>
                  <dl className={`${P}meta`}>
                    <div><dt>Status</dt><dd><StatusPill prefix={P} status={activeDetail.status} /></dd></div>
                    <div><dt>Grade</dt><dd>{activeDetail.grade?.name_en ?? '—'}</dd></div>
                    <div><dt>Section</dt><dd>{activeDetail.class_section?.name ?? '—'}</dd></div>
                    <div><dt>Year</dt><dd>{activeDetail.academic_year?.name ?? '—'}</dd></div>
                    <div><dt>Enrolled</dt><dd>{formatWhen(activeDetail.enrolled_on)}</dd></div>
                    {activeDetail.phone ? <div><dt>Phone</dt><dd>{activeDetail.phone}</dd></div> : null}
                  </dl>
                  <div className={`${P}actions`}>
                    <Button size="sm" type="button" variant="secondary" onClick={() => startEdit(activeDetail)}>Edit</Button>
                  </div>
                  <div className={`${P}links`}>
                    <Link to="/students/admissions">Admissions</Link>
                    <Link to="/students/transfers">Transfers</Link>
                    <Link to="/parents">Parents</Link>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className={`${P}detail ${P}detail-empty`}>
              <p className={`${P}empty`}>Select a student to review enrollment.</p>
              <Button size="sm" type="button" variant="primary" onClick={startCreate}>
                + Enroll student
              </Button>
            </div>
          )}
        </aside>
      </div>
      <style>{schoolOpsPageStyles(P)}</style>
    </div>
  );
}
