import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import { TenantResolveGate } from '@stemora/ui';
import { LoginPage } from './pages/LoginPage';
import { ChangePasswordPage } from './features/account/ChangePasswordPage';
import {
  StudentAssignmentsPage,
  StudentCertificatesPage,
  StudentCoursesPage,
  StudentDashboard,
  StudentExamsPage,
  StudentHomeworkPage,
  StudentLabsPage,
  StudentLessonsPage,
  StudentMessagesPage,
  StudentNotificationsPage,
  StudentProfilePage,
  StudentQuizzesPage,
  StudentResultsPage,
  StudentStemPage,
  StudentSubjectsPage,
  StudentTutoringPage,
  StudentClassroomPage,
} from './features/student';
import {
  ParentAssignmentsPage,
  ParentAttendancePage,
  ParentChildrenPage,
  ParentDashboard,
  ParentFeesPage,
  ParentHomeworkPage,
  ParentNoticesPage,
  ParentNotificationsPage,
  ParentProfilePage,
  ParentProgressPage,
  ParentResultsPage,
  ParentTutoringPage,
} from './features/parent';

const DEFAULT_TENANT = 'al-noor';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const { tenantSlug = DEFAULT_TENANT } = useParams();
  if (!session) return <Navigate to={`/${tenantSlug}/login`} replace />;
  return children;
}

function SessionTenantGate({ children }: { children: React.ReactNode }) {
  const { tenantSlug } = useParams();
  const { session } = useAuth();
  if (session && tenantSlug && session.tenantSlug && session.tenantSlug !== tenantSlug) {
    const roles = session.user.roles ?? [];
    const dest = roles.includes('parent') ? 'parent' : 'student';
    return <Navigate to={`/${session.tenantSlug}/${dest}`} replace />;
  }
  return children;
}

function RoleGate({
  allow,
  children,
}: {
  allow: 'student' | 'parent';
  children: React.ReactNode;
}) {
  const { session } = useAuth();
  const { tenantSlug = DEFAULT_TENANT } = useParams();
  const roles = session?.user.roles ?? [];
  const isParent = roles.includes('parent');
  if (allow === 'parent' && !isParent) {
    return <Navigate to={`/${tenantSlug}/student`} replace />;
  }
  if (allow === 'student' && isParent && !roles.includes('student')) {
    return <Navigate to={`/${tenantSlug}/parent`} replace />;
  }
  return children;
}

function Authed({
  allow,
  children,
}: {
  allow: 'student' | 'parent';
  children: React.ReactNode;
}) {
  return (
    <RequireAuth>
      <SessionTenantGate>
        <RoleGate allow={allow}>{children}</RoleGate>
      </SessionTenantGate>
    </RequireAuth>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={`/${DEFAULT_TENANT}/student`} replace />} />
      <Route path="/:tenantSlug" element={<TenantResolveGate portal="learner" />}>
        <Route path="login" element={<LoginPage />} />

        <Route path="student" element={<Authed allow="student"><StudentDashboard /></Authed>} />
        <Route path="student/courses" element={<Authed allow="student"><StudentCoursesPage /></Authed>} />
        <Route path="student/subjects" element={<Authed allow="student"><StudentSubjectsPage /></Authed>} />
        <Route path="student/lessons" element={<Authed allow="student"><StudentLessonsPage /></Authed>} />
        <Route path="student/stem" element={<Authed allow="student"><StudentStemPage /></Authed>} />
        <Route path="student/labs" element={<Authed allow="student"><StudentLabsPage /></Authed>} />
        <Route path="student/homework" element={<Authed allow="student"><StudentHomeworkPage /></Authed>} />
        <Route path="student/assignments" element={<Authed allow="student"><StudentAssignmentsPage /></Authed>} />
        <Route path="student/quizzes" element={<Authed allow="student"><StudentQuizzesPage /></Authed>} />
        <Route path="student/exams" element={<Authed allow="student"><StudentExamsPage /></Authed>} />
        <Route path="student/results" element={<Authed allow="student"><StudentResultsPage /></Authed>} />
        <Route path="student/certificates" element={<Authed allow="student"><StudentCertificatesPage /></Authed>} />
        <Route path="student/tutoring" element={<Authed allow="student"><StudentTutoringPage /></Authed>} />
        <Route path="student/classroom/:roomId" element={<Authed allow="student"><StudentClassroomPage /></Authed>} />
        <Route path="student/messages" element={<Authed allow="student"><StudentMessagesPage /></Authed>} />
        <Route path="student/notifications" element={<Authed allow="student"><StudentNotificationsPage /></Authed>} />
        <Route path="student/profile" element={<Authed allow="student"><StudentProfilePage /></Authed>} />

        <Route path="parent" element={<Authed allow="parent"><ParentDashboard /></Authed>} />
        <Route path="parent/children" element={<Authed allow="parent"><ParentChildrenPage /></Authed>} />
        <Route path="parent/attendance" element={<Authed allow="parent"><ParentAttendancePage /></Authed>} />
        <Route path="parent/homework" element={<Authed allow="parent"><ParentHomeworkPage /></Authed>} />
        <Route path="parent/assignments" element={<Authed allow="parent"><ParentAssignmentsPage /></Authed>} />
        <Route path="parent/results" element={<Authed allow="parent"><ParentResultsPage /></Authed>} />
        <Route path="parent/progress" element={<Authed allow="parent"><ParentProgressPage /></Authed>} />
        <Route path="parent/tutoring" element={<Authed allow="parent"><ParentTutoringPage /></Authed>} />
        <Route path="parent/fees" element={<Authed allow="parent"><ParentFeesPage /></Authed>} />
        <Route path="parent/notices" element={<Authed allow="parent"><ParentNoticesPage /></Authed>} />
        <Route path="parent/notifications" element={<Authed allow="parent"><ParentNotificationsPage /></Authed>} />
        <Route path="parent/profile" element={<Authed allow="parent"><ParentProfilePage /></Authed>} />

        <Route
          path="change-password"
          element={
            <RequireAuth>
              <SessionTenantGate>
                <ChangePasswordPage />
              </SessionTenantGate>
            </RequireAuth>
          }
        />
        <Route index element={<Navigate to="student" replace />} />
      </Route>
      <Route path="*" element={<Navigate to={`/${DEFAULT_TENANT}/login`} replace />} />
    </Routes>
  );
}
