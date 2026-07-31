import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import {
  Button,
  Panel,
  StatStrip,
  downloadExcelCsv,
  exportPdfDocument,
  useFeedback,
} from '@stemora/ui';
import { ControlLayout } from '../../layout/ControlLayout';
import { statusLabel } from '../../types';

type ByTenantRow = {
  tenant_id: number;
  tenant_name: string | null;
  tenant_slug: string | null;
  students: number;
};

type RecentStudent = {
  user_id: number;
  email: string | null;
  name: string;
  status: string | null;
  tenant: { id: number; name: string; slug: string } | null;
  school_id: number | null;
  last_login_at: string | null;
};

type StudentsReport = {
  summary: {
    total_students: number;
    tenants: number;
  };
  by_tenant: ByTenantRow[];
  recent: RecentStudent[];
  generated_at: string;
};

export function StudentsReportPage() {
  const { isSuperAdmin, hasPermission } = useAuth();
  if (!isSuperAdmin && !hasPermission(['platform.tenants.manage', 'nav.control.reports'])) {
    return <Navigate to="/" replace />;
  }

  return (
    <ControlLayout
      title="Students Report"
      subtitle="Exportable student enrolment across tenants and recent activity"
    >
      <StudentsReportWorkspace />
    </ControlLayout>
  );
}

