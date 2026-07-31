import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import { Button, Panel, StatStrip, Toolbar } from '@stemora/ui';
import { ControlLayout } from '../../layout/ControlLayout';
import {
  AuditAccessGuard,
  AuditCrossLinks,
  AuditDetailPanel,
  actorLabel,
  actorSub,
  auditPageStyles,
  formatAction,
  formatWhen,
  tenantLabel,
  tenantSub,
} from './auditShared';
import type { AuditRow, LogStats } from './types';

const PREFIX = 'au';

/**
 * Full audit log index with detail panel backed by the show endpoint.
 */
export function AuditLogsPage() {
  return (
    <AuditAccessGuard>
      <ControlLayout
        title="Audit logs"
        subtitle="Browse the complete audit trail including logins and platform actions"
      >
        <AuditLogsWorkspace />
      </ControlLayout>
    </AuditAccessGuard>
  );
}

function AuditLogsWorkspace() {
  const { api } = useAuth();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<AuditRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (actionFilter) params.set('action', actionFilter);
      if (tenantId.trim()) params.set('tenant_id', tenantId.trim());
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      params.set('limit', '100');
      const qs = params.toString();
      const res = await api.get<{ data: AuditRow[]; meta: { stats: LogStats } }>(
        `/control/audit/logs${qs ? `?${qs}` : ''}`,
      );
      setRows(res.data);
      setStats(res.meta.stats);
      setSelectedId((current) => {
        if (current && res.data.some((r) => r.id === current)) return current;
        return res.data.find((r) => r.id != null)?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [api, search, actionFilter, tenantId, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void (async () => {
      try {
        const res = await api.get<{ data: AuditRow }>(`/control/audit/logs/${selectedId}`);
        if (!cancelled) setDetail(res.data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load log details');
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, selectedId]);

  const selectedSummary = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );
  const activeDetail = detail ?? selectedSummary;

  const topActions = stats?.actions?.slice(0, 8) ?? [];

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    await load();
  }

  if (loading && rows.length === 0 && !stats) {
    return <p className={`${PREFIX}-muted`}>Loading audit logs…</p>;
  }

  if (error && !stats && rows.length === 0) {
    return (
      <Panel title="Unable to load audit logs">
        <p style={{ color: 'var(--stem-danger)', marginTop: 0 }}>{error}</p>
        <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
          Retry
        </Button>
      </Panel>
    );
  }

  return (
    <div className={`${PREFIX}-page`}>
      <section className={`${PREFIX}-hero stem-animate-rise`}>
        <div>
          <p className={`${PREFIX}-eyebrow`}>Control · Audit</p>
          <h2 className={`${PREFIX}-hero-title`}>Audit logs</h2>
          <p className={`${PREFIX}-hero-lead`}>
            Complete immutable audit index — every recorded action with actor, tenant, and payload
            metadata. Select a row to load the full record.
          </p>
        </div>
        <div className={`${PREFIX}-hero-actions`}>
          <AuditCrossLinks current="logs" prefix={PREFIX} />
          <div className={`${PREFIX}-action-row`}>
            <Button
              size="sm"
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => void load()}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <div className={`${PREFIX}-alert`} role="alert">
          <span>{error}</span>
          <Button size="sm" type="button" variant="secondary" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <StatStrip
        items={[
          { label: 'Total logs', value: String(stats?.total ?? '—') },
          { label: 'Today', value: String(stats?.today ?? '—') },
          {
            label: 'Action types',
            value: String(stats?.actions?.length ?? '—'),
            hint: 'Distinct actions',
          },
        ]}
      />

      <div className={`${PREFIX}-layout`}>
        <Panel
          title="Audit index"
          description="Filter by action, tenant, or date range. Top actions are listed in the filter dropdown."
          action={
            <div className={`${PREFIX}-filters`}>
              <Toolbar as="form" onSubmit={onSearch}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search action or email"
                aria-label="Search audit logs"
              />
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                aria-label="Filter by action"
              >
                <option value="">All actions</option>
                {topActions.map((a) => (
                  <option key={a.action} value={a.action}>
                    {formatAction(a.action)} ({a.count})
                  </option>
                ))}
              </select>
              <input
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder="Tenant ID"
                aria-label="Filter by tenant ID"
                inputMode="numeric"
              />
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                aria-label="From date"
              />
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                aria-label="To date"
              />
              <Button type="submit" variant="secondary" size="sm">
                Apply
              </Button>
              </Toolbar>
            </div>
          }
        >
          <div className={`${PREFIX}-table-wrap`}>
            <table className={`${PREFIX}-table`}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Tenant</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={`${PREFIX}-empty`}>
                      No audit logs match this filter.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) =>
                    row.id == null ? null : (
                      <tr
                        key={row.id}
                        className={selectedId === row.id ? 'is-selected' : undefined}
                        onClick={() => setSelectedId(row.id!)}
                      >
                        <td>{formatWhen(row.created_at)}</td>
                        <td>
                          <strong>{formatAction(row.action)}</strong>
                          {row.auditable_type ? (
                            <div className={`${PREFIX}-slug`}>
                              {row.auditable_type}
                              {row.auditable_id != null ? ` #${row.auditable_id}` : ''}
                            </div>
                          ) : null}
                        </td>
                        <td>
                          {actorLabel(row)}
                          {actorSub(row) ? (
                            <div className={`${PREFIX}-slug`}>{actorSub(row)}</div>
                          ) : null}
                        </td>
                        <td>
                          {tenantLabel(row)}
                          {tenantSub(row) ? (
                            <div className={`${PREFIX}-slug`}>{tenantSub(row)}</div>
                          ) : null}
                        </td>
                      </tr>
                    ),
                  )
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <aside className={`${PREFIX}-side`} aria-live="polite">
          <AuditDetailPanel
            row={activeDetail}
            prefix={PREFIX}
            loading={detailLoading && !detail}
            extra={
              activeDetail ? (
                <div className={`${PREFIX}-links`}>
                  {activeDetail.action === 'auth.login' ? (
                    <Link to="/audit/logins">Open login history</Link>
                  ) : (
                    <Link to="/audit/activity">Open activity logs</Link>
                  )}
                  <Link to="/tenants">Tenant directory</Link>
                </div>
              ) : undefined
            }
          />
        </aside>
      </div>

      <style>{auditPageStyles(PREFIX)}</style>
    </div>
  );
}
