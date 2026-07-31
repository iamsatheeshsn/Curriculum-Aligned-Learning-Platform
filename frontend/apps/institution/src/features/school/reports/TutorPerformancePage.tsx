import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@stemora/auth';
import { Button, Panel, SelectField, StatStrip } from '@stemora/ui';
import { ReportPageShell, useReportMeta } from './ReportShell';
import { downloadExcelCsv, exportPdfDocument, kpiHtml, tableHtml } from './reportUtils';

type TutorRow = {
  tutor_profile_id: number;
  tutor_name: string;
  sessions_total: number;
  sessions_completed: number;
  sessions_cancelled: number;
  hours_completed: number;
  attendance_present: number;
  avg_rating: number | null;
};

type TutorReport = { tutors: TutorRow[] };

export function TutorPerformancePage() {
  const { api } = useAuth();
  const { meta, loading: metaLoading, error: metaError } = useReportMeta();
  const [tutorId, setTutorId] = useState('');
  const [data, setData] = useState<TutorReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = tutorId ? `?tutor_profile_id=${encodeURIComponent(tutorId)}` : '';
      const res = await api.get<{ data: TutorReport }>(`/org/reports/tutor-performance${qs}`);
      setData(res.data);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : 'Could not load tutor performance.');
    } finally {
      setLoading(false);
    }
  }, [api, tutorId]);

  useEffect(() => {
    void load();
  }, [load]);

  const tutors = data?.tutors ?? [];
  const totals = {
    sessions: tutors.reduce((n, t) => n + t.sessions_total, 0),
    completed: tutors.reduce((n, t) => n + t.sessions_completed, 0),
    hours: Math.round(tutors.reduce((n, t) => n + t.hours_completed, 0) * 100) / 100,
  };

  function exportExcel() {
    if (!data) throw new Error('Load the tutor report first.');
    downloadExcelCsv(
      'tutor-performance',
      ['Tutor', 'Sessions', 'Completed', 'Cancelled', 'Hours', 'Present', 'Avg rating'],
      tutors.map((t) => [
        t.tutor_name,
        t.sessions_total,
        t.sessions_completed,
        t.sessions_cancelled,
        t.hours_completed,
        t.attendance_present,
        t.avg_rating ?? '',
      ]),
    );
  }

  function exportPdf() {
    if (!data) throw new Error('Load the tutor report first.');
    exportPdfDocument({
      title: 'Tutor performance',
      subtitle: tutorId
        ? meta?.tutors.find((t) => String(t.id) === tutorId)?.name ?? `Tutor #${tutorId}`
        : 'All tutors',
      bodyHtml:
        kpiHtml([
          { label: 'Tutors', value: tutors.length },
          { label: 'Sessions', value: totals.sessions },
          { label: 'Completed', value: totals.completed },
          { label: 'Hours', value: totals.hours },
        ]) +
        tableHtml(
          ['Tutor', 'Sessions', 'Completed', 'Cancelled', 'Hours', 'Present', 'Avg rating'],
          tutors.map((t) => [
            t.tutor_name,
            t.sessions_total,
            t.sessions_completed,
            t.sessions_cancelled,
            t.hours_completed,
            t.attendance_present,
            t.avg_rating ?? '—',
          ]),
        ),
    });
  }

  return (
    <ReportPageShell
      title="Tutor performance"
      subtitle="Session volume, completion, attendance, and ratings"
      filters={
        <>
          <SelectField
            label="Tutor"
            value={tutorId}
            onChange={(e) => setTutorId(e.target.value)}
            disabled={metaLoading}
          >
            <option value="">All tutors</option>
            {meta?.tutors.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
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
      {loading && !data ? <p className="rpt-muted">Loading tutor performance…</p> : null}

      {data ? (
        <>
          <StatStrip
            items={[
              { label: 'Tutors', value: String(tutors.length) },
              { label: 'Sessions', value: String(totals.sessions) },
              { label: 'Completed', value: String(totals.completed) },
              { label: 'Hours', value: String(totals.hours) },
            ]}
          />

          <Panel title="Tutor breakdown" description="Operational performance by tutor profile">
            {tutors.length ? (
              <div className="rpt-table-wrap">
                <table className="rpt-table">
                  <thead>
                    <tr>
                      <th>Tutor</th>
                      <th>Sessions</th>
                      <th>Completed</th>
                      <th>Cancelled</th>
                      <th>Hours</th>
                      <th>Present</th>
                      <th>Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tutors.map((t) => (
                      <tr key={t.tutor_profile_id}>
                        <td>{t.tutor_name || `Tutor #${t.tutor_profile_id}`}</td>
                        <td>{t.sessions_total}</td>
                        <td>{t.sessions_completed}</td>
                        <td>{t.sessions_cancelled}</td>
                        <td>{t.hours_completed}</td>
                        <td>{t.attendance_present}</td>
                        <td>{t.avg_rating ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rpt-muted">No tutoring sessions found for this filter.</p>
            )}
          </Panel>
        </>
      ) : null}
    </ReportPageShell>
  );
}
