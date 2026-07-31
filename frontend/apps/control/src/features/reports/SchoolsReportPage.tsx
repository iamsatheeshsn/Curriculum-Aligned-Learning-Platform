import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import {
  Button,
  Panel,
  SelectField,
  StatStrip,
  TextField,
  downloadExcelCsv,
  exportPdfDocument,
  useFeedback,
} from '@stemora/ui';
import { ControlLayout } from '../../layout/ControlLayout';
import { statusLabel } from '../../types';

type SchoolRow = {
  id: number;
  code: string;
  name_en: string;
  name_ar: string;
  status: string;
  timezone: string | null;
  tenant: { id: number; name: string; slug: string; status: string } | null;
};

type SchoolsReport = {
  summary: {
    total_schools: number;
    active: number;
    inactive: number;
    tenants_with_schools: number;
  };
  schools: SchoolRow[];
  generated_at: string;
};

export function SchoolsReportPage() {
  const { isSuperAdmin, hasPermission } = useAuth();
  if (!isSuperAdmin && !hasPermission(['platform.tenants.manage', 'nav.control.reports'])) {
    return <Navigate to="/" replace />;
  }

  return (
    <ControlLayout
      title="Schools Report"
      subtitle="Exportable overview of school organisations across all tenants"
    >
      <SchoolsReportWorkspace />
    </ControlLayout>
  );
}

