import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { LoginScreen, type LoginFieldValues } from '@stemora/ui';
import { useAuth } from '@stemora/auth';
import { createApiClient } from '@stemora/api-client';

const DEFAULT_TENANT = 'al-noor';

export function LoginPage() {
  const { tenantSlug = DEFAULT_TENANT } = useParams();
  const slug = tenantSlug.trim().toLowerCase() || DEFAULT_TENANT;
  const { session, login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (session?.tenantSlug) {
    const roles = session.user.roles ?? [];
    const dest = roles.includes('parent') ? 'parent' : 'student';
    return <Navigate to={`/${session.tenantSlug}/${dest}`} replace />;
  }

  async function onSubmit(values: LoginFieldValues) {
    setLoading(true);
    setError(null);
    try {
      const mode = values.roleMode ?? 'student';
      const api = createApiClient({ getTenantSlug: () => slug });
      const path = mode === 'parent' ? '/auth/parent/login' : '/auth/student/login';
      const res = await api.post<{
        data: {
          token: string;
          roles: string[];
          permissions?: string[];
          user: { id: number; name?: string; email: string; first_name?: string; last_name?: string };
        };
      }>(path, {
        email: values.email,
        password: values.password,
        tenant_slug: slug,
      });

      const u = res.data.user;
      const roles = res.data.roles.length ? res.data.roles : [mode];
      login({
        token: res.data.token,
        user: {
          id: u.id,
          email: u.email,
          name: u.name ?? ([u.first_name, u.last_name].filter(Boolean).join(' ') || u.email),
          roles,
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
      portal="learner"
      showRoleToggle
      tenantBrandWhen="parent"
      loading={loading}
      error={error}
      onSubmit={onSubmit}
      initial={{ roleMode: 'student' }}
      demos={[
        { label: 'Student', email: 'student@alnoor.test', password: 'Password!123', roleMode: 'student' },
        { label: 'Parent', email: 'parent@alnoor.test', password: 'Password!123', roleMode: 'parent' },
      ]}
      footerExtra={
        <>
          <span>
            Signing in to school <strong>{slug}</strong>
          </span>
          <span>School staff use the Institution portal. Platform owners use Control.</span>
          <span>
            <a href={`http://localhost:5173/${slug}`}>Public website</a>
            {' · '}
            <a href="http://localhost:5174/login">Control</a>
            {' · '}
            <a href={`http://localhost:5175/${slug}/login`}>Institution</a>
          </span>
        </>
      }
    />
  );
}
