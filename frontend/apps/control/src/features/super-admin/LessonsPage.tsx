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

type ChapterOption = {
  id: number;
  school_id: number;
  curriculum_id: number;
  title_en: string;
  sequence: number;
  status: string;
  subject_code?: string | null;
  grade_code?: string | null;
};

type OutcomeOption = {
  id: number;
  school_id: number;
  curriculum_id: number;
  code: string;
  statement_en: string;
  status: string;
};

type LessonRow = {
  id: number;
  code: string | null;
  title_en: string;
  title_ar: string;
  summary_en: string | null;
  summary_ar: string | null;
  sequence: number;
  estimated_minutes: number | null;
  difficulty: string | null;
  status: string;
  curriculum_id: number;
  chapter_id: number;
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
  chapter: {
    id: number;
    title_en: string;
    title_ar: string;
    sequence: number;
    status: string;
    subject: { id: number; code: string; name_en: string } | null;
    grade: { id: number; code: string; name_en: string } | null;
  } | null;
  usage: { interactive_lessons: number; learning_outcomes: number };
  learning_outcomes?: {
    id: number;
    code: string;
    statement_en: string;
    statement_ar: string;
    status: string;
  }[];
  learning_outcome_ids?: number[];
};

type LessonStats = {
  total: number;
  draft: number;
  published: number;
  archived: number;
  with_outcomes: number;
  schools: number;
};

type LessonForm = {
  school_id: number | '';
  curriculum_id: string;
  chapter_id: string;
  code: string;
  title_en: string;
  title_ar: string;
  summary_en: string;
  summary_ar: string;
  sequence: string;
  estimated_minutes: string;
  difficulty: '' | 'easy' | 'medium' | 'hard';
  status: 'draft' | 'published' | 'archived';
  learning_outcome_ids: number[];
};

const emptyForm = (): LessonForm => ({
  school_id: '',
  curriculum_id: '',
  chapter_id: '',
  code: '',
  title_en: '',
  title_ar: '',
  summary_en: '',
  summary_ar: '',
  sequence: '1',
  estimated_minutes: '',
  difficulty: '',
  status: 'draft',
  learning_outcome_ids: [],
});

