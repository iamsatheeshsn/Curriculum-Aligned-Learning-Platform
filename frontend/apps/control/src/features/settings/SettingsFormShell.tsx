import type { ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import { Button, Panel } from '@stemora/ui';
import { ControlLayout } from '../../layout/ControlLayout';
import { SETTINGS_NAV, type SettingsPageId } from './types';
import { psStyles } from './settingsStyles';

function formatUpdatedAt(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function SettingsFormShell({
  pageId,
  layoutTitle,
  layoutSubtitle,
  heroTitle,
  heroLead,
  panelTitle,
  panelDescription,
  loading,
  error,
  updatedAt,
  onRetry,
  children,
  afterPanel,
}: {
  pageId: SettingsPageId;
  layoutTitle: string;
  layoutSubtitle: string;
  heroTitle: string;
  heroLead: string;
  panelTitle: string;
  panelDescription?: string;
  loading?: boolean;
  error?: string | null;
  updatedAt?: string | null;
  onRetry?: () => void;
  children: ReactNode;
  afterPanel?: ReactNode;
}) {
  const { isSuperAdmin, hasPermission } = useAuth();
  if (
    !isSuperAdmin &&
    !hasPermission(['platform.tenants.manage', 'nav.control.settings'])
  ) {
    return <Navigate to="/" replace />;
  }

  const updatedLabel = formatUpdatedAt(updatedAt);

  return (
    <ControlLayout title={layoutTitle} subtitle={layoutSubtitle}>
      <div className="ps-page">
        <section className="ps-hero stem-animate-rise">
          <div>
            <p className="ps-eyebrow">Control · Platform settings</p>
            <h2 className="ps-hero-title">{heroTitle}</h2>
            <p className="ps-hero-lead">{heroLead}</p>
            {updatedLabel ? (
              <p className="ps-hero-meta">Last updated {updatedLabel}</p>
            ) : null}
          </div>
          <nav className="ps-hero-nav" aria-label="Settings sections">
            {SETTINGS_NAV.map((item) => (
              <Link
                key={item.id}
                to={item.path}
                className={`ps-nav-pill ${item.id === pageId ? 'is-active' : ''}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </section>

        {error ? (
          <div className="ps-alert" role="alert">
            <span>{error}</span>
            {onRetry ? (
              <Button size="sm" type="button" variant="secondary" onClick={onRetry}>
                Retry
              </Button>
            ) : null}
          </div>
        ) : null}

        {loading ? (
          <p className="ps-muted">Loading settings…</p>
        ) : (
          <>
            <Panel title={panelTitle} description={panelDescription}>
              {children}
              <div className="ps-quick-links">
                {SETTINGS_NAV.filter((item) => item.id !== pageId).map((item) => (
                  <Link key={item.id} to={item.path}>
                    {item.label}
                  </Link>
                ))}
              </div>
            </Panel>
            {afterPanel}
          </>
        )}
      </div>
      <style>{psStyles}</style>
    </ControlLayout>
  );
}
