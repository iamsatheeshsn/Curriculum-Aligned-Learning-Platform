import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
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
  TextAreaField,
  TextField,
  Toolbar,
  useFeedback,
  validateFormFields,
} from '@stemora/ui';
import { ControlLayout } from '../../layout/ControlLayout';
import { statusLabel } from '../../types';

type TaxRow = {
  id: number;
  code: string;
  name_en: string;
  name_ar: string | null;
  rate_percent: number;
  country_code: string | null;
  is_inclusive: boolean;
  is_active: boolean;
  status: string;
  notes: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type TaxStats = {
  total: number;
  active: number;
  inactive: number;
  average_rate: number;
};

type TaxForm = {
  code: string;
  name_en: string;
  name_ar: string;
  rate_percent: string;
  country_code: string;
  is_inclusive: boolean;
  is_active: boolean;
  notes: string;
};

const emptyForm = (): TaxForm => ({
  code: '',
  name_en: '',
  name_ar: '',
  rate_percent: '',
  country_code: '',
  is_inclusive: false,
  is_active: true,
  notes: '',
});

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return value;
  }
}

function formatRate(value: number): string {
  return `${Number.isFinite(value) ? value.toFixed(2) : value}%`;
}

/**
 * Platform tax rate catalogue for invoices and billing.
 */
export function TaxesPage() {
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
      title="Taxes"
      subtitle="Manage tax rates applied to subscriptions and invoices"
    >
      <TaxesWorkspace />
    </ControlLayout>
  );
}

