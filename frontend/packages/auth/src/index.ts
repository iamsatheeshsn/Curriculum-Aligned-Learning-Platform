import { createContext, createElement, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { createApiClient, type ApiClient } from '@stemora/api-client';

export type AuthSession = {
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
    roles?: string[];
    permissions?: string[];
  };
  tenantSlug?: string | null;
  tenantId?: number | null;
};

type AuthContextValue = {
  session: AuthSession | null;
  api: ApiClient;
  login: (session: AuthSession) => void;
  logout: () => void;
  updateSession: (patch: Partial<AuthSession> | ((prev: AuthSession) => AuthSession)) => void;
  isSuperAdmin: boolean;
  isTenantOwner: boolean;
  roles: string[];
  permissions: string[];
  hasRole: (code: string | string[]) => boolean;
  hasPermission: (code: string | string[]) => boolean;
  canAny: (codes: string[]) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = 'stemora.auth';

function readStored(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

function roleFlags(session: AuthSession | null) {
  const roles = session?.user.roles ?? [];
  const isSuperAdmin = roles.includes('super_admin');
  const isTenantOwner =
    !isSuperAdmin && (roles.includes('school_owner') || roles.includes('tenant_owner'));
  return { isSuperAdmin, isTenantOwner, roles };
}

function permissionList(session: AuthSession | null): string[] {
  return session?.user.permissions ?? [];
}

export function AuthProvider({
  children,
  storageKey = STORAGE_KEY,
}: {
  children: ReactNode;
  storageKey?: string;
}) {
  const [session, setSession] = useState<AuthSession | null>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as AuthSession) : null;
    } catch {
      return null;
    }
  });

  const persist = useCallback(
    (next: AuthSession | null) => {
      if (next) localStorage.setItem(storageKey, JSON.stringify(next));
      else localStorage.removeItem(storageKey);
      setSession(next);
    },
    [storageKey],
  );

  const value = useMemo<AuthContextValue>(() => {
    const api = createApiClient({
      getToken: () => session?.token ?? null,
      getTenantSlug: () => session?.tenantSlug ?? null,
      getSchoolId: () => null,
    });
    const flags = roleFlags(session);
    const permissions = permissionList(session);

    const hasRole = (code: string | string[]) => {
      const need = Array.isArray(code) ? code : [code];
      return need.some((c) => flags.roles.includes(c) || (c === 'school_owner' && flags.roles.includes('tenant_owner')));
    };

    const hasPermission = (code: string | string[]) => {
      if (flags.isSuperAdmin) return true;
      const need = Array.isArray(code) ? code : [code];
      return need.some((c) => permissions.includes(c));
    };

    return {
      session,
      api,
      ...flags,
      permissions,
      hasRole,
      hasPermission,
      canAny: (codes) => hasPermission(codes),
      login: (next) => persist(next),
      logout: () => persist(null),
      updateSession: (patch) => {
        setSession((prev) => {
          if (!prev) return prev;
          const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
          localStorage.setItem(storageKey, JSON.stringify(next));
          return next;
        });
      },
    };
  }, [session, storageKey, persist]);

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { readStored };
