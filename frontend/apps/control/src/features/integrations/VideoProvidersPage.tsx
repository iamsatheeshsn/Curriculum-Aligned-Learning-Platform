import { Navigate } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import { ControlLayout } from '../../layout/ControlLayout';
import { IntegrationsWorkspace } from './IntegrationsWorkspace';

export function VideoProvidersPage() {
  const { isSuperAdmin, hasPermission } = useAuth();
  if (
    !isSuperAdmin &&
    !hasPermission(['platform.tenants.manage', 'nav.control.integrations'])
  ) {
    return <Navigate to="/" replace />;
  }

  return (
    <ControlLayout
      title="Video Conference"
      subtitle="Configure live session providers and the default video integration"
    >
      <IntegrationsWorkspace
        category="video"
        title="Video conference"
        subtitle="Connect Zoom, Microsoft Teams, Google Meet, Jitsi, or custom providers — manage OAuth keys, webhooks, and defaults."
        eyebrow="Control · Integrations"
      />
    </ControlLayout>
  );
}
