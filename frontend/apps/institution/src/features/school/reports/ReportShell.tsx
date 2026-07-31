import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import { Button, Panel, PortalShell, useFeedback } from '@stemora/ui';
import { useInstitutionNav } from '../../../nav';
import { REPORT_MENU, type ReportMeta } from './reportUtils';

export function useReportMeta() {
  const { api } = useAuth();
  const [meta, setMeta] = useState<ReportMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: ReportMeta }>('/org/reports/meta');
      setMeta(res.data);
    } catch (e) {
      setMeta(null);
      setError(e instanceof Error ? e.message : 'Could not load report filters.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  return { meta, loading, error, reload: load };
}

export function ReportPageShell({
  title,
  subtitle,
  children,
  filters,
  onExportExcel,
  onExportPdf,
  exporting,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  filters?: ReactNode;
  onExportExcel?: () => void;
  onExportPdf?: () => void;
  exporting?: boolean;
}) {
  const { tenantSlug = 'al-noor' } = useParams();
  const { session, logout } = useAuth();
  const feedback = useFeedback();
  const nav = useInstitutionNav(tenantSlug);

  async function runExport(kind: 'excel' | 'pdf') {
    try {
      if (kind === 'excel') {
        onExportExcel?.();
        await feedback.success({
          title: 'Excel ready',
          message: 'Your spreadsheet download has started.',
        });
      } else {
        onExportPdf?.();
      }
    } catch (e) {
      await feedback.confirm({
        title: 'Export failed',
        message: e instanceof Error ? e.message : 'Could not export this report.',
        confirmLabel: 'OK',
        cancelLabel: 'Close',
        tone: 'warn',
      });
    }
  }

  return (
    <PortalShell
      portal="institution"
      brandCaption="Institution portal"
      title={title}
      subtitle={subtitle}
      nav={nav}
      userLabel={session?.user.email}
      userName={session?.user.name}
      onLogout={logout}
      changePasswordTo={`/${tenantSlug}/change-password`}
      collapsible
      headerActions={
        <div className="rpt-header-actions">
          {onExportExcel ? (
            <Button size="sm"
              type="button"
              variant="secondary"
              disabled={exporting}
              onClick={() => void runExport('excel')}
            >
              Export Excel
            </Button>
          ) : null}
          {onExportPdf ? (
            <Button size="sm"
              type="button"
              variant="primary"
              disabled={exporting}
              onClick={() => void runExport('pdf')}
            >
              Download PDF
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="rpt-page">
        <nav className="rpt-crumbs" aria-label="Report navigation">
          <Link to={`/${tenantSlug}/reports`}>Reports</Link>
          <span aria-hidden>/</span>
          <span>{title}</span>
        </nav>

        {filters ? (
          <Panel title="Filters" description="Narrow the dataset before exporting.">
            <div className="rpt-filters">{filters}</div>
          </Panel>
        ) : null}

        {children}
      </div>
      <style>{reportStyles}</style>
    </PortalShell>
  );
}

export function ReportsHubPage() {
  const { tenantSlug = 'al-noor' } = useParams();
  const { session, logout } = useAuth();
  const nav = useInstitutionNav(tenantSlug);

  return (
    <PortalShell
      portal="institution"
      brandCaption="Institution portal"
      title="Reports"
      subtitle="Academic, tutoring, and school performance analytics"
      nav={nav}
      userLabel={session?.user.email}
      userName={session?.user.name}
      onLogout={logout}
      changePasswordTo={`/${tenantSlug}/change-password`}
      collapsible
    >
      <div className="rpt-page">
        <section className="rpt-hero stem-animate-rise">
          <div>
            <p className="rpt-eyebrow">Institution analytics</p>
            <h2 className="rpt-hero-title">Reports workspace</h2>
            <p className="rpt-hero-lead">
              Open a report below to review live school data, then export to Excel or PDF for
              leadership reviews and parent conferences.
            </p>
          </div>
          <div className="rpt-hero-aside" aria-hidden>
            <strong>6</strong>
            <span>live report views</span>
          </div>
        </section>

        <div className="rpt-card-grid">
          {REPORT_MENU.map((item) => (
            <Link
              key={item.slug}
              to={`/${tenantSlug}/reports/${item.slug}`}
              className="rpt-card stem-animate-fade"
            >
              <strong>{item.label}</strong>
              <span>{item.description}</span>
              <em>Open report →</em>
            </Link>
          ))}
        </div>
      </div>
      <style>{reportStyles}</style>
    </PortalShell>
  );
}

const reportStyles = `
.rpt-page { display: grid; gap: 1rem; }
.rpt-header-actions { display: flex; flex-wrap: wrap; gap: 0.45rem; justify-content: flex-end; }
.rpt-crumbs {
  display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center;
  font-size: var(--stem-text-md); color: var(--stem-ink-soft);
}
.rpt-crumbs a { color: var(--stem-teal-deep); text-decoration: none; font-weight: 600; }
.rpt-crumbs a:hover { text-decoration: underline; }
.rpt-filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.85rem;
  align-items: end;
}
.rpt-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 1rem;
  padding: 1.35rem 1.4rem;
  border-radius: 18px;
  border: 1px solid var(--stem-line);
  background:
    radial-gradient(120% 80% at 100% 0%, rgba(46, 125, 98, 0.12), transparent 55%),
    linear-gradient(145deg, #f4faf7, #eef5f1 55%, #f7fbf9);
}
.rpt-eyebrow {
  margin: 0 0 0.35rem;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--stem-teal-deep);
  font-weight: 700;
}
.rpt-hero-title {
  margin: 0 0 0.4rem;
  font-size: clamp(1.45rem, 2.4vw, 1.85rem);
  letter-spacing: -0.03em;
  color: var(--stem-ink);
}
.rpt-hero-lead {
  margin: 0;
  max-width: 42rem;
  color: var(--stem-ink-soft);
  line-height: 1.55;
  font-size: var(--stem-text-base);
}
.rpt-hero-aside {
  align-self: center;
  min-width: 120px;
  padding: 1rem 1.1rem;
  border-radius: 14px;
  background: rgba(255,255,255,0.72);
  border: 1px solid rgba(46, 125, 98, 0.18);
  text-align: center;
}
.rpt-hero-aside strong {
  display: block;
  font-size: 2rem;
  line-height: 1;
  color: var(--stem-teal-deep);
}
.rpt-hero-aside span { font-size: var(--stem-text-sm); color: var(--stem-ink-soft); }
.rpt-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 0.85rem;
}
.rpt-card {
  display: grid;
  gap: 0.45rem;
  padding: 1.05rem 1.1rem;
  border-radius: 14px;
  border: 1px solid var(--stem-line);
  background: #fff;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}
.rpt-card:hover {
  border-color: rgba(46, 125, 98, 0.35);
  transform: translateY(-2px);
  box-shadow: 0 10px 24px rgba(20, 35, 28, 0.06);
}
.rpt-card strong { font-size: 1rem; color: var(--stem-ink); }
.rpt-card span { font-size: var(--stem-text-md); color: var(--stem-ink-soft); line-height: 1.45; }
.rpt-card em { font-style: normal; font-size: var(--stem-text-md); font-weight: 650; color: var(--stem-teal-deep); }
.rpt-muted { margin: 0; color: var(--stem-ink-soft); }
.rpt-alert {
  padding: 0.85rem 1rem;
  border-radius: 12px;
  background: #fff4e8;
  border: 1px solid #f0c9a0;
  color: #7a3f12;
  font-size: var(--stem-text-base);
}
.rpt-table-wrap { overflow-x: auto; }
.rpt-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--stem-text-md);
}
.rpt-table th, .rpt-table td {
  text-align: left;
  padding: 0.65rem 0.7rem;
  border-bottom: 1px solid var(--stem-line);
  vertical-align: top;
}
.rpt-table th {
  font-size: var(--stem-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--stem-ink-soft);
  font-weight: 700;
  background: var(--stem-mint-soft);
}
.rpt-table tr:hover td { background: rgba(46, 125, 98, 0.04); }
.rpt-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-size: var(--stem-text-xs);
  font-weight: 650;
  background: var(--stem-mint-soft);
  color: var(--stem-teal-deep);
}
.rpt-chip.is-warn { background: #fff4e8; color: #8a4b16; }
.rpt-chip.is-muted { background: #eef1ef; color: #5a6b63; }
@media (max-width: 720px) {
  .rpt-hero { grid-template-columns: 1fr; }
  .rpt-hero-aside { justify-self: start; }
}
`;
