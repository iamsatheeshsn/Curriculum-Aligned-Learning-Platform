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
  useFeedback,
  validateFormFields,
} from '@stemora/ui';
import { ControlLayout } from '../../layout/ControlLayout';
import { schoolOpsPageStyles } from './schoolOpsStyles';
import {
  SCHOOL_OPS_API,
  SchoolOpsGuard,
  StatusPill,
  personName,
  useEnrollmentLookups,
} from './shared';
import type { StaffRow, TeachingAssignmentRow, TeachingAssignmentStats } from './types';

const P = 'tas-';

type AssignmentForm = {
  teacher_user_id: number | '';
  subject_id: number | '';
  class_section_id: number | '';
  academic_year_id: number | '';
  status: string;
  notes: string;
};

const emptyForm = (): AssignmentForm => ({
  teacher_user_id: '',
  subject_id: '',
  class_section_id: '',
  academic_year_id: '',
  status: 'active',
  notes: '',
});

/**
 * Teacher-to-subject-to-section teaching assignments.
 */
export function TeachingAssignmentsPage() {
  return (
    <SchoolOpsGuard navPermission="nav.control.teacher-management">
      <ControlLayout
        title="Teaching Assignments"
        subtitle="Assign teachers to subjects and class sections"
      >
        <TeachingAssignmentsWorkspace />
      </ControlLayout>
    </SchoolOpsGuard>
  );
}

