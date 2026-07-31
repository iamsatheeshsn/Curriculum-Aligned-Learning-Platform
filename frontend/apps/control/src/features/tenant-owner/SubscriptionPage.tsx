import { Navigate } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import { ControlLayout } from '../../layout/ControlLayout';
import { SubscriptionWorkspace } from './SubscriptionWorkspace';

/** Manage plans, subscription, billing contact, and printable invoices. */
export function SubscriptionPage() {
  const { isSuperAdmin, isTenantOwner, hasPermission } = useAuth();

  if (
    !isSuperAdmin &&
    !isTenantOwner &&
    !hasPermission([
      'tenant.billing.manage',
      'tenant.billing.view',
      'platform.plans.manage',
      'platform.tenants.manage',
      'nav.control.billing',
    ])
  ) {
    return <Navigate to="/" replace />;
  }

  return (
    <ControlLayout
      title={isSuperAdmin ? 'Plans & subscription' : 'Subscription'}
      subtitle="Manage plans, billing contact, and printable school invoices"
    >
      <SubscriptionWorkspace />
    </ControlLayout>
  );
}
