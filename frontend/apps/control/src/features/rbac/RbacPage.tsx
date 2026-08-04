import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import {
  Button,
  ConfirmButton,
  FormActions,
  Panel,
  SelectField,
  StatStrip,
  Toolbar,
  useFeedback,
  validateFormFields,
} from '@stemora/ui';
import { ControlLayout } from '../../layout/ControlLayout';

type RoleRow = {
  id: number;
  code: string;
  name_en: string;
  name_ar?: string;
  portal: string;
  level: number;
  description_en?: string | null;
  is_system: boolean;
  is_wildcard: boolean;
  permission_codes: string[];
  permissions_count: number;
  parent?: { code: string; name_en: string } | null;
};

type PermissionRow = {
  id: number;
  code: string;
  group_code: string;
  name_en: string;
  name_ar?: string;
};

type AssignmentUser = {
  id: number;
  email: string;
  name: string;
  status: string;
  tenant: { id: number; name: string; slug: string } | null;
  assignments: {
    id: number;
    tenant_id: number;
    role: { id: number; code: string; name_en: string; portal: string; level: number } | null;
  }[];
};

type TenantOption = { id: number; name: string; slug: string; status: string };

type TabId = 'access' | 'roles' | 'assignments';

function portalLabel(portal: string) {
  if (portal === 'control') return 'Control';
  if (portal === 'institution') return 'Institution';
  if (portal === 'learner') return 'Learner';
  return portal;
}

export function RbacPage() {
  const { hasPermission, isSuperAdmin, isTenantOwner } = useAuth();
  const canView =
    isSuperAdmin ||
    hasPermission(['platform.rbac.manage', 'platform.tenants.manage', 'tenant.settings.manage', 'school.users.manage', 'audit.logs.view']);

  if (!canView) {
    return <Navigate to="/" replace />;
  }

  return (
    <ControlLayout
      title="Roles & access"
      subtitle="Manage roles, permissions, and user assignments across Stemora portals"
    >
      <RbacWorkspace canEditMatrix={isSuperAdmin || hasPermission('platform.rbac.manage')} canAssign={isSuperAdmin || hasPermission(['platform.rbac.manage', 'school.users.manage', 'tenant.settings.manage'])} isPlatform={isSuperAdmin || hasPermission('platform.rbac.manage')} isTenantOwner={isTenantOwner} />
    </ControlLayout>
  );
}

