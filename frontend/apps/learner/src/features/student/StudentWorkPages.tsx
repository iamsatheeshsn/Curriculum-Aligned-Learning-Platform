import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import {
  Button,
  FormActions,
  PaginationBar,
  Panel,
  StatStrip,
  TextAreaField,
  useClientPagination,
  useFeedback,
  validateFormFields,
} from '@stemora/ui';
import {
  LEARNER_API,
  LearnerShell,
  STUDENT_API,
  StatusPill,
  formatDate,
  formatWhen,
} from '../shared/shared';

type HomeworkInner = {
  id: number;
  title_en?: string;
  title_ar?: string;
  due_at?: string | null;
  status?: string;
  assignment_kind?: string | null;
  instructions_en?: string | null;
  allow_late?: boolean;
};

type SubmissionInner = {
  id?: number;
  status?: string;
  body_text?: string | null;
  submitted_at?: string | null;
  is_late?: boolean;
  score?: number | string | null;
};

type HomeworkRow = {
  id?: number;
  title_en?: string;
  due_at?: string | null;
  status?: string;
  assignment_kind?: string | null;
  homework?: HomeworkInner;
  submission?: SubmissionInner | null;
};

type AssessmentInner = {
  id: number;
  type?: string;
  title_en?: string;
  title_ar?: string;
  available_from?: string | null;
  available_until?: string | null;
  max_attempts?: number | null;
  time_limit_seconds?: number | null;
};

type AttemptInner = {
  id?: number;
  status?: string;
  score?: number | string | null;
  submitted_at?: string | null;
  started_at?: string | null;
};

type AssessmentRow = {
  id?: number;
  type?: string;
  title_en?: string;
  assessment?: AssessmentInner;
  attempts?: AttemptInner[] | { data?: AttemptInner[] };
};

type ResultRow = {
  id: number;
  status?: string;
  score?: number | string | null;
  percentage?: number | string | null;
  submitted_at?: string | null;
  assessment?: { id?: number; title_en?: string; type?: string } | null;
};

type ProgressSummary = {
  learning?: {
    id?: number;
    status?: string;
    progress_percent?: number | string | null;
    updated_at?: string | null;
    lesson?: { title_en?: string } | null;
  }[];
  assessments?: ResultRow[];
  avg_lesson_progress?: number;
};

type CertificateRow = {
  id: number;
  title_en?: string;
  title?: string;
  issued_at?: string | null;
  certificate_number?: string | null;
  status?: string;
};

function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: T[] }).data;
  }
  return [];
}

function homeworkOf(row: HomeworkRow): HomeworkInner {
  if (row.homework) return row.homework;
  return {
    id: row.id ?? 0,
    title_en: row.title_en,
    due_at: row.due_at,
    status: row.status,
    assignment_kind: row.assignment_kind,
  };
}

function assessmentOf(row: AssessmentRow): AssessmentInner {
  if (row.assessment) return row.assessment;
  return {
    id: row.id ?? 0,
    type: row.type,
    title_en: row.title_en,
  };
}

function attemptsOf(row: AssessmentRow): AttemptInner[] {
  const a = row.attempts;
  if (Array.isArray(a)) return a;
  if (a && typeof a === 'object' && Array.isArray(a.data)) return a.data;
  return [];
}

async function loadHomework(api: { get: <T>(url: string) => Promise<T> }) {
  const res = await api.get<{ data?: HomeworkRow[] } | HomeworkRow[]>(`${STUDENT_API}/homework`);
  return unwrapList<HomeworkRow>(res && typeof res === 'object' && 'data' in res ? res.data : res);
}

async function loadAssessments(api: { get: <T>(url: string) => Promise<T> }) {
  const res = await api.get<{ data?: AssessmentRow[] } | AssessmentRow[]>(`${STUDENT_API}/assessments`);
  return unwrapList<AssessmentRow>(res && typeof res === 'object' && 'data' in res ? res.data : res);
}

