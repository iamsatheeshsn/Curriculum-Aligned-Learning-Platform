import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@stemora/auth';
import { Button, PaginationBar, Panel, StatStrip, useClientPagination } from '@stemora/ui';
import {
  EmptyState,
  ErrorBanner,
  Pill,
  ScoreBar,
  TEACHER_API,
  TeacherShell,
  initials,
} from './shared';

type ProgressRow = {
  student_user_id: number;
  student: string;
  email: string;
  lessons_started: number;
  lessons_completed: number;
  completion_percent: number | null;
  assessments_taken: number;
  assessment_average: number | null;
  submissions: number;
  late_submissions: number;
  attendance_rate: number | null;
};

type SectionOption = { id: number; label: string; students_count: number };

type ProgressStats = {
  students: number;
  average_score: number | null;
  average_completion: number | null;
  at_risk: number;
};

type ProgressResponse = {
  data: ProgressRow[];
  meta: {
    class_section_id: number;
    sections: SectionOption[];
    stats: ProgressStats;
  };
};

const emptyStats: ProgressStats = { students: 0, average_score: null, average_completion: null, at_risk: 0 };

const LOW_ATTENDANCE = 75;
const LOW_AVERAGE = 50;

function isAtRisk(row: ProgressRow) {
  return (
    (row.assessment_average !== null && row.assessment_average < LOW_AVERAGE) ||
    (row.attendance_rate !== null && row.attendance_rate < LOW_ATTENDANCE)
  );
}

/** Plain-language flags a teacher can act on, derived from the learner's own metrics. */
function watchFlags(row: ProgressRow) {
  const flags: string[] = [];
  if (row.attendance_rate !== null && row.attendance_rate < LOW_ATTENDANCE) {
    flags.push(`Attendance below ${LOW_ATTENDANCE}% (currently ${row.attendance_rate}%)`);
  }
  if (row.attendance_rate === null) {
    flags.push('No attendance recorded for this class yet');
  }
  if (row.assessment_average !== null && row.assessment_average < LOW_AVERAGE) {
    flags.push(`Assessment average below ${LOW_AVERAGE}% (currently ${row.assessment_average}%)`);
  }
  if (row.assessments_taken === 0) {
    flags.push('No assessments attempted yet');
  }
  if (row.late_submissions > 0) {
    flags.push(`${row.late_submissions} late submission${row.late_submissions === 1 ? '' : 's'}`);
  }
  if (row.lessons_started === 0) {
    flags.push('Has not opened any lessons');
  } else if (row.completion_percent !== null && row.completion_percent < LOW_AVERAGE) {
    flags.push(`Lesson completion at ${row.completion_percent}%`);
  }
  return flags;
}

function percentLabel(value: number | null) {
  return value === null ? '—' : `${value}%`;
}

