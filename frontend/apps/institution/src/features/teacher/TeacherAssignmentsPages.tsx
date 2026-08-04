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
  StatusPill,
  TEACHER_API,
  TeacherShell,
  formatDate,
  formatDateTime,
  formatRelativeDue,
  initials,
  toDateTimeLocal,
  useTeacherContext,
} from './shared';

type AssignmentKind = 'homework' | 'assignment';

type Assignment = {
  id: number;
  title_en: string;
  title_ar: string | null;
  instructions_en: string | null;
  subject_id: number | null;
  subject: string | null;
  class_section_id: number | null;
  due_at: string | null;
  status: string;
  is_scored: boolean;
  max_score: number | null;
  allow_late: boolean;
  submissions_count: number;
  graded_count: number;
  pending_count: number;
};

type Stats = { total: number; published: number; draft: number; overdue: number };

type Submission = {
  id: number;
  student_user_id: number;
  student: string;
  submitted_at: string | null;
  is_late: boolean;
  score: number | null;
  feedback: string | null;
  status: string;
  body_text: string | null;
};

type SubmissionMeta = {
  assignment: { id: number; title_en: string; max_score: number | null; is_scored: boolean };
  stats: { total: number; graded: number; late: number };
};

type AssignmentForm = {
  title_en: string;
  instructions_en: string;
  subject_id: string;
  class_section_id: string;
  due_at: string;
  status: string;
  is_scored: boolean;
  max_score: string;
  allow_late: boolean;
};

/** Per-row draft marks so a teacher can edit several students before saving each one. */
type GradeDraft = { score: string; feedback: string };

const emptyForm = (): AssignmentForm => ({
  title_en: '',
  instructions_en: '',
  subject_id: '',
  class_section_id: '',
  due_at: '',
  status: 'draft',
  is_scored: true,
  max_score: '10',
  allow_late: false,
});

const copyFor = (kind: AssignmentKind) =>
  kind === 'homework'
    ? {
        title: 'Homework',
        eyebrow: 'Teacher portal · Homework',
        lead:
          'Set short daily practice tasks so students consolidate what you covered in class. Keep a task as a draft while you write it, then publish it to make it visible to your students and their parents.',
        noun: 'homework task',
        article: 'a',
        newLabel: 'New homework',
      }
    : {
        title: 'Assignments',
        eyebrow: 'Teacher portal · Assignments',
        lead:
          'Set longer graded project work with a clear brief and deadline. Publish when the brief is ready, then track submissions and release marks with written feedback.',
        noun: 'assignment',
        article: 'an',
        newLabel: 'New assignment',
      };

export function TeacherHomeworkPage() {
  return <AssignmentWorkspace kind="homework" />;
}

export function TeacherAssignmentsPage() {
  return <AssignmentWorkspace kind="assignment" />;
}

