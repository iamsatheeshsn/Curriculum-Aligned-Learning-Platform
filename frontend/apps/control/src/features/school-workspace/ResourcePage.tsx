import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@stemora/auth';
import {
  Button,
  ConfirmButton,
  FormActions,
  Panel,
  SelectField,
  StatStrip,
  TextAreaField,
  TextField,
  Toolbar,
  downloadExcelCsv,
  exportPdfDocument,
  kpiHtml,
  printHtmlDocument,
  tableHtml,
  useFeedback,
  validateFormFields,
} from '@stemora/ui';
import { ControlLayout } from '../../layout/ControlLayout';
import { StatusPill, WORKSPACE_API, WorkspaceGuard, formatMoney, formatWhen } from './shared';
import { workspacePageStyles } from './styles';

export type FieldType = 'text' | 'email' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox' | 'password';

export type ResourceField = {
  key: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  hint?: string;
  /** Hide from create/edit form */
  formHidden?: boolean;
  /** Only show in edit mode */
  editOnly?: boolean;
  /** Only show in create mode */
  createOnly?: boolean;
};

export type ResourceColumn = {
  key: string;
  label: string;
  render?: (row: Record<string, unknown>) => ReactNode;
};

export type ResourceConfig = {
  id: string;
  title: string;
  subtitle: string;
  heroLead: string;
  eyebrow?: string;
  navPermission: string | string[];
  /** API path after WORKSPACE_API, e.g. "staff" or "learning/courses" */
  endpoint: string;
  prefix: string;
  idKey?: string;
  labelKey?: string;
  columns: ResourceColumn[];
  fields: ResourceField[];
  stats?: { key: string; label: string; hint?: string }[];
  links?: { to: string; label: string }[];
  createLabel?: string;
  allowCreate?: boolean;
  allowEdit?: boolean;
  allowDelete?: boolean;
  /** Show Print for selected row */
  allowPrint?: boolean;
  /** Show Export PDF/Excel for the list */
  allowExport?: boolean;
  searchPlaceholder?: string;
  statusFilterOptions?: { value: string; label: string }[];
  emptyLabel?: string;
  detailMeta?: { key: string; label: string; money?: boolean; date?: boolean; status?: boolean }[];
};

function dig(row: Record<string, unknown>, key: string): unknown {
  if (key.includes('.')) {
    return key.split('.').reduce<unknown>((acc, part) => {
      if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part];
      return undefined;
    }, row);
  }
  return row[key];
}

function displayValue(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (o.name_en) return String(o.name_en);
    if (o.name) return String(o.name);
    if (o.title_en) return String(o.title_en);
    if (o.email) return String(o.email);
  }
  return String(value);
}

function emptyForm(fields: ResourceField[]): Record<string, string | boolean | number> {
  const form: Record<string, string | boolean | number> = {};
  for (const f of fields) {
    if (f.formHidden) continue;
    if (f.type === 'checkbox') form[f.key] = false;
    else if (f.type === 'number') form[f.key] = '';
    else if (f.type === 'select' && f.options?.[0]) form[f.key] = f.options[0].value;
    else form[f.key] = '';
  }
  return form;
}

function formFromRow(fields: ResourceField[], row: Record<string, unknown>) {
  const form = emptyForm(fields);
  for (const f of fields) {
    if (f.formHidden) continue;
    const v = dig(row, f.key);
    if (f.type === 'checkbox') form[f.key] = Boolean(v);
    else if (f.type === 'date' && typeof v === 'string') form[f.key] = v.slice(0, 10);
    else if (v != null) form[f.key] = v as string | number | boolean;
  }
  return form;
}

function personLabel(row: Record<string, unknown>) {
  const first = row.first_name != null ? String(row.first_name) : '';
  const last = row.last_name != null ? String(row.last_name) : '';
  const name = [first, last].filter(Boolean).join(' ').trim();
  if (name) return name;
  return displayValue(row.email ?? row.title_en ?? row.name_en ?? row.title ?? row.name);
}

