import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import { Button, ConfirmButton, Panel, StatStrip, useFeedback } from '@stemora/ui';
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

const P = 'adm-';

/**
 * Pending admissions queue with accept and reject actions.
 */
export function AdmissionsPage() {
  return (
    <SchoolOpsGuard navPermission="nav.control.student-management">
      <ControlLayout
        title="Admissions"
        subtitle="Review pending enrollments and accept or reject applicants"
      >
        <AdmissionsWorkspace />
      </ControlLayout>
    </SchoolOpsGuard>
  );
}

function AdmissionsWorkspace() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: StudentRow[]; meta: { stats: StudentStats } }>(
        `${SCHOOL_OPS_API}/admissions`,
      );
      setRows(res.data);
      setStats(res.meta.stats);
      setSelectedId((current) => {
        if (current && res.data.some((r) => r.enrollment_id === current)) return current;
        return res.data[0]?.enrollment_id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admissions');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => rows.find((r) => r.enrollment_id === selectedId) ?? null,
    [rows, selectedId],
  );

  async function acceptAdmission(row: StudentRow) {
    if (!row.enrollment_id) return;
    setActing(true);
    try {
      await api.post(`${SCHOOL_OPS_API}/admissions/${row.enrollment_id}/accept`, {});
      await feedback.success({
        title: 'Admission accepted',
        message: `${personName(row.first_name, row.last_name, row.email)} is now an active student.`,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept admission');
    } finally {
      setActing(false);
    }
  }

  async function rejectAdmission(row: StudentRow) {
    if (!row.enrollment_id) return;
    setActing(true);
    try {
      await api.post(`${SCHOOL_OPS_API}/admissions/${row.enrollment_id}/reject`, {});
      await feedback.success({
        title: 'Admission rejected',
        message: `${personName(row.first_name, row.last_name, row.email)} was rejected.`,
      });
      if (selectedId === row.enrollment_id) setSelectedId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reject admission');
    } finally {
      setActing(false);
    }
  }

  if (loading && rows.length === 0) {
    return <p className={`${P}muted`}>Loading admissions…</p>;
  }

  return (
    <div className={`${P}page`}>
      <section className={`${P}hero stem-animate-rise`}>
        <div>
          <p className={`${P}eyebrow`}>Control · Student management</p>
          <h2 className={`${P}hero-title`}>Admissions</h2>
          <p className={`${P}hero-lead`}>
            Pending enrollment requests awaiting review — accept to activate or reject to decline.
          </p>
        </div>
        <div className={`${P}hero-actions`}>
          <div className={`${P}action-row`}>
            <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Link to="/students" className={`${P}ghost-link`}>Students</Link>
            <Link to="/students/transfers" className={`${P}ghost-link`}>Transfers</Link>
            <Link to="/students/alumni" className={`${P}ghost-link`}>Alumni</Link>
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
          { label: 'Pending', value: String(rows.length) },
          { label: 'Active students', value: String(stats?.active ?? '—') },
          { label: 'Total enrollments', value: String(stats?.total_enrollments ?? '—') },
          { label: 'Rejected', value: '—', hint: 'See audit logs' },
        ]}
      />

      <div className={`${P}layout`}>
        <Panel title="Pending admissions" description="Select an applicant to review and take action.">
          <div className={`${P}table-wrap`}>
            <table className={`${P}table`}>
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Grade</th>
                  <th>Section</th>
                  <th>Applied</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={5} className={`${P}empty`}>No pending admissions.</td></tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.enrollment_id ?? row.user_id}
                      className={selectedId === row.enrollment_id ? 'is-selected' : undefined}
                      onClick={() => setSelectedId(row.enrollment_id)}
                    >
                      <td>
                        <strong>{personName(row.first_name, row.last_name, row.email)}</strong>
                        <div className={`${P}slug`}>{row.email}</div>
                      </td>
                      <td>{row.grade?.name_en ?? '—'}</td>
                      <td>{row.class_section?.name ?? '—'}</td>
                      <td>{formatWhen(row.enrolled_on)}</td>
                      <td><StatusPill prefix={P} status={row.status} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
                <div><dt>Applied</dt><dd>{formatWhen(selected.enrolled_on)}</dd></div>
              </dl>
              <div className={`${P}actions`}>
                <ConfirmButton
                  size="sm"
                  title="Accept admission?"
                  message={`${personName(selected.first_name, selected.last_name, selected.email)} will become an active student.`}
                  confirmLabel="Accept"
                  tone="primary"
                  variant="primary"
                  onConfirm={async () => {
                    if (acting) return;
                    await acceptAdmission(selected);
                  }}
                >
                  {acting ? 'Working…' : 'Accept'}
                </ConfirmButton>
                <ConfirmButton
                  size="sm"
                  title="Reject admission?"
                  message={`${personName(selected.first_name, selected.last_name, selected.email)} will be marked rejected.`}
                  confirmLabel="Reject"
                  tone="danger"
                  variant="danger"
                  onConfirm={async () => {
                    if (acting) return;
                    await rejectAdmission(selected);
                  }}
                >
                  {acting ? 'Working…' : 'Reject'}
                </ConfirmButton>
              </div>
              <div className={`${P}links`}>
                <Link to="/students">Active students</Link>
                <Link to="/students/transfers">Transfers</Link>
              </div>
            </div>
          ) : (
            <div className={`${P}detail ${P}detail-empty`}>
              <p className={`${P}empty`}>Select a pending admission to review.</p>
            </div>
          )}
        </aside>
      </div>
      <style>{schoolOpsPageStyles(P)}</style>
    </div>
  );
}
