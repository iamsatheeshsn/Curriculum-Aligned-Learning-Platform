import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { LoginScreen, type LoginFieldValues } from '@stemora/ui';
import { useAuth } from '@stemora/auth';
import { createApiClient } from '@stemora/api-client';
import {
  institutionPortalLoginUrl,
  learnerPortalLoginUrl,
  publicSchoolSiteUrl,
} from '../portalOrigins';

export function LoginPage() {
  const { session, login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (session) return <Navigate to="/" replace />;

  async function onSubmit(values: LoginFieldValues) {
    setLoading(true);
    setError(null);
    try {
      const api = createApiClient();
      const res = await api.post<{
        data: {
          token: string;
          roles: string[];
          permissions?: string[];
          user: {
            id: number;
            name?: string;
            email: string;
            first_name?: string;
            last_name?: string;
          };
          tenant?: { id: number; slug: string; name: string } | null;
        };
      }>('/auth/admin/login', { email: values.email, password: values.password });

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
        tenantSlug: res.data.tenant?.slug ?? null,
        tenantId: res.data.tenant?.id ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <LoginScreen
      portal="control"
      loading={loading}
      error={error}
      onSubmit={onSubmit}
      demos={[
        { label: 'Tenant owner', email: 'owner@alnoor.test', password: 'Password!456' },
        { label: 'Super admin', email: 'superadmin@learning-platform.local', password: 'ChangeMe!123' },
      ]}
      footerExtra={
        <>
          <span>Need school access? Use the Institution or Learner portals.</span>
          <span>
            <a href={publicSchoolSiteUrl('al-noor')}>Public website</a>
            {' · '}
            <a href={institutionPortalLoginUrl('al-noor')}>Institution</a>
            {' · '}
            <a href={learnerPortalLoginUrl('al-noor')}>Learner</a>
          </span>
        </>
      }
    />
  );
}
