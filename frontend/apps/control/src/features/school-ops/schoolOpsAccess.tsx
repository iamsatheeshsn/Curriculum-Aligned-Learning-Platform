import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@stemora/auth';

const CURRICULUM_PERMISSIONS = ['school.academics.manage', 'nav.control.curriculum'] as const;

export function useSchoolOpsCurriculumAccess(): boolean {
  const { isSuperAdmin, isTenantOwner, hasPermission } = useAuth();
  return (
    isSuperAdmin ||
    isTenantOwner ||
    hasPermission([...CURRICULUM_PERMISSIONS])
  );
}

export function SchoolOpsCurriculumGate({ children }: { children: ReactNode }) {
  if (!useSchoolOpsCurriculumAccess()) {
    return <Navigate to="/" replace />;
  }
  return children;
}