function StudentsReportWorkspace() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [data, setData] = useState<StudentsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: StudentsReport }>('/control/reports/students');
      setData(res.data);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Could not load students report.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runExport(kind: 'excel' | 'pdf') {
    if (!data) return;
    setExporting(true);
    try {
      if (kind === 'excel') {
        downloadExcelCsv(
          'students-report',
          ['Section', 'Tenant', 'Email / Name', 'Value'],
          [
            ['Summary', 'Total students', '', data.summary.total_students],
            ['Summary', 'Tenants', '', data.summary.tenants],
            ...data.by_tenant.map((row) => [
              'By tenant',
              row.tenant_name ?? String(row.tenant_id),
              row.tenant_slug ?? '',
              row.students,
            ]),
            ...data.recent.map((row) => [
              'Recent',
              row.tenant?.name ?? '',
              row.email ?? row.name,
              row.status ?? '',
            ]),
          ],
        );
      } else {
        const summaryCells = [
          ['Total students', data.summary.total_students],
          ['Tenants', data.summary.tenants],
        ]
          .map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`)
          .join('');
        const tenantRows = data.by_tenant
          .map(
            (row) =>
              `<tr><td>${row.tenant_name ?? row.tenant_id}</td><td>${row.tenant_slug ?? '—'}</td><td>${row.students}</td></tr>`,
          )
          .join('');
        const recentRows = data.recent
          .map(
            (row) =>
              `<tr><td>${row.name || row.email || '—'}</td><td>${row.tenant?.name ?? '—'}</td><td>${row.last_login_at ? new Date(row.last_login_at).toLocaleDateString() : '—'}</td></tr>`,
          )
          .join('');
        exportPdfDocument({
          title: 'Students Report',
          subtitle: `${data.summary.total_students} students across ${data.summary.tenants} tenants`,
          bodyHtml: `<div class="kpi">${summaryCells}</div>
            <h2>Students by tenant</h2>
            <table><thead><tr><th>Tenant</th><th>Slug</th><th>Students</th></tr></thead><tbody>${tenantRows || '<tr><td colspan="3">No data</td></tr>'}</tbody></table>
            <h2>Recent students</h2>
            <table><thead><tr><th>Name</th><th>Tenant</th><th>Last login</th></tr></thead><tbody>${recentRows || '<tr><td colspan="3">No data</td></tr>'}</tbody></table>`,
        });
      }
      if (kind === 'excel') {
        await feedback.success({
          title: 'Excel ready',
          message: 'Your spreadsheet download has started.',
        });
      }
    } catch (err) {
      await feedback.confirm({
        title: 'Export failed',
        message: err instanceof Error ? err.message : 'Could not export students report.',
        confirmLabel: 'OK',
        cancelLabel: 'Close',
        tone: 'warn',
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="stu-page">
      <section className="stu-hero stem-animate-rise">
        <div>
          <p className="stu-eyebrow">Control · Reports</p>
          <h2 className="stu-hero-title">Students report</h2>
          <p className="stu-hero-lead">
            Platform-wide student enrolment by tenant and recently registered learners. Export for
            onboarding and capacity planning reviews.
          </p>
        </div>
        <div className="stu-hero-actions">
          <div className="stu-action-row">
            <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button
              size="sm"
              type="button"
              variant="secondary"
              disabled={!data || exporting}
              onClick={() => void runExport('excel')}
            >
              Export Excel
            </Button>
            <Button
              size="sm"
              type="button"
              variant="primary"
              disabled={!data || exporting}
              onClick={() => void runExport('pdf')}
            >
              Export PDF
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="stu-alert" role="alert">
          <span>{error}</span>
          <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : null}

      {loading && !data ? <p className="stu-muted">Loading students report…</p> : null}

      {data ? (
        <>
          <StatStrip
            items={[
              { label: 'Total students', value: String(data.summary.total_students) },
              { label: 'Tenants', value: String(data.summary.tenants), hint: 'With student roles' },
              {
                label: 'Recent',
                value: String(data.recent.length),
                hint: 'Latest enrolments shown',
              },
            ]}
          />

          <div className="stu-grid-2">
            <Panel title="Students by tenant" description="Enrolment count per organisation">
              {data.by_tenant.length === 0 ? (
                <p className="stu-muted">No student roles assigned yet.</p>
              ) : (
                <div className="stu-table-wrap">
                  <table className="stu-table">
                    <thead>
                      <tr>
                        <th>Tenant</th>
                        <th>Slug</th>
                        <th>Students</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.by_tenant.map((row) => (
                        <tr key={row.tenant_id}>
                          <td>
                            <strong>{row.tenant_name ?? `Tenant #${row.tenant_id}`}</strong>
                          </td>
                          <td>
                            <code className="stu-code">{row.tenant_slug ?? '—'}</code>
                          </td>
                          <td>
                            <strong>{row.students.toLocaleString()}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel title="Recent students" description="Latest student role assignments">
              {data.recent.length === 0 ? (
                <p className="stu-muted">No recent student enrolments.</p>
              ) : (
                <div className="stu-table-wrap">
                  <table className="stu-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Tenant</th>
                        <th>Status</th>
                        <th>Last login</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recent.map((row) => (
                        <tr key={`${row.user_id}-${row.tenant?.id ?? 0}`}>
                          <td>
                            <strong>{row.name.trim() || row.email || '—'}</strong>
                            {row.email && row.name.trim() ? (
                              <div className="stu-sub">{row.email}</div>
                            ) : null}
                          </td>
                          <td>
                            <strong>{row.tenant?.name ?? '—'}</strong>
                            <div className="stu-sub">{row.tenant?.slug}</div>
                          </td>
                          <td>
                            {row.status ? (
                              <span className={`stu-pill status-${row.status}`}>
                                {statusLabel(row.status)}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>
                            {row.last_login_at
                              ? new Date(row.last_login_at).toLocaleString()
                              : 'Never'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>

          <div className="stu-quick-links">
            <Link to="/reports/revenue">Revenue report</Link>
            <Link to="/reports/schools">Schools report</Link>
            <Link to="/reports/usage">Usage report</Link>
            <Link to="/dashboard/revenue">Revenue dashboard</Link>
          </div>

          <p className="stu-generated">
            Generated {new Date(data.generated_at).toLocaleString()}
          </p>
        </>
      ) : null}
      <style>{stuStyles}</style>
    </div>
  );
}

const stuStyles = `
.stu-page { display: grid; gap: 1rem; }
.stu-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(200px, 0.7fr);
  gap: 1.25rem;
  align-items: end;
  padding: 1.25rem 1.35rem;
  border-radius: 18px;
  border: 1px solid var(--stem-line);
  background:
    radial-gradient(120% 90% at 100% 0%, rgba(18, 160, 171, 0.1), transparent 55%),
    linear-gradient(145deg, #f4faf9, #eef4f2);
}
.stu-eyebrow {
  margin: 0 0 0.3rem;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--stem-teal-deep);
}
.stu-hero-title {
  margin: 0 0 0.35rem;
  font-family: var(--stem-font-display);
  font-size: clamp(1.35rem, 1.8vw, 1.55rem);
  letter-spacing: -0.03em;
}
.stu-hero-lead {
  margin: 0;
  color: var(--stem-ink-soft);
  line-height: 1.5;
  max-width: 42rem;
  font-size: var(--stem-text-base);
}
.stu-hero-actions { display: grid; gap: 0.75rem; }
.stu-action-row { display: flex; flex-wrap: wrap; gap: 0.45rem; justify-content: flex-end; }
.stu-alert {
  display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;
  padding: 0.85rem 1rem; border-radius: 12px; background: #fef3f2; color: var(--stem-danger);
  border: 1px solid #fecdca;
}
.stu-muted { margin: 0; color: var(--stem-ink-soft); }
.stu-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}
.stu-table-wrap { overflow-x: auto; }
.stu-table {
  width: 100%; border-collapse: collapse; font-size: var(--stem-text-base); min-width: 320px;
}
.stu-table th {
  text-align: left; padding: 0.55rem 0.4rem; border-bottom: 1px solid var(--stem-line);
  font-size: var(--stem-text-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--stem-ink-soft);
}
.stu-table td {
  padding: 0.7rem 0.4rem; border-bottom: 1px solid var(--stem-line); vertical-align: middle;
}
.stu-sub { font-size: var(--stem-text-sm); color: var(--stem-ink-soft); margin-top: 0.15rem; }
.stu-code {
  font-size: var(--stem-text-sm); background: var(--stem-mint-soft); padding: 0.15rem 0.4rem; border-radius: 6px;
}
.stu-pill {
  display: inline-flex; padding: 0.18rem 0.5rem; border-radius: 999px; font-size: var(--stem-text-xs);
  font-weight: 700; border: 1px solid transparent;
}
.stu-pill.status-active { background: #ecfdf3; color: #067647; border-color: #abefc6; }
.stu-pill.status-inactive { background: #f5f5f5; color: #525252; border-color: #e5e5e5; }
.stu-pill.status-pending { background: #eff8ff; color: #175cd3; border-color: #b2ddff; }
.stu-quick-links {
  display: flex; flex-wrap: wrap; gap: 0.65rem;
}
.stu-quick-links a {
  color: var(--stem-teal-deep); font-weight: 600; font-size: var(--stem-text-md); text-decoration: none;
}
.stu-quick-links a:hover { text-decoration: underline; }
.stu-generated {
  margin: 0; font-size: var(--stem-text-sm); color: var(--stem-ink-soft); text-align: right;
}
@media (max-width: 960px) {
  .stu-hero, .stu-grid-2 { grid-template-columns: 1fr; }
  .stu-action-row { justify-content: flex-start; }
}
`;
