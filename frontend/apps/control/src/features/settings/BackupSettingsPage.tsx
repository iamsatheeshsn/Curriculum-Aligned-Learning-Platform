import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@stemora/auth';
import {
  Button,
  ConfirmButton,
  FormActions,
  Panel,
  SelectField,
  TextField,
  useFeedback,
  validateFormFields,
} from '@stemora/ui';
import { SettingsFormShell } from './SettingsFormShell';
import type { BackupRunResult, BackupSettings } from './types';
import { usePlatformSettings } from './usePlatformSettings';

const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function statusClass(status: string | null | undefined): string {
  if (!status) return 'is-neutral';
  if (status === 'completed') return 'is-completed';
  if (status === 'failed') return 'is-failed';
  return 'is-neutral';
}

export function BackupSettingsPage() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const { settings, updatedAt, loading, saving, error, setError, reload, save } =
    usePlatformSettings<BackupSettings>('backup');
  const [form, setForm] = useState<BackupSettings | null>(null);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form || !validateFormFields(e.currentTarget)) return;
    const payload = {
      auto_backup_enabled: form.auto_backup_enabled,
      backup_frequency: form.backup_frequency,
      retention_days: Number(form.retention_days) || 30,
    };
    try {
      await save(payload as BackupSettings);
      await feedback.success({
        title: 'Backup settings saved',
        message: 'Automated backup schedule was updated.',
      });
    } catch {
      /* surfaced via error state */
    }
  }

  async function runBackup() {
    setError(null);
    try {
      const res = await api.post<{ data: BackupRunResult; message?: string }>(
        '/control/settings/backup/run',
      );
      await feedback.success({
        title: 'Backup completed',
        message: res.data.message ?? res.message ?? 'Simulated backup finished successfully.',
      });
      await reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Backup could not be started.';
      setError(message);
      await feedback.confirm({
        title: 'Backup failed',
        message,
        confirmLabel: 'OK',
        cancelLabel: 'Close',
        tone: 'warn',
      });
    }
  }

  return (
    <SettingsFormShell
      pageId="backup"
      layoutTitle="Backup"
      layoutSubtitle="Automated backups and manual restore points"
      heroTitle="Backup"
      heroLead="Configure automated backup frequency and retention, review the last run, or trigger an on-demand backup now."
      panelTitle="Backup schedule"
      panelDescription="Manual runs update last backup status immediately (simulated)."
      loading={loading}
      error={error}
      updatedAt={updatedAt}
      onRetry={() => void reload()}
      afterPanel={
        form ? (
          <Panel title="Last backup" description="Status from the most recent automated or manual run">
            <div className="ps-readonly-grid">
              <div className="ps-readonly-card">
                <span>Last run</span>
                <strong>{formatTimestamp(form.last_backup_at)}</strong>
              </div>
              <div className="ps-readonly-card">
                <span>Status</span>
                <strong>
                  {form.last_backup_status ? (
                    <span className={`ps-status-pill ${statusClass(form.last_backup_status)}`}>
                      {form.last_backup_status}
                    </span>
                  ) : (
                    '—'
                  )}
                </strong>
              </div>
              <div className="ps-readonly-card">
                <span>Retention</span>
                <strong>{form.retention_days} days</strong>
              </div>
            </div>
            <div className="ps-backup-actions">
              <p className="ps-muted">
                Run an immediate backup without changing the schedule. This is a simulated job for
                platform operators.
              </p>
              <ConfirmButton
                size="sm"
                title="Run backup now?"
                message="A simulated backup job will start immediately and update last backup status."
                confirmLabel="Run backup"
                tone="primary"
                variant="primary"
                onConfirm={runBackup}
              >
                Run backup now
              </ConfirmButton>
            </div>
          </Panel>
        ) : null
      }
    >
      {form ? (
        <form className="ps-form" onSubmit={onSubmit} noValidate>
          <label className="ps-check">
            <input
              type="checkbox"
              checked={form.auto_backup_enabled}
              onChange={(e) =>
                setForm((f) => (f ? { ...f, auto_backup_enabled: e.target.checked } : f))
              }
            />
            <span>Automatic backups enabled</span>
          </label>

          <div className="ps-form-grid">
            <SelectField
              label="Backup frequency"
              value={form.backup_frequency}
              onChange={(e) =>
                setForm((f) => (f ? { ...f, backup_frequency: e.target.value } : f))
              }
            >
              {FREQUENCIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Retention (days)"
              type="number"
              min={1}
              max={365}
              required
              value={String(form.retention_days)}
              onChange={(e) =>
                setForm((f) => (f ? { ...f, retention_days: Number(e.target.value) } : f))
              }
            />
          </div>

          <FormActions>
            <Button size="sm" type="submit" variant="primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save backup settings'}
            </Button>
          </FormActions>
        </form>
      ) : null}
    </SettingsFormShell>
  );
}
