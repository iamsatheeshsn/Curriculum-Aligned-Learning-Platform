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
import { statusLabel } from '../../types';

type PlanModules = Record<string, boolean>;

type PlanRow = {
  id: number;
  code: string;
  name_en: string;
  name_ar: string;
  price: number;
  currency: string;
  max_schools: number | null;
  max_campuses: number | null;
  max_students: number | null;
  max_teachers: number | null;
  max_storage_mb: number | null;
  modules: PlanModules | string[];
  is_active: boolean;
  status: 'active' | 'inactive';
  usage: { subscriptions: number; active_subscriptions: number };
  created_at?: string | null;
  updated_at?: string | null;
};

type PlanStats = {
  total: number;
  active: number;
  inactive: number;
  with_subscriptions: number;
};

type PlanForm = {
  code: string;
  name_en: string;
  name_ar: string;
  price: string;
  currency: string;
  max_schools: string;
  max_campuses: string;
  max_students: string;
  max_teachers: string;
  max_storage_mb: string;
  is_active: boolean;
  modules: PlanModules;
};

const MODULE_KEYS = ['curriculum', 'assessments', 'tutoring', 'analytics', 'billing'] as const;

const MODULE_LABELS: Record<(typeof MODULE_KEYS)[number], string> = {
  curriculum: 'Curriculum',
  assessments: 'Assessments',
  tutoring: 'Tutoring',
  analytics: 'Analytics',
  billing: 'Billing',
};

const CURRENCIES = ['SAR', 'USD', 'AED', 'EUR', 'GBP'] as const;

const emptyModules = (): PlanModules =>
  Object.fromEntries(MODULE_KEYS.map((k) => [k, false])) as PlanModules;

const emptyForm = (): PlanForm => ({
  code: '',
  name_en: '',
  name_ar: '',
  price: '',
  currency: 'SAR',
  max_schools: '',
  max_campuses: '',
  max_students: '',
  max_teachers: '',
  max_storage_mb: '',
  is_active: true,
  modules: emptyModules(),
});

function normalizeModules(raw: PlanRow['modules'] | undefined): PlanModules {
  const base = emptyModules();
  if (!raw) return base;
  if (Array.isArray(raw)) {
    for (const key of raw) {
      if (typeof key === 'string' && key in base) base[key] = true;
    }
    return base;
  }
  for (const key of MODULE_KEYS) {
    base[key] = Boolean(raw[key]);
  }
  return base;
}

function formatPrice(price: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'SAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return `${price} ${currency}`;
  }
}

function formatLimit(value: number | null | undefined) {
  if (value == null) return '—';
  return value.toLocaleString();
}

function enabledModules(modules: PlanModules) {
  return MODULE_KEYS.filter((k) => modules[k]).map((k) => MODULE_LABELS[k]);
}

function parseOptionalInt(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : undefined;
}

function formPayload(form: PlanForm, includeCode: boolean) {
  const payload: Record<string, unknown> = {
    name_en: form.name_en.trim(),
    name_ar: form.name_ar.trim() || form.name_en.trim(),
    price: Number(form.price),
    currency: form.currency,
    is_active: form.is_active,
    modules: form.modules,
  };

  if (includeCode) {
    payload.code = form.code.trim().toUpperCase();
  }

  const limits = {
    max_schools: parseOptionalInt(form.max_schools),
    max_campuses: parseOptionalInt(form.max_campuses),
    max_students: parseOptionalInt(form.max_students),
    max_teachers: parseOptionalInt(form.max_teachers),
    max_storage_mb: parseOptionalInt(form.max_storage_mb),
  };

  for (const [key, value] of Object.entries(limits)) {
    if (value !== undefined) payload[key] = value;
  }

  return payload;
}

