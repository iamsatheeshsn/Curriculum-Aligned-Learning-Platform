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
import type { LocalizationSettings } from './types';
import { usePlatformSettings } from './usePlatformSettings';

const LOCALES = [
  { value: 'en', label: 'English (en)' },
  { value: 'ar', label: 'Arabic (ar)' },
];

const TIMEZONES = [
  'Asia/Riyadh',
  'Asia/Dubai',
  'Asia/Kuwait',
  'Asia/Bahrain',
  'Asia/Qatar',
  'Asia/Muscat',
  'Asia/Amman',
  'Asia/Beirut',
  'Africa/Cairo',
  'UTC',
];

const DATE_FORMATS = [
  { value: 'Y-m-d', label: '2026-07-30 (Y-m-d)' },
  { value: 'd/m/Y', label: '30/07/2026 (d/m/Y)' },
  { value: 'm/d/Y', label: '07/30/2026 (m/d/Y)' },
  { value: 'd M Y', label: '30 Jul 2026 (d M Y)' },
];

const TIME_FORMATS = [
  { value: 'H:i', label: '24-hour (H:i)' },
  { value: 'h:i A', label: '12-hour (h:i A)' },
];

export function LocalizationSettingsPage() {
  const feedback = useFeedback();
  const { settings, updatedAt, loading, saving, error, reload, save } =
    usePlatformSettings<LocalizationSettings>('localization');
  const [form, setForm] = useState<LocalizationSettings | null>(null);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  function toggleLocale(code: string, checked: boolean) {
    setForm((current) => {
      if (!current) return current;
      const next = new Set(current.supported_locales ?? []);
      if (checked) next.add(code);
      else next.delete(code);
      const supported = Array.from(next);
      return {
        ...current,
        supported_locales: supported.length ? supported : [current.default_locale],
        default_locale: supported.includes(current.default_locale)
          ? current.default_locale
          : supported[0] ?? current.default_locale,
      };
    });
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form || !validateFormFields(e.currentTarget)) return;
    try {
      await save(form);
      await feedback.success({
        title: 'Localization saved',
        message: 'Locale and formatting defaults were updated.',
      });
    } catch {
      /* surfaced via error state */
    }
  }

  return (
    <SettingsFormShell
      pageId="localization"
      layoutTitle="Localization"
      layoutSubtitle="Default locale, timezone, and display formats"
      heroTitle="Localization"
      heroLead="Choose supported languages, the default locale, timezone, and how dates and times appear across the platform."
      panelTitle="Locale & formatting"
      panelDescription="Supported locales must include the default locale."
      loading={loading}
      error={error}
      updatedAt={updatedAt}
      onRetry={() => void reload()}
    >
      {form ? (
        <form className="ps-form" onSubmit={onSubmit} noValidate>
          <fieldset className="ps-fieldset">
            <legend>Supported locales</legend>
            <div className="ps-check-group">
              {LOCALES.map((locale) => (
                <label key={locale.value} className="ps-check">
                  <input
                    type="checkbox"
                    checked={form.supported_locales?.includes(locale.value) ?? false}
                    onChange={(e) => toggleLocale(locale.value, e.target.checked)}
                  />
                  <span>{locale.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="ps-form-grid">
            <SelectField
              label="Default locale"
              value={form.default_locale}
              onChange={(e) =>
                setForm((f) => (f ? { ...f, default_locale: e.target.value } : f))
              }
            >
              {(form.supported_locales?.length ? form.supported_locales : ['en']).map((code) => {
                const match = LOCALES.find((l) => l.value === code);
                return (
                  <option key={code} value={code}>
                    {match?.label ?? code}
                  </option>
                );
              })}
            </SelectField>
            <SelectField
              label="Default timezone"
              value={form.default_timezone}
              onChange={(e) =>
                setForm((f) => (f ? { ...f, default_timezone: e.target.value } : f))
              }
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Date format"
              value={form.date_format}
              onChange={(e) => setForm((f) => (f ? { ...f, date_format: e.target.value } : f))}
            >
              {DATE_FORMATS.map((fmt) => (
                <option key={fmt.value} value={fmt.value}>
                  {fmt.label}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Time format"
              value={form.time_format}
              onChange={(e) => setForm((f) => (f ? { ...f, time_format: e.target.value } : f))}
            >
              {TIME_FORMATS.map((fmt) => (
                <option key={fmt.value} value={fmt.value}>
                  {fmt.label}
                </option>
              ))}
            </SelectField>
          </div>

          <TextField
            label="Custom timezone"
            hint="Override the list above when needed."
            value={
              TIMEZONES.includes(form.default_timezone) ? '' : form.default_timezone
            }
            placeholder="e.g. Europe/London"
            onChange={(e) => {
              const value = e.target.value.trim();
              if (value) setForm((f) => (f ? { ...f, default_timezone: value } : f));
            }}
          />

          <FormActions>
            <Button size="sm" type="submit" variant="primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save localization'}
            </Button>
          </FormActions>
        </form>
      ) : null}
    </SettingsFormShell>
  );
}