function HomeworkWorkspace({
  title,
  eyebrow,
  lead,
  filter,
  emptyLabel,
}: {
  title: string;
  eyebrow: string;
  lead: string;
  filter?: (row: HomeworkRow) => boolean;
  emptyLabel: string;
}) {
  const { tenantSlug = 'al-noor' } = useParams();
  const { api } = useAuth();
  const feedback = useFeedback();
  const [rows, setRows] = useState<HomeworkRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [bodyText, setBodyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let items = await loadHomework(api);
      if (filter) items = items.filter(filter);
      setRows(items);
      setSelectedId((cur) => {
        if (cur != null && items.some((r) => homeworkOf(r).id === cur)) return cur;
        return items[0] ? homeworkOf(items[0]).id : null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load work items.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [api, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = rows.find((r) => homeworkOf(r).id === selectedId) ?? null;
  const listPage = useClientPagination(rows);

  useEffect(() => {
    setBodyText(selected?.submission?.body_text ?? '');
  }, [selected]);

  const submitted = rows.filter((r) =>
    ['submitted', 'graded'].includes((r.submission?.status || '').toLowerCase()),
  ).length;
  const open = rows.length - submitted;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected || !validateFormFields(e.currentTarget)) return;
    const hw = homeworkOf(selected);
    setBusy(true);
    try {
      await api.post(`${LEARNER_API}/homework/${hw.id}/submit`, { body_text: bodyText.trim() });
      await feedback.success({ title: 'Submitted', message: 'Your work was submitted.' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <LearnerShell
      title={title}
      subtitle="Due dates and submissions"
      mode="student"
      headerActions={
        <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      }
    >
      <div className="lp-page">
        <section className="lp-hero stem-animate-rise">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">{eyebrow}</p>
            <h2 className="lp-hero-title">{title}</h2>
            <p className="lp-hero-lead">{lead}</p>
            <div className="lp-chip-row">
              <span className="lp-chip">{rows.length} items</span>
              <span className="lp-chip">{open} open</span>
            </div>
          </div>
          <div className="lp-hero-actions">
            <Button size="sm" to={`/${tenantSlug}/student/results`} variant="secondary">
              Results
            </Button>
          </div>
        </section>
        {error ? <div className="lp-alert">{error}</div> : null}
        <StatStrip
          items={[
            { label: 'Total', value: loading ? '—' : String(rows.length) },
            { label: 'Open', value: loading ? '—' : String(open) },
            { label: 'Submitted', value: loading ? '—' : String(submitted) },
          ]}
        />
        <div className="lp-layout">
          <Panel title="Work list" description="Select an item to review or submit.">
            <div className="lp-table-wrap">
              <table className="lp-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Due</th>
                    <th>Kind</th>
                    <th>Submission</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="lp-empty">
                        {loading ? 'Loading…' : emptyLabel}
                      </td>
                    </tr>
                  ) : (
                    listPage.pageItems.map((row) => {
                      const hw = homeworkOf(row);
                      return (
                        <tr
                          key={hw.id}
                          className={selectedId === hw.id ? 'is-selected' : undefined}
                          onClick={() => setSelectedId(hw.id)}
                        >
                          <td>{hw.title_en || `Item ${hw.id}`}</td>
                          <td>{formatDate(hw.due_at)}</td>
                          <td>{hw.assignment_kind || 'homework'}</td>
                          <td>
                            <StatusPill status={row.submission?.status || 'pending'} />
                          </td>
                        </tr>
                      );
                    })
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
          <aside className="lp-side">
            <Panel title="Submit work">
              {!selected ? (
                <p className="lp-muted">Select an item.</p>
              ) : (
                <form className="lp-form" onSubmit={onSubmit} noValidate>
                  <div className="lp-detail-head">
                    <div className="lp-detail-mark">HW</div>
                    <div>
                      <h3>{homeworkOf(selected).title_en}</h3>
                      <p>Due {formatWhen(homeworkOf(selected).due_at)}</p>
                    </div>
                  </div>
                  <dl className="lp-meta">
                    <div>
                      <dt>Kind</dt>
                      <dd>{homeworkOf(selected).assignment_kind || 'homework'}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <StatusPill status={selected.submission?.status || 'pending'} />
                      </dd>
                    </div>
                    {selected.submission?.submitted_at ? (
                      <div>
                        <dt>Submitted</dt>
                        <dd>{formatWhen(selected.submission.submitted_at)}</dd>
                      </div>
                    ) : null}
                  </dl>
                  {homeworkOf(selected).instructions_en ? (
                    <p className="lp-muted">{homeworkOf(selected).instructions_en}</p>
                  ) : null}
                  <TextAreaField
                    label="Your answer"
                    rows={6}
                    required
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    placeholder="Write your submission…"
                  />
                  <FormActions>
                    <Button size="sm" type="submit" variant="primary" disabled={busy}>
                      {busy ? 'Submitting…' : 'Submit'}
                    </Button>
                  </FormActions>
                </form>
              )}
            </Panel>
          </aside>
        </div>
      </div>
    </LearnerShell>
  );
}

export function StudentHomeworkPage() {
  const filter = useCallback((row: HomeworkRow) => {
    const kind = (homeworkOf(row).assignment_kind || 'homework').toLowerCase();
    return kind === 'homework' || !homeworkOf(row).assignment_kind;
  }, []);

  return (
    <HomeworkWorkspace
      title="Homework"
      eyebrow="Student portal · Homework"
      lead="Complete published homework before the due date and keep an eye on submission status."
      filter={filter}
      emptyLabel="No homework assigned yet."
    />
  );
}

export function StudentAssignmentsPage() {
  const filter = useCallback((row: HomeworkRow) => {
    const kind = homeworkOf(row).assignment_kind;
    if (!kind) return true;
    return kind.toLowerCase() !== 'homework';
  }, []);

  return (
    <HomeworkWorkspace
      title="Assignments"
      eyebrow="Student portal · Assignments"
      lead="Broader assignments beyond standard homework — labelled by assignment kind when available."
      filter={filter}
      emptyLabel="No assignments found."
    />
  );
}

function AssessmentWorkspace({
  title,
  eyebrow,
  lead,
  typeFilter,
  emptyLabel,
}: {
  title: string;
  eyebrow: string;
  lead: string;
  typeFilter: 'quiz' | 'exam';
  emptyLabel: string;
}) {
  const { tenantSlug = 'al-noor' } = useParams();
  const { api } = useAuth();
  const feedback = useFeedback();
  const [rows, setRows] = useState<AssessmentRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = (await loadAssessments(api)).filter(
        (r) => (assessmentOf(r).type || '').toLowerCase() === typeFilter,
      );
      setRows(items);
      setSelectedId((cur) => {
        if (cur != null && items.some((r) => assessmentOf(r).id === cur)) return cur;
        return items[0] ? assessmentOf(items[0]).id : null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assessments.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [api, typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = rows.find((r) => assessmentOf(r).id === selectedId) ?? null;
  const withAttempts = rows.filter((r) => attemptsOf(r).length > 0).length;
  const listPage = useClientPagination(rows);

  async function startAssessment(id: number) {
    setBusy(true);
    try {
      const res = await api.post<{ data?: { id?: number }; message?: string }>(
        `${LEARNER_API}/assessments/${id}/start`,
        {},
      );
      const attemptId = res.data?.id;
      await feedback.success({
        title: 'Attempt started',
        message: attemptId ? `Attempt #${attemptId} is ready.` : 'Your attempt has been started.',
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start assessment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <LearnerShell
      title={title}
      subtitle="Published assessments"
      mode="student"
      headerActions={
        <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      }
    >
      <div className="lp-page">
        <section className="lp-hero stem-animate-rise">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">{eyebrow}</p>
            <h2 className="lp-hero-title">{title}</h2>
            <p className="lp-hero-lead">{lead}</p>
            <div className="lp-chip-row">
              <span className="lp-chip">{rows.length} available</span>
              <span className="lp-chip">{withAttempts} with attempts</span>
            </div>
          </div>
          <div className="lp-hero-actions">
            <Button size="sm" to={`/${tenantSlug}/student/results`} variant="secondary">
              View results
            </Button>
          </div>
        </section>
        {error ? <div className="lp-alert">{error}</div> : null}
        <StatStrip
          items={[
            { label: 'Available', value: loading ? '—' : String(rows.length) },
            { label: 'Started', value: loading ? '—' : String(withAttempts) },
            {
              label: 'Type',
              value: typeFilter === 'quiz' ? 'Quiz' : 'Exam',
            },
          ]}
        />
        <div className="lp-layout">
          <Panel title={`${title} list`} description="Select an item to start an attempt.">
            <div className="lp-table-wrap">
              <table className="lp-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Window</th>
                    <th>Attempts</th>
                    <th>Limit</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="lp-empty">
                        {loading ? 'Loading…' : emptyLabel}
                      </td>
                    </tr>
                  ) : (
                    listPage.pageItems.map((row) => {
                      const a = assessmentOf(row);
                      const attempts = attemptsOf(row);
                      return (
                        <tr
                          key={a.id}
                          className={selectedId === a.id ? 'is-selected' : undefined}
                          onClick={() => setSelectedId(a.id)}
                        >
                          <td>{a.title_en || `Assessment ${a.id}`}</td>
                          <td>
                            {formatDate(a.available_from)} → {formatDate(a.available_until)}
                          </td>
                          <td>{attempts.length}</td>
                          <td>{a.max_attempts ?? '—'}</td>
                        </tr>
                      );
                    })
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
          <aside className="lp-side">
            <Panel title="Assessment detail">
              {!selected ? (
                <p className="lp-muted">Select an assessment.</p>
              ) : (
                <>
                  <div className="lp-detail-head">
                    <div className="lp-detail-mark">{typeFilter === 'quiz' ? 'Q' : 'E'}</div>
                    <div>
                      <h3>{assessmentOf(selected).title_en}</h3>
                      <p>
                        <StatusPill status={assessmentOf(selected).type || typeFilter} />
                      </p>
                    </div>
                  </div>
                  <dl className="lp-meta">
                    <div>
                      <dt>Time limit</dt>
                      <dd>
                        {assessmentOf(selected).time_limit_seconds
                          ? `${Math.round(Number(assessmentOf(selected).time_limit_seconds) / 60)} min`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Max attempts</dt>
                      <dd>{assessmentOf(selected).max_attempts ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Your attempts</dt>
                      <dd>{attemptsOf(selected).length}</dd>
                    </div>
                  </dl>
                  {attemptsOf(selected).length > 0 ? (
                    <ul className="lp-list">
                      {attemptsOf(selected)
                        .slice(0, 5)
                        .map((att, idx) => (
                          <li key={att.id ?? idx}>
                            <div>
                              <strong>Attempt {att.id ?? idx + 1}</strong>
                              <span>
                                {att.score != null ? `Score ${att.score}` : 'No score'} ·{' '}
                                {formatWhen(att.submitted_at || att.started_at)}
                              </span>
                            </div>
                            {att.status ? <StatusPill status={att.status} /> : null}
                          </li>
                        ))}
                    </ul>
                  ) : null}
                  <div className="lp-actions">
                    <Button
                      size="sm"
                      type="button"
                      variant="primary"
                      disabled={busy}
                      onClick={() => void startAssessment(assessmentOf(selected).id)}
                    >
                      {busy ? 'Starting…' : 'Start attempt'}
                    </Button>
                  </div>
                </>
              )}
            </Panel>
          </aside>
        </div>
      </div>
    </LearnerShell>
  );
}

export function StudentQuizzesPage() {
  return (
    <AssessmentWorkspace
      title="Quizzes"
      eyebrow="Student portal · Quizzes"
      lead="Start published quizzes and review your previous attempts."
      typeFilter="quiz"
      emptyLabel="No quizzes available."
    />
  );
}

export function StudentExamsPage() {
  return (
    <AssessmentWorkspace
      title="Exams"
      eyebrow="Student portal · Exams"
      lead="Timed exams published by your school — start when you are ready."
      typeFilter="exam"
      emptyLabel="No exams available."
    />
  );
}

export function StudentResultsPage() {
  const { tenantSlug = 'al-noor' } = useParams();
  const { api } = useAuth();
  const [results, setResults] = useState<ResultRow[]>([]);
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [resultsRes, progressRes] = await Promise.allSettled([
        api.get<{ data?: ResultRow[] } | ResultRow[]>(`${LEARNER_API}/results`),
        api.get<{ data?: ProgressSummary }>(`${STUDENT_API}/progress`),
      ]);

      let nextResults: ResultRow[] = [];
      if (resultsRes.status === 'fulfilled') {
        const payload = resultsRes.value;
        nextResults = unwrapList<ResultRow>(
          payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload,
        );
      }

      if (progressRes.status === 'fulfilled') {
        const summaryData = progressRes.value.data ?? null;
        setSummary(summaryData);
        if (nextResults.length === 0 && summaryData?.assessments?.length) {
          nextResults = summaryData.assessments;
        }
      }

      setResults(nextResults);

      if (resultsRes.status === 'rejected' && progressRes.status === 'rejected') {
        const reason = resultsRes.reason;
        throw reason instanceof Error ? reason : new Error('Failed to load results.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load results.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const graded = results.filter((r) => (r.status || '').toLowerCase() === 'graded').length;
  const learning = summary?.learning ?? [];
  const listPage = useClientPagination(results);

  return (
    <LearnerShell
      title="Results"
      subtitle="Assessment outcomes and lesson progress"
      mode="student"
      headerActions={
        <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      }
    >
      <div className="lp-page">
        <section className="lp-hero stem-animate-rise">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">Student portal · Results</p>
            <h2 className="lp-hero-title">Results</h2>
            <p className="lp-hero-lead">Review graded attempts and recent lesson progress in one view.</p>
            <div className="lp-chip-row">
              <span className="lp-chip">{results.length} attempts</span>
              {summary?.avg_lesson_progress != null ? (
                <span className="lp-chip">Avg lesson {summary.avg_lesson_progress}%</span>
              ) : null}
            </div>
          </div>
          <div className="lp-hero-actions">
            <Button size="sm" to={`/${tenantSlug}/student/certificates`} variant="secondary">
              Certificates
            </Button>
          </div>
        </section>
        {error ? <div className="lp-alert">{error}</div> : null}
        <StatStrip
          items={[
            { label: 'Attempts', value: loading ? '—' : String(results.length) },
            { label: 'Graded', value: loading ? '—' : String(graded) },
            {
              label: 'Avg lesson',
              value: loading ? '—' : `${summary?.avg_lesson_progress ?? 0}%`,
            },
            { label: 'Lesson rows', value: loading ? '—' : String(learning.length) },
          ]}
        />
        <div className="lp-layout">
          <Panel title="Assessment results" description="Submitted and graded attempts.">
            <div className="lp-table-wrap">
              <table className="lp-table">
                <thead>
                  <tr>
                    <th>Assessment</th>
                    <th>Type</th>
                    <th>Score</th>
                    <th>Status</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {results.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="lp-empty">
                        {loading ? 'Loading…' : 'No results yet.'}
                      </td>
                    </tr>
                  ) : (
                    listPage.pageItems.map((row) => (
                      <tr key={row.id}>
                        <td>{row.assessment?.title_en || `Attempt ${row.id}`}</td>
                        <td>{row.assessment?.type || '—'}</td>
                        <td>
                          {row.score ?? row.percentage ?? '—'}
                          {row.percentage != null && row.score == null ? '%' : ''}
                        </td>
                        <td>
                          <StatusPill status={row.status || 'submitted'} />
                        </td>
                        <td>{formatWhen(row.submitted_at)}</td>
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
          <aside className="lp-side">
            <Panel title="Lesson progress">
              {learning.length === 0 ? (
                <p className="lp-empty">{loading ? 'Loading…' : 'No lesson progress yet.'}</p>
              ) : (
                <ul className="lp-list">
                  {learning.slice(0, 8).map((row, idx) => (
                    <li key={row.id ?? idx}>
                      <div>
                        <strong>{row.lesson?.title_en || 'Lesson'}</strong>
                        <span>
                          {row.progress_percent != null ? `${row.progress_percent}%` : '—'} ·{' '}
                          {formatWhen(row.updated_at)}
                        </span>
                      </div>
                      {row.status ? <StatusPill status={row.status} /> : null}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </aside>
        </div>
      </div>
    </LearnerShell>
  );
}

export function StudentCertificatesPage() {
  const { api } = useAuth();
  const [rows, setRows] = useState<CertificateRow[]>([]);
  const listPage = useClientPagination(rows);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data?: CertificateRow[] } | CertificateRow[]>(`${STUDENT_API}/certificates`);
      const items = unwrapList<CertificateRow>(
        res && typeof res === 'object' && 'data' in res ? res.data : res,
      );
      setRows(items);
      setSelectedId((cur) => cur ?? items[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load certificates.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const thisYear = useMemo(() => {
    const y = new Date().getFullYear();
    return rows.filter((r) => (r.issued_at ? new Date(r.issued_at).getFullYear() === y : false)).length;
  }, [rows]);
  return (
    <LearnerShell
      title="Certificates"
      subtitle="Issued credentials"
      mode="student"
      headerActions={
        <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      }
    >
      <div className="lp-page">
        <section className="lp-hero stem-animate-rise">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">Student portal · Certificates</p>
            <h2 className="lp-hero-title">Certificates</h2>
            <p className="lp-hero-lead">View certificates issued for completed learning milestones.</p>
            <div className="lp-chip-row">
              <span className="lp-chip">{rows.length} issued</span>
              <span className="lp-chip">{thisYear} this year</span>
            </div>
          </div>
        </section>
        {error ? <div className="lp-alert">{error}</div> : null}
        <StatStrip
          items={[
            { label: 'Total', value: loading ? '—' : String(rows.length) },
            { label: 'This year', value: loading ? '—' : String(thisYear) },
          ]}
        />
        <div className="lp-layout">
          <Panel title="Certificate list">
            <div className="lp-table-wrap">
              <table className="lp-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Number</th>
                    <th>Issued</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="lp-empty">
                        {loading ? 'Loading…' : 'No certificates issued yet.'}
                      </td>
                    </tr>
                  ) : (
                    listPage.pageItems.map((row) => (
                      <tr
                        key={row.id}
                        className={selectedId === row.id ? 'is-selected' : undefined}
                        onClick={() => setSelectedId(row.id)}
                      >
                        <td>{row.title_en || row.title || `Certificate ${row.id}`}</td>
                        <td>{row.certificate_number || '—'}</td>
                        <td>{formatDate(row.issued_at)}</td>
                        <td>
                          <StatusPill status={row.status || 'issued'} />
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
          <aside className="lp-side">
            <Panel title="Certificate detail">
              {!selected ? (
                <p className="lp-muted">Select a certificate.</p>
              ) : (
                <dl className="lp-meta">
                  <div>
                    <dt>Title</dt>
                    <dd>{selected.title_en || selected.title || '—'}</dd>
                  </div>
                  <div>
                    <dt>Number</dt>
                    <dd>{selected.certificate_number || '—'}</dd>
                  </div>
                  <div>
                    <dt>Issued</dt>
                    <dd>{formatWhen(selected.issued_at)}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>
                      <StatusPill status={selected.status || 'issued'} />
                    </dd>
                  </div>
                </dl>
              )}
            </Panel>
          </aside>
        </div>
      </div>
    </LearnerShell>
  );
}
