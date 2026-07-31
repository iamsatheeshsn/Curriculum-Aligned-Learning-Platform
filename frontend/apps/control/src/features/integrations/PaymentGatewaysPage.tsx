import { Navigate } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import { ControlLayout } from '../../layout/ControlLayout';
import { IntegrationsWorkspace } from './IntegrationsWorkspace';

export function PaymentGatewaysPage() {
  const { isSuperAdmin, hasPermission } = useAuth();
  if (
    !isSuperAdmin &&
    !hasPermission(['platform.tenants.manage', 'nav.control.integrations'])
  ) {
    return <Navigate to="/" replace />;
  }

  return (
    <ControlLayout
      title="Payment Gateways"
      subtitle="Configure payment processors, credentials, and the default checkout provider"
    >
      <IntegrationsWorkspace
        category="payment"
        title="Payment gateways"
        subtitle="Connect Stripe, Moyasar, HyperPay, PayPal, or custom gateways — set credentials, test connections, and choose the platform default."
        eyebrow="Control · Integrations"
      />
    </ControlLayout>
  );
}
