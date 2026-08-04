import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import { Button, PaginationBar, Panel, StatStrip, useClientPagination } from '@stemora/ui';
import { ControlLayout } from '../../layout/ControlLayout';
import { schoolOpsPageStyles } from './schoolOpsStyles';
import {
  SCHOOL_OPS_API,
  SchoolOpsGuard,
  StatusPill,
  initials,
  personName,
} from './shared';
import type { ParentRow, ParentStats } from './types';

const P = 'gua-';

/**
 * Guardian accounts (non-parent relationships) linked to students.
 */
export function GuardiansPage() {
  return (
    <SchoolOpsGuard navPermission="nav.control.parent-management">
      <ControlLayout
        title="Guardians"
        subtitle="Guardian contacts linked to enrolled students"
      >
        <GuardiansWorkspace />
      </ControlLayout>
    </SchoolOpsGuard>
  );
}

function GuardiansWorkspace() {
  const { api } = useAuth();
  const [rows, setRows] = useState<ParentRow[]>([]);
  const listPage = useClientPagination(rows);

  const [stats, setStats] = useState<ParentStats | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: ParentRow[]; meta: { stats: ParentStats } }>(
        `${SCHOOL_OPS_API}/guardians`,
      );
      setRows(res.data);
      setStats(res.meta.stats);
      setSelectedId((current) => {
        if (current && res.data.some((r) => r.user_id === current)) return current;
        return res.data[0]?.user_id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load guardians');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => rows.find((r) => r.user_id === selectedId) ?? null,
    [rows, selectedId],
  );

  if (loading && rows.length === 0) {
    return <p className={`${P}muted`}>Loading guardians…</p>;
  }

  return (
    <div className={`${P}page`}>
      <section className={`${P}hero stem-animate-rise`}>
        <div>
          <p className={`${P}eyebrow`}>Control · Parent management</p>
          <h2 className={`${P}hero-title`}>Guardians</h2>
          <p className={`${P}hero-lead`}>
            Guardian relationships for students — aunts, uncles, legal guardians, and other contacts.
          </p>
        </div>
        <div className={`${P}hero-actions`}>
          <div className={`${P}action-row`}>
            <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Link to="/parents" className={`${P}ghost-link`}>Parents</Link>
            <Link to="/students" className={`${P}ghost-link`}>Students</Link>
          </div>
        </div>
      </section>

      {error ? (
        <div className={`${P}alert`} role="alert">
          <span>{error}</span>
          <Button size="sm" type="button" variant="secondary" onClick={() => setError(null)}>Dismiss</Button>
        </div>
      ) : null}

      <StatStrip
        items={[
          { label: 'Guardians', value: String(rows.length) },
          { label: 'All parents', value: String(stats?.parents ?? '—') },
          { label: 'Total links', value: String(stats?.links ?? '—') },
        ]}
      />

      <div className={`${P}layout`}>
        <Panel title="Guardian directory" description="Users with guardian relationship links.">
          <div className={`${P}table-wrap`}>
            <table className={`${P}table`}>
              <thead>
                <tr>
                  <th>Guardian</th>
                  <th>Links</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={3} className={`${P}empty`}>No guardians with linked students.</td></tr>
                ) : (
                  listPage.pageItems.map((row) => (
                    <tr
                      key={row.user_id}
                      className={selectedId === row.user_id ? 'is-selected' : undefined}
                      onClick={() => setSelectedId(row.user_id)}
                    >
                      <td>
                        <strong>{personName(row.first_name, row.last_name, row.email)}</strong>
                        <div className={`${P}slug`}>{row.email}</div>
                      </td>
                      <td>{row.links?.length ?? 0}</td>
                      <td><StatusPill prefix={P} status={row.status} /></td>
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

        <aside className={`${P}side`}>
          {selected ? (
            <div className={`${P}detail`}>
              <div className={`${P}detail-head`}>
                <span className={`${P}detail-mark`} aria-hidden>{initials(selected.first_name, selected.last_name, selected.email)}</span>
                <div>
                  <h3>{personName(selected.first_name, selected.last_name, selected.email)}</h3>
                  <p>{selected.email}</p>
                </div>
              </div>
              <dl className={`${P}meta`}>
                <div><dt>Status</dt><dd><StatusPill prefix={P} status={selected.status} /></dd></div>
                <div><dt>Guardian links</dt><dd>{selected.links?.length ?? 0}</dd></div>
              </dl>
              {(selected.links?.length ?? 0) > 0 ? (
                <ul className={`${P}link-list`}>
                  {selected.links!.map((link) => (
                    <li key={link.id}>
                      <strong>{personName(link.student?.first_name, link.student?.last_name, link.student?.email)}</strong>
                      <span>{link.relationship}{link.is_primary ? ' · primary' : ''}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className={`${P}links`}>
                <Link to="/parents">Parents</Link>
                <Link to="/students">Students</Link>
              </div>
            </div>
          ) : (
            <div className={`${P}detail ${P}detail-empty`}>
              <p className={`${P}empty`}>Select a guardian to review linked students.</p>
            </div>
          )}
        </aside>
      </div>
      <style>{schoolOpsPageStyles(P)}</style>
    </div>
  );
}
