import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useAuth } from '@stemora/auth';
import { resolveControlNav } from '@stemora/nav';
import { PortalShell } from '@stemora/ui';

export function ControlLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { session, logout, isSuperAdmin, roles, permissions } = useAuth();

  const nav = useMemo(
    () =>
      resolveControlNav({
        roles: session?.user.roles ?? roles,
        permissions: session?.user.permissions ?? permissions,
        isSuperAdmin,
      }),
    [session, roles, permissions, isSuperAdmin],
  );

  return (
    <PortalShell
      portal="control"
      brandCaption="Control portal"
      title={title}
      subtitle={subtitle}
      nav={nav}
      userLabel={session?.user.email}
      userName={session?.user.name}
      onLogout={logout}
      changePasswordTo="/change-password"
      showSidebarPasswordLink={false}
      collapsible
    >
      {children}
    </PortalShell>
  );
}