function SchoolsReportWorkspace() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [data, setData] = useState<SchoolsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      const qs = params.toString();
      const res = await api.get<{ data: SchoolsReport }>(
        `/control/reports/schools${qs ? `?${qs}` : ''}`,
      );
      setData(res.data);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Could not load schools report.');
    } finally {
      setLoading(false);
    }
  }, [api, search, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, search ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [load, search]);

  const filteredSchools = useMemo(() => data?.schools ?? [], [data]);

  async function runExport(kind: 'excel' | 'pdf') {
    if (!data) return;
    setExporting(true);
    try {
      if (kind === 'excel') {
        downloadExcelCsv(
          'schools-report',
          ['Code', 'Name (EN)', 'Name (AR)', 'Status', 'Timezone', 'Tenant', 'Tenant slug'],
          filteredSchools.map((row) => [
            row.code,
            row.name_en,
            row.name_ar,
            row.status,
            row.timezone ?? '',
            row.tenant?.name ?? '',
            row.tenant?.slug ?? '',
          ]),
        );
      } else {
        const summaryCells = [
          ['Total schools', data.summary.total_schools],
          ['Active', data.summary.active],
          ['Inactive', data.summary.inactive],
          ['Tenants with schools', data.summary.tenants_with_schools],
        ]
          .map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`)
          .join('');
        const tableRows = filteredSchools
          .map(
            (row) =>
              `<tr><td>${row.code}</td><td>${row.name_en}</td><td>${statusLabel(row.status)}</td><td>${row.tenant?.name ?? '—'}</td></tr>`,
          )
          .join('');
        exportPdfDocument({
          title: 'Schools Report',
          subtitle: `${filteredSchools.length} schools listed`,
          bodyHtml: `<div class="kpi">${summaryCells}</div>
            <h2>Schools</h2>
            <table><thead><tr><th>Code</th><th>Name</th><th>Status</th><th>Tenant</th></tr></thead><tbody>${tableRows || '<tr><td colspan="4">No schools</td></tr>'}</tbody></table>`,
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
        message: err instanceof Error ? err.message : 'Could not export schools report.',
        confirmLabel: 'OK',
        cancelLabel: 'Close',
        tone: 'warn',
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="sr-page">
      <section className="sr-hero stem-animate-rise">
        <div>
          <p className="sr-eyebrow">Control · Reports</p>
          <h2 className="sr-hero-title">Schools report</h2>
          <p className="sr-hero-lead">
            Every school organisation registered on the platform, grouped by tenant. Search, filter
            by status, and export for operational reviews.
          </p>
        </div>
        <div className="sr-hero-actions">
          <div className="sr-filter-row">
            <TextField
              label="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or code…"
            />
            <SelectField
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </SelectField>
          </div>
          <div className="sr-action-row">
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
        <div className="sr-alert" role="alert">
          <span>{error}</span>
          <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : null}

      {loading && !data ? <p className="sr-muted">Loading schools report…</p> : null}

      {data ? (
        <>
          <StatStrip
            items={[
              { label: 'Total schools', value: String(data.summary.total_schools) },
              { label: 'Active', value: String(data.summary.active) },
              { label: 'Inactive', value: String(data.summary.inactive) },
              {
                label: 'Tenants',
                value: String(data.summary.tenants_with_schools),
                hint: 'With at least one school',
              },
            ]}
          />

          <Panel
            title="Schools"
            description={`${filteredSchools.length} schools${search ? ` matching "${search}"` : ''}`}
          >
            {filteredSchools.length === 0 ? (
              <p className="sr-muted">No schools match your filters.</p>
            ) : (
              <div className="sr-table-wrap">
                <table className="sr-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>School</th>
                      <th>Status</th>
                      <th>Timezone</th>
                      <th>Tenant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSchools.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <code className="sr-code">{row.code}</code>
                        </td>
                        <td>
                          <strong>{row.name_en}</strong>
                          {row.name_ar ? <div className="sr-sub">{row.name_ar}</div> : null}
                        </td>
                        <td>
                          <StatusPill status={row.status} />
                        </td>
                        <td>{row.timezone ?? '—'}</td>
                        <td>
                          <strong>{row.tenant?.name ?? '—'}</strong>
                          <div className="sr-sub">{row.tenant?.slug}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="sr-quick-links">
              <Link to="/reports/revenue">Revenue report</Link>
              <Link to="/reports/students">Students report</Link>
              <Link to="/reports/usage">Usage report</Link>
              <Link to="/dashboard/revenue">Revenue dashboard</Link>
            </div>
          </Panel>

          <p className="sr-generated">
            Generated {new Date(data.generated_at).toLocaleString()}
          </p>
        </>
      ) : null}
      <style>{srStyles}</style>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`sr-pill status-${status}`}>{statusLabel(status)}</span>;
}

const srStyles = `
.sr-page { display: grid; gap: 1rem; }
.sr-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(260px, 0.9fr);
  gap: 1.25rem;
  align-items: end;
  padding: 1.25rem 1.35rem;
  border-radius: 18px;
  border: 1px solid var(--stem-line);
  background:
    radial-gradient(120% 90% at 100% 0%, rgba(18, 160, 171, 0.12), transparent 55%),
    linear-gradient(145deg, #f3faf8, #eef5f2);
}
.sr-eyebrow {
  margin: 0 0 0.3rem;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--stem-teal-deep);
}
.sr-hero-title {
  margin: 0 0 0.35rem;
  font-family: var(--stem-font-display);
  font-size: clamp(1.35rem, 1.8vw, 1.55rem);
  letter-spacing: -0.03em;
}
.sr-hero-lead {
  margin: 0;
  color: var(--stem-ink-soft);
  line-height: 1.5;
  max-width: 42rem;
  font-size: var(--stem-text-base);
}
.sr-hero-actions { display: grid; gap: 0.75rem; }
.sr-filter-row { display: grid; grid-template-columns: 1fr 140px; gap: 0.65rem; }
.sr-action-row { display: flex; flex-wrap: wrap; gap: 0.45rem; justify-content: flex-end; }
.sr-alert {
  display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;
  padding: 0.85rem 1rem; border-radius: 12px; background: #fef3f2; color: var(--stem-danger);
  border: 1px solid #fecdca;
}
.sr-muted { margin: 0; color: var(--stem-ink-soft); }
.sr-table-wrap { overflow-x: auto; }
.sr-table {
  width: 100%; border-collapse: collapse; font-size: var(--stem-text-base); min-width: 480px;
}
.sr-table th {
  text-align: left; padding: 0.55rem 0.4rem; border-bottom: 1px solid var(--stem-line);
  font-size: var(--stem-text-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--stem-ink-soft);
}
.sr-table td {
  padding: 0.7rem 0.4rem; border-bottom: 1px solid var(--stem-line); vertical-align: middle;
}
.sr-sub { font-size: var(--stem-text-sm); color: var(--stem-ink-soft); margin-top: 0.15rem; }
.sr-code {
  font-size: var(--stem-text-sm); background: var(--stem-mint-soft); padding: 0.15rem 0.4rem; border-radius: 6px;
}
.sr-pill {
  display: inline-flex; padding: 0.18rem 0.5rem; border-radius: 999px; font-size: var(--stem-text-xs);
  font-weight: 700; border: 1px solid transparent;
}
.sr-pill.status-active { background: #ecfdf3; color: #067647; border-color: #abefc6; }
.sr-pill.status-inactive { background: #f5f5f5; color: #525252; border-color: #e5e5e5; }
.sr-quick-links {
  display: flex; flex-wrap: wrap; gap: 0.65rem; margin-top: 1rem; padding-top: 0.85rem;
  border-top: 1px solid var(--stem-line);
}
.sr-quick-links a {
  color: var(--stem-teal-deep); font-weight: 600; font-size: var(--stem-text-md); text-decoration: none;
}
.sr-quick-links a:hover { text-decoration: underline; }
.sr-generated {
  margin: 0; font-size: var(--stem-text-sm); color: var(--stem-ink-soft); text-align: right;
}
@media (max-width: 960px) {
  .sr-hero { grid-template-columns: 1fr; }
  .sr-filter-row { grid-template-columns: 1fr; }
  .sr-action-row { justify-content: flex-start; }
}
`;