function roleLabel(value: unknown) {
  if (value == null || value === '') return '—';
  return String(value)
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function initialsFrom(row: Record<string, unknown>) {
  const first = String(row.first_name ?? '').trim();
  const last = String(row.last_name ?? '').trim();
  if (first || last) return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || '•';
  const email = String(row.email ?? '').trim();
  return email.slice(0, 2).toUpperCase() || '•';
}

/**
 * Configurable list + detail CRUD page for school-workspace resources.
 */
export function ResourcePage(config: ResourceConfig) {
  return (
    <WorkspaceGuard navPermission={config.navPermission}>
      <ControlLayout title={config.title} subtitle={config.subtitle}>
        <ResourceWorkspace config={config} />
      </ControlLayout>
    </WorkspaceGuard>
  );
}

function ResourceWorkspace({ config }: { config: ResourceConfig }) {
  const {
    prefix: P,
    endpoint,
    idKey = 'id',
    labelKey,
    allowCreate = true,
    allowEdit = true,
    allowDelete = false,
    allowPrint = false,
    allowExport = false,
  } = config;
  const { api } = useAuth();
  const feedback = useFeedback();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [stats, setStats] = useState<Record<string, number | string> | null>(null);
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view');
  const [form, setForm] = useState(() => emptyForm(config.fields));
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (status) params.set('status', status);
      const qs = params.toString();
      const res = await api.get<{
        data: Record<string, unknown>[];
        meta?: { stats?: Record<string, number | string> };
      }>(`${WORKSPACE_API}/${endpoint}${qs ? `?${qs}` : ''}`);
      setRows(res.data ?? []);
      setStats(res.meta?.stats ?? null);
      setSelectedId((current) => {
        if (mode === 'create') return current;
        if (current != null && res.data.some((r) => r[idKey] === current)) return current;
        return (res.data[0]?.[idKey] as string | number | undefined) ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to load ${config.title.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  }, [api, search, status, mode, endpoint, idKey, config.title]);

  useEffect(() => {
    void load();
  }, [api]);

  const selected = useMemo(
    () => rows.find((r) => r[idKey] === selectedId) ?? null,
    [rows, selectedId, idKey],
  );

  const selectedLabel = selected
    ? labelKey
      ? displayValue(dig(selected, labelKey))
      : personLabel(selected)
    : '';

  const selectedSubtitle = selected
    ? displayValue(
        selected.email && personLabel(selected) !== displayValue(selected.email)
          ? selected.email
          : selected.code ?? selected.role ?? selected.status,
      )
    : '';

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    await load();
  }

  function startCreate() {
    setMode('create');
    setForm(emptyForm(config.fields));
  }

  function startEdit() {
    if (!selected) return;
    setMode('edit');
    setForm(formFromRow(config.fields, selected));
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!validateFormFields(e.currentTarget as HTMLFormElement)) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const f of config.fields) {
        if (f.formHidden) continue;
        if (f.editOnly && mode === 'create') continue;
        if (f.createOnly && mode === 'edit') continue;
        let v = form[f.key];
        if (f.type === 'number' && v !== '') v = Number(v);
        if (f.type === 'checkbox') v = Boolean(v);
        if (v === '') v = null;
        payload[f.key] = v;
      }
      if (mode === 'create') {
        await api.post(`${WORKSPACE_API}/${endpoint}`, payload);
        await feedback.success({ title: 'Created', message: `${config.title} record saved.` });
      } else if (selected) {
        await api.put(`${WORKSPACE_API}/${endpoint}/${selected[idKey]}`, payload);
        await feedback.success({ title: 'Updated', message: `${config.title} record updated.` });
      }
      setMode('view');
      await load();
    } catch (err) {
      await feedback.error({
        title: 'Save failed',
        message: err instanceof Error ? err.message : 'Unable to save.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!selected) return;
    try {
      await api.delete(`${WORKSPACE_API}/${endpoint}/${selected[idKey]}`);
      await feedback.success({ title: 'Deleted', message: 'Record removed.' });
      setSelectedId(null);
      await load();
    } catch (err) {
      await feedback.error({
        title: 'Delete failed',
        message: err instanceof Error ? err.message : 'Unable to delete.',
      });
    }
  }

  function printSelected() {
    if (!selected) return;
    const metaRows = (
      config.detailMeta ?? config.columns.map((c) => ({ key: c.key, label: c.label }))
    ).map((m) => {
      const raw = dig(selected, m.key);
      let value = displayValue(raw);
      if ('money' in m && m.money) value = formatMoney(Number(raw), String(selected.currency ?? 'SAR'));
      if ('date' in m && m.date) value = formatWhen(raw as string);
      return `<tr><th style="text-align:left;padding:6px 10px;color:#5b6b73">${escape(m.label)}</th><td style="padding:6px 10px">${escape(value)}</td></tr>`;
    });
    printHtmlDocument(`
      <div class="stem-print-page"><div class="stem-print-sheet">
        <header class="stem-print-header"><div><p class="stem-print-kicker">Stemora · ${escape(config.title)}</p>
        <h1>${escape(selectedLabel)}</h1></div></header>
        <div class="stem-print-body"><table class="stem-print-table">${metaRows.join('')}</table></div>
      </div></div>
    `);
  }

  function exportList(kind: 'pdf' | 'excel') {
    const headers = config.columns.map((c) => c.label);
    const exportRows = rows.map((row) => config.columns.map((c) => displayValue(dig(row, c.key))));
    if (kind === 'excel') {
      downloadExcelCsv(`${config.id}-${new Date().toISOString().slice(0, 10)}.csv`, headers, exportRows);
      return;
    }
    void exportPdfDocument({
      title: config.title,
      subtitle: config.subtitle,
      documentLabel: 'Stemora · School workspace',
      bodyHtml:
        (stats
          ? kpiHtml(
              (config.stats ?? Object.keys(stats).map((k) => ({ key: k, label: k }))).map((s) => ({
                label: s.label,
                value: stats[s.key] ?? '—',
              })),
            )
          : '') + tableHtml(headers, exportRows),
    });
  }

  const formFields = config.fields.filter(
    (f) =>
      !f.formHidden &&
      !(f.editOnly && mode === 'create') &&
      !(f.createOnly && mode === 'edit'),
  );

  return (
    <div className={`${P}page`}>
      <style>{workspacePageStyles(P)}</style>
      <section className={`${P}hero`}>
        <div className={`${P}hero-copy`}>
          <p className={`${P}eyebrow`}>{config.eyebrow ?? 'Control · School workspace'}</p>
          <p className={`${P}hero-lead`}>{config.heroLead}</p>
        </div>
        <div className={`${P}hero-actions`}>
          <div className={`${P}action-row`}>
            <Button size="sm" type="button" variant="secondary" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
            {allowExport ? (
              <>
                <Button size="sm" type="button" variant="secondary" onClick={() => exportList('pdf')}>
                  Export PDF
                </Button>
                <Button size="sm" type="button" variant="secondary" onClick={() => exportList('excel')}>
                  Export Excel
                </Button>
              </>
            ) : null}
            {allowCreate ? (
              <Button size="sm" type="button" variant="primary" onClick={startCreate}>
                {config.createLabel ?? `+ New`}
              </Button>
            ) : null}
          </div>
          {config.links?.length ? (
            <div className={`${P}action-row`}>
              {config.links.map((l) => (
                <Link key={l.to} className={`${P}ghost-link`} to={l.to}>
                  {l.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {stats && config.stats?.length ? (
        <StatStrip
          items={config.stats.map((s) => ({
            label: s.label,
            value: stats[s.key] ?? '—',
            hint: s.hint,
          }))}
        />
      ) : null}

      {error ? (
        <div className={`${P}alert`} role="alert">
          <span>{error}</span>
          <Button size="sm" type="button" variant="secondary" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : null}

      <div className={`${P}layout`}>
        <Panel
          title={`${config.title} directory`}
          description={config.searchPlaceholder ?? 'Search, then select a row to review or edit.'}
        >
          <Toolbar>
            <form onSubmit={onSearch} className={`${P}filters`}>
              <TextField
                label="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={config.searchPlaceholder ?? 'Search…'}
              />
              {config.statusFilterOptions?.length ? (
                <SelectField label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">All statuses</option>
                  {config.statusFilterOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </SelectField>
              ) : null}
              <div className={`${P}filter-submit`}>
                <Button size="sm" type="submit" variant="secondary">
                  Apply
                </Button>
              </div>
            </form>
          </Toolbar>
          <div className={`${P}table-wrap`}>
            <table className={`${P}table`}>
              <thead>
                <tr>
                  {config.columns.map((c) => (
                    <th key={c.key}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={config.columns.length} className={`${P}empty`}>
                      Loading…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={config.columns.length} className={`${P}empty`}>
                      {config.emptyLabel ?? 'No records yet.'}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={String(row[idKey])}
                      className={selectedId === row[idKey] && mode === 'view' ? 'is-selected' : undefined}
                      onClick={() => {
                        setMode('view');
                        setSelectedId(row[idKey] as string | number);
                      }}
                    >
                      {config.columns.map((c) => (
                        <td key={c.key}>
                          {c.render
                            ? c.render(row)
                            : c.key === 'status' || c.key.endsWith('_status') ? (
                                <StatusPill prefix={P} status={String(dig(row, c.key) ?? '')} />
                              ) : (
                                displayValue(dig(row, c.key))
                              )}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <aside className={`${P}side`}>
          {mode === 'create' || mode === 'edit' ? (
            <Panel title={mode === 'create' ? `Create ${config.title.slice(0, -1) || config.title}` : 'Edit record'}>
              <form onSubmit={onSave} className={`${P}form`} noValidate>
                {formFields.map((f) => {
                  if (f.type === 'textarea') {
                    return (
                      <TextAreaField
                        key={f.key}
                        label={f.label}
                        required={f.required}
                        value={String(form[f.key] ?? '')}
                        onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      />
                    );
                  }
                  if (f.type === 'select') {
                    return (
                      <SelectField
                        key={f.key}
                        label={f.label}
                        required={f.required}
                        value={String(form[f.key] ?? '')}
                        onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      >
                        {(f.options ?? []).map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </SelectField>
                    );
                  }
                  if (f.type === 'checkbox') {
                    return (
                      <label key={f.key} className={`${P}check`}>
                        <input
                          type="checkbox"
                          checked={Boolean(form[f.key])}
                          onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.checked }))}
                        />
                        <span>{f.label}</span>
                      </label>
                    );
                  }
                  return (
                    <TextField
                      key={f.key}
                      label={f.label}
                      required={f.required}
                      type={
                        f.type === 'email'
                          ? 'email'
                          : f.type === 'number'
                            ? 'number'
                            : f.type === 'date'
                              ? 'date'
                              : f.type === 'password'
                                ? 'password'
                                : 'text'
                      }
                      placeholder={f.placeholder}
                      hint={f.hint}
                      autoComplete={f.type === 'password' ? 'new-password' : undefined}
                      minLength={f.type === 'password' ? 8 : undefined}
                      value={String(form[f.key] ?? '')}
                      onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    />
                  );
                })}
                <FormActions>
                  <Button size="sm" type="button" variant="secondary" onClick={() => setMode('view')}>
                    Cancel
                  </Button>
                  <Button size="sm" type="submit" variant="primary" disabled={saving}>
                    {saving ? 'Saving…' : mode === 'create' ? 'Create' : 'Save changes'}
                  </Button>
                </FormActions>
              </form>
            </Panel>
          ) : selected ? (
            <div className={`${P}detail`}>
              <div className={`${P}detail-head`}>
                <span className={`${P}detail-mark`} aria-hidden>
                  {initialsFrom(selected)}
                </span>
                <div>
                  <h3>{selectedLabel}</h3>
                  <p>{selectedSubtitle}</p>
                </div>
              </div>
              <dl className={`${P}meta`}>
                {(config.detailMeta ?? config.columns.map((c) => ({ key: c.key, label: c.label }))).map((m) => {
                  const raw = dig(selected, m.key);
                  let value: ReactNode = displayValue(raw);
                  const asMeta = m as { key: string; label: string; money?: boolean; date?: boolean; status?: boolean };
                  if (asMeta.status || asMeta.key === 'status') value = <StatusPill prefix={P} status={String(raw ?? '')} />;
                  else if (asMeta.key === 'role') value = roleLabel(raw);
                  else if (asMeta.money) value = formatMoney(Number(raw), String(selected.currency ?? 'SAR'));
                  else if (asMeta.date) value = formatWhen(raw as string);
                  return (
                    <div key={m.key}>
                      <dt>{m.label}</dt>
                      <dd>{value}</dd>
                    </div>
                  );
                })}
              </dl>
              <div className={`${P}actions`}>
                {allowEdit ? (
                  <Button size="sm" type="button" variant="secondary" onClick={startEdit}>
                    Edit
                  </Button>
                ) : null}
                {allowPrint ? (
                  <Button size="sm" type="button" variant="secondary" onClick={printSelected}>
                    Print
                  </Button>
                ) : null}
                {allowDelete ? (
                  <ConfirmButton
                    size="sm"
                    title="Delete record?"
                    message="This cannot be undone."
                    confirmLabel="Delete"
                    tone="danger"
                    variant="danger"
                    onConfirm={onDelete}
                  >
                    Delete
                  </ConfirmButton>
                ) : null}
              </div>
              {config.links?.length ? (
                <div className={`${P}links`}>
                  {config.links.map((l) => (
                    <Link key={l.to} to={l.to} className={`${P}ghost-link`}>
                      {l.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className={`${P}empty-side`}>Select a row to review details.</div>
          )}
        </aside>
      </div>
    </div>
  );
}

function escape(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
