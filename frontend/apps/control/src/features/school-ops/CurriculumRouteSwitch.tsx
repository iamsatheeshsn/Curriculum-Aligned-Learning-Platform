import { Navigate } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import { SubjectsPage as PlatformSubjectsPage } from '../super-admin/SubjectsPage';
import { GradesPage as PlatformGradesPage } from '../super-admin/GradesPage';
import { SchoolSubjectsPage } from './SchoolSubjectsPage';
import { SchoolGradesPage } from './SchoolGradesPage';

/**
 * School owners share /curriculum/subjects|grades with the platform catalogue.
 * Prefer tenant school-ops pages for school_owner; platform catalogue for super admin / platform operators.
 */
export function CurriculumSubjectsRoute() {
  const { isSuperAdmin, isTenantOwner, hasPermission } = useAuth();
  if (isSuperAdmin) return <PlatformSubjectsPage />;
  if (isTenantOwner || hasPermission(['school.academics.manage', 'nav.control.curriculum', 'nav.control.subjects'])) {
    return <SchoolSubjectsPage />;
  }
  if (hasPermission(['platform.tenants.manage', 'curriculum.manage', 'nav.control.curriculum-management'])) {
    return <PlatformSubjectsPage />;
  }
  return <Navigate to="/" replace />;
}

export function CurriculumGradesRoute() {
  const { isSuperAdmin, isTenantOwner, hasPermission } = useAuth();
  if (isSuperAdmin) return <PlatformGradesPage />;
  if (isTenantOwner || hasPermission(['school.academics.manage', 'nav.control.curriculum', 'nav.control.grades'])) {
    return <SchoolGradesPage />;
  }
  if (hasPermission(['platform.tenants.manage', 'curriculum.manage', 'nav.control.curriculum-management'])) {
    return <PlatformGradesPage />;
  }
  return <Navigate to="/" replace />;
}
