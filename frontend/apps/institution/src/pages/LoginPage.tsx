import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { LoginScreen, type LoginFieldValues } from '@stemora/ui';
import { useAuth } from '@stemora/auth';
import { createApiClient } from '@stemora/api-client';
import { CONTROL_ORIGIN, learnerPortalLoginUrl, publicSchoolSiteUrl } from '../portalOrigins';

const DEFAULT_TENANT = 'al-noor';

export function LoginPage() {
  const { tenantSlug = DEFAULT_TENANT } = useParams();
  const slug = tenantSlug.trim().toLowerCase() || DEFAULT_TENANT;
  const { session, login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (session?.tenantSlug) {
    const roles = session.user.roles ?? [];
    const elevated = [
      'school_owner',
      'school_admin',
      'campus_admin',
      'principal',
      'academic_coordinator',
      'finance_manager',
      'teacher',
    ];
    const tutorOnly = roles.includes('tutor') && !roles.some((r) => elevated.includes(r));
    return <Navigate to={tutorOnly ? `/${session.tenantSlug}/teacher` : `/${session.tenantSlug}`} replace />;
  }

  async function onSubmit(values: LoginFieldValues) {
    setLoading(true);
    setError(null);
    try {
      const api = createApiClient({ getTenantSlug: () => slug });
      const res = await api.post<{
        data: {
          token: string;
          roles: string[];
          permissions?: string[];
          user: { id: number; name?: string; email: string; first_name?: string; last_name?: string };
        };
      }>('/auth/teacher/login', {
        email: values.email,
        password: values.password,
        tenant_slug: slug,
      });

      const u = res.data.user;
      login({
        token: res.data.token,
        user: {
          id: u.id,
          email: u.email,
          name: u.name ?? ([u.first_name, u.last_name].filter(Boolean).join(' ') || u.email),
          roles: res.data.roles,
          permissions: res.data.permissions ?? [],
        },
        tenantSlug: slug,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <LoginScreen
      portal="institution"
      tenantBrandWhen="always"
      loading={loading}
      error={error}
      onSubmit={onSubmit}
      demos={[{ label: 'Tutor / teacher', email: 'tutor@alnoor.test', password: 'Password!123' }]}
      footerExtra={
        <>
          <span>
            Signing in to school <strong>{slug}</strong>
          </span>
          <span>Students and parents sign in on the Learner portal.</span>
          <span>
            <a href={publicSchoolSiteUrl(slug)}>Public website</a>
            {' · '}
            <a href={`${CONTROL_ORIGIN}/login`}>Control</a>
            {' · '}
            <a href={learnerPortalLoginUrl(slug)}>Learner</a>
          </span>
        </>
      }
    />
  );
}