function rowToForm(row: PlanRow): PlanForm {
  return {
    code: row.code,
    name_en: row.name_en,
    name_ar: row.name_ar ?? '',
    price: String(row.price ?? ''),
    currency: row.currency || 'SAR',
    max_schools: row.max_schools != null ? String(row.max_schools) : '',
    max_campuses: row.max_campuses != null ? String(row.max_campuses) : '',
    max_students: row.max_students != null ? String(row.max_students) : '',
    max_teachers: row.max_teachers != null ? String(row.max_teachers) : '',
    max_storage_mb: row.max_storage_mb != null ? String(row.max_storage_mb) : '',
    is_active: row.is_active,
    modules: normalizeModules(row.modules),
  };
}

/**
 * Platform catalogue of subscription plans for tenant billing.
 */
export function PlansPage() {
  const { isSuperAdmin, hasPermission } = useAuth();
  if (
    !isSuperAdmin &&
    !hasPermission([
      'platform.plans.manage',
      'platform.tenants.manage',
      'nav.control.billing',
    ])
  ) {
    return <Navigate to="/" replace />;
  }

  return (
    <ControlLayout
      title="Plans"
      subtitle="Define subscription tiers, limits, and module entitlements for tenant billing"
    >
      <PlansWorkspace />
    </ControlLayout>
  );
}