function TeachingAssignmentsWorkspace() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const { sections, years, subjects } = useEnrollmentLookups();
  const [rows, setRows] = useState<TeachingAssignmentRow[]>([]);
  const listPage = useClientPagination(rows);

  const [stats, setStats] = useState<TeachingAssignmentStats | null>(null);
  const [teachers, setTeachers] = useState<StaffRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view');
  const [form, setForm] = useState<AssignmentForm>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [assignments, staff] = await Promise.all([
        api.get<{ data: TeachingAssignmentRow[]; meta: { stats: TeachingAssignmentStats } }>(
          `${SCHOOL_OPS_API}/teaching-assignments`,
        ),
        api.get<{ data: StaffRow[] }>(`${SCHOOL_OPS_API}/teachers`),
      ]);
      setRows(assignments.data);
      setStats(assignments.meta.stats);
      setTeachers(staff.data);
      setSelectedId((current) => {
        if (mode === 'create') return current;
        if (current && assignments.data.some((r) => r.id === current)) return current;
        return assignments.data[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assignments');
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
    const currentYear = years.find((y) => y.is_current) ?? years[0];
    setMode('create');
    setForm({ ...emptyForm(), academic_year_id: currentYear?.id ?? '' });
    setSelectedId(null);
  }

  function startEdit(row: TeachingAssignmentRow) {
    setMode('edit');
    setSelectedId(row.id);
    setForm({
      teacher_user_id: row.teacher_user_id,
      subject_id: row.subject_id,
      class_section_id: row.class_section_id,
      academic_year_id: row.academic_year_id,
      status: row.status,
      notes: row.notes ?? '',
    });
  }

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateFormFields(e.currentTarget)) return;
    if (!form.teacher_user_id || !form.subject_id || !form.class_section_id || !form.academic_year_id) {
      setError('Complete all required fields.');
      return;
    }

    setSaving(true);
    setError(null);
    const payload = {
      teacher_user_id: form.teacher_user_id,
      subject_id: form.subject_id,
      class_section_id: form.class_section_id,
      academic_year_id: form.academic_year_id,
      status: form.status,
      notes: form.notes.trim() || null,
    };

    try {
      if (mode === 'create') {
        const res = await api.post<{ data: TeachingAssignmentRow }>(
          `${SCHOOL_OPS_API}/teaching-assignments`,
          payload,
        );
        setMode('view');
        setSelectedId(res.data.id);
        await feedback.success({ title: 'Assignment created', message: 'Teacher linked to section and subject.' });
      } else if (selectedId) {
        await api.request(`${SCHOOL_OPS_API}/teaching-assignments/${selectedId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setMode('view');
        await feedback.success({ title: 'Assignment updated', message: 'Changes saved.' });
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save assignment');
    } finally {
      setSaving(false);
    }
  }

  async function deleteAssignment(row: TeachingAssignmentRow) {
    try {
      await api.request(`${SCHOOL_OPS_API}/teaching-assignments/${row.id}`, { method: 'DELETE' });
      setSelectedId(null);
      await load();
      await feedback.success({ title: 'Assignment removed', message: 'Teaching assignment deleted.' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete assignment');
    }
  }

  if (loading && rows.length === 0) {
    return (
      <div className={`${P}page`}>
        <p className={`${P}muted`}>Loading assignments…</p>
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
            Map teachers to subjects and class sections for the active academic year.
          </p>
        </div>
        <div className={`${P}hero-actions`}>
          <div className={`${P}action-row`}>
            <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button type="button" variant="primary" onClick={startCreate} size="sm">
              + New assignment
            </Button>
          </div>
          <div className={`${P}action-row`}>
            <Link to="/teachers" className={`${P}ghost-link`}>
              Teachers
            </Link>
            <Link to="/teachers/tutors" className={`${P}ghost-link`}>
              Tutors
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
          { label: 'Assignments', value: String(stats?.total ?? rows.length) },
          { label: 'Active', value: String(stats?.active ?? '—') },
          { label: 'Teachers', value: String(teachers.length) },
        ]}
      />

      <div className={`${P}layout`}>
        <Panel title="Assignment list" description="Select a row to view, edit, or remove.">
          <div className={`${P}table-wrap`}>
            <table className={`${P}table`}>
              <thead>
                <tr>
                  <th>Teacher</th>
                  <th>Subject</th>
                  <th>Section</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={4} className={`${P}empty`}>No teaching assignments yet.</td></tr>
                ) : (
                  listPage.pageItems.map((row) => (
                    <tr
                      key={row.id}
                      className={selectedId === row.id && mode === 'view' ? 'is-selected' : undefined}
                      onClick={() => { setMode('view'); setSelectedId(row.id); }}
                    >
                      <td>
                        <strong>{personName(row.teacher?.first_name, row.teacher?.last_name, row.teacher?.email)}</strong>
                        <div className={`${P}slug`}>{row.teacher?.email}</div>
                      </td>
                      <td>{row.subject?.name_en ?? '—'}</td>
                      <td>{row.class_section?.name ?? '—'}</td>
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
          {mode === 'create' || mode === 'edit' ? (
            <Panel title={mode === 'create' ? 'Create assignment' : 'Edit assignment'}>
              <form onSubmit={onSave} className={`${P}form`} noValidate>
                <SelectField label="Teacher" required value={String(form.teacher_user_id)} onChange={(e) => setForm((f) => ({ ...f, teacher_user_id: Number(e.target.value) }))}>
                  <option value="">Select teacher</option>
                  {teachers.map((t) => (
                    <option key={t.user_id} value={t.user_id}>{personName(t.first_name, t.last_name, t.email)}</option>
                  ))}
                </SelectField>
                <SelectField label="Subject" required value={String(form.subject_id)} onChange={(e) => setForm((f) => ({ ...f, subject_id: Number(e.target.value) }))}>
                  <option value="">Select subject</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name_en}</option>)}
                </SelectField>
                <SelectField label="Section" required value={String(form.class_section_id)} onChange={(e) => setForm((f) => ({ ...f, class_section_id: Number(e.target.value) }))}>
                  <option value="">Select section</option>
                  {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </SelectField>
                <SelectField label="Academic year" required value={String(form.academic_year_id)} onChange={(e) => setForm((f) => ({ ...f, academic_year_id: Number(e.target.value) }))}>
                  <option value="">Select year</option>
                  {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
                </SelectField>
                <SelectField label="Status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </SelectField>
                <TextField label="Notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
                <FormActions>
                  <Button size="sm" type="button" variant="secondary" onClick={() => setMode('view')}>Cancel</Button>
                  <Button size="sm" type="submit" variant="primary" disabled={saving}>
                    {saving ? 'Saving…' : mode === 'create' ? 'Create' : 'Save changes'}
                  </Button>
                </FormActions>
              </form>
            </Panel>
          ) : selected ? (
            <div className={`${P}detail`}>
              <div className={`${P}detail-head`}>
                <span className={`${P}detail-mark`} aria-hidden>#{selected.id}</span>
                <div>
                  <h3>{personName(selected.teacher?.first_name, selected.teacher?.last_name, selected.teacher?.email)}</h3>
                  <p>{selected.subject?.name_en} · {selected.class_section?.name}</p>
                </div>
              </div>
              <dl className={`${P}meta`}>
                <div><dt>Status</dt><dd><StatusPill prefix={P} status={selected.status} /></dd></div>
                <div><dt>Subject</dt><dd>{selected.subject?.code ?? '—'} — {selected.subject?.name_en ?? '—'}</dd></div>
                <div><dt>Section</dt><dd>{selected.class_section?.name ?? '—'}</dd></div>
                {selected.notes ? <div><dt>Notes</dt><dd>{selected.notes}</dd></div> : null}
              </dl>
              <div className={`${P}actions`}>
                <Button size="sm" type="button" variant="secondary" onClick={() => startEdit(selected)}>Edit</Button>
                <ConfirmButton
                  size="sm"
                  title="Delete assignment?"
                  message="This teacher will no longer be assigned to this subject and section."
                  confirmLabel="Delete"
                  tone="danger"
                  variant="danger"
                  onConfirm={() => deleteAssignment(selected)}
                >
                  Delete
                </ConfirmButton>
              </div>
              <div className={`${P}links`}>
                <Link to="/teachers">Teachers</Link>
                <Link to="/teachers/tutors">Tutors</Link>
                <Link to="/curriculum/subjects">Subjects</Link>
              </div>
            </div>
          ) : (
            <div className={`${P}detail ${P}detail-empty`}>
              <p className={`${P}empty`}>Select an assignment to review.</p>
              <Button size="sm" type="button" variant="primary" onClick={startCreate}>
                + New assignment
              </Button>
            </div>
          )}
        </aside>
      </div>
      <style>{schoolOpsPageStyles(P)}</style>
    </div>
  );
}
