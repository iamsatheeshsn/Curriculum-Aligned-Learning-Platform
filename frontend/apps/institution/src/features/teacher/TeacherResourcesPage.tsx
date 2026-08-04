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
  arabicTitle,
  formatDate,
} from './shared';

type ResourceType = 'video' | 'pdf' | 'image' | 'audio' | 'other';

type Resource = {
  id: number;
  type: ResourceType;
  title_en: string;
  title_ar: string | null;
  external_url: string | null;
  disk_path: string | null;
  mime_type: string | null;
  duration_seconds: number | null;
  size_bytes: number | null;
  is_global: boolean;
  editable: boolean;
  created_at: string | null;
};

type Stats = { total: number } & Record<ResourceType, number>;

type ResourceForm = {
  type: ResourceType;
  title_en: string;
  title_ar: string;
  external_url: string;
  disk_path: string;
  mime_type: string;
  duration_seconds: string;
};

const TYPE_META: Record<ResourceType, { label: string; icon: string }> = {
  video: { label: 'Video', icon: '🎬' },
  pdf: { label: 'PDF', icon: '📄' },
  image: { label: 'Image', icon: '🖼️' },
  audio: { label: 'Audio', icon: '🎧' },
  other: { label: 'Other', icon: '📎' },
};

const TYPE_ORDER: ResourceType[] = ['video', 'pdf', 'image', 'audio', 'other'];

const emptyStats: Stats = { total: 0, video: 0, pdf: 0, image: 0, audio: 0, other: 0 };

const emptyForm = (): ResourceForm => ({
  type: 'video',
  title_en: '',
  title_ar: '',
  external_url: '',
  disk_path: '',
  mime_type: '',
  duration_seconds: '',
});

function formatSize(bytes: number | null) {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}

