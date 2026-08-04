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
import { statusLabel } from '../../types';
import { SchoolOpsCurriculumGate } from './schoolOpsAccess';
import { schoolOpsPageStyles } from './schoolOpsStyles';
import {
  CURRICULUM_LINKS,
  SCHOOL_OPS_API,
  type AcademicYearOption,
  type CampusOption,
  type GradeOption,
  type SchoolClassRow,
  type SchoolClassStats,
} from './types';

type ClassForm = {
  academic_year_id: number | '';
  grade_id: number | '';
  campus_id: number | '';
  code: string;
  name_en: string;
  name_ar: string;
  status: 'active' | 'inactive';
};

const P = 'scl-';
const styles = schoolOpsPageStyles(P);

const emptyForm = (): ClassForm => ({
  academic_year_id: '',
  grade_id: '',
  campus_id: '',
  code: '',
  name_en: '',
  name_ar: '',
  status: 'active',
});

/** School classes tied to academic years and grades. */
export function SchoolClassesPage() {
  return (
    <SchoolOpsCurriculumGate>
      <ControlLayout
        title="Classes"
        subtitle="Organise homeroom classes by academic year, grade, and campus"
      >
        <ClassesWorkspace />
      </ControlLayout>
    </SchoolOpsCurriculumGate>
  );
}

