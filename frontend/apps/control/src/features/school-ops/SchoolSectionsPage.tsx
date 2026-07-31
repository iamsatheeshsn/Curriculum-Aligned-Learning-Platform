import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import {
  Button,
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
import { statusLabel } from '../../types';
import { SchoolOpsCurriculumGate } from './schoolOpsAccess';
import { schoolOpsPageStyles } from './schoolOpsStyles';
import {
  CURRICULUM_LINKS,
  SCHOOL_OPS_API,
  type AcademicYearOption,
  type CampusOption,
  type ClassOption,
  type GradeOption,
  type SchoolSectionRow,
  type SchoolSectionStats,
} from './types';

type SectionForm = {
  academic_year_id: number | '';
  grade_id: number | '';
  school_class_id: number | '';
  campus_id: number | '';
  name: string;
  section_code: string;
  status: 'active' | 'inactive';
};

const P = 'ssec-';
const styles = schoolOpsPageStyles(P);

const emptyForm = (): SectionForm => ({
  academic_year_id: '',
  grade_id: '',
  school_class_id: '',
  campus_id: '',
  name: '',
  section_code: '',
  status: 'active',
});

/** Class sections for student enrolment and teaching assignments. */
export function SchoolSectionsPage() {
  return (
    <SchoolOpsCurriculumGate>
      <ControlLayout
        title="Sections"
        subtitle="Manage sections within classes for enrolments and teaching assignments"
      >
        <SectionsWorkspace />
      </ControlLayout>
    </SchoolOpsCurriculumGate>
  );
}

function SectionsWorkspace() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [rows, setRows] = useState<SchoolSectionRow[]>([]);
  const [stats, setStats] = useState<SchoolSectionStats | null>(null);
  const [years, setYears] = useState<AcademicYearOption[]>([]);
  const [grades, setGrades] = useState<GradeOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [campuses, setCampuses] = useState<CampusOption[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [yearFilter, setYearFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view');
  const [form, setForm] = useState<SectionForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadLookups = useCallback(async () => {
    const [yearsRes, gradesRes, classesRes, campusesRes] = await Promise.all([
      api.get<{ data: AcademicYearOption[] }>(`${SCHOOL_OPS_API}/academic-years`),
      api.get<{ data: GradeOption[] }>(`${SCHOOL_OPS_API}/grades`),
      api.get<{ data: ClassOption[] }>(`${SCHOOL_OPS_API}/classes`),
      api.get<{ data: CampusOption[] }>(`${SCHOOL_OPS_API}/campuses`),
    ]);
    setYears(yearsRes.data);
    setGrades(gradesRes.data);
    setClasses(classesRes.data);
    setCampuses(campusesRes.data);
  }, [api]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (yearFilter) params.set('academic_year_id', yearFilter);
      if (classFilter) params.set('school_class_id', classFilter);
      const qs = params.toString();
      const res = await api.get<{ data: SchoolSectionRow[]; meta: { stats: SchoolSectionStats } }>(
        `${SCHOOL_OPS_API}/sections${qs ? `?${qs}` : ''}`,
      );
      setRows(res.data);
      setStats(res.meta.stats);
      setSelectedId((current) => {
        if (mode === 'create') return current;
        if (current && res.data.some((r) => r.id === current)) return current;
        return res.data[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sections');
    } finally {
      setLoading(false);
    }
  }, [api, yearFilter, classFilter, mode]);

  useEffect(() => {
    void loadLookups().catch(() => undefined);
  }, [loadLookups]);

  useEffect(() => {
    void load();
  }, [api, yearFilter, classFilter]);

  const activeDetail = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );
  const showingForm = mode === 'create' || mode === 'edit';
  const yearName = (id: number) => years.find((y) => y.id === id)?.name ?? `#${id}`;
  const gradeName = (id: number) => grades.find((g) => g.id === id)?.name_en ?? `#${id}`;
  const className = (id: number | null) =>
    id ? classes.find((c) => c.id === id)?.name_en ?? `#${id}` : '—';
  const campusName = (id: number | null) =>
    id ? campuses.find((c) => c.id === id)?.name_en ?? `#${id}` : '—';

  const filteredClassesForForm = useMemo(() => {
    return classes.filter((c) => {
      if (form.academic_year_id !== '' && c.academic_year_id !== form.academic_year_id) return false;
      if (form.grade_id !== '' && c.grade_id !== form.grade_id) return false;
      return true;
    });
  }, [classes, form.academic_year_id, form.grade_id]);

  function onClassSelect(classId: number | '') {
    if (classId === '') {
      setForm((f) => ({ ...f, school_class_id: '' }));
      return;
    }
    const cls = classes.find((c) => c.id === classId);
    setForm((f) => ({
      ...f,
      school_class_id: classId,
      academic_year_id: cls?.academic_year_id ?? f.academic_year_id,
      grade_id: cls?.grade_id ?? f.grade_id,
    }));
  }

  function startCreate() {
    const currentYear = years.find((y) => y.is_current) ?? years[0];
    setMode('create');
    setForm({
      ...emptyForm(),
      academic_year_id: currentYear?.id ?? '',
    });
    setSelectedId(null);
  }

  function startEdit(row: SchoolSectionRow) {
    setMode('edit');
    setSelectedId(row.id);
    setForm({
      academic_year_id: row.academic_year_id,
      grade_id: row.grade_id,
      school_class_id: row.school_class_id ?? '',
      campus_id: row.campus_id ?? '',
      name: row.name,
      section_code: row.section_code ?? '',
      status: row.status === 'inactive' ? 'inactive' : 'active',
    });
  }

  function cancelForm() {
    setMode('view');
    setForm(emptyForm());
    if (!selectedId && rows[0]) setSelectedId(rows[0].id);
  }

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateFormFields(e.currentTarget)) return;

    setSaving(true);
    setError(null);
    try {
      if (mode === 'create') {
        if (form.academic_year_id === '' || form.grade_id === '') {
          setError('Academic year and grade are required.');
          setSaving(false);
          return;
        }
        const payload = {
          name: form.name.trim(),
          section_code: form.section_code.trim() || null,
          status: form.status,
          academic_year_id: Number(form.academic_year_id),
          grade_id: Number(form.grade_id),
          school_class_id: form.school_class_id === '' ? null : Number(form.school_class_id),
          campus_id: form.campus_id === '' ? null : Number(form.campus_id),
        };
        const res = await api.post<{ data: SchoolSectionRow }>(
          `${SCHOOL_OPS_API}/sections`,
          payload,
        );
        setMode('view');
        setSelectedId(res.data.id);
        await load();
        await feedback.success({
          title: 'Section created',
          message: `${res.data.name} is ready for enrolments.`,
        });
      } else if (selectedId) {
        const payload = {
          name: form.name.trim(),
          section_code: form.section_code.trim() || null,
          status: form.status,
          school_class_id: form.school_class_id === '' ? null : Number(form.school_class_id),
          campus_id: form.campus_id === '' ? null : Number(form.campus_id),
        };
        const res = await api.request<{ data: SchoolSectionRow }>(
          `${SCHOOL_OPS_API}/sections/${selectedId}`,
          { method: 'PUT', body: JSON.stringify(payload) },
        );
        setMode('view');
        await load();
        await feedback.success({
          title: 'Section updated',
          message: `${res.data.name} has been saved.`,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save section');
    } finally {
      setSaving(false);
    }
  }

  async function deleteSection(row: SchoolSectionRow) {
    try {
      await api.request(`${SCHOOL_OPS_API}/sections/${row.id}`, { method: 'DELETE' });
      await feedback.success({
        title: 'Section deleted',
        message: `${row.name} was removed.`,
      });
      setSelectedId(null);
      setMode('view');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete section');
    }
  }

  if (loading && rows.length === 0 && !stats) {
    return <p className={`${P}muted`}>Loading sections…</p>;
  }

  if (error && !stats && rows.length === 0) {
    return (
      <Panel title="Unable to load sections">
        <p style={{ color: 'var(--stem-danger)', marginTop: 0 }}>{error}</p>
        <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
          Retry
        </Button>
      </Panel>
    );
  }

  return (
    <div className={`${P}page`}>
      <section className={`${P}hero stem-animate-rise`}>
        <div>
          <p className={`${P}eyebrow`}>Control · School curriculum</p>
          <h2 className={`${P}hero-title`}>Sections</h2>
          <p className={`${P}hero-lead`}>
            Sections sit under classes and are where students enrol and teachers receive assignments.
          </p>
        </div>
        <div className={`${P}hero-actions`}>
          <div className={`${P}action-row`}>
            <Button
              size="sm"
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => void load()}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Link to="/school/profile" className={`${P}ghost-link`}>
              School profile
            </Link>
            <Link to="/curriculum/classes" className={`${P}ghost-link`}>
              Classes
            </Link>
            <Button type="button" variant="apricot" onClick={startCreate} size="sm">
              + New section
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <div className={`${P}alert`} role="alert">
          <span>{error}</span>
          <Button size="sm" type="button" variant="secondary" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <StatStrip
        items={[
          { label: 'Sections', value: String(stats?.total ?? '—') },
          { label: 'Active', value: String(stats?.active ?? '—') },
        ]}
      />

      <div className={`${P}layout`}>
        <Panel
          title="Section directory"
          description="Filter by year or class, then select a row to edit."
          action={
            <Toolbar as="form" onSubmit={(e) => e.preventDefault()}>
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                aria-label="Filter by academic year"
              >
                <option value="">All years</option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                    {y.is_current ? ' (current)' : ''}
                  </option>
                ))}
              </select>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                aria-label="Filter by class"
              >
                <option value="">All classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name_en} ({c.code})
                  </option>
                ))}
              </select>
            </Toolbar>
          }
        >
          <div className={`${P}table-wrap`}>
            <table className={`${P}table`}>
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Class</th>
                  <th>Grade</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={`${P}empty`}>
                      No sections match this filter. Create classes first, then add sections.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      className={
                        selectedId === row.id && mode !== 'create' ? 'is-selected' : undefined
                      }
                      onClick={() => {
                        setMode('view');
                        setSelectedId(row.id);
                      }}
                    >
                      <td>
                        <strong>{row.name}</strong>
                        {row.section_code ? (
                          <div className={`${P}slug`}>
                            <code>{row.section_code}</code>
                          </div>
                        ) : null}
                      </td>
                      <td>{className(row.school_class_id)}</td>
                      <td>{gradeName(row.grade_id)}</td>
                      <td>
                        <StatusPill status={row.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <aside className={`${P}side`} aria-live="polite">
          {showingForm ? (
            <Panel
              title={mode === 'create' ? 'Create section' : 'Edit section'}
              description={
                mode === 'create'
                  ? 'Link to a class or set year and grade manually.'
                  : 'Update name, class link, campus, or status.'
              }
            >
              <form onSubmit={onSave} className={`${P}form`} noValidate>
                {mode === 'create' ? (
                  <>
                    <SelectField
                      label="Class (optional)"
                      value={form.school_class_id}
                      onChange={(e) =>
                        onClassSelect(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      hint="Selecting a class fills year and grade automatically"
                    >
                      <option value="">No class — set manually</option>
                      {filteredClassesForForm.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name_en} ({c.code})
                        </option>
                      ))}
                    </SelectField>
                    <SelectField
                      label="Academic year"
                      required
                      value={form.academic_year_id}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          academic_year_id: e.target.value === '' ? '' : Number(e.target.value),
                          school_class_id: '',
                        }))
                      }
                    >
                      <option value="">Select year</option>
                      {years.map((y) => (
                        <option key={y.id} value={y.id}>
                          {y.name}
                          {y.is_current ? ' (current)' : ''}
                        </option>
                      ))}
                    </SelectField>
                    <SelectField
                      label="Grade"
                      required
                      value={form.grade_id}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          grade_id: e.target.value === '' ? '' : Number(e.target.value),
                          school_class_id: '',
                        }))
                      }
                    >
                      <option value="">Select grade</option>
                      {grades.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name_en} ({g.code})
                        </option>
                      ))}
                    </SelectField>
                  </>
                ) : (
                  <SelectField
                    label="Class"
                    value={form.school_class_id}
                    onChange={(e) =>
                      onClassSelect(e.target.value === '' ? '' : Number(e.target.value))
                    }
                  >
                    <option value="">No class</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name_en} ({c.code})
                      </option>
                    ))}
                  </SelectField>
                )}
                <SelectField
                  label="Campus"
                  value={form.campus_id}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      campus_id: e.target.value === '' ? '' : Number(e.target.value),
                    }))
                  }
                >
                  <option value="">No campus</option>
                  {campuses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name_en} ({c.code})
                    </option>
                  ))}
                </SelectField>
                <TextField
                  label="Section name"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Section A"
                />
                <TextField
                  label="Section code"
                  value={form.section_code}
                  onChange={(e) => setForm((f) => ({ ...f, section_code: e.target.value }))}
                  hint="Optional short code"
                />
                <SelectField
                  label="Status"
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value as SectionForm['status'] }))
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </SelectField>
                <FormActions>
                  <Button size="sm" type="button" variant="secondary" onClick={cancelForm}>
                    Cancel
                  </Button>
                  <Button size="sm" type="submit" variant="primary" disabled={saving}>
                    {saving ? 'Saving…' : mode === 'create' ? 'Create section' : 'Save changes'}
                  </Button>
                </FormActions>
              </form>
            </Panel>
          ) : activeDetail ? (
            <div className={`${P}detail`}>
              <div className={`${P}detail-head`}>
                <span className={`${P}detail-mark`} aria-hidden>
                  {activeDetail.section_code?.slice(0, 3) ?? activeDetail.name.slice(0, 2)}
                </span>
                <div>
                  <h3>{activeDetail.name}</h3>
                  <p>{activeDetail.section_code ? <code>{activeDetail.section_code}</code> : 'No code'}</p>
                </div>
              </div>

              <dl className={`${P}meta`}>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <StatusPill status={activeDetail.status} />
                  </dd>
                </div>
                <div>
                  <dt>Class</dt>
                  <dd>{className(activeDetail.school_class_id)}</dd>
                </div>
                <div>
                  <dt>Grade</dt>
                  <dd>{gradeName(activeDetail.grade_id)}</dd>
                </div>
                <div>
                  <dt>Academic year</dt>
                  <dd>{yearName(activeDetail.academic_year_id)}</dd>
                </div>
                <div>
                  <dt>Campus</dt>
                  <dd>{campusName(activeDetail.campus_id)}</dd>
                </div>
              </dl>

              <div className={`${P}actions`}>
                <Button size="sm" type="button" variant="secondary" onClick={() => startEdit(activeDetail)}>
                  Edit
                </Button>
                <ConfirmButton
                  size="sm"
                  title="Delete section?"
                  message={`${activeDetail.name} will be removed. Enrolments linked to this section may be affected.`}
                  confirmLabel="Delete"
                  tone="danger"
                  variant="danger"
                  onConfirm={() => deleteSection(activeDetail)}
                >
                  Delete
                </ConfirmButton>
              </div>

              <CurriculumLinks current="/curriculum/sections" />
            </div>
          ) : (
            <div className={`${P}detail ${P}detail-empty`}>
              <p className={`${P}empty`}>Select a section to review details and actions.</p>
              <Button size="sm" type="button" variant="apricot" onClick={startCreate}>
                + New section
              </Button>
            </div>
          )}
        </aside>
      </div>

      <style>{styles}</style>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`${P}pill status-${status}`}>{statusLabel(status)}</span>;
}

function CurriculumLinks({ current }: { current: string }) {
  return (
    <div className={`${P}links`}>
      {CURRICULUM_LINKS.filter((l) => l.path !== current).map((l) => (
        <Link key={l.path} to={l.path}>
          {l.label}
        </Link>
      ))}
    </div>
  );
}
