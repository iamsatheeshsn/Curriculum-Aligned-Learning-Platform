import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import {
  Button,
  PaginationBar,
  useClientPagination,
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
import { statusLabel } from '../../types';

export type IntegrationCategory = 'payment' | 'email' | 'sms' | 'video' | 'ai';

type IntegrationRow = {
  id: number;
  code: string;
  name_en: string;
  name_ar: string | null;
  provider: string;
  config: Record<string, unknown>;
  is_active: boolean;
  is_default: boolean;
  status: 'connected' | 'disconnected' | 'error' | 'testing' | string;
  notes: string | null;
  last_tested_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type IntegrationStats = {
  total: number;
  active: number;
  connected: number;
  default_code?: string | null;
};

type IntegrationForm = {
  code: string;
  name_en: string;
  name_ar: string;
  provider: string;
  is_active: boolean;
  notes: string;
  config: Record<string, string>;
};

const COMMON_CONFIG_KEYS = ['api_key', 'secret', 'webhook_url', 'from_email'] as const;

const INTEGRATION_PAGES: {
  category: IntegrationCategory;
  path: string;
  label: string;
}[] = [
  { category: 'payment', path: '/integrations/payment-gateways', label: 'Payment' },
  { category: 'email', path: '/integrations/email', label: 'Email' },
  { category: 'sms', path: '/integrations/sms', label: 'SMS' },
  { category: 'video', path: '/integrations/video', label: 'Video' },
  { category: 'ai', path: '/integrations/ai', label: 'AI' },
];

const emptyForm = (): IntegrationForm => ({
  code: '',
  name_en: '',
  name_ar: '',
  provider: '',
  is_active: false,
  notes: '',
  config: Object.fromEntries(COMMON_CONFIG_KEYS.map((k) => [k, ''])),
});

function isMaskedSecret(value: string): boolean {
  return /^\*+$/.test(value) || value.startsWith('********');
}

function configToFormFields(config: Record<string, unknown> | undefined): Record<string, string> {
  const base = Object.fromEntries(COMMON_CONFIG_KEYS.map((k) => [k, '']));
  if (!config) return base;
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'string') {
      base[key] = value;
    } else if (value != null) {
      base[key] = JSON.stringify(value);
    }
  }
  for (const key of COMMON_CONFIG_KEYS) {
    if (!(key in base)) base[key] = '';
  }
  return base;
}

function buildConfigPayload(formConfig: Record<string, string>): Record<string, string> | undefined {
  const payload: Record<string, string> = {};
  for (const [key, value] of Object.entries(formConfig)) {
    const trimmedKey = key.trim();
    if (!trimmedKey) continue;
    if (isMaskedSecret(value)) continue;
    if (value.trim() === '') continue;
    payload[trimmedKey] = value;
  }
  return Object.keys(payload).length > 0 ? payload : undefined;
}

