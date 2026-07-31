import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { useAuth } from '@stemora/auth';
import { Button, ConfirmButton, FormActions, Panel, SelectField, StatStrip, TextAreaField, TextField, useFeedback, validateFormFields } from '@stemora/ui';
import type { Branding, BillingContact, OwnerDashboardData } from '../../types';
import { statusLabel } from '../../types';

export function TenantOwnerDashboard() {
  const { api, session } = useAuth();
  const feedback = useFeedback();
  const [data, setData] = useState<OwnerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<{ code: string; name_en: string }[]>([]);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [branding, setBranding] = useState<Branding>({});
  const [contact, setContact] = useState<BillingContact>({});
  const [orgName, setOrgName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [locale, setLocale] = useState('en');
  const [timezone, setTimezone] = useState('Asia/Riyadh');
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dash, planRes] = await Promise.all([
        api.get<{ data: OwnerDashboardData }>('/control/dashboard'),
        api.get<{ data: { code: string; name_en: string }[] }>('/control/subscription/plans'),
      ]);
      const payload = dash.data;
      setData(payload);
      setPlans(planRes.data);
      setBranding(payload.branding ?? {});
      setContact(payload.billing_contact ?? {});
      setOrgName(payload.tenant.name);
      setLegalName(payload.tenant.legal_name ?? '');
      setLocale(payload.tenant.default_locale ?? 'en');
      setTimezone(payload.tenant.default_timezone ?? 'Asia/Riyadh');
      setSelectedPlan(payload.tenant.subscription?.plan?.code ?? planRes.data[0]?.code ?? 'starter');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load organisation dashboard');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const tenantId = data?.tenant.id;

  async function saveSettings(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateFormFields(e.currentTarget)) return;
    if (!tenantId) return;
    setSaving('settings');
    try {
      await api.request(`/control/tenants/${tenantId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: orgName,
          legal_name: legalName || null,
          default_locale: locale,
          default_timezone: timezone,
        }),
      });
      await feedback.success({ title: 'Organisation updated', message: 'School settings were saved.' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save settings');
    } finally {
      setSaving(null);
    }
  }

  async function saveBranding(e: FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    setSaving('branding');
    try {
      await api.request(`/control/tenants/${tenantId}/branding`, {
        method: 'PUT',
        body: JSON.stringify(branding),
      });
      await feedback.success({ title: 'Branding saved', message: 'Portal colours and footers were updated.' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save branding');
    } finally {
      setSaving(null);
    }
  }

  async function saveContact(e: FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    setSaving('contact');
    try {
      await api.request(`/control/tenants/${tenantId}/billing-contact`, {
        method: 'PUT',
        body: JSON.stringify({
          first_name: contact.first_name,
          last_name: contact.last_name,
          email: contact.email,
          phone: contact.phone,
        }),
      });
      await feedback.success({ title: 'Billing contact updated', message: 'Invoice and billing notices will use this contact.' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save billing contact');
    } finally {
      setSaving(null);
    }
  }

  async function changePlan() {
    if (!selectedPlan) return;
    setSaving('plan');
    try {
      const res = await api.post<{
        data: { subscription: { plan: { name_en: string; code: string } } };
      }>('/control/subscription/change-plan', { plan_code: selectedPlan });
      await feedback.success({
        title: 'Subscription updated',
        message: `You are now on ${res.data.subscription.plan.name_en}.`,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change plan');
    } finally {
      setSaving(null);
    }
  }

  async function generateInvoice() {
    if (!tenantId) return;
    setSaving('invoice');
    try {
      const res = await api.post<{ data: { number: string; total: string | number; currency: string } }>(
        `/control/tenants/${tenantId}/invoices`,
      );
      await feedback.success({
        title: 'Invoice generated',
        message: `Invoice ${res.data.number} · ${res.data.currency} ${res.data.total}`,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate invoice');
    } finally {
      setSaving(null);
    }
  }

  if (loading && !data) {
    return <p style={{ color: 'var(--stem-ink-soft)' }}>Loading organisation dashboard…</p>;
  }

  if (error && !data) {
    return (
      <Panel title="Unable to load">
        <p style={{ color: 'var(--stem-danger)' }}>{error}</p>
        <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
          Retry
        </Button>
      </Panel>
    );
  }

  if (!data) return null;

  const plan = data.tenant.subscription?.plan;
  const limits = plan?.limits;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {error ? (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 12,
            background: '#fef3f2',
            color: 'var(--stem-danger)',
            border: '1px solid #fecdca',
          }}
        >
          {error}
        </div>
      ) : null}

      <StatStrip
        items={[
          { label: 'Plan', value: plan?.name_en ?? '—' },
          {
            label: 'Schools',
            value: `${data.usage.schools}${limits?.max_schools ? ` / ${limits.max_schools}` : ''}`,
          },
          {
            label: 'Students',
            value: `${data.usage.students}${limits?.max_students ? ` / ${limits.max_students}` : ''}`,
          },
          { label: 'Status', value: statusLabel(data.tenant.status) },
        ]}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
        }}
      >
        <Panel
          title="Current subscription"
          action={
            <ConfirmButton size="sm"
              title="Change subscription plan?"
              message="Billing limits and modules will update immediately for your organisation."
              confirmLabel="Change plan"
            tone="primary"
            variant="secondary"
            onConfirm={changePlan}
            >
              {saving === 'plan' ? 'Updating…' : 'Change plan'}
            </ConfirmButton>
          }
        >
          <p style={{ margin: '0 0 0.5rem' }}>
            <strong>{plan?.name_en ?? 'No plan'}</strong>
            {plan?.price != null ? (
              <span style={{ color: 'var(--stem-ink-soft)' }}>
                {' '}
                · {plan.currency ?? 'SAR'} {plan.price}
              </span>
            ) : null}
          </p>
          <p style={{ margin: '0 0 0.85rem', color: 'var(--stem-ink-soft)', fontSize: '0.92rem' }}>
            Limits: {limits?.max_schools ?? '—'} schools · {limits?.max_students ?? '—'} students ·{' '}
            {limits?.max_teachers ?? '—'} teachers
          </p>
          <SelectField
            label="Switch to"
            value={selectedPlan}
            onChange={(e) => setSelectedPlan(e.target.value)}
          >
            {plans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name_en}
              </option>
            ))}
          </SelectField>
        </Panel>

        <Panel title="Signed-in owner">
          <p style={{ margin: 0, color: 'var(--stem-ink-soft)' }}>
            {session?.user.name}
            <br />
            <strong style={{ color: 'var(--stem-ink)' }}>{session?.user.email}</strong>
          </p>
          <p style={{ margin: '0.75rem 0 0', fontSize: '0.9rem' }}>
            Tenant · <code style={codeStyle}>{data.tenant.slug}</code>
          </p>
        </Panel>
      </div>

      <Panel title="Schools">
        {data.schools.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--stem-ink-soft)' }}>No schools yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--stem-ink-soft)' }}>
                  <th style={th}>Code</th>
                  <th style={th}>Name</th>
                  <th style={th}>Status</th>
                  <th style={th}>Timezone</th>
                </tr>
              </thead>
              <tbody>
                {data.schools.map((school) => (
                  <tr key={school.id}>
                    <td style={td}>
                      <code style={codeStyle}>{school.code}</code>
                    </td>
                    <td style={td}>
                      <strong>{school.name_en}</strong>
                      {school.name_ar ? (
                        <div style={{ fontSize: '0.82rem', color: 'var(--stem-ink-soft)' }}>{school.name_ar}</div>
                      ) : null}
                    </td>
                    <td style={td}>{statusLabel(school.status)}</td>
                    <td style={td}>{school.timezone ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1rem',
        }}
      >
        <Panel title="Organisation profile">
          <form onSubmit={saveSettings} style={{ display: 'grid', gap: '0.85rem' }} noValidate>
            <TextField label="Organisation name" required value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            <TextField label="Legal name" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
            <SelectField label="Locale" value={locale} onChange={(e) => setLocale(e.target.value)}>
              <option value="en">English</option>
              <option value="ar">Arabic</option>
            </SelectField>
            <TextField label="Timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
            <FormActions>
              <Button size="sm" type="submit" variant="primary" disabled={saving === 'settings'}>
                {saving === 'settings' ? 'Saving…' : 'Save organisation'}
              </Button>
            </FormActions>
          </form>
        </Panel>

        <Panel title="Branding">
          <form onSubmit={saveBranding} style={{ display: 'grid', gap: '0.85rem' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span
                aria-hidden
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: `linear-gradient(135deg, ${branding.primary_color || '#0c7c80'}, ${branding.secondary_color || '#3b93bc'})`,
                  border: '1px solid var(--stem-line)',
                }}
              />
              <span style={{ fontSize: '0.875rem', color: 'var(--stem-ink-soft)' }}>Preview</span>
            </div>
            <TextField
              label="Primary colour"
              value={branding.primary_color ?? ''}
              placeholder="#0c7c80"
              onChange={(e) => setBranding((b) => ({ ...b, primary_color: e.target.value }))}
            />
            <TextField
              label="Secondary colour"
              value={branding.secondary_color ?? ''}
              placeholder="#3b93bc"
              onChange={(e) => setBranding((b) => ({ ...b, secondary_color: e.target.value }))}
            />
            <TextField
              label="Logo path"
              value={branding.logo_path ?? ''}
              onChange={(e) => setBranding((b) => ({ ...b, logo_path: e.target.value }))}
            />
            <TextAreaField
              label="Email footer (EN)"
              value={branding.email_footer_en ?? ''}
              onChange={(e) => setBranding((b) => ({ ...b, email_footer_en: e.target.value }))}
            />
            <TextAreaField
              label="Email footer (AR)"
              value={branding.email_footer_ar ?? ''}
              onChange={(e) => setBranding((b) => ({ ...b, email_footer_ar: e.target.value }))}
            />
            <FormActions>
              <Button size="sm" type="submit" variant="secondary" disabled={saving === 'branding'}>
                {saving === 'branding' ? 'Saving…' : 'Save branding'}
              </Button>
            </FormActions>
          </form>
        </Panel>

        <Panel title="Billing contact">
          <form onSubmit={saveContact} style={{ display: 'grid', gap: '0.85rem' }}>
            <TextField
              label="First name"
              value={contact.first_name ?? ''}
              onChange={(e) => setContact((c) => ({ ...c, first_name: e.target.value }))}
            />
            <TextField
              label="Last name"
              value={contact.last_name ?? ''}
              onChange={(e) => setContact((c) => ({ ...c, last_name: e.target.value }))}
            />
            <TextField
              label="Email"
              type="email"
              value={contact.email ?? ''}
              onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
            />
            <TextField
              label="Phone"
              value={contact.phone ?? ''}
              onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
            />
            <FormActions>
              <Button size="sm" type="submit" variant="apricot" disabled={saving === 'contact'}>
                {saving === 'contact' ? 'Saving…' : 'Save billing contact'}
              </Button>
            </FormActions>
          </form>
        </Panel>
      </div>

      <Panel
        title="Recent invoices"
        action={
          <ConfirmButton size="sm"
            title="Generate invoice?"
            message="Create a draft invoice from your current subscription plan."
            confirmLabel="Generate"
            tone="primary"
            variant="primary"
            onConfirm={generateInvoice}
          >
            {saving === 'invoice' ? 'Working…' : 'Generate invoice'}
          </ConfirmButton>
        }
      >
        {data.invoices.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--stem-ink-soft)' }}>No invoices yet. Generate one from your plan.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--stem-ink-soft)' }}>
                  <th style={th}>Number</th>
                  <th style={th}>Total</th>
                  <th style={th}>Status</th>
                  <th style={th}>Due</th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td style={td}>
                      <code style={codeStyle}>{inv.number}</code>
                    </td>
                    <td style={td}>
                      {inv.currency} {inv.total}
                    </td>
                    <td style={td}>{statusLabel(inv.status)}</td>
                    <td style={td}>{inv.due_at ? new Date(inv.due_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

const th: CSSProperties = {
  padding: '0.65rem 0.5rem',
  borderBottom: '1px solid var(--stem-line)',
  fontWeight: 600,
  fontSize: 'var(--stem-text-sm)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};
const td: CSSProperties = {
  padding: '0.85rem 0.5rem',
  borderBottom: '1px solid var(--stem-line)',
  verticalAlign: 'middle',
};
const codeStyle: CSSProperties = {
  fontSize: '0.82rem',
  background: 'var(--stem-mint-soft)',
  padding: '0.2rem 0.45rem',
  borderRadius: 6,
};
