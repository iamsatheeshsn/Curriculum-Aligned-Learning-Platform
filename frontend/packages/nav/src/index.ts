import { CONTROL_MENUS } from './controlMenus';
import { institutionMenusForRole } from './institutionMenus';
import { learnerMenusForRole } from './learnerMenus';
import {
  buildPortalNav,
  pickPrimaryRole,
  type NavAccess,
  type NavDef,
  type NavPortal,
  type PortalNavItem,
} from './types';

export * from './types';
export * from './controlMenus';
export * from './institutionMenus';
export * from './learnerMenus';

const CONTROL_ROLES = ['super_admin', 'school_owner', 'customer_support', 'auditor'];
const INSTITUTION_ROLES = [
  'school_owner',
  'school_admin',
  'campus_admin',
  'principal',
  'academic_coordinator',
  'finance_manager',
  'teacher',
  'tutor',
];
const LEARNER_ROLES = ['student', 'parent'];

export function resolveControlNav(access: NavAccess): PortalNavItem[] {
  const role = pickPrimaryRole(access.roles, CONTROL_ROLES) ?? 'auditor';
  const defs = [...(CONTROL_MENUS[role] ?? CONTROL_MENUS.auditor)];
  return buildPortalNav('control', defs, access, '');
}

export function resolveInstitutionNav(access: NavAccess, tenantSlug: string): PortalNavItem[] {
  const role = pickPrimaryRole(access.roles, INSTITUTION_ROLES) ?? 'teacher';
  const defs = [...institutionMenusForRole(role, tenantSlug)];
  return buildPortalNav('institution', defs, access, `/${tenantSlug}`);
}

export function resolveLearnerNav(access: NavAccess, tenantSlug: string): PortalNavItem[] {
  const role = pickPrimaryRole(access.roles, LEARNER_ROLES) ?? 'student';
  const defs = [...learnerMenusForRole(role, tenantSlug)];
  return buildPortalNav('learner', defs, access, `/${tenantSlug}`);
}

/** Collect section-level nav permission codes for RBAC seeding helpers / docs */
export function collectNavPermissionCodes(portal: NavPortal, defs: NavDef[]): string[] {
  const codes = new Set<string>();
  const walk = (items: NavDef[]) => {
    for (const item of items) {
      codes.add(`nav.${portal}.${item.id}`);
      if (item.children) walk(item.children);
    }
  };
  walk(defs);
  return [...codes];
}
