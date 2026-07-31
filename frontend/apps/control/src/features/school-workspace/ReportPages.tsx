import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import {
  Button,
  Panel,
  StatStrip,
  downloadExcelCsv,
  exportPdfDocument,
  kpiHtml,
  tableHtml,
  useFeedback,
} from '@stemora/ui';
import { ControlLayout } from '../../layout/ControlLayout';
import { WORKSPACE_API, WorkspaceGuard, formatMoney } from './shared';
import { workspacePageStyles } from './styles';

type ReportConfig = {
  id: string;
  title: string;
  subtitle: string;
  heroLead: string;
  endpoint: string;
  navPermission: string | string[];
  prefix: string;
  links?: { to: string; label: string }[];
  /** Keys expected in report.kpis */
  kpiKeys: { key: string; label: string; money?: boolean }[];
  /** Table section title + column defs reading report.rows */
  tableTitle: string;
  columns: { key: string; label: string }[];
};

function ReportWorkspace({ config }: { config: ReportConfig }) {
  const P = config.prefix;
  const { api } = useAuth();
  const feedback = useFeedback();
  const [report, setReport] = useState<{
    kpis?: Record<string, number | string>;
    rows?: Record<string, unknown>[];
    currency?: string;
    generated_at?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: typeof report }>(`${WORKSPACE_API}/${config.endpoint}`);
      setReport(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [api, config.endpoint]);

  useEffect(() => {
    void load();
  }, [load]);

  const currency = String(report?.currency ?? 'SAR');
  const rows = report?.rows ?? [];
  const kpis = report?.kpis ?? {};

  function exportExcel() {
    downloadExcelCsv(
      `${config.id}-${new Date().toISOString().slice(0, 10)}.csv`,
      config.columns.map((c) => c.label),
      rows.map((row) => config.columns.map((c) => row[c.key] ?? '')),
    );
    void feedback.success({ title: 'Excel exported', message: 'CSV download started.' });
  }

  function exportPdf() {
    void exportPdfDocument({
      title: config.title,
      subtitle: config.subtitle,
      documentLabel: 'Stemora · School reports',
      bodyHtml:
        kpiHtml(
          config.kpiKeys.map((k) => ({
            label: k.label,
            value: k.money ? formatMoney(Number(kpis[k.key]), currency) : String(kpis[k.key] ?? '—'),
          })),
        ) +
        tableHtml(
          config.columns.map((c) => c.label),
          rows.map((row) => config.columns.map((c) => row[c.key] ?? '')),
        ),
    });
  }

  return (
    <div className={`${P}page`}>
      <style>{workspacePageStyles(P)}</style>
      <section className={`${P}hero`}>
        <div>
          <p className={`${P}eyebrow`}>Control · Reports</p>
          <h2 className={`${P}hero-title`}>{config.title}</h2>
          <p className={`${P}hero-lead`}>{config.heroLead}</p>
        </div>
        <div className={`${P}hero-actions`}>
          <div className={`${P}action-row`}>
            <Button size="sm" type="button" variant="secondary" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
            <Button size="sm" type="button" variant="secondary" onClick={exportPdf} disabled={!report}>
              Export PDF
            </Button>
            <Button size="sm" type="button" variant="secondary" onClick={exportExcel} disabled={!report}>
              Export Excel
            </Button>
          </div>
          {config.links?.length ? (
            <div className={`${P}action-row`}>
              {config.links.map((l) => (
                <Link key={l.to} className={`${P}ghost-link`} to={l.to}>
                  {l.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {error ? (
        <div className={`${P}alert`} role="alert">
          <span>{error}</span>
          <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : null}

      {loading && !report ? <p>Loading report…</p> : null}

      {report ? (
        <>
          <StatStrip
            items={config.kpiKeys.map((k) => ({
              label: k.label,
              value: k.money ? formatMoney(Number(kpis[k.key]), currency) : (kpis[k.key] ?? '—'),
            }))}
          />
          <Panel
            title={config.tableTitle}
            description={
              report.generated_at
                ? `Generated ${new Date(report.generated_at).toLocaleString()}`
                : 'Latest school figures'
            }
          >
            <div className={`${P}table-wrap`}>
              <table className={`${P}table`}>
                <thead>
                  <tr>
                    {config.columns.map((c) => (
                      <th key={c.key}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={config.columns.length} className={`${P}empty`}>
                        No rows for this report yet.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, idx) => (
                      <tr key={String(row.id ?? idx)}>
                        {config.columns.map((c) => (
                          <td key={c.key}>{String(row[c.key] ?? '—')}</td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      ) : null}
    </div>
  );
}

function ReportPage(config: ReportConfig) {
  return (
    <WorkspaceGuard navPermission={config.navPermission}>
      <ControlLayout title={config.title} subtitle={config.subtitle}>
        <ReportWorkspace config={config} />
      </ControlLayout>
    </WorkspaceGuard>
  );
}

export function FinanceReportsPage() {
  return (
    <ReportPage
      id="finance-reports"
      title="Finance reports"
      subtitle="Fees collected, tutor payouts, expenses, and net position"
      heroLead="Export a finance snapshot for your school — collections versus spend."
      endpoint="finance/reports"
      navPermission="nav.control.finance"
      prefix="fr-"
      links={[
        { to: '/finance/fees', label: 'Student fees' },
        { to: '/finance/tutor-payments', label: 'Tutor payments' },
        { to: '/finance/expenses', label: 'Expenses' },
      ]}
      kpiKeys={[
        { key: 'fees_collected', label: 'Fees collected', money: true },
        { key: 'tutor_payments', label: 'Tutor payments', money: true },
        { key: 'expenses', label: 'Expenses', money: true },
        { key: 'net', label: 'Net', money: true },
      ]}
      tableTitle="Finance breakdown"
      columns={[
        { key: 'category', label: 'Category' },
        { key: 'count', label: 'Count' },
        { key: 'amount', label: 'Amount' },
      ]}
    />
  );
}

export function AcademicReportPage() {
  return (
    <ReportPage
      id="academic-report"
      title="Academic reports"
      subtitle="Enrolment, curriculum coverage, and assessment activity"
      heroLead="See how teaching and assessment activity is trending across your school."
      endpoint="reports/academic"
      navPermission="nav.control.reports"
      prefix="rac-"
      links={[
        { to: '/students', label: 'Students' },
        { to: '/assessments/results', label: 'Results' },
      ]}
      kpiKeys={[
        { key: 'students', label: 'Students' },
        { key: 'subjects', label: 'Subjects' },
        { key: 'assessments', label: 'Assessments' },
        { key: 'attempts', label: 'Attempts' },
      ]}
      tableTitle="Academic snapshot"
      columns={[
        { key: 'metric', label: 'Metric' },
        { key: 'value', label: 'Value' },
      ]}
    />
  );
}

export function AttendanceReportPage() {
  return (
    <ReportPage
      id="attendance-report"
      title="Attendance reports"
      subtitle="Staff attendance summary by status"
      heroLead="Export present, absent, late, and leave totals for compliance and HR reviews."
      endpoint="reports/attendance"
      navPermission="nav.control.reports"
      prefix="rat-"
      links={[
        { to: '/staff/attendance', label: 'Staff attendance' },
        { to: '/staff', label: 'Employees' },
      ]}
      kpiKeys={[
        { key: 'present', label: 'Present' },
        { key: 'absent', label: 'Absent' },
        { key: 'late', label: 'Late' },
        { key: 'leave', label: 'Leave' },
      ]}
      tableTitle="Attendance by day"
      columns={[
        { key: 'date', label: 'Date' },
        { key: 'present', label: 'Present' },
        { key: 'absent', label: 'Absent' },
        { key: 'late', label: 'Late' },
        { key: 'leave', label: 'Leave' },
      ]}
    />
  );
}

export function SchoolRevenueReportPage() {
  return (
    <ReportPage
      id="school-revenue-report"
      title="Revenue reports"
      subtitle="School fee collections and outstanding balances"
      heroLead="Track invoice pipeline and collected revenue for your institution."
      endpoint="reports/revenue"
      navPermission="nav.control.reports"
      prefix="rrv-"
      links={[
        { to: '/finance/fees', label: 'Student fees' },
        { to: '/finance/reports', label: 'Finance reports' },
      ]}
      kpiKeys={[
        { key: 'collected', label: 'Collected', money: true },
        { key: 'outstanding', label: 'Outstanding', money: true },
        { key: 'invoices', label: 'Invoices' },
        { key: 'paid_invoices', label: 'Paid invoices' },
      ]}
      tableTitle="Invoice pipeline"
      columns={[
        { key: 'status', label: 'Status' },
        { key: 'count', label: 'Count' },
        { key: 'amount', label: 'Amount' },
      ]}
    />
  );
}

export function PerformanceReportPage() {
  return (
    <ReportPage
      id="performance-report"
      title="Performance reports"
      subtitle="Assessment outcomes and pass rates"
      heroLead="Understand how learners are performing across quizzes and exams."
      endpoint="reports/performance"
      navPermission="nav.control.reports"
      prefix="rpf-"
      links={[
        { to: '/assessments/results', label: 'Results' },
        { to: '/reports/academic', label: 'Academic reports' },
      ]}
      kpiKeys={[
        { key: 'attempts', label: 'Attempts' },
        { key: 'avg_score', label: 'Average score' },
        { key: 'pass_rate', label: 'Pass rate %' },
        { key: 'assessments', label: 'Assessments' },
      ]}
      tableTitle="Performance by assessment"
      columns={[
        { key: 'title', label: 'Assessment' },
        { key: 'attempts', label: 'Attempts' },
        { key: 'avg_score', label: 'Avg score' },
        { key: 'pass_rate', label: 'Pass %' },
      ]}
    />
  );
}