function AssignmentWorkspace({ kind }: { kind: AssignmentKind }) {
  const { api } = useAuth();
  const feedback = useFeedback();
  const { context } = useTeacherContext();
  const copy = copyFor(kind);

  const [rows, setRows] = useState<Assignment[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, published: 0, draft: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view');
  const [form, setForm] = useState<AssignmentForm>(emptyForm());

  const [grading, setGrading] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submissionMeta, setSubmissionMeta] = useState<SubmissionMeta | null>(null);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, GradeDraft>>({});
  const [gradingId, setGradingId] = useState<number | null>(null);

  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ kind });
      if (sectionFilter) params.set('class_section_id', sectionFilter);
      if (subjectFilter) params.set('subject_id', subjectFilter);
      if (statusFilter) params.set('status', statusFilter);
      const res = await api.get<{ data: Assignment[]; meta: { stats: Stats } }>(
        `${TEACHER_API}/assignments?${params.toString()}`
      );
      setRows(res.data ?? []);
      setStats(res.meta?.stats ?? { total: 0, published: 0, draft: 0, overdue: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not load ${copy.title.toLowerCase()}.`);
    } finally {
      setLoading(false);
    }
  }, [api, kind, sectionFilter, subjectFilter, statusFilter, copy.title]);

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

  function startCreate() {
    setMode('create');
    setGrading(false);
    setSelectedId(null);
    setForm({
      ...emptyForm(),
      class_section_id: sectionFilter || String(context?.sections[0]?.id ?? ''),
      subject_id: subjectFilter || String(context?.subjects[0]?.id ?? ''),
    });
  }

  function startEdit(assignment: Assignment) {
    setMode('edit');
    setGrading(false);
    setSelectedId(assignment.id);
    setForm({
      title_en: assignment.title_en,
      instructions_en: assignment.instructions_en ?? '',
      subject_id: assignment.subject_id ? String(assignment.subject_id) : '',
      class_section_id: assignment.class_section_id ? String(assignment.class_section_id) : '',
      due_at: toDateTimeLocal(assignment.due_at),
      status: assignment.status,
      is_scored: assignment.is_scored,
      max_score: assignment.max_score !== null ? String(assignment.max_score) : '',
      allow_late: assignment.allow_late,
    });
  }

  function cancelForm() {
    setMode('view');
    setForm(emptyForm());
  }

  function selectRow(assignment: Assignment) {
    setMode('view');
    setGrading(false);
    setSelectedId(assignment.id);
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateFormFields(event.currentTarget)) return;
    setSaving(true);
    setError(null);

    const payload = {
      title_en: form.title_en.trim(),
      instructions_en: form.instructions_en.trim() || null,
      subject_id: form.subject_id ? Number(form.subject_id) : null,
      class_section_id: form.class_section_id ? Number(form.class_section_id) : null,
      due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
      status: form.status,
      assignment_kind: kind,
      is_scored: form.is_scored,
      max_score: form.is_scored && form.max_score ? Number(form.max_score) : null,
      allow_late: form.allow_late,
    };

    try {
      if (mode === 'create') {
        const res = await api.post<{ data: { id: number } }>(`${TEACHER_API}/assignments`, payload);
        await load();
        setMode('view');
        setSelectedId(res.data.id);
        await feedback.success({
          title: `${copy.title} created`,
          message: `“${payload.title_en}” has been saved as ${payload.status === 'published' ? 'published' : 'a draft'}.`,
        });
      } else if (selectedId) {
        await api.request<{ data: { id: number } }>(`${TEACHER_API}/assignments/${selectedId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        await load();
        setMode('view');
        await feedback.success({ title: `${copy.title} updated`, message: `“${payload.title_en}” has been saved.` });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not save the ${copy.noun}.`);
    } finally {
      setSaving(false);
    }
  }

  async function removeAssignment(assignment: Assignment) {
    try {
      await api.request<{ message: string }>(`${TEACHER_API}/assignments/${assignment.id}`, { method: 'DELETE' });
      setSelectedId(null);
      setMode('view');
      setGrading(false);
      await load();
      await feedback.success({ title: `${copy.title} deleted`, message: `“${assignment.title_en}” was removed.` });
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not delete the ${copy.noun}.`);
    }
  }

  async function loadSubmissions(assignmentId: number) {
    setSubmissionsLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: Submission[]; meta: SubmissionMeta }>(
        `${TEACHER_API}/assignments/${assignmentId}/submissions`
      );
      const list = res.data ?? [];
      setSubmissions(list);
      setSubmissionMeta(res.meta ?? null);
      setDrafts(
        Object.fromEntries(
          list.map((row) => [row.id, { score: row.score !== null ? String(row.score) : '', feedback: row.feedback ?? '' }])
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load submissions.');
      setSubmissions([]);
      setSubmissionMeta(null);
    } finally {
      setSubmissionsLoading(false);
    }
  }

  async function openGrading(assignment: Assignment) {
    setGrading(true);
    setMode('view');
    setSelectedId(assignment.id);
    await loadSubmissions(assignment.id);
  }

  function closeGrading() {
    setGrading(false);
    setSubmissions([]);
    setSubmissionMeta(null);
    setDrafts({});
  }

  async function saveGrade(submission: Submission) {
    if (!selectedId) return;
    const draft = drafts[submission.id] ?? { score: '', feedback: '' };
    const score = draft.score.trim() === '' ? null : Number(draft.score);
    setGradingId(submission.id);
    setError(null);
    try {
      await api.post<{ data: { id: number } }>(
        `${TEACHER_API}/assignments/${selectedId}/submissions/${submission.id}/grade`,
        {
          score,
          feedback: draft.feedback.trim() || null,
          // Without a mark the work is only handed back with comments.
          status: score === null ? 'returned' : 'graded',
        }
      );
      await load();
      await loadSubmissions(selectedId);
      await feedback.success({ title: 'Feedback saved', message: `${submission.student}’s work has been updated.` });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this mark.');
    } finally {
      setGradingId(null);
    }
  }

  function updateDraft(id: number, patch: Partial<GradeDraft>) {
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] ?? { score: '', feedback: '' }), ...patch } }));
  }

  return (
    <TeacherShell
      title={copy.title}
      subtitle={
        kind === 'homework' ? 'Set daily practice and track completion' : 'Set graded project work and release marks'
      }
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
            { label: 'Overdue', value: String(stats.overdue), hint: 'Past the due date' },
          ]}
        />

        <div className="tk-toolbar">
          <label className="tk-field tk-field-grow">
            <span>Search</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title or instructions"
              aria-label={`Search ${copy.title.toLowerCase()}`}
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
              <option value="closed">Closed</option>
            </select>
          </label>
        </div>

        <div className="tp-layout">
          <Panel
            title={kind === 'homework' ? 'Homework tasks' : 'Assignments'}
            description={
              loading
                ? 'Loading…'
                : `${filtered.length} ${filtered.length === 1 ? copy.noun : `${copy.noun}s`} — select one to see submissions.`
            }
          >
            {filtered.length === 0 && !loading ? (
              <EmptyState
                title={`No ${copy.title.toLowerCase()} yet`}
                message={
                  kind === 'homework'
                    ? 'Create your first task to give students focused practice after the lesson.'
                    : 'Create your first assignment to set a graded brief with a clear deadline.'
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
                        <th>Class / Subject</th>
                        <th>Due</th>
                        <th>Submissions</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listPage.pageItems.map((row) => {
                        const due = formatRelativeDue(row.due_at);
                        return (
                          <tr
                            key={row.id}
                            className={selectedId === row.id && mode !== 'create' ? 'is-selected' : undefined}
                            onClick={() => selectRow(row)}
                          >
                            <td>
                              <strong>{row.title_en}</strong>
                              {row.instructions_en ? (
                                <span className="tp-cell-sub">{row.instructions_en}</span>
                              ) : null}
                            </td>
                            <td>
                              {sectionLabel(row.class_section_id)}
                              <span className="tp-cell-sub">{row.subject ?? 'No subject'}</span>
                            </td>
                            <td>
                              <Pill label={due.label} tone={due.tone} />
                            </td>
                            <td>
                              {row.graded_count} / {row.submissions_count}
                              {row.pending_count > 0 ? (
                                <span style={{ display: 'block', marginTop: '0.3rem' }}>
                                  <Pill label={`${row.pending_count} to grade`} tone="warn" />
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
                    placeholder={kind === 'homework' ? 'e.g. Fractions worksheet 3' : 'e.g. Renewable energy report'}
                  />
                  <TextAreaField
                    label="Instructions"
                    rows={4}
                    value={form.instructions_en}
                    onChange={(event) => setForm({ ...form, instructions_en: event.target.value })}
                    hint="What should students do, and how should they hand it in?"
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
                      label="Due date"
                      type="datetime-local"
                      value={form.due_at}
                      onChange={(event) => setForm({ ...form, due_at: event.target.value })}
                    />
                    <SelectField
                      label="Status"
                      value={form.status}
                      onChange={(event) => setForm({ ...form, status: event.target.value })}
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="closed">Closed</option>
                    </SelectField>
                  </div>
                  <label className="tp-check">
                    <input
                      type="checkbox"
                      checked={form.is_scored}
                      onChange={(event) => setForm({ ...form, is_scored: event.target.checked })}
                    />
                    Scored
                  </label>
                  <TextField
                    label="Max score"
                    type="number"
                    min={1}
                    max={1000}
                    disabled={!form.is_scored}
                    value={form.max_score}
                    onChange={(event) => setForm({ ...form, max_score: event.target.value })}
                    hint={form.is_scored ? 'Marks available for this task.' : 'Enable “Scored” to set a maximum.'}
                  />
                  <label className="tp-check">
                    <input
                      type="checkbox"
                      checked={form.allow_late}
                      onChange={(event) => setForm({ ...form, allow_late: event.target.checked })}
                    />
                    Allow late submissions
                  </label>
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
            ) : grading && selected ? (
              <Panel title="Grade submissions" description={selected.title_en}>
                <div className="tk-stack">
                  <div className="tk-card-foot">
                    <span>
                      Submissions <strong>{submissionMeta?.stats.total ?? 0}</strong>
                    </span>
                    <span>
                      Graded <strong>{submissionMeta?.stats.graded ?? 0}</strong>
                    </span>
                    <span>
                      Late <strong>{submissionMeta?.stats.late ?? 0}</strong>
                    </span>
                  </div>

                  {submissionsLoading ? (
                    <p className="tp-muted">Loading submissions…</p>
                  ) : submissions.length === 0 ? (
                    <EmptyState
                      title="No submissions yet"
                      message="Marks and feedback can be entered as soon as students hand their work in."
                    />
                  ) : (
                    <div className="tk-roster">
                      {submissions.map((submission) => {
                        const draft = drafts[submission.id] ?? { score: '', feedback: '' };
                        const busy = gradingId === submission.id;
                        return (
                          <div
                            key={submission.id}
                            className={submission.is_late ? 'tk-roster-row is-late' : 'tk-roster-row'}
                          >
                            <div className="tk-stack">
                              <div className="tk-row">
                                <div className="tk-person">
                                  <span className="tk-avatar" aria-hidden="true">
                                    {initials(submission.student)}
                                  </span>
                                  <div>
                                    <strong>{submission.student}</strong>
                                    <span>
                                      {submission.submitted_at
                                        ? `Submitted ${formatDate(submission.submitted_at)}`
                                        : 'Not submitted'}
                                    </span>
                                  </div>
                                </div>
                                <span className="tk-spacer" />
                                {submission.is_late ? <Pill label="Late" tone="warn" /> : null}
                                <StatusPill status={submission.status} />
                              </div>

                              {submission.body_text ? (
                                <p className="tk-message-preview">{submission.body_text}</p>
                              ) : null}

                              <div className="tk-row">
                                <label className="tk-field">
                                  <span>Score</span>
                                  <input
                                    type="number"
                                    min={0}
                                    max={submissionMeta?.assignment.max_score ?? undefined}
                                    step="any"
                                    disabled={!(submissionMeta?.assignment.is_scored ?? selected.is_scored)}
                                    value={draft.score}
                                    onChange={(event) => updateDraft(submission.id, { score: event.target.value })}
                                    aria-label={`Score for ${submission.student}`}
                                  />
                                </label>
                                <label className="tk-field tk-field-grow">
                                  <span>Feedback</span>
                                  <input
                                    type="text"
                                    value={draft.feedback}
                                    onChange={(event) => updateDraft(submission.id, { feedback: event.target.value })}
                                    placeholder="Short comment for the student"
                                    aria-label={`Feedback for ${submission.student}`}
                                  />
                                </label>
                                <Button
                                  size="sm"
                                  type="button"
                                  variant="primary"
                                  disabled={busy}
                                  onClick={() => void saveGrade(submission)}
                                >
                                  {busy ? 'Saving…' : 'Save'}
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="tp-actions">
                  <Button size="sm" type="button" variant="secondary" onClick={closeGrading}>
                    Back to detail
                  </Button>
                </div>
              </Panel>
            ) : selected ? (
              <Panel title={`${kind === 'homework' ? 'Homework' : 'Assignment'} detail`} description={selected.title_en}>
                <div className="tk-detail-scroll tk-stack">
                  <dl className="tp-meta">
                    <div>
                      <dt>Class</dt>
                      <dd>{sectionLabel(selected.class_section_id)}</dd>
                    </div>
                    <div>
                      <dt>Subject</dt>
                      <dd>{selected.subject ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Due</dt>
                      <dd>{formatDateTime(selected.due_at)}</dd>
                    </div>
                    <div>
                      <dt>Marking</dt>
                      <dd>
                        {selected.is_scored
                          ? `Scored out of ${selected.max_score ?? '—'}`
                          : 'Not scored'}
                      </dd>
                    </div>
                    <div>
                      <dt>Late work</dt>
                      <dd>{selected.allow_late ? 'Accepted' : 'Not accepted'}</dd>
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

                  <div className="tk-note-block">
                    <h4>Submissions</h4>
                    <ul className="tp-list">
                      <li>
                        <span>Received</span>
                        <strong>{selected.submissions_count}</strong>
                      </li>
                      <li>
                        <span>Graded</span>
                        <strong>{selected.graded_count}</strong>
                      </li>
                      <li>
                        <span>Awaiting marks</span>
                        <strong>{selected.pending_count}</strong>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="tp-actions">
                  <Button size="sm" type="button" variant="secondary" onClick={() => startEdit(selected)}>
                    Edit
                  </Button>
                  <Button size="sm" type="button" variant="primary" onClick={() => void openGrading(selected)}>
                    Grade submissions
                  </Button>
                  <ConfirmButton
                    size="sm"
                    variant="danger"
                    tone="danger"
                    title={`Delete ${copy.noun}?`}
                    message={`“${selected.title_en}” and any marks recorded against it will be permanently removed.`}
                    confirmLabel="Delete"
                    onConfirm={() => removeAssignment(selected)}
                  >
                    Delete
                  </ConfirmButton>
                </div>
              </Panel>
            ) : (
              <Panel title={`${kind === 'homework' ? 'Homework' : 'Assignment'} detail`}>
                <EmptyState
                  title="Nothing selected"
                  message={`Choose ${copy.article} ${copy.noun} from the list to read the brief and grade submissions.`}
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
