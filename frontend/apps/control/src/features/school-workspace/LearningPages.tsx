import { ResourcePage } from './ResourcePage';
import { StatusPill } from './shared';

const activeArchived = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

export function LearningCoursesPage() {
  return (
    <ResourcePage
      id="courses"
      title="Courses"
      subtitle="Organise school courses linked to your curriculum subjects"
      heroLead="Define course catalogues your teachers deliver — then attach lessons and resources."
      eyebrow="Control · Learning management"
      navPermission="nav.control.learning-management"
      endpoint="courses"
      prefix="crs-"
      createLabel="+ New course"
      allowDelete
      links={[
        { to: '/learning/lessons', label: 'Lessons' },
        { to: '/learning/resources', label: 'Resources' },
        { to: '/curriculum/subjects', label: 'Subjects' },
      ]}
      stats={[
        { key: 'total', label: 'Courses' },
        { key: 'active', label: 'Active' },
      ]}
      statusFilterOptions={activeArchived}
      columns={[
        { key: 'code', label: 'Code' },
        { key: 'title_en', label: 'Course' },
        { key: 'subject.name_en', label: 'Subject' },
        {
          key: 'status',
          label: 'Status',
          render: (row) => <StatusPill prefix="crs-" status={String(row.status ?? '')} />,
        },
      ]}
      fields={[
        { key: 'code', label: 'Code', required: true, placeholder: 'SCI-G7' },
        { key: 'title_en', label: 'English title', required: true },
        { key: 'title_ar', label: 'Arabic title', required: true },
        { key: 'subject_id', label: 'Subject ID', type: 'number', placeholder: 'Optional subject id' },
        { key: 'description', label: 'Description', type: 'textarea' },
        { key: 'status', label: 'Status', type: 'select', options: activeArchived },
      ]}
      labelKey="title_en"
    />
  );
}

export function LearningLessonsPage() {
  return (
    <ResourcePage
      id="lessons"
      title="Lessons"
      subtitle="Sequence lessons within each school course"
      heroLead="Build the teaching sequence for every course — title, order, and duration."
      eyebrow="Control · Learning management"
      navPermission="nav.control.learning-management"
      endpoint="lessons"
      prefix="lsn-"
      createLabel="+ New lesson"
      allowDelete
      links={[
        { to: '/learning/courses', label: 'Courses' },
        { to: '/learning/assignments', label: 'Assignments' },
      ]}
      stats={[
        { key: 'total', label: 'Lessons' },
        { key: 'active', label: 'Active' },
      ]}
      statusFilterOptions={activeArchived}
      columns={[
        { key: 'title_en', label: 'Lesson' },
        { key: 'course.title_en', label: 'Course' },
        { key: 'sort_order', label: 'Order' },
        {
          key: 'status',
          label: 'Status',
          render: (row) => <StatusPill prefix="lsn-" status={String(row.status ?? '')} />,
        },
      ]}
      fields={[
        { key: 'course_id', label: 'Course ID', type: 'number', required: true },
        { key: 'title_en', label: 'English title', required: true },
        { key: 'title_ar', label: 'Arabic title', required: true },
        { key: 'sort_order', label: 'Sort order', type: 'number' },
        { key: 'duration_minutes', label: 'Duration (minutes)', type: 'number' },
        { key: 'status', label: 'Status', type: 'select', options: activeArchived },
      ]}
      labelKey="title_en"
    />
  );
}

export function LearningResourcesPage() {
  return (
    <ResourcePage
      id="resources"
      title="Resources"
      subtitle="Share files, links, and videos with classes"
      heroLead="Maintain a school resource library teachers can attach to lessons and homework."
      eyebrow="Control · Learning management"
      navPermission="nav.control.learning-management"
      endpoint="resources"
      prefix="res-"
      createLabel="+ New resource"
      allowDelete
      links={[
        { to: '/learning/courses', label: 'Courses' },
        { to: '/learning/lessons', label: 'Lessons' },
      ]}
      stats={[
        { key: 'total', label: 'Resources' },
        { key: 'active', label: 'Active' },
      ]}
      statusFilterOptions={activeArchived}
      columns={[
        { key: 'title_en', label: 'Resource' },
        { key: 'resource_type', label: 'Type' },
        { key: 'url', label: 'URL' },
        {
          key: 'status',
          label: 'Status',
          render: (row) => <StatusPill prefix="res-" status={String(row.status ?? '')} />,
        },
      ]}
      fields={[
        { key: 'title_en', label: 'English title', required: true },
        { key: 'title_ar', label: 'Arabic title', required: true },
        {
          key: 'resource_type',
          label: 'Type',
          type: 'select',
          required: true,
          options: [
            { value: 'file', label: 'File' },
            { value: 'link', label: 'Link' },
            { value: 'video', label: 'Video' },
          ],
        },
        { key: 'url', label: 'URL', placeholder: 'https://…' },
        { key: 'subject_id', label: 'Subject ID', type: 'number' },
        { key: 'status', label: 'Status', type: 'select', options: activeArchived },
      ]}
      labelKey="title_en"
    />
  );
}

