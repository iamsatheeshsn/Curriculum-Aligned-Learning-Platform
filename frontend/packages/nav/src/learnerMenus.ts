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

/** Student Portal — flat main menu */
export const STUDENT_MENU: NavDef[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '⌂', path: '/student', end: true },
  { id: 'my-courses', label: 'My Courses', icon: '📚', path: '/student/courses' },
  { id: 'subjects', label: 'Subjects', icon: '▦', path: '/student/subjects' },
  { id: 'lessons', label: 'Lessons', icon: '▤', path: '/student/lessons' },
  { id: 'stem-activities', label: 'STEM Activities', icon: '◈', path: '/student/stem' },
  { id: 'virtual-labs', label: 'Virtual Labs', icon: '◎', path: '/student/labs' },
  { id: 'homework', label: 'Homework', icon: '☑', path: '/student/homework' },
  { id: 'assignments', label: 'Assignments', icon: '✎', path: '/student/assignments' },
  { id: 'quizzes', label: 'Quizzes', icon: '▥', path: '/student/quizzes' },
  { id: 'exams', label: 'Exams', icon: '▤', path: '/student/exams' },
  { id: 'results', label: 'Results', icon: '📈', path: '/student/results' },
  { id: 'certificates', label: 'Certificates', icon: '🎓', path: '/student/certificates' },
  { id: 'tutor-sessions', label: 'Tutor Sessions', icon: '◎', path: '/student/tutoring' },
  { id: 'messages', label: 'Messages', icon: '💬', path: '/student/messages' },
  { id: 'notifications', label: 'Notifications', icon: '🔔', path: '/student/notifications' },
  { id: 'profile', label: 'Profile', icon: '☺', path: '/student/profile' },
];

/** Parent Portal — flat main menu (Fee Payments before School Notices) */
export const PARENT_MENU: NavDef[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '⌂', path: '/parent', end: true },
  { id: 'my-children', label: 'My Children', icon: '☺', path: '/parent/children' },
  { id: 'attendance', label: 'Attendance', icon: '☑', path: '/parent/attendance' },
  { id: 'homework', label: 'Homework', icon: '✎', path: '/parent/homework' },
  { id: 'assignments', label: 'Assignments', icon: '▤', path: '/parent/assignments' },
  { id: 'results', label: 'Results', icon: '📈', path: '/parent/results' },
  { id: 'progress-reports', label: 'Progress Reports', icon: '▥', path: '/parent/progress' },
  { id: 'tutor-sessions', label: 'Tutor Sessions', icon: '◎', path: '/parent/tutoring' },
  { id: 'fee-payments', label: 'Fee Payments', icon: '◈', path: '/parent/fees' },
  { id: 'school-notices', label: 'School Notices', icon: '🔔', path: '/parent/notices' },
  { id: 'notifications', label: 'Notifications', icon: '🔔', path: '/parent/notifications' },
  { id: 'profile', label: 'Profile', icon: '☺', path: '/parent/profile' },
];

export function learnerMenusForRole(role: string, slug: string): NavDef[] {
  const template = role === 'parent' ? PARENT_MENU : STUDENT_MENU;
  return mapPaths(template, slug);
}
