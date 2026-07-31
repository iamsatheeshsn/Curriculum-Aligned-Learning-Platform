import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import {
  Button,
  ConfirmButton,
  FormActions,
  Panel,
  SelectField,
  StatStrip,
  TextField,
  Toolbar,
  useFeedback,
  validateFormFields,
} from '@stemora/ui';
import { ControlLayout } from '../../layout/ControlLayout';

type CountryOption = {
  id: number;
  code: string;
  name_en: string;
  is_active?: boolean;
};

type CurriculumRow = {
  id: number;
  code: string;
  name_en: string;
  name_ar: string;
  version: string;
  status: string;
  is_latest: boolean;
  is_platform: boolean;
  is_editable: boolean;
  country_id: number;
  country: { id: number; code: string; name_en: string; name_ar?: string | null } | null;
  school_id: number | null;
  tenant_id: number | null;
  published_at?: string | null;
  change_summary_en?: string | null;
  change_summary_ar?: string | null;
  source_curriculum_id?: number | null;
  usage: {
    subjects: number;
    chapters: number;
    lessons: number;
    learning_outcomes: number;
    versions: number;
  };
  version_family?: {
    id: number;
    code: string;
    version: string;
    status: string;
    is_latest: boolean;
    published_at?: string | null;
  }[];
  version_logs?: {
    id: number;
    action: string;
    from_version?: string | null;
    to_version: string;
    summary_en?: string | null;
    created_at?: string | null;
  }[];
};

type CurriculumStats = {
  total: number;
  draft: number;
  in_review: number;
  published: number;
  superseded: number;
  platform: number;
  latest: number;
};

type CurriculumForm = {
  country_id: string;
  code: string;
  name_en: string;
  name_ar: string;
  version: string;
  status: 'draft' | 'in_review';
  change_summary_en: string;
  change_summary_ar: string;
};

const emptyForm = (): CurriculumForm => ({
  country_id: '',
  code: '',
  name_en: '',
  name_ar: '',
  version: '1.0',
  status: 'draft',
  change_summary_en: '',
  change_summary_ar: '',
});

