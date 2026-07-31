import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
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

type OutcomeRow = {
  id: number;
  code: string;
  statement_en: string;
  statement_ar: string;
  status: string;
  curriculum_id: number;
  subject_id: number | null;
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
  usage: { lessons: number; questions: number };
  lessons?: {
    id: number;
    code: string | null;
    title_en: string;
    sequence: number;
    status: string;
  }[];
};

type OutcomeStats = {
  total: number;
  active: number;
  archived: number;
  with_lessons: number;
  schools: number;
};

type OutcomeForm = {
  school_id: number | '';
  curriculum_id: string;
  subject_id: string;
  code: string;
  statement_en: string;
  statement_ar: string;
  status: 'active' | 'archived';
};

const emptyForm = (): OutcomeForm => ({
  school_id: '',
  curriculum_id: '',
  subject_id: '',
  code: '',
  statement_en: '',
  statement_ar: '',
  status: 'active',
});

function outcomeStatusLabel(status: string) {
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Curriculum learning outcomes mapped to subjects, lessons, and assessments.
 */
export function LearningOutcomesPage() {
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
      title="Learning Outcomes"
      subtitle="Manage measurable learning outcomes across curricula and subjects"
    >
      <LearningOutcomesWorkspace />
    </ControlLayout>
  );
}

