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
  Pill,
  ScoreBar,
  StatusPill,
  TEACHER_API,
  TeacherShell,
  formatDate,
  formatDateTime,
  toDateTimeLocal,
  useTeacherContext,
} from './shared';

type AssessmentType = 'quiz' | 'exam';

type Assessment = {
  id: number;
  title_en: string;
  title_ar: string | null;
  instructions_en: string | null;
  type: string;
  status: string;
  subject_id: number | null;
  subject: string | null;
  class_section_id: number | null;
  time_limit_seconds: number | null;
  max_attempts: number | null;
  available_from: string | null;
  available_until: string | null;
  shuffle_questions: boolean;
  show_results: string | null;
  counts_toward_grade: boolean;
  questions_count: number;
  attempts_count: number;
  pending_grading: number;
  average_score: number | null;
  editable: boolean;
};

type Stats = { total: number; published: number; draft: number; pending_grading: number };

type AssessmentForm = {
  title_en: string;
  instructions_en: string;
  subject_id: string;
  class_section_id: string;
  available_from: string;
  available_until: string;
  time_limit_minutes: string;
  max_attempts: string;
  show_results: string;
  shuffle_questions: boolean;
  counts_toward_grade: boolean;
  status: string;
};

const emptyForm = (type: AssessmentType): AssessmentForm => ({
  title_en: '',
  instructions_en: '',
  subject_id: '',
  class_section_id: '',
  available_from: '',
  available_until: '',
  time_limit_minutes: type === 'quiz' ? '15' : '60',
  max_attempts: type === 'quiz' ? '3' : '1',
  show_results: type === 'quiz' ? 'after_submit' : 'after_due',
  shuffle_questions: type === 'quiz',
  counts_toward_grade: type === 'exam',
  status: 'draft',
});

const copyFor = (type: AssessmentType) =>
  type === 'quiz'
    ? {
        title: 'Quizzes',
        eyebrow: 'Teacher portal · Quizzes',
        lead:
          'Run short formative checks that students can attempt more than once. Set a time limit and an availability window, keep the quiz as a draft while you build the questions, then publish it to your class.',
        noun: 'quiz',
        plural: 'quizzes',
        newLabel: 'New quiz',
        detailTitle: 'Quiz detail',
        subtitle: 'Short formative checks with multiple attempts',
      }
    : {
        title: 'Exams',
        eyebrow: 'Teacher portal · Exams',
        lead:
          'Schedule formal summative assessments with a fixed sitting window, a single attempt, and results held back until marking is complete. Publish only once the paper is final.',
        noun: 'exam',
        plural: 'exams',
        newLabel: 'New exam',
        detailTitle: 'Exam detail',
        subtitle: 'Formal summative assessments and results',
      };

const SHOW_RESULTS_LABELS: Record<string, string> = {
  never: 'Never shown',
  after_submit: 'Immediately after submitting',
  after_due: 'After the window closes',
};

/** Availability relative to now — drives the "Open now" / "Closed" pill in the list. */
function windowState(from: string | null, until: string | null): 'open' | 'closed' | null {
  const now = Date.now();
  const start = from ? new Date(from).getTime() : null;
  const end = until ? new Date(until).getTime() : null;
  if (start === null && end === null) return null;
  if (end !== null && !Number.isNaN(end) && end < now) return 'closed';
  if ((start === null || Number.isNaN(start) || start <= now) && (end === null || end >= now)) return 'open';
  return null;
}

export function TeacherQuizzesPage() {
  return <AssessmentWorkspace type="quiz" />;
}

export function TeacherExamsPage() {
  return <AssessmentWorkspace type="exam" />;
}

