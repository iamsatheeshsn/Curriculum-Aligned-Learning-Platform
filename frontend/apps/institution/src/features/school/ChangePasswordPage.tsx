import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import { ChangePasswordPanel, PortalShell, useResolvedTenant, type ChangePasswordValues } from '@stemora/ui';
import { useInstitutionNav } from '../../nav';

export function ChangePasswordPage() {
  const { tenantSlug = 'al-noor' } = useParams();
  const { api, session, logout, roles } = useAuth();
  const navigate = useNavigate();
  const nav = useInstitutionNav(tenantSlug);
  const tenant = useResolvedTenant();
  const changePasswordTo = `/${tenantSlug}/change-password`;
  const isTutor = roles.includes('tutor') && !roles.includes('teacher');
  const brandCaption = isTutor ? 'Tutor portal' : 'Institution portal';
  const brandName = tenant?.name || tenantSlug;

  async function onSubmit(values: ChangePasswordValues) {
    await api.post('/auth/change-password', values);
  }

  return (
    <PortalShell
      portal="institution"
      brandCaption={brandCaption}
      brandName={brandName}
      title="Change password"
      subtitle="Update your account credentials"
      nav={nav}
      userLabel={session?.user.email}
      userName={session?.user.name}
      onLogout={logout}
      changePasswordTo={changePasswordTo}
      collapsible
    >
      <ChangePasswordPanel
        email={session?.user.email}
        onSubmit={onSubmit}
        onCancel={() => navigate(isTutor ? `/${tenantSlug}/teacher` : `/${tenantSlug}`)}
      />
    </PortalShell>
  );
}
