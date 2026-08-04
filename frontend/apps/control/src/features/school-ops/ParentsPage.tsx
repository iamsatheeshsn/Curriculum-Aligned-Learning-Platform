import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import {
  Button,
  PaginationBar,
  useClientPagination,
  FormActions,
  Panel,
  SelectField,
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
import type { ParentRow, ParentStats, StudentRow } from './types';

const P = 'par-';

type ParentForm = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  student_user_id: number | '';
  relationship: string;
  is_primary: boolean;
};

const emptyForm = (): ParentForm => ({
  email: '',
  password: '',
  first_name: '',
  last_name: '',
  student_user_id: '',
  relationship: 'parent',
  is_primary: true,
});

/**
 * Parent accounts linked to students.
 */
export function ParentsPage() {
  return (
    <SchoolOpsGuard navPermission="nav.control.parent-management">
      <ControlLayout
        title="Parents"
        subtitle="Manage parent accounts and student links"
      >
        <ParentsWorkspace />
      </ControlLayout>
    </SchoolOpsGuard>
  );
}

function ParentsWorkspace() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [rows, setRows] = useState<ParentRow[]>([]);
  const listPage = useClientPagination(rows);

  const [stats, setStats] = useState<ParentStats | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'view' | 'create'>('view');
  const [form, setForm] = useState<ParentForm>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [parents, studentList] = await Promise.all([
        api.get<{ data: ParentRow[]; meta: { stats: ParentStats } }>(`${SCHOOL_OPS_API}/parents`),
        api.get<{ data: StudentRow[] }>(`${SCHOOL_OPS_API}/students?status=active`),
      ]);
      let data = parents.data;
      const term = search.trim().toLowerCase();
      if (term) {
        data = data.filter(
          (r) =>
            personName(r.first_name, r.last_name, r.email).toLowerCase().includes(term) ||
            (r.email ?? '').toLowerCase().includes(term),
        );
      }
      setRows(data);
      setStats(parents.meta.stats);
      setStudents(studentList.data);
      setSelectedId((current) => {
        if (mode === 'create') return current;
        if (current && data.some((r) => r.user_id === current)) return current;
        return data[0]?.user_id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load parents');
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
      const payload: Record<string, unknown> = {
        email: form.email.trim(),
        password: form.password,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
      };
      if (form.student_user_id) {
        payload.student_user_id = form.student_user_id;
        payload.relationship = form.relationship;
        payload.is_primary = form.is_primary;
      }
      const res = await api.post<{ data: ParentRow }>(`${SCHOOL_OPS_API}/parents`, payload);
      setMode('view');
      setSelectedId(res.data.user_id);
      await load();
      await feedback.success({
        title: 'Parent created',
        message: `${personName(res.data.first_name, res.data.last_name, res.data.email)} is ready.`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create parent');
    } finally {
      setSaving(false);
    }
  }

  if (loading && rows.length === 0) {
    return (
      <div className={`${P}page`}>
        <p className={`${P}muted`}>Loading parents…</p>
        <style>{schoolOpsPageStyles(P)}</style>
      </div>
    );
  }

  return (
    <div className={`${P}page`}>
      <section className={`${P}hero stem-animate-rise`}>
        <div className={`${P}hero-copy`}>
          <p className={`${P}eyebrow`}>Control · Parent management</p>
          <p className={`${P}hero-lead`}>Parent portal accounts with links to enrolled students.</p>
        </div>
        <div className={`${P}hero-actions`}>
          <div className={`${P}action-row`}>
            <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button type="button" variant="primary" onClick={startCreate} size="sm">
              + Add parent
            </Button>
          </div>
          <div className={`${P}action-row`}>
            <Link to="/parents/guardians" className={`${P}ghost-link`}>
              Guardians
            </Link>
            <Link to="/students" className={`${P}ghost-link`}>
              Students
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

      <StatStrip
        items={[
          { label: 'Parents', value: String(stats?.parents ?? rows.length) },
          { label: 'Student links', value: String(stats?.links ?? '—') },
          { label: 'Listed', value: String(rows.length) },
        ]}
      />

      <div className={`${P}layout`}>
        <Panel
          title="Parent directory"
          description="Select a parent to view linked students."
          action={
            <Toolbar as="form" onSubmit={onSearch}>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email" aria-label="Search parents" />
              <Button type="submit" variant="secondary" size="sm">Apply</Button>
            </Toolbar>
          }
        >
          <div className={`${P}table-wrap`}>
            <table className={`${P}table`}>
              <thead>
                <tr>
                  <th>Parent</th>
                  <th>Links</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={3} className={`${P}empty`}>No parents found.</td></tr>
                ) : (
                  listPage.pageItems.map((row) => (
                    <tr
                      key={row.user_id}
                      className={selectedId === row.user_id && mode === 'view' ? 'is-selected' : undefined}
                      onClick={() => { setMode('view'); setSelectedId(row.user_id); }}
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
          {mode === 'create' ? (
            <Panel title="Add parent">
              <form onSubmit={onSave} className={`${P}form`} noValidate>
                <TextField label="Email" required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                <TextField
                  label="Password"
                  required
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  hint="At least 8 characters. The parent can change this after first login."
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
                <TextField label="First name" required value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} />
                <TextField label="Last name" value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} />
                <SelectField label="Link to student" value={String(form.student_user_id)} onChange={(e) => setForm((f) => ({ ...f, student_user_id: Number(e.target.value) }))}>
                  <option value="">Optional — link later</option>
                  {students.map((s) => (
                    <option key={s.user_id} value={s.user_id}>{personName(s.first_name, s.last_name, s.email)}</option>
                  ))}
                </SelectField>
                {form.student_user_id ? (
                  <>
                    <TextField label="Relationship" value={form.relationship} onChange={(e) => setForm((f) => ({ ...f, relationship: e.target.value }))} />
                    <SelectField label="Primary contact" value={form.is_primary ? 'yes' : 'no'} onChange={(e) => setForm((f) => ({ ...f, is_primary: e.target.value === 'yes' }))}>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </SelectField>
                  </>
                ) : null}
                <FormActions>
                  <Button size="sm" type="button" variant="secondary" onClick={() => setMode('view')}>Cancel</Button>
                  <Button size="sm" type="submit" variant="primary" disabled={saving}>{saving ? 'Saving…' : 'Create parent'}</Button>
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
                <div><dt>Links</dt><dd>{selected.links?.length ?? 0}</dd></div>
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
                <Link to="/parents/guardians">Guardians</Link>
                <Link to="/students">Students</Link>
              </div>
            </div>
          ) : (
            <div className={`${P}detail ${P}detail-empty`}>
              <p className={`${P}empty`}>Select a parent to review links.</p>
              <Button size="sm" type="button" variant="primary" onClick={startCreate}>
                + Add parent
              </Button>
            </div>
          )}
        </aside>
      </div>
      <style>{schoolOpsPageStyles(P)}</style>
    </div>
  );
}
