import type { NavDef } from './types';

/** Super Admin (SaaS Owner) — Control portal */
export const SUPER_ADMIN_MENU: NavDef[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: '⌂',
    path: '/',
    end: true,
    children: [
      { id: 'platform-dashboard', label: 'Platform Dashboard', path: '/' },
      { id: 'saas-analytics', label: 'SaaS Analytics', path: '/dashboard/saas-analytics' },
      { id: 'revenue-dashboard', label: 'Revenue Dashboard', path: '/dashboard/revenue' },
      { id: 'system-health', label: 'System Health', path: '/dashboard/system-health' },
    ],
  },
  {
    id: 'tenant-management',
    label: 'Tenant Management',
    icon: '▦',
    children: [
      { id: 'schools', label: 'Schools', path: '/tenants' },
      { id: 'school-groups', label: 'School Groups', path: '/tenants/groups' },
      { id: 'campuses', label: 'Campuses', path: '/tenants/campuses' },
      { id: 'subscription-plans', label: 'Subscription Plans', path: '/subscription' },
      { id: 'active-subscriptions', label: 'Active Subscriptions', path: '/tenants/subscriptions' },
      { id: 'trial-accounts', label: 'Trial Accounts', path: '/tenants/trials' },
    ],
  },
  {
    id: 'curriculum-management',
    label: 'Curriculum Management',
    icon: '▤',
    children: [
      { id: 'countries', label: 'Countries', path: '/curriculum/countries' },
      { id: 'curriculums', label: 'Curriculums', path: '/curriculum/curriculums' },
      { id: 'grades', label: 'Grades', path: '/curriculum/grades' },
      { id: 'subjects', label: 'Subjects', path: '/curriculum/subjects' },
      { id: 'chapters', label: 'Chapters', path: '/curriculum/chapters' },
      { id: 'lessons', label: 'Lessons', path: '/curriculum/lessons' },
      { id: 'learning-outcomes', label: 'Learning Outcomes', path: '/curriculum/learning-outcomes' },
    ],
  },
  {
    id: 'user-management',
    label: 'User Management',
    icon: '☺',
    children: [
      { id: 'platform-users', label: 'Platform Users', path: '/users/platform' },
      { id: 'rbac', label: 'RBAC', path: '/rbac' },
    ],
  },
  {
    id: 'billing',
    label: 'Billing',
    icon: '◈',
    children: [
      { id: 'billing-plans', label: 'Subscription Plans', path: '/billing/plans' },
      { id: 'invoices', label: 'Invoices', path: '/billing/invoices' },
      { id: 'payments', label: 'Payments', path: '/billing/payments' },
      { id: 'coupons', label: 'Coupons', path: '/billing/coupons' },
      { id: 'taxes', label: 'Taxes', path: '/billing/taxes' },
    ],
  },
  {
    id: 'integrations',
    label: 'Integrations',
    icon: '⬡',
    children: [
      { id: 'payment-gateways', label: 'Payment Gateways', path: '/integrations/payment-gateways' },
      { id: 'email-providers', label: 'Email Providers', path: '/integrations/email' },
      { id: 'sms-providers', label: 'SMS Providers', path: '/integrations/sms' },
      { id: 'video-conference', label: 'Video Conference', path: '/integrations/video' },
      { id: 'ai-providers', label: 'AI Providers', path: '/integrations/ai' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: '▥',
    children: [
      { id: 'revenue-reports', label: 'Revenue Reports', path: '/reports/revenue' },
      { id: 'school-reports', label: 'School Reports', path: '/reports/schools' },
      { id: 'student-analytics', label: 'Student Analytics', path: '/reports/students' },
      { id: 'usage-reports', label: 'Usage Reports', path: '/reports/usage' },
    ],
  },
  {
    id: 'audit',
    label: 'Audit',
    icon: '◎',
    children: [
      { id: 'activity-logs', label: 'Activity Logs', path: '/audit/activity' },
      { id: 'login-history', label: 'Login History', path: '/audit/logins' },
      { id: 'audit-logs', label: 'Audit Logs', path: '/audit/logs' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: '⚙',
    children: [
      { id: 'global-settings', label: 'Global Settings', path: '/settings/global' },
      { id: 'branding', label: 'Branding', path: '/settings/branding' },
      { id: 'localization', label: 'Localization', path: '/settings/localization' },
      { id: 'security', label: 'Security', path: '/settings/security' },
      { id: 'backup', label: 'Backup', path: '/settings/backup' },
    ],
  },
];

/** School Owner — Control portal (tenant / school organisation) */
export const SCHOOL_OWNER_MENU: NavDef[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '⌂', path: '/', end: true },
  {
    id: 'school-management',
    label: 'School Management',
    icon: '▦',
    children: [
      { id: 'school-profile', label: 'School Profile', path: '/school/profile' },
      { id: 'campuses', label: 'Campuses', path: '/school/campuses' },
      { id: 'academic-years', label: 'Academic Years', path: '/school/academic-years' },
      { id: 'terms', label: 'Terms', path: '/school/terms' },
    ],
  },
  {
    id: 'curriculum',
    label: 'Curriculum',
    icon: '▤',
    children: [
      { id: 'subjects', label: 'Subjects', path: '/curriculum/subjects' },
      { id: 'grades', label: 'Grades', path: '/curriculum/grades' },
      { id: 'classes', label: 'Classes', path: '/curriculum/classes' },
      { id: 'sections', label: 'Sections', path: '/curriculum/sections' },
    ],
  },
  {
    id: 'student-management',
    label: 'Student Management',
    icon: '🎓',
    children: [
      { id: 'students', label: 'Students', path: '/students', end: true },
      { id: 'admissions', label: 'Admissions', path: '/students/admissions' },
      { id: 'transfers', label: 'Transfers', path: '/students/transfers' },
      { id: 'alumni', label: 'Alumni', path: '/students/alumni' },
    ],
  },
  {
    id: 'parent-management',
    label: 'Parent Management',
    icon: '☺',
    children: [
      { id: 'parents', label: 'Parents', path: '/parents', end: true },
      { id: 'guardians', label: 'Guardians', path: '/parents/guardians' },
    ],
  },
  {
    id: 'teacher-management',
    label: 'Teacher Management',
    icon: '✎',
    children: [
      { id: 'teachers', label: 'Teachers', path: '/teachers', end: true },
      { id: 'tutors', label: 'Tutors', path: '/teachers/tutors' },
      { id: 'teaching-assignments', label: 'Teaching Assignments', path: '/teachers/assignments' },
    ],
  },
  {
    id: 'staff-management',
    label: 'Staff Management',
    icon: '▦',
    children: [
      { id: 'employees', label: 'Employees', path: '/staff', end: true },
      { id: 'staff-attendance', label: 'Attendance', path: '/staff/attendance' },
    ],
  },
  {
    id: 'learning-management',
    label: 'Learning Management',
    icon: '📚',
    children: [
      { id: 'courses', label: 'Courses', path: '/learning/courses' },
      { id: 'lessons', label: 'Lessons', path: '/learning/lessons' },
      { id: 'resources', label: 'Resources', path: '/learning/resources' },
      { id: 'assignments', label: 'Assignments', path: '/learning/assignments' },
      { id: 'homework', label: 'Homework', path: '/learning/homework' },
    ],
  },
  {
    id: 'assessments',
    label: 'Assessments',
    icon: '☑',
    children: [
      { id: 'question-bank', label: 'Question Bank', path: '/assessments/question-bank' },
      { id: 'quizzes', label: 'Quizzes', path: '/assessments/quizzes' },
      { id: 'exams', label: 'Exams', path: '/assessments/exams' },
      { id: 'results', label: 'Results', path: '/assessments/results' },
    ],
  },
  {
    id: 'tutoring',
    label: 'Tutoring',
    icon: '◎',
    children: [
      { id: 'tutor-management', label: 'Tutor Management', path: '/tutoring/tutors' },
      { id: 'session-booking', label: 'Session Booking', path: '/tutoring/booking' },
      { id: 'timetable', label: 'Timetable', path: '/tutoring/timetable' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: '◈',
    children: [
      { id: 'student-fees', label: 'Student Fees', path: '/finance/fees' },
      { id: 'tutor-payments', label: 'Tutor Payments', path: '/finance/tutor-payments' },
      { id: 'expenses', label: 'Expenses', path: '/finance/expenses' },
      { id: 'finance-reports', label: 'Reports', path: '/finance/reports' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: '▥',
    children: [
      { id: 'academic-reports', label: 'Academic Reports', path: '/reports/academic' },
      { id: 'attendance-reports', label: 'Attendance Reports', path: '/reports/attendance' },
      { id: 'revenue-reports', label: 'Revenue Reports', path: '/reports/revenue' },
      { id: 'performance-reports', label: 'Performance Reports', path: '/reports/performance' },
    ],
  },
  { id: 'notifications', label: 'Notifications', icon: '🔔', path: '/notifications' },
  { id: 'audit-logs', label: 'Audit Logs', icon: '◎', path: '/audit/logs' },
  {
    id: 'settings',
    label: 'Settings',
    icon: '⚙',
    children: [
      { id: 'tenant-settings', label: 'Organisation', path: '/settings', end: true },
      { id: 'branding', label: 'Branding', path: '/settings/branding' },
      { id: 'subscription', label: 'Subscription', path: '/settings/subscription' },
    ],
  },
];

export const CUSTOMER_SUPPORT_MENU: NavDef[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '⌂', path: '/', end: true },
  { id: 'schools', label: 'Schools', icon: '▦', path: '/tenants' },
  { id: 'support-tickets', label: 'Support Tickets', icon: '✎', path: '/support/tickets' },
  { id: 'live-chat', label: 'Live Chat', icon: '💬', path: '/support/chat' },
  { id: 'knowledge-base', label: 'Knowledge Base', icon: '📚', path: '/support/knowledge-base' },
  { id: 'notifications', label: 'Notifications', icon: '🔔', path: '/notifications' },
];

export const AUDITOR_MENU: NavDef[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '⌂', path: '/', end: true },
  { id: 'activity-logs', label: 'Activity Logs', icon: '◎', path: '/audit/activity' },
  { id: 'login-logs', label: 'Login Logs', icon: '◎', path: '/audit/logins' },
  { id: 'fee-audit', label: 'Fee Audit', icon: '◈', path: '/audit/fees' },
  { id: 'academic-audit', label: 'Academic Audit', icon: '▤', path: '/audit/academic' },
  { id: 'security-reports', label: 'Security Reports', icon: '▥', path: '/audit/security' },
];

export const CONTROL_MENUS: Record<string, NavDef[]> = {
  super_admin: SUPER_ADMIN_MENU,
  school_owner: SCHOOL_OWNER_MENU,
  customer_support: CUSTOMER_SUPPORT_MENU,
  auditor: AUDITOR_MENU,
};
