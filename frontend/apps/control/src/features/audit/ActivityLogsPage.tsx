import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
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
import type { ActivityStats, AuditRow } from './types';

const PREFIX = 'aa';

function rowKey(row: AuditRow, index: number): string {
  return row.id != null ? String(row.id) : `row-${index}`;
}

/**
 * Platform activity audit trail excluding login events.
 */
export function ActivityLogsPage() {
  return (
    <AuditAccessGuard>
      <ControlLayout
        title="Activity logs"
        subtitle="Review platform actions performed by control operators and system events"
      >
        <ActivityLogsWorkspace />
      </ControlLayout>
    </AuditAccessGuard>
  );
}

function ActivityLogsWorkspace() {
  const { api } = useAuth();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (tenantId.trim()) params.set('tenant_id', tenantId.trim());
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      params.set('limit', '100');
      const qs = params.toString();
      const res = await api.get<{ data: AuditRow[]; meta: { stats: ActivityStats } }>(
        `/control/audit/activity${qs ? `?${qs}` : ''}`,
      );
      setRows(res.data);
      setStats(res.meta.stats);
      setSelectedKey((current) => {
        if (current && res.data.some((r, i) => rowKey(r, i) === current)) return current;
        return res.data[0] ? rowKey(res.data[0], 0) : null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  }, [api, search, tenantId, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedRow = useMemo(() => {
    if (!selectedKey) return null;
    const idx = rows.findIndex((r, i) => rowKey(r, i) === selectedKey);
    return idx >= 0 ? rows[idx] : null;
  }, [rows, selectedKey]);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    await load();
  }

  if (loading && rows.length === 0 && !stats) {
    return <p className={`${PREFIX}-muted`}>Loading activity logs…</p>;
  }

  if (error && !stats && rows.length === 0) {
    return (
      <Panel title="Unable to load activity logs">
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
          <h2 className={`${PREFIX}-hero-title`}>Activity logs</h2>
          <p className={`${PREFIX}-hero-lead`}>
            Non-login platform events — tenant changes, configuration updates, and operator actions
            recorded for compliance review.
          </p>
        </div>
        <div className={`${PREFIX}-hero-actions`}>
          <AuditCrossLinks current="activity" prefix={PREFIX} />
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
          { label: 'Total events', value: String(stats?.total ?? '—') },
          { label: 'Today', value: String(stats?.today ?? '—') },
          {
            label: 'Unique actors',
            value: String(stats?.unique_actors ?? '—'),
            hint: 'Distinct operators',
          },
        ]}
      />

      <div className={`${PREFIX}-layout`}>
        <Panel
          title="Activity feed"
          description="Search by action or actor email. Select a row for full event context."
          action={
            <div className={`${PREFIX}-filters`}>
              <Toolbar as="form" onSubmit={onSearch}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search action or email"
                aria-label="Search activity"
              />
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
                      No activity matches this filter.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => {
                    const key = rowKey(row, index);
                    return (
                      <tr
                        key={key}
                        className={selectedKey === key ? 'is-selected' : undefined}
                        onClick={() => setSelectedKey(key)}
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
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <aside className={`${PREFIX}-side`} aria-live="polite">
          <AuditDetailPanel row={selectedRow} prefix={PREFIX} />
        </aside>
      </div>

      <style>{auditPageStyles(PREFIX)}</style>
    </div>
  );
}
