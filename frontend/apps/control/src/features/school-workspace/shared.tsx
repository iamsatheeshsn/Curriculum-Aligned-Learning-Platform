import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import { statusLabel } from '../../types';

export { WORKSPACE_API } from './styles';

export function WorkspaceGuard({
  children,
  navPermission,
}: {
  children: ReactNode;
  navPermission: string | string[];
}) {
  const { isSuperAdmin, isTenantOwner, hasPermission } = useAuth();
  const need = Array.isArray(navPermission) ? navPermission : [navPermission];
  if (
    !isSuperAdmin &&
    !isTenantOwner &&
    !hasPermission(['school.users.manage', 'school.academics.manage', 'school.settings.manage', ...need])
  ) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export function StatusPill({ prefix, status }: { prefix: string; status?: string | null }) {
  const value = status || 'unknown';
  const slug = value.replace(/_/g, '-');
  return <span className={`${prefix}pill status-${slug}`}>{statusLabel(value)}</span>;
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

export function formatMoney(amount?: number | null, currency = 'SAR') {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number(amount));
  } catch {
    return `${currency} ${Number(amount).toLocaleString()}`;
  }
}
