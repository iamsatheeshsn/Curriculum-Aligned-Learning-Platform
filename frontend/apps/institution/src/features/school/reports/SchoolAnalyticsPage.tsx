import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@stemora/auth';
import { Panel, StatStrip } from '@stemora/ui';
import { ReportPageShell } from './ReportShell';
import { downloadExcelCsv, exportPdfDocument, kpiHtml, tableHtml } from './reportUtils';

type SchoolAnalytics = {
  enrollment_students: number;
  subjects_active: number;
  lessons_completed: number;
  avg_lesson_progress: number;
  assessments_graded: number;
  tutoring_sessions_completed: number;
  tutoring_hours: number;
  curricula_published: number;
};

const LABELS: { key: keyof SchoolAnalytics; label: string }[] = [
  { key: 'enrollment_students', label: 'Students enrolled' },
  { key: 'subjects_active', label: 'Active subjects' },
  { key: 'lessons_completed', label: 'Lessons completed' },
  { key: 'avg_lesson_progress', label: 'Avg lesson progress %' },
  { key: 'assessments_graded', label: 'Assessments graded' },
  { key: 'tutoring_sessions_completed', label: 'Tutoring sessions completed' },
  { key: 'tutoring_hours', label: 'Tutoring hours' },
  { key: 'curricula_published', label: 'Curricula published' },
];

export function SchoolAnalyticsPage() {
  const { api } = useAuth();
  const [data, setData] = useState<SchoolAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: SchoolAnalytics }>('/org/reports/school');
      setData(res.data);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : 'Could not load school analytics.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  function exportExcel() {
    if (!data) throw new Error('Load school analytics first.');
    downloadExcelCsv(
      'school-analytics',
      ['Metric', 'Value'],
      LABELS.map(({ key, label }) => [label, data[key]]),
    );
  }

  function exportPdf() {
    if (!data) throw new Error('Load school analytics first.');
    exportPdfDocument({
      title: 'School analytics',
      subtitle: 'Institution operations snapshot',
      bodyHtml:
        kpiHtml(LABELS.slice(0, 4).map(({ key, label }) => ({ label, value: data[key] }))) +
        tableHtml(
          ['Metric', 'Value'],
          LABELS.map(({ key, label }) => [label, data[key]]),
        ),
    });
  }

  return (
    <ReportPageShell
      title="School analytics"
      subtitle="Enrollment, learning, assessment, and tutoring overview"
      onExportExcel={data ? exportExcel : undefined}
      onExportPdf={data ? exportPdf : undefined}
    >
      {error ? <div className="rpt-alert">{error}</div> : null}
      {loading && !data ? <p className="rpt-muted">Loading school analytics…</p> : null}

      {data ? (
        <>
          <StatStrip
            items={[
              { label: 'Students', value: String(data.enrollment_students) },
              { label: 'Subjects', value: String(data.subjects_active) },
              { label: 'Lessons done', value: String(data.lessons_completed) },
              { label: 'Avg progress', value: `${data.avg_lesson_progress}%` },
            ]}
          />

          <Panel title="School snapshot" description="Key operational metrics for leadership reviews">
            <div className="rpt-table-wrap">
              <table className="rpt-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {LABELS.map(({ key, label }) => (
                    <tr key={key}>
                      <td>{label}</td>
                      <td>
                        <strong>
                          {key === 'avg_lesson_progress' ? `${data[key]}%` : data[key]}
                        </strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      ) : null}
    </ReportPageShell>
  );
}