function RbacWorkspace({
  canEditMatrix,
  canAssign,
  isPlatform,
}: {
  canEditMatrix: boolean;
  canAssign: boolean;
  isPlatform: boolean;
  isTenantOwner: boolean;
}) {
  const { api, session, roles: myRoles, permissions: myPermissions, hasPermission } = useAuth();
  const feedback = useFeedback();

  const [tab, setTab] = useState<TabId>('roles');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [selectedRoleCode, setSelectedRoleCode] = useState<string | null>(null);
  const [draftPerms, setDraftPerms] = useState<string[]>([]);
  const [savingRole, setSavingRole] = useState(false);

  const [users, setUsers] = useState<AssignmentUser[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [assignUserId, setAssignUserId] = useState('');
  const [assignRole, setAssignRole] = useState('');
  const [assignTenantId, setAssignTenantId] = useState('');
  const [assigning, setAssigning] = useState(false);

  const selectedRole = useMemo(
    () => roles.find((r) => r.code === selectedRoleCode) ?? null,
    [roles, selectedRoleCode],
  );

  const groupedPermissions = useMemo(() => {
    const map = new Map<string, PermissionRow[]>();
    for (const p of permissions) {
      const list = map.get(p.group_code) ?? [];
      list.push(p);
      map.set(p.group_code, list);
    }
    return Array.from(map.entries());
  }, [permissions]);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        api.get<{ data: RoleRow[] }>('/control/rbac/roles'),
        api.get<{ data: PermissionRow[] }>('/control/rbac/permissions'),
      ]);
      setRoles(rolesRes.data);
      setPermissions(permsRes.data);
      setSelectedRoleCode((prev) => prev ?? rolesRes.data[0]?.code ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load RBAC catalogue');
    } finally {
      setLoading(false);
    }
  }, [api]);

  const loadAssignments = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (roleFilter) params.set('role', roleFilter);
      if (tenantFilter) params.set('tenant_id', tenantFilter);
      const qs = params.toString();
      const res = await api.get<{ data: AssignmentUser[] }>(
        `/control/rbac/assignments${qs ? `?${qs}` : ''}`,
      );
      setUsers(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assignments');
    }
  }, [api, search, roleFilter, tenantFilter]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (selectedRole) {
      setDraftPerms(selectedRole.is_wildcard ? [] : [...selectedRole.permission_codes]);
    }
  }, [selectedRole]);

  useEffect(() => {
    if (tab === 'assignments' && canAssign) {
      void loadAssignments();
    }
  }, [tab, canAssign, loadAssignments]);

  useEffect(() => {
    if (!isPlatform) return;
    void (async () => {
      try {
        const res = await api.get<{ data: TenantOption[] }>('/control/rbac/tenants');
        setTenants(res.data);
      } catch {
        /* optional for non-platform */
      }
    })();
  }, [api, isPlatform]);

  async function saveRolePermissions() {
    if (!selectedRole || selectedRole.is_wildcard) return;
    setSavingRole(true);
    setError(null);
    try {
      await api.request(`/control/rbac/roles/${selectedRole.id}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permission_codes: draftPerms }),
      });
      await feedback.success({
        title: 'Permissions updated',
        message: `${selectedRole.name_en} now has ${draftPerms.length} permission(s).`,
      });
      await loadCatalog();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save permissions');
    } finally {
      setSavingRole(false);
    }
  }

  async function onAssign(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateFormFields(e.currentTarget)) return;
    setAssigning(true);
    setError(null);
    try {
      await api.post('/control/rbac/assignments', {
        user_id: Number(assignUserId),
        role_code: assignRole,
        tenant_id: assignTenantId ? Number(assignTenantId) : undefined,
      });
      await feedback.success({ title: 'Role assigned', message: 'User access was updated.' });
      setAssignRole('');
      await loadAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not assign role');
    } finally {
      setAssigning(false);
    }
  }

  async function revokeAssignment(assignmentId: number, label: string) {
    try {
      await api.request(`/control/rbac/assignments/${assignmentId}`, { method: 'DELETE' });
      await feedback.success({ title: 'Assignment revoked', message: `${label} was removed.` });
      await loadAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not revoke assignment');
    }
  }

  function togglePerm(code: string) {
    setDraftPerms((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  function toggleGroup(groupCodes: string[], checked: boolean) {
    setDraftPerms((prev) => {
      if (checked) return Array.from(new Set([...prev, ...groupCodes]));
      return prev.filter((c) => !groupCodes.includes(c));
    });
  }

  if (loading && roles.length === 0) {
    return <p style={{ color: 'var(--stem-ink-soft)' }}>Loading access control…</p>;
  }

  const dirty =
    selectedRole &&
    !selectedRole.is_wildcard &&
    (draftPerms.length !== selectedRole.permission_codes.length ||
      draftPerms.some((c) => !selectedRole.permission_codes.includes(c)));

  return (
    <div className="rbac-page">
      {error ? <div className="rbac-alert">{error}</div> : null}

      <StatStrip
        items={[
          { label: 'Roles', value: String(roles.length) },
          { label: 'Permissions', value: String(permissions.length) },
          { label: 'Your roles', value: String(myRoles.length) },
          { label: 'Your grants', value: myRoles.includes('super_admin') ? 'All' : String(myPermissions.length) },
        ]}
      />

      <div className="rbac-tabs" role="tablist" aria-label="RBAC tools">
        {(
          [
            { id: 'access', label: 'My access' },
            { id: 'roles', label: 'Roles & matrix' },
            ...(canAssign ? [{ id: 'assignments' as const, label: 'Assignments' }] : []),
          ] as { id: TabId; label: string }[]
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? 'is-active' : undefined}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'access' ? (
        <div className="rbac-access-grid">
          <Panel title="Signed-in identity" description="Roles and permissions attached to your current session.">
            <dl className="rbac-identity">
              <div>
                <dt>Name</dt>
                <dd>{session?.user.name}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{session?.user.email}</dd>
              </div>
              <div>
                <dt>Organisation</dt>
                <dd>{session?.tenantSlug ?? 'Platform'}</dd>
              </div>
            </dl>
            <div className="rbac-chip-block">
              <h4>Roles</h4>
              <div className="rbac-chips">
                {myRoles.length ? myRoles.map((r) => <span key={r} className="rbac-chip is-role">{r}</span>) : <span className="rbac-muted">None</span>}
              </div>
            </div>
          </Panel>
          <Panel title="Effective permissions" description="Resolved from your role matrix for this portal session.">
            <div className="rbac-perm-list">
              {myRoles.includes('super_admin') ? (
                <p className="rbac-muted">Super Admin — full platform access (`*`).</p>
              ) : myPermissions.length === 0 ? (
                <p className="rbac-muted">No permissions on this session. Sign out and sign in again after role changes.</p>
              ) : (
                myPermissions.map((code) => (
                  <code key={code} className="rbac-perm-code">
                    {code}
                  </code>
                ))
              )}
            </div>
          </Panel>
        </div>
      ) : null}

      {tab === 'roles' ? (
        <div className="rbac-roles-layout">
          <Panel title="Role catalogue" description="System roles across Control, Institution, and Learner portals.">
            <div className="rbac-role-list">
              {roles.map((role) => (
                <button
                  key={role.code}
                  type="button"
                  className={`rbac-role-card ${selectedRoleCode === role.code ? 'is-selected' : ''}`}
                  onClick={() => setSelectedRoleCode(role.code)}
                >
                  <div className="rbac-role-card-top">
                    <strong>{role.name_en}</strong>
                    <span className="rbac-portal">{portalLabel(role.portal)}</span>
                  </div>
                  <code>{role.code}</code>
                  <p>{role.description_en || '—'}</p>
                  <div className="rbac-role-meta">
                    <span>Level {role.level}</span>
                    <span>
                      {role.is_wildcard ? 'All permissions' : `${role.permissions_count} permissions`}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </Panel>

          <Panel
            title={selectedRole ? selectedRole.name_en : 'Permission matrix'}
            description={
              selectedRole
                ? selectedRole.is_wildcard
                  ? 'This role always receives every permission.'
                  : canEditMatrix
                    ? 'Toggle grants, then save to update live access.'
                    : 'Read-only view of permissions for this role.'
                : 'Select a role to inspect permissions.'
            }
            action={
              selectedRole && canEditMatrix && !selectedRole.is_wildcard ? (
                <FormActions>
                  <Button size="sm" type="button" variant="secondary" disabled={!dirty || savingRole} onClick={() => setDraftPerms([...selectedRole.permission_codes])}>
                    Reset
                  </Button>
                  <ConfirmButton size="sm"
                    title="Save permission changes?"
                    message={`Update live grants for ${selectedRole.name_en}. Active sessions refresh on next permission check / re-login.`}
                    confirmLabel="Save matrix"
                    tone="primary"
                    variant="primary"
                    onConfirm={saveRolePermissions}
                  >
                    {savingRole ? 'Saving…' : 'Save permissions'}
                  </ConfirmButton>
                </FormActions>
              ) : null
            }
          >
            {!selectedRole ? (
              <p className="rbac-muted">Choose a role from the catalogue.</p>
            ) : selectedRole.is_wildcard ? (
              <div className="rbac-wildcard">
                <strong>Wildcard access</strong>
                <p>Super Admin resolves to every permission in the catalogue. Matrix edits are disabled.</p>
              </div>
            ) : (
              <div className="rbac-matrix">
                {groupedPermissions.map(([group, items]) => {
                  const codes = items.map((i) => i.code);
                  const allOn = codes.every((c) => draftPerms.includes(c));
                  const someOn = codes.some((c) => draftPerms.includes(c));
                  return (
                    <section key={group} className="rbac-matrix-group">
                      <header>
                        <label className="rbac-group-toggle">
                          <input
                            type="checkbox"
                            checked={allOn}
                            ref={(el) => {
                              if (el) el.indeterminate = !allOn && someOn;
                            }}
                            disabled={!canEditMatrix}
                            onChange={(e) => toggleGroup(codes, e.target.checked)}
                          />
                          <span>{group}</span>
                        </label>
                        <span className="rbac-muted">
                          {codes.filter((c) => draftPerms.includes(c)).length}/{codes.length}
                        </span>
                      </header>
                      <ul>
                        {items.map((perm) => (
                          <li key={perm.code}>
                            <label>
                              <input
                                type="checkbox"
                                checked={draftPerms.includes(perm.code)}
                                disabled={!canEditMatrix}
                                onChange={() => togglePerm(perm.code)}
                              />
                              <span>
                                <strong>{perm.name_en}</strong>
                                <code>{perm.code}</code>
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      ) : null}

      {tab === 'assignments' && canAssign ? (
        <div className="rbac-assign-layout">
          <Panel
            title="User assignments"
            description="Attach portal roles to users. Control roles require platform privileges."
            action={
              <Toolbar as="form" onSubmit={(e) => { e.preventDefault(); void loadAssignments(); }}>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name or email"
                  aria-label="Search users"
                />
                <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Filter by role">
                  <option value="">All roles</option>
                  {roles.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name_en}
                    </option>
                  ))}
                </select>
                {isPlatform ? (
                  <select value={tenantFilter} onChange={(e) => setTenantFilter(e.target.value)} aria-label="Filter by tenant">
                    <option value="">All organisations</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                <Button size="sm" type="submit" variant="secondary">
                  Apply
                </Button>
              </Toolbar>
            }
          >
            <div className="rbac-table-wrap">
              <table className="rbac-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Organisation</th>
                    <th>Roles</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="rbac-muted">
                        No users match this filter.
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <strong>{user.name}</strong>
                          <div className="rbac-muted">{user.email}</div>
                        </td>
                        <td>{user.tenant ? `${user.tenant.name} (${user.tenant.slug})` : 'Platform'}</td>
                        <td>
                          <div className="rbac-chips">
                            {user.assignments.length === 0 ? (
                              <span className="rbac-muted">No roles</span>
                            ) : (
                              user.assignments.map((a) => (
                                <span key={a.id} className="rbac-chip is-role">
                                  {a.role?.name_en ?? 'Unknown'}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="rbac-row-actions">
                            {user.assignments.map((a) => (
                              <ConfirmButton size="sm"
                                key={a.id}
                                title="Revoke role?"
                                message={`Remove ${a.role?.name_en ?? 'role'} from ${user.name}.`}
                                confirmLabel="Revoke"
                                tone="danger"
                                variant="danger"
                                onConfirm={() => revokeAssignment(a.id, a.role?.name_en ?? 'Role')}
                              >
                                Revoke {a.role?.code}
                              </ConfirmButton>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Assign role" description="Grant a role to a user in scope.">
            <form onSubmit={onAssign} noValidate className="rbac-assign-form">
              <SelectField
                label="User"
                required
                value={assignUserId}
                onChange={(e) => {
                  setAssignUserId(e.target.value);
                  const u = users.find((x) => String(x.id) === e.target.value);
                  if (u?.tenant && isPlatform) setAssignTenantId(String(u.tenant.id));
                }}
              >
                <option value="">Select user</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} · {u.email}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Role" required value={assignRole} onChange={(e) => setAssignRole(e.target.value)}>
                <option value="">Select role</option>
                {roles
                  .filter((r) => (isPlatform ? true : r.portal !== 'control' || r.code === 'school_owner'))
                  .map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name_en} ({r.code})
                    </option>
                  ))}
              </SelectField>
              {isPlatform && assignRole !== 'super_admin' ? (
                <SelectField
                  label="Organisation"
                  required
                  value={assignTenantId}
                  onChange={(e) => setAssignTenantId(e.target.value)}
                >
                  <option value="">Select organisation</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.slug})
                    </option>
                  ))}
                </SelectField>
              ) : null}
              <FormActions>
                <Button size="sm" type="submit" variant="apricot" disabled={assigning}>
                  {assigning ? 'Assigning…' : 'Assign role'}
                </Button>
              </FormActions>
            </form>
          </Panel>
        </div>
      ) : null}

      <style>{rbacStyles}</style>
    </div>
  );
}

const rbacStyles = `
.rbac-page { display: grid; gap: 1rem; }
.rbac-alert {
  padding: 0.75rem 1rem;
  border-radius: 12px;
  background: #fef3f2;
  color: var(--stem-danger);
  border: 1px solid #fecdca;
  font-size: var(--stem-text-base);
}
.rbac-tabs {
  display: inline-flex;
  gap: 0.35rem;
  padding: 0.3rem;
  border-radius: 14px;
  background: rgba(255,255,255,0.8);
  border: 1px solid var(--stem-line);
  width: fit-content;
  max-width: 100%;
  flex-wrap: wrap;
}
.rbac-tabs button {
  border: none;
  background: transparent;
  padding: 0.55rem 1rem;
  border-radius: 10px;
  font: inherit;
  font-weight: 600;
  font-size: var(--stem-text-md);
  color: var(--stem-ink-soft);
  cursor: pointer;
}
.rbac-tabs button.is-active {
  background: linear-gradient(135deg, var(--stem-teal-bright), var(--stem-teal-deep));
  color: #fff;
  box-shadow: 0 8px 18px rgba(5, 84, 86, 0.18);
}
.rbac-access-grid,
.rbac-roles-layout,
.rbac-assign-layout {
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.35fr);
  gap: 1rem;
  align-items: start;
}
.rbac-identity {
  display: grid;
  gap: 0.65rem;
  margin: 0 0 1rem;
}
.rbac-identity > div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: var(--stem-text-base);
}
.rbac-identity dt { margin: 0; color: var(--stem-ink-soft); }
.rbac-identity dd { margin: 0; font-weight: 600; text-align: right; }
.rbac-chip-block h4 { margin: 0 0 0.5rem; font-size: var(--stem-text-md); }
.rbac-chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.rbac-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.28rem 0.55rem;
  border-radius: 999px;
  font-size: var(--stem-text-sm);
  font-weight: 600;
  background: var(--stem-mint-soft);
  color: var(--stem-teal-deep);
  border: 1px solid rgba(12, 124, 128, 0.18);
}
.rbac-perm-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  max-height: 420px;
  overflow: auto;
}
.rbac-perm-code {
  font-size: var(--stem-text-sm);
  padding: 0.3rem 0.5rem;
  border-radius: 8px;
  background: #f8fafb;
  border: 1px solid var(--stem-line);
}
.rbac-role-list {
  display: grid;
  gap: 0.55rem;
  max-height: 640px;
  overflow: auto;
  padding-right: 0.15rem;
}
.rbac-role-card {
  text-align: left;
  border: 1px solid var(--stem-line);
  background: #fff;
  border-radius: 14px;
  padding: 0.85rem 0.95rem;
  cursor: pointer;
  display: grid;
  gap: 0.35rem;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
}
.rbac-role-card:hover { border-color: rgba(12, 124, 128, 0.45); }
.rbac-role-card.is-selected {
  border-color: var(--stem-teal);
  box-shadow: 0 0 0 3px rgba(12, 124, 128, 0.12);
  background: linear-gradient(180deg, #f4fbfb, #fff);
}
.rbac-role-card-top {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  align-items: center;
  min-width: 0;
}
.rbac-role-card-top > *:first-child {
  min-width: 0;
  flex: 1 1 auto;
  overflow-wrap: anywhere;
}
.rbac-role-card code {
  font-size: var(--stem-text-sm);
  color: var(--stem-ink-soft);
  overflow-wrap: anywhere;
  word-break: break-word;
}
.rbac-role-card p {
  margin: 0;
  font-size: var(--stem-text-md);
  color: var(--stem-ink-soft);
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.rbac-role-meta {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: var(--stem-text-sm);
  color: var(--stem-ink-soft);
  font-weight: 600;
}
.rbac-portal {
  font-size: var(--stem-text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--stem-apricot-deep);
}
.rbac-matrix { display: grid; gap: 0.85rem; }
.rbac-matrix-group {
  border: 1px solid var(--stem-line);
  border-radius: 14px;
  overflow: hidden;
  background: #fff;
}
.rbac-matrix-group header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 0.9rem;
  background: var(--stem-mint-soft);
  border-bottom: 1px solid var(--stem-line);
}
.rbac-group-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  font-weight: 700;
  text-transform: capitalize;
  cursor: pointer;
}
.rbac-matrix-group ul {
  list-style: none;
  margin: 0;
  padding: 0.35rem 0;
}
.rbac-matrix-group li label {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.65rem;
  align-items: start;
  padding: 0.55rem 0.9rem;
  cursor: pointer;
}
.rbac-matrix-group li label:hover { background: rgba(6, 90, 94, 0.04); }
.rbac-matrix-group li span {
  display: grid;
  gap: 0.15rem;
}
.rbac-matrix-group li strong { font-size: var(--stem-text-base); }
.rbac-matrix-group li code {
  font-size: var(--stem-text-sm);
  color: var(--stem-ink-soft);
}
.rbac-wildcard {
  padding: 1.25rem;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(12,124,128,0.08), rgba(240,160,92,0.1));
  border: 1px solid var(--stem-line);
}
.rbac-wildcard p { margin: 0.4rem 0 0; color: var(--stem-ink-soft); }
.rbac-table-wrap { overflow-x: auto; }
.rbac-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--stem-text-base);
  min-width: 640px;
}
.rbac-table th {
  text-align: left;
  padding: 0.65rem 0.55rem;
  border-bottom: 1px solid var(--stem-line);
  color: var(--stem-ink-soft);
  font-size: var(--stem-text-sm);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.rbac-table td {
  padding: 0.75rem 0.55rem;
  border-bottom: 1px solid var(--stem-line);
  vertical-align: top;
}
.rbac-row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.rbac-assign-form { display: grid; gap: 0.85rem; }
.rbac-muted { color: var(--stem-ink-soft); margin: 0; }
@media (max-width: 980px) {
  .rbac-access-grid,
  .rbac-roles-layout,
  .rbac-assign-layout { grid-template-columns: 1fr; }
}
`;
