import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import { Button, Panel, StatStrip, downloadExcelCsv, exportPdfDocument, useFeedback } from '@stemora/ui';
import { ControlLayout } from '../../layout/ControlLayout';

type HealthStatus = 'ok' | 'warn' | 'degraded' | 'critical';

type HealthCheck = {
  id: string;
  label: string;
  status: HealthStatus;
  message: string;
  detail: Record<string, unknown>;
  latency_ms: number;
};

type SystemHealth = {
  overall: HealthStatus;
  summary: {
    total_checks: number;
    ok: number;
    warn: number;
    critical: number;
    avg_latency_ms: number;
  };
  checks: HealthCheck[];
  runtime: {
    app_name: string;
    env: string;
    debug: boolean;
    url: string;
    timezone: string;
    locale: string;
    php_version: string;
    laravel_version: string;
    api_version: string;
    queue_connection: string;
    cache_store: string;
    session_driver: string;
    mail_mailer: string;
    filesystem_disk: string;
  };
  platform: {
    tenants: number;
    tenants_active: number;
    tenants_trial: number;
    tenants_suspended: number;
    schools: number;
    users: number;
  };
  failed_jobs: {
    id: number | string;
    uuid: string;
    queue: string;
    job: string;
    error: string;
    failed_at: string | null;
  }[];
  queue_stats: { pending: number; failed: number; batches: number };
  generated_at: string;
};

function overallLabel(status: HealthStatus) {
  if (status === 'ok') return 'Healthy';
  if (status === 'critical') return 'Critical';
  return 'Degraded';
}