function LearningOutcomesWorkspace() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [rows, setRows] = useState<OutcomeRow[]>([]);
  const [stats, setStats] = useState<OutcomeStats | null>(null);
  const [tenants, setTenants] = useState<TenantSchoolOption[]>([]);
  const [curricula, setCurricula] = useState<CurriculumOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<OutcomeRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [curriculumFilter, setCurriculumFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view');
  const [form, setForm] = useState<OutcomeForm>(emptyForm);
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

  const subjectsForFilter = useMemo(() => {
    return subjects.filter((s) => {
      if (schoolFilter && String(s.school_id) !== schoolFilter) return false;
      if (
        curriculumFilter &&
        s.curriculum_id !== null &&
        String(s.curriculum_id) !== curriculumFilter
      ) {
        return false;
      }
      return true;
    });
  }, [subjects, schoolFilter, curriculumFilter]);

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
      if (subjectFilter) params.set('subject_id', subjectFilter);
      const qs = params.toString();
      const res = await api.get<{
        data: OutcomeRow[];
        meta: {
          stats: OutcomeStats;
          tenants: TenantSchoolOption[];
          curricula: CurriculumOption[];
          subjects: SubjectOption[];
        };
      }>(`/control/learning-outcomes${qs ? `?${qs}` : ''}`);
      setRows(res.data);
      setStats(res.meta.stats);
      setTenants(res.meta.tenants);
      setCurricula(res.meta.curricula);
      setSubjects(res.meta.subjects);
      setSelectedId((current) => {
        if (mode === 'create') return current;
        if (current && res.data.some((r) => r.id === current)) return current;
        return res.data[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load learning outcomes');
    } finally {
      setLoading(false);
    }
  }, [
    api,
    search,
    statusFilter,
    tenantFilter,
    schoolFilter,
    curriculumFilter,
    subjectFilter,
    mode,
  ]);

  useEffect(() => {
    void load();
  }, [api, statusFilter, tenantFilter, schoolFilter, curriculumFilter, subjectFilter]);

  useEffect(() => {
    if (!selectedId || mode === 'create') {
      if (mode !== 'create') setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void (async () => {
      try {
        const res = await api.get<{ data: OutcomeRow }>(
          `/control/learning-outcomes/${selectedId}`,
        );
        if (!cancelled) setDetail(res.data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load outcome details');
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
      subject_id: subjectFilter || '',
    });
    setSelectedId(null);
    setDetail(null);
  }

  function startEdit(row: OutcomeRow) {
    setMode('edit');
    setSelectedId(row.id);
    setForm({
      school_id: row.school_id,
      curriculum_id: String(row.curriculum_id),
      subject_id: row.subject_id != null ? String(row.subject_id) : '',
      code: row.code,
      statement_en: row.statement_en,
      statement_ar: row.statement_ar ?? '',
      status: row.status === 'archived' ? 'archived' : 'active',
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
    if (!form.school_id || !form.curriculum_id) {
      setError('Select school and curriculum.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        school_id: Number(form.school_id),
        curriculum_id: Number(form.curriculum_id),
        subject_id: form.subject_id ? Number(form.subject_id) : null,
        code: form.code.trim(),
        statement_en: form.statement_en.trim(),
        statement_ar: form.statement_ar.trim() || form.statement_en.trim(),
        status: form.status,
      };

      if (mode === 'create') {
        const res = await api.post<{ data: OutcomeRow }>('/control/learning-outcomes', payload);
        setMode('view');
        setSelectedId(res.data.id);
        await load();
        await feedback.success({
          title: 'Learning outcome created',
          message: `${res.data.code} is ready to link to lessons.`,
        });
      } else if (selectedId) {
        const res = await api.request<{ data: OutcomeRow }>(
          `/control/learning-outcomes/${selectedId}`,
          {
            method: 'PUT',
            body: JSON.stringify(payload),
          },
        );
        setMode('view');
        await load();
        await feedback.success({
          title: 'Learning outcome updated',
          message: `${res.data.code} has been saved.`,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save learning outcome');
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(row: OutcomeRow, status: 'active' | 'archived') {
    try {
      await api.request(`/control/learning-outcomes/${row.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      await feedback.success({
        title: 'Outcome status updated',
        message: `${row.code} is now ${outcomeStatusLabel(status)}.`,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update status');
    }
  }

  async function deleteOutcome(row: OutcomeRow) {
    try {
      await api.request(`/control/learning-outcomes/${row.id}`, { method: 'DELETE' });
      await feedback.success({
        title: 'Learning outcome deleted',
        message: `${row.code} was removed.`,
      });
      setSelectedId(null);
      setDetail(null);
      setMode('view');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete learning outcome');
    }
  }

  const canDelete =
    !!activeDetail &&
    activeDetail.usage.lessons === 0 &&
    activeDetail.usage.questions === 0;

  if (loading && rows.length === 0 && !stats) {
    return <p className="lo-muted">Loading learning outcomes…</p>;
  }

  if (error && !stats && rows.length === 0) {
    return (
      <Panel title="Unable to load learning outcomes">
        <p style={{ color: 'var(--stem-danger)', marginTop: 0 }}>{error}</p>
        <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
          Retry
        </Button>
      </Panel>
    );
  }

  return (
    <div className="lo-page">
      <section className="lo-hero stem-animate-rise">
        <div>
          <p className="lo-eyebrow">Control · Curriculum management</p>
          <h2 className="lo-hero-title">Learning Outcomes</h2>
          <p className="lo-hero-lead">
            Define bilingual, curriculum-scoped outcomes that lessons and assessments can map to.
          </p>
        </div>
        <div className="lo-hero-actions">
          <div className="lo-action-row">
            <Button
              size="sm"
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => void load()}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Link to="/curriculum/subjects" className="lo-ghost-link">
              Subjects
            </Link>
            <Link to="/curriculum/lessons" className="lo-ghost-link">
              Lessons
            </Link>
            <Button type="button" variant="apricot" onClick={startCreate} size="sm">
              + New outcome
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="lo-alert" role="alert">
          <span>{error}</span>
          <Button size="sm" type="button" variant="secondary" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <StatStrip
        items={[
          { label: 'Outcomes', value: String(stats?.total ?? '—') },
          { label: 'Active', value: String(stats?.active ?? '—') },
          { label: 'Archived', value: String(stats?.archived ?? '—') },
          {
            label: 'With lessons',
            value: String(stats?.with_lessons ?? '—'),
            hint: 'Already mapped',
          },
        ]}
      />

      <div className="lo-layout">
        <Panel
          title="Outcome directory"
          description="Filter by organisation, school, curriculum, subject, or status."
          action={
            <Toolbar as="form" onSubmit={onSearch}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search code or statement"
                aria-label="Search learning outcomes"
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
                  setSubjectFilter('');
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
                onChange={(e) => {
                  setCurriculumFilter(e.target.value);
                  setSubjectFilter('');
                }}
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
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                aria-label="Filter by subject"
              >
                <option value="">All subjects</option>
                {subjectsForFilter.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.name_en}
                    {!s.curriculum_id ? ' · standalone' : ''}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
              <Button type="submit" variant="secondary" size="sm">
                Apply
              </Button>
            </Toolbar>
          }
        >
          <div className="lo-table-wrap">
            <table className="lo-table">
              <thead>
                <tr>
                  <th>Outcome</th>
                  <th>Subject</th>
                  <th>Curriculum</th>
                  <th>Links</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="lo-empty">
                      No learning outcomes match this filter. Create one to map lessons.
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
                        <strong>{row.code}</strong>
                        <div className="lo-slug">{row.statement_en}</div>
                      </td>
                      <td>{row.subject?.code ?? '—'}</td>
                      <td>
                        {row.curriculum
                          ? `${row.curriculum.code} v${row.curriculum.version}`
                          : '—'}
                      </td>
                      <td>
                        {row.usage.lessons} L · {row.usage.questions} Q
                      </td>
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

        <aside className="lo-side">
          {showingForm ? (
            <Panel
              title={mode === 'create' ? 'Create outcome' : 'Edit outcome'}
              description={
                mode === 'create'
                  ? 'Add a measurable outcome for a curriculum and optional subject.'
                  : 'Update code, statements, subject link, or lifecycle status.'
              }
            >
              <form className="lo-form" onSubmit={onSave}>
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
                  value={form.subject_id}
                  onChange={(e) => setForm((f) => ({ ...f, subject_id: e.target.value }))}
                >
                  <option value="">No subject (curriculum-wide)</option>
                  {subjectsForForm.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} · {s.name_en}
                      {!s.curriculum_id ? ' · standalone' : ''}
                    </option>
                  ))}
                </SelectField>

                <TextField
                  label="Code"
                  required
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="e.g. LO-MATH-02"
                />

                <label className="lo-textarea">
                  <span>English statement</span>
                  <textarea
                    required
                    value={form.statement_en}
                    onChange={(e) => setForm((f) => ({ ...f, statement_en: e.target.value }))}
                    rows={3}
                  />
                </label>

                <label className="lo-textarea">
                  <span>Arabic statement</span>
                  <textarea
                    value={form.statement_ar}
                    onChange={(e) => setForm((f) => ({ ...f, statement_ar: e.target.value }))}
                    rows={3}
                    placeholder="Optional — defaults to English"
                  />
                </label>

                <SelectField
                  label="Status"
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      status: e.target.value as 'active' | 'archived',
                    }))
                  }
                >
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </SelectField>

                <FormActions>
                  <Button size="sm" type="button" variant="secondary" onClick={cancelForm}>
                    Cancel
                  </Button>
                  <Button size="sm" type="submit" variant="primary" disabled={saving}>
                    {saving ? 'Saving…' : mode === 'create' ? 'Create outcome' : 'Save changes'}
                  </Button>
                </FormActions>
              </form>
            </Panel>
          ) : activeDetail ? (
            <div className="lo-detail">
              {detailLoading ? (
                <p className="lo-muted">Loading details…</p>
              ) : (
                <>
                  <div className="lo-detail-head">
                    <div className="lo-detail-mark">{activeDetail.code.slice(0, 6)}</div>
                    <div>
                      <h3>{activeDetail.code}</h3>
                      <p>
                        {activeDetail.subject?.code ?? 'Curriculum-wide'}
                        {activeDetail.curriculum
                          ? ` · ${activeDetail.curriculum.code} v${activeDetail.curriculum.version}`
                          : ''}
                      </p>
                    </div>
                  </div>

                  <p className="lo-statement">{activeDetail.statement_en}</p>
                  {activeDetail.statement_ar &&
                  activeDetail.statement_ar !== activeDetail.statement_en ? (
                    <p className="lo-statement lo-statement--ar" dir="rtl">
                      {activeDetail.statement_ar}
                    </p>
                  ) : null}

                  <dl className="lo-meta">
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
                    <div>
                      <dt>Questions</dt>
                      <dd>{activeDetail.usage.questions}</dd>
                    </div>
                  </dl>

                  {(activeDetail.lessons?.length ?? 0) > 0 ? (
                    <ul className="lo-usage-list">
                      {activeDetail.lessons!.map((lesson) => (
                        <li key={lesson.id}>
                          <strong>{lesson.title_en}</strong>
                          <span>
                            {lesson.code ? `${lesson.code} · ` : ''}seq {lesson.sequence} ·{' '}
                            {outcomeStatusLabel(lesson.status)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="lo-actions">
                    <Button
                      size="sm"
                      type="button"
                      variant="secondary"
                      onClick={() => startEdit(activeDetail)}
                    >
                      Edit
                    </Button>
                    {activeDetail.status !== 'active' ? (
                      <ConfirmButton
                        size="sm"
                        title="Activate outcome?"
                        message={`${activeDetail.code} will be marked active.`}
                        confirmLabel="Activate"
                        tone="primary"
                        variant="primary"
                        onConfirm={() => setStatus(activeDetail, 'active')}
                      >
                        Activate
                      </ConfirmButton>
                    ) : (
                      <ConfirmButton
                        size="sm"
                        title="Archive outcome?"
                        message={`${activeDetail.code} will be archived.`}
                        confirmLabel="Archive"
                        tone="warn"
                        variant="secondary"
                        onConfirm={() => setStatus(activeDetail, 'archived')}
                      >
                        Archive
                      </ConfirmButton>
                    )}
                    {canDelete ? (
                      <ConfirmButton
                        size="sm"
                        title="Delete outcome?"
                        message={`${activeDetail.code} will be soft-deleted.`}
                        confirmLabel="Delete"
                        tone="danger"
                        variant="danger"
                        onConfirm={() => deleteOutcome(activeDetail)}
                      >
                        Delete
                      </ConfirmButton>
                    ) : (
                      <Button
                        size="sm"
                        type="button"
                        variant="danger"
                        disabled
                        title="Linked to lessons or questions — archive instead"
                      >
                        Delete
                      </Button>
                    )}
                  </div>

                  <div className="lo-links">
                    <Link to="/curriculum/subjects">Subjects</Link>
                    <Link to="/curriculum/lessons">Lessons</Link>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="lo-detail lo-detail-empty">
              <p className="lo-empty">Select an outcome to review details and actions.</p>
              <Button size="sm" type="button" variant="apricot" onClick={startCreate}>
                + New outcome
              </Button>
            </div>
          )}
        </aside>
      </div>

      <style>{outcomeStyles}</style>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`lo-pill status-${status}`}>{outcomeStatusLabel(status)}</span>;
}

const outcomeStyles = `
.lo-page { display: grid; gap: 1rem; }
.lo-hero {
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
.lo-eyebrow {
  margin: 0 0 0.3rem; font-size: var(--stem-text-xs); letter-spacing: 0.08em; text-transform: uppercase;
  font-weight: 700; color: var(--stem-teal-deep);
}
.lo-hero-title {
  margin: 0 0 0.35rem; font-family: var(--stem-font-display);
  font-size: clamp(1.35rem, 1.8vw, 1.55rem); letter-spacing: -0.03em;
}
.lo-hero-lead {
  margin: 0; color: var(--stem-ink-soft); line-height: 1.5; max-width: 42rem; font-size: var(--stem-text-base);
}
.lo-hero-actions { display: grid; gap: 0.75rem; justify-items: end; }
.lo-action-row { display: flex; flex-wrap: wrap; gap: 0.45rem; justify-content: flex-end; align-items: center; }
.lo-ghost-link {
  display: inline-flex; align-items: center; min-height: 40px; padding: 0 0.75rem;
  font-size: var(--stem-text-md); font-weight: 600; color: var(--stem-teal-deep); text-decoration: none;
}
.lo-ghost-link:hover { text-decoration: underline; }
.lo-alert {
  display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;
  padding: 0.85rem 1rem; border-radius: 12px; background: #fef3f2; color: var(--stem-danger);
  border: 1px solid #fecdca; font-size: var(--stem-text-base);
}
.lo-layout {
  display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(280px, 0.85fr);
  gap: 1rem; align-items: start;
}
.lo-table-wrap { overflow-x: auto; margin: 0 -0.15rem; }
.lo-table { width: 100%; border-collapse: collapse; font-size: var(--stem-text-base); }
.lo-table th {
  text-align: left; font-size: var(--stem-text-xs); letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--stem-ink-soft); padding: 0.55rem 0.65rem; border-bottom: 1px solid var(--stem-line);
  white-space: nowrap;
}
.lo-table td { padding: 0.7rem 0.65rem; border-bottom: 1px solid var(--stem-line); vertical-align: top; }
.lo-table tbody tr { cursor: pointer; transition: background 0.15s ease; }
.lo-table tbody tr:hover { background: rgba(18, 160, 171, 0.04); }
.lo-table tbody tr.is-selected { background: rgba(12, 124, 128, 0.08); }
.lo-slug {
  margin-top: 0.15rem; font-size: var(--stem-text-sm); color: var(--stem-ink-soft);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.lo-empty { text-align: center; color: var(--stem-ink-soft); padding: 1.5rem 0.75rem !important; }
.lo-side { position: sticky; top: 0.75rem; }
.lo-detail {
  display: grid; gap: 1rem; padding: 1.1rem 1.15rem; border-radius: 16px;
  border: 1px solid var(--stem-line); background: #fff;
}
.lo-detail-empty { min-height: 180px; align-content: center; justify-items: start; gap: 0.85rem; }
.lo-detail-head { display: flex; gap: 0.75rem; align-items: center; }
.lo-detail-mark {
  min-width: 2.75rem; height: 2.5rem; padding: 0 0.55rem; border-radius: 12px;
  display: grid; place-items: center; font-weight: 700; font-size: var(--stem-text-xs); letter-spacing: 0.02em;
  background: #eef8f6; color: #055456; border: 1px solid rgba(12, 124, 128, 0.22);
}
.lo-detail-head h3 { margin: 0; font-size: var(--stem-text-xl); letter-spacing: -0.02em; }
.lo-detail-head p { margin: 0.15rem 0 0; font-size: var(--stem-text-md); color: var(--stem-ink-soft); }
.lo-statement {
  margin: 0; padding: 0.75rem 0 0; border-top: 1px solid var(--stem-line);
  font-size: var(--stem-text-base); line-height: 1.45; color: var(--stem-ink);
}
.lo-statement--ar { border-top: none; padding-top: 0.35rem; color: var(--stem-ink-soft); }
.lo-meta { display: grid; gap: 0.55rem; margin: 0; }
.lo-meta > div {
  display: grid; grid-template-columns: 7.5rem minmax(0, 1fr); gap: 0.5rem; align-items: baseline;
}
.lo-meta dt {
  margin: 0; font-size: var(--stem-text-xs); text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--stem-ink-soft);
}
.lo-meta dd { margin: 0; font-size: var(--stem-text-base); }
.lo-usage-list {
  list-style: none; margin: 0; padding: 0.75rem 0 0; border-top: 1px solid var(--stem-line);
  display: grid; gap: 0.45rem;
}
.lo-usage-list li { display: grid; gap: 0.1rem; font-size: var(--stem-text-md); }
.lo-usage-list span { color: var(--stem-ink-soft); font-size: var(--stem-text-sm); }
.lo-actions {
  display: flex; flex-wrap: wrap; gap: 0.5rem; padding-top: 0.35rem;
  border-top: 1px solid var(--stem-line);
}
.lo-links { display: flex; flex-wrap: wrap; gap: 0.75rem 1rem; padding-top: 0.25rem; }
.lo-links a {
  font-size: var(--stem-text-md); font-weight: 600; color: var(--stem-teal-deep); text-decoration: none;
}
.lo-links a:hover { text-decoration: underline; }
.lo-form { display: grid; gap: 0.85rem; }
.lo-textarea { display: grid; gap: 0.35rem; font-size: var(--stem-text-md); font-weight: 600; }
.lo-textarea span { color: var(--stem-ink); }
.lo-textarea textarea {
  width: 100%; border: 1px solid var(--stem-line); border-radius: 10px;
  padding: 0.55rem 0.7rem; font: inherit; font-weight: 400; resize: vertical;
  background: #fff; color: var(--stem-ink);
}
.lo-pill {
  display: inline-flex; align-items: center; padding: 0.2rem 0.55rem; border-radius: 999px;
  font-size: var(--stem-text-xs); font-weight: 700; letter-spacing: 0.02em; background: #f3f4f6; color: #374151;
}
.lo-pill.status-active { background: #ecfdf5; color: #047857; }
.lo-pill.status-archived { background: #eef2ff; color: #4338ca; }
.lo-muted { color: var(--stem-ink-soft); font-size: var(--stem-text-base); margin: 0; }
@media (max-width: 960px) {
  .lo-hero, .lo-layout { grid-template-columns: 1fr; }
  .lo-hero-actions { justify-items: start; }
  .lo-action-row { justify-content: flex-start; }
  .lo-side { position: static; }
}
`;
