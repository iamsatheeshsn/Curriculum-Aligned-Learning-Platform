import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import {
  Button,
  PaginationBar,
  useClientPagination,
  ConfirmButton,
  FormActions,
  Panel,
  SelectField,
  StatStrip,
  Toolbar,
  useFeedback,
} from '@stemora/ui';
import { ControlLayout } from '../../layout/ControlLayout';
import { statusLabel } from '../../types';

type TrialRow = {
  id: number;
  name: string;
  slug: string;
  legal_name?: string | null;
  status: string;
  trial_ends_at: string | null;
  days_remaining: number | null;
  urgency: 'active' | 'ending_soon' | 'expired' | 'converted' | 'other' | string;
  schools_count: number;
  subscription: {
    id: number;
    status: string;
    plan: {
      code: string;
      name_en: string;
      price?: string | number;
      currency?: string;
    } | null;
  } | null;
  default_locale?: string | null;
  default_timezone?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type TrialStats = {
  total_tracked: number;
  active_trials: number;
  ending_soon: number;
  expired: number;
  converted: number;
};


const FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All tracked' },
  { value: 'active', label: 'Active trials' },
  { value: 'ending_soon', label: 'Ending soon' },
  { value: 'expired', label: 'Expired' },
  { value: 'converted', label: 'Converted' },
];

const EXTEND_OPTIONS = [7, 14, 30, 60];

/**
 * Super Admin workspace for organisations on trial or recently converted from trial.
 */
export function TrialAccountsPage() {
  const { isSuperAdmin, hasPermission } = useAuth();
  if (
    !isSuperAdmin &&
    !hasPermission(['platform.tenants.manage', 'nav.control.tenant-management'])
  ) {
    return <Navigate to="/" replace />;
  }

  return (
    <ControlLayout
      title="Trial Accounts"
      subtitle="Track trial organisations, extend windows, and convert to paid status"
    >
      <TrialAccountsWorkspace />
    </ControlLayout>
  );
}

