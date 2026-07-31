import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import {
  Button,
  ConfirmButton,
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
import { statusLabel } from '../../types';

type RoleOption = {
  code: string;
  name_en: string;
  name_ar?: string | null;
};

type PlatformUserRow = {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  first_name_ar?: string | null;
  last_name_ar?: string | null;
  name: string;
  phone?: string | null;
  locale?: string | null;
  timezone?: string | null;
  status: string;
  role_code?: string | null;
  role?: {
    id: number;
    code: string;
    name_en: string;
    name_ar?: string | null;
    portal?: string;
    level?: number;
  } | null;
  last_login_at?: string | null;
  email_verified_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  is_last_super_admin?: boolean;
};

type PlatformUserStats = {
  total: number;
  active: number;
  suspended: number;
  inactive: number;
  by_role: Record<string, number>;
};

type PlatformUserForm = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  first_name_ar: string;
  last_name_ar: string;
  phone: string;
  locale: string;
  timezone: string;
  status: 'active' | 'suspended' | 'inactive';
  role_code: string;
};

const emptyForm = (): PlatformUserForm => ({
  email: '',
  password: '',
  first_name: '',
  last_name: '',
  first_name_ar: '',
  last_name_ar: '',
  phone: '',
  locale: 'en',
  timezone: 'Asia/Riyadh',
  status: 'active',
  role_code: 'customer_support',
});

const LOCALES = [
  { value: 'en', label: 'English (en)' },
  { value: 'ar', label: 'Arabic (ar)' },
];

const TIMEZONES = [
  'Asia/Riyadh',
  'Asia/Dubai',
  'Asia/Kuwait',
  'Asia/Bahrain',
  'Asia/Qatar',
  'Asia/Muscat',
  'Asia/Amman',
  'Asia/Beirut',
  'Africa/Cairo',
  'UTC',
];

function roleLabel(code?: string | null, roles?: RoleOption[]) {
  if (!code) return '—';
  const match = roles?.find((r) => r.code === code);
  return match?.name_en ?? code.replace(/_/g, ' ');
}

function initials(row: PlatformUserRow) {
  const a = (row.first_name ?? '').trim().charAt(0);
  const b = (row.last_name ?? '').trim().charAt(0);
  const letters = `${a}${b}`.toUpperCase();
  return letters || row.email.slice(0, 2).toUpperCase();
}

