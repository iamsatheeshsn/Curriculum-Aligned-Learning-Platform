import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
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

const P = 'trf-';

type TransferForm = {
  student_user_id: number | '';
  academic_year_id: number | '';
  grade_id: number | '';
  class_section_id: number | '';
};

/**
 * Students marked for transfer with ability to record new transfers.
 */
export function TransfersPage() {
  return (
    <SchoolOpsGuard navPermission="nav.control.student-management">
      <ControlLayout
        title="Transfers"
        subtitle="Track students in transfer status and record section moves"
      >
        <TransfersWorkspace />
      </ControlLayout>
    </SchoolOpsGuard>
  );
}

function TransfersWorkspace() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const { grades, sections, years } = useEnrollmentLookups();
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [activeStudents, setActiveStudents] = useState<StudentRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'create'>('view');
  const [form, setForm] = useState<TransferForm>({
    student_user_id: '',
    academic_year_id: '',
    grade_id: '',
    class_section_id: '',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [transfers, students] = await Promise.all([
        api.get<{ data: StudentRow[]; meta: { stats: StudentStats } }>(`${SCHOOL_OPS_API}/transfers`),
        api.get<{ data: StudentRow[] }>(`${SCHOOL_OPS_API}/students?status=active`),
      ]);
      setRows(transfers.data);
      setStats(transfers.meta.stats);
      setActiveStudents(students.data);
      setSelectedId((current) => {
        if (current && transfers.data.some((r) => r.user_id === current)) return current;
        return transfers.data[0]?.user_id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transfers');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => rows.find((r) => r.user_id === selectedId) ?? null,
    [rows, selectedId],
  );

  const filteredSections = useMemo(() => {
    if (!form.grade_id && !form.academic_year_id) return sections;
    return sections.filter(
      (s) =>
        (!form.grade_id || s.grade_id === form.grade_id) &&
        (!form.academic_year_id || s.academic_year_id === form.academic_year_id),
    );
  }, [sections, form.grade_id, form.academic_year_id]);

  function startCreate() {
    const currentYear = years.find((y) => y.is_current) ?? years[0];
    setMode('create');
    setForm({
      student_user_id: '',
      academic_year_id: currentYear?.id ?? '',
      grade_id: '',
      class_section_id: '',
    });
    setSelectedId(null);
  }

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateFormFields(e.currentTarget)) return;
    if (!form.student_user_id) {
      setError('Select a student to transfer.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.post(`${SCHOOL_OPS_API}/transfers`, {
        student_user_id: form.student_user_id,
        academic_year_id: form.academic_year_id || undefined,
        grade_id: form.grade_id || undefined,
        class_section_id: form.class_section_id || undefined,
      });
      setMode('view');
      await load();
      await feedback.success({ title: 'Transfer recorded', message: 'Student enrollment marked for transfer.' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record transfer');
    } finally {
      setSaving(false);
    }
  }

  if (loading && rows.length === 0) {
    return <p className={`${P}muted`}>Loading transfers…</p>;
  }

  return (
    <div className={`${P}page`}>
      <section className={`${P}hero stem-animate-rise`}>
        <div>
          <p className={`${P}eyebrow`}>Control · Student management</p>
          <h2 className={`${P}hero-title`}>Transfers</h2>
          <p className={`${P}hero-lead`}>
            Students moving between sections or leaving the school — record transfers from active
            enrollments.
          </p>
        </div>
        <div className={`${P}hero-actions`}>
          <div className={`${P}action-row`}>
            <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Link to="/students" className={`${P}ghost-link`}>Students</Link>
            <Link to="/students/admissions" className={`${P}ghost-link`}>Admissions</Link>
            <Link to="/students/alumni" className={`${P}ghost-link`}>Alumni</Link>
            <Button type="button" variant="apricot" onClick={startCreate} size="sm">+ Record transfer</Button>
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
          { label: 'In transfer', value: String(rows.length) },
          { label: 'Active', value: String(stats?.active ?? '—') },
          { label: 'Pending', value: String(stats?.pending ?? '—') },
          { label: 'Alumni', value: String(stats?.alumni ?? '—') },
        ]}
      />

      <div className={`${P}layout`}>
        <Panel title="Transfer queue" description="Students with transfer status.">
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
                  <tr><td colSpan={5} className={`${P}empty`}>No students in transfer status.</td></tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.user_id}
                      className={selectedId === row.user_id && mode === 'view' ? 'is-selected' : undefined}
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
        </Panel>

        <aside className={`${P}side`}>
          {mode === 'create' ? (
            <Panel title="Record transfer" description="Mark an active student for transfer.">
              <form onSubmit={onSave} className={`${P}form`} noValidate>
                <SelectField
                  label="Student"
                  required
                  value={String(form.student_user_id)}
                  onChange={(e) => setForm((f) => ({ ...f, student_user_id: Number(e.target.value) }))}
                >
                  <option value="">Select active student</option>
                  {activeStudents.map((s) => (
                    <option key={s.user_id} value={s.user_id}>
                      {personName(s.first_name, s.last_name, s.email)}
                    </option>
                  ))}
                </SelectField>
                <SelectField label="Academic year" value={String(form.academic_year_id)} onChange={(e) => setForm((f) => ({ ...f, academic_year_id: Number(e.target.value) }))}>
                  <option value="">Keep current</option>
                  {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
                </SelectField>
                <SelectField label="Grade" value={String(form.grade_id)} onChange={(e) => setForm((f) => ({ ...f, grade_id: Number(e.target.value) }))}>
                  <option value="">Keep current</option>
                  {grades.map((g) => <option key={g.id} value={g.id}>{g.name_en}</option>)}
                </SelectField>
                <SelectField label="Section" value={String(form.class_section_id)} onChange={(e) => setForm((f) => ({ ...f, class_section_id: Number(e.target.value) }))}>
                  <option value="">Keep current</option>
                  {filteredSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </SelectField>
                <FormActions>
                  <Button size="sm" type="button" variant="secondary" onClick={() => setMode('view')}>Cancel</Button>
                  <Button size="sm" type="submit" variant="primary" disabled={saving}>
                    {saving ? 'Saving…' : 'Record transfer'}
                  </Button>
                </FormActions>
              </form>
            </Panel>
          ) : selected ? (
            <div className={`${P}detail`}>
              <div className={`${P}detail-head`}>
                <span className={`${P}detail-mark`} aria-hidden>
                  {initials(selected.first_name, selected.last_name, selected.email)}
                </span>
                <div>
                  <h3>{personName(selected.first_name, selected.last_name, selected.email)}</h3>
                  <p>{selected.email}</p>
                </div>
              </div>
              <dl className={`${P}meta`}>
                <div><dt>Status</dt><dd><StatusPill prefix={P} status={selected.status} /></dd></div>
                <div><dt>Grade</dt><dd>{selected.grade?.name_en ?? '—'}</dd></div>
                <div><dt>Section</dt><dd>{selected.class_section?.name ?? '—'}</dd></div>
                <div><dt>Year</dt><dd>{selected.academic_year?.name ?? '—'}</dd></div>
                <div><dt>Enrolled</dt><dd>{formatWhen(selected.enrolled_on)}</dd></div>
              </dl>
              <div className={`${P}links`}>
                <Link to="/students">Active students</Link>
                <Link to="/students/alumni">Alumni</Link>
              </div>
            </div>
          ) : (
            <div className={`${P}detail ${P}detail-empty`}>
              <p className={`${P}empty`}>Select a transfer or record a new one.</p>
              <Button size="sm" type="button" variant="apricot" onClick={startCreate}>+ Record transfer</Button>
            </div>
          )}
        </aside>
      </div>
      <style>{schoolOpsPageStyles(P)}</style>
    </div>
  );
}
