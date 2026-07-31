import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@stemora/auth';
import { Button, Panel, SelectField, StatStrip } from '@stemora/ui';
import { ReportPageShell, useReportMeta } from './ReportShell';
import { downloadExcelCsv, exportPdfDocument, kpiHtml, tableHtml } from './reportUtils';

type OutcomeRow = {
  id: number;
  code: string;
  statement_en: string;
  statement_ar?: string | null;
  curriculum_id: number | null;
  linked_lessons: number;
  assessment_responses: number;
  correct_responses: number;
  mastery_percent: number | null;
};

export function LearningOutcomesPage() {
  const { api } = useAuth();
  const { meta, loading: metaLoading, error: metaError } = useReportMeta();
  const [curriculumId, setCurriculumId] = useState('');
  const [rows, setRows] = useState<OutcomeRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = curriculumId ? `?curriculum_id=${encodeURIComponent(curriculumId)}` : '';
      const res = await api.get<{ data: OutcomeRow[] }>(`/org/reports/learning-outcomes${qs}`);
      setRows(res.data);
    } catch (e) {
      setRows(null);
      setError(e instanceof Error ? e.message : 'Could not load learning outcomes.');
    } finally {
      setLoading(false);
    }
  }, [api, curriculumId]);

  useEffect(() => {
    void load();
  }, [load]);

  const list = rows ?? [];
  const withMastery = list.filter((r) => r.mastery_percent != null);
  const avgMastery =
    withMastery.length > 0
      ? Math.round(
          (withMastery.reduce((n, r) => n + (r.mastery_percent ?? 0), 0) / withMastery.length) * 10,
        ) / 10
      : null;

  function exportExcel() {
    if (!rows) throw new Error('Load learning outcomes first.');
    downloadExcelCsv(
      'learning-outcomes',
      [
        'Code',
        'Statement',
        'Curriculum ID',
        'Linked lessons',
        'Responses',
        'Correct',
        'Mastery %',
      ],
      list.map((r) => [
        r.code,
        r.statement_en,
        r.curriculum_id ?? '',
        r.linked_lessons,
        r.assessment_responses,
        r.correct_responses,
        r.mastery_percent ?? '',
      ]),
    );
  }

  function exportPdf() {
    if (!rows) throw new Error('Load learning outcomes first.');
    exportPdfDocument({
      title: 'Learning outcomes',
      subtitle: curriculumId
        ? meta?.curricula.find((c) => String(c.id) === curriculumId)?.name ?? `Curriculum #${curriculumId}`
        : 'All curricula',
      bodyHtml:
        kpiHtml([
          { label: 'Outcomes', value: list.length },
          { label: 'With mastery data', value: withMastery.length },
          { label: 'Avg mastery', value: avgMastery != null ? `${avgMastery}%` : '—' },
        ]) +
        tableHtml(
          ['Code', 'Statement', 'Lessons', 'Responses', 'Correct', 'Mastery %'],
          list.map((r) => [
            r.code,
            r.statement_en,
            r.linked_lessons,
            r.assessment_responses,
            r.correct_responses,
            r.mastery_percent ?? '—',
          ]),
        ),
    });
  }

  return (
    <ReportPageShell
      title="Learning outcomes"
      subtitle="Outcome mastery estimated from linked assessment responses"
      filters={
        <>
          <SelectField
            label="Curriculum"
            value={curriculumId}
            onChange={(e) => setCurriculumId(e.target.value)}
            disabled={metaLoading}
          >
            <option value="">All curricula</option>
            {meta?.curricula.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · v{c.version} ({c.status})
              </option>
            ))}
          </SelectField>
          <Button size="sm" type="button" variant="primary" onClick={() => void load()} disabled={loading}>
            {loading ? 'Loading…' : 'Run report'}
          </Button>
        </>
      }
      onExportExcel={rows ? exportExcel : undefined}
      onExportPdf={rows ? exportPdf : undefined}
    >
      {metaError || error ? <div className="rpt-alert">{metaError || error}</div> : null}
      {loading && !rows ? <p className="rpt-muted">Loading learning outcomes…</p> : null}

      {rows ? (
        <>
          <StatStrip
            items={[
              { label: 'Outcomes', value: String(list.length) },
              { label: 'With mastery', value: String(withMastery.length) },
              { label: 'Avg mastery', value: avgMastery != null ? `${avgMastery}%` : '—' },
              {
                label: 'Responses',
                value: String(list.reduce((n, r) => n + r.assessment_responses, 0)),
              },
            ]}
          />

          <Panel title="Outcome mastery" description="Correct response share by learning outcome">
            {list.length ? (
              <div className="rpt-table-wrap">
                <table className="rpt-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Statement</th>
                      <th>Lessons</th>
                      <th>Responses</th>
                      <th>Correct</th>
                      <th>Mastery</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r) => (
                      <tr key={r.id}>
                        <td>{r.code}</td>
                        <td>{r.statement_en}</td>
                        <td>{r.linked_lessons}</td>
                        <td>{r.assessment_responses}</td>
                        <td>{r.correct_responses}</td>
                        <td>
                          {r.mastery_percent != null ? (
                            <strong>{r.mastery_percent}%</strong>
                          ) : (
                            <span className="rpt-chip is-muted">No data</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rpt-muted">No learning outcomes matched this filter.</p>
            )}
          </Panel>
        </>
      ) : null}
    </ReportPageShell>
  );
}
