import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@stemora/auth';
import { Button, Panel, SelectField, StatStrip } from '@stemora/ui';
import { ReportPageShell, useReportMeta } from './ReportShell';
import { downloadExcelCsv, exportPdfDocument, kpiHtml, tableHtml } from './reportUtils';

type CurriculumRow = {
  curriculum_id: number;
  code: string;
  version: string | number;
  status: string;
  subjects: number;
  chapters: number;
  curriculum_lessons: number;
  interactive_published: number;
  lessons_with_completions: number;
  completion_rate_percent: number;
};

export function CurriculumCompletionPage() {
  const { api } = useAuth();
  const { meta, loading: metaLoading, error: metaError } = useReportMeta();
  const [curriculumId, setCurriculumId] = useState('');
  const [rows, setRows] = useState<CurriculumRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = curriculumId ? `?curriculum_id=${encodeURIComponent(curriculumId)}` : '';
      const res = await api.get<{ data: CurriculumRow[] }>(`/org/reports/curriculum-completion${qs}`);
      setRows(res.data);
    } catch (e) {
      setRows(null);
      setError(e instanceof Error ? e.message : 'Could not load curriculum completion.');
    } finally {
      setLoading(false);
    }
  }, [api, curriculumId]);

  useEffect(() => {
    void load();
  }, [load]);

  const list = rows ?? [];
  const avg =
    list.length > 0
      ? Math.round((list.reduce((n, r) => n + r.completion_rate_percent, 0) / list.length) * 10) / 10
      : 0;

  function exportExcel() {
    if (!rows) throw new Error('Load curriculum completion first.');
    downloadExcelCsv(
      'curriculum-completion',
      [
        'Code',
        'Version',
        'Status',
        'Subjects',
        'Chapters',
        'Lessons',
        'Interactive published',
        'With completions',
        'Completion %',
      ],
      list.map((r) => [
        r.code,
        r.version,
        r.status,
        r.subjects,
        r.chapters,
        r.curriculum_lessons,
        r.interactive_published,
        r.lessons_with_completions,
        r.completion_rate_percent,
      ]),
    );
  }

  function exportPdf() {
    if (!rows) throw new Error('Load curriculum completion first.');
    exportPdfDocument({
      title: 'Curriculum completion',
      subtitle: curriculumId
        ? meta?.curricula.find((c) => String(c.id) === curriculumId)?.name ?? `Curriculum #${curriculumId}`
        : 'All curricula',
      bodyHtml:
        kpiHtml([
          { label: 'Curricula', value: list.length },
          { label: 'Avg completion', value: `${avg}%` },
        ]) +
        tableHtml(
          ['Code', 'Version', 'Status', 'Lessons', 'Interactive', 'Completed', 'Rate %'],
          list.map((r) => [
            r.code,
            r.version,
            r.status,
            r.curriculum_lessons,
            r.interactive_published,
            r.lessons_with_completions,
            r.completion_rate_percent,
          ]),
        ),
    });
  }

  return (
    <ReportPageShell
      title="Curriculum completion"
      subtitle="Published interactive lessons versus learner completions"
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
      {loading && !rows ? <p className="rpt-muted">Loading curriculum completion…</p> : null}

      {rows ? (
        <>
          <StatStrip
            items={[
              { label: 'Curricula', value: String(list.length) },
              { label: 'Avg completion', value: `${avg}%` },
              {
                label: 'Interactive published',
                value: String(list.reduce((n, r) => n + r.interactive_published, 0)),
              },
              {
                label: 'With completions',
                value: String(list.reduce((n, r) => n + r.lessons_with_completions, 0)),
              },
            ]}
          />

          <Panel title="Completion by curriculum" description="Coverage and learner completion rates">
            {list.length ? (
              <div className="rpt-table-wrap">
                <table className="rpt-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Version</th>
                      <th>Status</th>
                      <th>Subjects</th>
                      <th>Chapters</th>
                      <th>Lessons</th>
                      <th>Interactive</th>
                      <th>Completed</th>
                      <th>Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r) => (
                      <tr key={r.curriculum_id}>
                        <td>{r.code}</td>
                        <td>{r.version}</td>
                        <td>
                          <span className={`rpt-chip ${r.status === 'published' ? '' : 'is-muted'}`}>
                            {r.status}
                          </span>
                        </td>
                        <td>{r.subjects}</td>
                        <td>{r.chapters}</td>
                        <td>{r.curriculum_lessons}</td>
                        <td>{r.interactive_published}</td>
                        <td>{r.lessons_with_completions}</td>
                        <td>
                          <strong>{r.completion_rate_percent}%</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rpt-muted">No curricula matched this filter.</p>
            )}
          </Panel>
        </>
      ) : null}
    </ReportPageShell>
  );
}
