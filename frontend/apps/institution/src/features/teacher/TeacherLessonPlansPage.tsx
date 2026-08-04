import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '@stemora/auth';
import {
  Button,
  ConfirmButton,
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
  EmptyState,
  ErrorBanner,
  StatusPill,
  TEACHER_API,
  TeacherShell,
  formatDate,
  useTeacherContext,
} from './shared';

type LessonPlan = {
  id: number;
  title_en: string;
  title_ar: string | null;
  subject_id: number | null;
  subject: string | null;
  class_section_id: number | null;
  class_section: string | null;
  planned_on: string | null;
  duration_minutes: number | null;
  objectives: string | null;
  materials: string | null;
  activities: string | null;
  assessment_notes: string | null;
  homework_notes: string | null;
  status: string;
  updated_at: string | null;
};

type Stats = { total: number; draft: number; published: number; this_week: number };

type PlanForm = {
  title_en: string;
  subject_id: string;
  class_section_id: string;
  planned_on: string;
  duration_minutes: string;
  objectives: string;
  materials: string;
  activities: string;
  assessment_notes: string;
  homework_notes: string;
  status: string;
};

const emptyForm = (): PlanForm => ({
  title_en: '',
  subject_id: '',
  class_section_id: '',
  planned_on: '',
  duration_minutes: '45',
  objectives: '',
  materials: '',
  activities: '',
  assessment_notes: '',
  homework_notes: '',
  status: 'draft',
});