export function TeacherProgressPage() {
  const { api } = useAuth();

  const [sectionId, setSectionId] = useState('');
  const [search, setSearch] = useState('');
  const [atRiskOnly, setAtRiskOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [stats, setStats] = useState<ProgressStats>(emptyStats);
  const [activeSectionId, setActiveSectionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = sectionId ? `?class_section_id=${encodeURIComponent(sectionId)}` : '';
      const res = await api.get<ProgressResponse>(`${TEACHER_API}/class-progress${query}`);
      setRows(res.data ?? []);
      setSections(res.meta?.sections ?? []);
      setStats(res.meta?.stats ?? emptyStats);
      setActiveSectionId(res.meta?.class_section_id ?? null);
      setSelectedId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load class progress.');
    } finally {
      setLoading(false);
    }
  }, [api, sectionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matching = rows.filter((row) => {
      if (atRiskOnly && !isAtRisk(row)) return false;
      if (!term) return true;
      return row.student.toLowerCase().includes(term) || row.email.toLowerCase().includes(term);
    });
    // Surface the learners who need attention first, then order by name.
    return matching.sort((a, b) => {
      const riskDelta = Number(isAtRisk(b)) - Number(isAtRisk(a));
      if (riskDelta !== 0) return riskDelta;
      return a.student.localeCompare(b.student);
    });
  }, [rows, search, atRiskOnly]);

  const listPage = useClientPagination(filtered);

  const selected = useMemo(
    () => rows.find((row) => row.student_user_id === selectedId) ?? null,
    [rows, selectedId]
  );

  const selectedSection = sectionId || (activeSectionId ? String(activeSectionId) : '');
  const sectionLabel = sections.find((section) => String(section.id) === selectedSection)?.label ?? null;
  const flags = selected ? watchFlags(selected) : [];

  return (
    <TeacherShell
      title="Student Progress"
      subtitle="Track achievement, engagement, and attendance per learner"
      headerActions={
        <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      }
    >
      <div className="tp-page">
        <section className="tp-hero stem-animate-rise">
          <div className="tp-hero-copy">
            <p className="tp-eyebrow">Teacher portal · Progress</p>
            <h2 className="tp-hero-title">Student progress</h2>
            <p className="tp-hero-lead">
              One row per learner, combining lesson completion, assessment results, submitted work, and attendance.
              Learners flagged as at risk are listed first — select anyone to see what to follow up on.
            </p>
          </div>
        </section>

        <ErrorBanner error={error} onDismiss={() => setError(null)} />

        <StatStrip
          items={[
            { label: 'Students', value: String(stats.students), hint: sectionLabel ?? 'Enrolled in this class' },
            {
              label: 'Average score',
              value: percentLabel(stats.average_score),
              hint: 'Across all graded assessments',
            },
            {
              label: 'Average completion',
              value: percentLabel(stats.average_completion),
              hint: 'Mean lesson progress',
            },
            {
              label: 'At risk',
              value: String(stats.at_risk),
              hint: `Below ${LOW_AVERAGE}% average or ${LOW_ATTENDANCE}% attendance`,
            },
          ]}
        />

        <div className="tk-toolbar">
          <label className="tk-field">
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
          <label className="tk-field tk-field-grow">
            <span>Search</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by student name or email"
              aria-label="Search learners"
            />
          </label>
          <label className="tk-check">
            <input
              type="checkbox"
              checked={atRiskOnly}
              onChange={(event) => setAtRiskOnly(event.target.checked)}
            />
            <span>Show only at-risk learners</span>
          </label>
        </div>

        <div className="tp-layout">
          <Panel
            title="Learners"
            description={
              loading
                ? 'Loading…'
                : `${filtered.length} learner${filtered.length === 1 ? '' : 's'} — select a row for the full profile.`
            }
          >
            {filtered.length === 0 && !loading ? (
              <EmptyState
                title={rows.length === 0 ? 'No learners in this class' : 'No learners match your filters'}
                message={
                  rows.length === 0
                    ? 'Once students are enrolled in this section their progress will appear here.'
                    : 'Try clearing the search box or turning off the at-risk filter.'
                }
              />
            ) : (
              <>
                <div className="tp-table-wrap">
                  <table className="tp-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Lesson completion</th>
                        <th>Assessment average</th>
                        <th>Attendance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listPage.pageItems.map((row) => (
                        <tr
                          key={row.student_user_id}
                          className={selectedId === row.student_user_id ? 'is-selected' : undefined}
                          onClick={() => setSelectedId(row.student_user_id)}
                        >
                          <td>
                            <div className="tk-person">
                              <span className="tk-avatar" aria-hidden="true">
                                {initials(row.student)}
                              </span>
                              <div>
                                <strong>{row.student}</strong>
                                <span>{row.email}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <ScoreBar value={row.completion_percent} />
                            <span className="tp-cell-sub">
                              {row.lessons_completed} of {row.lessons_started} lessons
                            </span>
                          </td>
                          <td>
                            <ScoreBar value={row.assessment_average} />
                            <span className="tp-cell-sub">
                              {row.assessments_taken} assessment{row.assessments_taken === 1 ? '' : 's'} taken
                            </span>
                          </td>
                          <td>
                            <ScoreBar value={row.attendance_rate} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <PaginationBar
                  page={listPage.page}
                  lastPage={listPage.lastPage}
                  total={listPage.total}
                  onPageChange={listPage.setPage}
                  disabled={loading}
                />
              </>
            )}
          </Panel>

          <aside>
            {selected ? (
              <Panel title="Learner detail" description={selected.student}>
                <div className="tk-stack">
                  <div className="tk-row">
                    <div className="tk-person">
                      <span className="tk-avatar" aria-hidden="true">
                        {initials(selected.student)}
                      </span>
                      <div>
                        <strong>{selected.student}</strong>
                        <span>{selected.email}</span>
                      </div>
                    </div>
                    <span className="tk-spacer" />
                    <Pill label={isAtRisk(selected) ? 'at risk' : 'on track'} tone={isAtRisk(selected) ? 'warn' : 'ok'} />
                  </div>

                  <dl className="tp-meta">
                    <div>
                      <dt>Lessons started</dt>
                      <dd>{selected.lessons_started}</dd>
                    </div>
                    <div>
                      <dt>Lessons completed</dt>
                      <dd>{selected.lessons_completed}</dd>
                    </div>
                    <div>
                      <dt>Completion</dt>
                      <dd>{percentLabel(selected.completion_percent)}</dd>
                    </div>
                    <div>
                      <dt>Assessments</dt>
                      <dd>{selected.assessments_taken}</dd>
                    </div>
                    <div>
                      <dt>Average score</dt>
                      <dd>{percentLabel(selected.assessment_average)}</dd>
                    </div>
                    <div>
                      <dt>Submissions</dt>
                      <dd>{selected.submissions}</dd>
                    </div>
                    <div>
                      <dt>Late work</dt>
                      <dd>{selected.late_submissions}</dd>
                    </div>
                    <div>
                      <dt>Attendance</dt>
                      <dd>{percentLabel(selected.attendance_rate)}</dd>
                    </div>
                  </dl>

                  <div className="tk-note-block">
                    <h4>Areas to watch</h4>
                    {flags.length === 0 ? (
                      <p className="tk-note">
                        On track — attendance, assessment results, and lesson completion are all healthy.
                      </p>
                    ) : (
                      <ul className="tk-flags">
                        {flags.map((flag) => (
                          <li key={flag}>{flag}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </Panel>
            ) : (
              <Panel title="Learner detail">
                <EmptyState
                  title="Nothing selected"
                  message="Choose a learner from the list to see their metrics and the areas worth following up on."
                />
              </Panel>
            )}
          </aside>
        </div>
      </div>
    </TeacherShell>
  );
}
