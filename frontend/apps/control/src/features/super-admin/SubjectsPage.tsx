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

type TenantSchoolOption = {
  id: number;
  name: string;
  slug: string;
  status: string;
  schools: { id: number; code: string; name_en: string; status: string }[];
};

type CurriculumOption = {
  id: number;
  school_id: number | null;
  code: string;
  name_en: string;
  version: string;
  status: string;
  is_latest?: boolean;
};

type SubjectRow = {
  id: number;
  code: string;
  name_en: string;
  name_ar: string;
  is_stem: boolean;
  tutoring_enabled: boolean;
  status: string;
  curriculum_id: number | null;
  tenant_id: number;
  school_id: number;
  tenant: { id: number; name: string; slug: string; status: string } | null;
  school: {
    id: number;
    code: string;
    name_en: string;
    name_ar?: string | null;
    status: string;
  } | null;
  curriculum: {
    id: number;
    code: string;
    name_en: string;
    version: string;
    status: string;
  } | null;
  usage: { chapters: number; learning_outcomes: number };
  recent_chapters?: {
    id: number;
    title_en: string;
    sequence: number;
    status: string;
    grade_id: number | null;
  }[];
};

type SubjectStats = {
  total: number;
  active: number;
  archived: number;
  stem: number;
  with_curriculum: number;
  schools: number;
};

type SubjectForm = {
  school_id: number | '';
  curriculum_id: string;
  code: string;
  name_en: string;
  name_ar: string;
  is_stem: boolean;
  tutoring_enabled: boolean;
  status: 'active' | 'archived';
};

const emptyForm = (): SubjectForm => ({
  school_id: '',
  curriculum_id: '',
  code: '',
  name_en: '',
  name_ar: '',
  is_stem: true,
  tutoring_enabled: true,
  status: 'active',
});

/**
 * Cross-organisation subjects for STEM delivery, tutoring, and curriculum trees.
 */
export function SubjectsPage() {
  const { isSuperAdmin, hasPermission } = useAuth();
  if (
    !isSuperAdmin &&
    !hasPermission([
      'platform.tenants.manage',
      'curriculum.manage',
      'nav.control.curriculum-management',
    ])
  ) {
    return <Navigate to="/" replace />;
  }

  return (
    <ControlLayout
      title="Subjects"
      subtitle="Manage subjects across schools, curricula, and tutoring"
    >
      <SubjectsWorkspace />
    </ControlLayout>
  );
}

