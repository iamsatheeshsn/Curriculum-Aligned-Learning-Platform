import { useMemo } from 'react';
import { useAuth } from '@stemora/auth';
import { resolveLearnerNav, type PortalNavItem } from '@stemora/nav';

export function useLearnerNav(slug: string): PortalNavItem[] {
  const { session, isSuperAdmin, roles, permissions } = useAuth();
  return useMemo(
    () =>
      resolveLearnerNav(
        {
          roles: session?.user.roles ?? roles,
          permissions: session?.user.permissions ?? permissions,
          isSuperAdmin,
        },
        slug,
      ),
    [slug, session, roles, permissions, isSuperAdmin],
  );
}
