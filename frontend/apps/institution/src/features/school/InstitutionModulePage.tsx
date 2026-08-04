import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import { Button, ModuleWorkspace, PortalShell, useResolvedTenant } from '@stemora/ui';
import { useInstitutionNav } from '../../nav';

export function InstitutionModulePage() {
  const { tenantSlug = 'al-noor' } = useParams();
  const location = useLocation();
  const { session, logout, roles } = useAuth();
  const nav = useInstitutionNav(tenantSlug);
  const tenant = useResolvedTenant();
  const navigate = useNavigate();
  const isTutor = roles.includes('tutor') && !roles.includes('teacher');
  const brandCaption = isTutor ? 'Tutor portal' : 'Institution portal';
  const brandName = tenant?.name || tenantSlug;
  const homeTo = isTutor ? `/${tenantSlug}/teacher` : `/${tenantSlug}`;

  return (
    <PortalShell
      portal="institution"
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
      <ModuleWorkspace
        pathname={location.pathname}
        homeTo={homeTo}
        extras={
          <Button type="button" variant="secondary" size="sm" style={{ marginTop: '0.75rem' }} onClick={() => navigate(homeTo)}>
            {isTutor ? 'Open tutor workspace' : 'Open school home'}
          </Button>
        }
      />
    </PortalShell>
  );
}
