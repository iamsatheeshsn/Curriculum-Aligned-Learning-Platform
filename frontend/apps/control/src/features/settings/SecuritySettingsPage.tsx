import { useEffect, useState, type FormEvent } from 'react';
import {
  Button,
  FormActions,
  TextField,
  useFeedback,
  validateFormFields,
} from '@stemora/ui';
import { SettingsFormShell } from './SettingsFormShell';
import type { SecuritySettings } from './types';
import { usePlatformSettings } from './usePlatformSettings';

export function SecuritySettingsPage() {
  const feedback = useFeedback();
  const { settings, updatedAt, loading, saving, error, reload, save } =
    usePlatformSettings<SecuritySettings>('security');
  const [form, setForm] = useState<SecuritySettings | null>(null);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form || !validateFormFields(e.currentTarget)) return;
    const payload: SecuritySettings = {
      ...form,
      session_lifetime_minutes: Number(form.session_lifetime_minutes) || 120,
      password_min_length: Number(form.password_min_length) || 8,
      max_login_attempts: Number(form.max_login_attempts) || 5,
    };
    try {
      await save(payload);
      await feedback.success({
        title: 'Security settings saved',
        message: 'Authentication policy was updated.',
      });
    } catch {
      /* surfaced via error state */
    }
  }

  return (
    <SettingsFormShell
      pageId="security"
      layoutTitle="Security"
      layoutSubtitle="Sessions, passwords, and authentication policy"
      heroTitle="Security"
      heroLead="Tune session lifetime, password rules, login attempt limits, and optional two-factor enforcement for the platform."
      panelTitle="Authentication policy"
      panelDescription="Changes apply to all control and tenant portals."
      loading={loading}
      error={error}
      updatedAt={updatedAt}
      onRetry={() => void reload()}
    >
      {form ? (
        <form className="ps-form" onSubmit={onSubmit} noValidate>
          <div className="ps-form-grid">
            <TextField
              label="Session lifetime (minutes)"
              type="number"
              min={15}
              max={1440}
              required
              value={String(form.session_lifetime_minutes)}
              onChange={(e) =>
                setForm((f) =>
                  f ? { ...f, session_lifetime_minutes: Number(e.target.value) } : f,
                )
              }
            />
            <TextField
              label="Minimum password length"
              type="number"
              min={6}
              max={128}
              required
              value={String(form.password_min_length)}
              onChange={(e) =>
                setForm((f) => (f ? { ...f, password_min_length: Number(e.target.value) } : f))
              }
            />
            <TextField
              label="Max login attempts"
              type="number"
              min={1}
              max={20}
              required
              value={String(form.max_login_attempts)}
              onChange={(e) =>
                setForm((f) => (f ? { ...f, max_login_attempts: Number(e.target.value) } : f))
              }
            />
          </div>

          <fieldset className="ps-fieldset">
            <legend>Verification & MFA</legend>
            <div className="ps-check-group">
              <label className="ps-check">
                <input
                  type="checkbox"
                  checked={form.require_email_verification}
                  onChange={(e) =>
                    setForm((f) =>
                      f ? { ...f, require_email_verification: e.target.checked } : f,
                    )
                  }
                />
                <span>Require email verification</span>
              </label>
              <label className="ps-check">
                <input
                  type="checkbox"
                  checked={form.two_factor_enabled}
                  onChange={(e) =>
                    setForm((f) => (f ? { ...f, two_factor_enabled: e.target.checked } : f))
                  }
                />
                <span>Two-factor authentication enabled</span>
              </label>
            </div>
          </fieldset>

          <FormActions>
            <Button size="sm" type="submit" variant="primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save security settings'}
            </Button>
          </FormActions>
        </form>
      ) : null}
    </SettingsFormShell>
  );
}
