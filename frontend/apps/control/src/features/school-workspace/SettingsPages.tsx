import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import {
  Button,
  FormActions,
  Panel,
  SelectField,
  StatStrip,
  TextField,
  useFeedback,
  validateFormFields,
} from '@stemora/ui';
import { ControlLayout } from '../../layout/ControlLayout';
import { BrandingSettingsPage as PlatformBrandingPage } from '../settings/BrandingSettingsPage';
import { WORKSPACE_API, WorkspaceGuard } from './shared';
import { workspacePageStyles } from './styles';

const P = 'org-';

type OrgSettings = {
  name: string;
  slug: string;
  timezone: string | null;
  locale: string | null;
  contact_email: string | null;
  status: string;
  plan_code?: string | null;
};

export function OrganisationSettingsPage() {
  return (
    <WorkspaceGuard navPermission={['nav.control.settings', 'tenant.settings.manage', 'school.settings.manage']}>
      <ControlLayout
        title="Organisation"
        subtitle="Tenant identity, locale, and contact defaults for your school group"
      >
        <OrganisationWorkspace />
      </ControlLayout>
    </WorkspaceGuard>
  );
}

function OrganisationWorkspace() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [data, setData] = useState<OrgSettings | null>(null);
  const [form, setForm] = useState({
    name: '',
    timezone: 'Asia/Riyadh',
    locale: 'en',
    contact_email: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: OrgSettings }>(`${WORKSPACE_API}/settings/organisation`);
      setData(res.data);
      setForm({
        name: res.data.name ?? '',
        timezone: res.data.timezone || 'Asia/Riyadh',
        locale: res.data.locale || 'en',
        contact_email: res.data.contact_email ?? '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load organisation settings');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateFormFields(e.currentTarget)) return;
    setSaving(true);
    try {
      const res = await api.put<{ data: OrgSettings }>(`${WORKSPACE_API}/settings/organisation`, form);
      setData(res.data);
      setEditing(false);
      await feedback.success({ title: 'Saved', message: 'Organisation settings updated.' });
    } catch (err) {
      await feedback.error({
        title: 'Save failed',
        message: err instanceof Error ? err.message : 'Unable to save.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`${P}page`}>
      <style>{workspacePageStyles(P)}</style>
      <section className={`${P}hero`}>
        <div>
          <p className={`${P}eyebrow`}>Control · Settings</p>
          <h2 className={`${P}hero-title`}>{data?.name ?? 'Organisation'}</h2>
          <p className={`${P}hero-lead`}>
            Keep your organisation name, timezone, and contact email accurate for invoices and notices.
          </p>
        </div>
        <div className={`${P}hero-actions`}>
          <div className={`${P}action-row`}>
            <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
              Refresh
            </Button>
            <Link className={`${P}ghost-link`} to="/settings/branding">
              Branding
            </Link>
            <Link className={`${P}ghost-link`} to="/settings/subscription">
              Subscription
            </Link>
          </div>
        </div>
      </section>

      {data ? (
        <StatStrip
          items={[
            { label: 'Slug', value: data.slug },
            { label: 'Status', value: data.status },
            { label: 'Plan', value: data.plan_code ?? '—' },
            { label: 'Locale', value: data.locale ?? 'en' },
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

      {loading && !data ? <p>Loading organisation…</p> : null}

      {data ? (
        <div className={`${P}layout`}>
          <Panel
            title="Organisation details"
            description={editing ? 'Update fields and save.' : 'Review core tenant settings.'}
          >
            {editing ? (
              <form onSubmit={onSave} className={`${P}form`} noValidate>
                <TextField
                  label="Organisation name"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
                <TextField label="Slug" value={data.slug} disabled />
                <SelectField
                  label="Timezone"
                  value={form.timezone}
                  onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
                >
                  {['Asia/Riyadh', 'Asia/Dubai', 'Asia/Kuwait', 'UTC'].map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="Locale"
                  value={form.locale}
                  onChange={(e) => setForm((f) => ({ ...f, locale: e.target.value }))}
                >
                  <option value="en">English</option>
                  <option value="ar">Arabic</option>
                </SelectField>
                <TextField
                  label="Contact email"
                  type="email"
                  value={form.contact_email}
                  onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
                />
                <FormActions>
                  <Button size="sm" type="button" variant="secondary" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" type="submit" variant="primary" disabled={saving}>
                    {saving ? 'Saving…' : 'Save changes'}
                  </Button>
                </FormActions>
              </form>
            ) : (
              <>
                <dl className={`${P}meta`}>
                  <div>
                    <dt>Name</dt>
                    <dd>{data.name}</dd>
                  </div>
                  <div>
                    <dt>Slug</dt>
                    <dd>{data.slug}</dd>
                  </div>
                  <div>
                    <dt>Timezone</dt>
                    <dd>{data.timezone ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Locale</dt>
                    <dd>{data.locale ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Contact</dt>
                    <dd>{data.contact_email ?? '—'}</dd>
                  </div>
                </dl>
                <div className={`${P}actions`}>
                  <Button size="sm" type="button" variant="primary" onClick={() => setEditing(true)}>
                    Edit settings
                  </Button>
                </div>
              </>
            )}
          </Panel>
          <aside className={`${P}side`}>
            <div className={`${P}detail`}>
              <h3>Related</h3>
              <div className={`${P}links`}>
                <Link to="/settings/branding">Branding</Link>
                <Link to="/settings/subscription">Subscription & billing</Link>
                <Link to="/school/profile">School profile</Link>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

type BrandingForm = {
  primary_color: string;
  secondary_color: string;
  logo_url: string;
  favicon_url: string;
  app_name: string;
};

export function SchoolBrandingPage() {
  return (
    <WorkspaceGuard navPermission={['nav.control.settings', 'tenant.branding.manage', 'tenant.settings.manage']}>
      <ControlLayout title="Branding" subtitle="Logos and colours for your school-facing experience">
        <SchoolBrandingWorkspace />
      </ControlLayout>
    </WorkspaceGuard>
  );
}

function SchoolBrandingWorkspace() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [form, setForm] = useState<BrandingForm>({
    primary_color: '#0c7c80',
    secondary_color: '#0a1f2b',
    logo_url: '',
    favicon_url: '',
    app_name: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const P = 'brd-';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: Partial<BrandingForm> }>(`${WORKSPACE_API}/settings/branding`);
      setForm({
        primary_color: res.data.primary_color || '#0c7c80',
        secondary_color: res.data.secondary_color || '#0a1f2b',
        logo_url: res.data.logo_url || '',
        favicon_url: res.data.favicon_url || '',
        app_name: res.data.app_name || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load branding');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateFormFields(e.currentTarget)) return;
    setSaving(true);
    try {
      await api.put(`${WORKSPACE_API}/settings/branding`, form);
      await feedback.success({ title: 'Branding saved', message: 'School branding updated.' });
    } catch (err) {
      await feedback.error({
        title: 'Save failed',
        message: err instanceof Error ? err.message : 'Unable to save.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`${P}page`}>
      <style>{workspacePageStyles(P)}</style>
      <section className={`${P}hero`}>
        <div>
          <p className={`${P}eyebrow`}>Control · Settings</p>
          <h2 className={`${P}hero-title`}>Branding</h2>
          <p className={`${P}hero-lead`}>
            Set the colours and assets learners and parents see when they open your portals.
          </p>
        </div>
        <div className={`${P}hero-actions`}>
          <div className={`${P}action-row`}>
            <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
              Refresh
            </Button>
            <Link className={`${P}ghost-link`} to="/settings">
              Organisation
            </Link>
          </div>
        </div>
      </section>

      {error ? (
        <div className={`${P}alert`} role="alert">
          <span>{error}</span>
        </div>
      ) : null}

      {loading ? <p>Loading branding…</p> : null}

      <Panel title="Brand assets & colours" description="Preview updates as you edit.">
        <form onSubmit={onSave} className={`${P}form`} noValidate>
          <TextField
            label="App name"
            value={form.app_name}
            onChange={(e) => setForm((f) => ({ ...f, app_name: e.target.value }))}
          />
          <TextField
            label="Primary colour"
            required
            value={form.primary_color}
            onChange={(e) => setForm((f) => ({ ...f, primary_color: e.target.value }))}
            placeholder="#0c7c80"
          />
          <TextField
            label="Secondary colour"
            required
            value={form.secondary_color}
            onChange={(e) => setForm((f) => ({ ...f, secondary_color: e.target.value }))}
            placeholder="#0a1f2b"
          />
          <TextField
            label="Logo URL"
            value={form.logo_url}
            onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))}
          />
          <TextField
            label="Favicon URL"
            value={form.favicon_url}
            onChange={(e) => setForm((f) => ({ ...f, favicon_url: e.target.value }))}
          />
          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'center',
              padding: '0.85rem 1rem',
              borderRadius: 12,
              background: `linear-gradient(135deg, ${form.primary_color}, ${form.secondary_color})`,
              color: '#fff',
              fontWeight: 600,
            }}
          >
            Preview · {form.app_name || 'Your school'}
          </div>
          <FormActions>
            <Button size="sm" type="submit" variant="primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save branding'}
            </Button>
          </FormActions>
        </form>
      </Panel>
    </div>
  );
}

/** Platform operators get platform branding; school owners get tenant branding. */
export function BrandingRouteSwitch() {
  const { isSuperAdmin, isTenantOwner, hasPermission } = useAuth();
  if (isSuperAdmin) return <PlatformBrandingPage />;
  if (isTenantOwner || hasPermission(['tenant.branding.manage', 'tenant.settings.manage', 'nav.control.settings'])) {
    return <SchoolBrandingPage />;
  }
  if (hasPermission(['platform.tenants.manage'])) return <PlatformBrandingPage />;
  return <Navigate to="/" replace />;
}