function TaxesWorkspace() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [rows, setRows] = useState<TaxRow[]>([]);
  const listPage = useClientPagination(rows);

  const [stats, setStats] = useState<TaxStats | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<TaxRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view');
  const [form, setForm] = useState<TaxForm>(emptyForm);
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
        data: TaxRow[];
        meta: { stats: TaxStats };
      }>(`/control/billing/taxes${qs ? `?${qs}` : ''}`);
      setRows(res.data);
      setStats(res.meta.stats);
      setSelectedId((current) => {
        if (mode === 'create') return current;
        if (current && res.data.some((r) => r.id === current)) return current;
        return res.data[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load taxes');
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
        const res = await api.get<{ data: TaxRow }>(`/control/billing/taxes/${selectedId}`);
        if (!cancelled) setDetail(res.data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load tax details');
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

  function startEdit(row: TaxRow) {
    setMode('edit');
    setSelectedId(row.id);
    setForm({
      code: row.code,
      name_en: row.name_en,
      name_ar: row.name_ar ?? '',
      rate_percent: String(row.rate_percent),
      country_code: row.country_code ?? '',
      is_inclusive: row.is_inclusive,
      is_active: row.is_active,
      notes: row.notes ?? '',
    });
  }

  function cancelForm() {
    setMode('view');
    setForm(emptyForm());
    if (!selectedId && rows[0]) setSelectedId(rows[0].id);
  }

  function buildPayload() {
    const country = form.country_code.trim().toUpperCase();
    return {
      code: form.code.trim().toUpperCase(),
      name_en: form.name_en.trim(),
      name_ar: form.name_ar.trim() || null,
      rate_percent: Number(form.rate_percent),
      country_code: country || null,
      is_inclusive: form.is_inclusive,
      is_active: form.is_active,
      notes: form.notes.trim() || null,
    };
  }

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateFormFields(e.currentTarget)) return;

    const rate = Number(form.rate_percent);
    if (!Number.isFinite(rate) || rate < 0) {
      setError('Rate must be a non-negative number.');
      return;
    }
    const country = form.country_code.trim();
    if (country && !/^[A-Za-z]{2}$/.test(country)) {
      setError('Country code must be a 2-letter ISO code when provided.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload();

      if (mode === 'create') {
        const res = await api.post<{ data: TaxRow }>('/control/billing/taxes', payload);
        setMode('view');
        setSelectedId(res.data.id);
        await load();
        await feedback.success({
          title: 'Tax rate created',
          message: `${res.data.name_en} (${res.data.code}) is ready for billing.`,
        });
      } else if (selectedId) {
        const res = await api.request<{ data: TaxRow }>(`/control/billing/taxes/${selectedId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setMode('view');
        await load();
        await feedback.success({
          title: 'Tax rate updated',
          message: `${res.data.name_en} has been saved.`,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save tax rate');
    } finally {
      setSaving(false);
    }
  }

  async function setActive(row: TaxRow, isActive: boolean) {
    try {
      await api.request(`/control/billing/taxes/${row.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: isActive }),
      });
      await feedback.success({
        title: isActive ? 'Tax rate activated' : 'Tax rate deactivated',
        message: `${row.code} is now ${isActive ? 'active' : 'inactive'}.`,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update status');
    }
  }

  async function deleteTax(row: TaxRow) {
    try {
      await api.request(`/control/billing/taxes/${row.id}`, { method: 'DELETE' });
      await feedback.success({
        title: 'Tax rate deleted',
        message: `${row.code} was removed from the catalogue.`,
      });
      setSelectedId(null);
      setDetail(null);
      setMode('view');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete tax rate');
    }
  }

  if (loading && rows.length === 0 && !stats) {
    return <p className="bt-muted">Loading taxes…</p>;
  }

  if (error && !stats && rows.length === 0) {
    return (
      <Panel title="Unable to load taxes">
        <p style={{ color: 'var(--stem-danger)', marginTop: 0 }}>{error}</p>
        <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
          Retry
        </Button>
      </Panel>
    );
  }

  return (
    <div className="bt-page">
      <section className="bt-hero stem-animate-rise">
        <div>
          <p className="bt-eyebrow">Control · Billing</p>
          <h2 className="bt-hero-title">Tax rates</h2>
          <p className="bt-hero-lead">
            Configure VAT and sales tax rates for subscriptions and invoices — scoped by country
            with inclusive or exclusive pricing.
          </p>
        </div>
        <div className="bt-hero-actions">
          <div className="bt-action-row">
            <Button
              size="sm"
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => void load()}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Link to="/billing/coupons" className="bt-ghost-link">
              Coupons
            </Link>
            <Link to="/billing/plans" className="bt-ghost-link">
              Plans
            </Link>
            <Link to="/billing/invoices" className="bt-ghost-link">
              Invoices
            </Link>
            <Button type="button" variant="apricot" onClick={startCreate} size="sm">
              + New tax rate
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="bt-alert" role="alert">
          <span>{error}</span>
          <Button size="sm" type="button" variant="secondary" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <StatStrip
        items={[
          { label: 'Tax rates', value: String(stats?.total ?? '—') },
          { label: 'Active', value: String(stats?.active ?? '—') },
          { label: 'Inactive', value: String(stats?.inactive ?? '—') },
          {
            label: 'Avg. rate',
            value: stats ? formatRate(stats.average_rate) : '—',
            hint: 'Active rates',
          },
        ]}
      />

      <div className="bt-layout">
        <Panel
          title="Tax directory"
          description="Search by code, name, or country, then select a row to edit, activate, or remove."
          action={
            <Toolbar as="form" onSubmit={onSearch}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search code, name, or country"
                aria-label="Search taxes"
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
          <div className="bt-table-wrap">
            <table className="bt-table">
              <thead>
                <tr>
                  <th>Tax</th>
                  <th>Rate</th>
                  <th>Country</th>
                  <th>Pricing</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="bt-empty">
                      No tax rates match this filter. Add one to get started.
                    </td>
                  </tr>
                ) : (
                  listPage.pageItems.map((row) => (
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
                        <div className="bt-slug">
                          <code>{row.code}</code>
                          {row.name_ar ? <span> · {row.name_ar}</span> : null}
                        </div>
                      </td>
                      <td>{formatRate(row.rate_percent)}</td>
                      <td>{row.country_code ?? 'Global'}</td>
                      <td>
                        <span
                          className={`bt-pricing ${row.is_inclusive ? 'is-inclusive' : 'is-exclusive'}`}
                        >
                          {row.is_inclusive ? 'Inclusive' : 'Exclusive'}
                        </span>
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
          <PaginationBar
            page={listPage.page}
            lastPage={listPage.lastPage}
            total={listPage.total}
            onPageChange={listPage.setPage}
            disabled={loading}
          />
        </Panel>

        <aside className="bt-side" aria-live="polite">
          {showingForm ? (
            <Panel
              title={mode === 'create' ? 'Create tax rate' : 'Edit tax rate'}
              description={
                mode === 'create'
                  ? 'Add a tax rate for subscriptions and invoices.'
                  : 'Update rate, country scope, pricing mode, or lifecycle status.'
              }
            >
              <form onSubmit={onSave} className="bt-form" noValidate>
                <TextField
                  label="Tax code"
                  required
                  value={form.code}
                  maxLength={64}
                  placeholder="VAT15"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))
                  }
                  hint="Unique identifier for this tax rate"
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
                <TextField
                  label="Rate (%)"
                  required
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.rate_percent}
                  onChange={(e) => setForm((f) => ({ ...f, rate_percent: e.target.value }))}
                  hint="Percentage applied to taxable amounts"
                />
                <TextField
                  label="Country code"
                  value={form.country_code}
                  maxLength={2}
                  placeholder="SA"
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      country_code: e.target.value.toUpperCase().slice(0, 2),
                    }))
                  }
                  hint="Optional 2-letter ISO code — leave blank for global"
                />
                <SelectField
                  label="Pricing mode"
                  value={form.is_inclusive ? 'inclusive' : 'exclusive'}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, is_inclusive: e.target.value === 'inclusive' }))
                  }
                >
                  <option value="exclusive">Exclusive (added on top)</option>
                  <option value="inclusive">Inclusive (included in price)</option>
                </SelectField>
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
                <TextAreaField
                  label="Notes"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  hint="Internal notes — not shown on invoices"
                />
                <FormActions>
                  <Button size="sm" type="button" variant="secondary" onClick={cancelForm}>
                    Cancel
                  </Button>
                  <Button size="sm" type="submit" variant="primary" disabled={saving}>
                    {saving ? 'Saving…' : mode === 'create' ? 'Create tax rate' : 'Save changes'}
                  </Button>
                </FormActions>
              </form>
            </Panel>
          ) : activeDetail ? (
            <div className="bt-detail">
              <div className="bt-detail-head">
                <span className="bt-detail-mark" aria-hidden>
                  {activeDetail.country_code ?? '∅'}
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
                <p className="bt-muted">Loading details…</p>
              ) : (
                <>
                  <dl className="bt-meta">
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <StatusPill status={activeDetail.status} />
                      </dd>
                    </div>
                    <div>
                      <dt>Rate</dt>
                      <dd>{formatRate(activeDetail.rate_percent)}</dd>
                    </div>
                    <div>
                      <dt>Country</dt>
                      <dd>{activeDetail.country_code ?? 'Global (all countries)'}</dd>
                    </div>
                    <div>
                      <dt>Pricing</dt>
                      <dd>{activeDetail.is_inclusive ? 'Inclusive' : 'Exclusive'}</dd>
                    </div>
                    {activeDetail.created_at ? (
                      <div>
                        <dt>Created</dt>
                        <dd>{formatDate(activeDetail.created_at)}</dd>
                      </div>
                    ) : null}
                    {activeDetail.updated_at ? (
                      <div>
                        <dt>Updated</dt>
                        <dd>{formatDate(activeDetail.updated_at)}</dd>
                      </div>
                    ) : null}
                    {activeDetail.notes ? (
                      <div>
                        <dt>Notes</dt>
                        <dd>{activeDetail.notes}</dd>
                      </div>
                    ) : null}
                  </dl>

                  <div className="bt-actions">
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
                        title="Deactivate tax rate?"
                        message={`${activeDetail.code} will no longer be applied to new invoices.`}
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
                        title="Activate tax rate?"
                        message={`${activeDetail.code} will be available for billing calculations.`}
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
                      title="Delete tax rate?"
                      message={`${activeDetail.code} will be soft-deleted from the catalogue.`}
                      confirmLabel="Delete"
                      tone="danger"
                      variant="danger"
                      onConfirm={() => deleteTax(activeDetail)}
                    >
                      Delete
                    </ConfirmButton>
                  </div>

                  <div className="bt-links">
                    <Link to="/billing/coupons">Coupons</Link>
                    <Link to="/billing/plans">Subscription plans</Link>
                    <Link to="/billing/invoices">Invoices</Link>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="bt-detail bt-detail-empty">
              <p className="bt-empty">Select a tax rate to review details and actions.</p>
              <Button size="sm" type="button" variant="apricot" onClick={startCreate}>
                + New tax rate
              </Button>
            </div>
          )}
        </aside>
      </div>

      <style>{taxStyles}</style>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`bt-pill status-${status}`}>{statusLabel(status)}</span>;
}

