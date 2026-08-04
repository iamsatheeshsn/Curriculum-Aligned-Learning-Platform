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
  TEACHER_API,
  TeacherShell,
  formatDate,
  formatDateTime,
  initials,
} from './shared';

type MessageCategory = 'general' | 'academic' | 'behaviour' | 'attendance' | 'parent';

type Box = 'inbox' | 'sent';

type Message = {
  id: number;
  subject: string;
  body: string;
  category: string;
  read_at: string | null;
  created_at: string | null;
  sender_id: number;
  sender: string;
  recipient_id: number;
  recipient: string;
  direction: Box;
};

type Recipient = {
  id: number;
  name: string;
  email: string;
  is_student: boolean;
};

type Stats = { inbox: number; unread: number; sent: number };

type ComposeForm = {
  recipient_user_id: string;
  category: MessageCategory;
  subject: string;
  body: string;
};

const CATEGORIES: { value: MessageCategory; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'academic', label: 'Academic' },
  { value: 'behaviour', label: 'Behaviour' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'parent', label: 'Parent' },
];

const emptyForm = (): ComposeForm => ({
  recipient_user_id: '',
  category: 'general',
  subject: '',
  body: '',
});

/** Compact list timestamp: clock time for today, short date for anything older. */
function shortWhen(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  if (date.toDateString() === new Date().toDateString()) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return formatDate(value);
}

