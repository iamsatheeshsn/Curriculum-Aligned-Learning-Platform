import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import {
  Button,
  PaginationBar,
  useClientPagination,
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

type GroupMember = {
  id: number;
  name: string;
  slug: string;
  status: string;
  schools_count?: number;
};

type TenantOption = {
  id: number;
  name: string;
  slug: string;
  status: string;
  tenant_group_id: number | null;
};

type SchoolGroup = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  country_code: string | null;
  notes: string | null;
  members_count: number;
  members?: GroupMember[];
  created_at?: string | null;
  updated_at?: string | null;
};

type GroupStats = {
  total_groups: number;
  active: number;
  inactive: number;
  members: number;
  ungrouped: number;
};

type GroupForm = {
  name: string;
  slug: string;
  description: string;
  status: string;
  country_code: string;
  notes: string;
  tenant_ids: number[];
};

const emptyForm = (): GroupForm => ({
  name: '',
  slug: '',
  description: '',
  status: 'active',
  country_code: '',
  notes: '',
  tenant_ids: [],
});


/**
 * Control workspace for school / multi-tenant groups (networks, trusts, regions).
 */
export function SchoolGroupsPage() {
  const { isSuperAdmin, hasPermission } = useAuth();
  if (!isSuperAdmin && !hasPermission('platform.tenants.manage')) {
    return <Navigate to="/" replace />;
  }

  return (
    <ControlLayout
      title="School Groups"
      subtitle="Organise tenants into networks, trusts, and regional groups"
    >
      <SchoolGroupsWorkspace />
    </ControlLayout>
  );
}

