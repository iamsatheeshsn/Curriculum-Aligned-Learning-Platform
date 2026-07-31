import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import { TenantResolveGate } from '@stemora/ui';
import { LoginPage } from './pages/LoginPage';
import { SchoolDashboard } from './features/school/SchoolDashboard';
import { TeacherWorkspace } from './features/teacher/TeacherWorkspace';
import {
  CurriculumCompletionPage,
  LearningOutcomesPage,
  ReportsPage,
  SchoolAnalyticsPage,
  StudentReportPage,
  TeacherReportPage,
  TutorPerformancePage,
} from './features/school/ReportsPage';
import { ChangePasswordPage } from './features/school/ChangePasswordPage';
import { InstitutionModulePage } from './features/school/InstitutionModulePage';
import {
  TutorAssessmentsPage,
  TutorAvailabilityPage,
  TutorClassroomPage,
  TutorDashboardPage,
  TutorEarningsPage,
  TutorHomeworkPage,
  TutorLiveSessionsPage,
  TutorNotificationsPage,
  TutorProfilePage,
  TutorProgressPage,
  TutorSchedulePage,
  TutorSessionNotesPage,
  TutorStudentsPage,
} from './features/tutor';

const DEFAULT_TENANT = 'al-noor';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const { tenantSlug = DEFAULT_TENANT } = useParams();
  if (!session) return <Navigate to={`/${tenantSlug}/login`} replace />;
  return children;
}

/** Keep signed-in users on their own tenant slug */
function SessionTenantGate({ children }: { children: React.ReactNode }) {
  const { tenantSlug } = useParams();
  const { session } = useAuth();
  if (session && tenantSlug && session.tenantSlug && session.tenantSlug !== tenantSlug) {
    return <Navigate to={`/${session.tenantSlug}`} replace />;
  }
  return children;
}

function Authed({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <SessionTenantGate>{children}</SessionTenantGate>
    </RequireAuth>
  );
}

function TeacherOrTutorHome() {
  const { roles } = useAuth();
  const isTutor = roles.includes('tutor') && !roles.includes('teacher');
  return isTutor ? <TutorDashboardPage /> : <TeacherWorkspace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={`/${DEFAULT_TENANT}`} replace />} />
      <Route path="/:tenantSlug" element={<TenantResolveGate portal="institution" />}>
        <Route path="login" element={<LoginPage />} />
        <Route
          index
          element={
            <Authed>
              <SchoolDashboard />
            </Authed>
          }
        />
        <Route
          path="teacher"
          element={
            <Authed>
              <TeacherOrTutorHome />
            </Authed>
          }
        />
        <Route path="my-students" element={<Authed><TutorStudentsPage /></Authed>} />
        <Route path="session-schedule" element={<Authed><TutorSchedulePage /></Authed>} />
        <Route path="availability" element={<Authed><TutorAvailabilityPage /></Authed>} />
        <Route path="live-sessions" element={<Authed><TutorLiveSessionsPage /></Authed>} />
        <Route path="classroom/:roomId" element={<Authed><TutorClassroomPage /></Authed>} />
        <Route path="homework" element={<Authed><TutorHomeworkPage /></Authed>} />
        <Route path="assessments" element={<Authed><TutorAssessmentsPage /></Authed>} />
        <Route path="session-notes" element={<Authed><TutorSessionNotesPage /></Authed>} />
        <Route path="student-progress" element={<Authed><TutorProgressPage /></Authed>} />
        <Route path="earnings" element={<Authed><TutorEarningsPage /></Authed>} />
        <Route path="notifications" element={<Authed><TutorNotificationsPage /></Authed>} />
        <Route path="profile" element={<Authed><TutorProfilePage /></Authed>} />
        <Route
          path="change-password"
          element={
            <Authed>
              <ChangePasswordPage />
            </Authed>
          }
        />
        <Route
          path="reports"
          element={
            <Authed>
              <ReportsPage />
            </Authed>
          }
        />
        <Route
          path="reports/student"
          element={
            <Authed>
              <StudentReportPage />
            </Authed>
          }
        />
        <Route
          path="reports/teacher"
          element={
            <Authed>
              <TeacherReportPage />
            </Authed>
          }
        />
        <Route
          path="reports/tutor-performance"
          element={
            <Authed>
              <TutorPerformancePage />
            </Authed>
          }
        />
        <Route
          path="reports/school"
          element={
            <Authed>
              <SchoolAnalyticsPage />
            </Authed>
          }
        />
        <Route
          path="reports/curriculum-completion"
          element={
            <Authed>
              <CurriculumCompletionPage />
            </Authed>
          }
        />
        <Route
          path="reports/learning-outcomes"
          element={
            <Authed>
              <LearningOutcomesPage />
            </Authed>
          }
        />
        <Route
          path="*"
          element={
            <Authed>
              <InstitutionModulePage />
            </Authed>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to={`/${DEFAULT_TENANT}/login`} replace />} />
    </Routes>
  );
}
