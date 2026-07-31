import type { NavDef } from './types';

function withSlug(slug: string, path: string) {
  if (path === '/') return `/${slug}`;
  return `/${slug}${path.startsWith('/') ? path : `/${path}`}`;
}

function mapPaths(defs: NavDef[], slug: string): NavDef[] {
  return defs.map((d) => ({
    ...d,
    path: d.path !== undefined ? withSlug(slug, d.path) : undefined,
    children: d.children ? mapPaths(d.children, slug) : undefined,
  }));
}

const SCHOOL_ADMIN_MENU: NavDef[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '⌂', path: '/', end: true },
  { id: 'students', label: 'Students', icon: '🎓', path: '/students' },
  { id: 'parents', label: 'Parents', icon: '☺', path: '/parents' },
  { id: 'teachers', label: 'Teachers', icon: '✎', path: '/teachers' },
  { id: 'classes', label: 'Classes', icon: '▦', path: '/classes' },
  { id: 'timetable', label: 'Timetable', icon: '◷', path: '/timetable' },
  { id: 'attendance', label: 'Attendance', icon: '☑', path: '/attendance' },
  { id: 'assignments', label: 'Assignments', icon: '▤', path: '/assignments' },
  { id: 'exams', label: 'Exams', icon: '▥', path: '/exams' },
  {
    id: 'reports',
    label: 'Reports',
    icon: '▥',
    path: '/reports',
    end: true,
    children: [
      { id: 'student-report', label: 'Student report', path: '/reports/student' },
      { id: 'teacher-report', label: 'Teacher report', path: '/reports/teacher' },
      { id: 'tutor-performance', label: 'Tutor performance', path: '/reports/tutor-performance' },
      { id: 'school-analytics', label: 'School analytics', path: '/reports/school' },
      { id: 'curriculum-completion', label: 'Curriculum completion', path: '/reports/curriculum-completion' },
      { id: 'learning-outcomes', label: 'Learning outcomes', path: '/reports/learning-outcomes' },
    ],
  },
];

const PRINCIPAL_MENU: NavDef[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '⌂', path: '/', end: true },
  { id: 'school-performance', label: 'School Performance', icon: '▥', path: '/performance' },
  { id: 'teachers', label: 'Teachers', icon: '✎', path: '/teachers' },
  { id: 'students', label: 'Students', icon: '🎓', path: '/students' },
  { id: 'attendance', label: 'Attendance', icon: '☑', path: '/attendance' },
  { id: 'assessments', label: 'Assessments', icon: '▤', path: '/assessments' },
  { id: 'academic-reports', label: 'Academic Reports', icon: '▥', path: '/reports' },
  { id: 'tutor-performance', label: 'Tutor Performance', icon: '◎', path: '/reports/tutor-performance' },
  { id: 'notifications', label: 'Notifications', icon: '🔔', path: '/notifications' },
];

const ACADEMIC_COORDINATOR_MENU: NavDef[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '⌂', path: '/', end: true },
  { id: 'curriculum', label: 'Curriculum', icon: '▤', path: '/curriculum' },
  { id: 'subjects', label: 'Subjects', icon: '▦', path: '/subjects' },
  { id: 'lesson-planning', label: 'Lesson Planning', icon: '✎', path: '/lesson-planning' },
  { id: 'homework', label: 'Homework', icon: '☑', path: '/homework' },
  { id: 'assessments', label: 'Assessments', icon: '▥', path: '/assessments' },
  { id: 'teachers', label: 'Teachers', icon: '☺', path: '/teachers' },
  { id: 'academic-calendar', label: 'Academic Calendar', icon: '◷', path: '/calendar' },
  { id: 'reports', label: 'Reports', icon: '▥', path: '/reports' },
];

