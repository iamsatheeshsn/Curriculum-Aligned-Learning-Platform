export type ReportMeta = {
  school: { id: number; name_en: string; code: string };
  students: { id: number; name: string; email: string }[];
  subjects: { id: number; code: string; name: string; status: string }[];
  curricula: { id: number; code: string; name: string; version: string | number; status: string }[];
  tutors: { id: number; name: string; email?: string | null; status: string }[];
};

export const REPORT_MENU = [
  {
    slug: 'student',
    label: 'Student report',
    description: 'Learning progress, assessments, and tutoring attendance for one learner.',
  },
  {
    slug: 'teacher',
    label: 'Teacher report',
    description: 'Class assessment averages and homework submission health.',
  },
  {
    slug: 'tutor-performance',
    label: 'Tutor performance',
    description: 'Session volume, hours completed, attendance, and ratings.',
  },
  {
    slug: 'school',
    label: 'School analytics',
    description: 'Enrollment, curriculum coverage, and tutoring operations snapshot.',
  },
  {
    slug: 'curriculum-completion',
    label: 'Curriculum completion',
    description: 'Published lessons vs learner completion by curriculum.',
  },
  {
    slug: 'learning-outcomes',
    label: 'Learning outcomes',
    description: 'Outcome mastery from linked assessment responses.',
  },
] as const;

export type ReportSlug = (typeof REPORT_MENU)[number]['slug'];

export function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export {
  downloadExcelCsv,
  exportPdfDocument,
  kpiHtml,
  tableHtml,
} from '@stemora/ui';
