import { useEffect, useState, type FormEvent } from 'react';
import { Button, FormActions, TextField, useFeedback, validateFormFields } from '@stemora/ui';
import { SettingsFormShell } from './SettingsFormShell';
import type { BrandingSettings } from './types';
import { usePlatformSettings } from './usePlatformSettings';

function normalizeHex(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed}`;
  return fallback;
}

export function BrandingSettingsPage() {
  const feedback = useFeedback();
  const { settings, updatedAt, loading, saving, error, reload, save } =
    usePlatformSettings<BrandingSettings>('branding');
  const [form, setForm] = useState<BrandingSettings | null>(null);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form || !validateFormFields(e.currentTarget)) return;
    const payload: BrandingSettings = {
      ...form,
      primary_color: normalizeHex(form.primary_color, '#2563eb'),
      secondary_color: normalizeHex(form.secondary_color, '#0f172a'),
      logo_url: form.logo_url?.trim() || null,
      favicon_url: form.favicon_url?.trim() || null,
    };
    try {
      await save(payload);
      await feedback.success({
        title: 'Branding saved',
        message: 'Platform colours and assets were updated.',
      });
    } catch {
      /* surfaced via error state */
    }
  }

  const previewPrimary = normalizeHex(form?.primary_color ?? '', '#2563eb');
  const previewSecondary = normalizeHex(form?.secondary_color ?? '', '#0f172a');

  return (
    <SettingsFormShell
      pageId="branding"
      layoutTitle="Branding"
      layoutSubtitle="Logos, colours, and control portal presentation"
      heroTitle="Branding"
      heroLead="Set platform logos, favicon URLs, and brand colours. The control portal chrome keeps Stemora styling — only tenant-facing surfaces use these tokens."
      panelTitle="Brand assets & colours"
      panelDescription="Preview shows how primary and secondary colours combine."
      loading={loading}
      error={error}
      updatedAt={updatedAt}
      onRetry={() => void reload()}
    >
      {form ? (
        <form className="ps-form" onSubmit={onSubmit} noValidate>
          <div className="ps-brand-preview">
            <span
              className="ps-brand-preview-swatch"
              aria-hidden
              style={{
                background: `linear-gradient(135deg, ${previewPrimary}, ${previewSecondary})`,
              }}
            />
            <div className="ps-brand-preview-copy">
              <strong>{form.control_portal_title || 'Control Portal'}</strong>
              <span>
                {previewPrimary} · {previewSecondary}
              </span>
            </div>
          </div>

          <TextField
            label="Control portal title"
            required
            value={form.control_portal_title}
            onChange={(e) =>
              setForm((f) => (f ? { ...f, control_portal_title: e.target.value } : f))
            }
          />

          <div className="ps-form-grid">
            <TextField
              label="Logo URL"
              value={form.logo_url ?? ''}
              placeholder="https://…"
              onChange={(e) =>
                setForm((f) => (f ? { ...f, logo_url: e.target.value || null } : f))
              }
            />
            <TextField
              label="Favicon URL"
              value={form.favicon_url ?? ''}
              placeholder="https://…"
              onChange={(e) =>
                setForm((f) => (f ? { ...f, favicon_url: e.target.value || null } : f))
              }
            />
          </div>

          <div className="ps-form-grid">
            <div className="ps-color-row">
              <input
                className="ps-color-swatch"
                type="color"
                aria-label="Primary colour picker"
                value={previewPrimary}
                onChange={(e) =>
                  setForm((f) => (f ? { ...f, primary_color: e.target.value } : f))
                }
              />
              <TextField
                label="Primary colour"
                value={form.primary_color}
                placeholder="#2563eb"
                onChange={(e) =>
                  setForm((f) => (f ? { ...f, primary_color: e.target.value } : f))
                }
              />
            </div>
            <div className="ps-color-row">
              <input
                className="ps-color-swatch"
                type="color"
                aria-label="Secondary colour picker"
                value={previewSecondary}
                onChange={(e) =>
                  setForm((f) => (f ? { ...f, secondary_color: e.target.value } : f))
                }
              />
              <TextField
                label="Secondary colour"
                value={form.secondary_color}
                placeholder="#0f172a"
                onChange={(e) =>
                  setForm((f) => (f ? { ...f, secondary_color: e.target.value } : f))
                }
              />
            </div>
          </div>

          <FormActions>
            <Button size="sm" type="submit" variant="primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save branding'}
            </Button>
          </FormActions>
        </form>
      ) : null}
    </SettingsFormShell>
  );
}