const taxStyles = `
.bt-page { display: grid; gap: 1rem; }
.bt-hero {
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
.bt-eyebrow {
  margin: 0 0 0.3rem;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--stem-teal-deep);
}
.bt-hero-title {
  margin: 0 0 0.35rem;
  font-family: var(--stem-font-display);
  font-size: clamp(1.35rem, 1.8vw, 1.55rem);
  letter-spacing: -0.03em;
}
.bt-hero-lead {
  margin: 0;
  color: var(--stem-ink-soft);
  line-height: 1.5;
  max-width: 42rem;
  font-size: var(--stem-text-base);
}
.bt-hero-actions { display: grid; gap: 0.75rem; justify-items: end; }
.bt-action-row { display: flex; flex-wrap: wrap; gap: 0.45rem; justify-content: flex-end; align-items: center; }
.bt-ghost-link {
  display: inline-flex; align-items: center; min-height: 40px; padding: 0 0.75rem;
  font-size: var(--stem-text-md); font-weight: 600; color: var(--stem-teal-deep); text-decoration: none;
}
.bt-ghost-link:hover { text-decoration: underline; }
.bt-alert {
  display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;
  padding: 0.85rem 1rem; border-radius: 12px; background: #fef3f2; color: var(--stem-danger);
  border: 1px solid #fecdca; font-size: var(--stem-text-base);
}
.bt-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(280px, 0.85fr);
  gap: 1rem;
  align-items: start;
}
.bt-table-wrap { overflow-x: auto; margin: 0 -0.15rem; }
.bt-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--stem-text-base);
}
.bt-table th {
  text-align: left;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--stem-ink-soft);
  padding: 0.55rem 0.65rem;
  border-bottom: 1px solid var(--stem-line);
  white-space: nowrap;
}
.bt-table td {
  padding: 0.7rem 0.65rem;
  border-bottom: 1px solid var(--stem-line);
  vertical-align: top;
}
.bt-table tbody tr {
  cursor: pointer;
  transition: background 0.15s ease;
}
.bt-table tbody tr:hover { background: rgba(18, 160, 171, 0.04); }
.bt-table tbody tr.is-selected { background: rgba(12, 124, 128, 0.08); }
.bt-slug { margin-top: 0.15rem; font-size: var(--stem-text-sm); color: var(--stem-ink-soft); }
.bt-slug code { font-size: var(--stem-text-sm); }
.bt-pricing {
  display: inline-flex;
  padding: 0.12rem 0.45rem;
  border-radius: 999px;
  font-size: var(--stem-text-xs);
  font-weight: 700;
  letter-spacing: 0.02em;
}
.bt-pricing.is-inclusive { background: #ecfdf5; color: #047857; }
.bt-pricing.is-exclusive { background: #f3f4f6; color: #4b5563; }
.bt-empty { text-align: center; color: var(--stem-ink-soft); padding: 1.5rem 0.75rem !important; }
.bt-side { position: sticky; top: 0.75rem; }
.bt-detail {
  display: grid;
  gap: 1rem;
  padding: 1.1rem 1.15rem;
  border-radius: 16px;
  border: 1px solid var(--stem-line);
  background: #fff;
}
.bt-detail-empty { min-height: 180px; align-content: center; justify-items: start; gap: 0.85rem; }
.bt-detail-head {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}
.bt-detail-mark {
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
.bt-detail-head h3 {
  margin: 0;
  font-size: var(--stem-text-xl);
  letter-spacing: -0.02em;
}
.bt-detail-head p {
  margin: 0.15rem 0 0;
  font-size: var(--stem-text-md);
  color: var(--stem-ink-soft);
}
.bt-meta {
  display: grid;
  gap: 0.55rem;
  margin: 0;
}
.bt-meta > div {
  display: grid;
  grid-template-columns: 7.5rem minmax(0, 1fr);
  gap: 0.5rem;
  align-items: baseline;
}
.bt-meta dt {
  margin: 0;
  font-size: var(--stem-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--stem-ink-soft);
}
.bt-meta dd { margin: 0; font-size: var(--stem-text-base); }
.bt-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--stem-line);
}
.bt-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  padding-top: 0.25rem;
}
.bt-links a {
  font-size: var(--stem-text-md);
  font-weight: 600;
  color: var(--stem-teal-deep);
  text-decoration: none;
}
.bt-links a:hover { text-decoration: underline; }
.bt-form { display: grid; gap: 0.85rem; }
.bt-pill {
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
.bt-pill.status-active { background: #ecfdf5; color: #047857; }
.bt-pill.status-inactive { background: #f3f4f6; color: #4b5563; }
.bt-muted { color: var(--stem-ink-soft); font-size: var(--stem-text-base); margin: 0; }
@media (max-width: 960px) {
  .bt-hero, .bt-layout { grid-template-columns: 1fr; }
  .bt-hero-actions { justify-items: start; }
  .bt-action-row { justify-content: flex-start; }
  .bt-side { position: static; }
}
`;