function detailValue(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function SystemHealthPage() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [data, setData] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: SystemHealth }>('/control/analytics/system-health');
      setData(res.data);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Could not load system health.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => {
      void load();
    }, 30000);
    return () => window.clearInterval(id);
  }, [autoRefresh, load]);

  async function runExport(kind: 'excel' | 'pdf') {
    if (!data) return;
    setExporting(true);
    try {
      if (kind === 'excel') {
        downloadExcelCsv(
          `system-health-${new Date().toISOString().slice(0, 10)}`,
          ['Section', 'Metric', 'Value'],
          [
            ['Overall', 'status', data.overall],
            ...Object.entries(data.summary).map(([k, v]) => ['Summary', k, v]),
            ...data.checks.flatMap((c) => [
              ['Check', c.label, `${c.status} · ${c.message} · ${c.latency_ms}ms`],
              ...Object.entries(c.detail).map(([k, v]) => [`Check:${c.id}`, k, detailValue(v)]),
            ]),
            ...Object.entries(data.runtime).map(([k, v]) => ['Runtime', k, detailValue(v)]),
            ...Object.entries(data.platform).map(([k, v]) => ['Platform', k, v]),
            ...data.failed_jobs.map((j) => ['Failed job', j.job, j.error]),
          ],
        );
      } else {
        const kpi = [
          ['Overall', overallLabel(data.overall)],
          ['OK checks', data.summary.ok],
          ['Warnings', data.summary.warn],
          ['Critical', data.summary.critical],
        ]
          .map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`)
          .join('');
        const checkRows = data.checks
          .map(
            (c) =>
              `<tr><td>${c.label}</td><td>${c.status}</td><td>${c.message}</td><td>${c.latency_ms} ms</td></tr>`,
          )
          .join('');
        exportPdfDocument({
          title: 'System Health',
          subtitle: `${data.runtime.app_name} · ${data.runtime.env}`,
          bodyHtml: `<div class="kpi">${kpi}</div>
            <h2>Component checks</h2>
            <table><thead><tr><th>Check</th><th>Status</th><th>Message</th><th>Latency</th></tr></thead>
            <tbody>${checkRows}</tbody></table>`,
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
        message: err instanceof Error ? err.message : 'Could not export system health.',
        confirmLabel: 'OK',
        cancelLabel: 'Close',
        tone: 'warn',
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <ControlLayout
      title="System Health"
      subtitle="Infrastructure checks, queue status, and runtime configuration"
    >
      <div className="hlth-page">
        <section className={`hlth-hero stem-animate-rise is-${data?.overall ?? 'ok'}`}>
          <div>
            <p className="hlth-eyebrow">Control · Platform operations</p>
            <h2 className="hlth-hero-title">System health</h2>
            <p className="hlth-hero-lead">
              Live probes for database, cache, storage, queue, mail, and auth tokens. Re-run checks
              any time or enable auto-refresh for continuous monitoring.
            </p>
            {data ? (
              <div className="hlth-overall">
                <StatusPill status={data.overall} large />
                <span>
                  {data.summary.ok}/{data.summary.total_checks} checks healthy · avg{' '}
                  {data.summary.avg_latency_ms} ms
                </span>
              </div>
            ) : null}
          </div>
          <div className="hlth-hero-actions">
            <label className="hlth-toggle">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              <span>Auto-refresh every 30s</span>
            </label>
            <div className="hlth-action-row">
              <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
                {loading ? 'Checking…' : 'Run checks'}
              </Button>
              <Button size="sm"
                type="button"
                variant="secondary"
                disabled={!data || exporting}
                onClick={() => void runExport('excel')}
              >
                Export Excel
              </Button>
              <Button size="sm"
                type="button"
                variant="primary"
                disabled={!data || exporting}
                onClick={() => void runExport('pdf')}
              >
                Download PDF
              </Button>
            </div>
          </div>
        </section>

        {error ? (
          <div className="hlth-alert" role="alert">
            <span>{error}</span>
            <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : null}

        {loading && !data ? <p className="hlth-muted">Running system health checks…</p> : null}

        {data ? (
          <>
            <StatStrip
              items={[
                {
                  label: 'Overall',
                  value: overallLabel(data.overall),
                  hint: `${data.summary.total_checks} probes`,
                },
                { label: 'Healthy', value: String(data.summary.ok), hint: 'Passing checks' },
                { label: 'Warnings', value: String(data.summary.warn), hint: 'Needs attention' },
                {
                  label: 'Critical',
                  value: String(data.summary.critical),
                  hint: 'Immediate action',
                },
                {
                  label: 'Queue pending',
                  value: String(data.queue_stats.pending),
                  hint: `${data.queue_stats.failed} failed`,
                },
                {
                  label: 'Avg latency',
                  value: `${data.summary.avg_latency_ms} ms`,
                  hint: 'Probe response time',
                },
              ]}
            />

            <Panel title="Component checks" description="Timed probes across core platform dependencies">
              <div className="hlth-check-grid">
                {data.checks.map((check) => (
                  <article key={check.id} className={`hlth-check is-${check.status}`}>
                    <div className="hlth-check-top">
                      <strong>{check.label}</strong>
                      <StatusPill status={check.status} />
                    </div>
                    <p>{check.message}</p>
                    <div className="hlth-check-meta">
                      <span>{check.latency_ms} ms</span>
                      <span>{check.id}</span>
                    </div>
                    {Object.keys(check.detail).length ? (
                      <dl className="hlth-detail">
                        {Object.entries(check.detail).map(([key, value]) => (
                          <div key={key}>
                            <dt>{key.replace(/_/g, ' ')}</dt>
                            <dd>{detailValue(value)}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </article>
                ))}
              </div>
            </Panel>

            <div className="hlth-grid-2">
              <Panel title="Runtime" description="Application and infrastructure configuration">
                <div className="hlth-table-wrap">
                  <table className="hlth-table">
                    <tbody>
                      {(
                        [
                          ['Application', data.runtime.app_name],
                          ['Environment', data.runtime.env],
                          ['Debug', data.runtime.debug ? 'On' : 'Off'],
                          ['URL', data.runtime.url],
                          ['Timezone', data.runtime.timezone],
                          ['Locale', data.runtime.locale],
                          ['PHP', data.runtime.php_version],
                          ['Laravel', data.runtime.laravel_version],
                          ['API version', data.runtime.api_version],
                          ['Queue', data.runtime.queue_connection],
                          ['Cache', data.runtime.cache_store],
                          ['Sessions', data.runtime.session_driver],
                          ['Mail', data.runtime.mail_mailer],
                          ['Filesystem', data.runtime.filesystem_disk],
                        ] as [string, string][]
                      ).map(([label, value]) => (
                        <tr key={label}>
                          <th>{label}</th>
                          <td>{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>

              <Panel title="Platform snapshot" description="Live tenant and user footprint">
                <div className="hlth-platform-grid">
                  {(
                    [
                      ['Tenants', data.platform.tenants],
                      ['Active', data.platform.tenants_active],
                      ['Trial', data.platform.tenants_trial],
                      ['Suspended', data.platform.tenants_suspended],
                      ['Schools', data.platform.schools],
                      ['Users', data.platform.users],
                    ] as [string, number][]
                  ).map(([label, value]) => (
                    <div key={label} className="hlth-platform-card">
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
                <div className="hlth-queue-strip">
                  <div>
                    <span>Pending jobs</span>
                    <strong>{data.queue_stats.pending}</strong>
                  </div>
                  <div>
                    <span>Failed jobs</span>
                    <strong>{data.queue_stats.failed}</strong>
                  </div>
                  <div>
                    <span>Batches</span>
                    <strong>{data.queue_stats.batches}</strong>
                  </div>
                </div>
              </Panel>
            </div>

            <Panel title="Recent failed jobs" description="Latest queue failures across the platform">
              {data.failed_jobs.length === 0 ? (
                <p className="hlth-muted">No failed jobs recorded. Queue is clear.</p>
              ) : (
                <div className="hlth-table-wrap">
                  <table className="hlth-table is-wide">
                    <thead>
                      <tr>
                        <th>Job</th>
                        <th>Queue</th>
                        <th>Error</th>
                        <th>When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.failed_jobs.slice(0, 5).map((job) => (
                        <tr key={String(job.id)}>
                          <td>
                            <strong>{job.job}</strong>
                            <div className="hlth-sub">{job.uuid}</div>
                          </td>
                          <td>{job.queue || '—'}</td>
                          <td className="hlth-error">{job.error}</td>
                          <td>
                            {job.failed_at ? new Date(job.failed_at).toLocaleString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="hlth-quick-links">
                <Link to="/">Platform dashboard</Link>
                <Link to="/dashboard/saas-analytics">SaaS analytics</Link>
                <Link to="/dashboard/revenue">Revenue dashboard</Link>
                <Link to="/tenants">Schools</Link>
              </div>
            </Panel>

            <p className="hlth-generated">
              Generated {new Date(data.generated_at).toLocaleString()}
              {autoRefresh ? ' · Auto-refresh on' : ''}
            </p>
          </>
        ) : null}
      </div>
      <style>{hlthStyles}</style>
    </ControlLayout>
  );
}

function StatusPill({ status, large }: { status: HealthStatus; large?: boolean }) {
  const label =
    status === 'ok' ? 'Healthy' : status === 'critical' ? 'Critical' : status === 'warn' ? 'Warning' : 'Degraded';
  return <span className={`hlth-pill is-${status} ${large ? 'is-large' : ''}`}>{label}</span>;
}

const hlthStyles = `
.hlth-page { display: grid; gap: 1rem; }
.hlth-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(240px, 0.85fr);
  gap: 1.25rem;
  align-items: end;
  padding: 1.25rem 1.35rem;
  border-radius: 18px;
  border: 1px solid var(--stem-line);
  background:
    radial-gradient(120% 90% at 100% 0%, rgba(18, 160, 171, 0.12), transparent 55%),
    linear-gradient(145deg, #f4faf8, #eef5f2);
}
.hlth-hero.is-degraded, .hlth-hero.is-warn {
  background:
    radial-gradient(120% 90% at 100% 0%, rgba(233, 137, 69, 0.14), transparent 55%),
    linear-gradient(145deg, #fff8f1, #f7f3ec);
}
.hlth-hero.is-critical {
  background:
    radial-gradient(120% 90% at 100% 0%, rgba(180, 35, 24, 0.12), transparent 55%),
    linear-gradient(145deg, #fff5f4, #f8eceb);
}
.hlth-eyebrow {
  margin: 0 0 0.3rem;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--stem-teal-deep);
}
.hlth-hero-title {
  margin: 0 0 0.35rem;
  font-family: var(--stem-font-display);
  font-size: clamp(1.35rem, 1.8vw, 1.55rem);
  letter-spacing: -0.03em;
}
.hlth-hero-lead {
  margin: 0;
  color: var(--stem-ink-soft);
  line-height: 1.5;
  max-width: 42rem;
  font-size: var(--stem-text-base);
}
.hlth-overall {
  display: flex; flex-wrap: wrap; gap: 0.65rem; align-items: center;
  margin-top: 0.9rem; color: var(--stem-ink-soft); font-size: var(--stem-text-md);
}
.hlth-hero-actions { display: grid; gap: 0.75rem; justify-items: end; }
.hlth-toggle {
  display: inline-flex; align-items: center; gap: 0.45rem;
  font-size: var(--stem-text-md); color: var(--stem-ink-soft); cursor: pointer; user-select: none;
}
.hlth-toggle input { accent-color: var(--stem-teal); width: 1rem; height: 1rem; }
.hlth-action-row { display: flex; flex-wrap: wrap; gap: 0.45rem; justify-content: flex-end; }
.hlth-alert {
  display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;
  padding: 0.85rem 1rem; border-radius: 12px; background: #fef3f2; color: var(--stem-danger);
  border: 1px solid #fecdca;
}
.hlth-muted { margin: 0; color: var(--stem-ink-soft); }
.hlth-check-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.85rem;
}
.hlth-check {
  display: grid; gap: 0.45rem;
  padding: 0.95rem 1rem;
  border-radius: 14px;
  border: 1px solid var(--stem-line);
  background: linear-gradient(165deg, #fff, var(--stem-mint-soft));
}
.hlth-check.is-warn, .hlth-check.is-degraded {
  background: linear-gradient(165deg, #fff, #fff6eb);
  border-color: rgba(233, 137, 69, 0.28);
}
.hlth-check.is-critical {
  background: linear-gradient(165deg, #fff, #fff1f0);
  border-color: rgba(180, 35, 24, 0.22);
}
.hlth-check-top {
  display: flex; justify-content: space-between; gap: 0.5rem; align-items: center;
}
.hlth-check p { margin: 0; color: var(--stem-ink-soft); font-size: var(--stem-text-md); line-height: 1.4; }
.hlth-check-meta {
  display: flex; justify-content: space-between; gap: 0.5rem;
  font-size: var(--stem-text-xs); color: var(--stem-ink-soft); text-transform: uppercase; letter-spacing: 0.04em;
}
.hlth-detail {
  margin: 0.25rem 0 0; padding-top: 0.55rem; border-top: 1px solid rgba(10,31,43,0.08);
  display: grid; gap: 0.35rem;
}
.hlth-detail > div {
  display: grid; grid-template-columns: 1fr auto; gap: 0.75rem; align-items: start;
  font-size: var(--stem-text-sm);
}
.hlth-detail dt { color: var(--stem-ink-soft); text-transform: capitalize; }
.hlth-detail dd { margin: 0; font-weight: 600; text-align: right; word-break: break-word; }
.hlth-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}
.hlth-table-wrap { overflow-x: auto; }
.hlth-table {
  width: 100%; border-collapse: collapse; font-size: var(--stem-text-base);
}
.hlth-table.is-wide { min-width: 640px; }
.hlth-table th, .hlth-table td {
  padding: 0.65rem 0.4rem; border-bottom: 1px solid var(--stem-line); vertical-align: top; text-align: left;
}
.hlth-table tbody th {
  width: 38%; color: var(--stem-ink-soft); font-weight: 600; font-size: var(--stem-text-md);
}
.hlth-table thead th {
  font-size: var(--stem-text-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--stem-ink-soft);
}
.hlth-platform-grid {
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.65rem;
}
.hlth-platform-card {
  display: grid; gap: 0.2rem; padding: 0.75rem 0.8rem; border-radius: 12px;
  border: 1px solid var(--stem-line); background: #fff;
  min-width: 0; max-width: 100%; overflow-wrap: anywhere;
}
.hlth-platform-card span {
  font-size: var(--stem-text-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--stem-ink-soft);
  overflow-wrap: anywhere;
}
.hlth-platform-card strong {
  font-family: var(--stem-font-display); font-size: var(--stem-text-2xl);
  overflow-wrap: anywhere; word-break: break-word; min-width: 0;
}
.hlth-queue-strip {
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.65rem;
  margin-top: 0.85rem;
}
.hlth-queue-strip > div {
  display: grid; gap: 0.15rem; padding: 0.7rem 0.75rem; border-radius: 12px;
  background: var(--stem-mint-soft); border: 1px solid var(--stem-line);
}
.hlth-queue-strip span { font-size: var(--stem-text-xs); color: var(--stem-ink-soft); }
.hlth-queue-strip strong { font-size: var(--stem-text-xl); }
.hlth-sub { font-size: var(--stem-text-xs); color: var(--stem-ink-soft); margin-top: 0.15rem; word-break: break-all; }
.hlth-error { font-size: var(--stem-text-md); color: var(--stem-ink-soft); max-width: 28rem; }
.hlth-pill {
  display: inline-flex; padding: 0.18rem 0.55rem; border-radius: 999px; font-size: var(--stem-text-xs);
  font-weight: 700; border: 1px solid transparent;
}
.hlth-pill.is-large { font-size: var(--stem-text-md); padding: 0.28rem 0.7rem; }
.hlth-pill.is-ok { background: #ecfdf3; color: #067647; border-color: #abefc6; }
.hlth-pill.is-warn, .hlth-pill.is-degraded { background: #fff6eb; color: #b54708; border-color: #f9dbaf; }
.hlth-pill.is-critical { background: #fef3f2; color: #b42318; border-color: #fecdca; }
.hlth-quick-links {
  display: flex; flex-wrap: wrap; gap: 0.65rem; margin-top: 1rem; padding-top: 0.85rem;
  border-top: 1px solid var(--stem-line);
}
.hlth-quick-links a {
  color: var(--stem-teal-deep); font-weight: 600; font-size: var(--stem-text-md); text-decoration: none;
}
.hlth-quick-links a:hover { text-decoration: underline; }
.hlth-generated {
  margin: 0; font-size: var(--stem-text-sm); color: var(--stem-ink-soft); text-align: right;
}
@media (max-width: 960px) {
  .hlth-hero, .hlth-grid-2 { grid-template-columns: 1fr; }
  .hlth-hero-actions { justify-items: start; }
  .hlth-action-row { justify-content: flex-start; }
  .hlth-platform-grid, .hlth-queue-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`;
