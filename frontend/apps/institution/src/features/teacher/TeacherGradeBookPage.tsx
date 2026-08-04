import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@stemora/auth';
import { Button, Panel, StatStrip, downloadExcelCsv } from '@stemora/ui';
import {
  EmptyState,
  ErrorBanner,
  Pill,
  ScoreBar,
  TEACHER_API,
  TeacherShell,
  formatDate,
  useTeacherContext,
} from './shared';

type ColumnType = 'homework' | 'assignment' | 'quiz' | 'exam';

type GradeColumn = {
  key: string;
  label: string;
  type: ColumnType;
  max_score: number;
  due_at: string | null;
};

type GradeRow = {
  student_user_id: number;
  student: string;
  email: string;
  cells: Record<string, number | null>;
  graded_count: number;
  average: number | null;
  letter: string | null;
};

type SectionOption = { id: number; label: string; students_count: number };

type GradeStats = {
  students: number;
  columns: number;
  class_average: number | null;
  at_risk: number;
};

type GradeBookResponse = {
  data: { columns: GradeColumn[]; rows: GradeRow[] };
  meta: {
    class_section_id: number;
    subject_id: number | null;
    sections: SectionOption[];
    stats: GradeStats;
  };
};

const TYPE_FILTERS: { value: 'all' | ColumnType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'homework', label: 'Homework' },
  { value: 'assignment', label: 'Assignments' },
  { value: 'quiz', label: 'Quizzes' },
  { value: 'exam', label: 'Exams' },
];

const emptyStats: GradeStats = { students: 0, columns: 0, class_average: null, at_risk: 0 };

type SortField = 'student' | 'average';
type SortDirection = 'asc' | 'desc';

