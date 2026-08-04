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
  formatWhen,
  initials,
  personName,
} from './shared';
import type { StudentRow, StudentStats } from './types';

const P = 'alu-';

/**
 * Alumni and former students (completed, withdrawn, alumni status).
 */
export function AlumniPage() {
  return (
    <SchoolOpsGuard navPermission="nav.control.student-management">
      <ControlLayout
        title="Alumni"
        subtitle="Former students who completed, withdrew, or graduated"
      >
        <AlumniWorkspace />
      </ControlLayout>
    </SchoolOpsGuard>
  );
}

function AlumniWorkspace() {
  const { api } = useAuth();
  const [rows, setRows] = useState<StudentRow[]>([]);
  const listPage = useClientPagination(rows);

  const [stats, setStats] = useState<StudentStats | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: StudentRow[]; meta: { stats: StudentStats } }>(
        `${SCHOOL_OPS_API}/alumni`,
      );
      setRows(res.data);
      setStats(res.meta.stats);
      setSelectedId((current) => {
        if (current && res.data.some((r) => r.user_id === current)) return current;
        return res.data[0]?.user_id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alumni');
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
    return <p className={`${P}muted`}>Loading alumni…</p>;
  }

  return (
    <div className={`${P}page`}>
      <section className={`${P}hero stem-animate-rise`}>
        <div>
          <p className={`${P}eyebrow`}>Control · Student management</p>
          <h2 className={`${P}hero-title`}>Alumni</h2>
          <p className={`${P}hero-lead`}>
            Historical enrollments for students who completed their time at the school.
          </p>
        </div>
        <div className={`${P}hero-actions`}>
          <div className={`${P}action-row`}>
            <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Link to="/students" className={`${P}ghost-link`}>Students</Link>
            <Link to="/students/admissions" className={`${P}ghost-link`}>Admissions</Link>
            <Link to="/students/transfers" className={`${P}ghost-link`}>Transfers</Link>
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
          { label: 'Alumni', value: String(rows.length) },
          { label: 'Active', value: String(stats?.active ?? '—') },
          { label: 'In transfer', value: String(stats?.transfer ?? '—') },
          { label: 'Total enrollments', value: String(stats?.total_enrollments ?? '—') },
        ]}
      />

      <div className={`${P}layout`}>
        <Panel title="Alumni directory" description="Read-only list of former enrollments.">
          <div className={`${P}table-wrap`}>
            <table className={`${P}table`}>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Last grade</th>
                  <th>Section</th>
                  <th>Year</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={5} className={`${P}empty`}>No alumni records yet.</td></tr>
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
                      <td>{row.grade?.name_en ?? '—'}</td>
                      <td>{row.class_section?.name ?? '—'}</td>
                      <td>{row.academic_year?.name ?? '—'}</td>
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
                <span className={`${P}detail-mark`} aria-hidden>
                  {initials(selected.first_name, selected.last_name, selected.email)}
                </span>
                <div>
                  <h3>{personName(selected.first_name, selected.last_name, selected.email)}</h3>
                  <p>{selected.email}</p>
                </div>
              </div>
              <dl className={`${P}meta`}>
                <div><dt>Status</dt><dd><StatusPill prefix={P} status={selected.status} /></dd></div>
                <div><dt>Grade</dt><dd>{selected.grade?.name_en ?? '—'}</dd></div>
                <div><dt>Section</dt><dd>{selected.class_section?.name ?? '—'}</dd></div>
                <div><dt>Year</dt><dd>{selected.academic_year?.name ?? '—'}</dd></div>
                <div><dt>Enrolled</dt><dd>{formatWhen(selected.enrolled_on)}</dd></div>
              </dl>
              <div className={`${P}links`}>
                <Link to="/students">Active students</Link>
                <Link to="/students/transfers">Transfers</Link>
              </div>
            </div>
          ) : (
            <div className={`${P}detail ${P}detail-empty`}>
              <p className={`${P}empty`}>Select an alumni record to review.</p>
            </div>
          )}
        </aside>
      </div>
      <style>{schoolOpsPageStyles(P)}</style>
    </div>
  );
}