function PlansWorkspace() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [stats, setStats] = useState<PlanStats | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<PlanRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view');
  const [form, setForm] = useState<PlanForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      const qs = params.toString();
      const res = await api.get<{
        data: PlanRow[];
        meta: { stats: PlanStats };
      }>(`/control/billing/plans${qs ? `?${qs}` : ''}`);
      setRows(res.data);
      setStats(res.meta.stats);
      setSelectedId((current) => {
        if (mode === 'create') return current;
        if (current && res.data.some((r) => r.id === current)) return current;
        return res.data[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  }, [api, search, statusFilter, mode]);

  useEffect(() => {
    void load();
  }, [api, statusFilter]);

  useEffect(() => {
    if (!selectedId || mode === 'create') {
      if (mode !== 'create') setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void (async () => {
      try {
        const res = await api.get<{ data: PlanRow }>(`/control/billing/plans/${selectedId}`);
        if (!cancelled) setDetail(res.data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load plan details');
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
    setForm(emptyForm());
    setSelectedId(null);
    setDetail(null);
  }

  function startEdit(row: PlanRow) {
    setMode('edit');
    setSelectedId(row.id);
    setForm(rowToForm(row));
  }

  function cancelForm() {
    setMode('view');
    setForm(emptyForm());
    if (!selectedId && rows[0]) setSelectedId(rows[0].id);
  }

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateFormFields(e.currentTarget)) return;

    const code = form.code.trim().toUpperCase();
    if (mode === 'create' && !code) {
      setError('Plan code is required.');
      return;
    }

    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 0) {
      setError('Price must be a non-negative number.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (mode === 'create') {
        const payload = formPayload(form, true);
        const res = await api.post<{ data: PlanRow }>('/control/billing/plans', payload);
        setMode('view');
        setSelectedId(res.data.id);
        await load();
        await feedback.success({
          title: 'Plan created',
          message: `${res.data.name_en} (${res.data.code}) is ready for subscriptions.`,
        });
      } else if (selectedId) {
        const payload = formPayload(form, false);
        const res = await api.request<{ data: PlanRow }>(`/control/billing/plans/${selectedId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setMode('view');
        await load();
        await feedback.success({
          title: 'Plan updated',
          message: `${res.data.name_en} has been saved.`,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save plan');
    } finally {
      setSaving(false);
    }
  }

  async function setActive(row: PlanRow, isActive: boolean) {
    try {
      await api.request(`/control/billing/plans/${row.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: isActive }),
      });
      await feedback.success({
        title: isActive ? 'Plan activated' : 'Plan deactivated',
        message: `${row.name_en} is now ${isActive ? 'active' : 'inactive'}.`,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update status');
    }
  }

  async function deletePlan(row: PlanRow) {
    try {
      await api.request(`/control/billing/plans/${row.id}`, { method: 'DELETE' });
      await feedback.success({
        title: 'Plan deleted',
        message: `${row.name_en} was removed from the catalogue.`,
      });
      setSelectedId(null);
      setDetail(null);
      setMode('view');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete plan');
    }
  }

  if (loading && rows.length === 0 && !stats) {
    return <p className="bp-muted">Loading plans…</p>;
  }

  if (error && !stats && rows.length === 0) {
    return (
      <Panel title="Unable to load plans">
        <p style={{ color: 'var(--stem-danger)', marginTop: 0 }}>{error}</p>
        <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
          Retry
        </Button>
      </Panel>
    );
  }

  return (
    <div className="bp-page">
      <section className="bp-hero stem-animate-rise">
        <div>
          <p className="bp-eyebrow">Control · Billing</p>
          <h2 className="bp-hero-title">Subscription plans</h2>
          <p className="bp-hero-lead">
            Configure pricing, resource limits, and module entitlements that tenants subscribe to —
            the foundation of platform billing.
          </p>
        </div>
        <div className="bp-hero-actions">
          <div className="bp-action-row">
            <Button
              size="sm"
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => void load()}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Link to="/billing/invoices" className="bp-ghost-link">
              Invoices
            </Link>
            <Link to="/tenants/subscriptions" className="bp-ghost-link">
              Subscriptions
            </Link>
            <Button type="button" variant="apricot" onClick={startCreate} size="sm">
              + New plan
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="bp-alert" role="alert">
          <span>{error}</span>
          <Button size="sm" type="button" variant="secondary" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <StatStrip
        items={[
          { label: 'Plans', value: String(stats?.total ?? '—') },
          { label: 'Active', value: String(stats?.active ?? '—') },
          { label: 'Inactive', value: String(stats?.inactive ?? '—') },
          {
            label: 'With subscriptions',
            value: String(stats?.with_subscriptions ?? '—'),
            hint: 'In use by tenants',
          },
        ]}
      />

      <div className="bp-layout">
        <Panel
          title="Plan directory"
          description="Search by code or name, then select a row to edit, activate, or remove."
          action={
            <Toolbar as="form" onSubmit={onSearch}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search code or name"
                aria-label="Search plans"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <Button type="submit" variant="secondary" size="sm">
                Apply
              </Button>
            </Toolbar>
          }
        >
          <div className="bp-table-wrap">
            <table className="bp-table">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Price</th>
                  <th>Limits</th>
                  <th>Usage</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="bp-empty">
                      No plans match this filter. Add one to get started.
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
                        <div className="bp-slug">
                          <code>{row.code}</code>
                          {row.name_ar ? <span> · {row.name_ar}</span> : null}
                        </div>
                      </td>
                      <td>{formatPrice(row.price, row.currency)}</td>
                      <td>
                        {formatLimit(row.max_schools)} sch · {formatLimit(row.max_students)} std
                      </td>
                      <td>
                        {row.usage.active_subscriptions} active / {row.usage.subscriptions} total
                      </td>
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

        <aside className="bp-side" aria-live="polite">
          {showingForm ? (
            <Panel
              title={mode === 'create' ? 'Create plan' : 'Edit plan'}
              description={
                mode === 'create'
                  ? 'Add a subscription tier with pricing, limits, and module access.'
                  : 'Update pricing, limits, modules, or lifecycle status.'
              }
            >
              <form onSubmit={onSave} className="bp-form" noValidate>
                <TextField
                  label="Plan code"
                  required
                  value={form.code}
                  maxLength={64}
                  placeholder="STARTER"
                  disabled={mode === 'edit'}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, code: e.target.value.toUpperCase().slice(0, 64) }))
                  }
                  hint={
                    mode === 'edit' ? 'Plan code cannot be changed after create.' : 'Unique uppercase identifier'
                  }
                />
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
                <div className="bp-form-row">
                  <TextField
                    label="Price"
                    required
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  />
                  <SelectField
                    label="Currency"
                    value={form.currency}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </SelectField>
                </div>
                <fieldset className="bp-fieldset">
                  <legend>Resource limits</legend>
                  <p className="bp-fieldset-hint">Leave blank for unlimited.</p>
                  <div className="bp-form-grid">
                    <TextField
                      label="Max schools"
                      type="number"
                      min={0}
                      value={form.max_schools}
                      onChange={(e) => setForm((f) => ({ ...f, max_schools: e.target.value }))}
                    />
                    <TextField
                      label="Max campuses"
                      type="number"
                      min={0}
                      value={form.max_campuses}
                      onChange={(e) => setForm((f) => ({ ...f, max_campuses: e.target.value }))}
                    />
                    <TextField
                      label="Max students"
                      type="number"
                      min={0}
                      value={form.max_students}
                      onChange={(e) => setForm((f) => ({ ...f, max_students: e.target.value }))}
                    />
                    <TextField
                      label="Max teachers"
                      type="number"
                      min={0}
                      value={form.max_teachers}
                      onChange={(e) => setForm((f) => ({ ...f, max_teachers: e.target.value }))}
                    />
                    <TextField
                      label="Max storage (MB)"
                      type="number"
                      min={0}
                      value={form.max_storage_mb}
                      onChange={(e) => setForm((f) => ({ ...f, max_storage_mb: e.target.value }))}
                    />
                  </div>
                </fieldset>
                <fieldset className="bp-fieldset">
                  <legend>Modules</legend>
                  <div className="bp-modules">
                    {MODULE_KEYS.map((key) => (
                      <label key={key} className="bp-module-check">
                        <input
                          type="checkbox"
                          checked={form.modules[key]}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              modules: { ...f.modules, [key]: e.target.checked },
                            }))
                          }
                        />
                        <span>{MODULE_LABELS[key]}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <SelectField
                  label="Status"
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
                    {saving ? 'Saving…' : mode === 'create' ? 'Create plan' : 'Save changes'}
                  </Button>
                </FormActions>
              </form>
            </Panel>
          ) : activeDetail ? (
            <div className="bp-detail">
              <div className="bp-detail-head">
                <span className="bp-detail-mark" aria-hidden>
                  {activeDetail.currency}
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
                <p className="bp-muted">Loading details…</p>
              ) : (
                <>
                  <p className="bp-price">
                    {formatPrice(activeDetail.price, activeDetail.currency)}
                    <span className="bp-price-hint"> per billing period</span>
                  </p>

                  <dl className="bp-meta">
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <StatusPill status={activeDetail.status} />
                      </dd>
                    </div>
                    <div>
                      <dt>Max schools</dt>
                      <dd>{formatLimit(activeDetail.max_schools)}</dd>
                    </div>
                    <div>
                      <dt>Max campuses</dt>
                      <dd>{formatLimit(activeDetail.max_campuses)}</dd>
                    </div>
                    <div>
                      <dt>Max students</dt>
                      <dd>{formatLimit(activeDetail.max_students)}</dd>
                    </div>
                    <div>
                      <dt>Max teachers</dt>
                      <dd>{formatLimit(activeDetail.max_teachers)}</dd>
                    </div>
                    <div>
                      <dt>Max storage</dt>
                      <dd>
                        {activeDetail.max_storage_mb != null
                          ? `${activeDetail.max_storage_mb.toLocaleString()} MB`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Subscriptions</dt>
                      <dd>
                        {activeDetail.usage.active_subscriptions} active ·{' '}
                        {activeDetail.usage.subscriptions} total
                      </dd>
                    </div>
                  </dl>

                  {enabledModules(normalizeModules(activeDetail.modules)).length > 0 ? (
                    <ul className="bp-module-list">
                      {enabledModules(normalizeModules(activeDetail.modules)).map((label) => (
                        <li key={label}>{label}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="bp-muted bp-module-empty">No modules enabled.</p>
                  )}

                  <div className="bp-actions">
                    <Button
                      size="sm"
                      type="button"
                      variant="secondary"
                      onClick={() => startEdit(activeDetail)}
                    >
                      Edit
                    </Button>
                    {activeDetail.is_active ? (
                      <ConfirmButton
                        size="sm"
                        title="Deactivate plan?"
                        message={`${activeDetail.name_en} will no longer be offered for new subscriptions.`}
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
                        title="Activate plan?"
                        message={`${activeDetail.name_en} will be available for tenant subscriptions.`}
                        confirmLabel="Activate"
                        tone="primary"
                        variant="primary"
                        onConfirm={() => setActive(activeDetail, true)}
                      >
                        Activate
                      </ConfirmButton>
                    )}
                    {activeDetail.usage.active_subscriptions > 0 ? (
                      <Button
                        size="sm"
                        type="button"
                        variant="secondary"
                        disabled
                        title="Has active subscriptions — deactivate instead of deleting"
                      >
                        Delete
                      </Button>
                    ) : (
                      <ConfirmButton
                        size="sm"
                        title="Delete plan?"
                        message={`${activeDetail.name_en} will be soft-deleted from the catalogue.`}
                        confirmLabel="Delete"
                        tone="danger"
                        variant="danger"
                        onConfirm={() => deletePlan(activeDetail)}
                      >
                        Delete
                      </ConfirmButton>
                    )}
                  </div>

                  <div className="bp-links">
                    <Link to="/billing/invoices">Open invoices</Link>
                    <Link to="/tenants/subscriptions">View subscriptions</Link>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="bp-detail bp-detail-empty">
              <p className="bp-empty">Select a plan to review details and actions.</p>
              <Button size="sm" type="button" variant="apricot" onClick={startCreate}>
                + New plan
              </Button>
            </div>
          )}
        </aside>
      </div>

      <style>{planStyles}</style>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`bp-pill status-${status}`}>{statusLabel(status)}</span>;
}

const planStyles = `
.bp-page { display: grid; gap: 1rem; }
.bp-hero {
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
.bp-eyebrow {
  margin: 0 0 0.3rem;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--stem-teal-deep);
}
.bp-hero-title {
  margin: 0 0 0.35rem;
  font-family: var(--stem-font-display);
  font-size: clamp(1.35rem, 1.8vw, 1.55rem);
  letter-spacing: -0.03em;
}
.bp-hero-lead {
  margin: 0;
  color: var(--stem-ink-soft);
  line-height: 1.5;
  max-width: 42rem;
  font-size: var(--stem-text-base);
}
.bp-hero-actions { display: grid; gap: 0.75rem; justify-items: end; }
.bp-action-row { display: flex; flex-wrap: wrap; gap: 0.45rem; justify-content: flex-end; align-items: center; }
.bp-ghost-link {
  display: inline-flex; align-items: center; min-height: 40px; padding: 0 0.75rem;
  font-size: var(--stem-text-md); font-weight: 600; color: var(--stem-teal-deep); text-decoration: none;
}
.bp-ghost-link:hover { text-decoration: underline; }
.bp-alert {
  display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;
  padding: 0.85rem 1rem; border-radius: 12px; background: #fef3f2; color: var(--stem-danger);
  border: 1px solid #fecdca; font-size: var(--stem-text-base);
}
.bp-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(280px, 0.85fr);
  gap: 1rem;
  align-items: start;
}
.bp-table-wrap { overflow-x: auto; margin: 0 -0.15rem; }
.bp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--stem-text-base);
}
.bp-table th {
  text-align: left;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--stem-ink-soft);
  padding: 0.55rem 0.65rem;
  border-bottom: 1px solid var(--stem-line);
  white-space: nowrap;
}
.bp-table td {
  padding: 0.7rem 0.65rem;
  border-bottom: 1px solid var(--stem-line);
  vertical-align: top;
}
.bp-table tbody tr {
  cursor: pointer;
  transition: background 0.15s ease;
}
.bp-table tbody tr:hover { background: rgba(18, 160, 171, 0.04); }
.bp-table tbody tr.is-selected { background: rgba(12, 124, 128, 0.08); }
.bp-slug { margin-top: 0.15rem; font-size: var(--stem-text-sm); color: var(--stem-ink-soft); }
.bp-slug code { font-size: var(--stem-text-sm); }
.bp-empty { text-align: center; color: var(--stem-ink-soft); padding: 1.5rem 0.75rem !important; }
.bp-side { position: sticky; top: 0.75rem; }
.bp-detail {
  display: grid;
  gap: 1rem;
  padding: 1.1rem 1.15rem;
  border-radius: 16px;
  border: 1px solid var(--stem-line);
  background: #fff;
}
.bp-detail-empty { min-height: 180px; align-content: center; justify-items: start; gap: 0.85rem; }
.bp-detail-head {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}
.bp-detail-mark {
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
.bp-detail-head h3 {
  margin: 0;
  font-size: var(--stem-text-xl);
  letter-spacing: -0.02em;
}
.bp-detail-head p {
  margin: 0.15rem 0 0;
  font-size: var(--stem-text-md);
  color: var(--stem-ink-soft);
}
.bp-price {
  margin: 0;
  font-size: var(--stem-text-xl);
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--stem-teal-deep);
}
.bp-price-hint {
  font-size: var(--stem-text-sm);
  font-weight: 500;
  color: var(--stem-ink-soft);
}
.bp-meta {
  display: grid;
  gap: 0.55rem;
  margin: 0;
}
.bp-meta > div {
  display: grid;
  grid-template-columns: 7.5rem minmax(0, 1fr);
  gap: 0.5rem;
  align-items: baseline;
}
.bp-meta dt {
  margin: 0;
  font-size: var(--stem-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--stem-ink-soft);
}
.bp-meta dd { margin: 0; font-size: var(--stem-text-base); }
.bp-module-list {
  list-style: none;
  margin: 0;
  padding: 0.75rem 0 0;
  border-top: 1px solid var(--stem-line);
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.bp-module-list li {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: var(--stem-text-xs);
  font-weight: 600;
  background: #eef8f6;
  color: #055456;
  border: 1px solid rgba(12, 124, 128, 0.18);
}
.bp-module-empty { margin: 0; padding-top: 0.35rem; border-top: 1px solid var(--stem-line); }
.bp-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--stem-line);
}
.bp-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  padding-top: 0.25rem;
}
.bp-links a {
  font-size: var(--stem-text-md);
  font-weight: 600;
  color: var(--stem-teal-deep);
  text-decoration: none;
}
.bp-links a:hover { text-decoration: underline; }
.bp-form { display: grid; gap: 0.85rem; }
.bp-form-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(100px, 0.55fr);
  gap: 0.75rem;
  align-items: end;
}
.bp-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}
.bp-fieldset {
  margin: 0;
  padding: 0.75rem 0.85rem;
  border: 1px solid var(--stem-line);
  border-radius: 12px;
  display: grid;
  gap: 0.65rem;
}
.bp-fieldset legend {
  padding: 0 0.25rem;
  font-size: var(--stem-text-sm);
  font-weight: 700;
  color: var(--stem-ink-soft);
}
.bp-fieldset-hint {
  margin: 0;
  font-size: var(--stem-text-sm);
  color: var(--stem-ink-soft);
}
.bp-modules {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.45rem 0.75rem;
}
.bp-module-check {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: var(--stem-text-md);
  cursor: pointer;
}
.bp-module-check input { accent-color: var(--stem-teal-deep); }
.bp-pill {
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
.bp-pill.status-active { background: #ecfdf5; color: #047857; }
.bp-pill.status-inactive { background: #f3f4f6; color: #4b5563; }
.bp-muted { color: var(--stem-ink-soft); font-size: var(--stem-text-base); margin: 0; }
@media (max-width: 960px) {
  .bp-hero, .bp-layout { grid-template-columns: 1fr; }
  .bp-hero-actions { justify-items: start; }
  .bp-action-row { justify-content: flex-start; }
  .bp-side { position: static; }
  .bp-form-row, .bp-form-grid, .bp-modules { grid-template-columns: 1fr; }
}
`;
