export type NavPortal = 'control' | 'institution' | 'learner';

export type NavDef = {
  /** Stable id used for path segment and RBAC nav permission suffix */
  id: string;
  label: string;
  icon?: string;
  /** Absolute or portal-relative path (apps prefix tenant slug where needed) */
  path?: string;
  end?: boolean;
  /** Require any of these permissions (super_admin bypasses). Defaults to nav.{portal}.{id} */
  permissions?: string[];
  children?: NavDef[];
};

export type PortalNavItem = {
  /** Stable id for React keys (unique within a submenu) */
  id?: string;
  to: string;
  label: string;
  end?: boolean;
  icon?: string;
  children?: PortalNavItem[];
};

export type NavAccess = {
  roles: string[];
  permissions: string[];
  isSuperAdmin?: boolean;
};

function hasAnyPermission(access: NavAccess, codes: string[]): boolean {
  if (access.isSuperAdmin || access.permissions.includes('*')) return true;
  return codes.some((c) => access.permissions.includes(c));
}

function itemPermissions(portal: NavPortal, item: NavDef, parentPerm?: string): string[] {
  if (item.permissions?.length) return item.permissions;
  const self = `nav.${portal}.${item.id}`;
  return parentPerm ? [self, parentPerm] : [self];
}

function toPortalItem(
  portal: NavPortal,
  item: NavDef,
  basePath: string,
  access: NavAccess,
  parentPerm?: string,
): PortalNavItem | null {
  const perms = itemPermissions(portal, item, parentPerm);
  if (!hasAnyPermission(access, perms)) return null;

  const sectionPerm = `nav.${portal}.${item.id}`;
  const children = (item.children ?? [])
    .map((child) => toPortalItem(portal, child, basePath, access, sectionPerm))
    .filter((c): c is PortalNavItem => Boolean(c));

  const path = item.path ?? `${basePath}/${item.id}`.replace(/\/+/g, '/');
  // Parent with only children and no own page → first child path as group landing
  if (!item.path && item.children?.length && children.length) {
    return {
      id: item.id,
      to: path,
      label: item.label,
      icon: item.icon,
      end: item.end,
      children,
    };
  }

  if (item.children?.length && !children.length) return null;

  return {
    id: item.id,
    to: path,
    label: item.label,
    icon: item.icon,
    end: item.end,
    children: children.length ? children : undefined,
  };
}

/** Highest-level role for the portal (from hierarchy levels embedded in ROLE_PRIORITY). */
const ROLE_PRIORITY: Record<string, number> = {
  super_admin: 100,
  school_owner: 90,
  customer_support: 85,
  auditor: 80,
  school_admin: 80,
  principal: 78,
  campus_admin: 72,
  academic_coordinator: 70,
  finance_manager: 65,
  teacher: 50,
  tutor: 50,
  parent: 20,
  student: 10,
};

export function pickPrimaryRole(roles: string[], allowed: string[]): string | null {
  const normalized = roles.map((r) => (r === 'tenant_owner' ? 'school_owner' : r));
  const candidates = normalized.filter((r) => allowed.includes(r));
  if (!candidates.length) return null;
  return candidates.sort((a, b) => (ROLE_PRIORITY[b] ?? 0) - (ROLE_PRIORITY[a] ?? 0))[0];
}

export function buildPortalNav(
  portal: NavPortal,
  defs: NavDef[],
  access: NavAccess,
  basePath = '',
): PortalNavItem[] {
  return defs
    .map((d) => toPortalItem(portal, d, basePath, access))
    .filter((d): d is PortalNavItem => Boolean(d));
}

export function flattenNavPaths(items: PortalNavItem[]): string[] {
  const out: string[] = [];
  for (const item of items) {
    out.push(item.to);
    if (item.children) out.push(...flattenNavPaths(item.children));
  }
  return out;
}
