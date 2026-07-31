import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import {
  Button,
  ConfirmButton,
  FormActions,
  Panel,
  StatStrip,
  TextField,
  useFeedback,
  validateFormFields,
} from '@stemora/ui';
import { ControlLayout } from '../../layout/ControlLayout';
import { SchoolOpsCurriculumGate } from './schoolOpsAccess';
import { schoolOpsPageStyles } from './schoolOpsStyles';
import { CURRICULUM_LINKS, SCHOOL_OPS_API, type SchoolGradeRow, type SchoolGradeStats } from './types';

type GradeForm = {
  code: string;
  name_en: string;
  name_ar: string;
  sequence: number | '';
};

const P = 'sgr-';
const styles = schoolOpsPageStyles(P);

const emptyForm = (): GradeForm => ({
  code: '',
  name_en: '',
  name_ar: '',
  sequence: '',
});

/** School grade levels used by classes and sections. */
export function SchoolGradesPage() {
  return (
    <SchoolOpsCurriculumGate>
      <ControlLayout
        title="Grades"
        subtitle="Define grade levels that organise classes, sections, and student placement"
      >
        <GradesWorkspace />
      </ControlLayout>
    </SchoolOpsCurriculumGate>
  );
}

function GradesWorkspace() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [rows, setRows] = useState<SchoolGradeRow[]>([]);
  const [stats, setStats] = useState<SchoolGradeStats | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view');
  const [form, setForm] = useState<GradeForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: SchoolGradeRow[]; meta: { stats: SchoolGradeStats } }>(
        `${SCHOOL_OPS_API}/grades`,
      );
      setRows(res.data);
      setStats(res.meta.stats);
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
  }, [api, mode]);

  useEffect(() => {
    void load();
  }, [api]);

  const activeDetail = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );
  const showingForm = mode === 'create' || mode === 'edit';

  function startCreate() {
    setMode('create');
    setForm(emptyForm());
    setSelectedId(null);
  }

  function startEdit(row: SchoolGradeRow) {
    setMode('edit');
    setSelectedId(row.id);
    setForm({
      code: row.code,
      name_en: row.name_en,
      name_ar: row.name_ar ?? '',
      sequence: row.sequence,
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
    if (form.sequence === '') {
      setError('Sequence is required.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        code: form.code.trim(),
        name_en: form.name_en.trim(),
        name_ar: form.name_ar.trim() || form.name_en.trim(),
        sequence: Number(form.sequence),
      };

      if (mode === 'create') {
        const res = await api.post<{ data: SchoolGradeRow }>(`${SCHOOL_OPS_API}/grades`, payload);
        setMode('view');
        setSelectedId(res.data.id);
        await load();
        await feedback.success({
          title: 'Grade created',
          message: `${res.data.name_en} (${res.data.code}) is ready for classes.`,
        });
      } else if (selectedId) {
        const res = await api.request<{ data: SchoolGradeRow }>(
          `${SCHOOL_OPS_API}/grades/${selectedId}`,
          { method: 'PUT', body: JSON.stringify(payload) },
        );
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

  async function deleteGrade(row: SchoolGradeRow) {
    try {
      await api.request(`${SCHOOL_OPS_API}/grades/${row.id}`, { method: 'DELETE' });
      await feedback.success({
        title: 'Grade deleted',
        message: `${row.name_en} was removed.`,
      });
      setSelectedId(null);
      setMode('view');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete grade');
    }
  }

  if (loading && rows.length === 0 && !stats) {
    return <p className={`${P}muted`}>Loading grades…</p>;
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
    <div className={`${P}page`}>
      <section className={`${P}hero stem-animate-rise`}>
        <div>
          <p className={`${P}eyebrow`}>Control · School curriculum</p>
          <h2 className={`${P}hero-title`}>Grades</h2>
          <p className={`${P}hero-lead`}>
            Set up grade levels in sequence — each grade anchors classes, sections, and student
            enrolments.
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
            <Link to="/curriculum/subjects" className={`${P}ghost-link`}>
              Subjects
            </Link>
            <Button type="button" variant="apricot" onClick={startCreate} size="sm">
              + New grade
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

      <StatStrip items={[{ label: 'Grades', value: String(stats?.total ?? '—') }]} />

      <div className={`${P}layout`}>
        <Panel
          title="Grade directory"
          description="Grades are ordered by sequence — select a row to edit or remove."
        >
          <div className={`${P}table-wrap`}>
            <table className={`${P}table`}>
              <thead>
                <tr>
                  <th>Grade</th>
                  <th>Sequence</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={2} className={`${P}empty`}>
                      No grades yet. Add one before creating classes.
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
                        <div className={`${P}slug`}>
                          <code>{row.code}</code>
                          {row.name_ar ? <span> · {row.name_ar}</span> : null}
                        </div>
                      </td>
                      <td>{row.sequence}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <aside className={`${P}side`} aria-live="polite">
          {showingForm ? (
            <Panel
              title={mode === 'create' ? 'Create grade' : 'Edit grade'}
              description="Grade codes and sequence determine class ordering."
            >
              <form onSubmit={onSave} className={`${P}form`} noValidate>
                <TextField
                  label="Grade code"
                  required
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="G7"
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
                />
                <TextField
                  label="Sequence"
                  required
                  type="number"
                  min={0}
                  value={form.sequence}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      sequence: e.target.value === '' ? '' : Number(e.target.value),
                    }))
                  }
                  hint="Lower numbers appear first"
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
            <div className={`${P}detail`}>
              <div className={`${P}detail-head`}>
                <span className={`${P}detail-mark`} aria-hidden>
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

              <dl className={`${P}meta`}>
                <div>
                  <dt>Sequence</dt>
                  <dd>{activeDetail.sequence}</dd>
                </div>
              </dl>

              <div className={`${P}actions`}>
                <Button size="sm" type="button" variant="secondary" onClick={() => startEdit(activeDetail)}>
                  Edit
                </Button>
                <ConfirmButton
                  size="sm"
                  title="Delete grade?"
                  message={`${activeDetail.name_en} will be removed. Classes linked to this grade may be affected.`}
                  confirmLabel="Delete"
                  tone="danger"
                  variant="danger"
                  onConfirm={() => deleteGrade(activeDetail)}
                >
                  Delete
                </ConfirmButton>
              </div>

              <CurriculumLinks current="/curriculum/grades" />
            </div>
          ) : (
            <div className={`${P}detail ${P}detail-empty`}>
              <p className={`${P}empty`}>Select a grade to review details and actions.</p>
              <Button size="sm" type="button" variant="apricot" onClick={startCreate}>
                + New grade
              </Button>
            </div>
          )}
        </aside>
      </div>

      <style>{styles}</style>
    </div>
  );
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
