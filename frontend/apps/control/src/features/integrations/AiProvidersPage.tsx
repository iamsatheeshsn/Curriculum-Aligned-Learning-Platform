import { Navigate } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import { ControlLayout } from '../../layout/ControlLayout';
import { IntegrationsWorkspace } from './IntegrationsWorkspace';

export function AiProvidersPage() {
  const { isSuperAdmin, hasPermission } = useAuth();
  if (
    !isSuperAdmin &&
    !hasPermission(['platform.tenants.manage', 'nav.control.integrations'])
  ) {
    return <Navigate to="/" replace />;
  }

  return (
    <ControlLayout
      title="AI Providers"
      subtitle="Configure AI model providers and the default platform intelligence integration"
    >
      <IntegrationsWorkspace
        category="ai"
        title="AI providers"
        subtitle="Connect OpenAI, Azure OpenAI, Anthropic, Google Gemini, or custom endpoints — manage API keys and set the default model provider."
        eyebrow="Control · Integrations"
      />
    </ControlLayout>
  );
}
