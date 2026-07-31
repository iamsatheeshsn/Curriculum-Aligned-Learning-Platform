import { Navigate } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import { ControlLayout } from '../../layout/ControlLayout';
import { IntegrationsWorkspace } from './IntegrationsWorkspace';

export function EmailProvidersPage() {
  const { isSuperAdmin, hasPermission } = useAuth();
  if (
    !isSuperAdmin &&
    !hasPermission(['platform.tenants.manage', 'nav.control.integrations'])
  ) {
    return <Navigate to="/" replace />;
  }

  return (
    <ControlLayout
      title="Email Providers"
      subtitle="Configure transactional email delivery and the default outbound provider"
    >
      <IntegrationsWorkspace
        category="email"
        title="Email providers"
        subtitle="Connect SMTP, Mailgun, SendGrid, Amazon SES, or custom mail services — manage API keys, sender addresses, and defaults."
        eyebrow="Control · Integrations"
      />
    </ControlLayout>
  );
}