export function LearningAssignmentsPage() {
  return (
    <ResourcePage
      id="assignments"
      title="Assignments"
      subtitle="Scored class assignments for progress tracking"
      heroLead="Create scored assignments with due dates — results feed academic reports."
      eyebrow="Control · Learning management"
      navPermission="nav.control.learning-management"
      endpoint="assignments"
      prefix="asg-"
      createLabel="+ New assignment"
      allowDelete
      links={[
        { to: '/learning/homework', label: 'Homework' },
        { to: '/assessments/results', label: 'Results' },
      ]}
      stats={[
        { key: 'total', label: 'Assignments' },
        { key: 'open', label: 'Open' },
      ]}
      statusFilterOptions={[
        { value: 'draft', label: 'Draft' },
        { value: 'published', label: 'Published' },
        { value: 'closed', label: 'Closed' },
      ]}
      columns={[
        { key: 'title_en', label: 'Assignment' },
        { key: 'due_at', label: 'Due' },
        { key: 'max_score', label: 'Max score' },
        {
          key: 'status',
          label: 'Status',
          render: (row) => <StatusPill prefix="asg-" status={String(row.status ?? '')} />,
        },
      ]}
      fields={[
        { key: 'title_en', label: 'English title', required: true },
        { key: 'title_ar', label: 'Arabic title', required: true },
        { key: 'subject_id', label: 'Subject ID', type: 'number' },
        { key: 'class_section_id', label: 'Section ID', type: 'number' },
        { key: 'due_at', label: 'Due date', type: 'date' },
        { key: 'max_score', label: 'Max score', type: 'number' },
        {
          key: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { value: 'draft', label: 'Draft' },
            { value: 'published', label: 'Published' },
            { value: 'closed', label: 'Closed' },
          ],
        },
      ]}
      labelKey="title_en"
    />
  );
}

export function LearningHomeworkPage() {
  return (
    <ResourcePage
      id="homework"
      title="Homework"
      subtitle="Daily and weekly homework set for class sections"
      heroLead="Publish homework with clear instructions and optional late submission rules."
      eyebrow="Control · Learning management"
      navPermission="nav.control.learning-management"
      endpoint="homework"
      prefix="hw-"
      createLabel="+ New homework"
      allowDelete
      links={[
        { to: '/learning/assignments', label: 'Assignments' },
        { to: '/learning/lessons', label: 'Lessons' },
      ]}
      stats={[
        { key: 'total', label: 'Homework' },
        { key: 'open', label: 'Open' },
      ]}
      statusFilterOptions={[
        { value: 'draft', label: 'Draft' },
        { value: 'published', label: 'Published' },
        { value: 'closed', label: 'Closed' },
      ]}
      columns={[
        { key: 'title_en', label: 'Homework' },
        { key: 'due_at', label: 'Due' },
        {
          key: 'status',
          label: 'Status',
          render: (row) => <StatusPill prefix="hw-" status={String(row.status ?? '')} />,
        },
      ]}
      fields={[
        { key: 'title_en', label: 'English title', required: true },
        { key: 'title_ar', label: 'Arabic title', required: true },
        { key: 'instructions_en', label: 'Instructions (EN)', type: 'textarea' },
        { key: 'subject_id', label: 'Subject ID', type: 'number' },
        { key: 'class_section_id', label: 'Section ID', type: 'number' },
        { key: 'due_at', label: 'Due date', type: 'date' },
        {
          key: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { value: 'draft', label: 'Draft' },
            { value: 'published', label: 'Published' },
            { value: 'closed', label: 'Closed' },
          ],
        },
      ]}
      labelKey="title_en"
    />
  );
}
