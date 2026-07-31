import { useEffect, useState, type FormEvent } from 'react';
import {
  Button,
  FormActions,
  SelectField,
  TextField,
  useFeedback,
  validateFormFields,
} from '@stemora/ui';
import { SettingsFormShell } from './SettingsFormShell';
import type { GlobalSettings } from './types';
import { usePlatformSettings } from './usePlatformSettings';

const CURRENCIES = ['SAR', 'USD', 'AED', 'KWD', 'QAR', 'BHD', 'OMR', 'EGP', 'EUR', 'GBP'];

export function GlobalSettingsPage() {
  const feedback = useFeedback();
  const { settings, updatedAt, loading, saving, error, reload, save } =
    usePlatformSettings<GlobalSettings>('global');
  const [form, setForm] = useState<GlobalSettings | null>(null);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form || !validateFormFields(e.currentTarget)) return;
    try {
      await save(form);
      await feedback.success({
        title: 'Global settings saved',
        message: 'Platform identity and access controls were updated.',
      });
    } catch {
      /* surfaced via error state */
    }
  }

  return (
    <SettingsFormShell
      pageId="global"
      layoutTitle="Global Settings"
      layoutSubtitle="Platform identity, default currency, and registration controls"
      heroTitle="Global settings"
      heroLead="Configure the platform name, support contact, default currency, and whether new registrations or maintenance mode are enabled."
      panelTitle="Platform configuration"
      panelDescription="These values apply across all tenants and portals."
      loading={loading}
      error={error}
      updatedAt={updatedAt}
      onRetry={() => void reload()}
    >
      {form ? (
        <form className="ps-form" onSubmit={onSubmit} noValidate>
          <div className="ps-form-grid">
            <TextField
              label="Platform name"
              required
              value={form.platform_name}
              onChange={(e) => setForm((f) => (f ? { ...f, platform_name: e.target.value } : f))}
            />
            <TextField
              label="Support email"
              type="email"
              required
              value={form.support_email}
              onChange={(e) => setForm((f) => (f ? { ...f, support_email: e.target.value } : f))}
            />
            <SelectField
              label="Default currency"
              value={form.default_currency}
              onChange={(e) =>
                setForm((f) => (f ? { ...f, default_currency: e.target.value } : f))
              }
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </SelectField>
          </div>
          <fieldset className="ps-fieldset">
            <legend>Access controls</legend>
            <div className="ps-check-group">
              <label className="ps-check">
                <input
                  type="checkbox"
                  checked={form.maintenance_mode}
                  onChange={(e) =>
                    setForm((f) => (f ? { ...f, maintenance_mode: e.target.checked } : f))
                  }
                />
                <span>Maintenance mode</span>
              </label>
              <label className="ps-check">
                <input
                  type="checkbox"
                  checked={form.registration_enabled}
                  onChange={(e) =>
                    setForm((f) => (f ? { ...f, registration_enabled: e.target.checked } : f))
                  }
                />
                <span>Registration enabled</span>
              </label>
            </div>
          </fieldset>
          <FormActions>
            <Button size="sm" type="submit" variant="primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save global settings'}
            </Button>
          </FormActions>
        </form>
      ) : null}
    </SettingsFormShell>
  );
}
