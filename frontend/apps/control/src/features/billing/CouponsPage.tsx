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
  TextAreaField,
  TextField,
  Toolbar,
  useFeedback,
  validateFormFields,
} from '@stemora/ui';
import { ControlLayout } from '../../layout/ControlLayout';
import { statusLabel } from '../../types';

type DiscountType = 'percent' | 'fixed';

type CouponRow = {
  id: number;
  code: string;
  name_en: string;
  name_ar: string | null;
  discount_type: DiscountType;
  discount_value: number;
  currency: string | null;
  max_redemptions: number | null;
  redemptions_count: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  status: string;
  notes: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type CouponStats = {
  total: number;
  active: number;
  inactive: number;
  percent: number;
  fixed: number;
};

type CouponForm = {
  code: string;
  name_en: string;
  name_ar: string;
  discount_type: DiscountType;
  discount_value: string;
  currency: string;
  max_redemptions: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  notes: string;
};

const CURRENCIES = ['SAR', 'USD', 'EUR', 'AED', 'KWD', 'BHD', 'QAR', 'OMR', 'EGP'];

const emptyForm = (): CouponForm => ({
  code: '',
  name_en: '',
  name_ar: '',
  discount_type: 'percent',
  discount_value: '',
  currency: 'SAR',
  max_redemptions: '',
  starts_at: '',
  ends_at: '',
  is_active: true,
  notes: '',
});

function toDateInput(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 10);
}

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

function formatDiscount(row: Pick<CouponRow, 'discount_type' | 'discount_value' | 'currency'>): string {
  if (row.discount_type === 'percent') {
    return `${row.discount_value}%`;
  }
  return `${row.currency ?? 'SAR'} ${row.discount_value}`;
}

/**
 * Platform coupon catalogue for subscription and invoice discounts.
 */
export function CouponsPage() {
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
      title="Coupons"
      subtitle="Manage discount codes for subscriptions and billing"
    >
      <CouponsWorkspace />
    </ControlLayout>
  );
}