function ClassesWorkspace() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [rows, setRows] = useState<SchoolClassRow[]>([]);
  const listPage = useClientPagination(rows);

  const [stats, setStats] = useState<SchoolClassStats | null>(null);
  const [years, setYears] = useState<AcademicYearOption[]>([]);
  const [grades, setGrades] = useState<GradeOption[]>([]);
  const [campuses, setCampuses] = useState<CampusOption[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [yearFilter, setYearFilter] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view');
  const [form, setForm] = useState<ClassForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadLookups = useCallback(async () => {
    const [yearsRes, gradesRes, campusesRes] = await Promise.all([
      api.get<{ data: AcademicYearOption[] }>(`${SCHOOL_OPS_API}/academic-years`),
      api.get<{ data: GradeOption[] }>(`${SCHOOL_OPS_API}/grades`),
      api.get<{ data: CampusOption[] }>(`${SCHOOL_OPS_API}/campuses`),
    ]);
    setYears(yearsRes.data);
    setGrades(gradesRes.data);
    setCampuses(campusesRes.data);
  }, [api]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (yearFilter) params.set('academic_year_id', yearFilter);
      if (gradeFilter) params.set('grade_id', gradeFilter);
      const qs = params.toString();
      const res = await api.get<{ data: SchoolClassRow[]; meta: { stats: SchoolClassStats } }>(
        `${SCHOOL_OPS_API}/classes${qs ? `?${qs}` : ''}`,
      );
      setRows(res.data);
      setStats(res.meta.stats);
      setSelectedId((current) => {
        if (mode === 'create') return current;
        if (current && res.data.some((r) => r.id === current)) return current;
        return res.data[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load classes');
    } finally {
      setLoading(false);
    }
  }, [api, yearFilter, gradeFilter, mode]);

  useEffect(() => {
    void loadLookups().catch(() => undefined);
  }, [loadLookups]);

  useEffect(() => {
    void load();
  }, [api, yearFilter, gradeFilter]);

  const activeDetail = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );
  const showingForm = mode === 'create' || mode === 'edit';
  const yearName = (id: number) => years.find((y) => y.id === id)?.name ?? `#${id}`;
  const gradeName = (id: number) =>
    grades.find((g) => g.id === id)?.name_en ?? activeDetail?.grade?.name_en ?? `#${id}`;
  const campusName = (id: number | null) =>
    id ? campuses.find((c) => c.id === id)?.name_en ?? `#${id}` : '—';

  function startCreate() {
    const currentYear = years.find((y) => y.is_current) ?? years[0];
    setMode('create');
    setForm({
      ...emptyForm(),
      academic_year_id: currentYear?.id ?? '',
    });
    setSelectedId(null);
  }

  function startEdit(row: SchoolClassRow) {
    setMode('edit');
    setSelectedId(row.id);
    setForm({
      academic_year_id: row.academic_year_id,
      grade_id: row.grade_id,
      campus_id: row.campus_id ?? '',
      code: row.code,
      name_en: row.name_en,
      name_ar: row.name_ar ?? '',
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
      const payload = {
        code: form.code.trim(),
        name_en: form.name_en.trim(),
        name_ar: form.name_ar.trim() || form.name_en.trim(),
        status: form.status,
        campus_id: form.campus_id === '' ? null : Number(form.campus_id),
        ...(mode === 'create'
          ? {
              academic_year_id: Number(form.academic_year_id),
              grade_id: Number(form.grade_id),
            }
          : {}),
      };

      if (mode === 'create') {
        if (form.academic_year_id === '' || form.grade_id === '') {
          setError('Academic year and grade are required.');
          setSaving(false);
          return;
        }
        const res = await api.post<{ data: SchoolClassRow }>(`${SCHOOL_OPS_API}/classes`, payload);
        setMode('view');
        setSelectedId(res.data.id);
        await load();
        await feedback.success({
          title: 'Class created',
          message: `${res.data.name_en} (${res.data.code}) is ready for sections.`,
        });
      } else if (selectedId) {
        const res = await api.request<{ data: SchoolClassRow }>(
          `${SCHOOL_OPS_API}/classes/${selectedId}`,
          { method: 'PUT', body: JSON.stringify(payload) },
        );
        setMode('view');
        await load();
        await feedback.success({
          title: 'Class updated',
          message: `${res.data.name_en} has been saved.`,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save class');
    } finally {
      setSaving(false);
    }
  }

  async function deleteClass(row: SchoolClassRow) {
    try {
      await api.request(`${SCHOOL_OPS_API}/classes/${row.id}`, { method: 'DELETE' });
      await feedback.success({
        title: 'Class deleted',
        message: `${row.name_en} was removed.`,
      });
      setSelectedId(null);
      setMode('view');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete class');
    }
  }

  if (loading && rows.length === 0 && !stats) {
    return <p className={`${P}muted`}>Loading classes…</p>;
  }

  if (error && !stats && rows.length === 0) {
    return (
      <Panel title="Unable to load classes">
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
          <h2 className={`${P}hero-title`}>Classes</h2>
          <p className={`${P}hero-lead`}>
            Create homeroom classes for each grade and academic year — sections are grouped under
            classes.
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
            <Link to="/curriculum/sections" className={`${P}ghost-link`}>
              Sections
            </Link>
            <Button type="button" variant="apricot" onClick={startCreate} size="sm">
              + New class
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
          { label: 'Classes', value: String(stats?.total ?? '—') },
          { label: 'Active', value: String(stats?.active ?? '—') },
        ]}
      />

      <div className={`${P}layout`}>
        <Panel
          title="Class directory"
          description="Filter by year or grade, then select a row to edit."
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
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                aria-label="Filter by grade"
              >
                <option value="">All grades</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name_en}
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
                  <th>Class</th>
                  <th>Grade</th>
                  <th>Year</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={`${P}empty`}>
                      No classes match this filter. Create grades and academic years first.
                    </td>
                  </tr>
                ) : (
                  listPage.pageItems.map((row) => (
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
                        <strong>{row.name_en}</strong>
                        <div className={`${P}slug`}>
                          <code>{row.code}</code>
                          {row.name_ar ? <span> · {row.name_ar}</span> : null}
                        </div>
                      </td>
                      <td>{row.grade?.name_en ?? gradeName(row.grade_id)}</td>
                      <td>{yearName(row.academic_year_id)}</td>
                      <td>
                        <StatusPill status={row.status} />
                      </td>
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
            <Panel
              title={mode === 'create' ? 'Create class' : 'Edit class'}
              description={
                mode === 'create'
                  ? 'Link the class to an academic year and grade.'
                  : 'Update names, campus, or status. Year and grade are fixed after create.'
              }
            >
              <form onSubmit={onSave} className={`${P}form`} noValidate>
                {mode === 'create' ? (
                  <>
                    <SelectField
                      label="Academic year"
                      required
                      value={form.academic_year_id}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          academic_year_id: e.target.value === '' ? '' : Number(e.target.value),
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
                ) : null}
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
                  label="Class code"
                  required
                  value={form.code}
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
                  required
                  value={form.name_ar}
                  onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))}
                />
                <SelectField
                  label="Status"
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value as ClassForm['status'] }))
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
                    {saving ? 'Saving…' : mode === 'create' ? 'Create class' : 'Save changes'}
                  </Button>
                </FormActions>
              </form>
            </Panel>
          ) : activeDetail ? (
            <div className={`${P}detail`}>
              <div className={`${P}detail-head`}>
                <span className={`${P}detail-mark`} aria-hidden>
                  {activeDetail.code}
                </span>
                <div>
                  <h3>{activeDetail.name_en}</h3>
                  <p>
                    <code>{activeDetail.code}</code>
                    {activeDetail.name_ar ? ` · ${activeDetail.name_ar}` : ''}
                  </p>
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
                  title="Delete class?"
                  message={`${activeDetail.name_en} will be removed. Linked sections may be affected.`}
                  confirmLabel="Delete"
                  tone="danger"
                  variant="danger"
                  onConfirm={() => deleteClass(activeDetail)}
                >
                  Delete
                </ConfirmButton>
              </div>

              <CurriculumLinks current="/curriculum/classes" />
            </div>
          ) : (
            <div className={`${P}detail ${P}detail-empty`}>
              <p className={`${P}empty`}>Select a class to review details and actions.</p>
              <Button size="sm" type="button" variant="apricot" onClick={startCreate}>
                + New class
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
