import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@stemora/auth';
import { Button, Panel, SelectField, StatStrip } from '@stemora/ui';
import { ReportPageShell, useReportMeta } from './ReportShell';
import { downloadExcelCsv, exportPdfDocument, kpiHtml, tableHtml } from './reportUtils';

type TeacherReport = {
  graded_assessments: {
    assessment_id: number | null;
    title_en?: string | null;
    type?: string | null;
    attempts: number;
    avg_score: number;
    max_score: number;
  }[];
  homework_submissions: Record<string, number>;
  class_avg_score: number;
};

export function TeacherReportPage() {
  const { api } = useAuth();
  const { meta, loading: metaLoading, error: metaError } = useReportMeta();
  const [subjectId, setSubjectId] = useState('');
  const [data, setData] = useState<TeacherReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = subjectId ? `?subject_id=${encodeURIComponent(subjectId)}` : '';
      const res = await api.get<{ data: TeacherReport }>(`/org/reports/teacher${qs}`);
      setData(res.data);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : 'Could not load teacher report.');
    } finally {
      setLoading(false);
    }
  }, [api, subjectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const homeworkRows = Object.entries(data?.homework_submissions ?? {});

  function exportExcel() {
    if (!data) throw new Error('Load the teacher report first.');
    downloadExcelCsv(
      'teacher-report',
      ['Section', 'Title', 'Type', 'Attempts', 'Avg score', 'Max score'],
      [
        ['Summary', 'Class average', '', '', data.class_avg_score, ''],
        ...data.graded_assessments.map((r) => [
          'Assessment',
          r.title_en ?? r.assessment_id,
          r.type ?? '',
          r.attempts,
          r.avg_score,
          r.max_score,
        ]),
        ...homeworkRows.map(([status, total]) => ['Homework', status, '', total, '', '']),
      ],
    );
  }

  function exportPdf() {
    if (!data) throw new Error('Load the teacher report first.');
    exportPdfDocument({
      title: 'Teacher report',
      subtitle: subjectId
        ? meta?.subjects.find((s) => String(s.id) === subjectId)?.name ?? `Subject #${subjectId}`
        : 'All subjects',
      bodyHtml:
        kpiHtml([
          { label: 'Class avg score', value: data.class_avg_score },
          { label: 'Assessments', value: data.graded_assessments.length },
          { label: 'Homework statuses', value: homeworkRows.length },
        ]) +
        '<h2>Graded assessments</h2>' +
        tableHtml(
          ['Assessment', 'Type', 'Attempts', 'Avg score', 'Max score'],
          data.graded_assessments.map((r) => [
            r.title_en ?? r.assessment_id,
            r.type ?? '',
            r.attempts,
            r.avg_score,
            r.max_score,
          ]),
        ) +
        '<h2>Homework submissions</h2>' +
        tableHtml(['Status', 'Count'], homeworkRows),
    });
  }

  return (
    <ReportPageShell
      title="Teacher report"
      subtitle="Assessment performance and homework submission health"
      filters={
        <>
          <SelectField
            label="Subject"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            disabled={metaLoading}
          >
            <option value="">All subjects</option>
            {meta?.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </SelectField>
          <Button size="sm" type="button" variant="primary" onClick={() => void load()} disabled={loading}>
            {loading ? 'Loading…' : 'Run report'}
          </Button>
        </>
      }
      onExportExcel={data ? exportExcel : undefined}
      onExportPdf={data ? exportPdf : undefined}
    >
      {metaError || error ? <div className="rpt-alert">{metaError || error}</div> : null}
      {loading && !data ? <p className="rpt-muted">Loading teacher report…</p> : null}

      {data ? (
        <>
          <StatStrip
            items={[
              { label: 'Class avg score', value: String(data.class_avg_score ?? '—') },
              { label: 'Assessments', value: String(data.graded_assessments.length) },
              {
                label: 'Homework rows',
                value: String(homeworkRows.reduce((n, [, t]) => n + Number(t), 0)),
              },
            ]}
          />

          <Panel title="Graded assessments" description="Average scores by assessment">
            {data.graded_assessments.length ? (
              <div className="rpt-table-wrap">
                <table className="rpt-table">
                  <thead>
                    <tr>
                      <th>Assessment</th>
                      <th>Type</th>
                      <th>Attempts</th>
                      <th>Avg score</th>
                      <th>Max score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.graded_assessments.map((r) => (
                      <tr key={r.assessment_id ?? r.title_en}>
                        <td>{r.title_en ?? `Assessment #${r.assessment_id}`}</td>
                        <td>
                          <span className="rpt-chip">{r.type ?? '—'}</span>
                        </td>
                        <td>{r.attempts}</td>
                        <td>{r.avg_score}</td>
                        <td>{r.max_score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rpt-muted">No graded assessments for this filter.</p>
            )}
          </Panel>

          <Panel title="Homework submissions" description="Counts by submission status">
            {homeworkRows.length ? (
              <div className="rpt-table-wrap">
                <table className="rpt-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {homeworkRows.map(([status, total]) => (
                      <tr key={status}>
                        <td>
                          <span className="rpt-chip">{status}</span>
                        </td>
                        <td>{total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rpt-muted">No homework submissions found.</p>
            )}
          </Panel>
        </>
      ) : null}
    </ReportPageShell>
  );
}