function CouponsWorkspace() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [rows, setRows] = useState<CouponRow[]>([]);
  const [stats, setStats] = useState<CouponStats | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<CouponRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view');
  const [form, setForm] = useState<CouponForm>(emptyForm);
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
        data: CouponRow[];
        meta: { stats: CouponStats };
      }>(`/control/billing/coupons${qs ? `?${qs}` : ''}`);
      setRows(res.data);
      setStats(res.meta.stats);
      setSelectedId((current) => {
        if (mode === 'create') return current;
        if (current && res.data.some((r) => r.id === current)) return current;
        return res.data[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load coupons');
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
        const res = await api.get<{ data: CouponRow }>(`/control/billing/coupons/${selectedId}`);
        if (!cancelled) setDetail(res.data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load coupon details');
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

  function startEdit(row: CouponRow) {
    setMode('edit');
    setSelectedId(row.id);
    setForm({
      code: row.code,
      name_en: row.name_en,
      name_ar: row.name_ar ?? '',
      discount_type: row.discount_type,
      discount_value: String(row.discount_value),
      currency: row.currency ?? 'SAR',
      max_redemptions: row.max_redemptions != null ? String(row.max_redemptions) : '',
      starts_at: toDateInput(row.starts_at),
      ends_at: toDateInput(row.ends_at),
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
    const discountValue = Number(form.discount_value);
    return {
      code: form.code.trim().toUpperCase(),
      name_en: form.name_en.trim(),
      name_ar: form.name_ar.trim() || null,
      discount_type: form.discount_type,
      discount_value: discountValue,
      currency: form.discount_type === 'fixed' ? form.currency.toUpperCase() : null,
      max_redemptions: form.max_redemptions.trim() ? Number(form.max_redemptions) : null,
      starts_at: form.starts_at.trim() || null,
      ends_at: form.ends_at.trim() || null,
      is_active: form.is_active,
      notes: form.notes.trim() || null,
    };
  }

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateFormFields(e.currentTarget)) return;

    const discountValue = Number(form.discount_value);
    if (!Number.isFinite(discountValue) || discountValue < 0) {
      setError('Discount value must be a non-negative number.');
      return;
    }
    if (form.discount_type === 'percent' && discountValue > 100) {
      setError('Percent discount cannot exceed 100.');
      return;
    }
    if (form.discount_type === 'fixed' && !/^[A-Z]{3}$/.test(form.currency.trim().toUpperCase())) {
      setError('Fixed discounts require a 3-letter currency code.');
      return;
    }
    if (form.starts_at && form.ends_at && form.ends_at < form.starts_at) {
      setError('End date must be on or after the start date.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload();

      if (mode === 'create') {
        const res = await api.post<{ data: CouponRow }>('/control/billing/coupons', payload);
        setMode('view');
        setSelectedId(res.data.id);
        await load();
        await feedback.success({
          title: 'Coupon created',
          message: `${res.data.code} is ready for checkout and subscriptions.`,
        });
      } else if (selectedId) {
        const res = await api.request<{ data: CouponRow }>(
          `/control/billing/coupons/${selectedId}`,
          {
            method: 'PUT',
            body: JSON.stringify(payload),
          },
        );
        setMode('view');
        await load();
        await feedback.success({
          title: 'Coupon updated',
          message: `${res.data.code} has been saved.`,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save coupon');
    } finally {
      setSaving(false);
    }
  }

  async function setActive(row: CouponRow, isActive: boolean) {
    try {
      await api.request(`/control/billing/coupons/${row.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: isActive }),
      });
      await feedback.success({
        title: isActive ? 'Coupon activated' : 'Coupon deactivated',
        message: `${row.code} is now ${isActive ? 'active' : 'inactive'}.`,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update status');
    }
  }

  async function deleteCoupon(row: CouponRow) {
    try {
      await api.request(`/control/billing/coupons/${row.id}`, { method: 'DELETE' });
      await feedback.success({
        title: 'Coupon deleted',
        message: `${row.code} was removed from the catalogue.`,
      });
      setSelectedId(null);
      setDetail(null);
      setMode('view');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete coupon');
    }
  }

  if (loading && rows.length === 0 && !stats) {
    return <p className="bc-muted">Loading coupons…</p>;
  }

  if (error && !stats && rows.length === 0) {
    return (
      <Panel title="Unable to load coupons">
        <p style={{ color: 'var(--stem-danger)', marginTop: 0 }}>{error}</p>
        <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
          Retry
        </Button>
      </Panel>
    );
  }

  return (
    <div className="bc-page">
      <section className="bc-hero stem-animate-rise">
        <div>
          <p className="bc-eyebrow">Control · Billing</p>
          <h2 className="bc-hero-title">Coupons</h2>
          <p className="bc-hero-lead">
            Create and manage discount codes for subscription plans and invoices — percent or fixed
            amounts with optional redemption limits and validity windows.
          </p>
        </div>
        <div className="bc-hero-actions">
          <div className="bc-action-row">
            <Button
              size="sm"
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => void load()}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Link to="/billing/taxes" className="bc-ghost-link">
              Taxes
            </Link>
            <Link to="/billing/plans" className="bc-ghost-link">
              Plans
            </Link>
            <Link to="/billing/invoices" className="bc-ghost-link">
              Invoices
            </Link>
            <Button type="button" variant="apricot" onClick={startCreate} size="sm">
              + New coupon
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="bc-alert" role="alert">
          <span>{error}</span>
          <Button size="sm" type="button" variant="secondary" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <StatStrip
        items={[
          { label: 'Coupons', value: String(stats?.total ?? '—') },
          { label: 'Active', value: String(stats?.active ?? '—') },
          { label: 'Inactive', value: String(stats?.inactive ?? '—') },
          { label: 'Percent', value: String(stats?.percent ?? '—'), hint: 'Discount type' },
          { label: 'Fixed', value: String(stats?.fixed ?? '—'), hint: 'Discount type' },
        ]}
      />

      <div className="bc-layout">
        <Panel
          title="Coupon directory"
          description="Search by code or name, then select a row to edit, activate, or remove."
          action={
            <Toolbar as="form" onSubmit={onSearch}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search code or name"
                aria-label="Search coupons"
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
          <div className="bc-table-wrap">
            <table className="bc-table">
              <thead>
                <tr>
                  <th>Coupon</th>
                  <th>Discount</th>
                  <th>Redemptions</th>
                  <th>Valid</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="bc-empty">
                      No coupons match this filter. Add one to get started.
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
                        <div className="bc-slug">
                          <code>{row.code}</code>
                          {row.name_ar ? <span> · {row.name_ar}</span> : null}
                        </div>
                      </td>
                      <td>
                        <span className={`bc-type bc-type-${row.discount_type}`}>
                          {row.discount_type}
                        </span>
                        <div className="bc-slug">{formatDiscount(row)}</div>
                      </td>
                      <td>
                        {row.redemptions_count}
                        {row.max_redemptions != null ? ` / ${row.max_redemptions}` : ' / ∞'}
                      </td>
                      <td>
                        {formatDate(row.starts_at)}
                        {' – '}
                        {formatDate(row.ends_at)}
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

        <aside className="bc-side" aria-live="polite">
          {showingForm ? (
            <Panel
              title={mode === 'create' ? 'Create coupon' : 'Edit coupon'}
              description={
                mode === 'create'
                  ? 'Add a discount code for subscriptions and invoices.'
                  : 'Update discount, limits, validity, or lifecycle status.'
              }
            >
              <form onSubmit={onSave} className="bc-form" noValidate>
                <TextField
                  label="Coupon code"
                  required
                  value={form.code}
                  maxLength={64}
                  placeholder="SAVE10"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))
                  }
                  hint="Unique code customers enter at checkout"
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
                <SelectField
                  label="Discount type"
                  value={form.discount_type}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      discount_type: e.target.value as DiscountType,
                    }))
                  }
                >
                  <option value="percent">Percent (%)</option>
                  <option value="fixed">Fixed amount</option>
                </SelectField>
                <TextField
                  label="Discount value"
                  required
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.discount_value}
                  onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))}
                  hint={form.discount_type === 'percent' ? '0–100' : 'Amount in selected currency'}
                />
                {form.discount_type === 'fixed' ? (
                  <SelectField
                    label="Currency"
                    required
                    value={form.currency}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </SelectField>
                ) : null}
                <TextField
                  label="Max redemptions"
                  type="number"
                  min={1}
                  value={form.max_redemptions}
                  onChange={(e) => setForm((f) => ({ ...f, max_redemptions: e.target.value }))}
                  hint="Leave blank for unlimited"
                />
                <TextField
                  label="Starts at"
                  type="date"
                  value={form.starts_at}
                  onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                />
                <TextField
                  label="Ends at"
                  type="date"
                  value={form.ends_at}
                  onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
                />
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
                  hint="Internal notes — not shown to customers"
                />
                <FormActions>
                  <Button size="sm" type="button" variant="secondary" onClick={cancelForm}>
                    Cancel
                  </Button>
                  <Button size="sm" type="submit" variant="primary" disabled={saving}>
                    {saving ? 'Saving…' : mode === 'create' ? 'Create coupon' : 'Save changes'}
                  </Button>
                </FormActions>
              </form>
            </Panel>
          ) : activeDetail ? (
            <div className="bc-detail">
              <div className="bc-detail-head">
                <span className="bc-detail-mark" aria-hidden>
                  %
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
                <p className="bc-muted">Loading details…</p>
              ) : (
                <>
                  <dl className="bc-meta">
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <StatusPill status={activeDetail.status} />
                      </dd>
                    </div>
                    <div>
                      <dt>Discount</dt>
                      <dd>
                        {formatDiscount(activeDetail)} ({activeDetail.discount_type})
                      </dd>
                    </div>
                    <div>
                      <dt>Redemptions</dt>
                      <dd>
                        {activeDetail.redemptions_count}
                        {activeDetail.max_redemptions != null
                          ? ` of ${activeDetail.max_redemptions}`
                          : ' (unlimited)'}
                      </dd>
                    </div>
                    <div>
                      <dt>Valid from</dt>
                      <dd>{formatDate(activeDetail.starts_at)}</dd>
                    </div>
                    <div>
                      <dt>Valid until</dt>
                      <dd>{formatDate(activeDetail.ends_at)}</dd>
                    </div>
                    {activeDetail.notes ? (
                      <div>
                        <dt>Notes</dt>
                        <dd>{activeDetail.notes}</dd>
                      </div>
                    ) : null}
                  </dl>

                  <div className="bc-actions">
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
                        title="Deactivate coupon?"
                        message={`${activeDetail.code} will no longer be accepted at checkout.`}
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
                        title="Activate coupon?"
                        message={`${activeDetail.code} will be available for redemption.`}
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
                      title="Delete coupon?"
                      message={`${activeDetail.code} will be soft-deleted from the catalogue.`}
                      confirmLabel="Delete"
                      tone="danger"
                      variant="danger"
                      onConfirm={() => deleteCoupon(activeDetail)}
                    >
                      Delete
                    </ConfirmButton>
                  </div>

                  <div className="bc-links">
                    <Link to="/billing/taxes">Tax rates</Link>
                    <Link to="/billing/plans">Subscription plans</Link>
                    <Link to="/billing/invoices">Invoices</Link>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="bc-detail bc-detail-empty">
              <p className="bc-empty">Select a coupon to review details and actions.</p>
              <Button size="sm" type="button" variant="apricot" onClick={startCreate}>
                + New coupon
              </Button>
            </div>
          )}
        </aside>
      </div>

      <style>{couponStyles}</style>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`bc-pill status-${status}`}>{statusLabel(status)}</span>;
}

const couponStyles = `
.bc-page { display: grid; gap: 1rem; }
.bc-hero {
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
.bc-eyebrow {
  margin: 0 0 0.3rem;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--stem-teal-deep);
}
.bc-hero-title {
  margin: 0 0 0.35rem;
  font-family: var(--stem-font-display);
  font-size: clamp(1.35rem, 1.8vw, 1.55rem);
  letter-spacing: -0.03em;
}
.bc-hero-lead {
  margin: 0;
  color: var(--stem-ink-soft);
  line-height: 1.5;
  max-width: 42rem;
  font-size: var(--stem-text-base);
}
.bc-hero-actions { display: grid; gap: 0.75rem; justify-items: end; }
.bc-action-row { display: flex; flex-wrap: wrap; gap: 0.45rem; justify-content: flex-end; align-items: center; }
.bc-ghost-link {
  display: inline-flex; align-items: center; min-height: 40px; padding: 0 0.75rem;
  font-size: var(--stem-text-md); font-weight: 600; color: var(--stem-teal-deep); text-decoration: none;
}
.bc-ghost-link:hover { text-decoration: underline; }
.bc-alert {
  display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;
  padding: 0.85rem 1rem; border-radius: 12px; background: #fef3f2; color: var(--stem-danger);
  border: 1px solid #fecdca; font-size: var(--stem-text-base);
}
.bc-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(280px, 0.85fr);
  gap: 1rem;
  align-items: start;
}
.bc-table-wrap { overflow-x: auto; margin: 0 -0.15rem; }
.bc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--stem-text-base);
}
.bc-table th {
  text-align: left;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--stem-ink-soft);
  padding: 0.55rem 0.65rem;
  border-bottom: 1px solid var(--stem-line);
  white-space: nowrap;
}
.bc-table td {
  padding: 0.7rem 0.65rem;
  border-bottom: 1px solid var(--stem-line);
  vertical-align: top;
}
.bc-table tbody tr {
  cursor: pointer;
  transition: background 0.15s ease;
}
.bc-table tbody tr:hover { background: rgba(18, 160, 171, 0.04); }
.bc-table tbody tr.is-selected { background: rgba(12, 124, 128, 0.08); }
.bc-slug { margin-top: 0.15rem; font-size: var(--stem-text-sm); color: var(--stem-ink-soft); }
.bc-slug code { font-size: var(--stem-text-sm); }
.bc-type {
  display: inline-flex;
  padding: 0.12rem 0.45rem;
  border-radius: 999px;
  font-size: var(--stem-text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.bc-type-percent { background: #ecfdf5; color: #047857; }
.bc-type-fixed { background: #eff6ff; color: #1d4ed8; }
.bc-empty { text-align: center; color: var(--stem-ink-soft); padding: 1.5rem 0.75rem !important; }
.bc-side { position: sticky; top: 0.75rem; }
.bc-detail {
  display: grid;
  gap: 1rem;
  padding: 1.1rem 1.15rem;
  border-radius: 16px;
  border: 1px solid var(--stem-line);
  background: #fff;
}
.bc-detail-empty { min-height: 180px; align-content: center; justify-items: start; gap: 0.85rem; }
.bc-detail-head {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}
.bc-detail-mark {
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
.bc-detail-head h3 {
  margin: 0;
  font-size: var(--stem-text-xl);
  letter-spacing: -0.02em;
}
.bc-detail-head p {
  margin: 0.15rem 0 0;
  font-size: var(--stem-text-md);
  color: var(--stem-ink-soft);
}
.bc-meta {
  display: grid;
  gap: 0.55rem;
  margin: 0;
}
.bc-meta > div {
  display: grid;
  grid-template-columns: 7.5rem minmax(0, 1fr);
  gap: 0.5rem;
  align-items: baseline;
}
.bc-meta dt {
  margin: 0;
  font-size: var(--stem-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--stem-ink-soft);
}
.bc-meta dd { margin: 0; font-size: var(--stem-text-base); }
.bc-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--stem-line);
}
.bc-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  padding-top: 0.25rem;
}
.bc-links a {
  font-size: var(--stem-text-md);
  font-weight: 600;
  color: var(--stem-teal-deep);
  text-decoration: none;
}
.bc-links a:hover { text-decoration: underline; }
.bc-form { display: grid; gap: 0.85rem; }
.bc-pill {
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
.bc-pill.status-active { background: #ecfdf5; color: #047857; }
.bc-pill.status-inactive { background: #f3f4f6; color: #4b5563; }
.bc-muted { color: var(--stem-ink-soft); font-size: var(--stem-text-base); margin: 0; }
@media (max-width: 960px) {
  .bc-hero, .bc-layout { grid-template-columns: 1fr; }
  .bc-hero-actions { justify-items: start; }
  .bc-action-row { justify-content: flex-start; }
  .bc-side { position: static; }
}
`;
