import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import { Panel } from '@stemora/ui';
import { SuperAdminDashboard } from '../features/super-admin/SuperAdminDashboard';
import { TenantOwnerDashboard } from '../features/tenant-owner/TenantOwnerDashboard';
import { ControlLayout } from '../layout/ControlLayout';

export function DashboardPage() {
  const { isSuperAdmin, isTenantOwner, hasPermission, roles, session } = useAuth();

  if (isSuperAdmin) {
    return (
      <ControlLayout title="Super Admin" subtitle="Provision tenants, manage plans, and monitor subscription health">
        <SuperAdminDashboard />
      </ControlLayout>
    );
  }

  if (isTenantOwner) {
    return (
      <ControlLayout
        title="Organisation"
        subtitle="Schools, branding, billing contact, and subscription"
      >
        <TenantOwnerDashboard />
      </ControlLayout>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  const links: { to: string; label: string; blurb: string }[] = [];
  if (hasPermission('platform.tenants.manage')) {
    links.push({ to: '/tenants', label: 'Tenants', blurb: 'Browse and support school organisations.' });
  }
  if (hasPermission(['tenant.billing.view', 'platform.plans.manage'])) {
    links.push({ to: '/subscription', label: 'Plans', blurb: 'Review plans and billing context.' });
  }
  if (
    hasPermission([
      'platform.rbac.manage',
      'platform.tenants.manage',
      'tenant.settings.manage',
      'school.users.manage',
      'audit.logs.view',
    ])
  ) {
    links.push({ to: '/rbac', label: 'RBAC', blurb: 'Inspect roles, permissions, and assignments.' });
  }

  return (
    <ControlLayout
      title="Control portal"
      subtitle={`Signed in as ${roles.join(', ') || 'operator'}`}
    >
      <Panel title="Workspace" description="Modules available for your role.">
        {links.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--stem-ink-soft)' }}>
            Your account can sign in, but no Control modules are assigned yet. Ask a Super Admin to grant permissions.
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '0.85rem',
            }}
          >
            {links.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                style={{
                  display: 'grid',
                  gap: '0.35rem',
                  padding: '1rem',
                  borderRadius: 14,
                  border: '1px solid var(--stem-line)',
                  background: '#fff',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <strong style={{ color: 'var(--stem-teal-deep)' }}>{item.label}</strong>
                <span style={{ fontSize: '0.88rem', color: 'var(--stem-ink-soft)' }}>{item.blurb}</span>
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </ControlLayout>
  );
}
