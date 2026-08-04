import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import {
  Button,
  FormActions,
  PaginationBar,
  Panel,
  SelectField,
  StatStrip,
  TextField,
  useClientPagination,
  useFeedback,
  validateFormFields,
} from '@stemora/ui';
import {
  LEARNER_API,
  LearnerShell,
  STUDENT_API,
  StatusPill,
  formatWhen,
} from '../shared/shared';

export type CourseRow = {
  id: number;
  code?: string;
  name_en?: string;
  name_ar?: string;
  is_stem?: boolean;
  lessons_total?: number;
  lessons_completed?: number;
  progress_percent?: number;
};

type LessonBlock = { block_type?: string; type?: string };

type LessonInner = {
  id: number;
  title_en?: string;
  title_ar?: string;
  status?: string;
  blocks?: LessonBlock[];
  curriculum_lesson?: { title_en?: string } | null;
};

type ProgressInner = {
  id?: number;
  status?: string;
  progress_percent?: number | string | null;
  updated_at?: string | null;
};

export type LessonRow = {
  id?: number;
  title_en?: string;
  blocks?: LessonBlock[];
  lesson?: LessonInner;
  progress?: ProgressInner | null;
};

function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: T[] }).data;
  }
  return [];
}

function lessonOf(row: LessonRow): LessonInner {
  if (row.lesson) return row.lesson;
  return {
    id: row.id ?? 0,
    title_en: row.title_en,
    blocks: row.blocks,
  };
}

function lessonTitle(row: LessonRow) {
  const lesson = lessonOf(row);
  return lesson.title_en || lesson.curriculum_lesson?.title_en || `Lesson ${lesson.id}`;
}

function lessonBlocks(row: LessonRow): LessonBlock[] {
  const lesson = lessonOf(row);
  return lesson.blocks ?? row.blocks ?? [];
}

function hasLabBlock(row: LessonRow) {
  return lessonBlocks(row).some((b) => {
    const t = (b.block_type || b.type || '').toLowerCase();
    return t === 'virtual_lab' || t === 'simulation';
  });
}

function progressPct(row: LessonRow) {
  const p = row.progress?.progress_percent;
  if (p == null || p === '') return 0;
  return Number(p) || 0;
}

async function loadCourses(api: { get: <T>(url: string) => Promise<T> }) {
  const res = await api.get<{ data?: CourseRow[] } | CourseRow[]>(`${STUDENT_API}/courses`);
  return unwrapList<CourseRow>(res && typeof res === 'object' && 'data' in res ? res.data : res);
}

async function loadLessons(api: { get: <T>(url: string) => Promise<T> }) {
  const res = await api.get<{ data?: LessonRow[] } | LessonRow[]>(`${STUDENT_API}/lessons`);
  return unwrapList<LessonRow>(res && typeof res === 'object' && 'data' in res ? res.data : res);
}

