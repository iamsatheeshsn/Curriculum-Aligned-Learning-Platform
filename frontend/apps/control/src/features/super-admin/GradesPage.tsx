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

type TenantSchoolOption = {
  id: number;
  name: string;
  slug: string;
  status: string;
  schools: { id: number; code: string; name_en: string; status: string }[];
};

type GradeRow = {
  id: number;
  code: string;
  name_en: string;
  name_ar: string;
  sequence: number;
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
  usage: { classes: number; sections: number; chapters: number };
  sibling_grades?: { id: number; code: string; name_en: string; sequence: number }[];
  created_at?: string | null;
  updated_at?: string | null;
};

type GradeStats = {
  total: number;
  schools: number;
  tenants: number;
  with_classes: number;
  with_chapters: number;
};

type GradeForm = {
  school_id: number | '';
  code: string;
  name_en: string;
  name_ar: string;
  sequence: string;
};

const emptyForm = (): GradeForm => ({
  school_id: '',
  code: '',
  name_en: '',
  name_ar: '',
  sequence: '1',
});

/**
 * Cross-organisation grade levels used by classes and curriculum chapters.
 */
export function GradesPage() {
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
      title="Grades"
      subtitle="Manage academic grade levels across every school organisation"
    >
      <GradesWorkspace />
    </ControlLayout>
  );
}

