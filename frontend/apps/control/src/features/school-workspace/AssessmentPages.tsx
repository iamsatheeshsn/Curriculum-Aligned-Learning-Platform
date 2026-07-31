import { ResourcePage } from './ResourcePage';
import { StatusPill } from './shared';

export function QuestionBankPage() {
  return (
    <ResourcePage
      id="question-bank"
      title="Question bank"
      subtitle="Reusable questions for quizzes and exams"
      heroLead="Build a bilingual question bank teachers can pull into quizzes and exams."
      eyebrow="Control · Assessments"
      navPermission="nav.control.assessments"
      endpoint="questions"
      prefix="qb-"
      createLabel="+ New question"
      allowDelete
      links={[
        { to: '/assessments/quizzes', label: 'Quizzes' },
        { to: '/assessments/exams', label: 'Exams' },
      ]}
      stats={[
        { key: 'total', label: 'Questions' },
        { key: 'active', label: 'Active' },
      ]}
      statusFilterOptions={[
        { value: 'active', label: 'Active' },
        { value: 'archived', label: 'Archived' },
      ]}
      columns={[
        { key: 'stem_en', label: 'Question' },
        { key: 'type', label: 'Type' },
        { key: 'difficulty', label: 'Difficulty' },
        {
          key: 'status',
          label: 'Status',
          render: (row) => <StatusPill prefix="qb-" status={String(row.status ?? '')} />,
        },
      ]}
      fields={[
        { key: 'stem_en', label: 'Question (EN)', type: 'textarea', required: true },
        { key: 'stem_ar', label: 'Question (AR)', type: 'textarea' },
        {
          key: 'type',
          label: 'Type',
          type: 'select',
          required: true,
          options: [
            { value: 'mcq', label: 'Multiple choice' },
            { value: 'true_false', label: 'True / false' },
            { value: 'short_answer', label: 'Short answer' },
          ],
        },
        {
          key: 'difficulty',
          label: 'Difficulty',
          type: 'select',
          options: [
            { value: 'easy', label: 'Easy' },
            { value: 'medium', label: 'Medium' },
            { value: 'hard', label: 'Hard' },
          ],
        },
        { key: 'subject_id', label: 'Subject ID', type: 'number' },
        {
          key: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { value: 'active', label: 'Active' },
            { value: 'archived', label: 'Archived' },
          ],
        },
      ]}
      labelKey="stem_en"
    />
  );
}

export function QuizzesPage() {
  return (
    <ResourcePage
      id="quizzes"
      title="Quizzes"
      subtitle="Short formative assessments"
      heroLead="Publish timed quizzes for class sections and review results from the Results page."
      eyebrow="Control · Assessments"
      navPermission="nav.control.assessments"
      endpoint="quizzes"
      prefix="qz-"
      createLabel="+ New quiz"
      allowDelete
      links={[
        { to: '/assessments/question-bank', label: 'Question bank' },
        { to: '/assessments/results', label: 'Results' },
      ]}
      stats={[
        { key: 'total', label: 'Quizzes' },
        { key: 'published', label: 'Published' },
      ]}
      statusFilterOptions={[
        { value: 'draft', label: 'Draft' },
        { value: 'published', label: 'Published' },
        { value: 'closed', label: 'Closed' },
      ]}
      columns={[
        { key: 'title_en', label: 'Quiz' },
        { key: 'available_from', label: 'Opens' },
        { key: 'available_until', label: 'Closes' },
        {
          key: 'status',
          label: 'Status',
          render: (row) => <StatusPill prefix="qz-" status={String(row.status ?? '')} />,
        },
      ]}
      fields={[
        { key: 'title_en', label: 'English title', required: true },
        { key: 'title_ar', label: 'Arabic title', required: true },
        { key: 'subject_id', label: 'Subject ID', type: 'number' },
        { key: 'time_limit_seconds', label: 'Time limit (seconds)', type: 'number' },
        { key: 'max_attempts', label: 'Max attempts', type: 'number' },
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

export function ExamsPage() {
  return (
    <ResourcePage
      id="exams"
      title="Exams"
      subtitle="Summative exams that count toward grades"
      heroLead="Schedule term exams with availability windows and grading rules."
      eyebrow="Control · Assessments"
      navPermission="nav.control.assessments"
      endpoint="exams"
      prefix="ex-"
      createLabel="+ New exam"
      allowDelete
      links={[
        { to: '/assessments/quizzes', label: 'Quizzes' },
        { to: '/assessments/results', label: 'Results' },
      ]}
      stats={[
        { key: 'total', label: 'Exams' },
        { key: 'published', label: 'Published' },
      ]}
      statusFilterOptions={[
        { value: 'draft', label: 'Draft' },
        { value: 'published', label: 'Published' },
        { value: 'closed', label: 'Closed' },
      ]}
      columns={[
        { key: 'title_en', label: 'Exam' },
        { key: 'available_from', label: 'Opens' },
        { key: 'available_until', label: 'Closes' },
        {
          key: 'status',
          label: 'Status',
          render: (row) => <StatusPill prefix="ex-" status={String(row.status ?? '')} />,
        },
      ]}
      fields={[
        { key: 'title_en', label: 'English title', required: true },
        { key: 'title_ar', label: 'Arabic title', required: true },
        { key: 'subject_id', label: 'Subject ID', type: 'number' },
        { key: 'term_id', label: 'Term ID', type: 'number' },
        { key: 'time_limit_seconds', label: 'Time limit (seconds)', type: 'number' },
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

export function AssessmentResultsPage() {
  return (
    <ResourcePage
      id="results"
      title="Results"
      subtitle="Attempt scores across quizzes and exams"
      heroLead="Review student attempts, scores, and submission times. Export for academic reporting."
      eyebrow="Control · Assessments"
      navPermission="nav.control.assessments"
      endpoint="results"
      prefix="ar-"
      allowCreate={false}
      allowEdit={false}
      allowExport
      links={[
        { to: '/assessments/quizzes', label: 'Quizzes' },
        { to: '/assessments/exams', label: 'Exams' },
        { to: '/reports/academic', label: 'Academic reports' },
      ]}
      stats={[
        { key: 'attempts', label: 'Attempts' },
        { key: 'avg_score', label: 'Avg score' },
        { key: 'passed', label: 'Passed' },
      ]}
      columns={[
        { key: 'student_name', label: 'Student' },
        { key: 'assessment_title', label: 'Assessment' },
        { key: 'score', label: 'Score' },
        {
          key: 'status',
          label: 'Status',
          render: (row) => <StatusPill prefix="ar-" status={String(row.status ?? '')} />,
        },
      ]}
      fields={[]}
      labelKey="student_name"
      emptyLabel="No attempts recorded yet."
    />
  );
}
