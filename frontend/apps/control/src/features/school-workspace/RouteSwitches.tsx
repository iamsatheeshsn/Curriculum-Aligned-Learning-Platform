import { Navigate } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import { RevenueReportPage as PlatformRevenueReportPage } from '../reports/RevenueReportPage';
import { AuditLogsPage as PlatformAuditLogsPage } from '../audit/AuditLogsPage';
import { SchoolRevenueReportPage } from './ReportPages';
import { SchoolAuditLogsPage } from './NotificationsAuditPages';

export function RevenueReportRoute() {
  const { isSuperAdmin, isTenantOwner, hasPermission } = useAuth();
  if (isSuperAdmin) return <PlatformRevenueReportPage />;
  if (isTenantOwner || hasPermission(['nav.control.reports', 'reports.finance.view', 'school.reports.view'])) {
    return <SchoolRevenueReportPage />;
  }
  if (hasPermission(['platform.tenants.manage'])) return <PlatformRevenueReportPage />;
  return <Navigate to="/" replace />;
}

export function AuditLogsRoute() {
  const { isSuperAdmin, isTenantOwner, hasPermission } = useAuth();
  if (isSuperAdmin) return <PlatformAuditLogsPage />;
  if (isTenantOwner || hasPermission(['nav.control.audit-logs', 'audit.logs.view'])) {
    return <SchoolAuditLogsPage />;
  }
  if (hasPermission(['platform.tenants.manage', 'platform.audit.view'])) return <PlatformAuditLogsPage />;
  return <Navigate to="/" replace />;
}
