import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
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

type TenantSchoolOption = {
  id: number;
  name: string;
  slug: string;
  status: string;
  schools: { id: number; code: string; name_en: string; status: string }[];
};

type CurriculumOption = {
  id: number;
  school_id: number | null;
  code: string;
  name_en: string;
  version: string;
  status: string;
  is_latest?: boolean;
};

type SubjectOption = {
  id: number;
  school_id: number;
  curriculum_id: number | null;
  code: string;
  name_en: string;
  status: string;
};

type GradeOption = {
  id: number;
  school_id: number;
  code: string;
  name_en: string;
  sequence: number;
};

type ChapterRow = {
  id: number;
  title_en: string;
  title_ar: string;
  sequence: number;
  status: string;
  curriculum_id: number;
  subject_id: number;
  grade_id: number;
  tenant_id: number;
  school_id: number;
  tenant: { id: number; name: string; slug: string; status: string } | null;
  school: { id: number; code: string; name_en: string; status: string } | null;
  curriculum: {
    id: number;
    code: string;
    name_en: string;
    version: string;
    status: string;
  } | null;
  subject: {
    id: number;
    code: string;
    name_en: string;
    curriculum_id: number | null;
  } | null;
  grade: {
    id: number;
    code: string;
    name_en: string;
    sequence: number;
  } | null;
  usage: { lessons: number };
  lessons?: {
    id: number;
    code: string | null;
    title_en: string;
    sequence: number;
    status: string;
    estimated_minutes?: number | null;
  }[];
};

type ChapterStats = {
  total: number;
  draft: number;
  published: number;
  archived: number;
  with_lessons: number;
  schools: number;
};

type ChapterForm = {
  school_id: number | '';
  curriculum_id: string;
  subject_id: string;
  grade_id: string;
  title_en: string;
  title_ar: string;
  sequence: string;
  status: 'draft' | 'published' | 'archived';
};

const emptyForm = (): ChapterForm => ({
  school_id: '',
  curriculum_id: '',
  subject_id: '',
  grade_id: '',
  title_en: '',
  title_ar: '',
  sequence: '1',
  status: 'draft',
});