function CoursesGrid({
  courses,
  loading,
  emptyLabel,
  tenantSlug,
}: {
  courses: CourseRow[];
  loading: boolean;
  emptyLabel: string;
  tenantSlug: string;
}) {
  if (courses.length === 0) {
    return <p className="lp-empty">{loading ? 'Loading…' : emptyLabel}</p>;
  }
  return (
    <div className="lp-cards">
      {courses.map((c) => {
        const pct = Number(c.progress_percent ?? 0);
        return (
          <article key={c.id} className="lp-card">
            <div className="lp-chip-row" style={{ marginTop: 0 }}>
              {c.code ? <span className="lp-chip">{c.code}</span> : null}
              {c.is_stem ? <span className="lp-chip">STEM</span> : null}
            </div>
            <h3>{c.name_en || `Subject ${c.id}`}</h3>
            <p>
              {c.lessons_completed ?? 0} / {c.lessons_total ?? 0} lessons · {pct}%
            </p>
            <div className="lp-progress" aria-hidden>
              <span style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
            </div>
            <div className="lp-actions">
              <Button size="sm" to={`/${tenantSlug}/student/lessons`} variant="secondary">
                Open lessons
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function StudentCoursesPage() {
  const { tenantSlug = 'al-noor' } = useParams();
  const { api } = useAuth();
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCourses(await loadCourses(api));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load courses.');
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const avg =
    courses.length > 0
      ? Math.round(courses.reduce((sum, c) => sum + Number(c.progress_percent ?? 0), 0) / courses.length)
      : 0;
  const stemCount = courses.filter((c) => c.is_stem).length;

  return (
    <LearnerShell
      title="My Courses"
      subtitle="Subjects and learning progress"
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
            <p className="lp-eyebrow">Student portal · Learning</p>
            <h2 className="lp-hero-title">My courses</h2>
            <p className="lp-hero-lead">Track progress across enrolled subjects and jump into lessons when you are ready.</p>
            <div className="lp-chip-row">
              <span className="lp-chip">{courses.length} subjects</span>
              <span className="lp-chip">{stemCount} STEM</span>
            </div>
          </div>
          <div className="lp-hero-actions">
            <Button size="sm" to={`/${tenantSlug}/student/subjects`} variant="secondary">
              Subjects list
            </Button>
            <Button size="sm" to={`/${tenantSlug}/student/stem`} variant="secondary">
              STEM activities
            </Button>
          </div>
        </section>
        {error ? <div className="lp-alert">{error}</div> : null}
        <StatStrip
          items={[
            { label: 'Subjects', value: loading ? '—' : String(courses.length) },
            { label: 'Avg progress', value: loading ? '—' : `${avg}%` },
            { label: 'STEM', value: loading ? '—' : String(stemCount) },
          ]}
        />
        <div className="lp-layout">
          <Panel title="Course cards" description="Progress by subject.">
            <CoursesGrid
              courses={courses}
              loading={loading}
              emptyLabel="No courses available yet."
              tenantSlug={tenantSlug}
            />
          </Panel>
          <aside className="lp-side">
            <Panel title="Tips">
              <p className="lp-muted">
                Progress updates when you mark lessons complete. Open Lessons to continue where you left off.
              </p>
              <div className="lp-actions">
                <Button size="sm" to={`/${tenantSlug}/student/lessons`} variant="primary">
                  Continue learning
                </Button>
              </div>
            </Panel>
          </aside>
        </div>
      </div>
    </LearnerShell>
  );
}

export function StudentSubjectsPage() {
  const { tenantSlug = 'al-noor' } = useParams();
  const { api } = useAuth();
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await loadCourses(api);
      setCourses(rows);
      setSelectedId((cur) => cur ?? rows[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subjects.');
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = courses.find((c) => c.id === selectedId) ?? null;
  const withLessons = courses.filter((c) => (c.lessons_total ?? 0) > 0).length;
  const listPage = useClientPagination(courses);

  return (
    <LearnerShell
      title="Subjects"
      subtitle="Subject directory and progress"
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
            <p className="lp-eyebrow">Student portal · Subjects</p>
            <h2 className="lp-hero-title">Subjects</h2>
            <p className="lp-hero-lead">Browse every active subject and see how far you have progressed through its lessons.</p>
          </div>
          <div className="lp-hero-actions">
            <Button size="sm" to={`/${tenantSlug}/student/courses`} variant="secondary">
              Course cards
            </Button>
          </div>
        </section>
        {error ? <div className="lp-alert">{error}</div> : null}
        <StatStrip
          items={[
            { label: 'Subjects', value: loading ? '—' : String(courses.length) },
            { label: 'With lessons', value: loading ? '—' : String(withLessons) },
            { label: 'STEM', value: loading ? '—' : String(courses.filter((c) => c.is_stem).length) },
          ]}
        />
        <div className="lp-layout">
          <Panel title="Subject list" description="Select a row for details.">
            <div className="lp-table-wrap">
              <table className="lp-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Subject</th>
                    <th>Progress</th>
                    <th>STEM</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="lp-empty">
                        {loading ? 'Loading…' : 'No subjects found.'}
                      </td>
                    </tr>
                  ) : (
                    listPage.pageItems.map((c) => (
                      <tr
                        key={c.id}
                        className={selectedId === c.id ? 'is-selected' : undefined}
                        onClick={() => setSelectedId(c.id)}
                      >
                        <td>{c.code || '—'}</td>
                        <td>{c.name_en || `Subject ${c.id}`}</td>
                        <td>
                          {c.lessons_completed ?? 0}/{c.lessons_total ?? 0} ({c.progress_percent ?? 0}%)
                        </td>
                        <td>{c.is_stem ? 'Yes' : '—'}</td>
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
            <Panel title="Subject detail">
              {!selected ? (
                <p className="lp-muted">Select a subject.</p>
              ) : (
                <>
                  <div className="lp-detail-head">
                    <div className="lp-detail-mark">{(selected.code || 'S').slice(0, 2)}</div>
                    <div>
                      <h3>{selected.name_en}</h3>
                      <p>{selected.code || 'No code'}</p>
                    </div>
                  </div>
                  <dl className="lp-meta">
                    <div>
                      <dt>Lessons</dt>
                      <dd>
                        {selected.lessons_completed ?? 0} / {selected.lessons_total ?? 0}
                      </dd>
                    </div>
                    <div>
                      <dt>Progress</dt>
                      <dd>{selected.progress_percent ?? 0}%</dd>
                    </div>
                    <div>
                      <dt>STEM</dt>
                      <dd>{selected.is_stem ? 'Yes' : 'No'}</dd>
                    </div>
                  </dl>
                  <div className="lp-progress" aria-hidden>
                    <span
                      style={{
                        width: `${Math.min(100, Math.max(0, Number(selected.progress_percent ?? 0)))}%`,
                      }}
                    />
                  </div>
                  <div className="lp-actions">
                    <Button size="sm" to={`/${tenantSlug}/student/lessons`} variant="primary">
                      View lessons
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

export function StudentLessonsPage() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [rows, setRows] = useState<LessonRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [percent, setPercent] = useState('50');
  const [status, setStatus] = useState('in_progress');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await loadLessons(api);
      setRows(items);
      setSelectedId((cur) => {
        if (cur != null && items.some((r) => lessonOf(r).id === cur)) return cur;
        return items[0] ? lessonOf(items[0]).id : null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lessons.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = rows.find((r) => lessonOf(r).id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) return;
    setPercent(String(progressPct(selected) || 50));
    setStatus(selected.progress?.status || 'in_progress');
  }, [selected]);

  const completed = rows.filter((r) => (r.progress?.status || '').toLowerCase() === 'completed').length;
  const inProgress = rows.filter((r) => (r.progress?.status || '').toLowerCase() === 'in_progress').length;
  const listPage = useClientPagination(rows);

  async function saveProgress(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected || !validateFormFields(e.currentTarget)) return;
    const lessonId = lessonOf(selected).id;
    setBusy(true);
    try {
      await api.post(`${LEARNER_API}/lessons/${lessonId}/progress`, {
        progress_percent: Number(percent),
        status,
      });
      await feedback.success({ title: 'Progress saved', message: 'Lesson progress was updated.' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update progress.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <LearnerShell
      title="Lessons"
      subtitle="Assigned interactive lessons"
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
            <p className="lp-eyebrow">Student portal · Lessons</p>
            <h2 className="lp-hero-title">Lessons</h2>
            <p className="lp-hero-lead">Open an assigned lesson and mark how far you have progressed.</p>
            <div className="lp-chip-row">
              <span className="lp-chip">{rows.length} assigned</span>
              <span className="lp-chip">{completed} completed</span>
            </div>
          </div>
        </section>
        {error ? <div className="lp-alert">{error}</div> : null}
        <StatStrip
          items={[
            { label: 'Lessons', value: loading ? '—' : String(rows.length) },
            { label: 'In progress', value: loading ? '—' : String(inProgress) },
            { label: 'Completed', value: loading ? '—' : String(completed) },
          ]}
        />
        <div className="lp-layout">
          <Panel title="Lesson list" description="Select a lesson to update progress.">
            <div className="lp-table-wrap">
              <table className="lp-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Progress</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="lp-empty">
                        {loading ? 'Loading…' : 'No lessons assigned yet.'}
                      </td>
                    </tr>
                  ) : (
                    listPage.pageItems.map((row) => {
                      const lesson = lessonOf(row);
                      return (
                        <tr
                          key={lesson.id}
                          className={selectedId === lesson.id ? 'is-selected' : undefined}
                          onClick={() => setSelectedId(lesson.id)}
                        >
                          <td>{lessonTitle(row)}</td>
                          <td>
                            {row.progress?.status ? (
                              <StatusPill status={row.progress.status} />
                            ) : (
                              <StatusPill status="not_started" />
                            )}
                          </td>
                          <td>{progressPct(row)}%</td>
                          <td>{formatWhen(row.progress?.updated_at)}</td>
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
            <Panel title="Update progress">
              {!selected ? (
                <p className="lp-muted">Select a lesson.</p>
              ) : (
                <form className="lp-form" onSubmit={saveProgress} noValidate>
                  <div className="lp-detail-head">
                    <div className="lp-detail-mark">L</div>
                    <div>
                      <h3>{lessonTitle(selected)}</h3>
                      <p>Lesson #{lessonOf(selected).id}</p>
                    </div>
                  </div>
                  <TextField
                    label="Progress %"
                    type="number"
                    min={0}
                    max={100}
                    required
                    value={percent}
                    onChange={(e) => setPercent(e.target.value)}
                  />
                  <SelectField label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="in_progress">In progress</option>
                    <option value="completed">Completed</option>
                  </SelectField>
                  <FormActions>
                    <Button size="sm" type="submit" variant="primary" disabled={busy}>
                      {busy ? 'Saving…' : 'Save progress'}
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

export function StudentStemPage() {
  const { tenantSlug = 'al-noor' } = useParams();
  const { api } = useAuth();
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await loadCourses(api);
      setCourses(rows.filter((c) => Boolean(c.is_stem)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load STEM courses.');
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const avg =
    courses.length > 0
      ? Math.round(courses.reduce((sum, c) => sum + Number(c.progress_percent ?? 0), 0) / courses.length)
      : 0;

  return (
    <LearnerShell
      title="STEM Activities"
      subtitle="STEM-flagged subjects"
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
            <p className="lp-eyebrow">Student portal · STEM</p>
            <h2 className="lp-hero-title">STEM activities</h2>
            <p className="lp-hero-lead">Subjects marked as STEM for focused science, technology, engineering, and maths practice.</p>
            <div className="lp-chip-row">
              <span className="lp-chip">{courses.length} STEM subjects</span>
            </div>
          </div>
          <div className="lp-hero-actions">
            <Button size="sm" to={`/${tenantSlug}/student/labs`} variant="secondary">
              Virtual labs
            </Button>
          </div>
        </section>
        {error ? <div className="lp-alert">{error}</div> : null}
        <StatStrip
          items={[
            { label: 'STEM subjects', value: loading ? '—' : String(courses.length) },
            { label: 'Avg progress', value: loading ? '—' : `${avg}%` },
            {
              label: 'Lessons done',
              value: loading
                ? '—'
                : String(courses.reduce((sum, c) => sum + Number(c.lessons_completed ?? 0), 0)),
            },
          ]}
        />
        <div className="lp-layout">
          <Panel title="STEM courses" description="Filtered from your course list.">
            <CoursesGrid
              courses={courses}
              loading={loading}
              emptyLabel="No STEM subjects are available yet."
              tenantSlug={tenantSlug}
            />
          </Panel>
          <aside className="lp-side">
            <Panel title="Explore">
              <p className="lp-muted">Pair STEM courses with virtual labs and simulations when your school assigns them.</p>
              <div className="lp-actions">
                <Button size="sm" to={`/${tenantSlug}/student/courses`} variant="secondary">
                  All courses
                </Button>
              </div>
            </Panel>
          </aside>
        </div>
      </div>
    </LearnerShell>
  );
}

export function StudentLabsPage() {
  const { tenantSlug = 'al-noor' } = useParams();
  const { api } = useAuth();
  const [rows, setRows] = useState<LessonRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = (await loadLessons(api)).filter(hasLabBlock);
      setRows(items);
      setSelectedId((cur) => {
        if (cur != null && items.some((r) => lessonOf(r).id === cur)) return cur;
        return items[0] ? lessonOf(items[0]).id : null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load virtual labs.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = rows.find((r) => lessonOf(r).id === selectedId) ?? null;
  const listPage = useClientPagination(rows);
  const blockTypes = useMemo(() => {
    if (!selected) return [];
    return [
      ...new Set(
        lessonBlocks(selected)
          .map((b) => b.block_type || b.type || '')
          .filter(Boolean),
      ),
    ];
  }, [selected]);

  return (
    <LearnerShell
      title="Virtual Labs"
      subtitle="Simulations and lab blocks"
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
            <p className="lp-eyebrow">Student portal · Labs</p>
            <h2 className="lp-hero-title">Virtual labs</h2>
            <p className="lp-hero-lead">
              Lessons that include virtual lab or simulation blocks for hands-on STEM practice.
            </p>
            <div className="lp-chip-row">
              <span className="lp-chip">{rows.length} lab lessons</span>
            </div>
          </div>
          <div className="lp-hero-actions">
            <Button size="sm" to={`/${tenantSlug}/student/lessons`} variant="secondary">
              All lessons
            </Button>
          </div>
        </section>
        {error ? <div className="lp-alert">{error}</div> : null}
        <StatStrip
          items={[
            { label: 'Lab lessons', value: loading ? '—' : String(rows.length) },
            {
              label: 'Completed',
              value: loading
                ? '—'
                : String(rows.filter((r) => (r.progress?.status || '').toLowerCase() === 'completed').length),
            },
            {
              label: 'In progress',
              value: loading
                ? '—'
                : String(rows.filter((r) => (r.progress?.status || '').toLowerCase() === 'in_progress').length),
            },
          ]}
        />
        <div className="lp-layout">
          <Panel title="Lab lessons" description="Filtered by virtual_lab or simulation blocks.">
            <div className="lp-table-wrap">
              <table className="lp-table">
                <thead>
                  <tr>
                    <th>Lesson</th>
                    <th>Blocks</th>
                    <th>Status</th>
                    <th>Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="lp-empty">
                        {loading ? 'Loading…' : 'No virtual lab lessons found.'}
                      </td>
                    </tr>
                  ) : (
                    listPage.pageItems.map((row) => {
                      const lesson = lessonOf(row);
                      const types = lessonBlocks(row)
                        .map((b) => b.block_type || b.type)
                        .filter(Boolean)
                        .join(', ');
                      return (
                        <tr
                          key={lesson.id}
                          className={selectedId === lesson.id ? 'is-selected' : undefined}
                          onClick={() => setSelectedId(lesson.id)}
                        >
                          <td>{lessonTitle(row)}</td>
                          <td>{types || '—'}</td>
                          <td>
                            <StatusPill status={row.progress?.status || 'not_started'} />
                          </td>
                          <td>{progressPct(row)}%</td>
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
            <Panel title="Lab detail">
              {!selected ? (
                <p className="lp-muted">Select a lab lesson.</p>
              ) : (
                <>
                  <div className="lp-detail-head">
                    <div className="lp-detail-mark">VL</div>
                    <div>
                      <h3>{lessonTitle(selected)}</h3>
                      <p>Lesson #{lessonOf(selected).id}</p>
                    </div>
                  </div>
                  <dl className="lp-meta">
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <StatusPill status={selected.progress?.status || 'not_started'} />
                      </dd>
                    </div>
                    <div>
                      <dt>Progress</dt>
                      <dd>{progressPct(selected)}%</dd>
                    </div>
                    <div>
                      <dt>Blocks</dt>
                      <dd>{blockTypes.join(', ') || '—'}</dd>
                    </div>
                  </dl>
                  <div className="lp-actions">
                    <Button size="sm" to={`/${tenantSlug}/student/lessons`} variant="primary">
                      Update in Lessons
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
