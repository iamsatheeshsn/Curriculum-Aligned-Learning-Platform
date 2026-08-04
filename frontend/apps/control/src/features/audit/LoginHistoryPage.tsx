import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '@stemora/auth';
import { Button, PaginationBar, Panel, StatStrip, Toolbar, useClientPagination } from '@stemora/ui';
import { ControlLayout } from '../../layout/ControlLayout';
import { statusLabel } from '../../types';
import {
  AuditAccessGuard,
  AuditCrossLinks,
  AuditDetailPanel,
  actorLabel,
  actorSub,
  auditPageStyles,
  formatWhen,
  tenantLabel,
} from './auditShared';
import type { AuditRow, LoginStats } from './types';

const PREFIX = 'al';

function rowKey(row: AuditRow, index: number) {
  if (row.id != null) return String(row.id);
  const actorId = row.actor?.id ?? row.actor_user_id ?? 'unknown';
  return `synth-${actorId}-${row.created_at ?? index}`;
}

/**
 * Authentication and sign-in history across the control platform.
 */
export function LoginHistoryPage() {
  return (
    <AuditAccessGuard>
      <ControlLayout
        title="Login history"
        subtitle="Review sign-in events and last-login timestamps for platform users"
      >
        <LoginHistoryWorkspace />
      </ControlLayout>
    </AuditAccessGuard>
  );
}

function LoginHistoryWorkspace() {
  const { api } = useAuth();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const listPage = useClientPagination(rows);

  const [stats, setStats] = useState<LoginStats | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      params.set('limit', '100');
      const qs = params.toString();
      const res = await api.get<{ data: AuditRow[]; meta: { stats: LoginStats } }>(
        `/control/audit/logins${qs ? `?${qs}` : ''}`,
      );
      setRows(res.data);
      setStats(res.meta.stats);
      setSelectedKey((current) => {
        if (current && res.data.some((r, i) => rowKey(r, i) === current)) return current;
        return res.data[0] ? rowKey(res.data[0], 0) : null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load login history');
    } finally {
      setLoading(false);
    }
  }, [api, search, from, to]);

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
    return <p className={`${PREFIX}-muted`}>Loading login history…</p>;
  }

  if (error && !stats && rows.length === 0) {
    return (
      <Panel title="Unable to load login history">
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
          <h2 className={`${PREFIX}-hero-title`}>Login history</h2>
          <p className={`${PREFIX}-hero-lead`}>
            Sign-in audit trail from auth events. When no login logs exist yet, last-login timestamps
            from user records are shown instead.
          </p>
        </div>
        <div className={`${PREFIX}-hero-actions`}>
          <AuditCrossLinks current="logins" prefix={PREFIX} />
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
          { label: 'Total logins', value: String(stats?.total ?? '—') },
          { label: 'Today', value: String(stats?.today ?? '—') },
          {
            label: 'Unique users',
            value: String(stats?.unique_users ?? '—'),
            hint: 'Distinct accounts',
          },
        ]}
      />

      <div className={`${PREFIX}-layout`}>
        <Panel
          title="Sign-in events"
          description="Search by user name or email. Select a row for session metadata."
          action={
            <div className={`${PREFIX}-filters`}>
              <Toolbar as="form" onSubmit={onSearch}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search user or email"
                aria-label="Search logins"
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
                  <th>User</th>
                  <th>Tenant</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={`${PREFIX}-empty`}>
                      No login events match this filter.
                    </td>
                  </tr>
                ) : (
                  listPage.pageItems.map((row, index) => {
                    const key = rowKey(row, index);
                    return (
                      <tr
                        key={key}
                        className={selectedKey === key ? 'is-selected' : undefined}
                        onClick={() => setSelectedKey(key)}
                      >
                        <td>{formatWhen(row.created_at)}</td>
                        <td>
                          <strong>{actorLabel(row)}</strong>
                          {actorSub(row) ? (
                            <div className={`${PREFIX}-slug`}>{actorSub(row)}</div>
                          ) : null}
                        </td>
                        <td>{tenantLabel(row)}</td>
                        <td>
                          {row.synthesized ? (
                            <span className={`${PREFIX}-pill is-synth`}>
                              {statusLabel('synthesized')}
                            </span>
                          ) : (
                            <span className={`${PREFIX}-pill`}>Audit log</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
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

        <aside className={`${PREFIX}-side`} aria-live="polite">
          <AuditDetailPanel row={selectedRow} prefix={PREFIX} />
        </aside>
      </div>

      <style>{auditPageStyles(PREFIX)}</style>
    </div>
  );
}
