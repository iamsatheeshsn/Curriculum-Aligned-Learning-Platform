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

type CountryRow = {
  id: number;
  code: string;
  name_en: string;
  name_ar: string;
  default_locale: string;
  default_timezone: string;
  is_active: boolean;
  status: string;
  usage: { curricula: number; schools: number; tenants: number };
  curricula?: {
    id: number;
    code: string;
    name_en: string;
    name_ar?: string | null;
    status: string;
    version: string | number;
  }[];
  created_at?: string | null;
  updated_at?: string | null;
};

type CountryStats = {
  total: number;
  active: number;
  inactive: number;
  with_curricula: number;
};

type CountryForm = {
  code: string;
  name_en: string;
  name_ar: string;
  default_locale: string;
  default_timezone: string;
  is_active: boolean;
};

const emptyForm = (): CountryForm => ({
  code: '',
  name_en: '',
  name_ar: '',
  default_locale: 'en',
  default_timezone: 'Asia/Riyadh',
  is_active: true,
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

/**
 * Platform catalogue of countries used by curricula, schools, and organisations.
 */
export function CountriesPage() {
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
      title="Countries"
      subtitle="Manage the country catalogue that underpins curricula and school organisations"
    >
      <CountriesWorkspace />
    </ControlLayout>
  );
}

function CountriesWorkspace() {
  const { api } = useAuth();
  const feedback = useFeedback();
  const [rows, setRows] = useState<CountryRow[]>([]);
  const [stats, setStats] = useState<CountryStats | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<CountryRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view');
  const [form, setForm] = useState<CountryForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      const qs = params.toString();
      const res = await api.get<{
        data: CountryRow[];
        meta: { stats: CountryStats };
      }>(`/control/countries${qs ? `?${qs}` : ''}`);
      setRows(res.data);
      setStats(res.meta.stats);
      setSelectedId((current) => {
        if (mode === 'create') return current;
        if (current && res.data.some((r) => r.id === current)) return current;
        return res.data[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load countries');
    } finally {
      setLoading(false);
    }
  }, [api, search, statusFilter, mode]);

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
        const res = await api.get<{ data: CountryRow }>(`/control/countries/${selectedId}`);
        if (!cancelled) setDetail(res.data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load country details');
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
    setForm(emptyForm());
    setSelectedId(null);
    setDetail(null);
  }

  function startEdit(row: CountryRow) {
    setMode('edit');
    setSelectedId(row.id);
    setForm({
      code: row.code,
      name_en: row.name_en,
      name_ar: row.name_ar ?? '',
      default_locale: row.default_locale || 'en',
      default_timezone: row.default_timezone || 'UTC',
      is_active: row.is_active,
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
    const code = form.code.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) {
      setError('Country code must be a 2-letter ISO code (e.g. SA).');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        code,
        name_en: form.name_en.trim(),
        name_ar: form.name_ar.trim() || form.name_en.trim(),
        default_locale: form.default_locale,
        default_timezone: form.default_timezone,
        is_active: form.is_active,
      };

      if (mode === 'create') {
        const res = await api.post<{ data: CountryRow }>('/control/countries', payload);
        setMode('view');
        setSelectedId(res.data.id);
        await load();
        await feedback.success({
          title: 'Country created',
          message: `${res.data.name_en} (${res.data.code}) is ready for curricula and schools.`,
        });
      } else if (selectedId) {
        const res = await api.request<{ data: CountryRow }>(`/control/countries/${selectedId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setMode('view');
        await load();
        await feedback.success({
          title: 'Country updated',
          message: `${res.data.name_en} has been saved.`,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save country');
    } finally {
      setSaving(false);
    }
  }

  async function setActive(row: CountryRow, isActive: boolean) {
    try {
      await api.request(`/control/countries/${row.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: isActive }),
      });
      await feedback.success({
        title: isActive ? 'Country activated' : 'Country deactivated',
        message: `${row.name_en} is now ${isActive ? 'active' : 'inactive'}.`,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update status');
    }
  }

  async function deleteCountry(row: CountryRow) {
    try {
      await api.request(`/control/countries/${row.id}`, { method: 'DELETE' });
      await feedback.success({
        title: 'Country deleted',
        message: `${row.name_en} was removed from the catalogue.`,
      });
      setSelectedId(null);
      setDetail(null);
      setMode('view');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete country');
    }
  }

  if (loading && rows.length === 0 && !stats) {
    return <p className="co-muted">Loading countries…</p>;
  }

  if (error && !stats && rows.length === 0) {
    return (
      <Panel title="Unable to load countries">
        <p style={{ color: 'var(--stem-danger)', marginTop: 0 }}>{error}</p>
        <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
          Retry
        </Button>
      </Panel>
    );
  }

  return (
    <div className="co-page">
      <section className="co-hero stem-animate-rise">
        <div>
          <p className="co-eyebrow">Control · Curriculum management</p>
          <h2 className="co-hero-title">Countries</h2>
          <p className="co-hero-lead">
            Maintain the ISO country catalogue that curricula, schools, and organisations reference —
            including default language and timezone.
          </p>
        </div>
        <div className="co-hero-actions">
          <div className="co-action-row">
            <Button
              size="sm"
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => void load()}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Link to="/curriculum/curriculums" className="co-ghost-link">
              Curriculums
            </Link>
            <Button type="button" variant="apricot" onClick={startCreate} size="sm">
              + New country
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="co-alert" role="alert">
          <span>{error}</span>
          <Button size="sm" type="button" variant="secondary" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <StatStrip
        items={[
          { label: 'Countries', value: String(stats?.total ?? '—') },
          { label: 'Active', value: String(stats?.active ?? '—') },
          { label: 'Inactive', value: String(stats?.inactive ?? '—') },
          {
            label: 'With curricula',
            value: String(stats?.with_curricula ?? '—'),
            hint: 'Linked frameworks',
          },
        ]}
      />

      <div className="co-layout">
        <Panel
          title="Country directory"
          description="Search by code or name, then select a row to edit, activate, or remove."
          action={
            <Toolbar as="form" onSubmit={onSearch}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search code or name"
                aria-label="Search countries"
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
          <div className="co-table-wrap">
            <table className="co-table">
              <thead>
                <tr>
                  <th>Country</th>
                  <th>Locale</th>
                  <th>Timezone</th>
                  <th>Usage</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="co-empty">
                      No countries match this filter. Add one to get started.
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
                        <div className="co-slug">
                          <code>{row.code}</code>
                          {row.name_ar ? <span> · {row.name_ar}</span> : null}
                        </div>
                      </td>
                      <td>{row.default_locale}</td>
                      <td>{row.default_timezone}</td>
                      <td>
                        {row.usage.curricula} cur · {row.usage.schools} sch
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

        <aside className="co-side" aria-live="polite">
          {showingForm ? (
            <Panel
              title={mode === 'create' ? 'Create country' : 'Edit country'}
              description={
                mode === 'create'
                  ? 'Add an ISO country for curricula and school onboarding.'
                  : 'Update names, defaults, or lifecycle status.'
              }
            >
              <form onSubmit={onSave} className="co-form" noValidate>
                <TextField
                  label="Country code"
                  required
                  value={form.code}
                  maxLength={2}
                  placeholder="SA"
                  disabled={mode === 'edit'}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, code: e.target.value.toUpperCase().slice(0, 2) }))
                  }
                  hint={mode === 'edit' ? 'ISO code cannot be changed after create.' : '2-letter ISO code'}
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
                  label="Default locale"
                  value={form.default_locale}
                  onChange={(e) => setForm((f) => ({ ...f, default_locale: e.target.value }))}
                >
                  {LOCALES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="Default timezone"
                  value={form.default_timezone}
                  onChange={(e) => setForm((f) => ({ ...f, default_timezone: e.target.value }))}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="Status"
                  value={form.is_active ? 'active' : 'inactive'}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, is_active: e.target.value === 'active' }))
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </SelectField>
                <FormActions>
                  <Button size="sm" type="button" variant="secondary" onClick={cancelForm}>
                    Cancel
                  </Button>
                  <Button size="sm" type="submit" variant="primary" disabled={saving}>
                    {saving ? 'Saving…' : mode === 'create' ? 'Create country' : 'Save changes'}
                  </Button>
                </FormActions>
              </form>
            </Panel>
          ) : activeDetail ? (
            <div className="co-detail">
              <div className="co-detail-head">
                <span className="co-detail-mark" aria-hidden>
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
                <p className="co-muted">Loading details…</p>
              ) : (
                <>
                  <dl className="co-meta">
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <StatusPill status={activeDetail.status} />
                      </dd>
                    </div>
                    <div>
                      <dt>Locale</dt>
                      <dd>{activeDetail.default_locale}</dd>
                    </div>
                    <div>
                      <dt>Timezone</dt>
                      <dd>{activeDetail.default_timezone}</dd>
                    </div>
                    <div>
                      <dt>Curricula</dt>
                      <dd>{activeDetail.usage.curricula}</dd>
                    </div>
                    <div>
                      <dt>Schools</dt>
                      <dd>{activeDetail.usage.schools}</dd>
                    </div>
                    <div>
                      <dt>Organisations</dt>
                      <dd>{activeDetail.usage.tenants}</dd>
                    </div>
                  </dl>

                  {(activeDetail.curricula?.length ?? 0) > 0 ? (
                    <ul className="co-usage-list">
                      {activeDetail.curricula!.map((c) => (
                        <li key={c.id}>
                          <strong>{c.name_en}</strong>
                          <span>
                            {c.code} · v{c.version} · {statusLabel(c.status)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="co-actions">
                    <Button
                      size="sm"
                      type="button"
                      variant="secondary"
                      onClick={() => startEdit(activeDetail)}
                    >
                      Edit
                    </Button>
                    {activeDetail.is_active ? (
                      <ConfirmButton
                        size="sm"
                        title="Deactivate country?"
                        message={`${activeDetail.name_en} will no longer be offered for new curricula or schools.`}
                        confirmLabel="Deactivate"
                        tone="warn"
                        variant="secondary"
                        onConfirm={() => setActive(activeDetail, false)}
                      >
                        Deactivate
                      </ConfirmButton>
                    ) : (
                      <ConfirmButton
                        size="sm"
                        title="Activate country?"
                        message={`${activeDetail.name_en} will be available for curricula and school onboarding.`}
                        confirmLabel="Activate"
                        tone="primary"
                        variant="primary"
                        onConfirm={() => setActive(activeDetail, true)}
                      >
                        Activate
                      </ConfirmButton>
                    )}
                    {activeDetail.usage.curricula +
                      activeDetail.usage.schools +
                      activeDetail.usage.tenants >
                    0 ? (
                      <Button
                        size="sm"
                        type="button"
                        variant="danger"
                        disabled
                        title="In use — deactivate instead of deleting"
                      >
                        Delete
                      </Button>
                    ) : (
                      <ConfirmButton
                        size="sm"
                        title="Delete country?"
                        message={`${activeDetail.name_en} will be soft-deleted from the catalogue.`}
                        confirmLabel="Delete"
                        tone="danger"
                        variant="danger"
                        onConfirm={() => deleteCountry(activeDetail)}
                      >
                        Delete
                      </ConfirmButton>
                    )}
                  </div>

                  <div className="co-links">
                    <Link to="/curriculum/curriculums">Open curriculums</Link>
                    <Link to="/tenants">Tenant directory</Link>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="co-detail co-detail-empty">
              <p className="co-empty">Select a country to review details and actions.</p>
              <Button size="sm" type="button" variant="apricot" onClick={startCreate}>
                + New country
              </Button>
            </div>
          )}
        </aside>
      </div>

      <style>{countryStyles}</style>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`co-pill status-${status}`}>{statusLabel(status)}</span>;
}

const countryStyles = `
.co-page { display: grid; gap: 1rem; }
.co-hero {
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
.co-eyebrow {
  margin: 0 0 0.3rem;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--stem-teal-deep);
}
.co-hero-title {
  margin: 0 0 0.35rem;
  font-family: var(--stem-font-display);
  font-size: clamp(1.35rem, 1.8vw, 1.55rem);
  letter-spacing: -0.03em;
}
.co-hero-lead {
  margin: 0;
  color: var(--stem-ink-soft);
  line-height: 1.5;
  max-width: 42rem;
  font-size: var(--stem-text-base);
}
.co-hero-actions { display: grid; gap: 0.75rem; justify-items: end; }
.co-action-row { display: flex; flex-wrap: wrap; gap: 0.45rem; justify-content: flex-end; align-items: center; }
.co-ghost-link {
  display: inline-flex; align-items: center; min-height: 40px; padding: 0 0.75rem;
  font-size: var(--stem-text-md); font-weight: 600; color: var(--stem-teal-deep); text-decoration: none;
}
.co-ghost-link:hover { text-decoration: underline; }
.co-alert {
  display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;
  padding: 0.85rem 1rem; border-radius: 12px; background: #fef3f2; color: var(--stem-danger);
  border: 1px solid #fecdca; font-size: var(--stem-text-base);
}
.co-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(280px, 0.85fr);
  gap: 1rem;
  align-items: start;
}
.co-table-wrap { overflow-x: auto; margin: 0 -0.15rem; }
.co-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--stem-text-base);
}
.co-table th {
  text-align: left;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--stem-ink-soft);
  padding: 0.55rem 0.65rem;
  border-bottom: 1px solid var(--stem-line);
  white-space: nowrap;
}
.co-table td {
  padding: 0.7rem 0.65rem;
  border-bottom: 1px solid var(--stem-line);
  vertical-align: top;
}
.co-table tbody tr {
  cursor: pointer;
  transition: background 0.15s ease;
}
.co-table tbody tr:hover { background: rgba(18, 160, 171, 0.04); }
.co-table tbody tr.is-selected { background: rgba(12, 124, 128, 0.08); }
.co-slug { margin-top: 0.15rem; font-size: var(--stem-text-sm); color: var(--stem-ink-soft); }
.co-slug code { font-size: var(--stem-text-sm); }
.co-empty { text-align: center; color: var(--stem-ink-soft); padding: 1.5rem 0.75rem !important; }
.co-side { position: sticky; top: 0.75rem; }
.co-detail {
  display: grid;
  gap: 1rem;
  padding: 1.1rem 1.15rem;
  border-radius: 16px;
  border: 1px solid var(--stem-line);
  background: #fff;
}
.co-detail-empty { min-height: 180px; align-content: center; justify-items: start; gap: 0.85rem; }
.co-detail-head {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}
.co-detail-mark {
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
.co-detail-head h3 {
  margin: 0;
  font-size: var(--stem-text-xl);
  letter-spacing: -0.02em;
}
.co-detail-head p {
  margin: 0.15rem 0 0;
  font-size: var(--stem-text-md);
  color: var(--stem-ink-soft);
}
.co-meta {
  display: grid;
  gap: 0.55rem;
  margin: 0;
}
.co-meta > div {
  display: grid;
  grid-template-columns: 7.5rem minmax(0, 1fr);
  gap: 0.5rem;
  align-items: baseline;
}
.co-meta dt {
  margin: 0;
  font-size: var(--stem-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--stem-ink-soft);
}
.co-meta dd { margin: 0; font-size: var(--stem-text-base); }
.co-usage-list {
  list-style: none;
  margin: 0;
  padding: 0.75rem 0 0;
  border-top: 1px solid var(--stem-line);
  display: grid;
  gap: 0.45rem;
}
.co-usage-list li {
  display: grid;
  gap: 0.1rem;
  font-size: var(--stem-text-md);
}
.co-usage-list span { color: var(--stem-ink-soft); font-size: var(--stem-text-sm); }
.co-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--stem-line);
}
.co-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  padding-top: 0.25rem;
}
.co-links a {
  font-size: var(--stem-text-md);
  font-weight: 600;
  color: var(--stem-teal-deep);
  text-decoration: none;
}
.co-links a:hover { text-decoration: underline; }
.co-form { display: grid; gap: 0.85rem; }
.co-pill {
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
.co-pill.status-active { background: #ecfdf5; color: #047857; }
.co-pill.status-inactive { background: #f3f4f6; color: #4b5563; }
.co-muted { color: var(--stem-ink-soft); font-size: var(--stem-text-base); margin: 0; }
@media (max-width: 960px) {
  .co-hero, .co-layout { grid-template-columns: 1fr; }
  .co-hero-actions { justify-items: start; }
  .co-action-row { justify-content: flex-start; }
  .co-side { position: static; }
}
`;