function GradesWorkspace() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [rows, setRows] = useState<GradeRow[]>([]);
  const listPage = useClientPagination(rows);

  const [stats, setStats] = useState<GradeStats | null>(null);
  const [tenants, setTenants] = useState<TenantSchoolOption[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<GradeRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view');
  const [form, setForm] = useState<GradeForm>(emptyForm);
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (tenantFilter) params.set('tenant_id', tenantFilter);
      if (schoolFilter) params.set('school_id', schoolFilter);
      const qs = params.toString();
      const res = await api.get<{
        data: GradeRow[];
        meta: { stats: GradeStats; tenants: TenantSchoolOption[] };
      }>(`/control/grades${qs ? `?${qs}` : ''}`);
      setRows(res.data);
      setStats(res.meta.stats);
      setTenants(res.meta.tenants);
      setSelectedId((current) => {
        if (mode === 'create') return current;
        if (current && res.data.some((r) => r.id === current)) return current;
        return res.data[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load grades');
    } finally {
      setLoading(false);
    }
  }, [api, search, tenantFilter, schoolFilter, mode]);

  useEffect(() => {
    void load();
  }, [api, tenantFilter, schoolFilter]);

  useEffect(() => {
    if (!selectedId || mode === 'create') {
      if (mode !== 'create') setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void (async () => {
      try {
        const res = await api.get<{ data: GradeRow }>(`/control/grades/${selectedId}`);
        if (!cancelled) setDetail(res.data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load grade details');
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
      school_id: schoolFilter
        ? Number(schoolFilter)
        : (schoolOptions[0]?.id ?? ''),
      sequence: String((stats?.total ?? 0) + 1),
    });
    setSelectedId(null);
    setDetail(null);
  }

  function startEdit(row: GradeRow) {
    setMode('edit');
    setSelectedId(row.id);
    setForm({
      school_id: row.school_id,
      code: row.code,
      name_en: row.name_en,
      name_ar: row.name_ar ?? '',
      sequence: String(row.sequence),
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
      setError('Select a school for this grade.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        school_id: Number(form.school_id),
        code: form.code.trim().toUpperCase(),
        name_en: form.name_en.trim(),
        name_ar: form.name_ar.trim() || form.name_en.trim(),
        sequence: Number(form.sequence),
      };

      if (mode === 'create') {
        const res = await api.post<{ data: GradeRow }>('/control/grades', payload);
        setMode('view');
        setSelectedId(res.data.id);
        await load();
        await feedback.success({
          title: 'Grade created',
          message: `${res.data.name_en} (${res.data.code}) is ready for classes and curriculum.`,
        });
      } else if (selectedId) {
        const res = await api.request<{ data: GradeRow }>(`/control/grades/${selectedId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setMode('view');
        await load();
        await feedback.success({
          title: 'Grade updated',
          message: `${res.data.name_en} has been saved.`,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save grade');
    } finally {
      setSaving(false);
    }
  }

  async function deleteGrade(row: GradeRow) {
    try {
      await api.request(`/control/grades/${row.id}`, { method: 'DELETE' });
      await feedback.success({
        title: 'Grade deleted',
        message: `${row.name_en} was removed.`,
      });
      setSelectedId(null);
      setDetail(null);
      setMode('view');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete grade');
    }
  }

  const canDelete =
    !!activeDetail &&
    activeDetail.usage.classes + activeDetail.usage.sections + activeDetail.usage.chapters === 0;

  if (loading && rows.length === 0 && !stats) {
    return <p className="gr-muted">Loading grades…</p>;
  }

  if (error && !stats && rows.length === 0) {
    return (
      <Panel title="Unable to load grades">
        <p style={{ color: 'var(--stem-danger)', marginTop: 0 }}>{error}</p>
        <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
          Retry
        </Button>
      </Panel>
    );
  }

  return (
    <div className="gr-page">
      <section className="gr-hero stem-animate-rise">
        <div>
          <p className="gr-eyebrow">Control · Curriculum management</p>
          <h2 className="gr-hero-title">Grades</h2>
          <p className="gr-hero-lead">
            Maintain academic grade levels for each school — used by classes, sections, and
            curriculum chapters.
          </p>
        </div>
        <div className="gr-hero-actions">
          <div className="gr-action-row">
            <Button
              size="sm"
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => void load()}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Link to="/curriculum/curriculums" className="gr-ghost-link">
              Curriculums
            </Link>
            <Button type="button" variant="apricot" onClick={startCreate} size="sm">
              + New grade
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="gr-alert" role="alert">
          <span>{error}</span>
          <Button size="sm" type="button" variant="secondary" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <StatStrip
        items={[
          { label: 'Grades', value: String(stats?.total ?? '—') },
          { label: 'Schools', value: String(stats?.schools ?? '—') },
          { label: 'Organisations', value: String(stats?.tenants ?? '—') },
          {
            label: 'With classes',
            value: String(stats?.with_classes ?? '—'),
            hint: 'Linked class groups',
          },
        ]}
      />

      <div className="gr-layout">
        <Panel
          title="Grade directory"
          description="Search by code or name, then filter by organisation or school."
          action={
            <Toolbar as="form" onSubmit={onSearch}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search code or name"
                aria-label="Search grades"
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
              <Button type="submit" variant="secondary" size="sm">
                Apply
              </Button>
            </Toolbar>
          }
        >
          <div className="gr-table-wrap">
            <table className="gr-table">
              <thead>
                <tr>
                  <th>Grade</th>
                  <th>School</th>
                  <th>Seq</th>
                  <th>Usage</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="gr-empty">
                      No grades match this filter. Add one for a school to get started.
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
                        <strong>{row.name_en}</strong>
                        <div className="gr-slug">
                          <code>{row.code}</code>
                          {row.name_ar ? <span> · {row.name_ar}</span> : null}
                        </div>
                      </td>
                      <td>
                        {row.school?.name_en ?? '—'}
                        <div className="gr-slug">{row.tenant?.name ?? ''}</div>
                      </td>
                      <td>{row.sequence}</td>
                      <td>
                        {row.usage.classes} cls · {row.usage.chapters} ch
                      </td>
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

        <aside className="gr-side" aria-live="polite">
          {showingForm ? (
            <Panel
              title={mode === 'create' ? 'Create grade' : 'Edit grade'}
              description={
                mode === 'create'
                  ? 'Add an academic level for a school organisation.'
                  : 'Update names, code, or display sequence.'
              }
            >
              <form onSubmit={onSave} className="gr-form" noValidate>
                <SelectField
                  label="School"
                  required
                  value={form.school_id === '' ? '' : String(form.school_id)}
                  disabled={mode === 'edit'}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      school_id: e.target.value ? Number(e.target.value) : '',
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
                <TextField
                  label="Code"
                  required
                  value={form.code}
                  maxLength={32}
                  placeholder="G1"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, code: e.target.value.toUpperCase().slice(0, 32) }))
                  }
                  hint="Unique within the school"
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
                <TextField
                  label="Sequence"
                  required
                  type="number"
                  min={0}
                  value={form.sequence}
                  onChange={(e) => setForm((f) => ({ ...f, sequence: e.target.value }))}
                  hint="Display order within the school"
                />
                <FormActions>
                  <Button size="sm" type="button" variant="secondary" onClick={cancelForm}>
                    Cancel
                  </Button>
                  <Button size="sm" type="submit" variant="primary" disabled={saving}>
                    {saving ? 'Saving…' : mode === 'create' ? 'Create grade' : 'Save changes'}
                  </Button>
                </FormActions>
              </form>
            </Panel>
          ) : activeDetail ? (
            <div className="gr-detail">
              <div className="gr-detail-head">
                <span className="gr-detail-mark" aria-hidden>
                  {activeDetail.code}
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
                <p className="gr-muted">Loading details…</p>
              ) : (
                <>
                  <dl className="gr-meta">
                    <div>
                      <dt>Sequence</dt>
                      <dd>{activeDetail.sequence}</dd>
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
                      <dt>Classes</dt>
                      <dd>{activeDetail.usage.classes}</dd>
                    </div>
                    <div>
                      <dt>Sections</dt>
                      <dd>{activeDetail.usage.sections}</dd>
                    </div>
                    <div>
                      <dt>Chapters</dt>
                      <dd>{activeDetail.usage.chapters}</dd>
                    </div>
                  </dl>

                  {(activeDetail.sibling_grades?.length ?? 0) > 1 ? (
                    <ul className="gr-usage-list">
                      {activeDetail.sibling_grades!.map((g) => (
                        <li key={g.id}>
                          <button
                            type="button"
                            className="gr-sibling-link"
                            onClick={() => {
                              setMode('view');
                              setSelectedId(g.id);
                            }}
                          >
                            <strong>
                              {g.name_en}
                              {g.id === activeDetail.id ? ' · selected' : ''}
                            </strong>
                            <span>
                              {g.code} · seq {g.sequence}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="gr-actions">
                    <Button
                      size="sm"
                      type="button"
                      variant="secondary"
                      onClick={() => startEdit(activeDetail)}
                    >
                      Edit
                    </Button>
                    {canDelete ? (
                      <ConfirmButton
                        size="sm"
                        title="Delete grade?"
                        message={`${activeDetail.name_en} will be soft-deleted from this school.`}
                        confirmLabel="Delete"
                        tone="danger"
                        variant="danger"
                        onConfirm={() => deleteGrade(activeDetail)}
                      >
                        Delete
                      </ConfirmButton>
                    ) : (
                      <Button
                        size="sm"
                        type="button"
                        variant="danger"
                        disabled
                        title="In use by classes, sections, or chapters"
                      >
                        Delete
                      </Button>
                    )}
                  </div>

                  <div className="gr-links">
                    <Link to="/curriculum/curriculums">Curriculums</Link>
                    <Link to="/tenants/campuses">Campuses</Link>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="gr-detail gr-detail-empty">
              <p className="gr-empty">Select a grade to review details and actions.</p>
              <Button size="sm" type="button" variant="apricot" onClick={startCreate}>
                + New grade
              </Button>
            </div>
          )}
        </aside>
      </div>

      <style>{gradeStyles}</style>
    </div>
  );
}

const gradeStyles = `
.gr-page { display: grid; gap: 1rem; }
.gr-hero {
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
.gr-eyebrow {
  margin: 0 0 0.3rem;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--stem-teal-deep);
}
.gr-hero-title {
  margin: 0 0 0.35rem;
  font-family: var(--stem-font-display);
  font-size: clamp(1.35rem, 1.8vw, 1.55rem);
  letter-spacing: -0.03em;
}
.gr-hero-lead {
  margin: 0;
  color: var(--stem-ink-soft);
  line-height: 1.5;
  max-width: 42rem;
  font-size: var(--stem-text-base);
}
.gr-hero-actions { display: grid; gap: 0.75rem; justify-items: end; }
.gr-action-row { display: flex; flex-wrap: wrap; gap: 0.45rem; justify-content: flex-end; align-items: center; }
.gr-ghost-link {
  display: inline-flex; align-items: center; min-height: 40px; padding: 0 0.75rem;
  font-size: var(--stem-text-md); font-weight: 600; color: var(--stem-teal-deep); text-decoration: none;
}
.gr-ghost-link:hover { text-decoration: underline; }
.gr-alert {
  display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;
  padding: 0.85rem 1rem; border-radius: 12px; background: #fef3f2; color: var(--stem-danger);
  border: 1px solid #fecdca; font-size: var(--stem-text-base);
}
.gr-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(280px, 0.85fr);
  gap: 1rem;
  align-items: start;
}
.gr-table-wrap { overflow-x: auto; margin: 0 -0.15rem; }
.gr-table { width: 100%; border-collapse: collapse; font-size: var(--stem-text-base); }
.gr-table th {
  text-align: left; font-size: var(--stem-text-xs); letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--stem-ink-soft); padding: 0.55rem 0.65rem; border-bottom: 1px solid var(--stem-line);
  white-space: nowrap;
}
.gr-table td {
  padding: 0.7rem 0.65rem; border-bottom: 1px solid var(--stem-line); vertical-align: top;
}
.gr-table tbody tr { cursor: pointer; transition: background 0.15s ease; }
.gr-table tbody tr:hover { background: rgba(18, 160, 171, 0.04); }
.gr-table tbody tr.is-selected { background: rgba(12, 124, 128, 0.08); }
.gr-slug { margin-top: 0.15rem; font-size: var(--stem-text-sm); color: var(--stem-ink-soft); }
.gr-slug code { font-size: var(--stem-text-sm); }
.gr-empty { text-align: center; color: var(--stem-ink-soft); padding: 1.5rem 0.75rem !important; }
.gr-side { position: sticky; top: 0.75rem; }
.gr-detail {
  display: grid; gap: 1rem; padding: 1.1rem 1.15rem; border-radius: 16px;
  border: 1px solid var(--stem-line); background: #fff;
}
.gr-detail-empty { min-height: 180px; align-content: center; justify-items: start; gap: 0.85rem; }
.gr-detail-head { display: flex; gap: 0.75rem; align-items: center; }
.gr-detail-mark {
  min-width: 2.75rem; height: 2.5rem; padding: 0 0.55rem; border-radius: 12px;
  display: grid; place-items: center; font-weight: 700; font-size: var(--stem-text-md); letter-spacing: 0.04em;
  background: #eef8f6; color: #055456; border: 1px solid rgba(12, 124, 128, 0.22);
}
.gr-detail-head h3 { margin: 0; font-size: var(--stem-text-xl); letter-spacing: -0.02em; }
.gr-detail-head p { margin: 0.15rem 0 0; font-size: var(--stem-text-md); color: var(--stem-ink-soft); }
.gr-meta { display: grid; gap: 0.55rem; margin: 0; }
.gr-meta > div {
  display: grid; grid-template-columns: 7.5rem minmax(0, 1fr); gap: 0.5rem; align-items: baseline;
}
.gr-meta dt {
  margin: 0; font-size: var(--stem-text-xs); text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--stem-ink-soft);
}
.gr-meta dd { margin: 0; font-size: var(--stem-text-base); }
.gr-usage-list {
  list-style: none; margin: 0; padding: 0.75rem 0 0; border-top: 1px solid var(--stem-line);
  display: grid; gap: 0.35rem;
}
.gr-usage-list li { margin: 0; }
.gr-sibling-link {
  width: 100%; display: grid; gap: 0.1rem; text-align: left; background: transparent;
  border: 0; padding: 0.35rem 0; cursor: pointer; font: inherit;
}
.gr-sibling-link:hover strong { color: var(--stem-teal-deep); }
.gr-sibling-link span { color: var(--stem-ink-soft); font-size: var(--stem-text-sm); }
.gr-actions {
  display: flex; flex-wrap: wrap; gap: 0.5rem; padding-top: 0.35rem;
  border-top: 1px solid var(--stem-line);
}
.gr-links { display: flex; flex-wrap: wrap; gap: 0.75rem 1rem; padding-top: 0.25rem; }
.gr-links a {
  font-size: var(--stem-text-md); font-weight: 600; color: var(--stem-teal-deep); text-decoration: none;
}
.gr-links a:hover { text-decoration: underline; }
.gr-form { display: grid; gap: 0.85rem; }
.gr-muted { color: var(--stem-ink-soft); font-size: var(--stem-text-base); margin: 0; }
@media (max-width: 960px) {
  .gr-hero, .gr-layout { grid-template-columns: 1fr; }
  .gr-hero-actions { justify-items: start; }
  .gr-action-row { justify-content: flex-start; }
  .gr-side { position: static; }
}
`;
