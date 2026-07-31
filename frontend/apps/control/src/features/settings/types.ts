export type SettingsGroup =
  | 'global'
  | 'branding'
  | 'localization'
  | 'security'
  | 'backup';

export type SettingsPageId = SettingsGroup;

export type PlatformSettingsPayload = {
  group: SettingsGroup;
  settings: Record<string, unknown>;
  updated_at?: string | null;
};

export type GlobalSettings = {
  platform_name: string;
  support_email: string;
  default_currency: string;
  maintenance_mode: boolean;
  registration_enabled: boolean;
};

export type BrandingSettings = {
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  control_portal_title: string;
};

export type LocalizationSettings = {
  default_locale: string;
  supported_locales: string[];
  default_timezone: string;
  date_format: string;
  time_format: string;
};

export type SecuritySettings = {
  session_lifetime_minutes: number;
  password_min_length: number;
  require_email_verification: boolean;
  max_login_attempts: number;
  two_factor_enabled: boolean;
};

export type BackupSettings = {
  auto_backup_enabled: boolean;
  backup_frequency: string;
  retention_days: number;
  last_backup_at: string | null;
  last_backup_status: string | null;
};

export type BackupRunResult = {
  job_id: string;
  status: string;
  message: string;
  started_at: string;
  completed_at: string;
  artifacts: { type: string; size_bytes: number }[];
};

export const SETTINGS_NAV: {
  id: SettingsPageId;
  label: string;
  path: string;
  blurb: string;
}[] = [
  {
    id: 'global',
    label: 'Global',
    path: '/settings/global',
    blurb: 'Platform identity, currency, and access toggles',
  },
  {
    id: 'branding',
    label: 'Branding',
    path: '/settings/branding',
    blurb: 'Logos, colours, and control portal title',
  },
  {
    id: 'localization',
    label: 'Localization',
    path: '/settings/localization',
    blurb: 'Locales, timezones, and display formats',
  },
  {
    id: 'security',
    label: 'Security',
    path: '/settings/security',
    blurb: 'Sessions, passwords, and authentication policy',
  },
  {
    id: 'backup',
    label: 'Backup',
    path: '/settings/backup',
    blurb: 'Automated backups and manual restore points',
  },
];