function curriculumStatusLabel(status: string) {
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Platform and school curriculum frameworks with version lifecycle.
 */
export function CurriculumsPage() {
  const { isSuperAdmin, hasPermission } = useAuth();
  if (
    !isSuperAdmin &&
    !hasPermission([
      'platform.tenants.manage',
      'curriculum.manage',
      'nav.control.curriculum-management',
    ])
  ) {
    return <Navigate to="/" replace />;
  }

  return (
    <ControlLayout
      title="Curriculums"
      subtitle="Manage curriculum frameworks, versions, and publication lifecycle"
    >
      <CurriculumsWorkspace />
    </ControlLayout>
  );
}

function CurriculumsWorkspace() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [rows, setRows] = useState<CurriculumRow[]>([]);
  const [stats, setStats] = useState<CurriculumStats | null>(null);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<CurriculumRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [latestOnly, setLatestOnly] = useState(false);
  const [mode, setMode] = useState<'view' | 'create' | 'edit' | 'version'>('view');
  const [form, setForm] = useState<CurriculumForm>(emptyForm);
  const [versionForm, setVersionForm] = useState({ version: '', summary_en: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (countryFilter) params.set('country_id', countryFilter);
      if (scopeFilter && scopeFilter !== 'all') params.set('scope', scopeFilter);
      if (latestOnly) params.set('latest_only', '1');
      const qs = params.toString();
      const res = await api.get<{
        data: CurriculumRow[];
        meta: { stats: CurriculumStats };
      }>(`/control/curricula${qs ? `?${qs}` : ''}`);
      setRows(res.data);
      setStats(res.meta.stats);
      setSelectedId((current) => {
        if (mode === 'create') return current;
        if (current && res.data.some((r) => r.id === current)) return current;
        return res.data[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load curricula');
    } finally {
      setLoading(false);
    }
  }, [api, search, statusFilter, countryFilter, scopeFilter, latestOnly, mode]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get<{ data: CountryOption[] }>('/control/countries');
        setCountries(res.data.filter((c) => c.is_active !== false));
      } catch {
        /* countries dropdown is best-effort */
      }
    })();
  }, [api]);

  useEffect(() => {
    void load();
  }, [api, statusFilter, countryFilter, scopeFilter, latestOnly]);

  useEffect(() => {
    if (!selectedId || mode === 'create') {
      if (mode !== 'create') setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void (async () => {
      try {
        const res = await api.get<{ data: CurriculumRow }>(`/control/curricula/${selectedId}`);
        if (!cancelled) setDetail(res.data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load curriculum details');
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, selectedId, rows, mode]);

  const selectedSummary = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );
  const activeDetail = detail ?? selectedSummary;
  const showingForm = mode === 'create' || mode === 'edit';

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    await load();
  }

  function startCreate() {
    setMode('create');
    setForm({
      ...emptyForm(),
      country_id: countryFilter || (countries[0] ? String(countries[0].id) : ''),
    });
    setSelectedId(null);
    setDetail(null);
  }

  function startEdit(row: CurriculumRow) {
    setMode('edit');
    setSelectedId(row.id);
    setForm({
      country_id: String(row.country_id),
      code: row.code,
      name_en: row.name_en,
      name_ar: row.name_ar ?? '',
      version: row.version,
      status: row.status === 'in_review' ? 'in_review' : 'draft',
      change_summary_en: row.change_summary_en ?? '',
      change_summary_ar: row.change_summary_ar ?? '',
    });
  }

  function startNewVersion(row: CurriculumRow) {
    setMode('version');
    setSelectedId(row.id);
    const next = bumpVersion(row.version);
    setVersionForm({ version: next, summary_en: '' });
  }

  function cancelForm() {
    setMode('view');
    setForm(emptyForm());
    setVersionForm({ version: '', summary_en: '' });
    if (!selectedId && rows[0]) setSelectedId(rows[0].id);
  }

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateFormFields(e.currentTarget)) return;
    if (!form.country_id) {
      setError('Select a country for this curriculum.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (mode === 'create') {
        const res = await api.post<{ data: CurriculumRow }>('/control/curricula', {
          country_id: Number(form.country_id),
          code: form.code.trim(),
          name_en: form.name_en.trim(),
          name_ar: form.name_ar.trim() || form.name_en.trim(),
          version: form.version.trim() || '1.0',
          change_summary_en: form.change_summary_en.trim() || undefined,
          change_summary_ar: form.change_summary_ar.trim() || undefined,
        });
        setMode('view');
        setSelectedId(res.data.id);
        await load();
        await feedback.success({
          title: 'Curriculum created',
          message: `${res.data.name_en} v${res.data.version} is ready as a draft.`,
        });
      } else if (selectedId) {
        const res = await api.request<{ data: CurriculumRow }>(`/control/curricula/${selectedId}`, {
          method: 'PUT',
          body: JSON.stringify({
            country_id: Number(form.country_id),
            name_en: form.name_en.trim(),
            name_ar: form.name_ar.trim() || form.name_en.trim(),
            status: form.status,
            change_summary_en: form.change_summary_en.trim() || null,
            change_summary_ar: form.change_summary_ar.trim() || null,
          }),
        });
        setMode('view');
        await load();
        await feedback.success({
          title: 'Curriculum updated',
          message: `${res.data.name_en} has been saved.`,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save curriculum');
    } finally {
      setSaving(false);
    }
  }

  async function onCreateVersion(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedId || !versionForm.version.trim()) {
      setError('Enter a new version number.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await api.post<{ data: CurriculumRow }>(
        `/control/curricula/${selectedId}/versions`,
        {
          version: versionForm.version.trim(),
          summary_en: versionForm.summary_en.trim() || undefined,
        },
      );
      setMode('view');
      setSelectedId(res.data.id);
      await load();
      await feedback.success({
        title: 'New version created',
        message: `${res.data.code} v${res.data.version} is ready as a draft.`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create version');
    } finally {
      setSaving(false);
    }
  }

  async function publishCurriculum(row: CurriculumRow) {
    try {
      await api.post(`/control/curricula/${row.id}/publish`, {
        summary_en: row.change_summary_en || undefined,
      });
      await feedback.success({
        title: 'Curriculum published',
        message: `${row.name_en} v${row.version} is now published.`,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not publish curriculum');
    }
  }

  async function setReviewStatus(row: CurriculumRow, status: 'draft' | 'in_review') {
    try {
      await api.request(`/control/curricula/${row.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      await feedback.success({
        title: status === 'in_review' ? 'Submitted for review' : 'Returned to draft',
        message: `${row.name_en} is now ${curriculumStatusLabel(status)}.`,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update status');
    }
  }

  async function deleteCurriculum(row: CurriculumRow) {
    try {
      await api.request(`/control/curricula/${row.id}`, { method: 'DELETE' });
      await feedback.success({
        title: 'Curriculum deleted',
        message: `${row.name_en} v${row.version} was removed.`,
      });
      setSelectedId(null);
      setDetail(null);
      setMode('view');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete curriculum');
    }
  }

  const canDelete =
    !!activeDetail &&
    activeDetail.status !== 'published' &&
    activeDetail.usage.subjects +
      activeDetail.usage.chapters +
      activeDetail.usage.lessons +
      activeDetail.usage.learning_outcomes ===
      0;

  if (loading && rows.length === 0 && !stats) {
    return <p className="cu-muted">Loading curricula…</p>;
  }

  if (error && !stats && rows.length === 0) {
    return (
      <Panel title="Unable to load curricula">
        <p style={{ color: 'var(--stem-danger)', marginTop: 0 }}>{error}</p>
        <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
          Retry
        </Button>
      </Panel>
    );
  }

  return (
    <div className="cu-page">
      <section className="cu-hero stem-animate-rise">
        <div>
          <p className="cu-eyebrow">Control · Curriculum management</p>
          <h2 className="cu-hero-title">Curriculums</h2>
          <p className="cu-hero-lead">
            Maintain platform and school curriculum frameworks — draft, review, publish, and version
            them for classroom delivery.
          </p>
        </div>
        <div className="cu-hero-actions">
          <div className="cu-action-row">
            <Button
              size="sm"
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => void load()}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Link to="/curriculum/countries" className="cu-ghost-link">
              Countries
            </Link>
            <Button type="button" variant="apricot" onClick={startCreate} size="sm">
              + New curriculum
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="cu-alert" role="alert">
          <span>{error}</span>
          <Button size="sm" type="button" variant="secondary" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <StatStrip
        items={[
          { label: 'Curricula', value: String(stats?.total ?? '—') },
          { label: 'Draft', value: String(stats?.draft ?? '—') },
          { label: 'In review', value: String(stats?.in_review ?? '—') },
          { label: 'Published', value: String(stats?.published ?? '—') },
          {
            label: 'Platform',
            value: String(stats?.platform ?? '—'),
            hint: 'Catalogue templates',
          },
        ]}
      />

      <div className="cu-layout">
        <Panel
          title="Curriculum directory"
          description="Filter by country, status, or scope, then select a framework to manage versions."
          action={
            <Toolbar as="form" onSubmit={onSearch}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search code or name"
                aria-label="Search curricula"
              />
              <select
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                aria-label="Filter by country"
              >
                <option value="">All countries</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.name_en}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
              >
                <option value="">All statuses</option>
                <option value="draft">Draft</option>
                <option value="in_review">In review</option>
                <option value="published">Published</option>
                <option value="superseded">Superseded</option>
              </select>
              <select
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value)}
                aria-label="Filter by scope"
              >
                <option value="all">All scopes</option>
                <option value="platform">Platform</option>
                <option value="school">School</option>
              </select>
              <label className="cu-check">
                <input
                  type="checkbox"
                  checked={latestOnly}
                  onChange={(e) => setLatestOnly(e.target.checked)}
                />
                Latest only
              </label>
              <Button type="submit" variant="secondary" size="sm">
                Apply
              </Button>
            </Toolbar>
          }
        >
          <div className="cu-table-wrap">
            <table className="cu-table">
              <thead>
                <tr>
                  <th>Curriculum</th>
                  <th>Country</th>
                  <th>Version</th>
                  <th>Scope</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="cu-empty">
                      No curricula match this filter. Create a platform framework to get started.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      className={
                        selectedId === row.id && mode !== 'create' ? 'is-selected' : undefined
                      }
                      onClick={() => {
                        setMode('view');
                        setSelectedId(row.id);
                      }}
                    >
                      <td>
                        <strong>{row.name_en}</strong>
                        <div className="cu-slug">
                          <code>{row.code}</code>
                          {row.is_latest ? <span className="cu-chip">Latest</span> : null}
                        </div>
                      </td>
                      <td>{row.country ? `${row.country.code}` : '—'}</td>
                      <td>v{row.version}</td>
                      <td>{row.is_platform ? 'Platform' : 'School'}</td>
                      <td>
                        <StatusPill status={row.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <aside className="cu-side" aria-live="polite">
          {showingForm ? (
            <Panel
              title={mode === 'create' ? 'Create curriculum' : 'Edit curriculum'}
              description={
                mode === 'create'
                  ? 'Add a platform catalogue framework linked to a country.'
                  : 'Update names, review status, or change summary while editable.'
              }
            >
              <form onSubmit={onSave} className="cu-form" noValidate>
                <SelectField
                  label="Country"
                  required
                  value={form.country_id}
                  disabled={mode === 'edit'}
                  onChange={(e) => setForm((f) => ({ ...f, country_id: e.target.value }))}
                >
                  <option value="">Select country</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.name_en}
                    </option>
                  ))}
                </SelectField>
                <TextField
                  label="Code"
                  required
                  value={form.code}
                  disabled={mode === 'edit'}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  hint={mode === 'edit' ? 'Code is fixed after create.' : 'Stable framework code'}
                />
                {mode === 'create' ? (
                  <TextField
                    label="Version"
                    required
                    value={form.version}
                    onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
                    hint="e.g. 1.0"
                  />
                ) : null}
                <TextField
                  label="English name"
                  required
                  value={form.name_en}
                  onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
                />
                <TextField
                  label="Arabic name"
                  value={form.name_ar}
                  onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))}
                  hint="Optional — defaults to English name"
                />
                {mode === 'edit' ? (
                  <SelectField
                    label="Status"
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        status: e.target.value as 'draft' | 'in_review',
                      }))
                    }
                  >
                    <option value="draft">Draft</option>
                    <option value="in_review">In review</option>
                  </SelectField>
                ) : null}
                <TextField
                  label="Change summary (EN)"
                  value={form.change_summary_en}
                  onChange={(e) => setForm((f) => ({ ...f, change_summary_en: e.target.value }))}
                />
                <TextField
                  label="Change summary (AR)"
                  value={form.change_summary_ar}
                  onChange={(e) => setForm((f) => ({ ...f, change_summary_ar: e.target.value }))}
                />
                <FormActions>
                  <Button size="sm" type="button" variant="secondary" onClick={cancelForm}>
                    Cancel
                  </Button>
                  <Button size="sm" type="submit" variant="primary" disabled={saving}>
                    {saving
                      ? 'Saving…'
                      : mode === 'create'
                        ? 'Create curriculum'
                        : 'Save changes'}
                  </Button>
                </FormActions>
              </form>
            </Panel>
          ) : mode === 'version' && activeDetail ? (
            <Panel
              title="Create new version"
              description={`Clone ${activeDetail.code} into a new draft version.`}
            >
              <form onSubmit={onCreateVersion} className="cu-form" noValidate>
                <TextField
                  label="New version"
                  required
                  value={versionForm.version}
                  onChange={(e) => setVersionForm((f) => ({ ...f, version: e.target.value }))}
                  hint={`Current: v${activeDetail.version}`}
                />
                <TextField
                  label="Summary"
                  value={versionForm.summary_en}
                  onChange={(e) => setVersionForm((f) => ({ ...f, summary_en: e.target.value }))}
                  hint="What changed in this version?"
                />
                <FormActions>
                  <Button size="sm" type="button" variant="secondary" onClick={cancelForm}>
                    Cancel
                  </Button>
                  <Button size="sm" type="submit" variant="primary" disabled={saving}>
                    {saving ? 'Creating…' : 'Create draft version'}
                  </Button>
                </FormActions>
              </form>
            </Panel>
          ) : activeDetail ? (
            <div className="cu-detail">
              <div className="cu-detail-head">
                <span className="cu-detail-mark" aria-hidden>
                  v{activeDetail.version}
                </span>
                <div>
                  <h3>{activeDetail.name_en}</h3>
                  <p>
                    <code>{activeDetail.code}</code>
                    {activeDetail.name_ar ? ` · ${activeDetail.name_ar}` : ''}
                  </p>
                </div>
              </div>

              {detailLoading && !detail ? (
                <p className="cu-muted">Loading details…</p>
              ) : (
                <>
                  <dl className="cu-meta">
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <StatusPill status={activeDetail.status} />
                        {activeDetail.is_latest ? (
                          <span className="cu-chip" style={{ marginLeft: 6 }}>
                            Latest
                          </span>
                        ) : null}
                      </dd>
                    </div>
                    <div>
                      <dt>Country</dt>
                      <dd>
                        {activeDetail.country
                          ? `${activeDetail.country.code} · ${activeDetail.country.name_en}`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Scope</dt>
                      <dd>{activeDetail.is_platform ? 'Platform template' : 'School instance'}</dd>
                    </div>
                    <div>
                      <dt>Published</dt>
                      <dd>
                        {activeDetail.published_at
                          ? new Date(activeDetail.published_at).toLocaleString()
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Tree</dt>
                      <dd>
                        {activeDetail.usage.subjects} sub · {activeDetail.usage.chapters} ch ·{' '}
                        {activeDetail.usage.lessons} les · {activeDetail.usage.learning_outcomes}{' '}
                        LO
                      </dd>
                    </div>
                  </dl>

                  {activeDetail.change_summary_en ? (
                    <p className="cu-summary">{activeDetail.change_summary_en}</p>
                  ) : null}

                  {(activeDetail.version_family?.length ?? 0) > 0 ? (
                    <ul className="cu-usage-list">
                      {activeDetail.version_family!.map((v) => (
                        <li key={v.id}>
                          <button
                            type="button"
                            className="cu-version-link"
                            onClick={() => {
                              setMode('view');
                              setSelectedId(v.id);
                            }}
                          >
                            <strong>
                              v{v.version}
                              {v.is_latest ? ' · latest' : ''}
                            </strong>
                            <span>{curriculumStatusLabel(v.status)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="cu-actions">
                    {activeDetail.is_editable ? (
                      <Button
                        size="sm"
                        type="button"
                        variant="secondary"
                        onClick={() => startEdit(activeDetail)}
                      >
                        Edit
                      </Button>
                    ) : null}
                    {activeDetail.status === 'draft' ? (
                      <ConfirmButton
                        size="sm"
                        title="Submit for review?"
                        message={`${activeDetail.name_en} v${activeDetail.version} will move to in review.`}
                        confirmLabel="Submit"
                        tone="primary"
                        variant="secondary"
                        onConfirm={() => setReviewStatus(activeDetail, 'in_review')}
                      >
                        Submit review
                      </ConfirmButton>
                    ) : null}
                    {activeDetail.status === 'in_review' ? (
                      <ConfirmButton
                        size="sm"
                        title="Return to draft?"
                        message={`${activeDetail.name_en} will return to draft for further edits.`}
                        confirmLabel="Return"
                        tone="warn"
                        variant="secondary"
                        onConfirm={() => setReviewStatus(activeDetail, 'draft')}
                      >
                        Back to draft
                      </ConfirmButton>
                    ) : null}
                    {activeDetail.status === 'draft' || activeDetail.status === 'in_review' ? (
                      <ConfirmButton
                        size="sm"
                        title="Publish curriculum?"
                        message={`${activeDetail.name_en} v${activeDetail.version} will become the published framework.`}
                        confirmLabel="Publish"
                        tone="primary"
                        variant="primary"
                        onConfirm={() => publishCurriculum(activeDetail)}
                      >
                        Publish
                      </ConfirmButton>
                    ) : null}
                    {activeDetail.status === 'published' || activeDetail.is_latest ? (
                      <Button
                        size="sm"
                        type="button"
                        variant="apricot"
                        onClick={() => startNewVersion(activeDetail)}
                      >
                        New version
                      </Button>
                    ) : null}
                    {canDelete ? (
                      <ConfirmButton
                        size="sm"
                        title="Delete curriculum?"
                        message={`${activeDetail.name_en} v${activeDetail.version} will be soft-deleted.`}
                        confirmLabel="Delete"
                        tone="danger"
                        variant="danger"
                        onConfirm={() => deleteCurriculum(activeDetail)}
                      >
                        Delete
                      </ConfirmButton>
                    ) : (
                      <Button
                        size="sm"
                        type="button"
                        variant="danger"
                        disabled
                        title="Published or in-use curricula cannot be deleted"
                      >
                        Delete
                      </Button>
                    )}
                  </div>

                  <div className="cu-links">
                    <Link to="/curriculum/countries">Countries</Link>
                    <Link to="/curriculum/subjects">Subjects</Link>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="cu-detail cu-detail-empty">
              <p className="cu-empty">Select a curriculum to review details and actions.</p>
              <Button size="sm" type="button" variant="apricot" onClick={startCreate}>
                + New curriculum
              </Button>
            </div>
          )}
        </aside>
      </div>

      <style>{curriculumStyles}</style>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`cu-pill status-${status}`}>{curriculumStatusLabel(status)}</span>;
}

function bumpVersion(current: string): string {
  const match = /^(\d+)\.(\d+)$/.exec(current.trim());
  if (!match) return `${current}.1`;
  return `${match[1]}.${Number(match[2]) + 1}`;
}

const curriculumStyles = `
.cu-page { display: grid; gap: 1rem; }
.cu-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(220px, 0.7fr);
  gap: 1.25rem;
  align-items: end;
  padding: 1.25rem 1.35rem;
  border-radius: 18px;
  border: 1px solid var(--stem-line);
  background:
    radial-gradient(120% 90% at 100% 0%, rgba(12, 124, 128, 0.14), transparent 55%),
    linear-gradient(145deg, #f3faf8, #eef5f2);
}
.cu-eyebrow {
  margin: 0 0 0.3rem;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--stem-teal-deep);
}
.cu-hero-title {
  margin: 0 0 0.35rem;
  font-family: var(--stem-font-display);
  font-size: clamp(1.35rem, 1.8vw, 1.55rem);
  letter-spacing: -0.03em;
}
.cu-hero-lead {
  margin: 0;
  color: var(--stem-ink-soft);
  line-height: 1.5;
  max-width: 42rem;
  font-size: var(--stem-text-base);
}
.cu-hero-actions { display: grid; gap: 0.75rem; justify-items: end; }
.cu-action-row { display: flex; flex-wrap: wrap; gap: 0.45rem; justify-content: flex-end; align-items: center; }
.cu-ghost-link {
  display: inline-flex; align-items: center; min-height: 40px; padding: 0 0.75rem;
  font-size: var(--stem-text-md); font-weight: 600; color: var(--stem-teal-deep); text-decoration: none;
}
.cu-ghost-link:hover { text-decoration: underline; }
.cu-alert {
  display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;
  padding: 0.85rem 1rem; border-radius: 12px; background: #fef3f2; color: var(--stem-danger);
  border: 1px solid #fecdca; font-size: var(--stem-text-base);
}
.cu-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(280px, 0.85fr);
  gap: 1rem;
  align-items: start;
}
.cu-table-wrap { overflow-x: auto; margin: 0 -0.15rem; }
.cu-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--stem-text-base);
}
.cu-table th {
  text-align: left;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--stem-ink-soft);
  padding: 0.55rem 0.65rem;
  border-bottom: 1px solid var(--stem-line);
  white-space: nowrap;
}
.cu-table td {
  padding: 0.7rem 0.65rem;
  border-bottom: 1px solid var(--stem-line);
  vertical-align: top;
}
.cu-table tbody tr {
  cursor: pointer;
  transition: background 0.15s ease;
}
.cu-table tbody tr:hover { background: rgba(18, 160, 171, 0.04); }
.cu-table tbody tr.is-selected { background: rgba(12, 124, 128, 0.08); }
.cu-slug {
  margin-top: 0.15rem;
  font-size: var(--stem-text-sm);
  color: var(--stem-ink-soft);
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}
.cu-slug code { font-size: var(--stem-text-sm); }
.cu-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  font-size: var(--stem-text-xs);
  font-weight: 700;
  background: #ecfdf5;
  color: #047857;
}
.cu-check {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: var(--stem-text-md);
  color: var(--stem-ink-soft);
  white-space: nowrap;
}
.cu-empty { text-align: center; color: var(--stem-ink-soft); padding: 1.5rem 0.75rem !important; }
.cu-side { position: sticky; top: 0.75rem; }
.cu-detail {
  display: grid;
  gap: 1rem;
  padding: 1.1rem 1.15rem;
  border-radius: 16px;
  border: 1px solid var(--stem-line);
  background: #fff;
}
.cu-detail-empty { min-height: 180px; align-content: center; justify-items: start; gap: 0.85rem; }
.cu-detail-head {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}
.cu-detail-mark {
  min-width: 2.75rem;
  height: 2.5rem;
  padding: 0 0.55rem;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: var(--stem-text-md);
  letter-spacing: 0.04em;
  background: #eef8f6;
  color: #055456;
  border: 1px solid rgba(12, 124, 128, 0.22);
}
.cu-detail-head h3 {
  margin: 0;
  font-size: var(--stem-text-xl);
  letter-spacing: -0.02em;
}
.cu-detail-head p {
  margin: 0.15rem 0 0;
  font-size: var(--stem-text-md);
  color: var(--stem-ink-soft);
}
.cu-meta {
  display: grid;
  gap: 0.55rem;
  margin: 0;
}
.cu-meta > div {
  display: grid;
  grid-template-columns: 7.5rem minmax(0, 1fr);
  gap: 0.5rem;
  align-items: baseline;
}
.cu-meta dt {
  margin: 0;
  font-size: var(--stem-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--stem-ink-soft);
}
.cu-meta dd { margin: 0; font-size: var(--stem-text-base); }
.cu-summary {
  margin: 0;
  padding: 0.75rem 0 0;
  border-top: 1px solid var(--stem-line);
  font-size: var(--stem-text-md);
  color: var(--stem-ink-soft);
  line-height: 1.45;
}
.cu-usage-list {
  list-style: none;
  margin: 0;
  padding: 0.75rem 0 0;
  border-top: 1px solid var(--stem-line);
  display: grid;
  gap: 0.35rem;
}
.cu-usage-list li { margin: 0; }
.cu-version-link {
  width: 100%;
  display: grid;
  gap: 0.1rem;
  text-align: left;
  background: transparent;
  border: 0;
  padding: 0.35rem 0;
  cursor: pointer;
  font: inherit;
}
.cu-version-link:hover strong { color: var(--stem-teal-deep); }
.cu-version-link span { color: var(--stem-ink-soft); font-size: var(--stem-text-sm); }
.cu-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--stem-line);
}
.cu-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  padding-top: 0.25rem;
}
.cu-links a {
  font-size: var(--stem-text-md);
  font-weight: 600;
  color: var(--stem-teal-deep);
  text-decoration: none;
}
.cu-links a:hover { text-decoration: underline; }
.cu-form { display: grid; gap: 0.85rem; }
.cu-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: var(--stem-text-xs);
  font-weight: 700;
  letter-spacing: 0.02em;
  background: #f3f4f6;
  color: #374151;
}
.cu-pill.status-draft { background: #f3f4f6; color: #4b5563; }
.cu-pill.status-in_review { background: #fff7ed; color: #c2410c; }
.cu-pill.status-published { background: #ecfdf5; color: #047857; }
.cu-pill.status-superseded { background: #eef2ff; color: #4338ca; }
.cu-muted { color: var(--stem-ink-soft); font-size: var(--stem-text-base); margin: 0; }
@media (max-width: 960px) {
  .cu-hero, .cu-layout { grid-template-columns: 1fr; }
  .cu-hero-actions { justify-items: start; }
  .cu-action-row { justify-content: flex-start; }
  .cu-side { position: static; }
}
`;
