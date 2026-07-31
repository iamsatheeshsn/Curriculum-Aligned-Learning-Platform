import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@stemora/auth';
import type { PlatformSettingsPayload, SettingsGroup } from './types';

export function usePlatformSettings<T extends Record<string, unknown>>(group: SettingsGroup) {
  const { api } = useAuth();
  const [settings, setSettings] = useState<T | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: PlatformSettingsPayload }>(`/control/settings/${group}`);
      setSettings(res.data.settings as T);
      setUpdatedAt(res.data.updated_at ?? null);
    } catch (err) {
      setSettings(null);
      setError(err instanceof Error ? err.message : 'Could not load settings.');
    } finally {
      setLoading(false);
    }
  }, [api, group]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (payload: T, successMessage = 'Settings were saved.') => {
      setSaving(true);
      setError(null);
      try {
        const res = await api.request<{ data: PlatformSettingsPayload; message?: string }>(
          `/control/settings/${group}`,
          {
            method: 'PUT',
            body: JSON.stringify({ settings: payload }),
          },
        );
        setSettings(res.data.settings as T);
        setUpdatedAt(res.data.updated_at ?? null);
        return { message: res.message ?? successMessage };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not save settings.';
        setError(message);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [api, group],
  );

  return {
    settings,
    setSettings,
    updatedAt,
    loading,
    saving,
    error,
    setError,
    reload: load,
    save,
  };
}
