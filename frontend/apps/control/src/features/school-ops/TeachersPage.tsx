import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import {
  Button,
  FormActions,
  Panel,
  StatStrip,
  TextField,
  Toolbar,
  useFeedback,
  validateFormFields,
} from '@stemora/ui';
import { ControlLayout } from '../../layout/ControlLayout';
import { schoolOpsPageStyles } from './schoolOpsStyles';
import {
  SCHOOL_OPS_API,
  SchoolOpsGuard,
  StatusPill,
  initials,
  personName,
} from './shared';
import type { StaffRow, TeacherStats } from './types';

const P = 'tch-';

type TeacherForm = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
};

const emptyForm = (): TeacherForm => ({ email: '', password: '', first_name: '', last_name: '' });

/**
 * School teacher accounts.
 */
export function TeachersPage() {
  return (
    <SchoolOpsGuard navPermission="nav.control.teacher-management">
      <ControlLayout
        title="Teachers"
        subtitle="Manage teacher accounts for your school"
      >
        <TeachersWorkspace />
      </ControlLayout>
    </SchoolOpsGuard>
  );
}

function TeachersWorkspace() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [stats, setStats] = useState<TeacherStats | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'view' | 'create'>('view');
  const [form, setForm] = useState<TeacherForm>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      const qs = params.toString();
      const res = await api.get<{ data: StaffRow[]; meta: { stats: TeacherStats } }>(
        `${SCHOOL_OPS_API}/teachers${qs ? `?${qs}` : ''}`,
      );
      setRows(res.data);
      setStats(res.meta.stats);
      setSelectedId((current) => {
        if (mode === 'create') return current;
        if (current && res.data.some((r) => r.user_id === current)) return current;
        return res.data[0]?.user_id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load teachers');
    } finally {
      setLoading(false);
    }
  }, [api, search, mode]);

  useEffect(() => {
    void load();
  }, [api]);

  const selected = useMemo(
    () => rows.find((r) => r.user_id === selectedId) ?? null,
    [rows, selectedId],
  );

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    await load();
  }

  function startCreate() {
    setMode('create');
    setForm(emptyForm());
    setSelectedId(null);
  }

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateFormFields(e.currentTarget)) return;

    setSaving(true);
    setError(null);
    try {
      const res = await api.post<{ data: StaffRow }>(`${SCHOOL_OPS_API}/teachers`, {
        email: form.email.trim(),
        password: form.password,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
      });
      setMode('view');
      setSelectedId(res.data.user_id);
      await load();
      await feedback.success({
        title: 'Teacher added',
        message: `${personName(res.data.first_name, res.data.last_name, res.data.email)} can now access the Institution portal.`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create teacher');
    } finally {
      setSaving(false);
    }
  }

  if (loading && rows.length === 0) {
    return (
      <div className={`${P}page`}>
        <p className={`${P}muted`}>Loading teachers…</p>
        <style>{schoolOpsPageStyles(P)}</style>
      </div>
    );
  }

  return (
    <div className={`${P}page`}>
      <section className={`${P}hero stem-animate-rise`}>
        <div className={`${P}hero-copy`}>
          <p className={`${P}eyebrow`}>Control · Teacher management</p>
          <p className={`${P}hero-lead`}>
            Teacher accounts for classroom delivery — assign subjects from Teaching Assignments.
          </p>
        </div>
        <div className={`${P}hero-actions`}>
          <div className={`${P}action-row`}>
            <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button type="button" variant="primary" onClick={startCreate} size="sm">
              + Add teacher
            </Button>
          </div>
          <div className={`${P}action-row`}>
            <Link to="/teachers/tutors" className={`${P}ghost-link`}>
              Tutors
            </Link>
            <Link to="/teachers/assignments" className={`${P}ghost-link`}>
              Assignments
            </Link>
          </div>
        </div>
      </section>

      {error ? (
        <div className={`${P}alert`} role="alert">
          <span>{error}</span>
          <Button size="sm" type="button" variant="secondary" onClick={() => setError(null)}>Dismiss</Button>
        </div>
      ) : null}

      <StatStrip items={[{ label: 'Teachers', value: String(stats?.total ?? rows.length) }]} />

      <div className={`${P}layout`}>
        <Panel title="Teacher directory" description="Select a teacher to review account details.">
          <Toolbar as="form" align="start" onSubmit={onSearch}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email"
              aria-label="Search teachers"
              style={{ flex: '1 1 220px', maxWidth: 320 }}
            />
            <Button type="submit" variant="secondary" size="sm">
              Apply
            </Button>
          </Toolbar>
          <div className={`${P}table-wrap`}>
            <table className={`${P}table`}>
              <thead>
                <tr>
                  <th>Teacher</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={2} className={`${P}empty`}>
                      No teachers found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.user_id}
                      className={selectedId === row.user_id && mode === 'view' ? 'is-selected' : undefined}
                      onClick={() => {
                        setMode('view');
                        setSelectedId(row.user_id);
                      }}
                    >
                      <td>
                        <strong>{personName(row.first_name, row.last_name, row.email)}</strong>
                        <div className={`${P}slug`}>{row.email}</div>
                      </td>
                      <td>
                        <StatusPill prefix={P} status={row.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <aside className={`${P}side`}>
          {mode === 'create' ? (
            <Panel title="Add teacher">
              <form onSubmit={onSave} className={`${P}form`} noValidate>
                <TextField label="Email" required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                <TextField
                  label="Password"
                  required
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  hint="At least 8 characters. The teacher can change this after first login."
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
                <TextField label="First name" required value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} />
                <TextField label="Last name" value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} />
                <FormActions>
                  <Button size="sm" type="button" variant="secondary" onClick={() => setMode('view')}>Cancel</Button>
                  <Button size="sm" type="submit" variant="primary" disabled={saving}>{saving ? 'Saving…' : 'Create teacher'}</Button>
                </FormActions>
              </form>
            </Panel>
          ) : selected ? (
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
                <div><dt>User ID</dt><dd>{selected.user_id}</dd></div>
              </dl>
              <div className={`${P}links`}>
                <Link to="/teachers/tutors" className={`${P}ghost-link`}>
                  Tutors
                </Link>
                <Link to="/teachers/assignments" className={`${P}ghost-link`}>
                  Teaching assignments
                </Link>
              </div>
            </div>
          ) : (
            <div className={`${P}detail ${P}detail-empty`}>
              <p className={`${P}empty`}>Select a teacher to review.</p>
              <Button size="sm" type="button" variant="primary" onClick={startCreate}>
                + Add teacher
              </Button>
            </div>
          )}
        </aside>
      </div>
      <style>{schoolOpsPageStyles(P)}</style>
    </div>
  );
}
