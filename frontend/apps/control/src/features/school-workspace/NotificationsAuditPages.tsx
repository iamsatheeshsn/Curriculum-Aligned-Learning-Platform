import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import {
  Button,
  ConfirmButton,
  FormActions,
  Panel,
  SelectField,
  StatStrip,
  TextAreaField,
  TextField,
  Toolbar,
  useFeedback,
  validateFormFields,
} from '@stemora/ui';
import { ControlLayout } from '../../layout/ControlLayout';
import { StatusPill, WORKSPACE_API, WorkspaceGuard, formatWhen } from './shared';
import { workspacePageStyles } from './styles';

type NotificationRow = {
  id: number;
  title: string;
  body: string;
  channel: string;
  audience: string;
  status: string;
  sent_at?: string | null;
};

const P = 'ntf-';

export function SchoolNotificationsPage() {
  return (
    <WorkspaceGuard navPermission="nav.control.notifications">
      <ControlLayout
        title="Notifications"
        subtitle="Draft and send school announcements to staff, parents, or students"
      >
        <NotificationsWorkspace />
      </ControlLayout>
    </WorkspaceGuard>
  );
}

function NotificationsWorkspace() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'create'>('view');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    body: '',
    channel: 'in_app',
    audience: 'all',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: NotificationRow[]; meta: { stats: Record<string, number> } }>(
        `${WORKSPACE_API}/notifications`,
      );
      setRows(res.data);
      setStats(res.meta.stats);
      setSelectedId((c) => (c && res.data.some((r) => r.id === c) ? c : res.data[0]?.id ?? null));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!validateFormFields(e.currentTarget)) return;
    setSaving(true);
    try {
      await api.post(`${WORKSPACE_API}/notifications`, form);
      await feedback.success({ title: 'Draft saved', message: 'Notification created as draft.' });
      setMode('view');
      setForm({ title: '', body: '', channel: 'in_app', audience: 'all' });
      await load();
    } catch (err) {
      await feedback.error({
        title: 'Save failed',
        message: err instanceof Error ? err.message : 'Unable to save.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function sendSelected() {
    if (!selected) return;
    try {
      await api.post(`${WORKSPACE_API}/notifications/${selected.id}/send`, {});
      await feedback.success({ title: 'Sent', message: 'Notification marked as sent.' });
      await load();
    } catch (err) {
      await feedback.error({
        title: 'Send failed',
        message: err instanceof Error ? err.message : 'Unable to send.',
      });
    }
  }

  return (
    <div className={`${P}page`}>
      <style>{workspacePageStyles(P)}</style>
      <section className={`${P}hero`}>
        <div>
          <p className={`${P}eyebrow`}>Control · Communications</p>
          <h2 className={`${P}hero-title`}>Notifications</h2>
          <p className={`${P}hero-lead`}>
            Compose school-wide messages and send them to the right audience when ready.
          </p>
        </div>
        <div className={`${P}hero-actions`}>
          <div className={`${P}action-row`}>
            <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
              Refresh
            </Button>
            <Button size="sm" type="button" variant="primary" onClick={() => setMode('create')}>
              + New notification
            </Button>
          </div>
        </div>
      </section>

      {stats ? (
        <StatStrip
          items={[
            { label: 'Total', value: stats.total ?? 0 },
            { label: 'Drafts', value: stats.draft ?? 0 },
            { label: 'Sent', value: stats.sent ?? 0 },
          ]}
        />
      ) : null}

      {error ? (
        <div className={`${P}alert`} role="alert">
          <span>{error}</span>
          <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : null}

      <div className={`${P}layout`}>
        <Panel title="Notification inbox" description="Select a message to review or send.">
          <Toolbar />
          <div className={`${P}table-wrap`}>
            <table className={`${P}table`}>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Audience</th>
                  <th>Channel</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className={`${P}empty`}>
                      Loading…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={`${P}empty`}>
                      No notifications yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      className={selectedId === row.id && mode === 'view' ? 'is-selected' : undefined}
                      onClick={() => {
                        setMode('view');
                        setSelectedId(row.id);
                      }}
                    >
                      <td>
                        <strong>{row.title}</strong>
                      </td>
                      <td>{row.audience}</td>
                      <td>{row.channel}</td>
                      <td>
                        <StatusPill prefix={P} status={row.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <aside className={`${P}side`}>
          {mode === 'create' ? (
            <Panel title="Compose notification">
              <form onSubmit={onSave} className={`${P}form`} noValidate>
                <TextField
                  label="Title"
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
                <TextAreaField
                  label="Body"
                  required
                  value={form.body}
                  onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                />
                <SelectField
                  label="Channel"
                  value={form.channel}
                  onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
                >
                  <option value="in_app">In-app</option>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                </SelectField>
                <SelectField
                  label="Audience"
                  value={form.audience}
                  onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}
                >
                  <option value="all">Everyone</option>
                  <option value="staff">Staff</option>
                  <option value="parents">Parents</option>
                  <option value="students">Students</option>
                </SelectField>
                <FormActions>
                  <Button size="sm" type="button" variant="secondary" onClick={() => setMode('view')}>
                    Cancel
                  </Button>
                  <Button size="sm" type="submit" variant="primary" disabled={saving}>
                    {saving ? 'Saving…' : 'Save draft'}
                  </Button>
                </FormActions>
              </form>
            </Panel>
          ) : selected ? (
            <div className={`${P}detail`}>
              <div className={`${P}detail-head`}>
                <div>
                  <h3>{selected.title}</h3>
                  <p>
                    {selected.channel} · {selected.audience}
                  </p>
                </div>
              </div>
              <p>{selected.body}</p>
              <dl className={`${P}meta`}>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <StatusPill prefix={P} status={selected.status} />
                  </dd>
                </div>
                <div>
                  <dt>Sent</dt>
                  <dd>{formatWhen(selected.sent_at)}</dd>
                </div>
              </dl>
              {selected.status !== 'sent' ? (
                <div className={`${P}actions`}>
                  <ConfirmButton
                    size="sm"
                    title="Send notification?"
                    message="This will mark the message as sent to the selected audience."
                    confirmLabel="Send"
                    tone="primary"
                    variant="primary"
                    onConfirm={sendSelected}
                  >
                    Send now
                  </ConfirmButton>
                </div>
              ) : null}
            </div>
          ) : (
            <div className={`${P}empty-side`}>Select a notification to review.</div>
          )}
        </aside>
      </div>
    </div>
  );
}

type AuditRow = {
  id: number;
  action: string;
  actor_email?: string | null;
  subject_type?: string | null;
  created_at?: string | null;
  description?: string | null;
};

export function SchoolAuditLogsPage() {
  return (
    <WorkspaceGuard navPermission={['nav.control.audit-logs', 'audit.logs.view']}>
      <ControlLayout title="Audit logs" subtitle="School-scoped activity for accountability and review">
        <AuditWorkspace />
      </ControlLayout>
    </WorkspaceGuard>
  );
}

function AuditWorkspace() {
  const { api } = useAuth();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const P = 'aud-';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      const qs = params.toString();
      const res = await api.get<{ data: AuditRow[]; meta: { stats: Record<string, number> } }>(
        `${WORKSPACE_API}/audit-logs${qs ? `?${qs}` : ''}`,
      );
      setRows(res.data);
      setStats(res.meta.stats);
      setSelectedId(res.data[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [api, search]);

  useEffect(() => {
    void load();
  }, [api]);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  return (
    <div className={`${P}page`}>
      <style>{workspacePageStyles(P)}</style>
      <section className={`${P}hero`}>
        <div>
          <p className={`${P}eyebrow`}>Control · Compliance</p>
          <h2 className={`${P}hero-title`}>Audit logs</h2>
          <p className={`${P}hero-lead`}>
            Review who changed what across your school workspace — useful for compliance and support.
          </p>
        </div>
        <div className={`${P}hero-actions`}>
          <div className={`${P}action-row`}>
            <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
              Refresh
            </Button>
            <Link className={`${P}ghost-link`} to="/settings">
              Organisation settings
            </Link>
          </div>
        </div>
      </section>

      {stats ? (
        <StatStrip
          items={[
            { label: 'Events', value: stats.total ?? rows.length },
            { label: 'Today', value: stats.today ?? '—' },
          ]}
        />
      ) : null}

      {error ? (
        <div className={`${P}alert`} role="alert">
          <span>{error}</span>
          <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : null}

      <div className={`${P}layout`}>
        <Panel title="Activity" description="Most recent school audit events.">
          <Toolbar>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void load();
              }}
              className={`${P}filters`}
            >
              <TextField
                label="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Action or actor"
              />
              <Button size="sm" type="submit" variant="secondary">
                Apply
              </Button>
            </form>
          </Toolbar>
          <div className={`${P}table-wrap`}>
            <table className={`${P}table`}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>Actor</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className={`${P}empty`}>
                      Loading…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className={`${P}empty`}>
                      No audit events yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      className={selectedId === row.id ? 'is-selected' : undefined}
                      onClick={() => setSelectedId(row.id)}
                    >
                      <td>{formatWhen(row.created_at)}</td>
                      <td>
                        <strong>{row.action}</strong>
                      </td>
                      <td>{row.actor_email ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>
        <aside className={`${P}side`}>
          {selected ? (
            <div className={`${P}detail`}>
              <div className={`${P}detail-head`}>
                <div>
                  <h3>{selected.action}</h3>
                  <p>{selected.actor_email ?? 'System'}</p>
                </div>
              </div>
              <dl className={`${P}meta`}>
                <div>
                  <dt>When</dt>
                  <dd>{formatWhen(selected.created_at)}</dd>
                </div>
                <div>
                  <dt>Subject</dt>
                  <dd>{selected.subject_type ?? '—'}</dd>
                </div>
                <div>
                  <dt>Detail</dt>
                  <dd>{selected.description ?? '—'}</dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className={`${P}empty-side`}>Select an event to inspect.</div>
          )}
        </aside>
      </div>
    </div>
  );
}