function cellTone(value: number, max: number) {
  const share = max > 0 ? (value / max) * 100 : 0;
  if (share >= 80) return 'tk-cell-good';
  if (share >= 50) return 'tk-cell-mid';
  return 'tk-cell-low';
}

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function TeacherGradeBookPage() {
  const { api } = useAuth();
  const { context } = useTeacherContext();

  const [sectionId, setSectionId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ColumnType>('all');
  const [sortField, setSortField] = useState<SortField>('student');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const [columns, setColumns] = useState<GradeColumn[]>([]);
  const [rows, setRows] = useState<GradeRow[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [stats, setStats] = useState<GradeStats>(emptyStats);
  const [activeSectionId, setActiveSectionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (sectionId) params.set('class_section_id', sectionId);
      if (subjectId) params.set('subject_id', subjectId);
      const query = params.toString();
      const res = await api.get<GradeBookResponse>(`${TEACHER_API}/grade-book${query ? `?${query}` : ''}`);
      setColumns(res.data?.columns ?? []);
      setRows(res.data?.rows ?? []);
      setSections(res.meta?.sections ?? []);
      setStats(res.meta?.stats ?? emptyStats);
      setActiveSectionId(res.meta?.class_section_id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the grade book.');
    } finally {
      setLoading(false);
    }
  }, [api, sectionId, subjectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedSection = sectionId || (activeSectionId ? String(activeSectionId) : '');
  const sectionLabel = sections.find((section) => String(section.id) === selectedSection)?.label ?? null;

  const visibleColumns = useMemo(
    () => (typeFilter === 'all' ? columns : columns.filter((column) => column.type === typeFilter)),
    [columns, typeFilter]
  );

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: columns.length };
    columns.forEach((column) => {
      counts[column.type] = (counts[column.type] ?? 0) + 1;
    });
    return counts;
  }, [columns]);

  const sortedRows = useMemo(() => {
    const factor = sortDirection === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sortField === 'average') {
        // Learners with no marks always sit at the end, whichever direction is active.
        if (a.average === null && b.average === null) return a.student.localeCompare(b.student);
        if (a.average === null) return 1;
        if (b.average === null) return -1;
        if (a.average !== b.average) return (a.average - b.average) * factor;
        return a.student.localeCompare(b.student);
      }
      return a.student.localeCompare(b.student) * factor;
    });
  }, [rows, sortField, sortDirection]);

  function exportCsv() {
    const headers = [
      'Student',
      'Email',
      ...visibleColumns.map((column) => `${column.label} (out of ${formatScore(column.max_score)})`),
      'Average %',
      'Grade',
    ];
    const exportRows = sortedRows.map((row) => [
      row.student,
      row.email,
      ...visibleColumns.map((column) => {
        const value = row.cells?.[column.key];
        return value === null || value === undefined ? '' : formatScore(value);
      }),
      row.average === null ? '' : row.average,
      row.letter ?? '',
    ]);
    const scope = sectionLabel ? sectionLabel.replace(/[^a-z0-9]+/gi, '-').toLowerCase() : 'class';
    downloadExcelCsv(`grade-book-${scope}`, headers, exportRows);
  }

  const hasGrid = visibleColumns.length > 0 && sortedRows.length > 0;

  return (
    <TeacherShell
      title="Grade Book"
      subtitle="Every scored item for a class in one grid"
      headerActions={
        <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      }
    >
      <div className="tp-page">
        <section className="tp-hero stem-animate-rise">
          <div className="tp-hero-copy">
            <p className="tp-eyebrow">Teacher portal · Grades</p>
            <h2 className="tp-hero-title">Grade book</h2>
            <p className="tp-hero-lead">
              Scored homework, assignments, quizzes, and exams for the selected class, side by side. Filter by item
              type to focus on one kind of assessment, sort to find learners who need support, or export the grid.
            </p>
          </div>
          <div className="tp-hero-actions">
            <Button size="sm" type="button" variant="secondary" disabled={!hasGrid} onClick={exportCsv}>
              Download CSV
            </Button>
          </div>
        </section>

        <ErrorBanner error={error} onDismiss={() => setError(null)} />

        <StatStrip
          items={[
            { label: 'Students', value: String(stats.students), hint: sectionLabel ?? 'Enrolled in this class' },
            {
              label: 'Graded items',
              value: String(stats.columns),
              hint: `${visibleColumns.length} shown with the current filter`,
            },
            {
              label: 'Class average',
              value: stats.class_average === null ? '—' : `${stats.class_average}%`,
              hint: 'Mean of every scored item',
            },
            { label: 'At risk', value: String(stats.at_risk), hint: 'Averaging below 50%' },
          ]}
        />

        <div className="tk-toolbar">
          <label className="tk-field tk-field-grow">
            <span>Class</span>
            <select value={selectedSection} onChange={(event) => setSectionId(event.target.value)}>
              {sections.length === 0 ? <option value="">No classes available</option> : null}
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.label} · {section.students_count} student{section.students_count === 1 ? '' : 's'}
                </option>
              ))}
            </select>
          </label>
          <label className="tk-field">
            <span>Subject</span>
            <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
              <option value="">All subjects</option>
              {context?.subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name_en}
                </option>
              ))}
            </select>
          </label>
          <label className="tk-field">
            <span>Sort by</span>
            <select value={sortField} onChange={(event) => setSortField(event.target.value as SortField)}>
              <option value="student">Student name</option>
              <option value="average">Average</option>
            </select>
          </label>
          <div className="tk-toolbar-actions">
            <Button
              size="sm"
              type="button"
              variant="secondary"
              aria-label={sortDirection === 'asc' ? 'Sort descending' : 'Sort ascending'}
              onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
            >
              {sortDirection === 'asc' ? 'Ascending' : 'Descending'}
            </Button>
          </div>
        </div>

        <div className="tk-tabs" role="group" aria-label="Column type">
          {TYPE_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={typeFilter === filter.value ? 'is-active' : undefined}
              aria-pressed={typeFilter === filter.value}
              onClick={() => setTypeFilter(filter.value)}
            >
              {filter.label}
              <span className="tk-tab-count">{typeCounts[filter.value] ?? 0}</span>
            </button>
          ))}
        </div>

        <Panel
          title="Scores"
          description={
            loading
              ? 'Loading…'
              : `${sortedRows.length} learner${sortedRows.length === 1 ? '' : 's'} × ${
                  visibleColumns.length
                } item${visibleColumns.length === 1 ? '' : 's'}`
          }
        >
          {!hasGrid && !loading ? (
            <EmptyState
              title={sortedRows.length === 0 ? 'No learners in this class' : 'Nothing scored yet'}
              message={
                sortedRows.length === 0
                  ? 'Enrol students in this section to start recording their marks.'
                  : 'Scored homework, assignments, quizzes, and exams will appear here as columns once they exist for this class.'
              }
            />
          ) : (
            <>
              <div className="tk-matrix-wrap">
                <table className="tk-matrix">
                  <thead>
                    <tr>
                      <th className="tk-sticky-col" scope="col">
                        Student
                      </th>
                      {visibleColumns.map((column) => (
                        <th key={column.key} scope="col">
                          <div className="tk-col-head">
                            {column.label}
                            <span>
                              out of {formatScore(column.max_score)}
                              {column.due_at ? ` · ${formatDate(column.due_at)}` : ''}
                            </span>
                          </div>
                        </th>
                      ))}
                      <th scope="col">Average</th>
                      <th scope="col">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row) => (
                      <tr key={row.student_user_id}>
                        <td className="tk-sticky-col">
                          <strong>{row.student}</strong>
                        </td>
                        {visibleColumns.map((column) => {
                          const value = row.cells?.[column.key];
                          return (
                            <td className="tk-num" key={column.key}>
                              {value === null || value === undefined ? (
                                <span className="tk-dash">—</span>
                              ) : (
                                <span
                                  className={cellTone(value, column.max_score)}
                                  title={`${formatScore(value)} out of ${formatScore(column.max_score)}`}
                                >
                                  {formatScore(value)}
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td>
                          <ScoreBar value={row.average} />
                        </td>
                        <td>{row.letter ? <Pill label={row.letter} tone="info" /> : <span className="tk-dash">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="tk-legend" style={{ marginTop: '0.85rem' }}>
                <span>
                  <i style={{ background: '#1f6b4a' }} aria-hidden="true" />
                  80% of the maximum or above
                </span>
                <span>
                  <i style={{ background: '#1d4ed8' }} aria-hidden="true" />
                  50% to 79%
                </span>
                <span>
                  <i style={{ background: '#b42318' }} aria-hidden="true" />
                  Below 50%
                </span>
                <span>
                  <i style={{ background: 'rgba(15,23,42,0.2)' }} aria-hidden="true" />
                  Not yet graded
                </span>
              </div>
            </>
          )}
        </Panel>
      </div>
    </TeacherShell>
  );
}