function rowToForm(row: IntegrationRow): IntegrationForm {
  return {
    code: row.code,
    name_en: row.name_en,
    name_ar: row.name_ar ?? '',
    provider: row.provider ?? row.code,
    is_active: row.is_active,
    notes: row.notes ?? '',
    config: configToFormFields(row.config),
  };
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export type IntegrationsWorkspaceProps = {
  category: IntegrationCategory;
  title: string;
  subtitle: string;
  eyebrow?: string;
};

export function IntegrationsWorkspace({
  category,
  title,
  subtitle,
  eyebrow = 'Control · Integrations',
}: IntegrationsWorkspaceProps) {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [rows, setRows] = useState<IntegrationRow[]>([]);
  const [stats, setStats] = useState<IntegrationStats | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [detail, setDetail] = useState<IntegrationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view');
  const [form, setForm] = useState<IntegrationForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const apiBase = `/control/integrations/${category}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter === 'active') params.set('active', 'true');
      else if (statusFilter === 'inactive') params.set('active', 'false');
      else if (statusFilter) params.set('status', statusFilter);
      const qs = params.toString();
      const res = await api.get<{
        data: IntegrationRow[];
        meta: { stats: IntegrationStats };
      }>(`${apiBase}${qs ? `?${qs}` : ''}`);
      setRows(res.data);
      setStats(res.meta.stats);
      setSelectedCode((current) => {
        if (mode === 'create') return current;
        if (current && res.data.some((r) => r.code === current)) return current;
        return res.data[0]?.code ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load integrations');
    } finally {
      setLoading(false);
    }
  }, [api, apiBase, statusFilter, mode]);

  useEffect(() => {
    void load();
  }, [api, statusFilter, category]);

  useEffect(() => {
    if (!selectedCode || mode === 'create') {
      if (mode !== 'create') setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void (async () => {
      try {
        const res = await api.get<{ data: IntegrationRow }>(`${apiBase}/${selectedCode}`);
        if (!cancelled) setDetail(res.data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load integration details');
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, apiBase, selectedCode, rows, mode]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const haystack = [row.code, row.name_en, row.name_ar ?? '', row.provider]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, search]);

  const listPage = useClientPagination(filteredRows);

  const selectedSummary = useMemo(
    () => rows.find((r) => r.code === selectedCode) ?? null,
    [rows, selectedCode],
  );
  const activeDetail = detail ?? selectedSummary;
  const showingForm = mode === 'create' || mode === 'edit';

  const configKeys = useMemo(() => {
    const keys = new Set<string>(COMMON_CONFIG_KEYS);
    if (showingForm) {
      for (const key of Object.keys(form.config)) keys.add(key);
    } else if (activeDetail?.config) {
      for (const key of Object.keys(activeDetail.config)) keys.add(key);
    }
    return [...keys];
  }, [form.config, activeDetail, showingForm]);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    await load();
  }

  function startCreate() {
    setMode('create');
    setForm(emptyForm());
    setSelectedCode(null);
    setDetail(null);
  }

  function startEdit(row: IntegrationRow) {
    setMode('edit');
    setSelectedCode(row.code);
    setForm(rowToForm(row));
  }

  function cancelForm() {
    setMode('view');
    setForm(emptyForm());
    if (!selectedCode && rows[0]) setSelectedCode(rows[0].code);
  }

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateFormFields(e.currentTarget)) return;

    const code = form.code.trim().toLowerCase().replace(/\s+/g, '_');
    if (mode === 'create' && !code) {
      setError('Integration code is required.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name_en: form.name_en.trim(),
        name_ar: form.name_ar.trim() || form.name_en.trim(),
        provider: form.provider.trim() || code,
        is_active: form.is_active,
        notes: form.notes.trim() || null,
      };
      const config = buildConfigPayload(form.config);
      if (config) payload.config = config;

      if (mode === 'create') {
        payload.code = code;
        const res = await api.post<{ data: IntegrationRow }>(apiBase, payload);
        setMode('view');
        setSelectedCode(res.data.code);
        await load();
        await feedback.success({
          title: 'Integration created',
          message: `${res.data.name_en} (${res.data.code}) is ready to configure.`,
        });
      } else if (selectedCode) {
        const res = await api.request<{ data: IntegrationRow }>(`${apiBase}/${selectedCode}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setMode('view');
        await load();
        await feedback.success({
          title: 'Integration updated',
          message: `${res.data.name_en} has been saved.`,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save integration');
    } finally {
      setSaving(false);
    }
  }

  async function setActive(row: IntegrationRow, isActive: boolean) {
    try {
      await api.request(`${apiBase}/${row.code}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: isActive }),
      });
      await feedback.success({
        title: isActive ? 'Integration activated' : 'Integration deactivated',
        message: `${row.name_en} is now ${isActive ? 'active' : 'inactive'}.`,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update status');
    }
  }

  async function setDefault(row: IntegrationRow) {
    try {
      await api.post<{ data: IntegrationRow }>(`${apiBase}/${row.code}/default`, {});
      await feedback.success({
        title: 'Default updated',
        message: `${row.name_en} is now the default ${category} integration.`,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set default');
    }
  }

  async function testConnection(row: IntegrationRow) {
    setTesting(true);
    setError(null);
    try {
      const res = await api.post<{
        data: { success: boolean; status: string; message?: string };
      }>(`${apiBase}/${row.code}/test`, {});
      await load();
      if (res.data.success) {
        await feedback.success({
          title: 'Connection test passed',
          message: res.data.message ?? `${row.name_en} responded successfully.`,
        });
      } else {
        setError(res.data.message ?? `${row.name_en} could not connect.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection test failed');
    } finally {
      setTesting(false);
    }
  }

  async function deleteIntegration(row: IntegrationRow) {
    try {
      await api.request(`${apiBase}/${row.code}`, { method: 'DELETE' });
      await feedback.success({
        title: 'Integration deleted',
        message: `${row.name_en} was removed.`,
      });
      setSelectedCode(null);
      setDetail(null);
      setMode('view');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete integration');
    }
  }

  if (loading && rows.length === 0 && !stats) {
    return <p className="ig-muted">Loading integrations…</p>;
  }

  if (error && !stats && rows.length === 0) {
    return (
      <Panel title="Unable to load integrations">
        <p style={{ color: 'var(--stem-danger)', marginTop: 0 }}>{error}</p>
        <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
          Retry
        </Button>
      </Panel>
    );
  }

  return (
    <div className="ig-page">
      <section className="ig-hero stem-animate-rise">
        <div>
          <p className="ig-eyebrow">{eyebrow}</p>
          <h2 className="ig-hero-title">{title}</h2>
          <p className="ig-hero-lead">{subtitle}</p>
        </div>
        <div className="ig-hero-actions">
          <div className="ig-action-row">
            <Button
              size="sm"
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => void load()}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            {INTEGRATION_PAGES.filter((p) => p.category !== category).map((page) => (
              <Link key={page.category} to={page.path} className="ig-ghost-link">
                {page.label}
              </Link>
            ))}
            <Button type="button" variant="apricot" onClick={startCreate} size="sm">
              + Custom provider
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="ig-alert" role="alert">
          <span>{error}</span>
          <Button size="sm" type="button" variant="secondary" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <StatStrip
        items={[
          { label: 'Providers', value: String(stats?.total ?? '—') },
          { label: 'Active', value: String(stats?.active ?? '—') },
          { label: 'Connected', value: String(stats?.connected ?? '—') },
          {
            label: 'Default',
            value: stats?.default_code ?? '—',
            hint: 'Primary provider',
          },
        ]}
      />

      <div className="ig-layout">
        <Panel
          title="Provider directory"
          description="Search by name or code, filter by status, then select a row to configure."
          action={
            <Toolbar as="form" onSubmit={onSearch}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or code"
                aria-label="Search integrations"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
              >
                <option value="">All statuses</option>
                <option value="connected">Connected</option>
                <option value="disconnected">Disconnected</option>
                <option value="error">Error</option>
                <option value="testing">Testing</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <Button type="submit" variant="secondary" size="sm">
                Apply
              </Button>
            </Toolbar>
          }
        >
          <div className="ig-table-wrap">
            <table className="ig-table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Connection</th>
                  <th>Default</th>
                  <th>Active</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="ig-empty">
                      No providers match this filter.
                    </td>
                  </tr>
                ) : (
                  listPage.pageItems.map((row) => (
                    <tr
                      key={row.code}
                      className={
                        selectedCode === row.code && mode !== 'create' ? 'is-selected' : undefined
                      }
                      onClick={() => {
                        setMode('view');
                        setSelectedCode(row.code);
                      }}
                    >
                      <td>
                        <strong>{row.name_en}</strong>
                        <div className="ig-slug">
                          <code>{row.code}</code>
                          {row.name_ar ? <span> · {row.name_ar}</span> : null}
                          <span className="ig-provider-tag">{row.provider}</span>
                        </div>
                      </td>
                      <td>
                        <StatusPill status={row.status} />
                      </td>
                      <td>{row.is_default ? 'Yes' : '—'}</td>
                      <td>
                        <ActivePill active={row.is_active} />
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

        <aside className="ig-side" aria-live="polite">
          {showingForm ? (
            <Panel
              title={mode === 'create' ? 'Create custom provider' : 'Edit provider'}
              description={
                mode === 'create'
                  ? 'Add a custom integration with credentials and lifecycle settings.'
                  : 'Update names, credentials, or lifecycle status. Masked secrets are unchanged unless replaced.'
              }
            >
              <form onSubmit={onSave} className="ig-form" noValidate>
                {mode === 'create' ? (
                  <TextField
                    label="Provider code"
                    required
                    value={form.code}
                    maxLength={64}
                    placeholder="custom_gateway"
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        code: e.target.value.toLowerCase().replace(/\s+/g, '_'),
                      }))
                    }
                    hint="Unique lowercase identifier"
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
                <TextField
                  label="Provider"
                  required
                  value={form.provider}
                  onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
                  hint="Vendor or protocol identifier"
                />
                <fieldset className="ig-fieldset">
                  <legend>Configuration</legend>
                  <p className="ig-fieldset-hint">
                    Leave masked values unchanged. Empty fields are omitted on save.
                  </p>
                  <div className="ig-config-grid">
                    {configKeys.map((key) => (
                      <TextField
                        key={key}
                        label={key.replace(/_/g, ' ')}
                        value={form.config[key] ?? ''}
                        type={isMaskedSecret(form.config[key] ?? '') ? 'password' : 'text'}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            config: { ...f.config, [key]: e.target.value },
                          }))
                        }
                        autoComplete="off"
                      />
                    ))}
                  </div>
                </fieldset>
                <TextField
                  label="Notes"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
                <SelectField
                  label="Active"
                  value={form.is_active ? 'active' : 'inactive'}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, is_active: e.target.value === 'active' }))
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </SelectField>
                <FormActions>
                  <Button size="sm" type="button" variant="secondary" onClick={cancelForm}>
                    Cancel
                  </Button>
                  <Button size="sm" type="submit" variant="primary" disabled={saving}>
                    {saving ? 'Saving…' : mode === 'create' ? 'Create provider' : 'Save changes'}
                  </Button>
                </FormActions>
              </form>
            </Panel>
          ) : activeDetail ? (
            <div className="ig-detail">
              <div className="ig-detail-head">
                <span className="ig-detail-mark" aria-hidden>
                  {activeDetail.provider.slice(0, 2).toUpperCase()}
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
                <p className="ig-muted">Loading details…</p>
              ) : (
                <>
                  <dl className="ig-meta">
                    <div>
                      <dt>Connection</dt>
                      <dd>
                        <StatusPill status={activeDetail.status} />
                      </dd>
                    </div>
                    <div>
                      <dt>Active</dt>
                      <dd>
                        <ActivePill active={activeDetail.is_active} />
                      </dd>
                    </div>
                    <div>
                      <dt>Default</dt>
                      <dd>{activeDetail.is_default ? 'Yes' : 'No'}</dd>
                    </div>
                    <div>
                      <dt>Provider</dt>
                      <dd>{activeDetail.provider}</dd>
                    </div>
                    <div>
                      <dt>Last tested</dt>
                      <dd>{formatTimestamp(activeDetail.last_tested_at)}</dd>
                    </div>
                  </dl>

                  {Object.keys(activeDetail.config ?? {}).length > 0 ? (
                    <dl className="ig-config-view">
                      {Object.entries(activeDetail.config).map(([key, value]) => (
                        <div key={key}>
                          <dt>{key.replace(/_/g, ' ')}</dt>
                          <dd>
                            {typeof value === 'string' ? value : JSON.stringify(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="ig-muted ig-config-empty">No configuration saved yet.</p>
                  )}

                  {activeDetail.notes ? (
                    <p className="ig-notes">{activeDetail.notes}</p>
                  ) : null}

                  <div className="ig-actions">
                    <Button
                      size="sm"
                      type="button"
                      variant="secondary"
                      onClick={() => startEdit(activeDetail)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      type="button"
                      variant="secondary"
                      disabled={testing || activeDetail.is_default}
                      onClick={() => void setDefault(activeDetail)}
                    >
                      Set as default
                    </Button>
                    <Button
                      size="sm"
                      type="button"
                      variant="secondary"
                      disabled={testing}
                      onClick={() => void testConnection(activeDetail)}
                    >
                      {testing ? 'Testing…' : 'Test connection'}
                    </Button>
                    {activeDetail.is_active ? (
                      <ConfirmButton
                        size="sm"
                        title="Deactivate provider?"
                        message={`${activeDetail.name_en} will no longer be available for ${category} operations.`}
                        confirmLabel="Deactivate"
                        tone="warn"
                        variant="secondary"
                        onConfirm={() => setActive(activeDetail, false)}
                      >
                        Deactivate
                      </ConfirmButton>
                    ) : (
                      <ConfirmButton
                        size="sm"
                        title="Activate provider?"
                        message={`${activeDetail.name_en} will be available for ${category} operations.`}
                        confirmLabel="Activate"
                        tone="primary"
                        variant="primary"
                        onConfirm={() => setActive(activeDetail, true)}
                      >
                        Activate
                      </ConfirmButton>
                    )}
                    <ConfirmButton
                      size="sm"
                      title="Delete provider?"
                      message={`${activeDetail.name_en} will be permanently removed from this category.`}
                      confirmLabel="Delete"
                      tone="danger"
                      variant="danger"
                      onConfirm={() => deleteIntegration(activeDetail)}
                    >
                      Delete
                    </ConfirmButton>
                  </div>

                  <div className="ig-links">
                    {INTEGRATION_PAGES.filter((p) => p.category !== category).map((page) => (
                      <Link key={page.category} to={page.path}>
                        {page.label} providers
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="ig-detail ig-detail-empty">
              <p className="ig-empty">Select a provider to review configuration and actions.</p>
              <Button size="sm" type="button" variant="apricot" onClick={startCreate}>
                + Custom provider
              </Button>
            </div>
          )}
        </aside>
      </div>

      <style>{integrationStyles}</style>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`ig-pill status-${status}`}>{statusLabel(status)}</span>;
}

function ActivePill({ active }: { active: boolean }) {
  return (
    <span className={`ig-pill ${active ? 'status-active' : 'status-inactive'}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

const integrationStyles = `
.ig-page { display: grid; gap: 1rem; }
.ig-hero {
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
.ig-eyebrow {
  margin: 0 0 0.3rem;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--stem-teal-deep);
}
.ig-hero-title {
  margin: 0 0 0.35rem;
  font-family: var(--stem-font-display);
  font-size: clamp(1.35rem, 1.8vw, 1.55rem);
  letter-spacing: -0.03em;
}
.ig-hero-lead {
  margin: 0;
  color: var(--stem-ink-soft);
  line-height: 1.5;
  max-width: 42rem;
  font-size: var(--stem-text-base);
}
.ig-hero-actions { display: grid; gap: 0.75rem; justify-items: end; }
.ig-action-row { display: flex; flex-wrap: wrap; gap: 0.45rem; justify-content: flex-end; align-items: center; }
.ig-ghost-link {
  display: inline-flex; align-items: center; min-height: 40px; padding: 0 0.75rem;
  font-size: var(--stem-text-md); font-weight: 600; color: var(--stem-teal-deep); text-decoration: none;
}
.ig-ghost-link:hover { text-decoration: underline; }
.ig-alert {
  display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;
  padding: 0.85rem 1rem; border-radius: 12px; background: #fef3f2; color: var(--stem-danger);
  border: 1px solid #fecdca; font-size: var(--stem-text-base);
}
.ig-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(280px, 0.85fr);
  gap: 1rem;
  align-items: start;
}
.ig-table-wrap { overflow-x: auto; margin: 0 -0.15rem; }
.ig-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--stem-text-base);
}
.ig-table th {
  text-align: left;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--stem-ink-soft);
  padding: 0.55rem 0.65rem;
  border-bottom: 1px solid var(--stem-line);
  white-space: nowrap;
}
.ig-table td {
  padding: 0.7rem 0.65rem;
  border-bottom: 1px solid var(--stem-line);
  vertical-align: top;
}
.ig-table tbody tr {
  cursor: pointer;
  transition: background 0.15s ease;
}
.ig-table tbody tr:hover { background: rgba(18, 160, 171, 0.04); }
.ig-table tbody tr.is-selected { background: rgba(12, 124, 128, 0.08); }
.ig-slug { margin-top: 0.15rem; font-size: var(--stem-text-sm); color: var(--stem-ink-soft); }
.ig-slug code { font-size: var(--stem-text-sm); }
.ig-provider-tag {
  display: inline-block;
  margin-left: 0.35rem;
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
  font-size: var(--stem-text-xs);
  font-weight: 600;
  background: #eef8f6;
  color: #055456;
  border: 1px solid rgba(12, 124, 128, 0.18);
}
.ig-empty { text-align: center; color: var(--stem-ink-soft); padding: 1.5rem 0.75rem !important; }
.ig-side { position: sticky; top: 0.75rem; }
.ig-detail {
  display: grid;
  gap: 1rem;
  padding: 1.1rem 1.15rem;
  border-radius: 16px;
  border: 1px solid var(--stem-line);
  background: #fff;
}
.ig-detail-empty { min-height: 180px; align-content: center; justify-items: start; gap: 0.85rem; }
.ig-detail-head {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}
.ig-detail-mark {
  min-width: 2.75rem;
  height: 2.5rem;
  padding: 0 0.55rem;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: var(--stem-text-sm);
  letter-spacing: 0.04em;
  background: #eef8f6;
  color: #055456;
  border: 1px solid rgba(12, 124, 128, 0.22);
}
.ig-detail-head h3 {
  margin: 0;
  font-size: var(--stem-text-xl);
  letter-spacing: -0.02em;
}
.ig-detail-head p {
  margin: 0.15rem 0 0;
  font-size: var(--stem-text-md);
  color: var(--stem-ink-soft);
}
.ig-meta {
  display: grid;
  gap: 0.55rem;
  margin: 0;
}
.ig-meta > div {
  display: grid;
  grid-template-columns: 7.5rem minmax(0, 1fr);
  gap: 0.5rem;
  align-items: baseline;
}
.ig-meta dt {
  margin: 0;
  font-size: var(--stem-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--stem-ink-soft);
}
.ig-meta dd { margin: 0; font-size: var(--stem-text-base); }
.ig-config-view {
  display: grid;
  gap: 0.45rem;
  margin: 0;
  padding: 0.75rem 0 0;
  border-top: 1px solid var(--stem-line);
}
.ig-config-view > div {
  display: grid;
  grid-template-columns: 7.5rem minmax(0, 1fr);
  gap: 0.5rem;
  align-items: baseline;
}
.ig-config-view dt {
  margin: 0;
  font-size: var(--stem-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--stem-ink-soft);
}
.ig-config-view dd {
  margin: 0;
  font-size: var(--stem-text-sm);
  font-family: ui-monospace, monospace;
  word-break: break-all;
}
.ig-config-empty { margin: 0; padding-top: 0.35rem; border-top: 1px solid var(--stem-line); }
.ig-notes {
  margin: 0;
  padding: 0.65rem 0.75rem;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid var(--stem-line);
  font-size: var(--stem-text-sm);
  color: var(--stem-ink-soft);
  line-height: 1.45;
}
.ig-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--stem-line);
}
.ig-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  padding-top: 0.25rem;
}
.ig-links a {
  font-size: var(--stem-text-md);
  font-weight: 600;
  color: var(--stem-teal-deep);
  text-decoration: none;
}
.ig-links a:hover { text-decoration: underline; }
.ig-form { display: grid; gap: 0.85rem; }
.ig-fieldset {
  margin: 0;
  padding: 0.75rem 0.85rem;
  border: 1px solid var(--stem-line);
  border-radius: 12px;
  display: grid;
  gap: 0.65rem;
}
.ig-fieldset legend {
  padding: 0 0.25rem;
  font-size: var(--stem-text-sm);
  font-weight: 700;
  color: var(--stem-ink-soft);
}
.ig-fieldset-hint {
  margin: 0;
  font-size: var(--stem-text-sm);
  color: var(--stem-ink-soft);
}
.ig-config-grid { display: grid; gap: 0.75rem; }
.ig-pill {
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
.ig-pill.status-active { background: #ecfdf5; color: #047857; }
.ig-pill.status-inactive { background: #f3f4f6; color: #4b5563; }
.ig-pill.status-connected { background: #ecfdf5; color: #047857; }
.ig-pill.status-disconnected { background: #f3f4f6; color: #4b5563; }
.ig-pill.status-error { background: #fef3f2; color: #b42318; }
.ig-pill.status-testing { background: #eff6ff; color: #1d4ed8; }
.ig-muted { color: var(--stem-ink-soft); font-size: var(--stem-text-base); margin: 0; }
@media (max-width: 960px) {
  .ig-hero, .ig-layout { grid-template-columns: 1fr; }
  .ig-hero-actions { justify-items: start; }
  .ig-action-row { justify-content: flex-start; }
  .ig-side { position: static; }
}
`;
