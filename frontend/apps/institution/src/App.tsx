import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import { TenantResolveGate } from '@stemora/ui';
import { LoginPage } from './pages/LoginPage';
import { SchoolDashboard } from './features/school/SchoolDashboard';
import {
  TeacherAssignmentsPage,
  TeacherAttendancePage,
  TeacherCourseContentPage,
  TeacherExamsPage,
  TeacherGradeBookPage,
  TeacherHomeworkPage,
  TeacherLessonPlansPage,
  TeacherMessagesPage,
  TeacherProfilePage,
  TeacherProgressPage,
  TeacherQuizzesPage,
  TeacherResourcesPage,
  TeacherWorkspace,
} from './features/teacher';
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

/**
 * `/homework`, `/student-progress`, and `/profile` appear in both the teacher and the
 * tutor menu, so the route has to pick the right screen for the signed-in role.
 */
function ByRole({ teacher, tutor }: { teacher: React.ReactNode; tutor: React.ReactNode }) {
  const { roles } = useAuth();
  const isTutorOnly = roles.includes('tutor') && !roles.includes('teacher');
  return isTutorOnly ? tutor : teacher;
}

function TeacherOrTutorHome() {
  return <ByRole teacher={<TeacherWorkspace />} tutor={<TutorDashboardPage />} />;
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
        {/* Tutor-only screens */}
        <Route path="my-students" element={<Authed><TutorStudentsPage /></Authed>} />
        <Route path="session-schedule" element={<Authed><TutorSchedulePage /></Authed>} />
        <Route path="availability" element={<Authed><TutorAvailabilityPage /></Authed>} />
        <Route path="live-sessions" element={<Authed><TutorLiveSessionsPage /></Authed>} />
        <Route path="classroom/:roomId" element={<Authed><TutorClassroomPage /></Authed>} />
        <Route path="assessments" element={<Authed><TutorAssessmentsPage /></Authed>} />
        <Route path="session-notes" element={<Authed><TutorSessionNotesPage /></Authed>} />
        <Route path="earnings" element={<Authed><TutorEarningsPage /></Authed>} />
        <Route path="notifications" element={<Authed><TutorNotificationsPage /></Authed>} />

        {/* Teacher portal */}
        <Route path="lesson-plans" element={<Authed><TeacherLessonPlansPage /></Authed>} />
        <Route path="course-content" element={<Authed><TeacherCourseContentPage /></Authed>} />
        <Route path="assignments" element={<Authed><TeacherAssignmentsPage /></Authed>} />
        <Route path="quizzes" element={<Authed><TeacherQuizzesPage /></Authed>} />
        <Route path="exams" element={<Authed><TeacherExamsPage /></Authed>} />
        <Route path="attendance" element={<Authed><TeacherAttendancePage /></Authed>} />
        <Route path="grade-book" element={<Authed><TeacherGradeBookPage /></Authed>} />
        <Route path="resources" element={<Authed><TeacherResourcesPage /></Authed>} />
        <Route path="messages" element={<Authed><TeacherMessagesPage /></Authed>} />

        {/* Shared between the teacher and tutor menus */}
        <Route
          path="homework"
          element={<Authed><ByRole teacher={<TeacherHomeworkPage />} tutor={<TutorHomeworkPage />} /></Authed>}
        />
        <Route
          path="student-progress"
          element={<Authed><ByRole teacher={<TeacherProgressPage />} tutor={<TutorProgressPage />} /></Authed>}
        />
        <Route
          path="profile"
          element={<Authed><ByRole teacher={<TeacherProfilePage />} tutor={<TutorProfilePage />} /></Authed>}
        />
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
