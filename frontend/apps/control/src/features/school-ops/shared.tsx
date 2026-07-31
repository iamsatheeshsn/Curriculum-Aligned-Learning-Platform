import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import { statusLabel } from '../../types';
import type {
  AcademicYearOption,
  GradeOption,
  SectionOption,
  SubjectOption,
} from './types';

const BASE = '/control/school-ops';

export function SchoolOpsGuard({
  children,
  navPermission,
}: {
  children: ReactNode;
  navPermission: string;
}) {
  const { isSuperAdmin, isTenantOwner, hasPermission } = useAuth();
  if (
    !isSuperAdmin &&
    !isTenantOwner &&
    !hasPermission(['school.users.manage', navPermission])
  ) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export function StatusPill({ prefix, status }: { prefix: string; status?: string | null }) {
  const value = status || 'unknown';
  const slug = value.replace(/_/g, '-');
  return (
    <span className={`${prefix}pill status-${slug}`}>{statusLabel(value)}</span>
  );
}

export function personName(first?: string | null, last?: string | null, email?: string | null) {
  const full = [first, last].filter(Boolean).join(' ').trim();
  return full || email || '—';
}

export function initials(first?: string | null, last?: string | null, email?: string | null) {
  const a = (first ?? '').trim().charAt(0);
  const b = (last ?? '').trim().charAt(0);
  const letters = `${a}${b}`.toUpperCase();
  return letters || (email ?? '?').slice(0, 2).toUpperCase();
}

export function formatWhen(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

export function useEnrollmentLookups() {
  const { api } = useAuth();
  const [grades, setGrades] = useState<GradeOption[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [years, setYears] = useState<AcademicYearOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, s, y, subj] = await Promise.all([
        api.get<{ data: GradeOption[] }>(`${BASE}/grades`),
        api.get<{ data: SectionOption[] }>(`${BASE}/sections`),
        api.get<{ data: AcademicYearOption[] }>(`${BASE}/academic-years`),
        api.get<{ data: SubjectOption[] }>(`${BASE}/subjects`),
      ]);
      setGrades(g.data);
      setSections(s.data);
      setYears(y.data);
      setSubjects(subj.data);
    } catch {
      /* lookups optional for list views */
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  return { grades, sections, years, subjects, loading, reload: load };
}

export { BASE as SCHOOL_OPS_API };