function AssessmentWorkspace({ type }: { type: AssessmentType }) {
  const { api } = useAuth();
  const feedback = useFeedback();
  const { context } = useTeacherContext();
  const copy = copyFor(type);

  const [rows, setRows] = useState<Assessment[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, published: 0, draft: 0, pending_grading: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view');
  const [form, setForm] = useState<AssessmentForm>(emptyForm(type));

  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ type });
      if (sectionFilter) params.set('class_section_id', sectionFilter);
      if (subjectFilter) params.set('subject_id', subjectFilter);
      if (statusFilter) params.set('status', statusFilter);
      const res = await api.get<{ data: Assessment[]; meta: { stats: Stats } }>(
        `${TEACHER_API}/assessments?${params.toString()}`
      );
      setRows(res.data ?? []);
      setStats(res.meta?.stats ?? { total: 0, published: 0, draft: 0, pending_grading: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not load ${copy.plural}.`);
    } finally {
      setLoading(false);
    }
  }, [api, type, sectionFilter, subjectFilter, statusFilter, copy.plural]);

  useEffect(() => {
    void load();
  }, [load]);

  const sectionNames = useMemo(() => {
    const map = new Map<number, string>();
    context?.sections.forEach((section) => map.set(section.id, section.label));
    return map;
  }, [context]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (row) =>
        row.title_en.toLowerCase().includes(term) ||
        (row.instructions_en ?? '').toLowerCase().includes(term) ||
        (row.subject ?? '').toLowerCase().includes(term)
    );
  }, [rows, search]);

  const listPage = useClientPagination(filtered);
  const selected = useMemo(() => rows.find((row) => row.id === selectedId) ?? null, [rows, selectedId]);
  const showingForm = mode === 'create' || mode === 'edit';

  function sectionLabel(id: number | null) {
    if (!id) return '—';
    return sectionNames.get(id) ?? `Class #${id}`;
  }

  function windowLabel(from: string | null, until: string | null) {
    if (!from && !until) return 'Always available';
    const start = from ? new Date(from) : null;
    const end = until ? new Date(until) : null;
    // Printing the year twice for a window inside one year just eats column width.
    if (start && end && start.getFullYear() === end.getFullYear()) {
      const startShort = start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
      return `${startShort} – ${formatDate(until)}`;
    }
    return `${formatDate(from)} – ${formatDate(until)}`;
  }

  function timeLimitLabel(seconds: number | null) {
    if (!seconds) return 'No time limit';
    return `${Math.round(seconds / 60)} min`;
  }

  function startCreate() {
    setMode('create');
    setSelectedId(null);
    setForm({
      ...emptyForm(type),
      class_section_id: sectionFilter || String(context?.sections[0]?.id ?? ''),
      subject_id: subjectFilter || String(context?.subjects[0]?.id ?? ''),
    });
  }

  function startEdit(assessment: Assessment) {
    setMode('edit');
    setSelectedId(assessment.id);
    setForm({
      title_en: assessment.title_en,
      instructions_en: assessment.instructions_en ?? '',
      subject_id: assessment.subject_id ? String(assessment.subject_id) : '',
      class_section_id: assessment.class_section_id ? String(assessment.class_section_id) : '',
      available_from: toDateTimeLocal(assessment.available_from),
      available_until: toDateTimeLocal(assessment.available_until),
      time_limit_minutes: assessment.time_limit_seconds ? String(Math.round(assessment.time_limit_seconds / 60)) : '',
      max_attempts: assessment.max_attempts !== null ? String(assessment.max_attempts) : '',
      show_results: assessment.show_results ?? 'after_submit',
      shuffle_questions: assessment.shuffle_questions,
      counts_toward_grade: assessment.counts_toward_grade,
      status: assessment.status,
    });
  }

  function cancelForm() {
    setMode('view');
    setForm(emptyForm(type));
  }

  function selectRow(assessment: Assessment) {
    setMode('view');
    setSelectedId(assessment.id);
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateFormFields(event.currentTarget)) return;

    const availableFrom = form.available_from ? new Date(form.available_from) : null;
    const availableUntil = form.available_until ? new Date(form.available_until) : null;
    if (availableFrom && availableUntil && availableUntil.getTime() <= availableFrom.getTime()) {
      setError('The closing time must be later than the opening time.');
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      type,
      title_en: form.title_en.trim(),
      instructions_en: form.instructions_en.trim() || null,
      subject_id: form.subject_id ? Number(form.subject_id) : null,
      class_section_id: form.class_section_id ? Number(form.class_section_id) : null,
      time_limit_seconds: form.time_limit_minutes ? Number(form.time_limit_minutes) * 60 : null,
      max_attempts: form.max_attempts ? Number(form.max_attempts) : null,
      available_from: availableFrom ? availableFrom.toISOString() : null,
      available_until: availableUntil ? availableUntil.toISOString() : null,
      shuffle_questions: form.shuffle_questions,
      show_results: form.show_results,
      counts_toward_grade: form.counts_toward_grade,
      status: form.status,
    };

    try {
      if (mode === 'create') {
        const res = await api.post<{ message: string; data: { id: number } }>(`${TEACHER_API}/assessments`, payload);
        await load();
        setMode('view');
        setSelectedId(res.data.id);
        await feedback.success({
          title: `${copy.noun === 'quiz' ? 'Quiz' : 'Exam'} created`,
          message: `“${payload.title_en}” has been saved as ${payload.status === 'published' ? 'published' : 'a draft'}.`,
        });
      } else if (selectedId) {
        await api.request<{ message: string; data: { id: number } }>(`${TEACHER_API}/assessments/${selectedId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        await load();
        setMode('view');
        await feedback.success({
          title: `${copy.noun === 'quiz' ? 'Quiz' : 'Exam'} updated`,
          message: `“${payload.title_en}” has been saved.`,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not save the ${copy.noun}.`);
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(assessment: Assessment) {
    setPublishing(true);
    setError(null);
    try {
      const res = await api.post<{ message: string; data: { id: number; status: string } }>(
        `${TEACHER_API}/assessments/${assessment.id}/publish`,
        {}
      );
      await load();
      const published = res.data.status === 'published';
      await feedback.success({
        title: published ? `${copy.noun === 'quiz' ? 'Quiz' : 'Exam'} published` : 'Moved back to draft',
        message: published
          ? `“${assessment.title_en}” is now visible to your students.`
          : `“${assessment.title_en}” is hidden from students while you edit it.`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not change the status of this ${copy.noun}.`);
    } finally {
      setPublishing(false);
    }
  }

  async function removeAssessment(assessment: Assessment) {
    try {
      await api.request<{ message: string }>(`${TEACHER_API}/assessments/${assessment.id}`, { method: 'DELETE' });
      setSelectedId(null);
      setMode('view');
      await load();
      await feedback.success({
        title: `${copy.noun === 'quiz' ? 'Quiz' : 'Exam'} deleted`,
        message: `“${assessment.title_en}” was removed.`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not delete the ${copy.noun}.`);
    }
  }

  return (
    <TeacherShell
      title={copy.title}
      subtitle={copy.subtitle}
      headerActions={
        <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      }
    >
      <div className="tp-page">
        <section className="tp-hero stem-animate-rise">
          <div className="tp-hero-copy">
            <p className="tp-eyebrow">{copy.eyebrow}</p>
            <h2 className="tp-hero-title">{copy.title}</h2>
            <p className="tp-hero-lead">{copy.lead}</p>
          </div>
          <div className="tp-hero-actions">
            <Button size="sm" type="button" variant="primary" onClick={startCreate}>
              {copy.newLabel}
            </Button>
          </div>
        </section>

        <ErrorBanner error={error} onDismiss={() => setError(null)} />

        <StatStrip
          items={[
            { label: 'Total', value: String(stats.total) },
            { label: 'Published', value: String(stats.published), hint: 'Visible to students' },
            { label: 'Drafts', value: String(stats.draft), hint: 'Not shared yet' },
            { label: 'Awaiting grading', value: String(stats.pending_grading), hint: 'Attempts needing marks' },
          ]}
        />

        <div className="tk-toolbar">
          <label className="tk-field tk-field-grow">
            <span>Search</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title or instructions"
              aria-label={`Search ${copy.plural}`}
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
              <option value="scheduled">Scheduled</option>
              <option value="published">Published</option>
              <option value="closed">Closed</option>
            </select>
          </label>
        </div>

        <div className="tp-layout">
          <Panel
            title={copy.title}
            description={
              loading
                ? 'Loading…'
                : `${filtered.length} ${filtered.length === 1 ? copy.noun : copy.plural} — select one to see the full detail.`
            }
          >
            {filtered.length === 0 && !loading ? (
              <EmptyState
                title={`No ${copy.plural} yet`}
                message={
                  type === 'quiz'
                    ? 'Create your first quiz to check understanding while the topic is still fresh.'
                    : 'Create your first exam to schedule a formal, graded sitting for your class.'
                }
                action={
                  <Button size="sm" type="button" variant="primary" onClick={startCreate}>
                    {copy.newLabel}
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
                        <th>Window</th>
                        <th>Questions</th>
                        <th>Attempts</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listPage.pageItems.map((row) => {
                        const state = windowState(row.available_from, row.available_until);
                        return (
                          <tr
                            key={row.id}
                            className={selectedId === row.id && mode !== 'create' ? 'is-selected' : undefined}
                            onClick={() => selectRow(row)}
                          >
                            <td>
                              <strong>{row.title_en}</strong>
                              <span className="tp-cell-sub">
                                {[sectionLabel(row.class_section_id), row.subject].filter(Boolean).join(' · ')}
                              </span>
                            </td>
                            <td>
                              {windowLabel(row.available_from, row.available_until)}
                              {state ? (
                                <span style={{ display: 'block', marginTop: '0.3rem' }}>
                                  {state === 'open' ? (
                                    <Pill label="Open now" tone="ok" />
                                  ) : (
                                    <Pill label="Closed" tone="muted" />
                                  )}
                                </span>
                              ) : null}
                            </td>
                            <td>{row.questions_count}</td>
                            <td>
                              {row.attempts_count}
                              {row.pending_grading > 0 ? (
                                <span style={{ display: 'block', marginTop: '0.3rem' }}>
                                  <Pill label={`${row.pending_grading} to grade`} tone="warn" />
                                </span>
                              ) : null}
                              {row.average_score !== null ? (
                                <span style={{ display: 'block', marginTop: '0.3rem' }}>
                                  <ScoreBar value={row.average_score} />
                                </span>
                              ) : null}
                            </td>
                            <td>
                              <StatusPill status={row.status} />
                            </td>
                          </tr>
                        );
                      })}
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
              <Panel title={mode === 'create' ? copy.newLabel : `Edit ${copy.noun}`}>
                <form className="tp-form" onSubmit={onSave} noValidate>
                  <TextField
                    label="Title"
                    required
                    maxLength={255}
                    value={form.title_en}
                    onChange={(event) => setForm({ ...form, title_en: event.target.value })}
                    placeholder={type === 'quiz' ? 'e.g. Photosynthesis check' : 'e.g. Term 1 Biology exam'}
                  />
                  <TextAreaField
                    label="Instructions"
                    rows={4}
                    value={form.instructions_en}
                    onChange={(event) => setForm({ ...form, instructions_en: event.target.value })}
                    hint="What should students know before they start?"
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
                      label="Available from"
                      type="datetime-local"
                      value={form.available_from}
                      onChange={(event) => setForm({ ...form, available_from: event.target.value })}
                    />
                    <TextField
                      label="Available until"
                      type="datetime-local"
                      value={form.available_until}
                      onChange={(event) => setForm({ ...form, available_until: event.target.value })}
                      hint="Must be later than the opening time."
                    />
                  </div>
                  <div className="tp-form-grid">
                    <TextField
                      label="Time limit (minutes)"
                      type="number"
                      min={1}
                      max={480}
                      value={form.time_limit_minutes}
                      onChange={(event) => setForm({ ...form, time_limit_minutes: event.target.value })}
                      hint="Leave empty for no time limit."
                    />
                    <TextField
                      label="Max attempts"
                      type="number"
                      min={1}
                      max={20}
                      value={form.max_attempts}
                      onChange={(event) => setForm({ ...form, max_attempts: event.target.value })}
                    />
                  </div>
                  <SelectField
                    label="Show results"
                    value={form.show_results}
                    onChange={(event) => setForm({ ...form, show_results: event.target.value })}
                    hint="When students can see their score."
                  >
                    <option value="never">Never</option>
                    <option value="after_submit">Immediately after submitting</option>
                    <option value="after_due">After the window closes</option>
                  </SelectField>
                  <label className="tp-check">
                    <input
                      type="checkbox"
                      checked={form.shuffle_questions}
                      onChange={(event) => setForm({ ...form, shuffle_questions: event.target.checked })}
                    />
                    Shuffle questions for each student
                  </label>
                  <label className="tp-check">
                    <input
                      type="checkbox"
                      checked={form.counts_toward_grade}
                      onChange={(event) => setForm({ ...form, counts_toward_grade: event.target.checked })}
                    />
                    Counts toward the final grade
                  </label>
                  <SelectField
                    label="Status"
                    value={form.status}
                    onChange={(event) => setForm({ ...form, status: event.target.value })}
                  >
                    <option value="draft">Draft</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="published">Published</option>
                    <option value="closed">Closed</option>
                  </SelectField>
                  <FormActions>
                    <Button size="sm" type="submit" variant="primary" disabled={saving}>
                      {saving ? 'Saving…' : mode === 'create' ? `Create ${copy.noun}` : 'Save changes'}
                    </Button>
                    <Button size="sm" type="button" variant="secondary" onClick={cancelForm} disabled={saving}>
                      Cancel
                    </Button>
                  </FormActions>
                </form>
              </Panel>
            ) : selected ? (
              <Panel title={copy.detailTitle} description={selected.title_en}>
                <div className="tk-detail-scroll tk-stack">
                  <dl className="tp-meta">
                    <div>
                      <dt>Subject</dt>
                      <dd>{selected.subject ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Class</dt>
                      <dd>{sectionLabel(selected.class_section_id)}</dd>
                    </div>
                    <div>
                      <dt>Window</dt>
                      <dd>
                        {selected.available_from || selected.available_until
                          ? `${formatDateTime(selected.available_from)} – ${formatDateTime(selected.available_until)}`
                          : 'Always available'}
                      </dd>
                    </div>
                    <div>
                      <dt>Time limit</dt>
                      <dd>{timeLimitLabel(selected.time_limit_seconds)}</dd>
                    </div>
                    <div>
                      <dt>Attempts allowed</dt>
                      <dd>{selected.max_attempts !== null ? selected.max_attempts : 'Unlimited'}</dd>
                    </div>
                    <div>
                      <dt>Questions</dt>
                      <dd>{selected.questions_count}</dd>
                    </div>
                    <div>
                      <dt>Attempts taken</dt>
                      <dd>{selected.attempts_count}</dd>
                    </div>
                    <div>
                      <dt>Average score</dt>
                      <dd>
                        <ScoreBar value={selected.average_score} />
                      </dd>
                    </div>
                    <div>
                      <dt>Results visibility</dt>
                      <dd>{SHOW_RESULTS_LABELS[selected.show_results ?? ''] ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Counts toward grade</dt>
                      <dd>{selected.counts_toward_grade ? 'Yes' : 'No'}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <StatusPill status={selected.status} />
                      </dd>
                    </div>
                  </dl>

                  {selected.instructions_en ? (
                    <div className="tk-note-block">
                      <h4>Instructions</h4>
                      <p className="tk-note">{selected.instructions_en}</p>
                    </div>
                  ) : null}

                  {selected.pending_grading > 0 ? (
                    <p className="tp-muted">
                      {selected.pending_grading} attempt{selected.pending_grading === 1 ? '' : 's'} still need marking.
                    </p>
                  ) : null}

                  {!selected.editable ? (
                    <p className="tp-muted">
                      Published {copy.plural} are locked so student attempts stay valid. Unpublish it first to make
                      changes.
                    </p>
                  ) : null}
                </div>

                <div className="tp-actions">
                  <Button
                    size="sm"
                    type="button"
                    variant="secondary"
                    disabled={!selected.editable}
                    onClick={() => startEdit(selected)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    type="button"
                    variant="primary"
                    disabled={publishing}
                    onClick={() => void togglePublish(selected)}
                  >
                    {selected.status === 'published' ? 'Unpublish' : 'Publish'}
                  </Button>
                  <ConfirmButton
                    size="sm"
                    variant="danger"
                    tone="danger"
                    title={`Delete ${copy.noun}?`}
                    message={`“${selected.title_en}” and every attempt recorded against it will be permanently removed.`}
                    confirmLabel="Delete"
                    onConfirm={() => removeAssessment(selected)}
                  >
                    Delete
                  </ConfirmButton>
                </div>
              </Panel>
            ) : (
              <Panel title={copy.detailTitle}>
                <EmptyState
                  title="Nothing selected"
                  message={`Choose a ${copy.noun} from the list to review its settings, attempts, and results.`}
                  action={
                    <Button size="sm" type="button" variant="primary" onClick={startCreate}>
                      {copy.newLabel}
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
