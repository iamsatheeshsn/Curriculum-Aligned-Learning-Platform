import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import { LoginPage } from './pages/LoginPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { TenantsPage } from './features/super-admin/TenantsPage';
import { SchoolGroupsPage } from './features/super-admin/SchoolGroupsPage';
import { CampusesPage } from './features/super-admin/CampusesPage';
import { ActiveSubscriptionsPage } from './features/super-admin/ActiveSubscriptionsPage';
import { TrialAccountsPage } from './features/super-admin/TrialAccountsPage';
import { CountriesPage } from './features/super-admin/CountriesPage';
import { CurriculumsPage } from './features/super-admin/CurriculumsPage';
import { ChaptersPage } from './features/super-admin/ChaptersPage';
import { LessonsPage } from './features/super-admin/LessonsPage';
import { LearningOutcomesPage } from './features/super-admin/LearningOutcomesPage';
import { PlatformUsersPage } from './features/super-admin/PlatformUsersPage';
import { SaasAnalyticsPage } from './features/super-admin/SaasAnalyticsPage';
import { RevenueDashboardPage } from './features/super-admin/RevenueDashboardPage';
import { SystemHealthPage } from './features/super-admin/SystemHealthPage';
import { SubscriptionPage } from './features/tenant-owner/SubscriptionPage';
import { RbacPage } from './features/rbac/RbacPage';
import { PlansPage } from './features/billing/PlansPage';
import { InvoicesPage } from './features/billing/InvoicesPage';
import { PaymentsPage } from './features/billing/PaymentsPage';
import { CouponsPage } from './features/billing/CouponsPage';
import { TaxesPage } from './features/billing/TaxesPage';
import { PaymentGatewaysPage } from './features/integrations/PaymentGatewaysPage';
import { EmailProvidersPage } from './features/integrations/EmailProvidersPage';
import { SmsProvidersPage } from './features/integrations/SmsProvidersPage';
import { VideoProvidersPage } from './features/integrations/VideoProvidersPage';
import { AiProvidersPage } from './features/integrations/AiProvidersPage';
import { SchoolsReportPage } from './features/reports/SchoolsReportPage';
import { StudentsReportPage } from './features/reports/StudentsReportPage';
import { UsageReportPage } from './features/reports/UsageReportPage';
import { ActivityLogsPage } from './features/audit/ActivityLogsPage';
import { LoginHistoryPage } from './features/audit/LoginHistoryPage';
import { GlobalSettingsPage } from './features/settings/GlobalSettingsPage';
import { LocalizationSettingsPage } from './features/settings/LocalizationSettingsPage';
import { SecuritySettingsPage } from './features/settings/SecuritySettingsPage';
import { BackupSettingsPage } from './features/settings/BackupSettingsPage';
import { ControlModulePage } from './pages/ControlModulePage';
import {
  AcademicYearsPage,
  AdmissionsPage,
  AlumniPage,
  GuardiansPage,
  ParentsPage,
  SchoolCampusesPage,
  SchoolClassesPage,
  SchoolProfilePage,
  SchoolSectionsPage,
  SchoolTermsPage,
  StudentsPage,
  TeachersPage,
  TeachingAssignmentsPage,
  TransfersPage,
  TutorsPage,
} from './features/school-ops';
import {
  CurriculumGradesRoute,
  CurriculumSubjectsRoute,
} from './features/school-ops/CurriculumRouteSwitch';
import {
  AcademicReportPage,
  AssessmentResultsPage,
  AttendanceReportPage,
  BrandingRouteSwitch,
  ExamsPage,
  FinanceExpensesPage,
  FinanceFeesPage,
  FinanceReportsPage,
  FinanceTutorPaymentsPage,
  LearningAssignmentsPage,
  LearningCoursesPage,
  LearningHomeworkPage,
  LearningLessonsPage,
  LearningResourcesPage,
  OrganisationSettingsPage,
  PerformanceReportPage,
  QuestionBankPage,
  QuizzesPage,
  SchoolNotificationsPage,
  StaffAttendancePage,
  StaffEmployeesPage,
  TutoringBookingPage,
  TutoringTimetablePage,
  TutoringTutorsPage,
} from './features/school-workspace';
import { AuditLogsRoute, RevenueReportRoute } from './features/school-workspace/RouteSwitches';

