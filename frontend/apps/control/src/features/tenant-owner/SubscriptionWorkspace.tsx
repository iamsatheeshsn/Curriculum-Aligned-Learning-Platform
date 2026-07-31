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
  TextField,
  Toolbar,
  useFeedback,
  validateFormFields,
} from '@stemora/ui';
import type { BillingContact, PlanSummary, TenantRow } from '../../types';
import { statusLabel } from '../../types';
import { InvoicePrintView, type PrintableInvoice } from '../billing/InvoicePrintView';

type TabId = 'overview' | 'plans' | 'invoices' | 'billing';

type InvoiceListItem = PrintableInvoice;

type ListMeta = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

type TenantDetail = TenantRow & {
  billing_contact?: BillingContact | null;
};


const emptyContact = (): BillingContact => ({
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
});

/**
 * Plans, subscription lifecycle, billing contact, and printable invoices.
 */
export function SubscriptionWorkspace() {
  const { api, isSuperAdmin, session, hasPermission } = useAuth();
  const feedback = useFeedback();
  const canManage =
    isSuperAdmin || hasPermission(['tenant.billing.manage', 'platform.plans.manage', 'platform.tenants.manage']);

  const [tab, setTab] = useState<TabId>('overview');
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [tenantId, setTenantId] = useState<number | ''>(session?.tenantId ?? '');
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [selectedPlan, setSelectedPlan] = useState('starter');
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [invoiceMeta, setInvoiceMeta] = useState<ListMeta | null>(null);
  const [invoicePage, setInvoicePage] = useState(1);
  const [contact, setContact] = useState<BillingContact>(emptyContact());
  const [tenantSearch, setTenantSearch] = useState('');
  const [printInvoice, setPrintInvoice] = useState<PrintableInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [contextLoading, setContextLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const loadPlansAndTenants = useCallback(async () => {
    const planRes = await api.get<{ data: PlanSummary[] }>('/control/subscription/plans');
    setPlans(planRes.data);

    if (isSuperAdmin) {
      const params = new URLSearchParams({ per_page: '50' });
      if (tenantSearch.trim()) params.set('search', tenantSearch.trim());
      const list = await api.get<{ data: TenantRow[] }>(`/control/tenants?${params.toString()}`);
      setTenants(list.data);
      setTenantId((current) => {
        if (current && list.data.some((t) => t.id === current)) return current;
        return list.data[0]?.id || current || '';
      });
    } else if (session?.tenantId) {
      setTenantId(session.tenantId);
    }
  }, [api, isSuperAdmin, session?.tenantId, tenantSearch]);

  const loadTenantContext = useCallback(async () => {
    if (!tenantId) {
      setTenant(null);
      setInvoices([]);
      setInvoiceMeta(null);
      setContact(emptyContact());
      return;
    }
    setContextLoading(true);
    setError(null);
    try {
      const [show, inv] = await Promise.all([
        api.get<{ data: TenantDetail }>(`/control/tenants/${tenantId}`),
        api.get<{ data: InvoiceListItem[]; meta: ListMeta }>(
          `/control/tenants/${tenantId}/invoices?per_page=8&page=${invoicePage}`,
        ),
      ]);
      setTenant(show.data);
      setSelectedPlan(show.data.subscription?.plan?.code ?? plans[0]?.code ?? 'starter');
      setInvoices(inv.data);
      setInvoiceMeta(inv.meta ?? null);
      const bc = show.data.billing_contact;
      setContact({
        first_name: bc?.first_name ?? '',
        last_name: bc?.last_name ?? '',
        email: bc?.email ?? '',
        phone: bc?.phone ?? '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscription');
    } finally {
      setContextLoading(false);
    }
  }, [api, tenantId, plans, invoicePage]);

  const reloadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await loadPlansAndTenants();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  }, [loadPlansAndTenants]);

  useEffect(() => {
    void reloadAll();
  }, [api, isSuperAdmin]);

  useEffect(() => {
    void loadTenantContext();
  }, [loadTenantContext]);

  const selectedPlanDetail = useMemo(
    () => plans.find((p) => p.code === selectedPlan) ?? null,
    [plans, selectedPlan],
  );

  async function onTenantSearch(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await loadPlansAndTenants();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search tenants');
    } finally {
      setLoading(false);
    }
  }

  async function changePlan() {
    if (!tenantId || !selectedPlan) return;
    setBusy('plan');
    setError(null);
    try {
      const body: { plan_code: string; tenant_id?: number } = { plan_code: selectedPlan };
      if (isSuperAdmin) body.tenant_id = Number(tenantId);
      const res = await api.post<{
        data: { subscription: { plan: { name_en: string; code: string } } };
      }>('/control/subscription/change-plan', body);
      await feedback.success({
        title: 'Plan updated',
        message: `Now on ${res.data.subscription.plan.name_en} (${res.data.subscription.plan.code}).`,
      });
      await loadTenantContext();
      if (isSuperAdmin) await loadPlansAndTenants();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change plan');
    } finally {
      setBusy(null);
    }
  }

  async function generateInvoice() {
    if (!tenantId) return;
    setBusy('invoice');
    setError(null);
    try {
      const res = await api.post<{ data: InvoiceListItem }>(`/control/tenants/${tenantId}/invoices`);
      await feedback.success({
        title: 'Invoice generated',
        message: `Invoice ${res.data.number} created from the current plan.`,
      });
      setInvoicePage(1);
      await loadTenantContext();
      setTab('invoices');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate invoice');
    } finally {
      setBusy(null);
    }
  }

  async function openPrint(invoiceId: number) {
    if (!tenantId) return;
    setBusy(`print-${invoiceId}`);
    setError(null);
    try {
      const res = await api.get<{ data: PrintableInvoice }>(
        `/control/tenants/${tenantId}/invoices/${invoiceId}`,
      );
      setPrintInvoice(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load invoice for printing');
    } finally {
      setBusy(null);
    }
  }

  async function saveContact(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!tenantId || !validateFormFields(e.currentTarget)) return;
    setBusy('contact');
    setError(null);
    try {
      await api.request(`/control/tenants/${tenantId}/billing-contact`, {
        method: 'PUT',
        body: JSON.stringify({
          first_name: contact.first_name,
          last_name: contact.last_name,
          email: contact.email,
          phone: contact.phone || null,
        }),
      });
      await feedback.success({
        title: 'Billing contact updated',
        message: 'Invoices and billing notices will use this contact.',
      });
      await loadTenantContext();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save billing contact');
    } finally {
      setBusy(null);
    }
  }

  if (loading && plans.length === 0) {
    return <p className="sub-muted">Loading plans & subscription…</p>;
  }

  if (error && plans.length === 0 && !tenant) {
    return (
      <Panel title="Unable to load subscription">
        <p style={{ color: 'var(--stem-danger)', marginTop: 0 }}>{error}</p>
        <Button size="sm" type="button" variant="secondary" onClick={() => void reloadAll()}>
          Retry
        </Button>
      </Panel>
    );
  }

  const plan = tenant?.subscription?.plan;
  const limits = plan?.limits;
  const modules = plan?.modules ?? selectedPlanDetail?.modules ?? selectedPlanDetail?.modules_json;

  return (
    <div className="sub-page">
      <section className="sub-hero stem-animate-rise">
        <div>
          <p className="sub-eyebrow">Control · Billing</p>
          <h2 className="sub-hero-title">Plans & subscription</h2>
          <p className="sub-hero-lead">
            Review the active plan, change limits, keep billing contacts current, and generate
            printable school invoices.
          </p>
        </div>
        <div className="sub-hero-actions">
          <div className="sub-action-row">
            <Button size="sm"
              type="button"
              variant="secondary"
              disabled={loading || contextLoading}
              onClick={() => void reloadAll().then(() => loadTenantContext())}
            >
              {loading || contextLoading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Link to="/dashboard/revenue" className="sub-ghost-link">
              Revenue
            </Link>
            {canManage && tenantId ? (
              <ConfirmButton size="sm"
                title="Generate invoice?"
                message="Create a draft invoice from the current subscription plan."
                confirmLabel="Generate"
                tone="primary"
                variant="apricot"
                onConfirm={generateInvoice}
              >
                {busy === 'invoice' ? 'Working…' : '+ Generate invoice'}
              </ConfirmButton>
            ) : null}
          </div>
        </div>
      </section>

      {error ? (
        <div className="sub-alert" role="alert">
          <span>{error}</span>
          <Button size="sm" type="button" variant="secondary" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}

      {isSuperAdmin ? (
        <Panel
          title="Organisation context"
          description="Choose which school organisation’s subscription and invoices to manage."
          action={
            <Toolbar as="form" onSubmit={onTenantSearch}>
              <input
                value={tenantSearch}
                onChange={(e) => setTenantSearch(e.target.value)}
                placeholder="Search organisations"
                aria-label="Search organisations"
              />
              <Button type="submit" variant="secondary" size="sm">
                Find
              </Button>
            </Toolbar>
          }
        >
          <div className="sub-tenant-bar">
            <SelectField
              label="Organisation"
              value={tenantId === '' ? '' : String(tenantId)}
              onChange={(e) => {
                setInvoicePage(1);
                setTenantId(e.target.value ? Number(e.target.value) : '');
              }}
            >
              <option value="">Select organisation</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.slug}) · {statusLabel(t.status)}
                </option>
              ))}
            </SelectField>
            {tenant ? (
              <div className="sub-tenant-chip">
                <strong>{tenant.name}</strong>
                <span>
                  <code>{tenant.slug}</code> · {statusLabel(tenant.status)}
                </span>
              </div>
            ) : null}
          </div>
        </Panel>
      ) : null}

      {!tenantId ? (
        <Panel title="Select an organisation">
          <p className="sub-muted">Choose an organisation above to manage plans and invoices.</p>
        </Panel>
      ) : (
        <>
          <StatStrip
            items={[
              { label: 'Plan', value: plan?.name_en ?? '—', hint: plan?.code },
              {
                label: 'Org status',
                value: tenant ? statusLabel(tenant.status) : '—',
              },
              {
                label: 'Schools',
                value: `${tenant?.schools_count ?? 0}${limits?.max_schools != null ? ` / ${limits.max_schools}` : ''}`,
              },
              {
                label: 'Invoices',
                value: String(invoiceMeta?.total ?? invoices.length),
                hint: invoiceMeta ? `page ${invoiceMeta.current_page}` : undefined,
              },
            ]}
          />

          <div className="sub-tabs" role="tablist" aria-label="Subscription sections">
            {(
              [
                { id: 'overview', label: 'Overview', hint: 'Plan & snapshot' },
                { id: 'plans', label: 'Plans', hint: 'Catalogue & change' },
                { id: 'invoices', label: 'Invoices', hint: 'Generate & print' },
                { id: 'billing', label: 'Billing contact', hint: 'Invoice recipient' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={tab === item.id ? 'is-active' : undefined}
                onClick={() => setTab(item.id)}
              >
                <strong>{item.label}</strong>
                <span>{item.hint}</span>
              </button>
            ))}
          </div>

          {tab === 'overview' ? (
            <div className="sub-grid">
              <Panel
                title="Current subscription"
                description={tenant ? `${tenant.name} · ${tenant.slug}` : undefined}
                action={
                  canManage ? (
                    <Button size="sm" type="button" variant="secondary" onClick={() => setTab('plans')}>
                      Manage plan
                    </Button>
                  ) : undefined
                }
              >
                <p className="sub-lead">
                  <strong>{plan?.name_en ?? 'No active plan'}</strong>
                  {plan?.price != null ? (
                    <span>
                      {' '}
                      · {plan.currency ?? 'SAR'} {plan.price}
                    </span>
                  ) : null}
                </p>
                <ul className="sub-limits">
                  <li>Schools · {limits?.max_schools ?? '—'}</li>
                  <li>Campuses · {limits?.max_campuses ?? '—'}</li>
                  <li>Students · {limits?.max_students ?? '—'}</li>
                  <li>Teachers · {limits?.max_teachers ?? '—'}</li>
                  <li>Storage · {limits?.max_storage_mb ?? '—'} MB</li>
                </ul>
                {modules ? (
                  <div className="sub-modules">
                    {Object.entries(modules).map(([key, on]) => (
                      <span key={key} className={on ? 'is-on' : undefined}>
                        {key.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                ) : null}
                {tenant?.subscription ? (
                  <p className="sub-muted" style={{ marginTop: '0.85rem' }}>
                    Subscription {statusLabel(tenant.subscription.status)}
                    {tenant.subscription.is_active ? ' · active' : ''}
                    {tenant.subscription.starts_at
                      ? ` · since ${new Date(tenant.subscription.starts_at).toLocaleDateString()}`
                      : ''}
                  </p>
                ) : null}
              </Panel>

              <Panel
                title="Billing snapshot"
                description="Recent invoices and quick actions."
                action={
                  canManage ? (
                    <ConfirmButton size="sm"
                      title="Generate invoice?"
                      message="Create a draft invoice from the current subscription plan."
                      confirmLabel="Generate"
                      tone="primary"
                      variant="primary"
                      onConfirm={generateInvoice}
                    >
                      {busy === 'invoice' ? 'Working…' : 'Generate invoice'}
                    </ConfirmButton>
                  ) : undefined
                }
              >
                {invoices.length === 0 ? (
                  <p className="sub-muted">No invoices yet for this organisation.</p>
                ) : (
                  <ul className="sub-invoice-preview">
                    {invoices.slice(0, 4).map((inv) => (
                      <li key={inv.id}>
                        <div>
                          <strong>{inv.number}</strong>
                          <span>
                            {inv.currency} {inv.total} · {statusLabel(inv.status)}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="secondary" size="xs"
                          disabled={busy === `print-${inv.id}`}
                          onClick={() => void openPrint(inv.id)}
                        >
                          Print
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="sub-action-row" style={{ justifyContent: 'flex-start', marginTop: '0.5rem' }}>
                  <Button size="sm" type="button" variant="ghost" onClick={() => setTab('invoices')}>
                    View all invoices →
                  </Button>
                  <Button size="sm" type="button" variant="ghost" onClick={() => setTab('billing')}>
                    Billing contact →
                  </Button>
                </div>
              </Panel>
            </div>
          ) : null}

          {tab === 'plans' ? (
            <div className="sub-grid">
              <Panel
                title="Change plan"
                description="Updates limits and modules for this organisation immediately."
              >
                {!canManage ? (
                  <p className="sub-muted">You can view the catalogue but do not have permission to change plans.</p>
                ) : (
                  <div className="sub-plan-form">
                    <SelectField
                      label="New plan"
                      value={selectedPlan}
                      onChange={(e) => setSelectedPlan(e.target.value)}
                    >
                      {plans.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.name_en} ({p.code}) · {p.currency ?? 'SAR'} {p.price ?? 0}
                        </option>
                      ))}
                    </SelectField>
                    {selectedPlanDetail ? (
                      <p className="sub-plan-hint">
                        {selectedPlanDetail.max_schools ?? '—'} schools ·{' '}
                        {selectedPlanDetail.max_campuses ?? '—'} campuses ·{' '}
                        {selectedPlanDetail.max_students ?? '—'} students ·{' '}
                        {selectedPlanDetail.max_storage_mb ?? '—'} MB
                      </p>
                    ) : null}
                    <FormActions>
                      <ConfirmButton size="sm"
                        title="Apply plan change?"
                        message="Subscription limits and modules will update for this organisation."
                        confirmLabel="Apply plan"
                        tone="primary"
                        variant="primary"
                        onConfirm={changePlan}
                      >
                        {busy === 'plan' ? 'Updating…' : 'Apply plan'}
                      </ConfirmButton>
                    </FormActions>
                  </div>
                )}
              </Panel>

              <Panel title="Catalogue" description="Active Stemora SaaS plans.">
                <div className="sub-plan-cards">
                  {plans.map((p) => (
                    <button
                      key={p.code}
                      type="button"
                      className={`sub-plan-card ${selectedPlan === p.code ? 'is-selected' : ''}`}
                      onClick={() => setSelectedPlan(p.code)}
                    >
                      <header>
                        <h3>{p.name_en}</h3>
                        <span>
                          {p.currency ?? 'SAR'} {p.price ?? 0}
                        </span>
                      </header>
                      <p>
                        {p.max_schools ?? '—'} schools · {p.max_campuses ?? '—'} campuses ·{' '}
                        {p.max_students ?? '—'} students · {p.max_teachers ?? '—'} teachers
                      </p>
                      {plan?.code === p.code ? <em>Current plan</em> : null}
                    </button>
                  ))}
                </div>
              </Panel>
            </div>
          ) : null}

          {tab === 'invoices' ? (
            <Panel
              title="Invoices"
              description="School subscription invoices for this organisation."
              action={
                canManage ? (
                  <ConfirmButton size="sm"
                    title="Generate invoice?"
                    message="Create a draft invoice from the current subscription plan."
                    confirmLabel="Generate"
                    tone="primary"
                    variant="apricot"
                    onConfirm={generateInvoice}
                  >
                    {busy === 'invoice' ? 'Working…' : 'Generate invoice'}
                  </ConfirmButton>
                ) : undefined
              }
            >
              {invoices.length === 0 ? (
                <p className="sub-muted">No invoices yet. Generate one from the current plan.</p>
              ) : (
                <>
                  <div className="sub-table-wrap">
                    <table className="sub-table">
                      <thead>
                        <tr>
                          <th>Number</th>
                          <th>Total</th>
                          <th>Status</th>
                          <th>Issued</th>
                          <th>Due</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map((inv) => (
                          <tr key={inv.id}>
                            <td>
                              <code>{inv.number}</code>
                            </td>
                            <td>
                              {inv.currency} {inv.total}
                            </td>
                            <td>
                              <StatusPill status={inv.status} />
                            </td>
                            <td>
                              {inv.issued_at ? new Date(inv.issued_at).toLocaleDateString() : '—'}
                            </td>
                            <td>{inv.due_at ? new Date(inv.due_at).toLocaleDateString() : '—'}</td>
                            <td>
                              <Button
                                type="button"
                                variant="secondary" size="xs"
                                disabled={busy === `print-${inv.id}`}
                                onClick={() => void openPrint(inv.id)}
                              >
                                {busy === `print-${inv.id}` ? 'Loading…' : 'Print'}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {invoiceMeta && invoiceMeta.last_page > 1 ? (
                    <div className="sub-pager">
                      <span>
                        Page {invoiceMeta.current_page} of {invoiceMeta.last_page} · {invoiceMeta.total}{' '}
                        total
                      </span>
                      <div className="sub-action-row">
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={invoicePage <= 1 || contextLoading}
                          onClick={() => setInvoicePage((p) => Math.max(1, p - 1))} size="sm"
                        >
                          Previous
                        </Button>
                        <Button size="sm"
                          type="button"
                          variant="secondary"
                          disabled={invoicePage >= invoiceMeta.last_page || contextLoading}
                          onClick={() => setInvoicePage((p) => p + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </Panel>
          ) : null}

          {tab === 'billing' ? (
            <Panel
              title="Billing contact"
              description="Used on printable invoices and billing notices for this organisation."
            >
              {!canManage ? (
                <dl className="sub-contact-view">
                  <div>
                    <dt>Name</dt>
                    <dd>
                      {[contact.first_name, contact.last_name].filter(Boolean).join(' ') || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{contact.email || '—'}</dd>
                  </div>
                  <div>
                    <dt>Phone</dt>
                    <dd>{contact.phone || '—'}</dd>
                  </div>
                </dl>
              ) : (
                <form onSubmit={saveContact} className="sub-contact-form" noValidate>
                  <div className="sub-form-grid">
                    <TextField
                      label="First name"
                      required
                      value={contact.first_name ?? ''}
                      onChange={(e) => setContact((c) => ({ ...c, first_name: e.target.value }))}
                    />
                    <TextField
                      label="Last name"
                      required
                      value={contact.last_name ?? ''}
                      onChange={(e) => setContact((c) => ({ ...c, last_name: e.target.value }))}
                    />
                    <TextField
                      label="Email"
                      type="email"
                      required
                      value={contact.email ?? ''}
                      onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                    />
                    <TextField
                      label="Phone"
                      value={contact.phone ?? ''}
                      onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
                    />
                  </div>
                  <FormActions>
                    <Button type="submit" variant="primary" disabled={busy === 'contact'} size="sm">
                      {busy === 'contact' ? 'Saving…' : 'Save billing contact'}
                    </Button>
                  </FormActions>
                </form>
              )}
            </Panel>
          ) : null}
        </>
      )}

      {printInvoice ? (
        <InvoicePrintView invoice={printInvoice} onClose={() => setPrintInvoice(null)} />
      ) : null}

      <style>{subStyles}</style>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`sub-pill status-${status}`}>{statusLabel(status)}</span>;
}

const subStyles = `
.sub-page { display: grid; gap: 1rem; }
.sub-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(220px, 0.7fr);
  gap: 1.25rem;
  align-items: end;
  padding: 1.25rem 1.35rem;
  border-radius: 18px;
  border: 1px solid var(--stem-line);
  background:
    radial-gradient(120% 90% at 100% 0%, rgba(18, 160, 171, 0.12), transparent 55%),
    linear-gradient(145deg, #f3faf8, #eef5f2);
}
.sub-eyebrow {
  margin: 0 0 0.3rem;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--stem-teal-deep);
}
.sub-hero-title {
  margin: 0 0 0.35rem;
  font-family: var(--stem-font-display);
  font-size: clamp(1.35rem, 1.8vw, 1.55rem);
  letter-spacing: -0.03em;
}
.sub-hero-lead {
  margin: 0;
  color: var(--stem-ink-soft);
  line-height: 1.5;
  max-width: 42rem;
  font-size: var(--stem-text-base);
}
.sub-hero-actions { display: grid; gap: 0.75rem; justify-items: end; }
.sub-action-row { display: flex; flex-wrap: wrap; gap: 0.45rem; justify-content: flex-end; align-items: center; }
.sub-ghost-link {
  display: inline-flex; align-items: center; min-height: 40px; padding: 0 0.75rem;
  font-size: var(--stem-text-md); font-weight: 600; color: var(--stem-teal-deep); text-decoration: none;
}
.sub-ghost-link:hover { text-decoration: underline; }
.sub-alert {
  display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;
  padding: 0.85rem 1rem; border-radius: 12px; background: #fef3f2; color: var(--stem-danger);
  border: 1px solid #fecdca; font-size: var(--stem-text-base);
}
.sub-tenant-bar {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(200px, 0.8fr);
  gap: 1rem;
  align-items: end;
}
.sub-tenant-chip {
  display: grid; gap: 0.2rem;
  padding: 0.85rem 1rem;
  border-radius: 12px;
  border: 1px solid var(--stem-line);
  background: linear-gradient(180deg, #fff, var(--stem-mint-soft));
}
.sub-tenant-chip span { font-size: var(--stem-text-md); color: var(--stem-ink-soft); }
.sub-tenant-chip code {
  font-size: var(--stem-text-sm);
  background: #fff;
  padding: 0.1rem 0.35rem;
  border-radius: 5px;
  border: 1px solid var(--stem-line);
}
.sub-tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.55rem;
}
.sub-tabs button {
  display: grid; gap: 0.15rem; text-align: left;
  border: 1px solid var(--stem-line);
  background: #fff;
  padding: 0.85rem 1rem;
  border-radius: 14px;
  font: inherit;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}
.sub-tabs button strong { font-size: var(--stem-text-base); color: var(--stem-ink); }
.sub-tabs button span { font-size: var(--stem-text-sm); color: var(--stem-ink-soft); }
.sub-tabs button.is-active {
  background: linear-gradient(145deg, var(--portal-accent-soft), #fff 70%);
  border-color: rgba(12, 124, 128, 0.35);
  box-shadow: 0 10px 22px rgba(5, 84, 86, 0.08);
}
.sub-tabs button.is-active strong { color: var(--stem-teal-deep); }
.sub-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
}
.sub-lead { margin: 0 0 0.85rem; font-size: var(--stem-text-xl); }
.sub-lead span { color: var(--stem-ink-soft); font-weight: 500; }
.sub-limits {
  margin: 0 0 0.85rem;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.4rem;
}
.sub-limits li {
  padding: 0.55rem 0.75rem;
  border-radius: 10px;
  background: var(--stem-mint-soft);
  border: 1px solid var(--stem-line);
  font-size: var(--stem-text-base);
}
.sub-modules {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.sub-modules span {
  font-size: var(--stem-text-xs);
  font-weight: 700;
  text-transform: capitalize;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  border: 1px solid #e5e5e5;
  background: #f5f5f5;
  color: #737373;
}
.sub-modules span.is-on {
  background: #ecfdf3;
  color: #067647;
  border-color: #abefc6;
}
.sub-muted { margin: 0; color: var(--stem-ink-soft); font-size: var(--stem-text-base); }
.sub-invoice-preview {
  list-style: none;
  margin: 0 0 0.85rem;
  padding: 0;
  display: grid;
  gap: 0.55rem;
}
.sub-invoice-preview li {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
  padding: 0.7rem 0.8rem;
  border-radius: 12px;
  border: 1px solid var(--stem-line);
  background: #fff;
}
.sub-invoice-preview strong { display: block; }
.sub-invoice-preview span { font-size: var(--stem-text-md); color: var(--stem-ink-soft); }
.sub-plan-form { display: grid; gap: 0.85rem; justify-items: stretch; max-width: 420px; }
.sub-plan-hint { margin: 0; font-size: var(--stem-text-md); color: var(--stem-ink-soft); }
.sub-plan-cards { display: grid; gap: 0.75rem; }
.sub-plan-card {
  display: grid;
  gap: 0.2rem;
  text-align: left;
  width: 100%;
  padding: 1rem 1.05rem;
  border-radius: 14px;
  border: 1px solid var(--stem-line);
  background: linear-gradient(180deg, #fff, var(--stem-mint-soft));
  cursor: pointer;
  font: inherit;
  color: inherit;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.sub-plan-card:hover,
.sub-plan-card.is-selected {
  border-color: rgba(12, 124, 128, 0.45);
  box-shadow: 0 10px 24px rgba(5, 84, 86, 0.08);
}
.sub-plan-card header {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: baseline;
}
.sub-plan-card h3 { margin: 0; font-size: 1.1rem; }
.sub-plan-card header span { font-weight: 700; color: var(--stem-teal-deep); }
.sub-plan-card p { margin: 0.45rem 0 0; color: var(--stem-ink-soft); font-size: var(--stem-text-md); }
.sub-plan-card em {
  display: inline-block;
  margin-top: 0.55rem;
  font-style: normal;
  font-size: var(--stem-text-sm);
  font-weight: 700;
  color: var(--stem-success);
}
.sub-table-wrap { overflow-x: auto; }
.sub-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--stem-text-base);
  min-width: 640px;
}
.sub-table th {
  text-align: left;
  padding: 0.65rem 0.5rem;
  border-bottom: 1px solid var(--stem-line);
  color: var(--stem-ink-soft);
  font-size: var(--stem-text-sm);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 700;
}
.sub-table td {
  padding: 0.85rem 0.5rem;
  border-bottom: 1px solid var(--stem-line);
  vertical-align: middle;
}
.sub-table code {
  font-size: var(--stem-text-md);
  background: var(--stem-mint-soft);
  padding: 0.15rem 0.45rem;
  border-radius: 6px;
  border: 1px solid var(--stem-line);
}
.sub-pager {
  display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;
  margin-top: 0.85rem; padding-top: 0.85rem; border-top: 1px solid var(--stem-line);
  font-size: var(--stem-text-md); color: var(--stem-ink-soft);
}
.sub-form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.85rem;
  margin-bottom: 0.85rem;
}
.sub-contact-form { display: grid; gap: 0.5rem; }
.sub-contact-view {
  display: grid;
  gap: 0.65rem;
  margin: 0;
}
.sub-contact-view > div {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: var(--stem-text-base);
}
.sub-contact-view dt { color: var(--stem-ink-soft); margin: 0; }
.sub-contact-view dd { margin: 0; font-weight: 600; }
.sub-pill {
  display: inline-flex;
  padding: 0.18rem 0.55rem;
  border-radius: 999px;
  font-size: var(--stem-text-xs);
  font-weight: 700;
  border: 1px solid transparent;
}
.sub-pill.status-paid { background: #ecfdf3; color: #067647; border-color: #abefc6; }
.sub-pill.status-sent { background: #eff8ff; color: #175cd3; border-color: #b2ddff; }
.sub-pill.status-draft { background: #f8fafc; color: #475467; border-color: #e4e7ec; }
.sub-pill.status-overdue { background: #fef3f2; color: #b42318; border-color: #fecdca; }
.sub-pill.status-active { background: #ecfdf3; color: #067647; border-color: #abefc6; }
@media (max-width: 960px) {
  .sub-hero, .sub-tabs, .sub-tenant-bar { grid-template-columns: 1fr; }
  .sub-hero-actions { justify-items: start; }
  .sub-action-row { justify-content: flex-start; }
}
`;
