import { Navigate } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import { ControlLayout } from '../../layout/ControlLayout';
import { IntegrationsWorkspace } from './IntegrationsWorkspace';

export function SmsProvidersPage() {
  const { isSuperAdmin, hasPermission } = useAuth();
  if (
    !isSuperAdmin &&
    !hasPermission(['platform.tenants.manage', 'nav.control.integrations'])
  ) {
    return <Navigate to="/" replace />;
  }

  return (
    <ControlLayout
      title="SMS Providers"
      subtitle="Configure SMS delivery services and the default messaging provider"
    >
      <IntegrationsWorkspace
        category="sms"
        title="SMS providers"
        subtitle="Connect Twilio, Unifonic, MessageBird, or custom SMS gateways — store credentials, test delivery, and set the platform default."
        eyebrow="Control · Integrations"
      />
    </ControlLayout>
  );
}