function chapterStatusLabel(status: string) {
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Curriculum chapters linking subjects and grades for classroom sequencing.
 */
export function ChaptersPage() {
  const { isSuperAdmin, hasPermission } = useAuth();
  if (
    !isSuperAdmin &&
    !hasPermission([
      'platform.tenants.manage',
      'curriculum.manage',
      'nav.control.curriculum-management',
    ])
  ) {
    return <Navigate to="/" replace />;
  }

  return (
    <ControlLayout
      title="Chapters"
      subtitle="Manage curriculum chapters across schools, subjects, and grades"
    >
      <ChaptersWorkspace />
    </ControlLayout>
  );
}

function ChaptersWorkspace() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [rows, setRows] = useState<ChapterRow[]>([]);
  const listPage = useClientPagination(rows);

  const [stats, setStats] = useState<ChapterStats | null>(null);
  const [tenants, setTenants] = useState<TenantSchoolOption[]>([]);
  const [curricula, setCurricula] = useState<CurriculumOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [grades, setGrades] = useState<GradeOption[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ChapterRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [curriculumFilter, setCurriculumFilter] = useState('');
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view');
  const [form, setForm] = useState<ChapterForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const schoolOptions = useMemo(
    () =>
      tenants.flatMap((t) =>
        t.schools.map((s) => ({
          id: s.id,
          label: `${t.name} · ${s.name_en}`,
          tenantId: t.id,
        })),
      ),
    [tenants],
  );

  const schoolsForFilter = useMemo(() => {
    if (!tenantFilter) return schoolOptions;
    return schoolOptions.filter((s) => String(s.tenantId) === tenantFilter);
  }, [schoolOptions, tenantFilter]);

  const curriculaForForm = useMemo(() => {
    if (!form.school_id) return curricula;
    return curricula.filter(
      (c) => c.school_id === null || c.school_id === Number(form.school_id),
    );
  }, [curricula, form.school_id]);

  const subjectsForForm = useMemo(() => {
    if (!form.school_id) return subjects;
    return subjects.filter((s) => {
      if (s.school_id !== Number(form.school_id)) return false;
      if (!form.curriculum_id) return true;
      return (
        s.curriculum_id === null || s.curriculum_id === Number(form.curriculum_id)
      );
    });
  }, [subjects, form.school_id, form.curriculum_id]);

  const gradesForForm = useMemo(() => {
    if (!form.school_id) return grades;
    return grades.filter((g) => g.school_id === Number(form.school_id));
  }, [grades, form.school_id]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (tenantFilter) params.set('tenant_id', tenantFilter);
      if (schoolFilter) params.set('school_id', schoolFilter);
      if (curriculumFilter) params.set('curriculum_id', curriculumFilter);
      const qs = params.toString();
      const res = await api.get<{
        data: ChapterRow[];
        meta: {
          stats: ChapterStats;
          tenants: TenantSchoolOption[];
          curricula: CurriculumOption[];
          subjects: SubjectOption[];
          grades: GradeOption[];
        };
      }>(`/control/chapters${qs ? `?${qs}` : ''}`);
      setRows(res.data);
      setStats(res.meta.stats);
      setTenants(res.meta.tenants);
      setCurricula(res.meta.curricula);
      setSubjects(res.meta.subjects);
      setGrades(res.meta.grades);
      setSelectedId((current) => {
        if (mode === 'create') return current;
        if (current && res.data.some((r) => r.id === current)) return current;
        return res.data[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chapters');
    } finally {
      setLoading(false);
    }
  }, [api, search, statusFilter, tenantFilter, schoolFilter, curriculumFilter, mode]);

  useEffect(() => {
    void load();
  }, [api, statusFilter, tenantFilter, schoolFilter, curriculumFilter]);

  useEffect(() => {
    if (!selectedId || mode === 'create') {
      if (mode !== 'create') setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void (async () => {
      try {
        const res = await api.get<{ data: ChapterRow }>(`/control/chapters/${selectedId}`);
        if (!cancelled) setDetail(res.data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load chapter details');
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
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );
  const activeDetail = detail ?? selectedSummary;
  const showingForm = mode === 'create' || mode === 'edit';

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    await load();
  }

  function startCreate() {
    const schoolId = schoolFilter
      ? Number(schoolFilter)
      : (schoolOptions[0]?.id ?? '');
    setMode('create');
    setForm({
      ...emptyForm(),
      school_id: schoolId,
      curriculum_id: curriculumFilter || '',
      sequence: String((stats?.total ?? 0) + 1),
    });
    setSelectedId(null);
    setDetail(null);
  }

  function startEdit(row: ChapterRow) {
    setMode('edit');
    setSelectedId(row.id);
    setForm({
      school_id: row.school_id,
      curriculum_id: String(row.curriculum_id),
      subject_id: String(row.subject_id),
      grade_id: String(row.grade_id),
      title_en: row.title_en,
      title_ar: row.title_ar ?? '',
      sequence: String(row.sequence),
      status:
        row.status === 'published'
          ? 'published'
          : row.status === 'archived'
            ? 'archived'
            : 'draft',
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
    if (!form.school_id || !form.curriculum_id || !form.subject_id || !form.grade_id) {
      setError('Select school, curriculum, subject, and grade.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        school_id: Number(form.school_id),
        curriculum_id: Number(form.curriculum_id),
        subject_id: Number(form.subject_id),
        grade_id: Number(form.grade_id),
        title_en: form.title_en.trim(),
        title_ar: form.title_ar.trim() || form.title_en.trim(),
        sequence: Number(form.sequence) || 1,
        status: form.status,
      };

      if (mode === 'create') {
        const res = await api.post<{ data: ChapterRow }>('/control/chapters', payload);
        setMode('view');
        setSelectedId(res.data.id);
        await load();
        await feedback.success({
          title: 'Chapter created',
          message: `${res.data.title_en} is ready for lessons.`,
        });
      } else if (selectedId) {
        const res = await api.request<{ data: ChapterRow }>(`/control/chapters/${selectedId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setMode('view');
        await load();
        await feedback.success({
          title: 'Chapter updated',
          message: `${res.data.title_en} has been saved.`,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save chapter');
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(row: ChapterRow, status: 'draft' | 'published' | 'archived') {
    try {
      await api.request(`/control/chapters/${row.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      await feedback.success({
        title: 'Chapter status updated',
        message: `${row.title_en} is now ${chapterStatusLabel(status)}.`,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update status');
    }
  }

  async function deleteChapter(row: ChapterRow) {
    try {
      await api.request(`/control/chapters/${row.id}`, { method: 'DELETE' });
      await feedback.success({
        title: 'Chapter deleted',
        message: `${row.title_en} was removed.`,
      });
      setSelectedId(null);
      setDetail(null);
      setMode('view');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete chapter');
    }
  }

  const canDelete = !!activeDetail && activeDetail.usage.lessons === 0;

  if (loading && rows.length === 0 && !stats) {
    return <p className="ch-muted">Loading chapters…</p>;
  }

  if (error && !stats && rows.length === 0) {
    return (
      <Panel title="Unable to load chapters">
        <p style={{ color: 'var(--stem-danger)', marginTop: 0 }}>{error}</p>
        <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
          Retry
        </Button>
      </Panel>
    );
  }

  return (
    <div className="ch-page">
      <section className="ch-hero stem-animate-rise">
        <div>
          <p className="ch-eyebrow">Control · Curriculum management</p>
          <h2 className="ch-hero-title">Chapters</h2>
          <p className="ch-hero-lead">
            Organise curriculum content into sequenced chapters by subject and grade — ready for
            lessons and outcomes.
          </p>
        </div>
        <div className="ch-hero-actions">
          <div className="ch-action-row">
            <Button
              size="sm"
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => void load()}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Link to="/curriculum/subjects" className="ch-ghost-link">
              Subjects
            </Link>
            <Link to="/curriculum/lessons" className="ch-ghost-link">
              Lessons
            </Link>
            <Button type="button" variant="apricot" onClick={startCreate} size="sm">
              + New chapter
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="ch-alert" role="alert">
          <span>{error}</span>
          <Button size="sm" type="button" variant="secondary" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <StatStrip
        items={[
          { label: 'Chapters', value: String(stats?.total ?? '—') },
          { label: 'Draft', value: String(stats?.draft ?? '—') },
          { label: 'Published', value: String(stats?.published ?? '—') },
          {
            label: 'With lessons',
            value: String(stats?.with_lessons ?? '—'),
            hint: 'Ready for delivery',
          },
        ]}
      />

      <div className="ch-layout">
        <Panel
          title="Chapter directory"
          description="Filter by organisation, school, curriculum, or status."
          action={
            <Toolbar as="form" onSubmit={onSearch}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title, subject, grade"
                aria-label="Search chapters"
              />
              <select
                value={tenantFilter}
                onChange={(e) => {
                  setTenantFilter(e.target.value);
                  setSchoolFilter('');
                }}
                aria-label="Filter by organisation"
              >
                <option value="">All organisations</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <select
                value={schoolFilter}
                onChange={(e) => {
                  setSchoolFilter(e.target.value);
                  setCurriculumFilter('');
                }}
                aria-label="Filter by school"
              >
                <option value="">All schools</option>
                {schoolsForFilter.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <select
                value={curriculumFilter}
                onChange={(e) => setCurriculumFilter(e.target.value)}
                aria-label="Filter by curriculum"
              >
                <option value="">All curricula</option>
                {curricula
                  .filter(
                    (c) =>
                      !schoolFilter ||
                      c.school_id === null ||
                      String(c.school_id) === schoolFilter,
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} v{c.version}
                    </option>
                  ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
              >
                <option value="">All statuses</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
              <Button type="submit" variant="secondary" size="sm">
                Apply
              </Button>
            </Toolbar>
          }
        >
          <div className="ch-table-wrap">
            <table className="ch-table">
              <thead>
                <tr>
                  <th>Chapter</th>
                  <th>Subject</th>
                  <th>Grade</th>
                  <th>Seq</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="ch-empty">
                      No chapters match this filter. Create one to structure a curriculum.
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
                        <strong>{row.title_en}</strong>
                        <div className="ch-slug">
                          {row.curriculum
                            ? `${row.curriculum.code} v${row.curriculum.version}`
                            : '—'}
                          {row.usage.lessons > 0 ? (
                            <span> · {row.usage.lessons} lessons</span>
                          ) : null}
                        </div>
                      </td>
                      <td>{row.subject ? `${row.subject.code}` : '—'}</td>
                      <td>{row.grade ? row.grade.code : '—'}</td>
                      <td>{row.sequence}</td>
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

        <aside className="ch-side" aria-live="polite">
          {showingForm ? (
            <Panel
              title={mode === 'create' ? 'Create chapter' : 'Edit chapter'}
              description={
                mode === 'create'
                  ? 'Add a sequenced chapter for a curriculum subject and grade.'
                  : 'Update titles, sequencing, links, or lifecycle status.'
              }
            >
              <form onSubmit={onSave} className="ch-form" noValidate>
                <SelectField
                  label="School"
                  required
                  value={form.school_id === '' ? '' : String(form.school_id)}
                  disabled={mode === 'edit'}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      school_id: e.target.value ? Number(e.target.value) : '',
                      curriculum_id: '',
                      subject_id: '',
                      grade_id: '',
                    }))
                  }
                >
                  <option value="">Select school</option>
                  {schoolOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="Curriculum"
                  required
                  value={form.curriculum_id}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      curriculum_id: e.target.value,
                      subject_id: '',
                    }))
                  }
                >
                  <option value="">Select curriculum</option>
                  {curriculaForForm.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} v{c.version} · {c.name_en}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="Subject"
                  required
                  value={form.subject_id}
                  onChange={(e) => setForm((f) => ({ ...f, subject_id: e.target.value }))}
                >
                  <option value="">Select subject</option>
                  {subjectsForForm.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} · {s.name_en}
                      {s.curriculum_id === null ? ' · standalone' : ''}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="Grade"
                  required
                  value={form.grade_id}
                  onChange={(e) => setForm((f) => ({ ...f, grade_id: e.target.value }))}
                >
                  <option value="">Select grade</option>
                  {gradesForForm.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.code} · {g.name_en}
                    </option>
                  ))}
                </SelectField>
                <TextField
                  label="English title"
                  required
                  value={form.title_en}
                  onChange={(e) => setForm((f) => ({ ...f, title_en: e.target.value }))}
                />
                <TextField
                  label="Arabic title"
                  value={form.title_ar}
                  onChange={(e) => setForm((f) => ({ ...f, title_ar: e.target.value }))}
                  hint="Optional — defaults to English title"
                />
                <TextField
                  label="Sequence"
                  required
                  type="number"
                  min={1}
                  value={form.sequence}
                  onChange={(e) => setForm((f) => ({ ...f, sequence: e.target.value }))}
                />
                <SelectField
                  label="Status"
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      status: e.target.value as 'draft' | 'published' | 'archived',
                    }))
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </SelectField>
                <FormActions>
                  <Button size="sm" type="button" variant="secondary" onClick={cancelForm}>
                    Cancel
                  </Button>
                  <Button size="sm" type="submit" variant="primary" disabled={saving}>
                    {saving ? 'Saving…' : mode === 'create' ? 'Create chapter' : 'Save changes'}
                  </Button>
                </FormActions>
              </form>
            </Panel>
          ) : activeDetail ? (
            <div className="ch-detail">
              <div className="ch-detail-head">
                <span className="ch-detail-mark" aria-hidden>
                  #{activeDetail.sequence}
                </span>
                <div>
                  <h3>{activeDetail.title_en}</h3>
                  <p>
                    {activeDetail.subject?.code ?? '—'}
                    {activeDetail.title_ar ? ` · ${activeDetail.title_ar}` : ''}
                  </p>
                </div>
              </div>

              {detailLoading && !detail ? (
                <p className="ch-muted">Loading details…</p>
              ) : (
                <>
                  <dl className="ch-meta">
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <StatusPill status={activeDetail.status} />
                      </dd>
                    </div>
                    <div>
                      <dt>Curriculum</dt>
                      <dd>
                        {activeDetail.curriculum
                          ? `${activeDetail.curriculum.code} v${activeDetail.curriculum.version}`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Subject</dt>
                      <dd>
                        {activeDetail.subject
                          ? `${activeDetail.subject.code} · ${activeDetail.subject.name_en}`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Grade</dt>
                      <dd>
                        {activeDetail.grade
                          ? `${activeDetail.grade.code} · ${activeDetail.grade.name_en}`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>School</dt>
                      <dd>
                        {activeDetail.school
                          ? `${activeDetail.school.code} · ${activeDetail.school.name_en}`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Lessons</dt>
                      <dd>{activeDetail.usage.lessons}</dd>
                    </div>
                  </dl>

                  {(activeDetail.lessons?.length ?? 0) > 0 ? (
                    <ul className="ch-usage-list">
                      {activeDetail.lessons!.map((lesson) => (
                        <li key={lesson.id}>
                          <strong>{lesson.title_en}</strong>
                          <span>
                            seq {lesson.sequence} · {chapterStatusLabel(lesson.status)}
                            {lesson.estimated_minutes
                              ? ` · ${lesson.estimated_minutes} min`
                              : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="ch-actions">
                    <Button
                      size="sm"
                      type="button"
                      variant="secondary"
                      onClick={() => startEdit(activeDetail)}
                    >
                      Edit
                    </Button>
                    {activeDetail.status !== 'published' ? (
                      <ConfirmButton
                        size="sm"
                        title="Publish chapter?"
                        message={`${activeDetail.title_en} will be marked published.`}
                        confirmLabel="Publish"
                        tone="primary"
                        variant="primary"
                        onConfirm={() => setStatus(activeDetail, 'published')}
                      >
                        Publish
                      </ConfirmButton>
                    ) : null}
                    {activeDetail.status !== 'archived' ? (
                      <ConfirmButton
                        size="sm"
                        title="Archive chapter?"
                        message={`${activeDetail.title_en} will be archived.`}
                        confirmLabel="Archive"
                        tone="warn"
                        variant="secondary"
                        onConfirm={() => setStatus(activeDetail, 'archived')}
                      >
                        Archive
                      </ConfirmButton>
                    ) : (
                      <ConfirmButton
                        size="sm"
                        title="Return to draft?"
                        message={`${activeDetail.title_en} will return to draft.`}
                        confirmLabel="Draft"
                        tone="primary"
                        variant="secondary"
                        onConfirm={() => setStatus(activeDetail, 'draft')}
                      >
                        To draft
                      </ConfirmButton>
                    )}
                    {canDelete ? (
                      <ConfirmButton
                        size="sm"
                        title="Delete chapter?"
                        message={`${activeDetail.title_en} will be soft-deleted.`}
                        confirmLabel="Delete"
                        tone="danger"
                        variant="danger"
                        onConfirm={() => deleteChapter(activeDetail)}
                      >
                        Delete
                      </ConfirmButton>
                    ) : (
                      <Button
                        size="sm"
                        type="button"
                        variant="danger"
                        disabled
                        title="Has lessons — archive instead"
                      >
                        Delete
                      </Button>
                    )}
                  </div>

                  <div className="ch-links">
                    <Link to="/curriculum/subjects">Subjects</Link>
                    <Link to="/curriculum/lessons">Lessons</Link>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="ch-detail ch-detail-empty">
              <p className="ch-empty">Select a chapter to review details and actions.</p>
              <Button size="sm" type="button" variant="apricot" onClick={startCreate}>
                + New chapter
              </Button>
            </div>
          )}
        </aside>
      </div>

      <style>{chapterStyles}</style>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`ch-pill status-${status}`}>{chapterStatusLabel(status)}</span>;
}

const chapterStyles = `
.ch-page { display: grid; gap: 1rem; }
.ch-hero {
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
.ch-eyebrow {
  margin: 0 0 0.3rem; font-size: var(--stem-text-xs); letter-spacing: 0.08em; text-transform: uppercase;
  font-weight: 700; color: var(--stem-teal-deep);
}
.ch-hero-title {
  margin: 0 0 0.35rem; font-family: var(--stem-font-display);
  font-size: clamp(1.35rem, 1.8vw, 1.55rem); letter-spacing: -0.03em;
}
.ch-hero-lead {
  margin: 0; color: var(--stem-ink-soft); line-height: 1.5; max-width: 42rem; font-size: var(--stem-text-base);
}
.ch-hero-actions { display: grid; gap: 0.75rem; justify-items: end; }
.ch-action-row { display: flex; flex-wrap: wrap; gap: 0.45rem; justify-content: flex-end; align-items: center; }
.ch-ghost-link {
  display: inline-flex; align-items: center; min-height: 40px; padding: 0 0.75rem;
  font-size: var(--stem-text-md); font-weight: 600; color: var(--stem-teal-deep); text-decoration: none;
}
.ch-ghost-link:hover { text-decoration: underline; }
.ch-alert {
  display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;
  padding: 0.85rem 1rem; border-radius: 12px; background: #fef3f2; color: var(--stem-danger);
  border: 1px solid #fecdca; font-size: var(--stem-text-base);
}
.ch-layout {
  display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(280px, 0.85fr);
  gap: 1rem; align-items: start;
}
.ch-table-wrap { overflow-x: auto; margin: 0 -0.15rem; }
.ch-table { width: 100%; border-collapse: collapse; font-size: var(--stem-text-base); }
.ch-table th {
  text-align: left; font-size: var(--stem-text-xs); letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--stem-ink-soft); padding: 0.55rem 0.65rem; border-bottom: 1px solid var(--stem-line);
  white-space: nowrap;
}
.ch-table td { padding: 0.7rem 0.65rem; border-bottom: 1px solid var(--stem-line); vertical-align: top; }
.ch-table tbody tr { cursor: pointer; transition: background 0.15s ease; }
.ch-table tbody tr:hover { background: rgba(18, 160, 171, 0.04); }
.ch-table tbody tr.is-selected { background: rgba(12, 124, 128, 0.08); }
.ch-slug { margin-top: 0.15rem; font-size: var(--stem-text-sm); color: var(--stem-ink-soft); }
.ch-empty { text-align: center; color: var(--stem-ink-soft); padding: 1.5rem 0.75rem !important; }
.ch-side { position: sticky; top: 0.75rem; }
.ch-detail {
  display: grid; gap: 1rem; padding: 1.1rem 1.15rem; border-radius: 16px;
  border: 1px solid var(--stem-line); background: #fff;
}
.ch-detail-empty { min-height: 180px; align-content: center; justify-items: start; gap: 0.85rem; }
.ch-detail-head { display: flex; gap: 0.75rem; align-items: center; }
.ch-detail-mark {
  min-width: 2.75rem; height: 2.5rem; padding: 0 0.55rem; border-radius: 12px;
  display: grid; place-items: center; font-weight: 700; font-size: var(--stem-text-md); letter-spacing: 0.04em;
  background: #eef8f6; color: #055456; border: 1px solid rgba(12, 124, 128, 0.22);
}
.ch-detail-head h3 { margin: 0; font-size: var(--stem-text-xl); letter-spacing: -0.02em; }
.ch-detail-head p { margin: 0.15rem 0 0; font-size: var(--stem-text-md); color: var(--stem-ink-soft); }
.ch-meta { display: grid; gap: 0.55rem; margin: 0; }
.ch-meta > div {
  display: grid; grid-template-columns: 7.5rem minmax(0, 1fr); gap: 0.5rem; align-items: baseline;
}
.ch-meta dt {
  margin: 0; font-size: var(--stem-text-xs); text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--stem-ink-soft);
}
.ch-meta dd { margin: 0; font-size: var(--stem-text-base); }
.ch-usage-list {
  list-style: none; margin: 0; padding: 0.75rem 0 0; border-top: 1px solid var(--stem-line);
  display: grid; gap: 0.45rem;
}
.ch-usage-list li { display: grid; gap: 0.1rem; font-size: var(--stem-text-md); }
.ch-usage-list span { color: var(--stem-ink-soft); font-size: var(--stem-text-sm); }
.ch-actions {
  display: flex; flex-wrap: wrap; gap: 0.5rem; padding-top: 0.35rem;
  border-top: 1px solid var(--stem-line);
}
.ch-links { display: flex; flex-wrap: wrap; gap: 0.75rem 1rem; padding-top: 0.25rem; }
.ch-links a {
  font-size: var(--stem-text-md); font-weight: 600; color: var(--stem-teal-deep); text-decoration: none;
}
.ch-links a:hover { text-decoration: underline; }
.ch-form { display: grid; gap: 0.85rem; }
.ch-pill {
  display: inline-flex; align-items: center; padding: 0.2rem 0.55rem; border-radius: 999px;
  font-size: var(--stem-text-xs); font-weight: 700; letter-spacing: 0.02em; background: #f3f4f6; color: #374151;
}
.ch-pill.status-draft { background: #f3f4f6; color: #4b5563; }
.ch-pill.status-published { background: #ecfdf5; color: #047857; }
.ch-pill.status-archived { background: #eef2ff; color: #4338ca; }
.ch-muted { color: var(--stem-ink-soft); font-size: var(--stem-text-base); margin: 0; }
@media (max-width: 960px) {
  .ch-hero, .ch-layout { grid-template-columns: 1fr; }
  .ch-hero-actions { justify-items: start; }
  .ch-action-row { justify-content: flex-start; }
  .ch-side { position: static; }
}
`;