export function TeacherLessonPlansPage() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const { context } = useTeacherContext();

  const [rows, setRows] = useState<LessonPlan[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, draft: 0, published: 0, this_week: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view');
  const [form, setForm] = useState<PlanForm>(emptyForm());

  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (sectionFilter) params.set('class_section_id', sectionFilter);
      if (subjectFilter) params.set('subject_id', subjectFilter);
      if (statusFilter) params.set('status', statusFilter);
      const query = params.toString();
      const res = await api.get<{ data: LessonPlan[]; meta: { stats: Stats } }>(
        `${TEACHER_API}/lesson-plans${query ? `?${query}` : ''}`
      );
      setRows(res.data ?? []);
      setStats(res.meta?.stats ?? { total: 0, draft: 0, published: 0, this_week: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load lesson plans.');
    } finally {
      setLoading(false);
    }
  }, [api, sectionFilter, subjectFilter, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (row) =>
        row.title_en.toLowerCase().includes(term) ||
        (row.objectives ?? '').toLowerCase().includes(term) ||
        (row.subject ?? '').toLowerCase().includes(term)
    );
  }, [rows, search]);

  const listPage = useClientPagination(filtered);
  const selected = useMemo(() => rows.find((row) => row.id === selectedId) ?? null, [rows, selectedId]);
  const showingForm = mode === 'create' || mode === 'edit';

  function startCreate() {
    setMode('create');
    setSelectedId(null);
    setForm({
      ...emptyForm(),
      class_section_id: sectionFilter || String(context?.sections[0]?.id ?? ''),
      subject_id: subjectFilter || String(context?.subjects[0]?.id ?? ''),
    });
  }

  function startEdit(plan: LessonPlan) {
    setMode('edit');
    setSelectedId(plan.id);
    setForm({
      title_en: plan.title_en,
      subject_id: plan.subject_id ? String(plan.subject_id) : '',
      class_section_id: plan.class_section_id ? String(plan.class_section_id) : '',
      planned_on: plan.planned_on ?? '',
      duration_minutes: plan.duration_minutes ? String(plan.duration_minutes) : '',
      objectives: plan.objectives ?? '',
      materials: plan.materials ?? '',
      activities: plan.activities ?? '',
      assessment_notes: plan.assessment_notes ?? '',
      homework_notes: plan.homework_notes ?? '',
      status: plan.status,
    });
  }

  function cancelForm() {
    setMode('view');
    setForm(emptyForm());
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateFormFields(event.currentTarget)) return;
    setSaving(true);
    setError(null);

    const payload = {
      title_en: form.title_en.trim(),
      subject_id: form.subject_id ? Number(form.subject_id) : null,
      class_section_id: form.class_section_id ? Number(form.class_section_id) : null,
      planned_on: form.planned_on || null,
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
      objectives: form.objectives.trim() || null,
      materials: form.materials.trim() || null,
      activities: form.activities.trim() || null,
      assessment_notes: form.assessment_notes.trim() || null,
      homework_notes: form.homework_notes.trim() || null,
      status: form.status,
    };

    try {
      if (mode === 'create') {
        const res = await api.post<{ data: LessonPlan }>(`${TEACHER_API}/lesson-plans`, payload);
        await load();
        setMode('view');
        setSelectedId(res.data.id);
        await feedback.success({ title: 'Lesson plan created', message: `“${res.data.title_en}” has been saved.` });
      } else if (selectedId) {
        const res = await api.request<{ data: LessonPlan }>(`${TEACHER_API}/lesson-plans/${selectedId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        await load();
        setMode('view');
        await feedback.success({ title: 'Lesson plan updated', message: `“${res.data.title_en}” has been saved.` });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the lesson plan.');
    } finally {
      setSaving(false);
    }
  }

  async function removePlan(plan: LessonPlan) {
    try {
      await api.request(`${TEACHER_API}/lesson-plans/${plan.id}`, { method: 'DELETE' });
      setSelectedId(null);
      setMode('view');
      await load();
      await feedback.success({ title: 'Lesson plan deleted', message: `“${plan.title_en}” was removed.` });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the lesson plan.');
    }
  }

  async function duplicatePlan(plan: LessonPlan) {
    try {
      const res = await api.post<{ data: LessonPlan }>(`${TEACHER_API}/lesson-plans/${plan.id}/duplicate`, {});
      await load();
      setSelectedId(res.data.id);
      await feedback.success({
        title: 'Lesson plan duplicated',
        message: 'A draft copy was created one week ahead.',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not duplicate the lesson plan.');
    }
  }

  return (
    <TeacherShell
      title="Lesson Plans"
      subtitle="Plan, review, and reuse your teaching sequence"
      headerActions={
        <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      }
    >
      <div className="tp-page">
        <section className="tp-hero stem-animate-rise">
          <div className="tp-hero-copy">
            <p className="tp-eyebrow">Teacher portal · Planning</p>
            <h2 className="tp-hero-title">Lesson plans</h2>
            <p className="tp-hero-lead">
              Build objective-led plans for each class, keep them as drafts while you refine them, then publish so
              they appear in your weekly schedule. Duplicate a plan to reuse it with another section.
            </p>
          </div>
          <div className="tp-hero-actions">
            <Button size="sm" type="button" variant="primary" onClick={startCreate}>
              New lesson plan
            </Button>
          </div>
        </section>

        <ErrorBanner error={error} onDismiss={() => setError(null)} />

        <StatStrip
          items={[
            { label: 'Total plans', value: String(stats.total) },
            { label: 'Published', value: String(stats.published), hint: 'Visible in your schedule' },
            { label: 'Drafts', value: String(stats.draft), hint: 'Still being written' },
            { label: 'This week', value: String(stats.this_week), hint: 'Planned for the current week' },
          ]}
        />

        <div className="tk-toolbar">
          <label className="tk-field tk-field-grow">
            <span>Search</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title or objective"
              aria-label="Search lesson plans"
            />
          </label>
          <label className="tk-field">
            <span>Class</span>
            <select value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value)}>
              <option value="">All classes</option>
              {context?.sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.label}
                </option>
              ))}
            </select>
          </label>
          <label className="tk-field">
            <span>Subject</span>
            <select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}>
              <option value="">All subjects</option>
              {context?.subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name_en}
                </option>
              ))}
            </select>
          </label>
          <label className="tk-field">
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>
        </div>

        <div className="tp-layout">
          <Panel
            title="Your plans"
            description={
              loading
                ? 'Loading…'
                : `${filtered.length} plan${filtered.length === 1 ? '' : 's'} — select one to read the full detail.`
            }
          >
            {filtered.length === 0 && !loading ? (
              <EmptyState
                title="No lesson plans yet"
                message="Create your first plan to capture objectives, activities, and the homework you will set."
                action={
                  <Button size="sm" type="button" variant="primary" onClick={startCreate}>
                    New lesson plan
                  </Button>
                }
              />
            ) : (
              <>
                <div className="tp-table-wrap">
                  <table className="tp-table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Class</th>
                        <th>Subject</th>
                        <th>Planned</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listPage.pageItems.map((plan) => (
                        <tr
                          key={plan.id}
                          className={selectedId === plan.id && mode !== 'create' ? 'is-selected' : undefined}
                          onClick={() => {
                            setMode('view');
                            setSelectedId(plan.id);
                          }}
                        >
                          <td>
                            <strong>{plan.title_en}</strong>
                            {plan.objectives ? <span className="tp-cell-sub">{plan.objectives}</span> : null}
                          </td>
                          <td>{plan.class_section ?? '—'}</td>
                          <td>{plan.subject ?? '—'}</td>
                          <td>{formatDate(plan.planned_on)}</td>
                          <td>
                            <StatusPill status={plan.status} />
                          </td>
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
              </>
            )}
          </Panel>

          <aside>
            {showingForm ? (
              <Panel title={mode === 'create' ? 'New lesson plan' : 'Edit lesson plan'}>
                <form className="tp-form" onSubmit={onSave} noValidate>
                  <TextField
                    label="Title"
                    required
                    maxLength={255}
                    value={form.title_en}
                    onChange={(event) => setForm({ ...form, title_en: event.target.value })}
                    placeholder="e.g. Forces and Motion"
                  />
                  <div className="tp-form-grid">
                    <SelectField
                      label="Class"
                      value={form.class_section_id}
                      onChange={(event) => setForm({ ...form, class_section_id: event.target.value })}
                    >
                      <option value="">No class</option>
                      {context?.sections.map((section) => (
                        <option key={section.id} value={section.id}>
                          {section.label}
                        </option>
                      ))}
                    </SelectField>
                    <SelectField
                      label="Subject"
                      value={form.subject_id}
                      onChange={(event) => setForm({ ...form, subject_id: event.target.value })}
                    >
                      <option value="">No subject</option>
                      {context?.subjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name_en}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                  <div className="tp-form-grid">
                    <TextField
                      label="Planned date"
                      type="date"
                      value={form.planned_on}
                      onChange={(event) => setForm({ ...form, planned_on: event.target.value })}
                    />
                    <TextField
                      label="Duration (minutes)"
                      type="number"
                      min={5}
                      max={600}
                      value={form.duration_minutes}
                      onChange={(event) => setForm({ ...form, duration_minutes: event.target.value })}
                    />
                  </div>
                  <TextAreaField
                    label="Learning objectives"
                    rows={3}
                    value={form.objectives}
                    onChange={(event) => setForm({ ...form, objectives: event.target.value })}
                    hint="What should students be able to do by the end of the lesson?"
                  />
                  <TextAreaField
                    label="Materials"
                    rows={2}
                    value={form.materials}
                    onChange={(event) => setForm({ ...form, materials: event.target.value })}
                  />
                  <TextAreaField
                    label="Activities"
                    rows={4}
                    value={form.activities}
                    onChange={(event) => setForm({ ...form, activities: event.target.value })}
                    hint="Starter, main activity, and plenary."
                  />
                  <TextAreaField
                    label="Assessment notes"
                    rows={2}
                    value={form.assessment_notes}
                    onChange={(event) => setForm({ ...form, assessment_notes: event.target.value })}
                  />
                  <TextAreaField
                    label="Homework to set"
                    rows={2}
                    value={form.homework_notes}
                    onChange={(event) => setForm({ ...form, homework_notes: event.target.value })}
                  />
                  <SelectField
                    label="Status"
                    value={form.status}
                    onChange={(event) => setForm({ ...form, status: event.target.value })}
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </SelectField>
                  <FormActions>
                    <Button size="sm" type="submit" variant="primary" disabled={saving}>
                      {saving ? 'Saving…' : mode === 'create' ? 'Create plan' : 'Save changes'}
                    </Button>
                    <Button size="sm" type="button" variant="secondary" onClick={cancelForm} disabled={saving}>
                      Cancel
                    </Button>
                  </FormActions>
                </form>
              </Panel>
            ) : selected ? (
              <Panel title="Plan detail" description={selected.title_en}>
                <div className="tk-detail-scroll tk-stack">
                  <dl className="tp-meta">
                    <div>
                      <dt>Class</dt>
                      <dd>{selected.class_section ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Subject</dt>
                      <dd>{selected.subject ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Planned</dt>
                      <dd>{formatDate(selected.planned_on)}</dd>
                    </div>
                    <div>
                      <dt>Duration</dt>
                      <dd>{selected.duration_minutes ? `${selected.duration_minutes} min` : '—'}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <StatusPill status={selected.status} />
                      </dd>
                    </div>
                  </dl>

                  {[
                    ['Objectives', selected.objectives],
                    ['Materials', selected.materials],
                    ['Activities', selected.activities],
                    ['Assessment', selected.assessment_notes],
                    ['Homework', selected.homework_notes],
                  ]
                    .filter(([, value]) => Boolean(value))
                    .map(([label, value]) => (
                      <div className="tk-note-block" key={label}>
                        <h4>{label}</h4>
                        <p className="tk-note">{value}</p>
                      </div>
                    ))}
                </div>

                <div className="tp-actions">
                  <Button size="sm" type="button" variant="secondary" onClick={() => startEdit(selected)}>
                    Edit
                  </Button>
                  <Button size="sm" type="button" variant="secondary" onClick={() => void duplicatePlan(selected)}>
                    Duplicate
                  </Button>
                  <ConfirmButton
                    size="sm"
                    variant="danger"
                    tone="danger"
                    title="Delete lesson plan?"
                    message={`“${selected.title_en}” will be permanently removed.`}
                    confirmLabel="Delete"
                    onConfirm={() => removePlan(selected)}
                  >
                    Delete
                  </ConfirmButton>
                </div>
              </Panel>
            ) : (
              <Panel title="Plan detail">
                <EmptyState
                  title="Nothing selected"
                  message="Choose a lesson plan from the list to read its objectives, activities, and homework."
                  action={
                    <Button size="sm" type="button" variant="primary" onClick={startCreate}>
                      New lesson plan
                    </Button>
                  }
                />
              </Panel>
            )}
          </aside>
        </div>
      </div>
    </TeacherShell>
  );
}
