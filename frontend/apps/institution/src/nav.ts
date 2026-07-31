import { useMemo } from 'react';
import { useAuth } from '@stemora/auth';
import { resolveInstitutionNav, type PortalNavItem } from '@stemora/nav';

/** Role + permission filtered Institution sidebar. */
export function useInstitutionNav(slug: string): PortalNavItem[] {
  const { session, isSuperAdmin, roles, permissions } = useAuth();
  return useMemo(
    () =>
      resolveInstitutionNav(
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

/** @deprecated Prefer useInstitutionNav — kept for non-hook call sites during migration */
export function institutionNav(slug: string): PortalNavItem[] {
  return resolveInstitutionNav(
    {
      roles: ['school_admin'],
      permissions: ['*'],
      isSuperAdmin: true,
    },
    slug,
  );
}