export function TeacherMessagesPage() {
  const { api } = useAuth();
  const feedback = useFeedback();

  const [box, setBox] = useState<Box>('inbox');
  const [rows, setRows] = useState<Message[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [stats, setStats] = useState<Stats>({ inbox: 0, unread: 0, sent: 0 });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);
  const [replying, setReplying] = useState(false);
  const [form, setForm] = useState<ComposeForm>(emptyForm());

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  /**
   * Messages marked read during this visit. Tracked separately from `rows` so a read
   * receipt does not rebuild the list array and reset the reader back to page one.
   */
  const [readIds, setReadIds] = useState<number[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ box });
      if (categoryFilter) params.set('category', categoryFilter);
      const res = await api.get<{ data: Message[]; meta: { box: string; stats: Stats } }>(
        `${TEACHER_API}/messages?${params.toString()}`
      );
      setRows(res.data ?? []);
      setStats(res.meta?.stats ?? { inbox: 0, unread: 0, sent: 0 });
      setReadIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your messages.');
    } finally {
      setLoading(false);
    }
  }, [api, box, categoryFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let active = true;
    api
      .get<{ data: Recipient[] }>(`${TEACHER_API}/messages/recipients`)
      .then((res) => {
        if (active) setRecipients(res.data ?? []);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load your contact list.');
      });
    return () => {
      active = false;
    };
  }, [api]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (row) =>
        row.subject.toLowerCase().includes(term) ||
        row.body.toLowerCase().includes(term) ||
        row.sender.toLowerCase().includes(term) ||
        row.recipient.toLowerCase().includes(term)
    );
  }, [rows, search]);

  const listPage = useClientPagination(filtered);
  const selected = useMemo(() => rows.find((row) => row.id === selectedId) ?? null, [rows, selectedId]);

  const staffRecipients = useMemo(() => recipients.filter((person) => !person.is_student), [recipients]);
  const studentRecipients = useMemo(() => recipients.filter((person) => person.is_student), [recipients]);

  /** A reply target is not always in the directory, so keep it selectable in the picker. */
  const replyTarget = useMemo(() => {
    const id = Number(form.recipient_user_id);
    if (!id || recipients.some((person) => person.id === id)) return null;
    if (selected && selected.sender_id === id) return { id, name: selected.sender };
    return null;
  }, [form.recipient_user_id, recipients, selected]);

  function isUnread(message: Message) {
    return message.direction === 'inbox' && !message.read_at && !readIds.includes(message.id);
  }

  const markRead = useCallback(
    async (message: Message) => {
      setReadIds((prev) => (prev.includes(message.id) ? prev : [...prev, message.id]));
      setStats((prev) => ({ ...prev, unread: Math.max(0, prev.unread - 1) }));
      try {
        await api.post<{ message: string; data: { id: number } }>(`${TEACHER_API}/messages/${message.id}/read`, {});
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not mark the message as read.');
      }
    },
    [api]
  );

  function openMessage(message: Message) {
    setComposing(false);
    setSelectedId(message.id);
    if (isUnread(message)) void markRead(message);
  }

  function startCompose() {
    setComposing(true);
    setReplying(false);
    setSelectedId(null);
    setForm(emptyForm());
  }

  function startReply(message: Message) {
    setComposing(true);
    setReplying(true);
    setForm({
      recipient_user_id: String(message.sender_id),
      category: CATEGORIES.find((item) => item.value === message.category)?.value ?? 'general',
      subject: message.subject.startsWith('Re: ') ? message.subject : `Re: ${message.subject}`,
      body: '',
    });
  }

  function cancelCompose() {
    setComposing(false);
    setReplying(false);
    setForm(emptyForm());
  }

  async function onSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateFormFields(event.currentTarget)) return;
    setSending(true);
    setError(null);

    try {
      await api.post<{ message: string; data: { id: number } }>(`${TEACHER_API}/messages`, {
        recipient_user_id: Number(form.recipient_user_id),
        subject: form.subject.trim(),
        body: form.body.trim(),
        category: form.category,
      });
      cancelCompose();
      await load();
      await feedback.success({ title: 'Message sent', message: 'Your message has been delivered.' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the message.');
    } finally {
      setSending(false);
    }
  }

  async function markAllRead() {
    try {
      await api.post<{ message: string; data: { updated: number } }>(`${TEACHER_API}/messages/read-all`, {});
      await load();
      await feedback.success({ title: 'Inbox cleared', message: 'Every message is now marked as read.' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mark your inbox as read.');
    }
  }

  async function removeMessage(message: Message) {
    try {
      await api.request(`${TEACHER_API}/messages/${message.id}`, { method: 'DELETE' });
      setSelectedId(null);
      await load();
      await feedback.success({ title: 'Message deleted', message: `“${message.subject}” was removed.` });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the message.');
    }
  }

  return (
    <TeacherShell
      title="Messages"
      subtitle="Your school inbox"
      headerActions={
        <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      }
    >
      <div className="tp-page">
        <section className="tp-hero stem-animate-rise">
          <div className="tp-hero-copy">
            <p className="tp-eyebrow">Teacher portal · Communication</p>
            <h2 className="tp-hero-title">Messages</h2>
            <p className="tp-hero-lead">
              Keep in touch with colleagues, students, and parents from one place. Read what has arrived, reply
              without losing the thread, and start a new conversation whenever you need to.
            </p>
          </div>
          <div className="tp-hero-actions">
            <Button size="sm" type="button" variant="primary" onClick={startCompose}>
              Compose
            </Button>
            <Button
              size="sm"
              type="button"
              variant="secondary"
              disabled={stats.unread === 0}
              onClick={() => void markAllRead()}
            >
              Mark all read
            </Button>
          </div>
        </section>

        <ErrorBanner error={error} onDismiss={() => setError(null)} />

        <StatStrip
          items={[
            { label: 'Inbox', value: String(stats.inbox), hint: 'Messages you have received' },
            { label: 'Unread', value: String(stats.unread), hint: 'Waiting for your attention' },
            { label: 'Sent', value: String(stats.sent), hint: 'Messages you have sent' },
          ]}
        />

        <div className="tk-tabs" role="tablist" aria-label="Mailbox">
          <button
            type="button"
            role="tab"
            aria-selected={box === 'inbox'}
            className={box === 'inbox' ? 'is-active' : undefined}
            onClick={() => {
              setBox('inbox');
              setSelectedId(null);
            }}
          >
            Inbox
            <span className="tk-tab-count">{stats.inbox}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={box === 'sent'}
            className={box === 'sent' ? 'is-active' : undefined}
            onClick={() => {
              setBox('sent');
              setSelectedId(null);
            }}
          >
            Sent
            <span className="tk-tab-count">{stats.sent}</span>
          </button>
        </div>

        <div className="tk-toolbar">
          <label className="tk-field tk-field-grow">
            <span>Search</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by subject, sender, or wording"
              aria-label="Search messages"
            />
          </label>
          <label className="tk-field">
            <span>Category</span>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="">All categories</option>
              {CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="tp-layout">
          <Panel
            title={box === 'inbox' ? 'Inbox' : 'Sent'}
            description={
              loading
                ? 'Loading…'
                : `${filtered.length} message${filtered.length === 1 ? '' : 's'} — select one to read it in full.`
            }
          >
            {filtered.length === 0 && !loading ? (
              <EmptyState
                title={box === 'inbox' ? 'No messages here' : 'Nothing sent yet'}
                message={
                  box === 'inbox'
                    ? 'When a colleague, student, or parent writes to you, their message will appear in this list.'
                    : 'Messages you send will be kept here so you can look back at what you told someone.'
                }
                action={
                  <Button size="sm" type="button" variant="primary" onClick={startCompose}>
                    Compose
                  </Button>
                }
              />
            ) : (
              <>
                <div className="tk-thread">
                  {listPage.pageItems.map((message) => {
                    const unread = isUnread(message);
                    const counterparty = box === 'inbox' ? message.sender : message.recipient;
                    return (
                      <button
                        key={message.id}
                        type="button"
                        className={`tk-message${unread ? ' is-unread' : ''}${
                          selectedId === message.id ? ' is-selected' : ''
                        }`}
                        aria-pressed={selectedId === message.id}
                        onClick={() => openMessage(message)}
                      >
                        <div className="tk-message-head">
                          <strong>{counterparty}</strong>
                          <span className="tk-row">
                            {unread ? <Pill label="Unread" tone="info" /> : null}
                            <time dateTime={message.created_at ?? undefined}>{shortWhen(message.created_at)}</time>
                          </span>
                        </div>
                        <strong>{message.subject}</strong>
                        <p className="tk-message-preview">{message.body}</p>
                      </button>
                    );
                  })}
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
            {composing ? (
              <Panel title={replying ? 'Reply' : 'New message'}>
                <form className="tp-form" onSubmit={onSend} noValidate>
                  <SelectField
                    label="Recipient"
                    required
                    value={form.recipient_user_id}
                    onChange={(event) => setForm({ ...form, recipient_user_id: event.target.value })}
                  >
                    <option value="">Choose someone to write to</option>
                    {replyTarget ? <option value={replyTarget.id}>{replyTarget.name}</option> : null}
                    {staffRecipients.length ? (
                      <optgroup label="Staff">
                        {staffRecipients.map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.name} — {person.email}
                          </option>
                        ))}
                      </optgroup>
                    ) : null}
                    {studentRecipients.length ? (
                      <optgroup label="Students">
                        {studentRecipients.map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.name} (student)
                          </option>
                        ))}
                      </optgroup>
                    ) : null}
                  </SelectField>
                  <SelectField
                    label="Category"
                    value={form.category}
                    onChange={(event) => setForm({ ...form, category: event.target.value as MessageCategory })}
                    hint="Helps the recipient see what the message is about."
                  >
                    {CATEGORIES.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </SelectField>
                  <TextField
                    label="Subject"
                    required
                    maxLength={255}
                    value={form.subject}
                    onChange={(event) => setForm({ ...form, subject: event.target.value })}
                    placeholder="e.g. Homework for this week"
                  />
                  <TextAreaField
                    label="Message"
                    required
                    rows={8}
                    value={form.body}
                    onChange={(event) => setForm({ ...form, body: event.target.value })}
                    placeholder="Write your message…"
                  />
                  <FormActions>
                    <Button size="sm" type="submit" variant="primary" disabled={sending}>
                      {sending ? 'Sending…' : 'Send'}
                    </Button>
                    <Button size="sm" type="button" variant="secondary" onClick={cancelCompose} disabled={sending}>
                      Cancel
                    </Button>
                  </FormActions>
                </form>
              </Panel>
            ) : selected ? (
              <Panel title="Message" description={selected.subject}>
                <div className="tk-detail-scroll tk-stack">
                  <div className="tk-person">
                    <span className="tk-avatar" aria-hidden="true">
                      {initials(selected.direction === 'inbox' ? selected.sender : selected.recipient)}
                    </span>
                    <div>
                      <strong>{selected.direction === 'inbox' ? selected.sender : selected.recipient}</strong>
                      <span>{selected.direction === 'inbox' ? 'Wrote to you' : 'You wrote to them'}</span>
                    </div>
                  </div>
                  <div className="tk-row">
                    <Pill label={selected.category} />
                    <span className="tp-muted">{formatDateTime(selected.created_at)}</span>
                  </div>
                  <p className="tk-message-body">{selected.body}</p>
                </div>

                <div className="tp-actions">
                  <Button size="sm" type="button" variant="secondary" onClick={() => startReply(selected)}>
                    Reply
                  </Button>
                  <ConfirmButton
                    size="sm"
                    variant="danger"
                    tone="danger"
                    title="Delete message?"
                    message={`“${selected.subject}” will be permanently removed from your mailbox.`}
                    confirmLabel="Delete"
                    onConfirm={() => removeMessage(selected)}
                  >
                    Delete
                  </ConfirmButton>
                </div>
              </Panel>
            ) : (
              <Panel title="Message">
                <EmptyState
                  title="Nothing selected"
                  message="Choose a message from the list to read it in full, or compose a new one."
                  action={
                    <Button size="sm" type="button" variant="primary" onClick={startCompose}>
                      Compose
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
