import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import {
  Button,
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
  StatusPill,
  TUTOR_API,
  TutorShell,
  formatWhen,
} from './shared';

type SessionRow = {
  id: number;
  starts_at?: string | null;
  ends_at?: string | null;
  status: string;
  meeting_url?: string | null;
  subject?: { name_en?: string } | string | null;
  participants?: { id: number; first_name?: string; last_name?: string; email?: string }[];
};

function subjectLabel(s: SessionRow) {
  if (typeof s.subject === 'string') return s.subject;
  return s.subject?.name_en || 'Tutoring session';
}

async function fetchMySessions(api: { get: <T>(url: string) => Promise<T> }, status?: string) {
  const profile = await api.get<{ data: { tutor_profile?: { id: number } | null } }>(`${TUTOR_API}/profile`);
  const profileId = profile.data.tutor_profile?.id;
  const params = new URLSearchParams({ per_page: '10' });
  if (profileId) params.set('tutor_profile_id', String(profileId));
  if (status) params.set('status', status);
  const res = await api.get<{ data: SessionRow[] }>(`/org/tutoring-sessions?${params}`);
  return res.data ?? [];
}

export function TutorLiveSessionsPage() {
  const [searchParams] = useSearchParams();
  const { api } = useAuth();
  const feedback = useFeedback();
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(
    searchParams.get('session') ? Number(searchParams.get('session')) : null,
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchMySessions(api);
      setRows(items);
      setSelectedId((cur) => cur ?? items[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load live sessions.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const live = rows.filter((r) => ['scheduled', 'confirmed', 'in_progress'].includes(r.status));
  const listPage = useClientPagination(rows);

  async function openClassroom(id: number) {
    setBusy(`join-${id}`);
    try {
      const res = await api.get<{ join_url?: string; data?: { join_url?: string } }>(
        `/org/tutoring-sessions/${id}/classroom`,
      );
      const url = res.join_url ?? res.data?.join_url;
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
      else await feedback.success({ title: 'Classroom', message: 'Classroom endpoint responded without a join URL.' });
    } catch (err) {
      await feedback.error({
        title: 'Join failed',
        message: err instanceof Error ? err.message : 'Could not open classroom.',
      });
    } finally {
      setBusy(null);
    }
  }

  async function completeSession(id: number) {
    setBusy(`done-${id}`);
    try {
      await api.post(`/org/tutoring-sessions/${id}/complete`);
      await feedback.success({ title: 'Session completed', message: 'Marked as completed.' });
      await load();
    } catch (err) {
      await feedback.error({
        title: 'Complete failed',
        message: err instanceof Error ? err.message : 'Could not complete session.',
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <TutorShell title="Live Sessions" subtitle="Join classrooms and wrap up sessions">
      <div className="tp-page">
        <section className="tp-hero stem-animate-rise">
          <div>
            <p className="tp-eyebrow">Tutor portal · Live</p>
            <h2 className="tp-hero-title">Live sessions</h2>
            <p className="tp-hero-lead">Launch classroom links, track status, and mark sessions complete when finished.</p>
          </div>
          <div className="tp-hero-actions">
            <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>
        </section>
        {error ? <div className="tp-alert">{error}</div> : null}
        <StatStrip
          items={[
            { label: 'Active / upcoming', value: String(live.length) },
            { label: 'All sessions', value: String(rows.length) },
          ]}
        />
        <div className="tp-layout">
          <Panel title="Sessions" description="Click a row to manage actions.">
            <div className="tp-table-wrap">
              <table className="tp-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Subject</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="tp-empty">
                        {loading ? 'Loading…' : 'No sessions found.'}
                      </td>
                    </tr>
                  ) : (
                    listPage.pageItems.map((row) => (
                      <tr
                        key={row.id}
                        className={selectedId === row.id ? 'is-selected' : undefined}
                        onClick={() => setSelectedId(row.id)}
                      >
                        <td>{formatWhen(row.starts_at)}</td>
                        <td>{subjectLabel(row)}</td>
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
          <aside>
            <Panel title="Session actions">
              {!selected ? (
                <p className="tp-muted">Select a session.</p>
              ) : (
                <>
                  <dl className="tp-meta">
                    <div>
                      <dt>Subject</dt>
                      <dd>{subjectLabel(selected)}</dd>
                    </div>
                    <div>
                      <dt>Starts</dt>
                      <dd>{formatWhen(selected.starts_at)}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <StatusPill status={selected.status} />
                      </dd>
                    </div>
                  </dl>
                  <div className="tp-actions">
                    <Button
                      size="sm"
                      type="button"
                      variant="primary"
                      disabled={busy === `join-${selected.id}`}
                      onClick={() => void openClassroom(selected.id)}
                    >
                      {busy === `join-${selected.id}` ? 'Opening…' : 'Join classroom'}
                    </Button>
                    <Button
                      size="sm"
                      type="button"
                      variant="secondary"
                      disabled={busy === `done-${selected.id}` || selected.status === 'completed'}
                      onClick={() => void completeSession(selected.id)}
                    >
                      {busy === `done-${selected.id}` ? 'Saving…' : 'Mark complete'}
                    </Button>
                  </div>
                </>
              )}
            </Panel>
          </aside>
        </div>
      </div>
    </TutorShell>
  );
}

export function TutorHomeworkPage() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [rows, setRows] = useState<
    { id: number; title_en: string; status: string; due_at: string | null; submissions_count: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [status, setStatus] = useState('published');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: { homework: typeof rows } }>(`${TUTOR_API}/workspace`);
      setRows(res.data.homework ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load homework.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const listPage = useClientPagination(rows);

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateFormFields(e.currentTarget)) return;
    setSaving(true);
    try {
      await api.post(`${TUTOR_API}/homework`, {
        title_en: title.trim(),
        due_at: due || null,
        status,
      });
      setTitle('');
      setDue('');
      await feedback.success({ title: 'Homework published', message: 'Assignment is available to learners.' });
      await load();
    } catch (err) {
      await feedback.error({
        title: 'Could not create homework',
        message: err instanceof Error ? err.message : 'Check permissions and try again.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <TutorShell title="Homework" subtitle="Assign and track student homework">
      <div className="tp-page">
        <section className="tp-hero stem-animate-rise">
          <div>
            <p className="tp-eyebrow">Tutor portal · Learning</p>
            <h2 className="tp-hero-title">Homework</h2>
            <p className="tp-hero-lead">Publish homework for your school and monitor submission counts at a glance.</p>
          </div>
        </section>
        {error ? <div className="tp-alert">{error}</div> : null}
        <StatStrip items={[{ label: 'Assignments', value: String(rows.length) }]} />
        <div className="tp-layout">
          <Panel title="Homework list" description={loading ? 'Loading…' : undefined}>
            <div className="tp-table-wrap">
              <table className="tp-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Due</th>
                    <th>Submissions</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="tp-empty">
                        No homework yet.
                      </td>
                    </tr>
                  ) : (
                    listPage.pageItems.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <strong>{row.title_en}</strong>
                        </td>
                        <td>{formatWhen(row.due_at)}</td>
                        <td>{row.submissions_count}</td>
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
          <aside>
            <Panel title="New homework">
              <form className="tp-form" onSubmit={onSave} noValidate>
                <TextField label="Title" required value={title} onChange={(e) => setTitle(e.target.value)} />
                <TextField label="Due at" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
                <SelectField label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="closed">Closed</option>
                </SelectField>
                <FormActions>
                  <Button size="sm" type="submit" variant="primary" disabled={saving}>
                    {saving ? 'Saving…' : 'Create homework'}
                  </Button>
                </FormActions>
              </form>
            </Panel>
          </aside>
        </div>
      </div>
    </TutorShell>
  );
}

export function TutorAssessmentsPage() {
  const { api } = useAuth();
  const [rows, setRows] = useState<{ id: number; title_en: string; type: string; status: string; due_at: string | null }[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: { assessments: typeof rows; stats: { to_grade: number } } }>(
        `${TUTOR_API}/workspace`,
      );
      setRows(res.data.assessments ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assessments.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const listPage = useClientPagination(rows);

  return (
    <TutorShell title="Assessments" subtitle="Quizzes and exams for your school">
      <div className="tp-page">
        <section className="tp-hero stem-animate-rise">
          <div>
            <p className="tp-eyebrow">Tutor portal · Assessments</p>
            <h2 className="tp-hero-title">Assessments</h2>
            <p className="tp-hero-lead">Review published quizzes and exams your learners can take.</p>
          </div>
          <div className="tp-hero-actions">
            <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>
        </section>
        {error ? <div className="tp-alert">{error}</div> : null}
        <StatStrip items={[{ label: 'Assessments', value: String(rows.length) }]} />
        <Panel title="Assessment catalogue">
          <div className="tp-table-wrap">
            <table className="tp-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="tp-empty">
                      {loading ? 'Loading…' : 'No assessments available.'}
                    </td>
                  </tr>
                ) : (
                  listPage.pageItems.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.title_en}</strong>
                      </td>
                      <td>{row.type}</td>
                      <td>{formatWhen(row.due_at)}</td>
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
      </div>
    </TutorShell>
  );
}

export function TutorSessionNotesPage() {
  const [searchParams] = useSearchParams();
  const { api } = useAuth();
  const feedback = useFeedback();
  const [rows, setRows] = useState<
    {
      id: number;
      notes: string;
      follow_up?: string | null;
      visible_to_parent: boolean;
      created_at?: string | null;
      session?: { id: number; starts_at?: string | null; subject?: string | null; students?: string[] } | null;
    }[]
  >([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState(searchParams.get('session') || '');
  const [notes, setNotes] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [visibleToParent, setVisibleToParent] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [notesRes, sessionRows] = await Promise.all([
        api.get<{ data: typeof rows }>(`${TUTOR_API}/session-notes`),
        fetchMySessions(api),
      ]);
      setRows(notesRes.data ?? []);
      setSessions(sessionRows);
      if (!sessionId && sessionRows[0]) setSessionId(String(sessionRows[0].id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session notes.');
    } finally {
      setLoading(false);
    }
  }, [api, sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateFormFields(e.currentTarget)) return;
    setSaving(true);
    try {
      await api.post(`${TUTOR_API}/session-notes`, {
        tutoring_session_id: Number(sessionId),
        notes: notes.trim(),
        follow_up: followUp.trim() || null,
        visible_to_parent: visibleToParent,
      });
      setNotes('');
      setFollowUp('');
      await feedback.success({ title: 'Note saved', message: 'Session note updated.' });
      await load();
    } catch (err) {
      await feedback.error({
        title: 'Could not save note',
        message: err instanceof Error ? err.message : 'Unable to save.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <TutorShell title="Session Notes" subtitle="Capture follow-ups after each session">
      <div className="tp-page">
        <section className="tp-hero stem-animate-rise">
          <div>
            <p className="tp-eyebrow">Tutor portal · Notes</p>
            <h2 className="tp-hero-title">Session notes</h2>
            <p className="tp-hero-lead">Record what was covered and optional parent-visible follow-ups.</p>
          </div>
        </section>
        {error ? <div className="tp-alert">{error}</div> : null}
        <StatStrip items={[{ label: 'Notes', value: String(rows.length) }]} />
        <div className="tp-layout">
          <Panel title="Recent notes" description={loading ? 'Loading…' : undefined}>
            {rows.length === 0 ? (
              <p className="tp-empty">No notes yet.</p>
            ) : (
              <ul className="tp-list">
                {rows.map((row) => (
                  <li key={row.id}>
                    <div>
                      <strong>{row.session?.subject || `Session #${row.session?.id ?? row.id}`}</strong>
                      <span>
                        {formatWhen(row.session?.starts_at || row.created_at)} ·{' '}
                        {(row.session?.students ?? []).join(', ') || '—'}
                      </span>
                      <p className="tp-muted" style={{ marginTop: 6 }}>
                        {row.notes}
                      </p>
                    </div>
                    <StatusPill status={row.visible_to_parent ? 'parent visible' : 'private'} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <aside>
            <Panel title="Write a note">
              <form className="tp-form" onSubmit={onSave} noValidate>
                <SelectField label="Session" required value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
                  <option value="">Select session</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      #{s.id} · {subjectLabel(s)} · {formatWhen(s.starts_at)}
                    </option>
                  ))}
                </SelectField>
                <TextAreaField label="Notes" required value={notes} onChange={(e) => setNotes(e.target.value)} />
                <TextAreaField label="Follow-up" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
                <SelectField
                  label="Visible to parent"
                  value={visibleToParent ? 'yes' : 'no'}
                  onChange={(e) => setVisibleToParent(e.target.value === 'yes')}
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </SelectField>
                <FormActions>
                  <Button size="sm" type="submit" variant="primary" disabled={saving}>
                    {saving ? 'Saving…' : 'Save note'}
                  </Button>
                </FormActions>
              </form>
            </Panel>
          </aside>
        </div>
      </div>
    </TutorShell>
  );
}