const SCHOOL_OPS_PERMS = [
  'tenant.schools.manage',
  'school.settings.manage',
  'school.campuses.manage',
  'school.academics.manage',
  'school.users.manage',
  'nav.control.school-management',
] as const;

const SCHOOL_CURRICULUM_PERMS = [
  'platform.tenants.manage',
  'curriculum.manage',
  'nav.control.curriculum-management',
  'nav.control.curriculum',
  'school.academics.manage',
] as const;

const SCHOOL_PEOPLE_PERMS = [
  'school.users.manage',
  'school.users.view',
  'nav.control.student-management',
  'nav.control.parent-management',
  'nav.control.teacher-management',
] as const;

const SCHOOL_WORKSPACE_PERMS = [
  'school.users.manage',
  'school.academics.manage',
  'school.settings.manage',
  'school.reports.view',
  'tenant.settings.manage',
  'tenant.billing.view',
  'tenant.billing.manage',
  'audit.logs.view',
  'nav.control.staff-management',
  'nav.control.learning-management',
  'nav.control.assessments',
  'nav.control.tutoring',
  'nav.control.finance',
  'nav.control.reports',
  'nav.control.notifications',
  'nav.control.audit-logs',
  'nav.control.settings',
] as const;

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

function RequirePermission({
  anyOf,
  children,
}: {
  anyOf: string[];
  children: React.ReactNode;
}) {
  const { session, hasPermission, isSuperAdmin } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  if (!isSuperAdmin && !hasPermission(anyOf)) return <Navigate to="/" replace />;
  return children;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
      <Route
        path="/dashboard/saas-analytics"
        element={
          <RequirePermission anyOf={['platform.tenants.manage', 'nav.control.dashboard']}>
            <SaasAnalyticsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/dashboard/revenue"
        element={
          <RequirePermission anyOf={['platform.tenants.manage', 'nav.control.dashboard', 'nav.control.billing']}>
            <RevenueDashboardPage />
          </RequirePermission>
        }
      />
      <Route
        path="/dashboard/system-health"
        element={
          <RequirePermission anyOf={['platform.tenants.manage', 'nav.control.dashboard']}>
            <SystemHealthPage />
          </RequirePermission>
        }
      />
      <Route
        path="/tenants/groups"
        element={
          <RequirePermission anyOf={['platform.tenants.manage', 'nav.control.tenant-management', 'nav.control.schools']}>
            <SchoolGroupsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/tenants/campuses"
        element={
          <RequirePermission anyOf={['platform.tenants.manage', 'nav.control.tenant-management', 'nav.control.schools']}>
            <CampusesPage />
          </RequirePermission>
        }
      />
      <Route
        path="/tenants/subscriptions"
        element={
          <RequirePermission anyOf={['platform.tenants.manage', 'platform.plans.manage', 'nav.control.tenant-management', 'nav.control.billing']}>
            <ActiveSubscriptionsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/tenants/trials"
        element={
          <RequirePermission anyOf={['platform.tenants.manage', 'nav.control.tenant-management', 'nav.control.schools']}>
            <TrialAccountsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/curriculum/countries"
        element={
          <RequirePermission
            anyOf={[
              'platform.tenants.manage',
              'curriculum.manage',
              'nav.control.curriculum-management',
            ]}
          >
            <CountriesPage />
          </RequirePermission>
        }
      />
      <Route
        path="/curriculum/curriculums"
        element={
          <RequirePermission
            anyOf={[
              'platform.tenants.manage',
              'curriculum.manage',
              'nav.control.curriculum-management',
            ]}
          >
            <CurriculumsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/curriculum/grades"
        element={
          <RequirePermission anyOf={[...SCHOOL_CURRICULUM_PERMS]}>
            <CurriculumGradesRoute />
          </RequirePermission>
        }
      />
      <Route
        path="/curriculum/subjects"
        element={
          <RequirePermission anyOf={[...SCHOOL_CURRICULUM_PERMS]}>
            <CurriculumSubjectsRoute />
          </RequirePermission>
        }
      />
      <Route
        path="/curriculum/classes"
        element={
          <RequirePermission
            anyOf={['school.academics.manage', 'nav.control.curriculum', 'curriculum.manage']}
          >
            <SchoolClassesPage />
          </RequirePermission>
        }
      />
      <Route
        path="/curriculum/sections"
        element={
          <RequirePermission
            anyOf={['school.academics.manage', 'nav.control.curriculum', 'curriculum.manage']}
          >
            <SchoolSectionsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/curriculum/chapters"
        element={
          <RequirePermission
            anyOf={[
              'platform.tenants.manage',
              'curriculum.manage',
              'nav.control.curriculum-management',
            ]}
          >
            <ChaptersPage />
          </RequirePermission>
        }
      />
      <Route
        path="/curriculum/lessons"
        element={
          <RequirePermission
            anyOf={[
              'platform.tenants.manage',
              'curriculum.manage',
              'nav.control.curriculum-management',
            ]}
          >
            <LessonsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/curriculum/learning-outcomes"
        element={
          <RequirePermission
            anyOf={[
              'platform.tenants.manage',
              'curriculum.manage',
              'nav.control.curriculum-management',
            ]}
          >
            <LearningOutcomesPage />
          </RequirePermission>
        }
      />
      <Route
        path="/tenants"
        element={
          <RequirePermission anyOf={['platform.tenants.manage', 'nav.control.tenant-management', 'nav.control.schools']}>
            <TenantsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/subscription"
        element={
          <RequirePermission
            anyOf={[
              'tenant.billing.manage',
              'tenant.billing.view',
              'platform.plans.manage',
              'platform.tenants.manage',
              'nav.control.billing',
              'nav.control.settings',
            ]}
          >
            <SubscriptionPage />
          </RequirePermission>
        }
      />
      <Route
        path="/billing/plans"
        element={
          <RequirePermission anyOf={['platform.plans.manage', 'platform.tenants.manage', 'nav.control.billing']}>
            <PlansPage />
          </RequirePermission>
        }
      />
      <Route
        path="/billing/invoices"
        element={
          <RequirePermission anyOf={['platform.plans.manage', 'platform.tenants.manage', 'nav.control.billing']}>
            <InvoicesPage />
          </RequirePermission>
        }
      />
      <Route
        path="/billing/payments"
        element={
          <RequirePermission anyOf={['platform.plans.manage', 'platform.tenants.manage', 'nav.control.billing']}>
            <PaymentsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/billing/coupons"
        element={
          <RequirePermission anyOf={['platform.plans.manage', 'platform.tenants.manage', 'nav.control.billing']}>
            <CouponsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/billing/taxes"
        element={
          <RequirePermission anyOf={['platform.plans.manage', 'platform.tenants.manage', 'nav.control.billing']}>
            <TaxesPage />
          </RequirePermission>
        }
      />
      <Route
        path="/integrations/payment-gateways"
        element={
          <RequirePermission anyOf={['platform.tenants.manage', 'nav.control.integrations']}>
            <PaymentGatewaysPage />
          </RequirePermission>
        }
      />
      <Route
        path="/integrations/email"
        element={
          <RequirePermission anyOf={['platform.tenants.manage', 'nav.control.integrations']}>
            <EmailProvidersPage />
          </RequirePermission>
        }
      />
      <Route
        path="/integrations/sms"
        element={
          <RequirePermission anyOf={['platform.tenants.manage', 'nav.control.integrations']}>
            <SmsProvidersPage />
          </RequirePermission>
        }
      />
      <Route
        path="/integrations/video"
        element={
          <RequirePermission anyOf={['platform.tenants.manage', 'nav.control.integrations']}>
            <VideoProvidersPage />
          </RequirePermission>
        }
      />
      <Route
        path="/integrations/ai"
        element={
          <RequirePermission anyOf={['platform.tenants.manage', 'nav.control.integrations']}>
            <AiProvidersPage />
          </RequirePermission>
        }
      />
      <Route
        path="/reports/revenue"
        element={
          <RequirePermission
            anyOf={[
              'platform.tenants.manage',
              'nav.control.reports',
              'reports.finance.view',
              'school.reports.view',
            ]}
          >
            <RevenueReportRoute />
          </RequirePermission>
        }
      />
      <Route
        path="/reports/schools"
        element={
          <RequirePermission anyOf={['platform.tenants.manage', 'nav.control.reports']}>
            <SchoolsReportPage />
          </RequirePermission>
        }
      />
      <Route
        path="/reports/students"
        element={
          <RequirePermission anyOf={['platform.tenants.manage', 'nav.control.reports']}>
            <StudentsReportPage />
          </RequirePermission>
        }
      />
      <Route
        path="/reports/usage"
        element={
          <RequirePermission anyOf={['platform.tenants.manage', 'nav.control.reports']}>
            <UsageReportPage />
          </RequirePermission>
        }
      />
      <Route
        path="/audit/activity"
        element={
          <RequirePermission
            anyOf={['platform.tenants.manage', 'platform.audit.view', 'audit.logs.view', 'nav.control.audit']}
          >
            <ActivityLogsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/audit/logins"
        element={
          <RequirePermission
            anyOf={['platform.tenants.manage', 'platform.audit.view', 'audit.logs.view', 'nav.control.audit']}
          >
            <LoginHistoryPage />
          </RequirePermission>
        }
      />
      <Route
        path="/audit/logs"
        element={
          <RequirePermission
            anyOf={[
              'platform.tenants.manage',
              'platform.audit.view',
              'audit.logs.view',
              'nav.control.audit',
              'nav.control.audit-logs',
            ]}
          >
            <AuditLogsRoute />
          </RequirePermission>
        }
      />
      <Route
        path="/settings/global"
        element={
          <RequirePermission anyOf={['platform.tenants.manage', 'nav.control.settings']}>
            <GlobalSettingsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/settings/branding"
        element={
          <RequirePermission
            anyOf={[
              'platform.tenants.manage',
              'nav.control.settings',
              'tenant.branding.manage',
              'tenant.settings.manage',
            ]}
          >
            <BrandingRouteSwitch />
          </RequirePermission>
        }
      />
      <Route
        path="/settings/localization"
        element={
          <RequirePermission anyOf={['platform.tenants.manage', 'nav.control.settings']}>
            <LocalizationSettingsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/settings/security"
        element={
          <RequirePermission anyOf={['platform.tenants.manage', 'nav.control.settings']}>
            <SecuritySettingsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/settings/backup"
        element={
          <RequirePermission anyOf={['platform.tenants.manage', 'nav.control.settings']}>
            <BackupSettingsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/users/platform"
        element={
          <RequirePermission
            anyOf={[
              'platform.rbac.manage',
              'platform.tenants.manage',
              'nav.control.user-management',
              'nav.control.platform-users',
            ]}
          >
            <PlatformUsersPage />
          </RequirePermission>
        }
      />
      <Route
        path="/rbac"
        element={
          <RequirePermission
            anyOf={[
              'platform.rbac.manage',
              'platform.tenants.manage',
              'tenant.settings.manage',
              'school.users.manage',
              'audit.logs.view',
              'nav.control.user-management',
            ]}
          >
            <RbacPage />
          </RequirePermission>
        }
      />
      <Route
        path="/school/profile"
        element={
          <RequirePermission anyOf={[...SCHOOL_OPS_PERMS]}>
            <SchoolProfilePage />
          </RequirePermission>
        }
      />
      <Route
        path="/school/campuses"
        element={
          <RequirePermission anyOf={[...SCHOOL_OPS_PERMS]}>
            <SchoolCampusesPage />
          </RequirePermission>
        }
      />
      <Route
        path="/school/academic-years"
        element={
          <RequirePermission anyOf={[...SCHOOL_OPS_PERMS]}>
            <AcademicYearsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/school/terms"
        element={
          <RequirePermission anyOf={[...SCHOOL_OPS_PERMS]}>
            <SchoolTermsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/students"
        element={
          <RequirePermission anyOf={[...SCHOOL_PEOPLE_PERMS, 'nav.control.student-management']}>
            <StudentsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/students/admissions"
        element={
          <RequirePermission anyOf={[...SCHOOL_PEOPLE_PERMS, 'nav.control.student-management']}>
            <AdmissionsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/students/transfers"
        element={
          <RequirePermission anyOf={[...SCHOOL_PEOPLE_PERMS, 'nav.control.student-management']}>
            <TransfersPage />
          </RequirePermission>
        }
      />
      <Route
        path="/students/alumni"
        element={
          <RequirePermission anyOf={[...SCHOOL_PEOPLE_PERMS, 'nav.control.student-management']}>
            <AlumniPage />
          </RequirePermission>
        }
      />
      <Route
        path="/parents"
        element={
          <RequirePermission anyOf={[...SCHOOL_PEOPLE_PERMS, 'nav.control.parent-management']}>
            <ParentsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/parents/guardians"
        element={
          <RequirePermission anyOf={[...SCHOOL_PEOPLE_PERMS, 'nav.control.parent-management']}>
            <GuardiansPage />
          </RequirePermission>
        }
      />
      <Route
        path="/teachers"
        element={
          <RequirePermission anyOf={[...SCHOOL_PEOPLE_PERMS, 'nav.control.teacher-management']}>
            <TeachersPage />
          </RequirePermission>
        }
      />
      <Route
        path="/teachers/tutors"
        element={
          <RequirePermission anyOf={[...SCHOOL_PEOPLE_PERMS, 'nav.control.teacher-management']}>
            <TutorsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/teachers/assignments"
        element={
          <RequirePermission anyOf={[...SCHOOL_PEOPLE_PERMS, 'nav.control.teacher-management']}>
            <TeachingAssignmentsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/staff"
        element={
          <RequirePermission anyOf={[...SCHOOL_WORKSPACE_PERMS, 'nav.control.staff-management']}>
            <StaffEmployeesPage />
          </RequirePermission>
        }
      />
      <Route
        path="/staff/attendance"
        element={
          <RequirePermission anyOf={[...SCHOOL_WORKSPACE_PERMS, 'nav.control.staff-management']}>
            <StaffAttendancePage />
          </RequirePermission>
        }
      />
      <Route
        path="/learning/courses"
        element={
          <RequirePermission anyOf={[...SCHOOL_WORKSPACE_PERMS, 'nav.control.learning-management']}>
            <LearningCoursesPage />
          </RequirePermission>
        }
      />
      <Route
        path="/learning/lessons"
        element={
          <RequirePermission anyOf={[...SCHOOL_WORKSPACE_PERMS, 'nav.control.learning-management']}>
            <LearningLessonsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/learning/resources"
        element={
          <RequirePermission anyOf={[...SCHOOL_WORKSPACE_PERMS, 'nav.control.learning-management']}>
            <LearningResourcesPage />
          </RequirePermission>
        }
      />
      <Route
        path="/learning/assignments"
        element={
          <RequirePermission anyOf={[...SCHOOL_WORKSPACE_PERMS, 'nav.control.learning-management']}>
            <LearningAssignmentsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/learning/homework"
        element={
          <RequirePermission anyOf={[...SCHOOL_WORKSPACE_PERMS, 'nav.control.learning-management']}>
            <LearningHomeworkPage />
          </RequirePermission>
        }
      />
      <Route
        path="/assessments/question-bank"
        element={
          <RequirePermission anyOf={[...SCHOOL_WORKSPACE_PERMS, 'nav.control.assessments']}>
            <QuestionBankPage />
          </RequirePermission>
        }
      />
      <Route
        path="/assessments/quizzes"
        element={
          <RequirePermission anyOf={[...SCHOOL_WORKSPACE_PERMS, 'nav.control.assessments']}>
            <QuizzesPage />
          </RequirePermission>
        }
      />
      <Route
        path="/assessments/exams"
        element={
          <RequirePermission anyOf={[...SCHOOL_WORKSPACE_PERMS, 'nav.control.assessments']}>
            <ExamsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/assessments/results"
        element={
          <RequirePermission anyOf={[...SCHOOL_WORKSPACE_PERMS, 'nav.control.assessments']}>
            <AssessmentResultsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/tutoring/tutors"
        element={
          <RequirePermission anyOf={[...SCHOOL_WORKSPACE_PERMS, 'nav.control.tutoring']}>
            <TutoringTutorsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/tutoring/booking"
        element={
          <RequirePermission anyOf={[...SCHOOL_WORKSPACE_PERMS, 'nav.control.tutoring']}>
            <TutoringBookingPage />
          </RequirePermission>
        }
      />
      <Route
        path="/tutoring/timetable"
        element={
          <RequirePermission anyOf={[...SCHOOL_WORKSPACE_PERMS, 'nav.control.tutoring']}>
            <TutoringTimetablePage />
          </RequirePermission>
        }
      />
      <Route
        path="/finance/fees"
        element={
          <RequirePermission anyOf={[...SCHOOL_WORKSPACE_PERMS, 'nav.control.finance']}>
            <FinanceFeesPage />
          </RequirePermission>
        }
      />
      <Route
        path="/finance/tutor-payments"
        element={
          <RequirePermission anyOf={[...SCHOOL_WORKSPACE_PERMS, 'nav.control.finance']}>
            <FinanceTutorPaymentsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/finance/expenses"
        element={
          <RequirePermission anyOf={[...SCHOOL_WORKSPACE_PERMS, 'nav.control.finance']}>
            <FinanceExpensesPage />
          </RequirePermission>
        }
      />
      <Route
        path="/finance/reports"
        element={
          <RequirePermission anyOf={[...SCHOOL_WORKSPACE_PERMS, 'nav.control.finance']}>
            <FinanceReportsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/reports/academic"
        element={
          <RequirePermission anyOf={[...SCHOOL_WORKSPACE_PERMS, 'nav.control.reports']}>
            <AcademicReportPage />
          </RequirePermission>
        }
      />
      <Route
        path="/reports/attendance"
        element={
          <RequirePermission anyOf={[...SCHOOL_WORKSPACE_PERMS, 'nav.control.reports']}>
            <AttendanceReportPage />
          </RequirePermission>
        }
      />
      <Route
        path="/reports/performance"
        element={
          <RequirePermission anyOf={[...SCHOOL_WORKSPACE_PERMS, 'nav.control.reports']}>
            <PerformanceReportPage />
          </RequirePermission>
        }
      />
      <Route
        path="/notifications"
        element={
          <RequirePermission anyOf={[...SCHOOL_WORKSPACE_PERMS, 'nav.control.notifications']}>
            <SchoolNotificationsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/settings"
        element={
          <RequirePermission
            anyOf={[...SCHOOL_WORKSPACE_PERMS, 'nav.control.settings', 'tenant.settings.manage']}
          >
            <OrganisationSettingsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/settings/subscription"
        element={
          <RequirePermission
            anyOf={[
              'tenant.billing.manage',
              'tenant.billing.view',
              'platform.plans.manage',
              'platform.tenants.manage',
              'nav.control.billing',
              'nav.control.settings',
            ]}
          >
            <SubscriptionPage />
          </RequirePermission>
        }
      />
      <Route
        path="/change-password"
        element={
          <RequireAuth>
            <ChangePasswordPage />
          </RequireAuth>
        }
      />
      <Route
        path="*"
        element={
          <RequireAuth>
            <ControlModulePage />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