function SubjectsWorkspace() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [rows, setRows] = useState<SubjectRow[]>([]);
  const [stats, setStats] = useState<SubjectStats | null>(null);
  const [tenants, setTenants] = useState<TenantSchoolOption[]>([]);
  const [curricula, setCurricula] = useState<CurriculumOption[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<SubjectRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [stemOnly, setStemOnly] = useState(false);
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view');
  const [form, setForm] = useState<SubjectForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const schoolOptions = useMemo(
    () =>
      tenants.flatMap((t) =>
        t.schools.map((s) => ({
          id: s.id,
          label: `${t.name} · ${s.name_en}`,
          tenantId: t.id,
        })),
      ),
    [tenants],
  );

  const schoolsForFilter = useMemo(() => {
    if (!tenantFilter) return schoolOptions;
    return schoolOptions.filter((s) => String(s.tenantId) === tenantFilter);
  }, [schoolOptions, tenantFilter]);

  const curriculaForForm = useMemo(() => {
    if (!form.school_id) return curricula;
    return curricula.filter(
      (c) => c.school_id === null || c.school_id === Number(form.school_id),
    );
  }, [curricula, form.school_id]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (tenantFilter) params.set('tenant_id', tenantFilter);
      if (schoolFilter) params.set('school_id', schoolFilter);
      if (stemOnly) params.set('stem_only', '1');
      const qs = params.toString();
      const res = await api.get<{
        data: SubjectRow[];
        meta: {
          stats: SubjectStats;
          tenants: TenantSchoolOption[];
          curricula: CurriculumOption[];
        };
      }>(`/control/subjects${qs ? `?${qs}` : ''}`);
      setRows(res.data);
      setStats(res.meta.stats);
      setTenants(res.meta.tenants);
      setCurricula(res.meta.curricula);
      setSelectedId((current) => {
        if (mode === 'create') return current;
        if (current && res.data.some((r) => r.id === current)) return current;
        return res.data[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subjects');
    } finally {
      setLoading(false);
    }
  }, [api, search, statusFilter, tenantFilter, schoolFilter, stemOnly, mode]);

  useEffect(() => {
    void load();
  }, [api, statusFilter, tenantFilter, schoolFilter, stemOnly]);

  useEffect(() => {
    if (!selectedId || mode === 'create') {
      if (mode !== 'create') setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void (async () => {
      try {
        const res = await api.get<{ data: SubjectRow }>(`/control/subjects/${selectedId}`);
        if (!cancelled) setDetail(res.data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load subject details');
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

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    await load();
  }

  function startCreate() {
    setMode('create');
    setForm({
      ...emptyForm(),
      school_id: schoolFilter ? Number(schoolFilter) : (schoolOptions[0]?.id ?? ''),
    });
    setSelectedId(null);
    setDetail(null);
  }

  function startEdit(row: SubjectRow) {
    setMode('edit');
    setSelectedId(row.id);
    setForm({
      school_id: row.school_id,
      curriculum_id: row.curriculum_id ? String(row.curriculum_id) : '',
      code: row.code,
      name_en: row.name_en,
      name_ar: row.name_ar ?? '',
      is_stem: row.is_stem,
      tutoring_enabled: row.tutoring_enabled,
      status: row.status === 'archived' ? 'archived' : 'active',
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
    if (!form.school_id) {
      setError('Select a school for this subject.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        school_id: Number(form.school_id),
        curriculum_id: form.curriculum_id ? Number(form.curriculum_id) : null,
        code: form.code.trim().toUpperCase(),
        name_en: form.name_en.trim(),
        name_ar: form.name_ar.trim() || form.name_en.trim(),
        is_stem: form.is_stem,
        tutoring_enabled: form.tutoring_enabled,
        status: form.status,
      };

      if (mode === 'create') {
        const res = await api.post<{ data: SubjectRow }>('/control/subjects', payload);
        setMode('view');
        setSelectedId(res.data.id);
        await load();
        await feedback.success({
          title: 'Subject created',
          message: `${res.data.name_en} (${res.data.code}) is ready.`,
        });
      } else if (selectedId) {
        const res = await api.request<{ data: SubjectRow }>(`/control/subjects/${selectedId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setMode('view');
        await load();
        await feedback.success({
          title: 'Subject updated',
          message: `${res.data.name_en} has been saved.`,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save subject');
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(row: SubjectRow, status: 'active' | 'archived') {
    try {
      await api.request(`/control/subjects/${row.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      await feedback.success({
        title: status === 'active' ? 'Subject activated' : 'Subject archived',
        message: `${row.name_en} is now ${statusLabel(status)}.`,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update status');
    }
  }

  async function deleteSubject(row: SubjectRow) {
    try {
      await api.request(`/control/subjects/${row.id}`, { method: 'DELETE' });
      await feedback.success({
        title: 'Subject deleted',
        message: `${row.name_en} was removed.`,
      });
      setSelectedId(null);
      setDetail(null);
      setMode('view');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete subject');
    }
  }

  const canDelete =
    !!activeDetail &&
    activeDetail.usage.chapters + activeDetail.usage.learning_outcomes === 0;

  if (loading && rows.length === 0 && !stats) {
    return <p className="su-muted">Loading subjects…</p>;
  }

  if (error && !stats && rows.length === 0) {
    return (
      <Panel title="Unable to load subjects">
        <p style={{ color: 'var(--stem-danger)', marginTop: 0 }}>{error}</p>
        <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
          Retry
        </Button>
      </Panel>
    );
  }

  return (
    <div className="su-page">
      <section className="su-hero stem-animate-rise">
        <div>
          <p className="su-eyebrow">Control · Curriculum management</p>
          <h2 className="su-hero-title">Subjects</h2>
          <p className="su-hero-lead">
            Maintain subject catalogues for each school — STEM flags, tutoring, and curriculum
            linkage in one place.
          </p>
        </div>
        <div className="su-hero-actions">
          <div className="su-action-row">
            <Button
              size="sm"
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => void load()}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Link to="/curriculum/curriculums" className="su-ghost-link">
              Curriculums
            </Link>
            <Link to="/curriculum/grades" className="su-ghost-link">
              Grades
            </Link>
            <Button type="button" variant="apricot" onClick={startCreate} size="sm">
              + New subject
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="su-alert" role="alert">
          <span>{error}</span>
          <Button size="sm" type="button" variant="secondary" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <StatStrip
        items={[
          { label: 'Subjects', value: String(stats?.total ?? '—') },
          { label: 'Active', value: String(stats?.active ?? '—') },
          { label: 'STEM', value: String(stats?.stem ?? '—') },
          {
            label: 'With curriculum',
            value: String(stats?.with_curriculum ?? '—'),
            hint: 'Linked frameworks',
          },
        ]}
      />

      <div className="su-layout">
        <Panel
          title="Subject directory"
          description="Search and filter subjects across organisations and schools."
          action={
            <Toolbar as="form" onSubmit={onSearch}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search code or name"
                aria-label="Search subjects"
              />
              <select
                value={tenantFilter}
                onChange={(e) => {
                  setTenantFilter(e.target.value);
                  setSchoolFilter('');
                }}
                aria-label="Filter by organisation"
              >
                <option value="">All organisations</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <select
                value={schoolFilter}
                onChange={(e) => setSchoolFilter(e.target.value)}
                aria-label="Filter by school"
              >
                <option value="">All schools</option>
                {schoolsForFilter.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
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
                <option value="archived">Archived</option>
              </select>
              <label className="su-check">
                <input
                  type="checkbox"
                  checked={stemOnly}
                  onChange={(e) => setStemOnly(e.target.checked)}
                />
                STEM only
              </label>
              <Button type="submit" variant="secondary" size="sm">
                Apply
              </Button>
            </Toolbar>
          }
        >
          <div className="su-table-wrap">
            <table className="su-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>School</th>
                  <th>Curriculum</th>
                  <th>Flags</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="su-empty">
                      No subjects match this filter. Add one for a school to get started.
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
                        <strong>{row.name_en}</strong>
                        <div className="su-slug">
                          <code>{row.code}</code>
                          {row.name_ar ? <span> · {row.name_ar}</span> : null}
                        </div>
                      </td>
                      <td>
                        {row.school?.name_en ?? '—'}
                        <div className="su-slug">{row.tenant?.name ?? ''}</div>
                      </td>
                      <td>
                        {row.curriculum
                          ? `${row.curriculum.code} v${row.curriculum.version}`
                          : 'Standalone'}
                      </td>
                      <td>
                        <div className="su-flags">
                          {row.is_stem ? <span className="su-chip">STEM</span> : null}
                          {row.tutoring_enabled ? (
                            <span className="su-chip soft">Tutoring</span>
                          ) : null}
                        </div>
                      </td>
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

        <aside className="su-side" aria-live="polite">
          {showingForm ? (
            <Panel
              title={mode === 'create' ? 'Create subject' : 'Edit subject'}
              description={
                mode === 'create'
                  ? 'Add a subject for a school, optionally linked to a curriculum.'
                  : 'Update names, flags, curriculum link, or status.'
              }
            >
              <form onSubmit={onSave} className="su-form" noValidate>
                <SelectField
                  label="School"
                  required
                  value={form.school_id === '' ? '' : String(form.school_id)}
                  disabled={mode === 'edit'}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      school_id: e.target.value ? Number(e.target.value) : '',
                      curriculum_id: '',
                    }))
                  }
                >
                  <option value="">Select school</option>
                  {schoolOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="Curriculum"
                  value={form.curriculum_id}
                  onChange={(e) => setForm((f) => ({ ...f, curriculum_id: e.target.value }))}
                  hint="Optional — leave empty for a standalone school subject"
                >
                  <option value="">No curriculum (standalone)</option>
                  {curriculaForForm.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} v{c.version} · {c.name_en}
                      {c.school_id === null ? ' · platform' : ''}
                    </option>
                  ))}
                </SelectField>
                <TextField
                  label="Code"
                  required
                  value={form.code}
                  maxLength={64}
                  placeholder="MATH"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, code: e.target.value.toUpperCase().slice(0, 64) }))
                  }
                  hint="Unique within school + curriculum"
                />
                <TextField
                  label="English name"
                  required
                  value={form.name_en}
                  onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
                />
                <TextField
                  label="Arabic name"
                  value={form.name_ar}
                  onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))}
                  hint="Optional — defaults to English name"
                />
                <SelectField
                  label="Status"
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      status: e.target.value as 'active' | 'archived',
                    }))
                  }
                >
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </SelectField>
                <label className="su-check-block">
                  <input
                    type="checkbox"
                    checked={form.is_stem}
                    onChange={(e) => setForm((f) => ({ ...f, is_stem: e.target.checked }))}
                  />
                  STEM subject
                </label>
                <label className="su-check-block">
                  <input
                    type="checkbox"
                    checked={form.tutoring_enabled}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, tutoring_enabled: e.target.checked }))
                    }
                  />
                  Tutoring enabled
                </label>
                <FormActions>
                  <Button size="sm" type="button" variant="secondary" onClick={cancelForm}>
                    Cancel
                  </Button>
                  <Button size="sm" type="submit" variant="primary" disabled={saving}>
                    {saving ? 'Saving…' : mode === 'create' ? 'Create subject' : 'Save changes'}
                  </Button>
                </FormActions>
              </form>
            </Panel>
          ) : activeDetail ? (
            <div className="su-detail">
              <div className="su-detail-head">
                <span className="su-detail-mark" aria-hidden>
                  {activeDetail.code.slice(0, 4)}
                </span>
                <div>
                  <h3>{activeDetail.name_en}</h3>
                  <p>
                    <code>{activeDetail.code}</code>
                    {activeDetail.name_ar ? ` · ${activeDetail.name_ar}` : ''}
                  </p>
                </div>
              </div>

              {detailLoading && !detail ? (
                <p className="su-muted">Loading details…</p>
              ) : (
                <>
                  <dl className="su-meta">
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <StatusPill status={activeDetail.status} />
                      </dd>
                    </div>
                    <div>
                      <dt>School</dt>
                      <dd>
                        {activeDetail.school
                          ? `${activeDetail.school.code} · ${activeDetail.school.name_en}`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Organisation</dt>
                      <dd>{activeDetail.tenant?.name ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Curriculum</dt>
                      <dd>
                        {activeDetail.curriculum
                          ? `${activeDetail.curriculum.code} v${activeDetail.curriculum.version}`
                          : 'Standalone'}
                      </dd>
                    </div>
                    <div>
                      <dt>Flags</dt>
                      <dd>
                        {activeDetail.is_stem ? 'STEM' : 'General'}
                        {activeDetail.tutoring_enabled ? ' · Tutoring' : ''}
                      </dd>
                    </div>
                    <div>
                      <dt>Chapters</dt>
                      <dd>{activeDetail.usage.chapters}</dd>
                    </div>
                    <div>
                      <dt>Outcomes</dt>
                      <dd>{activeDetail.usage.learning_outcomes}</dd>
                    </div>
                  </dl>

                  {(activeDetail.recent_chapters?.length ?? 0) > 0 ? (
                    <ul className="su-usage-list">
                      {activeDetail.recent_chapters!.map((ch) => (
                        <li key={ch.id}>
                          <strong>{ch.title_en}</strong>
                          <span>
                            seq {ch.sequence} · {statusLabel(ch.status)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="su-actions">
                    <Button
                      size="sm"
                      type="button"
                      variant="secondary"
                      onClick={() => startEdit(activeDetail)}
                    >
                      Edit
                    </Button>
                    {activeDetail.status === 'active' ? (
                      <ConfirmButton
                        size="sm"
                        title="Archive subject?"
                        message={`${activeDetail.name_en} will be archived and hidden from new assignments.`}
                        confirmLabel="Archive"
                        tone="warn"
                        variant="secondary"
                        onConfirm={() => setStatus(activeDetail, 'archived')}
                      >
                        Archive
                      </ConfirmButton>
                    ) : (
                      <ConfirmButton
                        size="sm"
                        title="Activate subject?"
                        message={`${activeDetail.name_en} will be available again.`}
                        confirmLabel="Activate"
                        tone="primary"
                        variant="primary"
                        onConfirm={() => setStatus(activeDetail, 'active')}
                      >
                        Activate
                      </ConfirmButton>
                    )}
                    {canDelete ? (
                      <ConfirmButton
                        size="sm"
                        title="Delete subject?"
                        message={`${activeDetail.name_en} will be soft-deleted.`}
                        confirmLabel="Delete"
                        tone="danger"
                        variant="danger"
                        onConfirm={() => deleteSubject(activeDetail)}
                      >
                        Delete
                      </ConfirmButton>
                    ) : (
                      <Button
                        size="sm"
                        type="button"
                        variant="danger"
                        disabled
                        title="In use — archive instead"
                      >
                        Delete
                      </Button>
                    )}
                  </div>

                  <div className="su-links">
                    <Link to="/curriculum/curriculums">Curriculums</Link>
                    <Link to="/curriculum/chapters">Chapters</Link>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="su-detail su-detail-empty">
              <p className="su-empty">Select a subject to review details and actions.</p>
              <Button size="sm" type="button" variant="apricot" onClick={startCreate}>
                + New subject
              </Button>
            </div>
          )}
        </aside>
      </div>

      <style>{subjectStyles}</style>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`su-pill status-${status}`}>{statusLabel(status)}</span>;
}

const subjectStyles = `
.su-page { display: grid; gap: 1rem; }
.su-hero {
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
.su-eyebrow {
  margin: 0 0 0.3rem; font-size: var(--stem-text-xs); letter-spacing: 0.08em; text-transform: uppercase;
  font-weight: 700; color: var(--stem-teal-deep);
}
.su-hero-title {
  margin: 0 0 0.35rem; font-family: var(--stem-font-display);
  font-size: clamp(1.35rem, 1.8vw, 1.55rem); letter-spacing: -0.03em;
}
.su-hero-lead {
  margin: 0; color: var(--stem-ink-soft); line-height: 1.5; max-width: 42rem; font-size: var(--stem-text-base);
}
.su-hero-actions { display: grid; gap: 0.75rem; justify-items: end; }
.su-action-row { display: flex; flex-wrap: wrap; gap: 0.45rem; justify-content: flex-end; align-items: center; }
.su-ghost-link {
  display: inline-flex; align-items: center; min-height: 40px; padding: 0 0.75rem;
  font-size: var(--stem-text-md); font-weight: 600; color: var(--stem-teal-deep); text-decoration: none;
}
.su-ghost-link:hover { text-decoration: underline; }
.su-alert {
  display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;
  padding: 0.85rem 1rem; border-radius: 12px; background: #fef3f2; color: var(--stem-danger);
  border: 1px solid #fecdca; font-size: var(--stem-text-base);
}
.su-layout {
  display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(280px, 0.85fr);
  gap: 1rem; align-items: start;
}
.su-table-wrap { overflow-x: auto; margin: 0 -0.15rem; }
.su-table { width: 100%; border-collapse: collapse; font-size: var(--stem-text-base); }
.su-table th {
  text-align: left; font-size: var(--stem-text-xs); letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--stem-ink-soft); padding: 0.55rem 0.65rem; border-bottom: 1px solid var(--stem-line);
  white-space: nowrap;
}
.su-table td { padding: 0.7rem 0.65rem; border-bottom: 1px solid var(--stem-line); vertical-align: top; }
.su-table tbody tr { cursor: pointer; transition: background 0.15s ease; }
.su-table tbody tr:hover { background: rgba(18, 160, 171, 0.04); }
.su-table tbody tr.is-selected { background: rgba(12, 124, 128, 0.08); }
.su-slug { margin-top: 0.15rem; font-size: var(--stem-text-sm); color: var(--stem-ink-soft); }
.su-slug code { font-size: var(--stem-text-sm); }
.su-flags { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.su-chip {
  display: inline-flex; align-items: center; padding: 0.1rem 0.4rem; border-radius: 999px;
  font-size: var(--stem-text-xs); font-weight: 700; background: #ecfdf5; color: #047857;
}
.su-chip.soft { background: #eff6ff; color: #1d4ed8; }
.su-check, .su-check-block {
  display: inline-flex; align-items: center; gap: 0.35rem; font-size: var(--stem-text-md);
  color: var(--stem-ink-soft); white-space: nowrap;
}
.su-check-block { white-space: normal; }
.su-empty { text-align: center; color: var(--stem-ink-soft); padding: 1.5rem 0.75rem !important; }
.su-side { position: sticky; top: 0.75rem; }
.su-detail {
  display: grid; gap: 1rem; padding: 1.1rem 1.15rem; border-radius: 16px;
  border: 1px solid var(--stem-line); background: #fff;
}
.su-detail-empty { min-height: 180px; align-content: center; justify-items: start; gap: 0.85rem; }
.su-detail-head { display: flex; gap: 0.75rem; align-items: center; }
.su-detail-mark {
  min-width: 2.75rem; height: 2.5rem; padding: 0 0.55rem; border-radius: 12px;
  display: grid; place-items: center; font-weight: 700; font-size: var(--stem-text-sm); letter-spacing: 0.04em;
  background: #eef8f6; color: #055456; border: 1px solid rgba(12, 124, 128, 0.22);
}
.su-detail-head h3 { margin: 0; font-size: var(--stem-text-xl); letter-spacing: -0.02em; }
.su-detail-head p { margin: 0.15rem 0 0; font-size: var(--stem-text-md); color: var(--stem-ink-soft); }
.su-meta { display: grid; gap: 0.55rem; margin: 0; }
.su-meta > div {
  display: grid; grid-template-columns: 7.5rem minmax(0, 1fr); gap: 0.5rem; align-items: baseline;
}
.su-meta dt {
  margin: 0; font-size: var(--stem-text-xs); text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--stem-ink-soft);
}
.su-meta dd { margin: 0; font-size: var(--stem-text-base); }
.su-usage-list {
  list-style: none; margin: 0; padding: 0.75rem 0 0; border-top: 1px solid var(--stem-line);
  display: grid; gap: 0.45rem;
}
.su-usage-list li { display: grid; gap: 0.1rem; font-size: var(--stem-text-md); }
.su-usage-list span { color: var(--stem-ink-soft); font-size: var(--stem-text-sm); }
.su-actions {
  display: flex; flex-wrap: wrap; gap: 0.5rem; padding-top: 0.35rem;
  border-top: 1px solid var(--stem-line);
}
.su-links { display: flex; flex-wrap: wrap; gap: 0.75rem 1rem; padding-top: 0.25rem; }
.su-links a {
  font-size: var(--stem-text-md); font-weight: 600; color: var(--stem-teal-deep); text-decoration: none;
}
.su-links a:hover { text-decoration: underline; }
.su-form { display: grid; gap: 0.85rem; }
.su-pill {
  display: inline-flex; align-items: center; padding: 0.2rem 0.55rem; border-radius: 999px;
  font-size: var(--stem-text-xs); font-weight: 700; letter-spacing: 0.02em; background: #f3f4f6; color: #374151;
}
.su-pill.status-active { background: #ecfdf5; color: #047857; }
.su-pill.status-archived { background: #f3f4f6; color: #4b5563; }
.su-muted { color: var(--stem-ink-soft); font-size: var(--stem-text-base); margin: 0; }
@media (max-width: 960px) {
  .su-hero, .su-layout { grid-template-columns: 1fr; }
  .su-hero-actions { justify-items: start; }
  .su-action-row { justify-content: flex-start; }
  .su-side { position: static; }
}
`;
