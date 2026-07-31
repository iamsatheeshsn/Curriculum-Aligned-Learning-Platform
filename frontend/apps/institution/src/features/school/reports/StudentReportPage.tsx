import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@stemora/auth';
import { Button, Panel, SelectField, StatStrip } from '@stemora/ui';
import { ReportPageShell, useReportMeta } from './ReportShell';
import {
  downloadExcelCsv,
  exportPdfDocument,
  kpiHtml,
  tableHtml,
} from './reportUtils';

type StudentReport = {
  student: { id: number; first_name: string; last_name: string; email: string };
  learning: {
    lessons_started: number;
    lessons_completed: number;
    avg_progress_percent: number;
    records: {
      id: number;
      status: string;
      progress_percent: number;
      lesson?: { id: number; title_en?: string } | null;
    }[];
  };
  assessments: {
    attempts: number;
    avg_score: number;
    records: {
      id: number;
      status: string;
      score: number | null;
      max_score?: number | null;
      submitted_at?: string | null;
      assessment?: { id: number; title_en?: string; type?: string } | null;
    }[];
  };
  tutoring_attendance: Record<string, number>;
};

export function StudentReportPage() {
  const { api } = useAuth();
  const { meta, loading: metaLoading, error: metaError } = useReportMeta();
  const [studentId, setStudentId] = useState('');
  const [data, setData] = useState<StudentReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId && meta?.students?.length) {
      setStudentId(String(meta.students[0].id));
    }
  }, [meta, studentId]);

  const load = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: StudentReport }>(
        `/org/reports/student?student_user_id=${encodeURIComponent(studentId)}`,
      );
      setData(res.data);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : 'Could not load student report.');
    } finally {
      setLoading(false);
    }
  }, [api, studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const attendanceRows = useMemo(
    () => Object.entries(data?.tutoring_attendance ?? {}).map(([status, total]) => [status, total]),
    [data],
  );

  const studentName = data
    ? `${data.student.first_name} ${data.student.last_name}`.trim()
    : meta?.students.find((s) => String(s.id) === studentId)?.name ?? 'Student';

  function exportExcel() {
    if (!data) throw new Error('Load a student report first.');
    const lessonRows = data.learning.records.map((r) => [
      r.lesson?.title_en ?? `Lesson #${r.id}`,
      r.status,
      r.progress_percent,
    ]);
    const attemptRows = data.assessments.records.map((r) => [
      r.assessment?.title_en ?? `Attempt #${r.id}`,
      r.assessment?.type ?? '',
      r.status,
      r.score ?? '',
      r.max_score ?? '',
      r.submitted_at ?? '',
    ]);
    downloadExcelCsv(
      `student-report-${data.student.id}`,
      ['Section', 'Item', 'Col1', 'Col2', 'Col3', 'Col4'],
      [
        ['Summary', 'Student', studentName, data.student.email, '', ''],
        ['Summary', 'Lessons started', data.learning.lessons_started, '', '', ''],
        ['Summary', 'Lessons completed', data.learning.lessons_completed, '', '', ''],
        ['Summary', 'Avg progress %', data.learning.avg_progress_percent, '', '', ''],
        ['Summary', 'Assessment attempts', data.assessments.attempts, '', '', ''],
        ['Summary', 'Avg score', data.assessments.avg_score, '', '', ''],
        ...lessonRows.map((r) => ['Learning', ...r, '', '']),
        ...attemptRows.map((r) => ['Assessment', ...r]),
        ...attendanceRows.map(([s, t]) => ['Attendance', s, t, '', '', '']),
      ],
    );
  }

  function exportPdf() {
    if (!data) throw new Error('Load a student report first.');
    const lessonTable = tableHtml(
      ['Lesson', 'Status', 'Progress %'],
      data.learning.records.map((r) => [
        r.lesson?.title_en ?? `Lesson #${r.id}`,
        r.status,
        r.progress_percent,
      ]),
    );
    const attemptTable = tableHtml(
      ['Assessment', 'Type', 'Status', 'Score', 'Submitted'],
      data.assessments.records.map((r) => [
        r.assessment?.title_en ?? `#${r.id}`,
        r.assessment?.type ?? '',
        r.status,
        r.score ?? '—',
        r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '—',
      ]),
    );
    exportPdfDocument({
      title: `Student report — ${studentName}`,
      subtitle: data.student.email,
      bodyHtml:
        kpiHtml([
          { label: 'Lessons started', value: data.learning.lessons_started },
          { label: 'Completed', value: data.learning.lessons_completed },
          { label: 'Avg progress', value: `${data.learning.avg_progress_percent}%` },
          { label: 'Avg score', value: data.assessments.avg_score },
        ]) +
        '<h2>Learning progress</h2>' +
        lessonTable +
        '<h2>Assessments</h2>' +
        attemptTable +
        '<h2>Tutoring attendance</h2>' +
        tableHtml(['Status', 'Count'], attendanceRows),
    });
  }

  return (
    <ReportPageShell
      title="Student report"
      subtitle="Individual learner progress, assessments, and tutoring attendance"
      filters={
        <>
          <SelectField
            label="Student"
            required
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            disabled={metaLoading || !meta?.students.length}
          >
            {!meta?.students.length ? <option value="">No students found</option> : null}
            {meta?.students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.email})
              </option>
            ))}
          </SelectField>
          <Button size="sm" type="button" variant="primary" onClick={() => void load()} disabled={!studentId || loading}>
            {loading ? 'Loading…' : 'Run report'}
          </Button>
        </>
      }
      onExportExcel={data ? exportExcel : undefined}
      onExportPdf={data ? exportPdf : undefined}
    >
      {metaError || error ? <div className="rpt-alert">{metaError || error}</div> : null}

      {loading && !data ? <p className="rpt-muted">Loading student report…</p> : null}

      {data ? (
        <>
          <StatStrip
            items={[
              { label: 'Lessons started', value: String(data.learning.lessons_started) },
              { label: 'Completed', value: String(data.learning.lessons_completed) },
              { label: 'Avg progress', value: `${data.learning.avg_progress_percent}%` },
              { label: 'Avg score', value: String(data.assessments.avg_score ?? '—') },
            ]}
          />

          <div className="rpt-card-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            <Panel title="Learning progress" description={`${studentName} · lesson activity`}>
              {data.learning.records.length ? (
                <div className="rpt-table-wrap">
                  <table className="rpt-table">
                    <thead>
                      <tr>
                        <th>Lesson</th>
                        <th>Status</th>
                        <th>Progress</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.learning.records.map((r) => (
                        <tr key={r.id}>
                          <td>{r.lesson?.title_en ?? `Lesson #${r.id}`}</td>
                          <td>
                            <span className="rpt-chip">{r.status}</span>
                          </td>
                          <td>{r.progress_percent}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="rpt-muted">No learning progress recorded yet.</p>
              )}
            </Panel>

            <Panel title="Assessments" description={`${data.assessments.attempts} attempts`}>
              {data.assessments.records.length ? (
                <div className="rpt-table-wrap">
                  <table className="rpt-table">
                    <thead>
                      <tr>
                        <th>Assessment</th>
                        <th>Type</th>
                        <th>Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.assessments.records.map((r) => (
                        <tr key={r.id}>
                          <td>{r.assessment?.title_en ?? `#${r.id}`}</td>
                          <td>{r.assessment?.type ?? '—'}</td>
                          <td>
                            {r.score ?? '—'}
                            {r.max_score != null ? ` / ${r.max_score}` : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="rpt-muted">No graded or submitted attempts.</p>
              )}
            </Panel>
          </div>

          <Panel title="Tutoring attendance" description="Session attendance statuses for this student">
            {attendanceRows.length ? (
              <div className="rpt-table-wrap">
                <table className="rpt-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceRows.map(([status, total]) => (
                      <tr key={String(status)}>
                        <td>
                          <span className="rpt-chip">{String(status)}</span>
                        </td>
                        <td>{String(total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rpt-muted">No tutoring attendance records.</p>
            )}
          </Panel>
        </>
      ) : null}
    </ReportPageShell>
  );
}
