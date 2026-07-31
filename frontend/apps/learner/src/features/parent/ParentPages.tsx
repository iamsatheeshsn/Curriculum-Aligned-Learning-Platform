import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import {
  Button,
  FormActions,
  Panel,
  SelectField,
  StatStrip,
  TextField,
  useFeedback,
  useResolvedTenant,
  validateFormFields,
  exportPdfDocument,
  tableHtml,
  kpiHtml,
} from '@stemora/ui';
import {
  ChildPicker,
  LearnerShell,
  PARENT_API,
  StatusPill,
  formatDate,
  formatMoney,
  formatWhen,
  personName,
  useParentChildren,
} from '../shared/shared';

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: T[] }).data;
  }
  return [];
}

function childLabel(c: { first_name?: string | null; last_name?: string | null; email?: string | null } | null) {
  if (!c) return 'Child';
  return personName(c.first_name, c.last_name, c.email);
}

function ChildGate({
  kidsLoading,
  kidsError,
  childrenCount,
  children,
  selectedId,
  setChildId,
  onRetry,
}: {
  kidsLoading: boolean;
  kidsError: string | null;
  childrenCount: number;
  children: Parameters<typeof ChildPicker>[0]['children'];
  selectedId: number | null;
  setChildId: (id: number) => void;
  onRetry: () => void;
}) {
  if (kidsError) {
    return (
      <div className="lp-alert">
        <span>{kidsError}</span>
        <Button size="sm" type="button" variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }
  if (kidsLoading && childrenCount === 0) {
    return <p className="lp-empty">Loading linked children…</p>;
  }
  if (childrenCount === 0) {
    return <p className="lp-empty">No children are linked to this parent account yet.</p>;
  }
  return (
    <ChildPicker children={children} selectedId={selectedId} onChange={setChildId} disabled={kidsLoading} />
  );
}

type HomeworkInner = {
  id: number;
  title_en?: string;
  title_ar?: string;
  due_at?: string | null;
  status?: string;
  assignment_kind?: string | null;
  instructions_en?: string | null;
};

type HomeworkRow = {
  id?: number;
  title_en?: string;
  due_at?: string | null;
  status?: string;
  assignment_kind?: string | null;
  homework?: HomeworkInner;
  submission?: {
    id?: number;
    status?: string;
    score?: number | null;
    submitted_at?: string | null;
    feedback?: string | null;
  } | null;
};

function hwOf(row: HomeworkRow): HomeworkInner {
  if (row.homework) return row.homework;
  return {
    id: row.id ?? 0,
    title_en: row.title_en,
    due_at: row.due_at,
    status: row.status,
    assignment_kind: row.assignment_kind,
  };
}

function hwKind(row: HomeworkRow) {
  return (hwOf(row).assignment_kind || '').toLowerCase();
}

function isHomeworkKind(row: HomeworkRow) {
  const kind = hwKind(row);
  return !kind || kind === 'homework';
}

function isAssignmentKind(row: HomeworkRow) {
  const kind = hwKind(row);
  return Boolean(kind) && kind !== 'homework';
}

/* ------------------------------------------------------------------ */
/* Children                                                            */
/* ------------------------------------------------------------------ */

function childInitials(c: { first_name?: string; last_name?: string; email?: string }) {
  const fromName = [c.first_name, c.last_name]
    .map((s) => (s || '').trim().charAt(0))
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase();
  if (fromName) return fromName;
  return (c.email || 'C').slice(0, 2).toUpperCase();
}

function localeLabel(locale?: string | null) {
  if (!locale) return null;
  if (locale === 'ar') return 'Arabic';
  if (locale === 'en') return 'English';
  return locale;
}

export function ParentChildrenPage() {
  const { tenantSlug = 'al-noor' } = useParams();
  const { api } = useAuth();
  const [rows, setRows] = useState<
    { id: number; first_name?: string; last_name?: string; email?: string; locale?: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const base = `/${tenantSlug}/parent`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: typeof rows }>(`${PARENT_API}/children`);
      setRows(res.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load children.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <LearnerShell
      title="My children"
      subtitle={
        loading && rows.length === 0
          ? 'Linked students on your parent account'
          : `${rows.length} linked student${rows.length === 1 ? '' : 's'} on your parent account`
      }
      mode="parent"
      headerActions={
        <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      }
    >
      <div className="lp-page">
        {error ? (
          <div className="lp-alert">
            <span>{error}</span>
            <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : null}

        <p className="lp-profile-intro stem-animate-rise">
          Open progress, attendance, homework, results, and tutoring for each linked student.
        </p>

        {loading && rows.length === 0 ? (
          <p className="lp-empty">Loading children…</p>
        ) : rows.length === 0 ? (
          <Panel title="No linked students" description="Ask your school administrator to link children to this parent account.">
            <p className="lp-empty" style={{ padding: 0 }}>
              No children are linked yet.
            </p>
          </Panel>
        ) : (
          <div className="lp-child-list stem-animate-rise">
            {rows.map((c) => {
              const name = personName(c.first_name, c.last_name, c.email);
              const q = `?child=${c.id}`;
              const locale = localeLabel(c.locale);
              return (
                <article key={c.id} className="lp-child-card">
                  <div className="lp-child-card-top">
                    <div className="lp-detail-head">
                      <span className="lp-detail-mark" aria-hidden>
                        {childInitials(c)}
                      </span>
                      <div>
                        <h3>{name}</h3>
                        <p>{c.email || '—'}</p>
                      </div>
                    </div>
                    {locale ? <span className="lp-chip">{locale}</span> : null}
                  </div>
                  <div className="lp-child-nav">
                    <p className="lp-child-nav-label">Open reports</p>
                    <div className="lp-child-links">
                      <Button size="sm" to={`${base}/progress${q}`} variant="primary">
                        Progress
                      </Button>
                      <Button size="sm" to={`${base}/attendance${q}`} variant="secondary">
                        Attendance
                      </Button>
                      <Button size="sm" to={`${base}/homework${q}`} variant="secondary">
                        Homework
                      </Button>
                      <Button size="sm" to={`${base}/results${q}`} variant="secondary">
                        Results
                      </Button>
                      <Button size="sm" to={`${base}/tutoring${q}`} variant="secondary">
                        Tutoring
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </LearnerShell>
  );
}

/* ------------------------------------------------------------------ */
/* Attendance                                                          */
/* ------------------------------------------------------------------ */

type AttendanceRow = {
  id: number;
  status?: string;
  marked_at?: string | null;
  notes?: string | null;
  session?: {
    id?: number;
    starts_at?: string | null;
    ends_at?: string | null;
    status?: string;
  } | null;
};

export function ParentAttendancePage() {
  const {
    children,
    selected,
    selectedId,
    loading: kidsLoading,
    error: kidsError,
    load: loadKids,
    setChildId,
  } = useParentChildren();
  const { api } = useAuth();
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<AttendanceRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedId) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: AttendanceRow[] }>(`${PARENT_API}/children/${selectedId}/attendance`);
      const list = unwrapList<AttendanceRow>(res.data);
      setRows(list);
      setSelectedRow((prev) => list.find((r) => r.id === prev?.id) ?? list[0] ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load attendance.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [api, selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  const present = rows.filter((r) => (r.status || '').toLowerCase() === 'present').length;
  const absent = rows.filter((r) => (r.status || '').toLowerCase() === 'absent').length;

  return (
    <LearnerShell
      title="Attendance"
      subtitle={selected ? `Tutoring attendance · ${childLabel(selected)}` : 'Tutoring attendance'}
      mode="parent"
      headerActions={
        <Button size="sm" type="button" variant="secondary" disabled={loading || !selectedId} onClick={() => void load()}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      }
    >
      <div className="lp-page">
        <section className="lp-hero stem-animate-rise">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">Parent portal · Attendance</p>
            <h2 className="lp-hero-title">Session attendance</h2>
            <p className="lp-hero-lead">Review present and absent marks for tutoring sessions.</p>
          </div>
          <div className="lp-hero-actions">
            <ChildGate
              kidsLoading={kidsLoading}
              kidsError={kidsError}
              childrenCount={children.length}
              children={children}
              selectedId={selectedId}
              setChildId={setChildId}
              onRetry={() => void loadKids()}
            />
          </div>
        </section>

        {error ? (
          <div className="lp-alert">
            <span>{error}</span>
            <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : null}

        <StatStrip
          items={[
            { label: 'Records', value: loading ? '…' : String(rows.length) },
            { label: 'Present', value: loading ? '…' : String(present) },
            { label: 'Absent', value: loading ? '…' : String(absent) },
          ]}
        />

        <div className="lp-layout">
          <Panel title="Attendance log" description="Most recent marks first">
            {!selectedId ? (
              <p className="lp-empty">Select a child to view attendance.</p>
            ) : loading && rows.length === 0 ? (
              <p className="lp-empty">Loading attendance…</p>
            ) : rows.length === 0 ? (
              <p className="lp-empty">No attendance records for this child yet.</p>
            ) : (
              <div className="lp-table-wrap">
                <table className="lp-table">
                  <thead>
                    <tr>
                      <th>Session</th>
                      <th>Status</th>
                      <th>Marked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        className={selectedRow?.id === row.id ? 'is-selected' : undefined}
                        onClick={() => setSelectedRow(row)}
                      >
                        <td>{formatWhen(row.session?.starts_at)}</td>
                        <td>
                          <StatusPill status={row.status || 'unknown'} />
                        </td>
                        <td>{formatWhen(row.marked_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <aside className="lp-side">
            <div className="lp-detail">
              {selectedRow ? (
                <>
                  <div className="lp-detail-head">
                    <span className="lp-detail-mark" aria-hidden>
                      A
                    </span>
                    <div>
                      <h3>{formatWhen(selectedRow.session?.starts_at)}</h3>
                      <p>Attendance detail</p>
                    </div>
                  </div>
                  <dl className="lp-meta">
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <StatusPill status={selectedRow.status || 'unknown'} />
                      </dd>
                    </div>
                    <div>
                      <dt>Session end</dt>
                      <dd>{formatWhen(selectedRow.session?.ends_at)}</dd>
                    </div>
                    <div>
                      <dt>Session status</dt>
                      <dd>{selectedRow.session?.status || '—'}</dd>
                    </div>
                    <div>
                      <dt>Notes</dt>
                      <dd>{selectedRow.notes || '—'}</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <p className="lp-empty">Select a row to see details.</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </LearnerShell>
  );
}

/* ------------------------------------------------------------------ */
/* Homework / Assignments                                              */
/* ------------------------------------------------------------------ */

function ParentWorkListPage({
  mode,
}: {
  mode: 'homework' | 'assignments';
}) {
  const {
    children,
    selected,
    selectedId,
    loading: kidsLoading,
    error: kidsError,
    load: loadKids,
    setChildId,
  } = useParentChildren();
  const { api } = useAuth();
  const [rows, setRows] = useState<HomeworkRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<HomeworkRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedId) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: HomeworkRow[] }>(`${PARENT_API}/children/${selectedId}/homework`);
      const all = unwrapList<HomeworkRow>(res.data);
      const filtered = mode === 'homework' ? all.filter(isHomeworkKind) : all.filter(isAssignmentKind);
      setRows(filtered);
      setSelectedRow((prev) => {
        const prevId = prev ? hwOf(prev).id : null;
        return filtered.find((r) => hwOf(r).id === prevId) ?? filtered[0] ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to load ${mode}.`);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [api, selectedId, mode]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCount = rows.filter((r) => {
    const sub = (r.submission?.status || '').toLowerCase();
    return !sub || !['submitted', 'graded'].includes(sub);
  }).length;

  const title = mode === 'homework' ? 'Homework' : 'Assignments';
  const eyebrow = mode === 'homework' ? 'Homework' : 'Assignments';
  const lead =
    mode === 'homework'
      ? 'Published homework and submission status for the selected child.'
      : 'Non-homework assignments (projects, worksheets, and other kinds) for the selected child.';

  return (
    <LearnerShell
      title={title}
      subtitle={selected ? `${title} · ${childLabel(selected)}` : title}
      mode="parent"
      headerActions={
        <Button size="sm" type="button" variant="secondary" disabled={loading || !selectedId} onClick={() => void load()}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      }
    >
      <div className="lp-page">
        <section className="lp-hero stem-animate-rise">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">Parent portal · {eyebrow}</p>
            <h2 className="lp-hero-title">{title}</h2>
            <p className="lp-hero-lead">{lead}</p>
          </div>
          <div className="lp-hero-actions">
            <ChildGate
              kidsLoading={kidsLoading}
              kidsError={kidsError}
              childrenCount={children.length}
              children={children}
              selectedId={selectedId}
              setChildId={setChildId}
              onRetry={() => void loadKids()}
            />
          </div>
        </section>

        {error ? (
          <div className="lp-alert">
            <span>{error}</span>
            <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : null}

        <StatStrip
          items={[
            { label: 'Items', value: loading ? '…' : String(rows.length) },
            { label: 'Still open', value: loading ? '…' : String(openCount) },
          ]}
        />

        <div className="lp-layout">
          <Panel title={title} description="Select a row for submission details">
            {!selectedId ? (
              <p className="lp-empty">Select a child to view {mode}.</p>
            ) : loading && rows.length === 0 ? (
              <p className="lp-empty">Loading {mode}…</p>
            ) : rows.length === 0 ? (
              <p className="lp-empty">
                {mode === 'homework'
                  ? 'No homework items for this child right now.'
                  : 'No non-homework assignments for this child right now.'}
              </p>
            ) : (
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
                    {rows.map((row) => {
                      const hw = hwOf(row);
                      return (
                        <tr
                          key={hw.id}
                          className={selectedRow && hwOf(selectedRow).id === hw.id ? 'is-selected' : undefined}
                          onClick={() => setSelectedRow(row)}
                        >
                          <td>{hw.title_en || `Item ${hw.id}`}</td>
                          <td>{formatDate(hw.due_at)}</td>
                          <td>{hw.assignment_kind || 'homework'}</td>
                          <td>
                            <StatusPill status={row.submission?.status || 'pending'} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <aside className="lp-side">
            <div className="lp-detail">
              {selectedRow ? (
                <>
                  <div className="lp-detail-head">
                    <span className="lp-detail-mark" aria-hidden>
                      H
                    </span>
                    <div>
                      <h3>{hwOf(selectedRow).title_en || 'Item'}</h3>
                      <p>Due {formatDate(hwOf(selectedRow).due_at)}</p>
                    </div>
                  </div>
                  <dl className="lp-meta">
                    <div>
                      <dt>Kind</dt>
                      <dd>{hwOf(selectedRow).assignment_kind || 'homework'}</dd>
                    </div>
                    <div>
                      <dt>Publish status</dt>
                      <dd>
                        <StatusPill status={hwOf(selectedRow).status || 'published'} />
                      </dd>
                    </div>
                    <div>
                      <dt>Submission</dt>
                      <dd>
                        <StatusPill status={selectedRow.submission?.status || 'pending'} />
                      </dd>
                    </div>
                    <div>
                      <dt>Submitted</dt>
                      <dd>{formatWhen(selectedRow.submission?.submitted_at)}</dd>
                    </div>
                    <div>
                      <dt>Score</dt>
                      <dd>{selectedRow.submission?.score ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Feedback</dt>
                      <dd>{selectedRow.submission?.feedback || '—'}</dd>
                    </div>
                  </dl>
                  {hwOf(selectedRow).instructions_en ? (
                    <p className="lp-muted">{hwOf(selectedRow).instructions_en}</p>
                  ) : null}
                </>
              ) : (
                <p className="lp-empty">Select an item to see details.</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </LearnerShell>
  );
}

export function ParentHomeworkPage() {
  return <ParentWorkListPage mode="homework" />;
}

export function ParentAssignmentsPage() {
  return <ParentWorkListPage mode="assignments" />;
}

/* ------------------------------------------------------------------ */
/* Results                                                             */
/* ------------------------------------------------------------------ */

type ResultRow = {
  id: number;
  status?: string;
  score?: number | null;
  submitted_at?: string | null;
  graded_at?: string | null;
  assessment?: {
    id?: number;
    title_en?: string;
    type?: string;
    show_results?: boolean;
  } | null;
};

export function ParentResultsPage() {
  const {
    children,
    selected,
    selectedId,
    loading: kidsLoading,
    error: kidsError,
    load: loadKids,
    setChildId,
  } = useParentChildren();
  const { api } = useAuth();
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<ResultRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedId) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: ResultRow[] }>(`${PARENT_API}/children/${selectedId}/assessments`);
      const list = unwrapList<ResultRow>(res.data);
      setRows(list);
      setSelectedRow((prev) => list.find((r) => r.id === prev?.id) ?? list[0] ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load results.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [api, selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  const graded = rows.filter((r) => (r.status || '').toLowerCase() === 'graded').length;
  const scored = rows.filter((r) => r.score != null);
  const avg =
    scored.length === 0
      ? null
      : Math.round((scored.reduce((n, r) => n + (Number(r.score) || 0), 0) / scored.length) * 10) / 10;

  return (
    <LearnerShell
      title="Results"
      subtitle={selected ? `Assessments · ${childLabel(selected)}` : 'Assessment results'}
      mode="parent"
      headerActions={
        <Button size="sm" type="button" variant="secondary" disabled={loading || !selectedId} onClick={() => void load()}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      }
    >
      <div className="lp-page">
        <section className="lp-hero stem-animate-rise">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">Parent portal · Results</p>
            <h2 className="lp-hero-title">Assessment results</h2>
            <p className="lp-hero-lead">Graded and submitted attempts for the selected child.</p>
          </div>
          <div className="lp-hero-actions">
            <ChildGate
              kidsLoading={kidsLoading}
              kidsError={kidsError}
              childrenCount={children.length}
              children={children}
              selectedId={selectedId}
              setChildId={setChildId}
              onRetry={() => void loadKids()}
            />
          </div>
        </section>

        {error ? (
          <div className="lp-alert">
            <span>{error}</span>
            <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : null}

        <StatStrip
          items={[
            { label: 'Attempts', value: loading ? '…' : String(rows.length) },
            { label: 'Graded', value: loading ? '…' : String(graded) },
            { label: 'Avg score', value: loading ? '…' : avg == null ? '—' : String(avg) },
          ]}
        />

        <div className="lp-layout">
          <Panel title="Attempts" description="Newest submissions first">
            {!selectedId ? (
              <p className="lp-empty">Select a child to view results.</p>
            ) : loading && rows.length === 0 ? (
              <p className="lp-empty">Loading results…</p>
            ) : rows.length === 0 ? (
              <p className="lp-empty">No assessment results for this child yet.</p>
            ) : (
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
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        className={selectedRow?.id === row.id ? 'is-selected' : undefined}
                        onClick={() => setSelectedRow(row)}
                      >
                        <td>{row.assessment?.title_en || `Attempt ${row.id}`}</td>
                        <td>{row.assessment?.type || '—'}</td>
                        <td>{row.score ?? '—'}</td>
                        <td>
                          <StatusPill status={row.status || 'submitted'} />
                        </td>
                        <td>{formatWhen(row.submitted_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <aside className="lp-side">
            <div className="lp-detail">
              {selectedRow ? (
                <>
                  <div className="lp-detail-head">
                    <span className="lp-detail-mark" aria-hidden>
                      R
                    </span>
                    <div>
                      <h3>{selectedRow.assessment?.title_en || 'Result'}</h3>
                      <p>{selectedRow.assessment?.type || 'Assessment'}</p>
                    </div>
                  </div>
                  <dl className="lp-meta">
                    <div>
                      <dt>Score</dt>
                      <dd>{selectedRow.score ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <StatusPill status={selectedRow.status || 'submitted'} />
                      </dd>
                    </div>
                    <div>
                      <dt>Submitted</dt>
                      <dd>{formatWhen(selectedRow.submitted_at)}</dd>
                    </div>
                    <div>
                      <dt>Graded</dt>
                      <dd>{formatWhen(selectedRow.graded_at)}</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <p className="lp-empty">Select an attempt to see details.</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </LearnerShell>
  );
}

/* ------------------------------------------------------------------ */
/* Progress                                                            */
/* ------------------------------------------------------------------ */

type ProgressLearning = {
  id?: number;
  status?: string;
  progress_percent?: number | string | null;
  updated_at?: string | null;
  lesson?: { id?: number; title_en?: string } | null;
};

type ProgressPayload = {
  student?: { id: number; first_name?: string; last_name?: string; email?: string };
  progress?: {
    learning?: ProgressLearning[];
    assessments?: ResultRow[];
    avg_lesson_progress?: number;
  };
  certificates?: { id: number; title?: string; issued_at?: string | null; number?: string }[];
};

export function ParentProgressPage() {
  const {
    children,
    selected,
    selectedId,
    loading: kidsLoading,
    error: kidsError,
    load: loadKids,
    setChildId,
  } = useParentChildren();
  const { api } = useAuth();
  const [data, setData] = useState<ProgressPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: ProgressPayload }>(`${PARENT_API}/children/${selectedId}/progress`);
      setData(res.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load progress.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [api, selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  const learning = data?.progress?.learning ?? [];
  const assessments = data?.progress?.assessments ?? [];
  const certificates = data?.certificates ?? [];
  const avg = data?.progress?.avg_lesson_progress ?? 0;
  const completed = learning.filter((r) => (r.status || '').toLowerCase() === 'completed').length;

  return (
    <LearnerShell
      title="Progress reports"
      subtitle={selected ? `Learning progress · ${childLabel(selected)}` : 'Learning progress'}
      mode="parent"
      headerActions={
        <Button size="sm" type="button" variant="secondary" disabled={loading || !selectedId} onClick={() => void load()}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      }
    >
      <div className="lp-page">
        <section className="lp-hero stem-animate-rise">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">Parent portal · Progress</p>
            <h2 className="lp-hero-title">Progress report</h2>
            <p className="lp-hero-lead">Lesson completion, assessment history, and certificates.</p>
          </div>
          <div className="lp-hero-actions">
            <ChildGate
              kidsLoading={kidsLoading}
              kidsError={kidsError}
              childrenCount={children.length}
              children={children}
              selectedId={selectedId}
              setChildId={setChildId}
              onRetry={() => void loadKids()}
            />
          </div>
        </section>

        {error ? (
          <div className="lp-alert">
            <span>{error}</span>
            <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : null}

        <StatStrip
          items={[
            { label: 'Avg progress', value: loading ? '…' : `${avg}%` },
            { label: 'Lessons tracked', value: loading ? '…' : String(learning.length) },
            { label: 'Completed', value: loading ? '…' : String(completed) },
            { label: 'Certificates', value: loading ? '…' : String(certificates.length) },
          ]}
        />

        <div className="lp-layout">
          <Panel title="Lesson progress" description="Recent learning activity">
            {!selectedId ? (
              <p className="lp-empty">Select a child to view progress.</p>
            ) : loading && !data ? (
              <p className="lp-empty">Loading progress…</p>
            ) : learning.length === 0 ? (
              <p className="lp-empty">No lesson progress recorded for this child yet.</p>
            ) : (
              <div className="lp-table-wrap">
                <table className="lp-table">
                  <thead>
                    <tr>
                      <th>Lesson</th>
                      <th>Progress</th>
                      <th>Status</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {learning.map((row, idx) => {
                      const pct = Number(row.progress_percent ?? 0);
                      return (
                        <tr key={row.id ?? idx}>
                          <td>{row.lesson?.title_en || `Lesson ${row.lesson?.id ?? '—'}`}</td>
                          <td>
                            <div className="lp-progress" aria-hidden>
                              <span style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
                            </div>
                            <span className="lp-muted">{pct}%</span>
                          </td>
                          <td>
                            <StatusPill status={row.status || 'in_progress'} />
                          </td>
                          <td>{formatWhen(row.updated_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <aside className="lp-side">
            <Panel title="Assessments" description="Recent attempts">
              {assessments.length === 0 ? (
                <p className="lp-empty">No assessment attempts yet.</p>
              ) : (
                <ul className="lp-list">
                  {assessments.slice(0, 8).map((a) => (
                    <li key={a.id}>
                      <div>
                        <strong>{a.assessment?.title_en || `Attempt ${a.id}`}</strong>
                        <span>
                          {a.score ?? '—'} · {formatWhen(a.submitted_at)}
                        </span>
                      </div>
                      <StatusPill status={a.status || 'submitted'} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="Certificates">
              {certificates.length === 0 ? (
                <p className="lp-empty">No certificates issued yet.</p>
              ) : (
                <ul className="lp-list">
                  {certificates.map((c) => (
                    <li key={c.id}>
                      <div>
                        <strong>{c.title || c.number || `Certificate ${c.id}`}</strong>
                        <span>{formatDate(c.issued_at)}</span>
                      </div>
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

/* ------------------------------------------------------------------ */
/* Tutoring                                                            */
/* ------------------------------------------------------------------ */

type TutoringRow = {
  id: number;
  starts_at?: string | null;
  ends_at?: string | null;
  status?: string;
  subject?: { name_en?: string; code?: string } | null;
  tutor?: { user?: { first_name?: string; last_name?: string } } | null;
};

export function ParentTutoringPage() {
  const {
    children,
    selected,
    selectedId,
    loading: kidsLoading,
    error: kidsError,
    load: loadKids,
    setChildId,
  } = useParentChildren();
  const { api } = useAuth();
  const [rows, setRows] = useState<TutoringRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<TutoringRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedId) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: TutoringRow[] }>(`${PARENT_API}/children/${selectedId}/tutoring`);
      const list = unwrapList<TutoringRow>(res.data);
      setRows(list);
      setSelectedRow((prev) => list.find((r) => r.id === prev?.id) ?? list[0] ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tutoring sessions.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [api, selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  const upcoming = rows.filter((r) => (r.status || '').toLowerCase() === 'scheduled').length;
  const completed = rows.filter((r) => (r.status || '').toLowerCase() === 'completed').length;

  return (
    <LearnerShell
      title="Tutor sessions"
      subtitle={selected ? `Tutoring · ${childLabel(selected)}` : 'Tutoring sessions'}
      mode="parent"
      headerActions={
        <Button size="sm" type="button" variant="secondary" disabled={loading || !selectedId} onClick={() => void load()}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      }
    >
      <div className="lp-page">
        <section className="lp-hero stem-animate-rise">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">Parent portal · Tutoring</p>
            <h2 className="lp-hero-title">Tutor sessions</h2>
            <p className="lp-hero-lead">Upcoming and past tutoring sessions for the selected child.</p>
          </div>
          <div className="lp-hero-actions">
            <ChildGate
              kidsLoading={kidsLoading}
              kidsError={kidsError}
              childrenCount={children.length}
              children={children}
              selectedId={selectedId}
              setChildId={setChildId}
              onRetry={() => void loadKids()}
            />
          </div>
        </section>

        {error ? (
          <div className="lp-alert">
            <span>{error}</span>
            <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : null}

        <StatStrip
          items={[
            { label: 'Sessions', value: loading ? '…' : String(rows.length) },
            { label: 'Scheduled', value: loading ? '…' : String(upcoming) },
            { label: 'Completed', value: loading ? '…' : String(completed) },
          ]}
        />

        <div className="lp-layout">
          <Panel title="Sessions" description="Newest first">
            {!selectedId ? (
              <p className="lp-empty">Select a child to view tutoring.</p>
            ) : loading && rows.length === 0 ? (
              <p className="lp-empty">Loading sessions…</p>
            ) : rows.length === 0 ? (
              <p className="lp-empty">No tutoring sessions for this child yet.</p>
            ) : (
              <div className="lp-table-wrap">
                <table className="lp-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Subject</th>
                      <th>Tutor</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        className={selectedRow?.id === row.id ? 'is-selected' : undefined}
                        onClick={() => setSelectedRow(row)}
                      >
                        <td>{formatWhen(row.starts_at)}</td>
                        <td>{row.subject?.name_en || row.subject?.code || '—'}</td>
                        <td>
                          {personName(row.tutor?.user?.first_name, row.tutor?.user?.last_name) || '—'}
                        </td>
                        <td>
                          <StatusPill status={row.status || 'scheduled'} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <aside className="lp-side">
            <div className="lp-detail">
              {selectedRow ? (
                <>
                  <div className="lp-detail-head">
                    <span className="lp-detail-mark" aria-hidden>
                      T
                    </span>
                    <div>
                      <h3>{selectedRow.subject?.name_en || 'Session'}</h3>
                      <p>{formatWhen(selectedRow.starts_at)}</p>
                    </div>
                  </div>
                  <dl className="lp-meta">
                    <div>
                      <dt>Ends</dt>
                      <dd>{formatWhen(selectedRow.ends_at)}</dd>
                    </div>
                    <div>
                      <dt>Tutor</dt>
                      <dd>
                        {personName(selectedRow.tutor?.user?.first_name, selectedRow.tutor?.user?.last_name) ||
                          '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <StatusPill status={selectedRow.status || 'scheduled'} />
                      </dd>
                    </div>
                  </dl>
                </>
              ) : (
                <p className="lp-empty">Select a session to see details.</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </LearnerShell>
  );
}

/* ------------------------------------------------------------------ */
/* Fees                                                                */
/* ------------------------------------------------------------------ */

type FeeItem = {
  id?: number;
  description?: string;
  quantity?: number;
  unit_price?: number;
  line_total?: number;
};

type FeeInvoice = {
  id: number;
  number?: string;
  currency?: string;
  subtotal?: number;
  tax_total?: number;
  total?: number;
  status?: string;
  due_at?: string | null;
  paid_at?: string | null;
  issued_at?: string | null;
  notes?: string | null;
  student_user_id?: number;
  student_name?: string | null;
  student_first_name?: string | null;
  student_last_name?: string | null;
  items?: FeeItem[];
};

export function ParentFeesPage() {
  const { tenantSlug = 'al-noor' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { api } = useAuth();
  const feedback = useFeedback();
  const tenant = useResolvedTenant();
  const brand = tenant?.name || tenantSlug;
  const {
    children,
    selectedId,
    loading: kidsLoading,
    error: kidsError,
    load: loadKids,
    setChildId,
  } = useParentChildren();

  const filterMode = searchParams.get('scope') === 'child' ? 'child' : 'all';
  const [rows, setRows] = useState<FeeInvoice[]>([]);
  const [selected, setSelected] = useState<FeeInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs =
        filterMode === 'child' && selectedId
          ? `?student_user_id=${selectedId}`
          : '';
      const res = await api.get<{ data: FeeInvoice[] }>(`${PARENT_API}/fees${qs}`);
      const list = unwrapList<FeeInvoice>(res.data);
      setRows(list);
      setSelected((prev) => list.find((r) => r.id === prev?.id) ?? list[0] ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fees.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [api, filterMode, selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  const currency = rows[0]?.currency || 'SAR';
  const totalDue = rows
    .filter((r) => !['paid', 'void', 'cancelled'].includes((r.status || '').toLowerCase()))
    .reduce((n, r) => n + (Number(r.total) || 0), 0);
  const paidCount = rows.filter((r) => (r.status || '').toLowerCase() === 'paid').length;

  function setScope(scope: 'all' | 'child') {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (scope === 'all') next.delete('scope');
      else next.set('scope', 'child');
      return next;
    });
  }

  function studentName(inv: FeeInvoice) {
    return (
      inv.student_name ||
      personName(inv.student_first_name, inv.student_last_name) ||
      (inv.student_user_id ? `Student #${inv.student_user_id}` : '—')
    );
  }

  async function printStatement() {
    try {
      const bodyHtml =
        kpiHtml([
          { label: 'Invoices', value: rows.length },
          { label: 'Paid', value: paidCount },
          { label: 'Outstanding', value: formatMoney(totalDue, currency) },
        ]) +
        tableHtml(
          ['Invoice', 'Student', 'Total', 'Status', 'Due'],
          rows.map((r) => [
            r.number || `#${r.id}`,
            studentName(r),
            formatMoney(Number(r.total) || 0, r.currency || currency),
            r.status || '—',
            formatDate(r.due_at),
          ]),
        );

      exportPdfDocument({
        title: 'Fee statement',
        subtitle: `${brand} · Parent portal`,
        documentLabel: 'Fee statement',
        preview: true,
        bodyHtml,
      });

      await feedback.success({
        title: 'Statement ready',
        message: 'Use your browser print dialog to save as PDF.',
      });
    } catch (err) {
      await feedback.confirm({
        title: 'Print failed',
        message: err instanceof Error ? err.message : 'Could not open the fee statement.',
        confirmLabel: 'OK',
        cancelLabel: 'Close',
        tone: 'warn',
      });
    }
  }

  const items = selected?.items ?? [];

  return (
    <LearnerShell
      title="Fee payments"
      subtitle={`Invoices · ${brand}`}
      mode="parent"
      headerActions={
        <>
          <Button size="sm" type="button" variant="secondary" disabled={loading || rows.length === 0} onClick={() => void printStatement()}>
            Print statement
          </Button>
          <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
        </>
      }
    >
      <div className="lp-page">
        <section className="lp-hero stem-animate-rise">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">Parent portal · Fees</p>
            <h2 className="lp-hero-title">Fee payments</h2>
            <p className="lp-hero-lead">
              Review invoices for your children and print a professional fee statement.
            </p>
            <div className="lp-chip-row">
              <span className="lp-chip">{formatMoney(totalDue, currency)} outstanding</span>
            </div>
          </div>
          <div className="lp-hero-actions">
            <div className="lp-toolbar" style={{ marginBottom: 0 }}>
              <SelectField
                label="Scope"
                value={filterMode}
                onChange={(e) => setScope(e.target.value === 'child' ? 'child' : 'all')}
              >
                <option value="all">All children</option>
                <option value="child">Selected child</option>
              </SelectField>
            </div>
            {filterMode === 'child' ? (
              <ChildGate
                kidsLoading={kidsLoading}
                kidsError={kidsError}
                childrenCount={children.length}
                children={children}
                selectedId={selectedId}
                setChildId={setChildId}
                onRetry={() => void loadKids()}
              />
            ) : null}
          </div>
        </section>

        {error ? (
          <div className="lp-alert">
            <span>{error}</span>
            <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : null}

        <StatStrip
          items={[
            { label: 'Invoices', value: loading ? '…' : String(rows.length) },
            { label: 'Paid', value: loading ? '…' : String(paidCount) },
            { label: 'Outstanding', value: loading ? '…' : formatMoney(totalDue, currency) },
          ]}
        />

        <div className="lp-layout">
          <Panel title="Invoices" description="Select a row for line items">
            {loading && rows.length === 0 ? (
              <p className="lp-empty">Loading invoices…</p>
            ) : rows.length === 0 ? (
              <p className="lp-empty">No fee invoices found for this filter.</p>
            ) : (
              <div className="lp-table-wrap">
                <table className="lp-table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Student</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        className={selected?.id === row.id ? 'is-selected' : undefined}
                        onClick={() => setSelected(row)}
                      >
                        <td>{row.number || `#${row.id}`}</td>
                        <td>{studentName(row)}</td>
                        <td>{formatMoney(Number(row.total) || 0, row.currency || currency)}</td>
                        <td>
                          <StatusPill status={row.status || 'pending'} />
                        </td>
                        <td>{formatDate(row.due_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <aside className="lp-side">
            <div className="lp-detail">
              {selected ? (
                <>
                  <div className="lp-detail-head">
                    <span className="lp-detail-mark" aria-hidden>
                      ﷼
                    </span>
                    <div>
                      <h3>{selected.number || `Invoice #${selected.id}`}</h3>
                      <p>{studentName(selected)}</p>
                    </div>
                  </div>
                  <dl className="lp-meta">
                    <div>
                      <dt>Total</dt>
                      <dd>{formatMoney(Number(selected.total) || 0, selected.currency || currency)}</dd>
                    </div>
                    <div>
                      <dt>Subtotal</dt>
                      <dd>{formatMoney(Number(selected.subtotal) || 0, selected.currency || currency)}</dd>
                    </div>
                    <div>
                      <dt>Tax</dt>
                      <dd>{formatMoney(Number(selected.tax_total) || 0, selected.currency || currency)}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <StatusPill status={selected.status || 'pending'} />
                      </dd>
                    </div>
                    <div>
                      <dt>Issued</dt>
                      <dd>{formatDate(selected.issued_at)}</dd>
                    </div>
                    <div>
                      <dt>Due</dt>
                      <dd>{formatDate(selected.due_at)}</dd>
                    </div>
                    <div>
                      <dt>Paid</dt>
                      <dd>{formatDate(selected.paid_at)}</dd>
                    </div>
                    <div>
                      <dt>Notes</dt>
                      <dd>{selected.notes || '—'}</dd>
                    </div>
                  </dl>
                  <Panel title="Line items">
                    {items.length === 0 ? (
                      <p className="lp-empty">No line items on this invoice.</p>
                    ) : (
                      <ul className="lp-list">
                        {items.map((item, idx) => (
                          <li key={item.id ?? idx}>
                            <div>
                              <strong>{item.description || 'Line item'}</strong>
                              <span>
                                Qty {item.quantity ?? 1} ·{' '}
                                {formatMoney(Number(item.line_total) || 0, selected.currency || currency)}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Panel>
                </>
              ) : (
                <p className="lp-empty">Select an invoice to see line items.</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </LearnerShell>
  );
}

/* ------------------------------------------------------------------ */
/* Notices                                                             */
/* ------------------------------------------------------------------ */

type NoticeRow = {
  id: number;
  title?: string;
  body?: string;
  channel?: string;
  audience?: string;
  status?: string;
  sent_at?: string | null;
};

export function ParentNoticesPage() {
  const { api } = useAuth();
  const [rows, setRows] = useState<NoticeRow[]>([]);
  const [selected, setSelected] = useState<NoticeRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: NoticeRow[] }>(`${PARENT_API}/notices`);
      const list = unwrapList<NoticeRow>(res.data);
      setRows(list);
      setSelected((prev) => list.find((r) => r.id === prev?.id) ?? list[0] ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notices.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <LearnerShell
      title="School notices"
      subtitle="Announcements for parents"
      mode="parent"
      headerActions={
        <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      }
    >
      <div className="lp-page">
        <section className="lp-hero stem-animate-rise">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">Parent portal · Notices</p>
            <h2 className="lp-hero-title">School notices</h2>
            <p className="lp-hero-lead">Official announcements sent to parents and the wider school community.</p>
          </div>
        </section>

        {error ? (
          <div className="lp-alert">
            <span>{error}</span>
            <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : null}

        <StatStrip items={[{ label: 'Notices', value: loading && !rows.length ? '…' : String(rows.length) }]} />

        <div className="lp-layout">
          <Panel title="Notices" description="Newest first">
            {loading && rows.length === 0 ? (
              <p className="lp-empty">Loading notices…</p>
            ) : rows.length === 0 ? (
              <p className="lp-empty">No school notices have been sent yet.</p>
            ) : (
              <div className="lp-table-wrap">
                <table className="lp-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Audience</th>
                      <th>Sent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        className={selected?.id === row.id ? 'is-selected' : undefined}
                        onClick={() => setSelected(row)}
                      >
                        <td>{row.title || `Notice ${row.id}`}</td>
                        <td>{row.audience || '—'}</td>
                        <td>{formatWhen(row.sent_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <aside className="lp-side">
            <div className="lp-detail">
              {selected ? (
                <>
                  <div className="lp-detail-head">
                    <span className="lp-detail-mark" aria-hidden>
                      N
                    </span>
                    <div>
                      <h3>{selected.title || 'Notice'}</h3>
                      <p>{formatWhen(selected.sent_at)}</p>
                    </div>
                  </div>
                  <dl className="lp-meta">
                    <div>
                      <dt>Channel</dt>
                      <dd>{selected.channel || '—'}</dd>
                    </div>
                    <div>
                      <dt>Audience</dt>
                      <dd>{selected.audience || '—'}</dd>
                    </div>
                  </dl>
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                    {selected.body || 'No message body.'}
                  </p>
                </>
              ) : (
                <p className="lp-empty">Select a notice to read it.</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </LearnerShell>
  );
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

type NotificationRow = {
  id: string;
  type?: string;
  data?: Record<string, unknown> | null;
  read_at?: string | null;
  created_at?: string | null;
};

function notificationTitle(row: NotificationRow) {
  const d = row.data || {};
  if (typeof d.title === 'string' && d.title) return d.title;
  if (typeof d.message === 'string' && d.message) return d.message;
  if (typeof d.body === 'string' && d.body) return d.body;
  return row.type || 'Notification';
}

export function ParentNotificationsPage() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{
        data?: NotificationRow[];
        total?: number;
      }>(`${PARENT_API}/notifications?per_page=50`);
      const list = unwrapList<NotificationRow>(res);
      setRows(list);
      setTotal(typeof res.total === 'number' ? res.total : list.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const unread = rows.filter((r) => !r.read_at).length;

  async function markRead(id: string) {
    try {
      await api.post(`${PARENT_API}/notifications/${id}/read`);
      await load();
    } catch (err) {
      await feedback.confirm({
        title: 'Update failed',
        message: err instanceof Error ? err.message : 'Could not mark as read.',
        confirmLabel: 'OK',
        cancelLabel: 'Close',
        tone: 'warn',
      });
    }
  }

  async function markAll() {
    try {
      await api.post(`${PARENT_API}/notifications/read-all`);
      await feedback.success({ title: 'All read', message: 'Notifications marked as read.' });
      await load();
    } catch (err) {
      await feedback.confirm({
        title: 'Update failed',
        message: err instanceof Error ? err.message : 'Could not mark all as read.',
        confirmLabel: 'OK',
        cancelLabel: 'Close',
        tone: 'warn',
      });
    }
  }

  return (
    <LearnerShell
      title="Notifications"
      subtitle="Alerts for your parent account"
      mode="parent"
      headerActions={
        <>
          <Button size="sm" type="button" variant="secondary" disabled={loading || unread === 0} onClick={() => void markAll()}>
            Mark all read
          </Button>
          <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
        </>
      }
    >
      <div className="lp-page">
        <section className="lp-hero stem-animate-rise">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">Parent portal · Inbox</p>
            <h2 className="lp-hero-title">Notifications</h2>
            <p className="lp-hero-lead">Stay informed about homework, sessions, fees, and school updates.</p>
          </div>
        </section>

        {error ? (
          <div className="lp-alert">
            <span>{error}</span>
            <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : null}

        <StatStrip
          items={[
            { label: 'Total', value: loading && !rows.length ? '…' : String(total ?? rows.length) },
            { label: 'Unread', value: loading && !rows.length ? '…' : String(unread) },
          ]}
        />

        <Panel title="Inbox">
          {loading && rows.length === 0 ? (
            <p className="lp-empty">Loading notifications…</p>
          ) : rows.length === 0 ? (
            <p className="lp-empty">No notifications yet.</p>
          ) : (
            <ul className="lp-list">
              {rows.map((row) => (
                <li key={row.id}>
                  <div>
                    <strong>{notificationTitle(row)}</strong>
                    <span>{formatWhen(row.created_at)}</span>
                  </div>
                  <div className="lp-actions" style={{ marginTop: 0 }}>
                    <StatusPill status={row.read_at ? 'read' : 'unread'} />
                    {!row.read_at ? (
                      <Button size="sm" type="button" variant="secondary" onClick={() => void markRead(row.id)}>
                        Mark read
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </LearnerShell>
  );
}

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

const TIMEZONES = [
  'Asia/Riyadh',
  'Asia/Dubai',
  'Asia/Kuwait',
  'Asia/Bahrain',
  'Asia/Qatar',
  'Africa/Cairo',
  'Europe/London',
  'UTC',
];

function profileSeedFromSession(session: { user?: { name?: string; email?: string } } | null) {
  const parts = (session?.user?.name || '').trim().split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0] || '',
    last_name: parts.slice(1).join(' '),
    phone: '',
    locale: 'en',
    timezone: 'Asia/Riyadh',
    email: session?.user?.email || '',
  };
}

export function ParentProfilePage() {
  const { tenantSlug = 'al-noor' } = useParams();
  const { api, session, updateSession } = useAuth();
  const feedback = useFeedback();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [baseline, setBaseline] = useState(() => profileSeedFromSession(session));
  const [form, setForm] = useState(baseline);

  const patch = useCallback(<K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setDirty(true);
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{
        data: {
          user: {
            email?: string;
            first_name?: string;
            last_name?: string;
            phone?: string | null;
            locale?: string | null;
            timezone?: string | null;
            name?: string;
          };
        };
      }>('/auth/me');
      const u = res.data?.user ?? {};
      let first = u.first_name ?? '';
      let last = u.last_name ?? '';
      if (!first && !last && (u.name || session?.user.name)) {
        const parts = (u.name || session?.user.name || '').trim().split(/\s+/);
        first = parts[0] || '';
        last = parts.slice(1).join(' ');
      }
      const next = {
        first_name: first,
        last_name: last,
        phone: u.phone ?? '',
        locale: u.locale || 'en',
        timezone: u.timezone || 'Asia/Riyadh',
        email: u.email || session?.user.email || '',
      };
      setBaseline(next);
      setForm(next);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile.');
      const fallback = profileSeedFromSession(session);
      setBaseline(fallback);
      setForm(fallback);
      setDirty(false);
    } finally {
      setLoading(false);
    }
  }, [api, session?.user.email, session?.user.name]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const formEl = e.currentTarget as HTMLFormElement;
    if (!validateFormFields(formEl)) return;
    setSaving(true);
    try {
      const res = await api.put<{
        message?: string;
        data: {
          first_name?: string;
          last_name?: string;
          email?: string;
          phone?: string | null;
          locale?: string | null;
          timezone?: string | null;
        };
      }>(`${PARENT_API}/profile`, {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim() || null,
        phone: form.phone.trim() || null,
        locale: form.locale,
        timezone: form.timezone,
      });
      const u = res.data;
      const next = {
        first_name: u.first_name ?? form.first_name,
        last_name: u.last_name ?? form.last_name,
        phone: u.phone ?? '',
        locale: u.locale || form.locale,
        timezone: u.timezone || form.timezone,
        email: u.email || form.email,
      };
      setBaseline(next);
      setForm(next);
      setDirty(false);
      updateSession((prev) => ({
        ...prev,
        user: {
          ...prev.user,
          name: personName(next.first_name, next.last_name, next.email),
          email: next.email || prev.user.email,
        },
      }));
      await feedback.success({ title: 'Profile saved', message: res.message || 'Your profile was updated.' });
    } catch (err) {
      await feedback.confirm({
        title: 'Save failed',
        message: err instanceof Error ? err.message : 'Could not update profile.',
        confirmLabel: 'OK',
        cancelLabel: 'Close',
        tone: 'warn',
      });
    } finally {
      setSaving(false);
    }
  }

  const displayName = personName(form.first_name, form.last_name, form.email);
  const initials = [form.first_name, form.last_name]
    .map((s) => (s || '').trim().charAt(0))
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'P';
  const localeLabel = form.locale === 'ar' ? 'Arabic' : 'English';
  const timezoneOptions =
    form.timezone && !TIMEZONES.includes(form.timezone) ? [form.timezone, ...TIMEZONES] : TIMEZONES;

  return (
    <LearnerShell
      title="Profile"
      subtitle="Contact details and preferences for your family account"
      mode="parent"
      headerActions={
        <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      }
    >
      <div className="lp-page">
        {error ? (
          <div className="lp-alert" role="alert">
            <span>{error}</span>
            <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : null}

        <div className="lp-layout stem-animate-rise">
          <form className="lp-profile-form" onSubmit={(e) => void onSubmit(e)} noValidate>
            <p className="lp-profile-intro">
              Keep contact details, language, and timezone current for family notices and tutoring schedules.
              {dirty ? ' You have unsaved changes.' : ''}
            </p>

            <Panel title="Contact" description="Visible to school staff for family communications.">
              <div className="lp-form-grid">
                <TextField
                  label="First name"
                  name="first_name"
                  required
                  value={form.first_name}
                  disabled={loading || saving}
                  onChange={(e) => patch('first_name', e.target.value)}
                />
                <TextField
                  label="Last name"
                  name="last_name"
                  value={form.last_name}
                  disabled={loading || saving}
                  onChange={(e) => patch('last_name', e.target.value)}
                />
                <TextField
                  label="Email"
                  name="email"
                  value={form.email}
                  disabled
                  hint="Managed by your school administrator."
                />
                <TextField
                  label="Phone"
                  name="phone"
                  value={form.phone}
                  placeholder="+966…"
                  disabled={loading || saving}
                  onChange={(e) => patch('phone', e.target.value)}
                />
              </div>
            </Panel>

            <Panel title="Preferences" description="Language and timezone for notices and scheduling.">
              <div className="lp-form-grid">
                <SelectField
                  label="Locale"
                  name="locale"
                  value={form.locale}
                  disabled={loading || saving}
                  onChange={(e) => patch('locale', e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="ar">Arabic</option>
                </SelectField>
                <SelectField
                  label="Timezone"
                  name="timezone"
                  value={form.timezone}
                  disabled={loading || saving}
                  onChange={(e) => patch('timezone', e.target.value)}
                >
                  {timezoneOptions.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </SelectField>
              </div>
            </Panel>

            <FormActions>
              <Button
                size="sm"
                type="button"
                variant="secondary"
                disabled={loading || saving || !dirty}
                onClick={() => {
                  setForm(baseline);
                  setDirty(false);
                }}
              >
                Discard
              </Button>
              <Button size="sm" type="submit" variant="primary" disabled={saving || loading || !dirty}>
                {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
              </Button>
            </FormActions>
          </form>

          <aside className="lp-side lp-profile-aside">
            <div className="lp-detail">
              <div className="lp-detail-head">
                <span className="lp-detail-mark" aria-hidden>
                  {initials}
                </span>
                <div>
                  <h3>{displayName || 'Parent account'}</h3>
                  <p>{form.email || '—'}</p>
                </div>
              </div>
              <dl className="lp-meta">
                <div>
                  <dt>Phone</dt>
                  <dd>{form.phone || '—'}</dd>
                </div>
                <div>
                  <dt>Locale</dt>
                  <dd>{localeLabel}</dd>
                </div>
                <div>
                  <dt>Timezone</dt>
                  <dd>{form.timezone || '—'}</dd>
                </div>
              </dl>
              <div className="lp-actions">
                <Button size="sm" to={`/${tenantSlug}/parent/children`} variant="secondary">
                  My children
                </Button>
                <Button size="sm" to={`/${tenantSlug}/parent/notifications`} variant="secondary">
                  Notifications
                </Button>
                <Button size="sm" to={`/${tenantSlug}/change-password`} variant="secondary">
                  Change password
                </Button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </LearnerShell>
  );
}