function lessonStatusLabel(status: string) {
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function difficultyLabel(value: string | null | undefined) {
  if (!value) return '—';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Curriculum lessons sequenced under chapters for classroom delivery.
 */
export function LessonsPage() {
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
      title="Lessons"
      subtitle="Manage sequenced curriculum lessons across chapters and schools"
    >
      <LessonsWorkspace />
    </ControlLayout>
  );
}

function LessonsWorkspace() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [rows, setRows] = useState<LessonRow[]>([]);
  const [stats, setStats] = useState<LessonStats | null>(null);
  const [tenants, setTenants] = useState<TenantSchoolOption[]>([]);
  const [curricula, setCurricula] = useState<CurriculumOption[]>([]);
  const [chapters, setChapters] = useState<ChapterOption[]>([]);
  const [outcomes, setOutcomes] = useState<OutcomeOption[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<LessonRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [curriculumFilter, setCurriculumFilter] = useState('');
  const [chapterFilter, setChapterFilter] = useState('');
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view');
  const [form, setForm] = useState<LessonForm>(emptyForm);
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

  const chaptersForForm = useMemo(() => {
    if (!form.school_id) return chapters;
    return chapters.filter((ch) => {
      if (ch.school_id !== Number(form.school_id)) return false;
      if (!form.curriculum_id) return true;
      return ch.curriculum_id === Number(form.curriculum_id);
    });
  }, [chapters, form.school_id, form.curriculum_id]);

  const outcomesForForm = useMemo(() => {
    if (!form.curriculum_id) return outcomes;
    return outcomes.filter((o) => o.curriculum_id === Number(form.curriculum_id));
  }, [outcomes, form.curriculum_id]);

  const chaptersForFilter = useMemo(() => {
    return chapters.filter((ch) => {
      if (schoolFilter && String(ch.school_id) !== schoolFilter) return false;
      if (curriculumFilter && String(ch.curriculum_id) !== curriculumFilter) return false;
      return true;
    });
  }, [chapters, schoolFilter, curriculumFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (difficultyFilter) params.set('difficulty', difficultyFilter);
      if (tenantFilter) params.set('tenant_id', tenantFilter);
      if (schoolFilter) params.set('school_id', schoolFilter);
      if (curriculumFilter) params.set('curriculum_id', curriculumFilter);
      if (chapterFilter) params.set('chapter_id', chapterFilter);
      const qs = params.toString();
      const res = await api.get<{
        data: LessonRow[];
        meta: {
          stats: LessonStats;
          tenants: TenantSchoolOption[];
          curricula: CurriculumOption[];
          chapters: ChapterOption[];
          learning_outcomes: OutcomeOption[];
        };
      }>(`/control/lessons${qs ? `?${qs}` : ''}`);
      setRows(res.data);
      setStats(res.meta.stats);
      setTenants(res.meta.tenants);
      setCurricula(res.meta.curricula);
      setChapters(res.meta.chapters);
      setOutcomes(res.meta.learning_outcomes);
      setSelectedId((current) => {
        if (mode === 'create') return current;
        if (current && res.data.some((r) => r.id === current)) return current;
        return res.data[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lessons');
    } finally {
      setLoading(false);
    }
  }, [
    api,
    search,
    statusFilter,
    difficultyFilter,
    tenantFilter,
    schoolFilter,
    curriculumFilter,
    chapterFilter,
    mode,
  ]);

  useEffect(() => {
    void load();
  }, [api, statusFilter, difficultyFilter, tenantFilter, schoolFilter, curriculumFilter, chapterFilter]);

  useEffect(() => {
    if (!selectedId || mode === 'create') {
      if (mode !== 'create') setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void (async () => {
      try {
        const res = await api.get<{ data: LessonRow }>(`/control/lessons/${selectedId}`);
        if (!cancelled) setDetail(res.data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load lesson details');
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
      chapter_id: chapterFilter || '',
      sequence: String((stats?.total ?? 0) + 1),
    });
    setSelectedId(null);
    setDetail(null);
  }

  function startEdit(row: LessonRow) {
    const source =
      detail && detail.id === row.id && detail.learning_outcome_ids ? detail : row;
    setMode('edit');
    setSelectedId(row.id);
    setForm({
      school_id: source.school_id,
      curriculum_id: String(source.curriculum_id),
      chapter_id: String(source.chapter_id),
      code: source.code ?? '',
      title_en: source.title_en,
      title_ar: source.title_ar ?? '',
      summary_en: source.summary_en ?? '',
      summary_ar: source.summary_ar ?? '',
      sequence: String(source.sequence),
      estimated_minutes:
        source.estimated_minutes != null ? String(source.estimated_minutes) : '',
      difficulty:
        source.difficulty === 'easy' ||
        source.difficulty === 'medium' ||
        source.difficulty === 'hard'
          ? source.difficulty
          : '',
      status:
        source.status === 'published'
          ? 'published'
          : source.status === 'archived'
            ? 'archived'
            : 'draft',
      learning_outcome_ids: source.learning_outcome_ids ?? [],
    });
  }

  function cancelForm() {
    setMode('view');
    setForm(emptyForm());
    if (!selectedId && rows[0]) setSelectedId(rows[0].id);
  }

  function toggleOutcome(id: number) {
    setForm((f) => ({
      ...f,
      learning_outcome_ids: f.learning_outcome_ids.includes(id)
        ? f.learning_outcome_ids.filter((x) => x !== id)
        : [...f.learning_outcome_ids, id],
    }));
  }

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateFormFields(e.currentTarget)) return;
    if (!form.school_id || !form.curriculum_id || !form.chapter_id) {
      setError('Select school, curriculum, and chapter.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        school_id: Number(form.school_id),
        curriculum_id: Number(form.curriculum_id),
        chapter_id: Number(form.chapter_id),
        code: form.code.trim() || null,
        title_en: form.title_en.trim(),
        title_ar: form.title_ar.trim() || form.title_en.trim(),
        summary_en: form.summary_en.trim() || null,
        summary_ar: form.summary_ar.trim() || null,
        sequence: Number(form.sequence) || 1,
        estimated_minutes: form.estimated_minutes ? Number(form.estimated_minutes) : null,
        difficulty: form.difficulty || null,
        status: form.status,
        learning_outcome_ids: form.learning_outcome_ids,
      };

      if (mode === 'create') {
        const res = await api.post<{ data: LessonRow }>('/control/lessons', payload);
        setMode('view');
        setSelectedId(res.data.id);
        await load();
        await feedback.success({
          title: 'Lesson created',
          message: `${res.data.title_en} is ready for outcomes and delivery.`,
        });
      } else if (selectedId) {
        const res = await api.request<{ data: LessonRow }>(`/control/lessons/${selectedId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setMode('view');
        await load();
        await feedback.success({
          title: 'Lesson updated',
          message: `${res.data.title_en} has been saved.`,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save lesson');
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(row: LessonRow, status: 'draft' | 'published' | 'archived') {
    try {
      await api.request(`/control/lessons/${row.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      await feedback.success({
        title: 'Lesson status updated',
        message: `${row.title_en} is now ${lessonStatusLabel(status)}.`,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update status');
    }
  }

  async function deleteLesson(row: LessonRow) {
    try {
      await api.request(`/control/lessons/${row.id}`, { method: 'DELETE' });
      await feedback.success({
        title: 'Lesson deleted',
        message: `${row.title_en} was removed.`,
      });
      setSelectedId(null);
      setDetail(null);
      setMode('view');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete lesson');
    }
  }

  const canDelete = !!activeDetail && activeDetail.usage.interactive_lessons === 0;

  if (loading && rows.length === 0 && !stats) {
    return <p className="ls-muted">Loading lessons…</p>;
  }

  if (error && !stats && rows.length === 0) {
    return (
      <Panel title="Unable to load lessons">
        <p style={{ color: 'var(--stem-danger)', marginTop: 0 }}>{error}</p>
        <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
          Retry
        </Button>
      </Panel>
    );
  }

  return (
    <div className="ls-page">
      <section className="ls-hero stem-animate-rise">
        <div>
          <p className="ls-eyebrow">Control · Curriculum management</p>
          <h2 className="ls-hero-title">Lessons</h2>
          <p className="ls-hero-lead">
            Sequence teachable units under chapters — titles, timing, difficulty, and linked
            learning outcomes.
          </p>
        </div>
        <div className="ls-hero-actions">
          <div className="ls-action-row">
            <Button
              size="sm"
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => void load()}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Link to="/curriculum/chapters" className="ls-ghost-link">
              Chapters
            </Link>
            <Link to="/curriculum/learning-outcomes" className="ls-ghost-link">
              Outcomes
            </Link>
            <Button type="button" variant="apricot" onClick={startCreate} size="sm">
              + New lesson
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="ls-alert" role="alert">
          <span>{error}</span>
          <Button size="sm" type="button" variant="secondary" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <StatStrip
        items={[
          { label: 'Lessons', value: String(stats?.total ?? '—') },
          { label: 'Draft', value: String(stats?.draft ?? '—') },
          { label: 'Published', value: String(stats?.published ?? '—') },
          {
            label: 'With outcomes',
            value: String(stats?.with_outcomes ?? '—'),
            hint: 'Mapped to LOs',
          },
        ]}
      />

      <div className="ls-layout">
        <Panel
          title="Lesson directory"
          description="Filter by organisation, school, curriculum, chapter, or status."
          action={
            <Toolbar as="form" onSubmit={onSearch}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title, code, chapter"
                aria-label="Search lessons"
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
                  setChapterFilter('');
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
                  setChapterFilter('');
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
                value={chapterFilter}
                onChange={(e) => setChapterFilter(e.target.value)}
                aria-label="Filter by chapter"
              >
                <option value="">All chapters</option>
                {chaptersForFilter.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.title_en}
                    {ch.subject_code ? ` · ${ch.subject_code}` : ''}
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
              <select
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value)}
                aria-label="Filter by difficulty"
              >
                <option value="">All difficulties</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
              <Button type="submit" variant="secondary" size="sm">
                Apply
              </Button>
            </Toolbar>
          }
        >
          <div className="ls-table-wrap">
            <table className="ls-table">
              <thead>
                <tr>
                  <th>Lesson</th>
                  <th>Chapter</th>
                  <th>Mins</th>
                  <th>Seq</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="ls-empty">
                      No lessons match this filter. Create one under a chapter.
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
                        <strong>{row.title_en}</strong>
                        <div className="ls-slug">
                          {row.code ? `${row.code} · ` : ''}
                          {row.curriculum
                            ? `${row.curriculum.code} v${row.curriculum.version}`
                            : '—'}
                          {row.difficulty ? ` · ${difficultyLabel(row.difficulty)}` : ''}
                        </div>
                      </td>
                      <td>{row.chapter?.title_en ?? '—'}</td>
                      <td>{row.estimated_minutes ?? '—'}</td>
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
        </Panel>

        <aside className="ls-side">
          {showingForm ? (
            <Panel
              title={mode === 'create' ? 'Create lesson' : 'Edit lesson'}
              description={
                mode === 'create'
                  ? 'Add a sequenced lesson under a curriculum chapter.'
                  : 'Update content, sequencing, difficulty, or linked outcomes.'
              }
            >
              <form className="ls-form" onSubmit={onSave}>
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
                      chapter_id: '',
                      learning_outcome_ids: [],
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
                      chapter_id: '',
                      learning_outcome_ids: [],
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
                  label="Chapter"
                  required
                  value={form.chapter_id}
                  onChange={(e) => setForm((f) => ({ ...f, chapter_id: e.target.value }))}
                >
                  <option value="">Select chapter</option>
                  {chaptersForForm.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.title_en}
                      {ch.subject_code ? ` · ${ch.subject_code}` : ''}
                      {ch.grade_code ? ` · ${ch.grade_code}` : ''}
                    </option>
                  ))}
                </SelectField>

                <TextField
                  label="Code"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="e.g. L1"
                />

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

                <label className="ls-textarea">
                  <span>English summary</span>
                  <textarea
                    value={form.summary_en}
                    onChange={(e) => setForm((f) => ({ ...f, summary_en: e.target.value }))}
                    rows={2}
                  />
                </label>

                <label className="ls-textarea">
                  <span>Arabic summary</span>
                  <textarea
                    value={form.summary_ar}
                    onChange={(e) => setForm((f) => ({ ...f, summary_ar: e.target.value }))}
                    rows={2}
                  />
                </label>

                <div className="ls-form-row">
                  <TextField
                    label="Sequence"
                    required
                    type="number"
                    min={1}
                    value={form.sequence}
                    onChange={(e) => setForm((f) => ({ ...f, sequence: e.target.value }))}
                  />
                  <TextField
                    label="Minutes"
                    type="number"
                    min={1}
                    value={form.estimated_minutes}
                    onChange={(e) => setForm((f) => ({ ...f, estimated_minutes: e.target.value }))}
                  />
                </div>

                <div className="ls-form-row">
                  <SelectField
                    label="Difficulty"
                    value={form.difficulty}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        difficulty: e.target.value as LessonForm['difficulty'],
                      }))
                    }
                  >
                    <option value="">Not set</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </SelectField>

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
                </div>

                <fieldset className="ls-outcomes">
                  <legend>Learning outcomes</legend>
                  {outcomesForForm.length === 0 ? (
                    <p className="ls-muted">No active outcomes for this curriculum yet.</p>
                  ) : (
                    <ul>
                      {outcomesForForm.map((o) => (
                        <li key={o.id}>
                          <label>
                            <input
                              type="checkbox"
                              checked={form.learning_outcome_ids.includes(o.id)}
                              onChange={() => toggleOutcome(o.id)}
                            />
                            <span>
                              <strong>{o.code}</strong> — {o.statement_en}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </fieldset>

                <FormActions>
                  <Button size="sm" type="button" variant="secondary" onClick={cancelForm}>
                    Cancel
                  </Button>
                  <Button size="sm" type="submit" variant="primary" disabled={saving}>
                    {saving ? 'Saving…' : mode === 'create' ? 'Create lesson' : 'Save changes'}
                  </Button>
                </FormActions>
              </form>
            </Panel>
          ) : activeDetail ? (
            <div className="ls-detail">
              {detailLoading ? (
                <p className="ls-muted">Loading details…</p>
              ) : (
                <>
                  <div className="ls-detail-head">
                    <div className="ls-detail-mark">#{activeDetail.sequence}</div>
                    <div>
                      <h3>{activeDetail.title_en}</h3>
                      <p>
                        {activeDetail.code ? `${activeDetail.code} · ` : ''}
                        {activeDetail.chapter?.subject?.code ?? '—'}
                        {activeDetail.title_ar ? ` · ${activeDetail.title_ar}` : ''}
                      </p>
                    </div>
                  </div>

                  <dl className="ls-meta">
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
                      <dt>Chapter</dt>
                      <dd>{activeDetail.chapter?.title_en ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Subject / grade</dt>
                      <dd>
                        {activeDetail.chapter?.subject?.code ?? '—'}
                        {activeDetail.chapter?.grade
                          ? ` · ${activeDetail.chapter.grade.code}`
                          : ''}
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
                      <dt>Duration</dt>
                      <dd>
                        {activeDetail.estimated_minutes != null
                          ? `${activeDetail.estimated_minutes} min`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Difficulty</dt>
                      <dd>{difficultyLabel(activeDetail.difficulty)}</dd>
                    </div>
                    <div>
                      <dt>Outcomes</dt>
                      <dd>{activeDetail.usage.learning_outcomes}</dd>
                    </div>
                  </dl>

                  {activeDetail.summary_en ? (
                    <p className="ls-summary">{activeDetail.summary_en}</p>
                  ) : null}

                  {(activeDetail.learning_outcomes?.length ?? 0) > 0 ? (
                    <ul className="ls-usage-list">
                      {activeDetail.learning_outcomes!.map((lo) => (
                        <li key={lo.id}>
                          <strong>{lo.code}</strong>
                          <span>{lo.statement_en}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="ls-actions">
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
                        title="Publish lesson?"
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
                        title="Archive lesson?"
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
                        title="Delete lesson?"
                        message={`${activeDetail.title_en} will be soft-deleted.`}
                        confirmLabel="Delete"
                        tone="danger"
                        variant="danger"
                        onConfirm={() => deleteLesson(activeDetail)}
                      >
                        Delete
                      </ConfirmButton>
                    ) : (
                      <Button
                        size="sm"
                        type="button"
                        variant="danger"
                        disabled
                        title="Linked to interactive content — archive instead"
                      >
                        Delete
                      </Button>
                    )}
                  </div>

                  <div className="ls-links">
                    <Link to="/curriculum/chapters">Chapters</Link>
                    <Link to="/curriculum/learning-outcomes">Learning outcomes</Link>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="ls-detail ls-detail-empty">
              <p className="ls-empty">Select a lesson to review details and actions.</p>
              <Button size="sm" type="button" variant="apricot" onClick={startCreate}>
                + New lesson
              </Button>
            </div>
          )}
        </aside>
      </div>

      <style>{lessonStyles}</style>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`ls-pill status-${status}`}>{lessonStatusLabel(status)}</span>;
}

const lessonStyles = `
.ls-page { display: grid; gap: 1rem; }
.ls-hero {
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
.ls-eyebrow {
  margin: 0 0 0.3rem; font-size: var(--stem-text-xs); letter-spacing: 0.08em; text-transform: uppercase;
  font-weight: 700; color: var(--stem-teal-deep);
}
.ls-hero-title {
  margin: 0 0 0.35rem; font-family: var(--stem-font-display);
  font-size: clamp(1.35rem, 1.8vw, 1.55rem); letter-spacing: -0.03em;
}
.ls-hero-lead {
  margin: 0; color: var(--stem-ink-soft); line-height: 1.5; max-width: 42rem; font-size: var(--stem-text-base);
}
.ls-hero-actions { display: grid; gap: 0.75rem; justify-items: end; }
.ls-action-row { display: flex; flex-wrap: wrap; gap: 0.45rem; justify-content: flex-end; align-items: center; }
.ls-ghost-link {
  display: inline-flex; align-items: center; min-height: 40px; padding: 0 0.75rem;
  font-size: var(--stem-text-md); font-weight: 600; color: var(--stem-teal-deep); text-decoration: none;
}
.ls-ghost-link:hover { text-decoration: underline; }
.ls-alert {
  display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;
  padding: 0.85rem 1rem; border-radius: 12px; background: #fef3f2; color: var(--stem-danger);
  border: 1px solid #fecdca; font-size: var(--stem-text-base);
}
.ls-layout {
  display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(280px, 0.85fr);
  gap: 1rem; align-items: start;
}
.ls-table-wrap { overflow-x: auto; margin: 0 -0.15rem; }
.ls-table { width: 100%; border-collapse: collapse; font-size: var(--stem-text-base); }
.ls-table th {
  text-align: left; font-size: var(--stem-text-xs); letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--stem-ink-soft); padding: 0.55rem 0.65rem; border-bottom: 1px solid var(--stem-line);
  white-space: nowrap;
}
.ls-table td { padding: 0.7rem 0.65rem; border-bottom: 1px solid var(--stem-line); vertical-align: top; }
.ls-table tbody tr { cursor: pointer; transition: background 0.15s ease; }
.ls-table tbody tr:hover { background: rgba(18, 160, 171, 0.04); }
.ls-table tbody tr.is-selected { background: rgba(12, 124, 128, 0.08); }
.ls-slug { margin-top: 0.15rem; font-size: var(--stem-text-sm); color: var(--stem-ink-soft); }
.ls-empty { text-align: center; color: var(--stem-ink-soft); padding: 1.5rem 0.75rem !important; }
.ls-side { position: sticky; top: 0.75rem; }
.ls-detail {
  display: grid; gap: 1rem; padding: 1.1rem 1.15rem; border-radius: 16px;
  border: 1px solid var(--stem-line); background: #fff;
}
.ls-detail-empty { min-height: 180px; align-content: center; justify-items: start; gap: 0.85rem; }
.ls-detail-head { display: flex; gap: 0.75rem; align-items: center; }
.ls-detail-mark {
  min-width: 2.75rem; height: 2.5rem; padding: 0 0.55rem; border-radius: 12px;
  display: grid; place-items: center; font-weight: 700; font-size: var(--stem-text-md); letter-spacing: 0.04em;
  background: #eef8f6; color: #055456; border: 1px solid rgba(12, 124, 128, 0.22);
}
.ls-detail-head h3 { margin: 0; font-size: var(--stem-text-xl); letter-spacing: -0.02em; }
.ls-detail-head p { margin: 0.15rem 0 0; font-size: var(--stem-text-md); color: var(--stem-ink-soft); }
.ls-meta { display: grid; gap: 0.55rem; margin: 0; }
.ls-meta > div {
  display: grid; grid-template-columns: 7.5rem minmax(0, 1fr); gap: 0.5rem; align-items: baseline;
}
.ls-meta dt {
  margin: 0; font-size: var(--stem-text-xs); text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--stem-ink-soft);
}
.ls-meta dd { margin: 0; font-size: var(--stem-text-base); }
.ls-summary {
  margin: 0; padding-top: 0.75rem; border-top: 1px solid var(--stem-line);
  font-size: var(--stem-text-base); color: var(--stem-ink-soft); line-height: 1.45;
}
.ls-usage-list {
  list-style: none; margin: 0; padding: 0.75rem 0 0; border-top: 1px solid var(--stem-line);
  display: grid; gap: 0.45rem;
}
.ls-usage-list li { display: grid; gap: 0.1rem; font-size: var(--stem-text-md); }
.ls-usage-list span { color: var(--stem-ink-soft); font-size: var(--stem-text-sm); }
.ls-actions {
  display: flex; flex-wrap: wrap; gap: 0.5rem; padding-top: 0.35rem;
  border-top: 1px solid var(--stem-line);
}
.ls-links { display: flex; flex-wrap: wrap; gap: 0.75rem 1rem; padding-top: 0.25rem; }
.ls-links a {
  font-size: var(--stem-text-md); font-weight: 600; color: var(--stem-teal-deep); text-decoration: none;
}
.ls-links a:hover { text-decoration: underline; }
.ls-form { display: grid; gap: 0.85rem; }
.ls-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.ls-textarea { display: grid; gap: 0.35rem; font-size: var(--stem-text-md); font-weight: 600; }
.ls-textarea span { color: var(--stem-ink); }
.ls-textarea textarea {
  width: 100%; border: 1px solid var(--stem-line); border-radius: 10px;
  padding: 0.55rem 0.7rem; font: inherit; font-weight: 400; resize: vertical;
  background: #fff; color: var(--stem-ink);
}
.ls-outcomes {
  margin: 0; padding: 0.75rem; border: 1px solid var(--stem-line); border-radius: 12px;
}
.ls-outcomes legend {
  padding: 0 0.35rem; font-size: var(--stem-text-sm); font-weight: 700; letter-spacing: 0.04em;
  text-transform: uppercase; color: var(--stem-ink-soft);
}
.ls-outcomes ul { list-style: none; margin: 0.35rem 0 0; padding: 0; display: grid; gap: 0.45rem; }
.ls-outcomes label {
  display: flex; gap: 0.5rem; align-items: flex-start; font-size: var(--stem-text-md); font-weight: 400;
  cursor: pointer;
}
.ls-outcomes input { margin-top: 0.2rem; }
.ls-pill {
  display: inline-flex; align-items: center; padding: 0.2rem 0.55rem; border-radius: 999px;
  font-size: var(--stem-text-xs); font-weight: 700; letter-spacing: 0.02em; background: #f3f4f6; color: #374151;
}
.ls-pill.status-draft { background: #f3f4f6; color: #4b5563; }
.ls-pill.status-published { background: #ecfdf5; color: #047857; }
.ls-pill.status-archived { background: #eef2ff; color: #4338ca; }
.ls-muted { color: var(--stem-ink-soft); font-size: var(--stem-text-base); margin: 0; }
@media (max-width: 960px) {
  .ls-hero, .ls-layout, .ls-form-row { grid-template-columns: 1fr; }
  .ls-hero-actions { justify-items: start; }
  .ls-action-row { justify-content: flex-start; }
  .ls-side { position: static; }
}
`;