function SchoolGroupsWorkspace() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [groups, setGroups] = useState<SchoolGroup[]>([]);
  const listPage = useClientPagination(groups);

  const [stats, setStats] = useState<GroupStats | null>(null);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<SchoolGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view');
  const [form, setForm] = useState<GroupForm>(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      const qs = params.toString();
      const res = await api.get<{
        data: SchoolGroup[];
        meta: { stats: GroupStats; tenants: TenantOption[] };
      }>(`/control/tenant-groups${qs ? `?${qs}` : ''}`);
      setGroups(res.data);
      setStats(res.meta.stats);
      setTenants(res.meta.tenants);
      setSelectedId((current) => {
        if (current && res.data.some((g) => g.id === current)) return current;
        return res.data[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load school groups');
    } finally {
      setLoading(false);
    }
  }, [api, search, statusFilter]);

  useEffect(() => {
    void load();
  }, [api, statusFilter]);

  useEffect(() => {
    if (!selectedId || mode === 'create') {
      if (mode !== 'create') setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void (async () => {
      try {
        const res = await api.get<{ data: SchoolGroup }>(`/control/tenant-groups/${selectedId}`);
        if (!cancelled) setDetail(res.data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load group details');
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, selectedId, mode, groups]);

  const selectedSummary = useMemo(
    () => groups.find((g) => g.id === selectedId) ?? null,
    [groups, selectedId],
  );

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

  async function startEdit(group: SchoolGroup) {
    setMode('edit');
    let source = group;
    if (!group.members) {
      try {
        const res = await api.get<{ data: SchoolGroup }>(`/control/tenant-groups/${group.id}`);
        source = res.data;
        setDetail(res.data);
      } catch {
        /* fall through with summary */
      }
    }
    setForm({
      name: source.name,
      slug: source.slug,
      description: source.description ?? '',
      status: source.status,
      country_code: source.country_code ?? '',
      notes: source.notes ?? '',
      tenant_ids: (source.members ?? []).map((m) => m.id),
    });
  }

  function cancelForm() {
    setMode('view');
    setForm(emptyForm());
    if (selectedSummary) setSelectedId(selectedSummary.id);
    else if (groups[0]) setSelectedId(groups[0].id);
  }

  function toggleMember(id: number) {
    setForm((prev) => ({
      ...prev,
      tenant_ids: prev.tenant_ids.includes(id)
        ? prev.tenant_ids.filter((x) => x !== id)
        : [...prev.tenant_ids, id],
    }));
  }

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateFormFields(e.currentTarget)) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        description: form.description.trim() || null,
        status: form.status,
        country_code: form.country_code || null,
        notes: form.notes.trim() || null,
        tenant_ids: form.tenant_ids,
      };

      if (mode === 'create') {
        const res = await api.post<{ message: string; data: SchoolGroup }>(
          '/control/tenant-groups',
          body,
        );
        await feedback.success({
          title: 'Group created',
          message: `${res.data.name} is ready with ${res.data.members_count} member(s).`,
        });
        setMode('view');
        setSelectedId(res.data.id);
      } else if (mode === 'edit' && selectedId) {
        const res = await api.request<{ message: string; data: SchoolGroup }>(
          `/control/tenant-groups/${selectedId}`,
          { method: 'PUT', body: JSON.stringify(body) },
        );
        await feedback.success({
          title: 'Group updated',
          message: `${res.data.name} was saved.`,
        });
        setMode('view');
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save school group');
    } finally {
      setSaving(false);
    }
  }

  async function deleteGroup(group: SchoolGroup) {
    try {
      await api.request(`/control/tenant-groups/${group.id}`, { method: 'DELETE' });
      await feedback.success({
        title: 'Group deleted',
        message: `${group.name} was removed. Member tenants are now ungrouped.`,
      });
      if (selectedId === group.id) {
        setSelectedId(null);
        setDetail(null);
      }
      setMode('view');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete group');
    }
  }

  async function setGroupStatus(group: SchoolGroup, status: string) {
    try {
      await api.request(`/control/tenant-groups/${group.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      await feedback.success({
        title: 'Status updated',
        message: `${group.name} is now ${statusLabel(status)}.`,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update status');
    }
  }

  if (loading && groups.length === 0 && !stats) {
    return <p className="sg-muted">Loading school groups…</p>;
  }

  if (error && !stats && groups.length === 0) {
    return (
      <Panel title="Unable to load school groups">
        <p style={{ color: 'var(--stem-danger)', marginTop: 0 }}>{error}</p>
        <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
          Retry
        </Button>
      </Panel>
    );
  }

  const showingForm = mode === 'create' || mode === 'edit';
  const activeDetail = detail ?? selectedSummary;

  return (
    <div className="sg-page">
      <section className="sg-hero stem-animate-rise">
        <div>
          <p className="sg-eyebrow">Control · Tenant management</p>
          <h2 className="sg-hero-title">School groups</h2>
          <p className="sg-hero-lead">
            Cluster related school organisations into networks and trusts for clearer oversight,
            reporting, and support.
          </p>
        </div>
        <div className="sg-hero-actions">
          <div className="sg-action-row">
            <Button size="sm" type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Link to="/tenants" className="sg-ghost-link">
              Tenant directory
            </Link>
            <Button type="button" variant="apricot" onClick={startCreate} size="sm">
              + New group
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="sg-alert" role="alert">
          <span>{error}</span>
          <Button size="sm" type="button" variant="secondary" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <StatStrip
        items={[
          { label: 'Groups', value: String(stats?.total_groups ?? '—') },
          { label: 'Active', value: String(stats?.active ?? '—') },
          { label: 'Grouped tenants', value: String(stats?.members ?? '—') },
          { label: 'Ungrouped', value: String(stats?.ungrouped ?? '—') },
        ]}
      />

      <div className="sg-layout">
        <Panel
          title="Groups directory"
          description="Search and select a group to review members or edit details."
          action={
            <Toolbar as="form" onSubmit={onSearch}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or slug"
                aria-label="Search groups"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <Button type="submit" variant="secondary" size="sm">
                Apply
              </Button>
            </Toolbar>
          }
        >
          <div className="sg-table-wrap">
            <table className="sg-table">
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Status</th>
                  <th>Country</th>
                  <th>Members</th>
                </tr>
              </thead>
              <tbody>
                {groups.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="sg-empty">
                      No groups yet. Create one to organise related schools.
                    </td>
                  </tr>
                ) : (
                  listPage.pageItems.map((row) => (
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
                        <div className="sg-slug">
                          <code>{row.slug}</code>
                        </div>
                      </td>
                      <td>
                        <StatusPill status={row.status} />
                      </td>
                      <td>{row.country_code ?? '—'}</td>
                      <td>{row.members_count}</td>
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

        <aside className="sg-side" aria-live="polite">
          {showingForm ? (
            <Panel
              title={mode === 'create' ? 'Create school group' : 'Edit school group'}
              description={
                mode === 'create'
                  ? 'Name the network and assign member organisations.'
                  : 'Update details and membership for this group.'
              }
            >
              <form onSubmit={onSave} className="sg-form" noValidate>
                <div className="sg-form-grid">
                  <TextField
                    label="Group name"
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                  <TextField
                    label="Slug"
                    value={form.slug}
                    placeholder="auto from name"
                    hint="Lowercase letters, numbers, hyphens"
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                      }))
                    }
                  />
                  <SelectField
                    label="Status"
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </SelectField>
                  <SelectField
                    label="Country"
                    value={form.country_code}
                    onChange={(e) => setForm((f) => ({ ...f, country_code: e.target.value }))}
                  >
                    <option value="">Not set</option>
                    <option value="SA">Saudi Arabia (SA)</option>
                    <option value="AE">United Arab Emirates (AE)</option>
                    <option value="KW">Kuwait (KW)</option>
                    <option value="BH">Bahrain (BH)</option>
                    <option value="OM">Oman (OM)</option>
                    <option value="QA">Qatar (QA)</option>
                  </SelectField>
                </div>
                <TextField
                  label="Description"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
                <TextField
                  label="Internal notes"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />

                <fieldset className="sg-members">
                  <legend>Member organisations</legend>
                  <p className="sg-hint">
                    A tenant can belong to one group. Selecting a tenant moves it into this group.
                  </p>
                  <div className="sg-member-list">
                    {tenants.length === 0 ? (
                      <p className="sg-muted">No tenants available.</p>
                    ) : (
                      tenants.map((t) => {
                        const checked = form.tenant_ids.includes(t.id);
                        const elsewhere =
                          t.tenant_group_id != null &&
                          t.tenant_group_id !== selectedId &&
                          !checked;
                        return (
                          <label key={t.id} className={`sg-member-row ${checked ? 'is-on' : ''}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleMember(t.id)}
                            />
                            <span>
                              <strong>{t.name}</strong>
                              <span className="sg-member-meta">
                                <code>{t.slug}</code>
                                <StatusPill status={t.status} />
                                {elsewhere ? (
                                  <em className="sg-elsewhere">In another group</em>
                                ) : null}
                              </span>
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </fieldset>

                <FormActions>
                  <Button type="button" variant="secondary" onClick={cancelForm} size="sm">
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" disabled={saving} size="sm">
                    {saving ? 'Saving…' : mode === 'create' ? 'Create group' : 'Save changes'}
                  </Button>
                </FormActions>
              </form>
            </Panel>
          ) : activeDetail ? (
            <div className="sg-detail">
              <div className="sg-detail-head">
                <span className="sg-detail-mark" aria-hidden>
                  {activeDetail.name.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <h3>{activeDetail.name}</h3>
                  <p>
                    <code>{activeDetail.slug}</code>
                  </p>
                </div>
              </div>

              {detailLoading && !detail ? (
                <p className="sg-muted">Loading details…</p>
              ) : (
                <>
                  <dl className="sg-meta">
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <StatusPill status={activeDetail.status} />
                      </dd>
                    </div>
                    <div>
                      <dt>Country</dt>
                      <dd>{activeDetail.country_code ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Members</dt>
                      <dd>{activeDetail.members_count}</dd>
                    </div>
                    <div>
                      <dt>Updated</dt>
                      <dd>
                        {activeDetail.updated_at
                          ? new Date(activeDetail.updated_at).toLocaleDateString()
                          : '—'}
                      </dd>
                    </div>
                  </dl>

                  {activeDetail.description ? (
                    <p className="sg-desc">{activeDetail.description}</p>
                  ) : null}

                  <div className="sg-actions">
                    <Button
                      type="button"
                      variant="primary" size="sm"
                      onClick={() => void startEdit(detail ?? activeDetail)}
                      disabled={!detail && detailLoading}
                    >
                      Edit
                    </Button>
                    {activeDetail.status === 'inactive' ? (
                      <ConfirmButton size="sm"
                        title="Activate group?"
                        message={`Mark ${activeDetail.name} as active.`}
                        confirmLabel="Activate"
                        tone="primary"
                        variant="secondary"
                        onConfirm={() => setGroupStatus(activeDetail, 'active')}
                      >
                        Activate
                      </ConfirmButton>
                    ) : (
                      <ConfirmButton size="sm"
                        title="Deactivate group?"
                        message={`${activeDetail.name} will be marked inactive. Members stay assigned.`}
                        confirmLabel="Deactivate"
                        tone="warn"
                        variant="secondary"
                        onConfirm={() => setGroupStatus(activeDetail, 'inactive')}
                      >
                        Deactivate
                      </ConfirmButton>
                    )}
                    <ConfirmButton size="sm"
                      title="Delete group?"
                      message="Members will be ungrouped. This soft-deletes the group."
                      confirmLabel="Delete"
                      tone="danger"
                      variant="danger"
                      onConfirm={() => deleteGroup(activeDetail)}
                    >
                      Delete
                    </ConfirmButton>
                  </div>

                  <div className="sg-member-panel">
                    <h4>Members</h4>
                    {(detail?.members?.length ?? 0) === 0 ? (
                      <p className="sg-muted">No organisations in this group yet.</p>
                    ) : (
                      <ul className="sg-list">
                        {detail!.members!.map((m) => (
                          <li key={m.id}>
                            <div>
                              <strong>{m.name}</strong>
                              <div className="sg-slug">
                                <code>{m.slug}</code>
                              </div>
                            </div>
                            <div className="sg-member-right">
                              <StatusPill status={m.status} />
                              <span>{m.schools_count ?? 0} schools</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="sg-detail sg-detail-empty">
              <p className="sg-empty">Select a group or create a new one to get started.</p>
              <Button type="button" variant="apricot" onClick={startCreate} size="sm">
                + New group
              </Button>
            </div>
          )}
        </aside>
      </div>

      <style>{schoolGroupsStyles}</style>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`sg-pill status-${status}`}>{statusLabel(status)}</span>;
}

const schoolGroupsStyles = `
.sg-page { display: grid; gap: 1rem; }
.sg-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(220px, 0.7fr);
  gap: 1.25rem;
  align-items: end;
  padding: 1.25rem 1.35rem;
  border-radius: 18px;
  border: 1px solid var(--stem-line);
  background:
    radial-gradient(120% 90% at 100% 0%, rgba(18, 160, 171, 0.12), transparent 55%),
    linear-gradient(145deg, #f3faf8, #eef5f2);
}
.sg-eyebrow {
  margin: 0 0 0.3rem;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--stem-teal-deep);
}
.sg-hero-title {
  margin: 0 0 0.35rem;
  font-family: var(--stem-font-display);
  font-size: clamp(1.35rem, 1.8vw, 1.55rem);
  letter-spacing: -0.03em;
}
.sg-hero-lead {
  margin: 0;
  color: var(--stem-ink-soft);
  line-height: 1.5;
  max-width: 42rem;
  font-size: var(--stem-text-base);
}
.sg-hero-actions { display: grid; gap: 0.75rem; justify-items: end; }
.sg-action-row { display: flex; flex-wrap: wrap; gap: 0.45rem; justify-content: flex-end; align-items: center; }
.sg-ghost-link {
  display: inline-flex; align-items: center; min-height: 40px; padding: 0 0.75rem;
  font-size: var(--stem-text-md); font-weight: 600; color: var(--stem-teal-deep); text-decoration: none;
}
.sg-ghost-link:hover { text-decoration: underline; }
.sg-alert {
  display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;
  padding: 0.85rem 1rem; border-radius: 12px; background: #fef3f2; color: var(--stem-danger);
  border: 1px solid #fecdca; font-size: var(--stem-text-base);
}
.sg-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(300px, 0.95fr);
  gap: 1rem;
  align-items: start;
}
.sg-table-wrap { overflow-x: auto; }
.sg-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--stem-text-base);
  min-width: 420px;
}
.sg-table th {
  text-align: left;
  padding: 0.65rem 0.55rem;
  border-bottom: 1px solid var(--stem-line);
  color: var(--stem-ink-soft);
  font-size: var(--stem-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 700;
}
.sg-table td {
  padding: 0.85rem 0.55rem;
  border-bottom: 1px solid var(--stem-line);
  vertical-align: middle;
}
.sg-table tbody tr {
  cursor: pointer;
  transition: background 0.12s ease;
}
.sg-table tbody tr:hover { background: var(--stem-mint-soft); }
.sg-table tbody tr.is-selected {
  background: linear-gradient(90deg, var(--portal-accent-soft), #fff 70%);
}
.sg-slug { margin-top: 0.25rem; }
.sg-slug code,
.sg-detail code {
  font-size: var(--stem-text-sm);
  background: var(--stem-mint-soft);
  padding: 0.15rem 0.4rem;
  border-radius: 6px;
  border: 1px solid var(--stem-line);
}
.sg-side { min-width: 0; }
.sg-detail {
  border: 1px solid var(--stem-line);
  border-radius: 16px;
  padding: 1.15rem;
  background: linear-gradient(180deg, #fff, var(--stem-mint-soft));
  min-height: 320px;
  position: sticky;
  top: 5.5rem;
}
.sg-detail-empty {
  display: grid;
  gap: 0.85rem;
  place-content: center;
  text-align: center;
}
.sg-detail-head {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 1rem;
}
.sg-detail-mark {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: linear-gradient(145deg, var(--stem-teal-bright), var(--stem-teal-deep));
  color: #fff;
  font-weight: 700;
  flex-shrink: 0;
}
.sg-detail h3 { margin: 0; font-size: 1.15rem; }
.sg-detail p { margin: 0.25rem 0 0; color: var(--stem-ink-soft); font-size: var(--stem-text-md); }
.sg-meta {
  display: grid;
  gap: 0.65rem;
  margin: 0 0 1rem;
}
.sg-meta > div {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: var(--stem-text-base);
}
.sg-meta dt { color: var(--stem-ink-soft); margin: 0; }
.sg-meta dd { margin: 0; font-weight: 600; text-align: right; }
.sg-desc {
  margin: 0 0 1rem;
  font-size: var(--stem-text-base);
  color: var(--stem-ink-soft);
  line-height: 1.45;
}
.sg-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 1rem;
}
.sg-member-panel h4 {
  margin: 0 0 0.65rem;
  font-size: var(--stem-text-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--stem-ink-soft);
}
.sg-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.5rem;
}
.sg-list li {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.7rem 0.8rem;
  border-radius: 10px;
  background: #fff;
  border: 1px solid var(--stem-line);
  font-size: var(--stem-text-base);
}
.sg-member-right {
  display: grid;
  gap: 0.25rem;
  justify-items: end;
  font-size: var(--stem-text-sm);
  color: var(--stem-ink-soft);
}
.sg-form { display: grid; gap: 0.85rem; }
.sg-form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.75rem;
}
.sg-members {
  margin: 0;
  padding: 0.85rem;
  border: 1px solid var(--stem-line);
  border-radius: 12px;
  background: var(--stem-mint-soft);
}
.sg-members legend {
  padding: 0 0.35rem;
  font-size: var(--stem-text-md);
  font-weight: 700;
  color: var(--stem-teal-deep);
}
.sg-hint {
  margin: 0 0 0.65rem;
  font-size: var(--stem-text-sm);
  color: var(--stem-ink-soft);
}
.sg-member-list {
  display: grid;
  gap: 0.4rem;
  max-height: 240px;
  overflow: auto;
}
.sg-member-row {
  display: flex;
  gap: 0.65rem;
  align-items: flex-start;
  padding: 0.55rem 0.65rem;
  border-radius: 10px;
  border: 1px solid var(--stem-line);
  background: #fff;
  cursor: pointer;
  font-size: var(--stem-text-md);
}
.sg-member-row.is-on {
  border-color: rgba(12, 124, 128, 0.4);
  background: linear-gradient(90deg, var(--portal-accent-soft), #fff 75%);
}
.sg-member-row input { margin-top: 0.2rem; }
.sg-member-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
  margin-top: 0.25rem;
}
.sg-elsewhere {
  font-style: normal;
  font-size: var(--stem-text-xs);
  font-weight: 700;
  color: #b54708;
  background: #fffaeb;
  border: 1px solid #fedf89;
  border-radius: 999px;
  padding: 0.1rem 0.45rem;
}
.sg-empty, .sg-muted { margin: 0; color: var(--stem-ink-soft); }
.sg-pill {
  display: inline-flex;
  padding: 0.18rem 0.55rem;
  border-radius: 999px;
  font-size: var(--stem-text-xs);
  font-weight: 700;
  border: 1px solid transparent;
}
.sg-pill.status-active { background: #ecfdf3; color: #067647; border-color: #abefc6; }
.sg-pill.status-inactive { background: #f5f5f5; color: #525252; border-color: #e5e5e5; }
.sg-pill.status-trial { background: #eff8ff; color: #175cd3; border-color: #b2ddff; }
.sg-pill.status-suspended { background: #fef3f2; color: #b42318; border-color: #fecdca; }
.sg-pill.status-closed { background: #f5f5f5; color: #525252; border-color: #e5e5e5; }
@media (max-width: 960px) {
  .sg-hero, .sg-layout { grid-template-columns: 1fr; }
  .sg-hero-actions { justify-items: start; }
  .sg-action-row { justify-content: flex-start; }
  .sg-detail { position: static; }
}
`;