function formatDuration(seconds: number | null) {
  if (!seconds || seconds <= 0) return '—';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

function hostOf(url: string | null) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Videos and audio read better as a running time and files as a size, but linked
 * material has neither — show where it lives instead of an empty measurement.
 */
function primaryMeasure(resource: Resource) {
  if (resource.type === 'video' || resource.type === 'audio') {
    if (resource.duration_seconds) {
      return { label: 'Duration', value: formatDuration(resource.duration_seconds) };
    }
  } else if (resource.size_bytes) {
    return { label: 'Size', value: formatSize(resource.size_bytes) };
  }
  const host = hostOf(resource.external_url);
  if (host) return { label: 'Hosted on', value: host };
  return { label: 'Stored at', value: resource.disk_path ?? '—' };
}

export function TeacherResourcesPage() {
  const { api } = useAuth();
  const feedback = useFeedback();

  const [rows, setRows] = useState<Resource[]>([]);
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view');
  const [form, setForm] = useState<ResourceForm>(emptyForm());

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'' | ResourceType>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set('type', typeFilter);
      const query = params.toString();
      const res = await api.get<{ data: Resource[]; meta: { stats: Stats } }>(
        `${TEACHER_API}/resources${query ? `?${query}` : ''}`
      );
      setRows(res.data ?? []);
      setStats(res.meta?.stats ?? emptyStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your resources.');
    } finally {
      setLoading(false);
    }
  }, [api, typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (row) =>
        row.title_en.toLowerCase().includes(term) ||
        (row.title_ar ?? '').toLowerCase().includes(term) ||
        (row.external_url ?? '').toLowerCase().includes(term) ||
        (row.mime_type ?? '').toLowerCase().includes(term)
    );
  }, [rows, search]);

  const listPage = useClientPagination(filtered);
  const selected = useMemo(() => rows.find((row) => row.id === selectedId) ?? null, [rows, selectedId]);
  const showingForm = mode === 'create' || mode === 'edit';

  function startCreate() {
    setMode('create');
    setSelectedId(null);
    setForm({ ...emptyForm(), type: typeFilter || 'video' });
  }

  function startEdit(resource: Resource) {
    setMode('edit');
    setSelectedId(resource.id);
    setForm({
      type: resource.type,
      title_en: resource.title_en,
      title_ar: resource.title_ar ?? '',
      external_url: resource.external_url ?? '',
      disk_path: resource.disk_path ?? '',
      mime_type: resource.mime_type ?? '',
      duration_seconds: resource.duration_seconds ? String(resource.duration_seconds) : '',
    });
  }

  function cancelForm() {
    setMode('view');
    setForm(emptyForm());
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateFormFields(event.currentTarget)) return;

    const externalUrl = form.external_url.trim();
    const diskPath = form.disk_path.trim();
    if (!externalUrl && !diskPath) {
      setError('Add either a link or a storage path so the resource can be opened.');
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      type: form.type,
      title_en: form.title_en.trim(),
      title_ar: form.title_ar.trim() || null,
      external_url: externalUrl || null,
      disk_path: diskPath || null,
      mime_type: form.mime_type.trim() || null,
      duration_seconds: form.duration_seconds ? Number(form.duration_seconds) : null,
    };

    try {
      if (mode === 'create') {
        const res = await api.post<{ message: string; data: Resource }>(`${TEACHER_API}/resources`, payload);
        await load();
        setMode('view');
        setSelectedId(res.data.id);
        await feedback.success({ title: 'Resource added', message: `“${res.data.title_en}” is now in your library.` });
      } else if (selectedId) {
        const res = await api.request<{ message: string; data: Resource }>(`${TEACHER_API}/resources/${selectedId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        await load();
        setMode('view');
        await feedback.success({ title: 'Resource updated', message: `“${res.data.title_en}” has been saved.` });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the resource.');
    } finally {
      setSaving(false);
    }
  }

  async function removeResource(resource: Resource) {
    try {
      await api.request(`${TEACHER_API}/resources/${resource.id}`, { method: 'DELETE' });
      setSelectedId(null);
      setMode('view');
      await load();
      await feedback.success({ title: 'Resource deleted', message: `“${resource.title_en}” was removed.` });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the resource.');
    }
  }

  return (
    <TeacherShell
      title="Resources"
      subtitle="Curate the videos, documents, and media you teach with"
      headerActions={
        <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      }
    >
      <div className="tp-page">
        <section className="tp-hero stem-animate-rise">
          <div className="tp-hero-copy">
            <p className="tp-eyebrow">Teacher portal · Resources</p>
            <h2 className="tp-hero-title">Teaching resources</h2>
            <p className="tp-hero-lead">
              Keep the links, documents, and media you use in class in one place. Resources from the shared school
              library are read-only, while anything you add here stays yours to edit.
            </p>
          </div>
          <div className="tp-hero-actions">
            <Button size="sm" type="button" variant="primary" onClick={startCreate}>
              New resource
            </Button>
          </div>
        </section>

        <ErrorBanner error={error} onDismiss={() => setError(null)} />

        <StatStrip
          items={[
            { label: 'Total resources', value: String(stats.total) },
            { label: 'Video', value: String(stats.video), hint: 'Clips and recordings' },
            { label: 'PDF', value: String(stats.pdf), hint: 'Worksheets and readings' },
            {
              label: 'Media & links',
              value: String(stats.image + stats.audio + stats.other),
              hint: 'Images, audio, and links',
            },
          ]}
        />

        <div className="tk-toolbar">
          <label className="tk-field tk-field-grow">
            <span>Search</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title or link"
              aria-label="Search resources"
            />
          </label>
          <div className="tk-toolbar-actions">
            <div className="tk-tabs" role="tablist" aria-label="Filter by resource type">
              <button
                type="button"
                role="tab"
                aria-selected={typeFilter === ''}
                className={typeFilter === '' ? 'is-active' : undefined}
                onClick={() => setTypeFilter('')}
              >
                All
                <span className="tk-tab-count">{stats.total}</span>
              </button>
              {TYPE_ORDER.map((type) => (
                <button
                  key={type}
                  type="button"
                  role="tab"
                  aria-selected={typeFilter === type}
                  className={typeFilter === type ? 'is-active' : undefined}
                  onClick={() => setTypeFilter(type)}
                >
                  {TYPE_META[type].label}
                  <span className="tk-tab-count">{stats[type]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="tp-layout">
          <Panel
            title="Your library"
            description={
              loading
                ? 'Loading…'
                : `${filtered.length} resource${filtered.length === 1 ? '' : 's'} — select one to see its detail.`
            }
          >
            {filtered.length === 0 && !loading ? (
              <EmptyState
                title="No resources yet"
                message="Add a link to a video, a worksheet, or any other material you want to reach quickly during a lesson."
                action={
                  <Button size="sm" type="button" variant="primary" onClick={startCreate}>
                    New resource
                  </Button>
                }
              />
            ) : (
              <>
                <div className="tk-grid">
                  {listPage.pageItems.map((resource) => {
                    const meta = TYPE_META[resource.type];
                    const measure = primaryMeasure(resource);
                    return (
                      <button
                        key={resource.id}
                        type="button"
                        className={`tk-card${
                          selectedId === resource.id && mode !== 'create' ? ' is-selected' : ''
                        }`}
                        onClick={() => {
                          setMode('view');
                          setSelectedId(resource.id);
                        }}
                      >
                        <div className="tk-card-head">
                          <h3 className="tk-card-title">
                            <span aria-hidden="true">{meta.icon}</span> {resource.title_en}
                          </h3>
                          <Pill label={meta.label} tone={resource.editable ? 'info' : 'muted'} />
                        </div>
                        {arabicTitle(resource.title_ar, resource.title_en) ? (
                          <p className="tk-card-sub">{arabicTitle(resource.title_ar, resource.title_en)}</p>
                        ) : null}
                        <div className="tk-card-foot">
                          <span>
                            {measure.label} <strong>{measure.value}</strong>
                          </span>
                          {resource.editable ? null : <span>Shared library</span>}
                        </div>
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
            {showingForm ? (
              <Panel title={mode === 'create' ? 'New resource' : 'Edit resource'}>
                <form className="tp-form" onSubmit={onSave} noValidate>
                  <TextField
                    label="Title"
                    required
                    maxLength={255}
                    value={form.title_en}
                    onChange={(event) => setForm({ ...form, title_en: event.target.value })}
                    placeholder="e.g. Photosynthesis explainer"
                  />
                  <TextField
                    label="Arabic title"
                    maxLength={255}
                    value={form.title_ar}
                    onChange={(event) => setForm({ ...form, title_ar: event.target.value })}
                  />
                  <SelectField
                    label="Type"
                    value={form.type}
                    onChange={(event) => setForm({ ...form, type: event.target.value as ResourceType })}
                  >
                    {TYPE_ORDER.map((type) => (
                      <option key={type} value={type}>
                        {TYPE_META[type].label}
                      </option>
                    ))}
                  </SelectField>
                  <TextField
                    label="Link"
                    type="url"
                    value={form.external_url}
                    onChange={(event) => setForm({ ...form, external_url: event.target.value })}
                    placeholder="https://…"
                    hint="Provide a link or a storage path — at least one is required."
                  />
                  <TextField
                    label="Storage path"
                    value={form.disk_path}
                    onChange={(event) => setForm({ ...form, disk_path: event.target.value })}
                    placeholder="e.g. resources/biology/photosynthesis.pdf"
                  />
                  <div className="tp-form-grid">
                    <TextField
                      label="MIME type"
                      value={form.mime_type}
                      onChange={(event) => setForm({ ...form, mime_type: event.target.value })}
                      placeholder="e.g. application/pdf"
                    />
                    <TextField
                      label="Duration (seconds)"
                      type="number"
                      min={0}
                      value={form.duration_seconds}
                      onChange={(event) => setForm({ ...form, duration_seconds: event.target.value })}
                      hint="Video and audio only."
                    />
                  </div>
                  <FormActions>
                    <Button size="sm" type="submit" variant="primary" disabled={saving}>
                      {saving ? 'Saving…' : mode === 'create' ? 'Add resource' : 'Save changes'}
                    </Button>
                    <Button size="sm" type="button" variant="secondary" onClick={cancelForm} disabled={saving}>
                      Cancel
                    </Button>
                  </FormActions>
                </form>
              </Panel>
            ) : selected ? (
              <Panel title="Resource detail" description={selected.title_en}>
                <div className="tk-detail-scroll tk-stack">
                  <dl className="tp-meta">
                    <div>
                      <dt>Type</dt>
                      <dd>
                        <Pill label={TYPE_META[selected.type].label} tone="info" />
                      </dd>
                    </div>
                    {arabicTitle(selected.title_ar, selected.title_en) ? (
                      <div>
                        <dt>Arabic title</dt>
                        <dd>{arabicTitle(selected.title_ar, selected.title_en)}</dd>
                      </div>
                    ) : null}
                    {selected.duration_seconds ? (
                      <div>
                        <dt>Duration</dt>
                        <dd>{formatDuration(selected.duration_seconds)}</dd>
                      </div>
                    ) : null}
                    {selected.size_bytes ? (
                      <div>
                        <dt>Size</dt>
                        <dd>{formatSize(selected.size_bytes)}</dd>
                      </div>
                    ) : null}
                    {selected.mime_type ? (
                      <div>
                        <dt>Format</dt>
                        <dd>{selected.mime_type}</dd>
                      </div>
                    ) : null}
                    {selected.disk_path ? (
                      <div>
                        <dt>Storage path</dt>
                        <dd>{selected.disk_path}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>Added</dt>
                      <dd>{formatDate(selected.created_at)}</dd>
                    </div>
                    <div>
                      <dt>Scope</dt>
                      <dd>
                        <Pill
                          label={selected.is_global ? 'Shared library' : 'My library'}
                          tone={selected.is_global ? 'muted' : 'ok'}
                        />
                      </dd>
                    </div>
                  </dl>

                  {selected.external_url ? (
                    <div className="tk-note-block">
                      <h4>Link</h4>
                      <p className="tk-note">{selected.external_url}</p>
                    </div>
                  ) : null}
                </div>

                <div className="tp-actions">
                  {selected.external_url ? (
                    <Button
                      size="sm"
                      type="button"
                      variant="secondary"
                      onClick={() => window.open(selected.external_url ?? '', '_blank', 'noopener')}
                    >
                      Open resource
                    </Button>
                  ) : null}
                  {selected.editable ? (
                    <>
                      <Button size="sm" type="button" variant="secondary" onClick={() => startEdit(selected)}>
                        Edit
                      </Button>
                      <ConfirmButton
                        size="sm"
                        variant="danger"
                        tone="danger"
                        title="Delete resource?"
                        message={`“${selected.title_en}” will be permanently removed from your library.`}
                        confirmLabel="Delete"
                        onConfirm={() => removeResource(selected)}
                      >
                        Delete
                      </ConfirmButton>
                    </>
                  ) : (
                    <Pill label="Shared library" tone="muted" />
                  )}
                </div>
              </Panel>
            ) : (
              <Panel title="Resource detail">
                <EmptyState
                  title="Nothing selected"
                  message="Choose a resource to see its link, format, and where it is stored."
                  action={
                    <Button size="sm" type="button" variant="primary" onClick={startCreate}>
                      New resource
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
