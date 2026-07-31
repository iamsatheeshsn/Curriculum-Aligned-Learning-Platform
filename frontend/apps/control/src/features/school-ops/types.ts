export type SchoolSubjectRow = {
  id: number;
  code: string;
  name_en: string;
  name_ar: string;
  is_stem: boolean;
  tutoring_enabled: boolean;
  status: string;
};

export type SchoolSubjectStats = {
  total: number;
  active: number;
  stem: number;
};

export type SubjectOption = {
  id: number;
  code: string;
  name_en: string;
  status?: string;
};

export type SchoolGradeRow = {
  id: number;
  code: string;
  name_en: string;
  name_ar: string;
  sequence: number;
};

export type SchoolGradeStats = {
  total: number;
};

export type GradeOption = {
  id: number;
  code: string;
  name_en: string;
  sequence: number;
};

export type SchoolClassRow = {
  id: number;
  code: string;
  name_en: string;
  name_ar: string;
  status: string;
  grade_id: number;
  campus_id: number | null;
  academic_year_id: number;
  grade: { id: number; code: string; name_en: string } | null;
};

export type SchoolClassStats = {
  total: number;
  active: number;
};

export type ClassOption = {
  id: number;
  code: string;
  name_en: string;
  grade_id: number;
  academic_year_id: number;
};

export type SchoolSectionRow = {
  id: number;
  name: string;
  section_code: string | null;
  status: string;
  grade_id: number;
  campus_id: number | null;
  academic_year_id: number;
  school_class_id: number | null;
};

export type SchoolSectionStats = {
  total: number;
  active: number;
};

export type SectionOption = {
  id: number;
  name: string;
  section_code?: string | null;
  grade_id?: number;
  academic_year_id?: number;
  school_class_id?: number | null;
  status?: string;
};

export type AcademicYearOption = {
  id: number;
  name: string;
  is_current: boolean;
  status: string;
};

export type CampusOption = {
  id: number;
  code: string;
  name_en: string;
  status: string;
};

export type StudentRow = {
  user_id: number;
  enrollment_id: number | null;
  status: string;
  enrolled_on?: string | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  user_status?: string;
  source?: string;
  grade?: { id: number; code: string; name_en: string } | null;
  class_section?: { id: number; name: string } | null;
  academic_year?: { id: number; name: string } | null;
};

export type StudentStats = {
  total_enrollments: number;
  active: number;
  pending: number;
  alumni: number;
  transfer: number;
  role_students: number;
};

export type ParentRow = {
  user_id: number;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  status?: string;
  phone?: string | null;
  links?: {
    id: number;
    student_user_id: number;
    relationship: string;
    is_primary: boolean;
    student?: {
      id: number;
      email?: string | null;
      first_name?: string | null;
      last_name?: string | null;
    } | null;
  }[];
};

export type ParentStats = {
  parents: number;
  links: number;
};

export type StaffRow = {
  user_id: number;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  status?: string;
};

export type TeacherStats = {
  total: number;
};

export type TutorRow = {
  id: number;
  user_id: number;
  status: string;
  bio_en?: string | null;
  bio_ar?: string | null;
  ratings_avg_rating?: number | null;
  user?: {
    id: number;
    email?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
  subjects?: { id: number; code: string; name_en: string }[];
};

export type TutorStats = {
  total: number;
  active: number;
};

export type TeachingAssignmentRow = {
  id: number;
  teacher_user_id: number;
  subject_id: number;
  class_section_id: number;
  academic_year_id: number;
  status: string;
  notes?: string | null;
  teacher?: {
    id: number;
    email?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
  subject?: { id: number; code: string; name_en: string } | null;
  class_section?: { id: number; name: string } | null;
};

export type TeachingAssignmentStats = {
  total: number;
  active: number;
};

export const SCHOOL_OPS_API = '/control/school-ops';

export const CURRICULUM_LINKS = [
  { label: 'Subjects', path: '/curriculum/subjects' },
  { label: 'Grades', path: '/curriculum/grades' },
  { label: 'Classes', path: '/curriculum/classes' },
  { label: 'Sections', path: '/curriculum/sections' },
  { label: 'School profile', path: '/school/profile' },
] as const;
