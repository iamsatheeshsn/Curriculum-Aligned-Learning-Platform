import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
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
import { SchoolOpsCurriculumGate } from './schoolOpsAccess';
import { schoolOpsPageStyles } from './schoolOpsStyles';
import { CURRICULUM_LINKS, SCHOOL_OPS_API, type SchoolSubjectRow, type SchoolSubjectStats } from './types';

type SubjectForm = {
  code: string;
  name_en: string;
  name_ar: string;
  is_stem: boolean;
  tutoring_enabled: boolean;
  status: 'active' | 'archived';
};

const P = 'ssub-';
const styles = schoolOpsPageStyles(P);

const emptyForm = (): SubjectForm => ({
  code: '',
  name_en: '',
  name_ar: '',
  is_stem: true,
  tutoring_enabled: true,
  status: 'active',
});

/** School-scoped subjects for tutoring and class delivery. */
export function SchoolSubjectsPage() {
  return (
    <SchoolOpsCurriculumGate>
      <ControlLayout
        title="Subjects"
        subtitle="Manage your school's subject catalogue for classes, tutoring, and assessments"
      >
        <SubjectsWorkspace />
      </ControlLayout>
    </SchoolOpsCurriculumGate>
  );
}

function SubjectsWorkspace() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [rows, setRows] = useState<SchoolSubjectRow[]>([]);
  const listPage = useClientPagination(rows);

  const [stats, setStats] = useState<SchoolSubjectStats | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view');
  const [form, setForm] = useState<SubjectForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      const qs = params.toString();
      const res = await api.get<{ data: SchoolSubjectRow[]; meta: { stats: SchoolSubjectStats } }>(
        `${SCHOOL_OPS_API}/subjects${qs ? `?${qs}` : ''}`,
      );
      setRows(res.data);
      setStats(res.meta.stats);
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
  }, [api, search, statusFilter, mode]);

  useEffect(() => {
    void load();
  }, [api, statusFilter]);

  const activeDetail = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );
  const showingForm = mode === 'create' || mode === 'edit';

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    await load();
  }

  function startCreate() {
    setMode('create');
    setForm(emptyForm());
    setSelectedId(null);
  }

  function startEdit(row: SchoolSubjectRow) {
    setMode('edit');
    setSelectedId(row.id);
    setForm({
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

    setSaving(true);
    setError(null);
    try {
      const payload = {
        code: form.code.trim(),
        name_en: form.name_en.trim(),
        name_ar: form.name_ar.trim() || form.name_en.trim(),
        is_stem: form.is_stem,
        tutoring_enabled: form.tutoring_enabled,
        status: form.status,
      };

      if (mode === 'create') {
        const res = await api.post<{ data: SchoolSubjectRow }>(`${SCHOOL_OPS_API}/subjects`, payload);
        setMode('view');
        setSelectedId(res.data.id);
        await load();
        await feedback.success({
          title: 'Subject created',
          message: `${res.data.name_en} (${res.data.code}) is ready for classes and tutoring.`,
        });
      } else if (selectedId) {
        const res = await api.request<{ data: SchoolSubjectRow }>(
          `${SCHOOL_OPS_API}/subjects/${selectedId}`,
          { method: 'PUT', body: JSON.stringify(payload) },
        );
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

  async function deleteSubject(row: SchoolSubjectRow) {
    try {
      await api.request(`${SCHOOL_OPS_API}/subjects/${row.id}`, { method: 'DELETE' });
      await feedback.success({
        title: 'Subject deleted',
        message: `${row.name_en} was removed from your catalogue.`,
      });
      setSelectedId(null);
      setMode('view');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete subject');
    }
  }

  if (loading && rows.length === 0 && !stats) {
    return <p className={`${P}muted`}>Loading subjects…</p>;
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
    <div className={`${P}page`}>
      <section className={`${P}hero stem-animate-rise`}>
        <div>
          <p className={`${P}eyebrow`}>Control · School curriculum</p>
          <h2 className={`${P}hero-title`}>Subjects</h2>
          <p className={`${P}hero-lead`}>
            Define the subjects your school teaches — including STEM flags and tutoring availability for
            each course.
          </p>
        </div>
        <div className={`${P}hero-actions`}>
          <div className={`${P}action-row`}>
            <Button
              size="sm"
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => void load()}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Link to="/school/profile" className={`${P}ghost-link`}>
              School profile
            </Link>
            <Link to="/curriculum/grades" className={`${P}ghost-link`}>
              Grades
            </Link>
            <Button type="button" variant="apricot" onClick={startCreate} size="sm">
              + New subject
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <div className={`${P}alert`} role="alert">
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
          { label: 'STEM', value: String(stats?.stem ?? '—'), hint: 'STEM-tagged' },
        ]}
      />

      <div className={`${P}layout`}>
        <Panel
          title="Subject directory"
          description="Search by code or name, then select a row to review or edit."
          action={
            <Toolbar as="form" onSubmit={onSearch}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search code or name"
                aria-label="Search subjects"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
              <Button type="submit" variant="secondary" size="sm">
                Apply
              </Button>
            </Toolbar>
          }
        >
          <div className={`${P}table-wrap`}>
            <table className={`${P}table`}>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Flags</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className={`${P}empty`}>
                      No subjects yet. Add one to build your curriculum.
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
                        <div className={`${P}slug`}>
                          <code>{row.code}</code>
                          {row.name_ar ? <span> · {row.name_ar}</span> : null}
                        </div>
                      </td>
                      <td>
                        {row.is_stem ? <span className={`${P}chip`}>STEM</span> : null}{' '}
                        {row.tutoring_enabled ? (
                          <span className={`${P}chip soft`}>Tutoring</span>
                        ) : null}
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
          <PaginationBar
            page={listPage.page}
            lastPage={listPage.lastPage}
            total={listPage.total}
            onPageChange={listPage.setPage}
            disabled={loading}
          />
        </Panel>

        <aside className={`${P}side`} aria-live="polite">
          {showingForm ? (
            <Panel
              title={mode === 'create' ? 'Create subject' : 'Edit subject'}
              description={
                mode === 'create'
                  ? 'Add a subject for classes, tutoring, and assessments.'
                  : 'Update names, flags, or lifecycle status.'
              }
            >
              <form onSubmit={onSave} className={`${P}form`} noValidate>
                <TextField
                  label="Subject code"
                  required
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="MATH-G7"
                />
                <TextField
                  label="English name"
                  required
                  value={form.name_en}
                  onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
                />
                <TextField
                  label="Arabic name"
                  required
                  value={form.name_ar}
                  onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))}
                  hint="Defaults to English name if left blank on save"
                />
                <div className={`${P}check-row`}>
                  <label>
                    <input
                      type="checkbox"
                      checked={form.is_stem}
                      onChange={(e) => setForm((f) => ({ ...f, is_stem: e.target.checked }))}
                    />
                    STEM subject
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={form.tutoring_enabled}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, tutoring_enabled: e.target.checked }))
                      }
                    />
                    Tutoring enabled
                  </label>
                </div>
                <SelectField
                  label="Status"
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value as SubjectForm['status'] }))
                  }
                >
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </SelectField>
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
            <div className={`${P}detail`}>
              <div className={`${P}detail-head`}>
                <span className={`${P}detail-mark`} aria-hidden>
                  {activeDetail.code.slice(0, 3)}
                </span>
                <div>
                  <h3>{activeDetail.name_en}</h3>
                  <p>
                    <code>{activeDetail.code}</code>
                    {activeDetail.name_ar ? ` · ${activeDetail.name_ar}` : ''}
                  </p>
                </div>
              </div>

              <dl className={`${P}meta`}>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <StatusPill status={activeDetail.status} />
                  </dd>
                </div>
                <div>
                  <dt>Type</dt>
                  <dd>
                    {activeDetail.is_stem ? 'STEM' : 'General'}
                    {activeDetail.tutoring_enabled ? ' · Tutoring' : ''}
                  </dd>
                </div>
              </dl>

              <div className={`${P}actions`}>
                <Button size="sm" type="button" variant="secondary" onClick={() => startEdit(activeDetail)}>
                  Edit
                </Button>
                <ConfirmButton
                  size="sm"
                  title="Delete subject?"
                  message={`${activeDetail.name_en} will be removed from your school catalogue.`}
                  confirmLabel="Delete"
                  tone="danger"
                  variant="danger"
                  onConfirm={() => deleteSubject(activeDetail)}
                >
                  Delete
                </ConfirmButton>
              </div>

              <CurriculumLinks current="/curriculum/subjects" />
            </div>
          ) : (
            <div className={`${P}detail ${P}detail-empty`}>
              <p className={`${P}empty`}>Select a subject to review details and actions.</p>
              <Button size="sm" type="button" variant="apricot" onClick={startCreate}>
                + New subject
              </Button>
            </div>
          )}
        </aside>
      </div>

      <style>{styles}</style>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`${P}pill status-${status}`}>{statusLabel(status)}</span>;
}

function CurriculumLinks({ current }: { current: string }) {
  return (
    <div className={`${P}links`}>
      {CURRICULUM_LINKS.filter((l) => l.path !== current).map((l) => (
        <Link key={l.path} to={l.path}>
          {l.label}
        </Link>
      ))}
    </div>
  );
}