const TEACHER_MENU: NavDef[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '⌂', path: '/', end: true },
  { id: 'my-classes', label: 'My Classes', icon: '▦', path: '/teacher' },
  { id: 'lesson-plans', label: 'Lesson Plans', icon: '✎', path: '/lesson-plans' },
  { id: 'course-content', label: 'Course Content', icon: '📚', path: '/course-content' },
  { id: 'homework', label: 'Homework', icon: '☑', path: '/homework' },
  { id: 'assignments', label: 'Assignments', icon: '▤', path: '/assignments' },
  { id: 'quizzes', label: 'Quizzes', icon: '◈', path: '/quizzes' },
  { id: 'exams', label: 'Exams', icon: '▥', path: '/exams' },
  { id: 'attendance', label: 'Attendance', icon: '☑', path: '/attendance' },
  { id: 'student-progress', label: 'Student Progress', icon: '📈', path: '/student-progress' },
  { id: 'grade-book', label: 'Grade Book', icon: '▤', path: '/grade-book' },
  { id: 'resources', label: 'Resources', icon: '📚', path: '/resources' },
  { id: 'messages', label: 'Messages', icon: '💬', path: '/messages' },
  { id: 'profile', label: 'Profile', icon: '☺', path: '/profile' },
];

const TUTOR_MENU: NavDef[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '⌂', path: '/teacher', end: true },
  { id: 'my-students', label: 'My Students', icon: '🎓', path: '/my-students' },
  { id: 'session-schedule', label: 'Session Schedule', icon: '◷', path: '/session-schedule' },
  { id: 'availability', label: 'Availability', icon: '◎', path: '/availability' },
  { id: 'live-sessions', label: 'Live Sessions', icon: '◈', path: '/live-sessions' },
  { id: 'homework', label: 'Homework', icon: '☑', path: '/homework' },
  { id: 'assessments', label: 'Assessments', icon: '▤', path: '/assessments' },
  { id: 'session-notes', label: 'Session Notes', icon: '✎', path: '/session-notes' },
  { id: 'student-progress', label: 'Student Progress', icon: '📈', path: '/student-progress' },
  { id: 'earnings', label: 'Earnings', icon: '◈', path: '/earnings' },
  { id: 'notifications', label: 'Notifications', icon: '🔔', path: '/notifications' },
  { id: 'profile', label: 'Profile', icon: '☺', path: '/profile' },
];

const FINANCE_MANAGER_MENU: NavDef[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '⌂', path: '/', end: true },
  { id: 'student-fees', label: 'Student Fees', icon: '◈', path: '/finance/fees' },
  { id: 'tutor-payments', label: 'Tutor Payments', icon: '◈', path: '/finance/tutor-payments' },
  { id: 'expenses', label: 'Expenses', icon: '▦', path: '/finance/expenses' },
  { id: 'refunds', label: 'Refunds', icon: '↩', path: '/finance/refunds' },
  { id: 'invoices', label: 'Invoices', icon: '▤', path: '/finance/invoices' },
  { id: 'financial-reports', label: 'Financial Reports', icon: '▥', path: '/finance/reports' },
];

/** Campus admin — operational subset of school admin */
const CAMPUS_ADMIN_MENU: NavDef[] = SCHOOL_ADMIN_MENU;

export const INSTITUTION_MENU_TEMPLATES: Record<string, NavDef[]> = {
  school_admin: SCHOOL_ADMIN_MENU,
  campus_admin: CAMPUS_ADMIN_MENU,
  principal: PRINCIPAL_MENU,
  academic_coordinator: ACADEMIC_COORDINATOR_MENU,
  teacher: TEACHER_MENU,
  tutor: TUTOR_MENU,
  finance_manager: FINANCE_MANAGER_MENU,
  /** Owners who sign into institution see admin-level ops */
  school_owner: SCHOOL_ADMIN_MENU,
};

export function institutionMenusForRole(role: string, slug: string): NavDef[] {
  const template = INSTITUTION_MENU_TEMPLATES[role] ?? SCHOOL_ADMIN_MENU;
  return mapPaths(template, slug);
}
