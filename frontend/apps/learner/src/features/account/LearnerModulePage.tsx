import { useLocation, useParams } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import { ModuleWorkspace, PortalShell, useResolvedTenant } from '@stemora/ui';
import { useLearnerNav } from '../../nav';

export function LearnerModulePage() {
  const { tenantSlug = 'al-noor' } = useParams();
  const location = useLocation();
  const { session, logout } = useAuth();
  const nav = useLearnerNav(tenantSlug);
  const tenant = useResolvedTenant();
  const roles = session?.user.roles ?? [];
  const isParent = roles.includes('parent');
  const home = isParent ? 'parent' : 'student';
  const brandCaption = isParent ? 'Parent portal' : 'Student portal';
  const brandName = isParent ? tenant?.name || tenantSlug : undefined;

  return (
    <PortalShell
      portal="learner"
      brandCaption={brandCaption}
      brandName={brandName}
      title="Module"
      subtitle="Member portal workspace"
      nav={nav}
      userLabel={session?.user.email}
      userName={session?.user.name}
      onLogout={logout}
      changePasswordTo={`/${tenantSlug}/change-password`}
      collapsible
    >
      <ModuleWorkspace pathname={location.pathname} homeTo={`/${tenantSlug}/${home}`} />
    </PortalShell>
  );
}