function TrialAccountsWorkspace() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [rows, setRows] = useState<TrialRow[]>([]);
  const listPage = useClientPagination(rows);

  const [stats, setStats] = useState<TrialStats | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<TrialRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [extendDays, setExtendDays] = useState('14');
  const [startDays, setStartDays] = useState('14');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (filter) params.set('filter', filter);
      const qs = params.toString();
      const res = await api.get<{
        data: TrialRow[];
        meta: { stats: TrialStats };
      }>(`/control/trials${qs ? `?${qs}` : ''}`);
      setRows(res.data);
      setStats(res.meta.stats);
      setSelectedId((current) => {
        if (current && res.data.some((r) => r.id === current)) return current;
        return res.data[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trial accounts');
    } finally {
      setLoading(false);
    }
  }, [api, search, filter]);

  useEffect(() => {
    void load();
  }, [api, filter]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void (async () => {
      try {
        const res = await api.get<{ data: TrialRow }>(`/control/trials/${selectedId}`);
        if (!cancelled) setDetail(res.data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load trial details');
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, selectedId, rows]);

  const selectedSummary = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );

  const activeDetail = detail ?? selectedSummary;

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    await load();
  }

  async function extendTrial() {
    if (!activeDetail) return;
    const days = Number(extendDays);
    if (!Number.isFinite(days) || days < 1) return;
    setBusy('extend');
    setError(null);
    try {
      const res = await api.post<{ data: TrialRow }>(`/control/trials/${activeDetail.id}/extend`, {
        days,
      });
      setDetail(res.data);
      await load();
      await feedback.success({
        title: 'Trial extended',
        message: `${activeDetail.name} trial extended by ${days} day${days === 1 ? '' : 's'}.`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not extend trial');
    } finally {
      setBusy(null);
    }
  }

  async function convertTrial() {
    if (!activeDetail) return;
    setBusy('convert');
    setError(null);
    try {
      const res = await api.post<{ data: TrialRow }>(`/control/trials/${activeDetail.id}/convert`);
      setDetail(res.data);
      await load();
      await feedback.success({
        title: 'Converted to active',
        message: `${activeDetail.name} is now an active organisation.`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not convert trial');
    } finally {
      setBusy(null);
    }
  }

  async function startTrial() {
    if (!activeDetail) return;
    const days = Number(startDays);
    if (!Number.isFinite(days) || days < 1) return;
    setBusy('start');
    setError(null);
    try {
      const res = await api.post<{ data: TrialRow }>(`/control/trials/${activeDetail.id}/start`, {
        days,
      });
      setDetail(res.data);
      setFilter('all');
      await load();
      await feedback.success({
        title: 'Trial started',
        message: `${activeDetail.name} is on a ${days}-day trial.`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start trial');
    } finally {
      setBusy(null);
    }
  }

  if (loading && rows.length === 0 && !stats) {
    return <p className="tr-muted">Loading trial accounts…</p>;
  }

  if (error && !stats && rows.length === 0) {
    return (
      <Panel title="Unable to load trial accounts">
        <p style={{ color: 'var(--stem-danger)', marginTop: 0 }}>{error}</p>
        <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
          Retry
        </Button>
      </Panel>
    );
  }

  return (
    <div className="tr-page">
      <section className="tr-hero stem-animate-rise">
        <div>
          <p className="tr-eyebrow">Control · Tenant management</p>
          <h2 className="tr-hero-title">Trial accounts</h2>
          <p className="tr-hero-lead">
            Monitor trial windows across organisations, extend deadlines before they lapse, and
            convert successful trials to active status.
          </p>
        </div>
        <div className="tr-hero-actions">
          <div className="tr-action-row">
            <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Link to="/tenants" className="tr-ghost-link">
              Tenant directory
            </Link>
            <Link to="/tenants/subscriptions" className="tr-ghost-link">
              Subscriptions
            </Link>
          </div>
        </div>
      </section>

      {error ? (
        <div className="tr-alert" role="alert">
          <span>{error}</span>
          <Button size="sm" type="button" variant="secondary" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <StatStrip
        items={[
          { label: 'Active trials', value: String(stats?.active_trials ?? '—') },
          {
            label: 'Ending soon',
            value: String(stats?.ending_soon ?? '—'),
            hint: 'Within 7 days',
          },
          { label: 'Expired', value: String(stats?.expired ?? '—') },
          {
            label: 'Converted',
            value: String(stats?.converted ?? '—'),
            hint: `${stats?.total_tracked ?? 0} tracked`,
          },
        ]}
      />

      <div className="tr-filters" aria-label="Trial urgency filters">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={`tr-filter-chip ${filter === f.value ? 'is-on' : ''}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="tr-layout">
        <Panel
          title="Trial directory"
          description="Select an organisation to extend the trial, convert to active, or restart a trial window."
          action={
            <Toolbar as="form" onSubmit={onSearch}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search organisation"
                aria-label="Search trial accounts"
              />
              <Button type="submit" variant="secondary" size="sm">
                Apply
              </Button>
            </Toolbar>
          }
        >
          <div className="tr-table-wrap">
            <table className="tr-table">
              <thead>
                <tr>
                  <th>Organisation</th>
                  <th>Urgency</th>
                  <th>Ends</th>
                  <th>Days left</th>
                  <th>Plan</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="tr-empty">
                      No trial accounts match this filter.
                    </td>
                  </tr>
                ) : (
                  listPage.pageItems.map((row) => (
                    <tr
                      key={row.id}
                      className={selectedId === row.id ? 'is-selected' : undefined}
                      onClick={() => setSelectedId(row.id)}
                    >
                      <td>
                        <strong>{row.name}</strong>
                        <div className="tr-slug">
                          <code>{row.slug}</code>
                        </div>
                      </td>
                      <td>
                        <UrgencyPill urgency={row.urgency} />
                      </td>
                      <td>
                        {row.trial_ends_at
                          ? new Date(row.trial_ends_at).toLocaleDateString()
                          : '—'}
                      </td>
                      <td>
                        <DaysCell days={row.days_remaining} urgency={row.urgency} />
                      </td>
                      <td>{row.subscription?.plan?.name_en ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <PaginationBar
            page={listPage.page}
            lastPage={listPage.lastPage}
            total={listPage.total}
            onPageChange={listPage.setPage}
            disabled={loading}
          />
        </Panel>

        <aside className="tr-side" aria-live="polite">
          {activeDetail ? (
            <div className="tr-detail">
              <div className="tr-detail-head">
                <span className="tr-detail-mark" aria-hidden>
                  {activeDetail.name.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <h3>{activeDetail.name}</h3>
                  <p>
                    <code>{activeDetail.slug}</code>
                    {` · ${statusLabel(activeDetail.status)}`}
                  </p>
                </div>
              </div>

              {detailLoading && !detail ? (
                <p className="tr-muted">Loading details…</p>
              ) : (
                <>
                  <dl className="tr-meta">
                    <div>
                      <dt>Urgency</dt>
                      <dd>
                        <UrgencyPill urgency={activeDetail.urgency} />
                      </dd>
                    </div>
                    <div>
                      <dt>Trial ends</dt>
                      <dd>
                        {activeDetail.trial_ends_at
                          ? new Date(activeDetail.trial_ends_at).toLocaleString()
                          : 'Not set'}
                      </dd>
                    </div>
                    <div>
                      <dt>Days remaining</dt>
                      <dd>
                        <DaysCell
                          days={activeDetail.days_remaining}
                          urgency={activeDetail.urgency}
                        />
                      </dd>
                    </div>
                    <div>
                      <dt>Schools</dt>
                      <dd>{activeDetail.schools_count}</dd>
                    </div>
                    <div>
                      <dt>Plan</dt>
                      <dd>
                        {activeDetail.subscription?.plan
                          ? `${activeDetail.subscription.plan.name_en} · ${activeDetail.subscription.plan.currency ?? 'SAR'} ${activeDetail.subscription.plan.price ?? 0}`
                          : 'No active plan'}
                      </dd>
                    </div>
                    <div>
                      <dt>Created</dt>
                      <dd>
                        {activeDetail.created_at
                          ? new Date(activeDetail.created_at).toLocaleDateString()
                          : '—'}
                      </dd>
                    </div>
                  </dl>

                  {activeDetail.status === 'trial' || activeDetail.urgency === 'expired' ? (
                    <div className="tr-actions">
                      <SelectField
                        label="Extend by"
                        value={extendDays}
                        onChange={(e) => setExtendDays(e.target.value)}
                      >
                        {EXTEND_OPTIONS.map((d) => (
                          <option key={d} value={String(d)}>
                            {d} days
                          </option>
                        ))}
                      </SelectField>
                      <FormActions>
                        <ConfirmButton size="sm"
                          title="Extend trial?"
                          message={`Add ${extendDays} days to ${activeDetail.name}'s trial window.`}
                          confirmLabel="Extend"
                          tone="primary"
                          variant="primary"
                          onConfirm={extendTrial}
                        >
                          {busy === 'extend' ? 'Extending…' : 'Extend trial'}
                        </ConfirmButton>
                        <ConfirmButton size="sm"
                          title="Convert to active?"
                          message={`${activeDetail.name} will leave trial and become an active organisation.`}
                          confirmLabel="Convert"
                          tone="primary"
                          variant="secondary"
                          onConfirm={convertTrial}
                        >
                          {busy === 'convert' ? 'Converting…' : 'Convert to active'}
                        </ConfirmButton>
                      </FormActions>
                    </div>
                  ) : (
                    <div className="tr-actions">
                      <p className="tr-muted">
                        This organisation is {statusLabel(activeDetail.status)}. You can place it
                        back on trial if needed.
                      </p>
                      <SelectField
                        label="Trial length"
                        value={startDays}
                        onChange={(e) => setStartDays(e.target.value)}
                      >
                        {EXTEND_OPTIONS.map((d) => (
                          <option key={d} value={String(d)}>
                            {d} days
                          </option>
                        ))}
                      </SelectField>
                      <FormActions>
                        <ConfirmButton size="sm"
                          title="Start trial?"
                          message={`Move ${activeDetail.name} to trial status for ${startDays} days.`}
                          confirmLabel="Start trial"
                          tone="primary"
                          variant="primary"
                          onConfirm={startTrial}
                        >
                          {busy === 'start' ? 'Starting…' : 'Start trial'}
                        </ConfirmButton>
                      </FormActions>
                    </div>
                  )}

                  <div className="tr-links">
                    <Link to="/tenants">Open tenant directory</Link>
                    <Link to="/tenants/subscriptions">Active subscriptions</Link>
                    <Link to="/subscription">Plans & billing</Link>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="tr-detail tr-detail-empty">
              <p className="tr-empty">Select a trial account to review details and actions.</p>
            </div>
          )}
        </aside>
      </div>

      <style>{trialStyles}</style>
    </div>
  );
}

function UrgencyPill({ urgency }: { urgency: string }) {
  const label =
    urgency === 'ending_soon'
      ? 'Ending soon'
      : urgency === 'expired'
        ? 'Expired'
        : urgency === 'converted'
          ? 'Converted'
          : urgency === 'active'
            ? 'Active trial'
            : statusLabel(urgency);
  return <span className={`tr-pill urgency-${urgency}`}>{label}</span>;
}

function DaysCell({ days, urgency }: { days: number | null; urgency: string }) {
  if (days === null) return <span className="tr-muted">—</span>;
  if (urgency === 'converted') {
    return <span className="tr-muted">Ended</span>;
  }
  if (days < 0) {
    return <span className="tr-days is-expired">{Math.abs(days)}d overdue</span>;
  }
  if (days === 0) {
    return <span className="tr-days is-soon">Today</span>;
  }
  return (
    <span className={`tr-days ${days <= 7 ? 'is-soon' : ''}`}>
      {days} day{days === 1 ? '' : 's'}
    </span>
  );
}

const trialStyles = `
.tr-page { display: grid; gap: 1rem; }
.tr-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(220px, 0.7fr);
  gap: 1.25rem;
  align-items: end;
  padding: 1.25rem 1.35rem;
  border-radius: 18px;
  border: 1px solid var(--stem-line);
  background:
    radial-gradient(120% 90% at 0% 0%, rgba(217, 119, 6, 0.1), transparent 55%),
    linear-gradient(145deg, #fffaf3, #f5f8f6);
}
.tr-eyebrow {
  margin: 0 0 0.3rem;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: #b45309;
}
.tr-hero-title {
  margin: 0 0 0.35rem;
  font-family: var(--stem-font-display);
  font-size: clamp(1.35rem, 1.8vw, 1.55rem);
  letter-spacing: -0.03em;
}
.tr-hero-lead {
  margin: 0;
  color: var(--stem-ink-soft);
  line-height: 1.5;
  max-width: 42rem;
  font-size: var(--stem-text-base);
}
.tr-hero-actions { display: grid; gap: 0.75rem; justify-items: end; }
.tr-action-row { display: flex; flex-wrap: wrap; gap: 0.45rem; justify-content: flex-end; align-items: center; }
.tr-ghost-link {
  display: inline-flex; align-items: center; min-height: 40px; padding: 0 0.75rem;
  font-size: var(--stem-text-md); font-weight: 600; color: var(--stem-teal-deep); text-decoration: none;
}
.tr-ghost-link:hover { text-decoration: underline; }
.tr-alert {
  display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;
  padding: 0.85rem 1rem; border-radius: 12px; background: #fef3f2; color: var(--stem-danger);
  border: 1px solid #fecdca; font-size: var(--stem-text-base);
}
.tr-filters { display: flex; flex-wrap: wrap; gap: 0.45rem; }
.tr-filter-chip {
  padding: 0.45rem 0.85rem;
  border-radius: 999px;
  border: 1px solid var(--stem-line);
  background: #fff;
  font: inherit;
  font-size: var(--stem-text-md);
  font-weight: 600;
  color: var(--stem-ink-soft);
  cursor: pointer;
}
.tr-filter-chip.is-on {
  border-color: #d97706;
  background: #fff7ed;
  color: #9a3412;
}
.tr-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(280px, 0.85fr);
  gap: 1rem;
  align-items: start;
}
.tr-table-wrap { overflow-x: auto; margin: 0 -0.15rem; }
.tr-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--stem-text-base);
}
.tr-table th {
  text-align: left;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--stem-ink-soft);
  padding: 0.55rem 0.65rem;
  border-bottom: 1px solid var(--stem-line);
  white-space: nowrap;
}
.tr-table td {
  padding: 0.7rem 0.65rem;
  border-bottom: 1px solid var(--stem-line);
  vertical-align: top;
}
.tr-table tbody tr {
  cursor: pointer;
  transition: background 0.15s ease;
}
.tr-table tbody tr:hover { background: rgba(18, 160, 171, 0.04); }
.tr-table tbody tr.is-selected { background: rgba(217, 119, 6, 0.08); }
.tr-slug { margin-top: 0.15rem; font-size: var(--stem-text-sm); color: var(--stem-ink-soft); }
.tr-slug code { font-size: var(--stem-text-sm); }
.tr-empty { text-align: center; color: var(--stem-ink-soft); padding: 1.5rem 0.75rem !important; }
.tr-side { position: sticky; top: 0.75rem; }
.tr-detail {
  display: grid;
  gap: 1rem;
  padding: 1.1rem 1.15rem;
  border-radius: 16px;
  border: 1px solid var(--stem-line);
  background: #fff;
}
.tr-detail-empty { min-height: 180px; align-content: center; }
.tr-detail-head {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}
.tr-detail-mark {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-weight: 700;
  background: #fff7ed;
  color: #9a3412;
  border: 1px solid #fed7aa;
}
.tr-detail-head h3 {
  margin: 0;
  font-size: var(--stem-text-xl);
  letter-spacing: -0.02em;
}
.tr-detail-head p {
  margin: 0.15rem 0 0;
  font-size: var(--stem-text-md);
  color: var(--stem-ink-soft);
}
.tr-meta {
  display: grid;
  gap: 0.55rem;
  margin: 0;
}
.tr-meta > div {
  display: grid;
  grid-template-columns: 7.5rem minmax(0, 1fr);
  gap: 0.5rem;
  align-items: baseline;
}
.tr-meta dt {
  margin: 0;
  font-size: var(--stem-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--stem-ink-soft);
}
.tr-meta dd { margin: 0; font-size: var(--stem-text-base); }
.tr-actions {
  display: grid;
  gap: 0.75rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--stem-line);
}
.tr-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  padding-top: 0.25rem;
}
.tr-links a {
  font-size: var(--stem-text-md);
  font-weight: 600;
  color: var(--stem-teal-deep);
  text-decoration: none;
}
.tr-links a:hover { text-decoration: underline; }
.tr-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: var(--stem-text-xs);
  font-weight: 700;
  letter-spacing: 0.02em;
  background: #f3f4f6;
  color: #374151;
}
.tr-pill.urgency-active { background: #ecfdf5; color: #047857; }
.tr-pill.urgency-ending_soon { background: #fff7ed; color: #c2410c; }
.tr-pill.urgency-expired { background: #fef2f2; color: #b91c1c; }
.tr-pill.urgency-converted { background: #eff6ff; color: #1d4ed8; }
.tr-days { font-weight: 600; }
.tr-days.is-soon { color: #c2410c; }
.tr-days.is-expired { color: #b91c1c; }
.tr-muted { color: var(--stem-ink-soft); font-size: var(--stem-text-base); margin: 0; }
@media (max-width: 960px) {
  .tr-hero, .tr-layout { grid-template-columns: 1fr; }
  .tr-hero-actions { justify-items: start; }
  .tr-action-row { justify-content: flex-start; }
  .tr-side { position: static; }
}
`;