function formatWhen(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

/**
 * Control portal operators: Super Admin, Customer Support, and Auditor.
 */
export function PlatformUsersPage() {
  const { isSuperAdmin, hasPermission } = useAuth();
  if (
    !isSuperAdmin &&
    !hasPermission([
      'platform.rbac.manage',
      'platform.tenants.manage',
      'nav.control.user-management',
      'nav.control.platform-users',
    ])
  ) {
    return <Navigate to="/" replace />;
  }

  return (
    <ControlLayout
      title="Platform Users"
      subtitle="Manage Stemora Control operators and their platform roles"
    >
      <PlatformUsersWorkspace />
    </ControlLayout>
  );
}

function PlatformUsersWorkspace() {
  const { api, session } = useAuth();
  const feedback = useFeedback();
  const [rows, setRows] = useState<PlatformUserRow[]>([]);
  const [stats, setStats] = useState<PlatformUserStats | null>(null);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<PlatformUserRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view');
  const [form, setForm] = useState<PlatformUserForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (roleFilter) params.set('role', roleFilter);
      const qs = params.toString();
      const res = await api.get<{
        data: PlatformUserRow[];
        meta: { stats: PlatformUserStats; roles: RoleOption[] };
      }>(`/control/platform-users${qs ? `?${qs}` : ''}`);
      setRows(res.data);
      setStats(res.meta.stats);
      setRoles(res.meta.roles ?? []);
      setSelectedId((current) => {
        if (mode === 'create') return current;
        if (current && res.data.some((r) => r.id === current)) return current;
        return res.data[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load platform users');
    } finally {
      setLoading(false);
    }
  }, [api, search, statusFilter, roleFilter, mode]);

  useEffect(() => {
    void load();
  }, [api, statusFilter, roleFilter]);

  useEffect(() => {
    if (!selectedId || mode === 'create') {
      if (mode !== 'create') setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void (async () => {
      try {
        const res = await api.get<{ data: PlatformUserRow }>(
          `/control/platform-users/${selectedId}`,
        );
        if (!cancelled) setDetail(res.data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load user details');
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, selectedId, rows, mode]);

  const selectedSummary = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );
  const activeDetail = detail ?? selectedSummary;
  const showingForm = mode === 'create' || mode === 'edit';
  const selfId = session?.user?.id ?? null;

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    await load();
  }

  function startCreate() {
    setMode('create');
    setForm(emptyForm());
    setSelectedId(null);
    setDetail(null);
  }

  function startEdit(row: PlatformUserRow) {
    setMode('edit');
    setSelectedId(row.id);
    setForm({
      email: row.email,
      password: '',
      first_name: row.first_name ?? '',
      last_name: row.last_name ?? '',
      first_name_ar: row.first_name_ar ?? '',
      last_name_ar: row.last_name_ar ?? '',
      phone: row.phone ?? '',
      locale: row.locale || 'en',
      timezone: row.timezone || 'Asia/Riyadh',
      status: (row.status as PlatformUserForm['status']) || 'active',
      role_code: row.role_code || 'customer_support',
    });
  }

  function cancelForm() {
    setMode('view');
    setForm(emptyForm());
    if (!selectedId && rows[0]) setSelectedId(rows[0].id);
  }

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateFormFields(e.currentTarget)) return;

    if (mode === 'create' && form.password.trim().length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        email: form.email.trim().toLowerCase(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        first_name_ar: form.first_name_ar.trim() || null,
        last_name_ar: form.last_name_ar.trim() || null,
        phone: form.phone.trim() || null,
        locale: form.locale,
        timezone: form.timezone,
        status: form.status,
        role_code: form.role_code,
      };

      if (mode === 'create') {
        payload.password = form.password;
        const res = await api.post<{ data: PlatformUserRow }>('/control/platform-users', payload);
        setMode('view');
        setSelectedId(res.data.id);
        await load();
        await feedback.success({
          title: 'Platform user created',
          message: `${res.data.name} can sign in to the Control portal.`,
        });
      } else if (selectedId) {
        if (form.password.trim()) payload.password = form.password.trim();
        const res = await api.request<{ data: PlatformUserRow }>(
          `/control/platform-users/${selectedId}`,
          {
            method: 'PUT',
            body: JSON.stringify(payload),
          },
        );
        setMode('view');
        await load();
        await feedback.success({
          title: 'Platform user updated',
          message: `${res.data.name} has been saved.`,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save platform user');
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(row: PlatformUserRow, status: 'active' | 'suspended' | 'inactive') {
    try {
      await api.request(`/control/platform-users/${row.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      await feedback.success({
        title: 'Status updated',
        message: `${row.name} is now ${statusLabel(status)}.`,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update status');
    }
  }

  async function deleteUser(row: PlatformUserRow) {
    try {
      await api.request(`/control/platform-users/${row.id}`, { method: 'DELETE' });
      await feedback.success({
        title: 'Platform user deleted',
        message: `${row.name} was removed from Control operators.`,
      });
      setSelectedId(null);
      setDetail(null);
      setMode('view');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete user');
    }
  }

  if (loading && rows.length === 0 && !stats) {
    return <p className="pu-muted">Loading platform users…</p>;
  }

  if (error && !stats && rows.length === 0) {
    return (
      <Panel title="Unable to load platform users">
        <p style={{ color: 'var(--stem-danger)', marginTop: 0 }}>{error}</p>
        <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
          Retry
        </Button>
      </Panel>
    );
  }

  return (
    <div className="pu-page">
      <section className="pu-hero stem-animate-rise">
        <div>
          <p className="pu-eyebrow">Control · User management</p>
          <h2 className="pu-hero-title">Platform Users</h2>
          <p className="pu-hero-lead">
            Invite and manage Stemora Control operators — Super Admins, Customer Support, and
            Auditors — with clear lifecycle and role controls.
          </p>
        </div>
        <div className="pu-hero-actions">
          <div className="pu-action-row">
            <Button
              size="sm"
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => void load()}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Link to="/rbac" className="pu-ghost-link">
              RBAC
            </Link>
            <Button type="button" variant="apricot" onClick={startCreate} size="sm">
              + New operator
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="pu-alert" role="alert">
          <span>{error}</span>
          <Button size="sm" type="button" variant="secondary" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <StatStrip
        items={[
          { label: 'Operators', value: String(stats?.total ?? '—') },
          { label: 'Active', value: String(stats?.active ?? '—') },
          { label: 'Suspended', value: String(stats?.suspended ?? '—') },
          {
            label: 'Super Admins',
            value: String(stats?.by_role?.super_admin ?? '—'),
            hint: 'Full Control access',
          },
        ]}
      />

      <div className="pu-layout">
        <Panel
          title="Operator directory"
          description="Search by name or email, filter by role or status, then select a row for details."
          action={
            <Toolbar as="form" onSubmit={onSearch}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or email"
                aria-label="Search platform users"
              />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                aria-label="Filter by role"
              >
                <option value="">All roles</option>
                {roles.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name_en}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="inactive">Inactive</option>
              </select>
              <Button type="submit" variant="secondary" size="sm">
                Apply
              </Button>
            </Toolbar>
          }
        >
          <div className="pu-table-wrap">
            <table className="pu-table">
              <thead>
                <tr>
                  <th>Operator</th>
                  <th>Role</th>
                  <th>Locale</th>
                  <th>Last login</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="pu-empty">
                      No platform users match this filter. Invite an operator to get started.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      className={
                        selectedId === row.id && mode !== 'create' ? 'is-selected' : undefined
                      }
                      onClick={() => {
                        setMode('view');
                        setSelectedId(row.id);
                      }}
                    >
                      <td>
                        <strong>{row.name}</strong>
                        <div className="pu-slug">
                          <span>{row.email}</span>
                          {selfId === row.id ? <span className="pu-you"> · You</span> : null}
                        </div>
                      </td>
                      <td>{roleLabel(row.role_code, roles)}</td>
                      <td>{row.locale || '—'}</td>
                      <td>{formatWhen(row.last_login_at)}</td>
                      <td>
                        <StatusPill status={row.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <aside className="pu-side" aria-live="polite">
          {showingForm ? (
            <Panel
              title={mode === 'create' ? 'Invite operator' : 'Edit operator'}
              description={
                mode === 'create'
                  ? 'Create a Control portal account and assign a platform role.'
                  : 'Update profile, role, status, or reset the password.'
              }
            >
              <form onSubmit={onSave} className="pu-form" noValidate>
                <TextField
                  label="Email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  autoComplete="off"
                />
                <TextField
                  label={mode === 'create' ? 'Password' : 'New password'}
                  type="password"
                  required={mode === 'create'}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  hint={
                    mode === 'edit'
                      ? 'Leave blank to keep the current password.'
                      : 'Minimum 8 characters.'
                  }
                  autoComplete="new-password"
                />
                <div className="pu-form-grid">
                  <TextField
                    label="First name"
                    required
                    value={form.first_name}
                    onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                  />
                  <TextField
                    label="Last name"
                    value={form.last_name}
                    onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                  />
                </div>
                <div className="pu-form-grid">
                  <TextField
                    label="First name (Arabic)"
                    value={form.first_name_ar}
                    onChange={(e) => setForm((f) => ({ ...f, first_name_ar: e.target.value }))}
                  />
                  <TextField
                    label="Last name (Arabic)"
                    value={form.last_name_ar}
                    onChange={(e) => setForm((f) => ({ ...f, last_name_ar: e.target.value }))}
                  />
                </div>
                <TextField
                  label="Phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
                <SelectField
                  label="Platform role"
                  value={form.role_code}
                  onChange={(e) => setForm((f) => ({ ...f, role_code: e.target.value }))}
                  required
                >
                  {roles.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name_en}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="Locale"
                  value={form.locale}
                  onChange={(e) => setForm((f) => ({ ...f, locale: e.target.value }))}
                >
                  {LOCALES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="Timezone"
                  value={form.timezone}
                  onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="Status"
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      status: e.target.value as PlatformUserForm['status'],
                    }))
                  }
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="inactive">Inactive</option>
                </SelectField>
                <FormActions>
                  <Button size="sm" type="button" variant="secondary" onClick={cancelForm}>
                    Cancel
                  </Button>
                  <Button size="sm" type="submit" variant="primary" disabled={saving}>
                    {saving ? 'Saving…' : mode === 'create' ? 'Create operator' : 'Save changes'}
                  </Button>
                </FormActions>
              </form>
            </Panel>
          ) : activeDetail ? (
            <div className="pu-detail">
              <div className="pu-detail-head">
                <span className="pu-detail-mark" aria-hidden>
                  {initials(activeDetail)}
                </span>
                <div>
                  <h3>{activeDetail.name}</h3>
                  <p>
                    {activeDetail.email}
                    {selfId === activeDetail.id ? ' · You' : ''}
                  </p>
                </div>
              </div>

              {detailLoading && !detail ? (
                <p className="pu-muted">Loading details…</p>
              ) : (
                <>
                  <dl className="pu-meta">
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <StatusPill status={activeDetail.status} />
                      </dd>
                    </div>
                    <div>
                      <dt>Role</dt>
                      <dd>{roleLabel(activeDetail.role_code, roles)}</dd>
                    </div>
                    <div>
                      <dt>Phone</dt>
                      <dd>{activeDetail.phone || '—'}</dd>
                    </div>
                    <div>
                      <dt>Locale</dt>
                      <dd>{activeDetail.locale || '—'}</dd>
                    </div>
                    <div>
                      <dt>Timezone</dt>
                      <dd>{activeDetail.timezone || '—'}</dd>
                    </div>
                    <div>
                      <dt>Last login</dt>
                      <dd>{formatWhen(activeDetail.last_login_at)}</dd>
                    </div>
                    <div>
                      <dt>Created</dt>
                      <dd>{formatWhen(activeDetail.created_at)}</dd>
                    </div>
                  </dl>

                  <div className="pu-actions">
                    <Button
                      size="sm"
                      type="button"
                      variant="secondary"
                      onClick={() => startEdit(activeDetail)}
                    >
                      Edit
                    </Button>
                    {activeDetail.status !== 'active' ? (
                      <ConfirmButton
                        size="sm"
                        title="Activate operator?"
                        message={`${activeDetail.name} will be able to sign in to Control.`}
                        confirmLabel="Activate"
                        tone="primary"
                        variant="primary"
                        onConfirm={() => setStatus(activeDetail, 'active')}
                      >
                        Activate
                      </ConfirmButton>
                    ) : (
                      <ConfirmButton
                        size="sm"
                        title="Suspend operator?"
                        message={`${activeDetail.name} will be blocked from signing in until reactivated.`}
                        confirmLabel="Suspend"
                        tone="warn"
                        variant="secondary"
                        onConfirm={() => setStatus(activeDetail, 'suspended')}
                      >
                        Suspend
                      </ConfirmButton>
                    )}
                    {activeDetail.is_last_super_admin || selfId === activeDetail.id ? (
                      <Button
                        size="sm"
                        type="button"
                        variant="danger"
                        disabled
                        title={
                          selfId === activeDetail.id
                            ? 'You cannot delete your own account'
                            : 'Cannot delete the last Super Admin'
                        }
                      >
                        Delete
                      </Button>
                    ) : (
                      <ConfirmButton
                        size="sm"
                        title="Delete operator?"
                        message={`${activeDetail.name} will be soft-deleted and lose Control access.`}
                        confirmLabel="Delete"
                        tone="danger"
                        variant="danger"
                        onConfirm={() => deleteUser(activeDetail)}
                      >
                        Delete
                      </ConfirmButton>
                    )}
                  </div>

                  <div className="pu-links">
                    <Link to="/rbac">Open RBAC assignments</Link>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="pu-detail pu-detail-empty">
              <p className="pu-empty">Select an operator to review details and actions.</p>
              <Button size="sm" type="button" variant="apricot" onClick={startCreate}>
                + New operator
              </Button>
            </div>
          )}
        </aside>
      </div>

      <style>{platformUserStyles}</style>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`pu-pill status-${status}`}>{statusLabel(status)}</span>;
}

const platformUserStyles = `
.pu-page { display: grid; gap: 1rem; }
.pu-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(220px, 0.7fr);
  gap: 1.25rem;
  align-items: end;
  padding: 1.25rem 1.35rem;
  border-radius: 18px;
  border: 1px solid var(--stem-line);
  background:
    radial-gradient(120% 90% at 100% 0%, rgba(12, 124, 128, 0.14), transparent 55%),
    linear-gradient(145deg, #f3faf8, #eef5f2);
}
.pu-eyebrow {
  margin: 0 0 0.3rem;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--stem-teal-deep);
}
.pu-hero-title {
  margin: 0 0 0.35rem;
  font-family: var(--stem-font-display);
  font-size: clamp(1.35rem, 1.8vw, 1.55rem);
  letter-spacing: -0.03em;
}
.pu-hero-lead {
  margin: 0;
  color: var(--stem-ink-soft);
  line-height: 1.5;
  max-width: 42rem;
  font-size: var(--stem-text-base);
}
.pu-hero-actions { display: grid; gap: 0.75rem; justify-items: end; }
.pu-action-row { display: flex; flex-wrap: wrap; gap: 0.45rem; justify-content: flex-end; align-items: center; }
.pu-ghost-link {
  display: inline-flex; align-items: center; min-height: 40px; padding: 0 0.75rem;
  font-size: var(--stem-text-md); font-weight: 600; color: var(--stem-teal-deep); text-decoration: none;
}
.pu-ghost-link:hover { text-decoration: underline; }
.pu-alert {
  display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;
  padding: 0.85rem 1rem; border-radius: 12px; background: #fef3f2; color: var(--stem-danger);
  border: 1px solid #fecdca; font-size: var(--stem-text-base);
}
.pu-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(280px, 0.85fr);
  gap: 1rem;
  align-items: start;
}
.pu-table-wrap { overflow-x: auto; margin: 0 -0.15rem; }
.pu-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--stem-text-base);
}
.pu-table th {
  text-align: left;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--stem-ink-soft);
  padding: 0.55rem 0.65rem;
  border-bottom: 1px solid var(--stem-line);
  white-space: nowrap;
}
.pu-table td {
  padding: 0.7rem 0.65rem;
  border-bottom: 1px solid var(--stem-line);
  vertical-align: top;
}
.pu-table tbody tr {
  cursor: pointer;
  transition: background 0.15s ease;
}
.pu-table tbody tr:hover { background: rgba(18, 160, 171, 0.04); }
.pu-table tbody tr.is-selected { background: rgba(12, 124, 128, 0.08); }
.pu-slug { margin-top: 0.15rem; font-size: var(--stem-text-sm); color: var(--stem-ink-soft); }
.pu-you { font-weight: 700; color: var(--stem-teal-deep); }
.pu-empty { text-align: center; color: var(--stem-ink-soft); padding: 1.5rem 0.75rem !important; }
.pu-side { position: sticky; top: 0.75rem; }
.pu-detail {
  display: grid;
  gap: 1rem;
  padding: 1.1rem 1.15rem;
  border-radius: 16px;
  border: 1px solid var(--stem-line);
  background: #fff;
}
.pu-detail-empty { min-height: 180px; align-content: center; justify-items: start; gap: 0.85rem; }
.pu-detail-head {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}
.pu-detail-mark {
  min-width: 2.75rem;
  height: 2.5rem;
  padding: 0 0.55rem;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: var(--stem-text-md);
  letter-spacing: 0.04em;
  background: #eef8f6;
  color: #055456;
  border: 1px solid rgba(12, 124, 128, 0.22);
}
.pu-detail-head h3 {
  margin: 0;
  font-size: var(--stem-text-xl);
  letter-spacing: -0.02em;
}
.pu-detail-head p {
  margin: 0.15rem 0 0;
  font-size: var(--stem-text-md);
  color: var(--stem-ink-soft);
}
.pu-meta {
  display: grid;
  gap: 0.55rem;
  margin: 0;
}
.pu-meta > div {
  display: grid;
  grid-template-columns: 7.5rem minmax(0, 1fr);
  gap: 0.5rem;
  align-items: baseline;
}
.pu-meta dt {
  margin: 0;
  font-size: var(--stem-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--stem-ink-soft);
}
.pu-meta dd { margin: 0; font-size: var(--stem-text-base); }
.pu-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--stem-line);
}
.pu-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  padding-top: 0.25rem;
}
.pu-links a {
  font-size: var(--stem-text-md);
  font-weight: 600;
  color: var(--stem-teal-deep);
  text-decoration: none;
}
.pu-links a:hover { text-decoration: underline; }
.pu-form { display: grid; gap: 0.85rem; }
.pu-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}
.pu-pill {
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
.pu-pill.status-active { background: #ecfdf5; color: #047857; }
.pu-pill.status-suspended { background: #fff7ed; color: #c2410c; }
.pu-pill.status-inactive { background: #f3f4f6; color: #4b5563; }
.pu-muted { color: var(--stem-ink-soft); font-size: var(--stem-text-base); margin: 0; }
@media (max-width: 960px) {
  .pu-hero, .pu-layout, .pu-form-grid { grid-template-columns: 1fr; }
  .pu-hero-actions { justify-items: start; }
  .pu-action-row { justify-content: flex-start; }
  .pu-side { position: static; }
}
`;
