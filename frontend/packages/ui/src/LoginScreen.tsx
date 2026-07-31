import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { BrandMark } from './Brand';
import { FieldError, FieldLabel } from './Feedback';
import { useResolvedTenant } from './TenantNotFound';

export type LoginPortal = 'control' | 'institution' | 'learner';

export type LoginFieldValues = {
  email: string;
  password: string;
  tenantSlug?: string;
  remember?: boolean;
  roleMode?: 'student' | 'parent';
};

type DemoAccount = {
  label: string;
  email: string;
  password: string;
  tenantSlug?: string;
  roleMode?: 'student' | 'parent';
};

type FieldErrors = {
  email?: string;
  password?: string;
  tenantSlug?: string;
};

const portalCopy: Record<
  LoginPortal,
  { title: string; subtitle: string; panelTitle: string; panelBody: string; highlights: string[] }
> = {
  control: {
    title: 'Control portal',
    subtitle: 'Super Admin & Tenant Owner sign in',
    panelTitle: 'Operate the platform with clarity',
    panelBody: 'Manage tenants, subscriptions, and institutional access from one secure control plane.',
    highlights: ['Multi-tenant governance', 'Subscription & billing oversight', 'Role-based platform access'],
  },
  institution: {
    title: 'Institution portal',
    subtitle: 'School, teacher & tutor sign in',
    panelTitle: 'Run learning operations day to day',
    panelBody: 'Curriculum, classes, assessments, and live tutoring—scoped to your school tenant.',
    highlights: ['School & campus tools', 'Teaching workspace', 'Tutoring schedules & payouts'],
  },
  learner: {
    title: 'Learner portal',
    subtitle: 'Student & parent sign in',
    panelTitle: 'Learn, track, and stay connected',
    panelBody: 'Students continue lessons and sessions; parents see progress, homework, and reminders.',
    highlights: ['Interactive STEM lessons', 'Homework & assessments', 'Parent progress visibility'],
  },
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function LoginScreen({
  portal,
  onSubmit,
  loading,
  error,
  initial,
  demos = [],
  showTenantSlug = false,
  showRoleToggle = false,
  brandName,
  tenantBrandWhen,
  footerExtra,
}: {
  portal: LoginPortal;
  onSubmit: (values: LoginFieldValues) => Promise<void> | void;
  loading?: boolean;
  error?: string | null;
  initial?: Partial<LoginFieldValues>;
  demos?: DemoAccount[];
  showTenantSlug?: boolean;
  showRoleToggle?: boolean;
  /** Explicit brand label override. */
  brandName?: string;
  /** Use resolved tenant name always, or only when Parent role tab is selected. */
  tenantBrandWhen?: 'always' | 'parent';
  footerExtra?: ReactNode;
}) {
  const copy = portalCopy[portal];
  const emailId = useId();
  const passwordId = useId();
  const slugId = useId();
  const rememberId = useId();

  const remembered =
    typeof window !== 'undefined' ? localStorage.getItem(`stemora.login.email.${portal}`) : null;

  const [email, setEmail] = useState(initial?.email ?? remembered ?? '');
  const [password, setPassword] = useState(initial?.password ?? '');
  const [tenantSlug, setTenantSlug] = useState(initial?.tenantSlug ?? 'al-noor');
  const [remember, setRemember] = useState(Boolean(remembered));
  const [roleMode, setRoleMode] = useState<'student' | 'parent'>(initial?.roleMode ?? 'student');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const resolvedTenant = useResolvedTenant();
  const useTenantBrand =
    tenantBrandWhen === 'always' || (tenantBrandWhen === 'parent' && roleMode === 'parent');
  const brandLabel =
    (useTenantBrand ? resolvedTenant?.name : undefined) || brandName || 'Stemora';

  function validate(fields?: { email?: boolean; password?: boolean; tenantSlug?: boolean }): FieldErrors {
    const next: FieldErrors = {};
    const checkAll = !fields;

    if (checkAll || fields?.tenantSlug) {
      if (showTenantSlug && !tenantSlug.trim()) {
        next.tenantSlug = 'Tenant slug is required.';
      } else if (showTenantSlug && tenantSlug.trim().length < 2) {
        next.tenantSlug = 'Enter a valid tenant slug.';
      }
    }

    if (checkAll || fields?.email) {
      if (!email.trim()) next.email = 'Email is required.';
      else if (!isValidEmail(email.trim())) next.email = 'Enter a valid email address.';
    }

    if (checkAll || fields?.password) {
      if (!password) next.password = 'Password is required.';
      else if (password.length < 6) next.password = 'Password must be at least 6 characters.';
    }

    return next;
  }

  function clearFieldError(key: keyof FieldErrors) {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const copyErr = { ...prev };
      delete copyErr[key];
      return copyErr;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const next = validate();
    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;

    if (remember) localStorage.setItem(`stemora.login.email.${portal}`, email.trim());
    else localStorage.removeItem(`stemora.login.email.${portal}`);

    await onSubmit({
      email: email.trim(),
      password,
      tenantSlug: tenantSlug.trim(),
      remember,
      roleMode,
    });
  }

  function applyDemo(demo: DemoAccount) {
    setEmail(demo.email);
    setPassword(demo.password);
    if (demo.tenantSlug) setTenantSlug(demo.tenantSlug);
    if (demo.roleMode) setRoleMode(demo.roleMode);
    setFieldErrors({});
    setFormError(null);
  }

  const displayError = error || formError;

  return (
    <div data-portal={portal} className="stem-login-root">
      <div className="stem-login-shell">
        <aside className="stem-login-panel stem-animate-fade">
          <BrandMark inverted size="lg" name={brandLabel} />
          <h2 className="stem-login-panel-title">{copy.panelTitle}</h2>
          <p className="stem-login-panel-body">{copy.panelBody}</p>
          <ul className="stem-login-highlights">
            {copy.highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="stem-login-panel-foot">Bilingual STEM learning for KSA & UAE schools</p>
        </aside>

        <section className="stem-login-form-wrap stem-animate-rise">
          <header className="stem-login-header">
            <div className="stem-login-brand-mobile">
              <BrandMark size="md" name={brandLabel} />
            </div>
            <p className="stem-login-kicker">Welcome back</p>
            <h1>{copy.title}</h1>
            <p className="stem-login-subtitle">{copy.subtitle}</p>
          </header>

          {showRoleToggle ? (
            <div className="stem-login-roles" role="tablist" aria-label="Account type">
              {(['student', 'parent'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={roleMode === mode}
                  className={roleMode === mode ? 'is-active' : undefined}
                  onClick={() => {
                    setRoleMode(mode);
                    setPassword('');
                    clearFieldError('password');
                  }}
                >
                  {mode === 'student' ? 'Student' : 'Parent'}
                </button>
              ))}
            </div>
          ) : null}

          <form className="stem-login-form" onSubmit={handleSubmit} noValidate>
            {showTenantSlug ? (
              <div className={`stem-field ${fieldErrors.tenantSlug ? 'is-invalid' : ''}`}>
                <FieldLabel htmlFor={slugId} required>
                  School tenant slug
                </FieldLabel>
                <input
                  id={slugId}
                  name="tenant_slug"
                  value={tenantSlug}
                  onChange={(e) => {
                    setTenantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                    clearFieldError('tenantSlug');
                  }}
                  onBlur={() => setFieldErrors((prev) => ({ ...prev, ...validate({ tenantSlug: true }) }))}
                  placeholder="e.g. al-noor"
                  autoComplete="organization"
                  required
                  aria-invalid={Boolean(fieldErrors.tenantSlug)}
                  aria-describedby={fieldErrors.tenantSlug ? `${slugId}-error` : `${slugId}-hint`}
                />
                {!fieldErrors.tenantSlug ? (
                  <span id={`${slugId}-hint`} className="stem-field-hint">
                    Provided by your school — used in the portal URL.
                  </span>
                ) : null}
                <FieldError id={`${slugId}-error`} message={fieldErrors.tenantSlug} />
              </div>
            ) : null}

            <div className={`stem-field ${fieldErrors.email ? 'is-invalid' : ''}`}>
              <FieldLabel htmlFor={emailId} required>
                Email
              </FieldLabel>
              <input
                id={emailId}
                name="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearFieldError('email');
                }}
                onBlur={() => setFieldErrors((prev) => ({ ...prev, ...validate({ email: true }) }))}
                placeholder="you@school.edu"
                autoComplete="username"
                inputMode="email"
                required
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? `${emailId}-error` : undefined}
              />
              <FieldError id={`${emailId}-error`} message={fieldErrors.email} />
            </div>

            <div className={`stem-field ${fieldErrors.password ? 'is-invalid' : ''}`}>
              <FieldLabel htmlFor={passwordId} required>
                Password
              </FieldLabel>
              <div className="stem-password-wrap">
                <input
                  id={passwordId}
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearFieldError('password');
                  }}
                  onBlur={() => setFieldErrors((prev) => ({ ...prev, ...validate({ password: true }) }))}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? `${passwordId}-error` : undefined}
                  style={{ paddingRight: '3.25rem' }}
                />
                <button
                  type="button"
                  className="stem-password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <FieldError id={`${passwordId}-error`} message={fieldErrors.password} />
            </div>

            <label className="stem-remember" htmlFor={rememberId}>
              <input
                id={rememberId}
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>Remember my email on this device</span>
            </label>

            {displayError ? (
              <div className="stem-alert stem-alert-error" role="alert">
                {displayError}
              </div>
            ) : null}

            <button type="submit" className="stem-submit-btn" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {demos.length > 0 ? (
            <div className="stem-demos">
              <p className="stem-demos-label">Quick fill (demo)</p>
              <div className="stem-demos-list">
                {demos.map((demo) => (
                  <button key={demo.label} type="button" className="stem-demo-chip" onClick={() => applyDemo(demo)}>
                    {demo.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {footerExtra ? <div className="stem-login-footer">{footerExtra}</div> : null}
        </section>
      </div>

      <style>{loginStyles}</style>
    </div>
  );
}

const loginStyles = `
.stem-login-root {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 1.25rem;
  background:
    radial-gradient(ellipse 70% 50% at 0% 0%, rgba(20, 145, 155, 0.18), transparent 55%),
    radial-gradient(ellipse 60% 45% at 100% 100%, rgba(58, 143, 183, 0.16), transparent 50%),
    linear-gradient(165deg, #eef6f5 0%, #e3f0ee 45%, #d9e8ef 100%);
}
.stem-login-shell {
  width: min(960px, 100%);
  display: grid;
  grid-template-columns: 1.05fr 1fr;
  background: #fff;
  border-radius: 24px;
  overflow: hidden;
  border: 1px solid var(--stem-line);
  box-shadow: 0 24px 60px rgba(6, 90, 94, 0.12);
  min-height: 560px;
}
.stem-login-panel {
  background:
    linear-gradient(160deg, rgba(6, 90, 94, 0.96), rgba(11, 61, 74, 0.92) 55%, rgba(58, 143, 183, 0.85));
  color: #e8f6f3;
  padding: 2.25rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  position: relative;
}
.stem-login-panel::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px);
  background-size: 40px 40px;
  pointer-events: none;
  opacity: 0.5;
}
.stem-login-panel > * { position: relative; z-index: 1; }
.stem-login-panel-title {
  margin: 1.5rem 0 0;
  font-family: var(--stem-font-display);
  font-size: clamp(1.6rem, 2.4vw, 2rem);
  line-height: 1.2;
  font-weight: 700;
}
.stem-login-panel-body {
  margin: 0;
  opacity: 0.9;
  font-size: 0.98rem;
  max-width: 34ch;
  line-height: 1.55;
}
.stem-login-highlights {
  margin: 0.5rem 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.65rem;
}
.stem-login-highlights li {
  padding-left: 1.15rem;
  position: relative;
  font-size: var(--stem-text-base);
  opacity: 0.95;
}
.stem-login-highlights li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.45rem;
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: var(--stem-apricot);
}
.stem-login-panel-foot {
  margin-top: auto;
  font-size: var(--stem-text-sm);
  opacity: 0.7;
}
.stem-login-form-wrap {
  padding: 2rem 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.stem-login-brand-mobile { display: none; }
.stem-login-kicker {
  margin: 0;
  font-size: var(--stem-text-sm);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--stem-teal);
}
.stem-login-header h1 {
  margin: 0.35rem 0 0.35rem;
  font-size: var(--stem-text-3xl);
}
.stem-login-subtitle {
  margin: 0;
  color: var(--stem-ink-soft);
  font-size: var(--stem-text-base);
}
.stem-login-roles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  padding: 0.3rem;
  background: var(--stem-mint-soft);
  border-radius: 12px;
}
.stem-login-roles button {
  border: none;
  background: transparent;
  padding: 0.65rem;
  border-radius: 10px;
  font-weight: 600;
  color: var(--stem-ink-soft);
  cursor: pointer;
}
.stem-login-roles button.is-active {
  background: #fff;
  color: var(--stem-teal-deep);
  box-shadow: 0 4px 12px rgba(6, 90, 94, 0.08);
}
.stem-login-form { display: grid; gap: 0.95rem; }
.stem-req { color: #d92d20; font-weight: 700; }
.stem-field { display: grid; gap: 0.4rem; width: 100%; }
.stem-field .stem-field-label {
  font-size: var(--stem-text-md);
  font-weight: 600;
  line-height: 1.3;
  color: var(--stem-ink);
}
.stem-field input {
  width: 100%;
  min-height: 44px;
  padding: 0.7rem 0.9rem;
  border-radius: 12px;
  border: 1px solid var(--stem-line);
  background: #fff;
  color: var(--stem-ink);
  outline: none;
  font: inherit;
  font-size: var(--stem-text-base);
  box-sizing: border-box;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.stem-field input:focus {
  border-color: var(--stem-teal);
  box-shadow: var(--stem-focus);
}
.stem-field.is-invalid input {
  border-color: #f04438;
  box-shadow: 0 0 0 3px rgba(240,68,56,0.12);
  background: #fffbfa;
}
.stem-field-hint { font-size: var(--stem-text-sm); color: var(--stem-ink-soft); line-height: 1.35; }
.stem-password-wrap { position: relative; }
.stem-password-wrap input { padding-right: 4.25rem; }
.stem-password-toggle {
  position: absolute;
  right: 0.45rem;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  color: var(--stem-teal-deep);
  font-size: var(--stem-text-sm);
  font-weight: 600;
  cursor: pointer;
  padding: 0.4rem 0.55rem;
  min-height: 36px;
}
.stem-remember {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  font-size: var(--stem-text-md);
  color: var(--stem-ink-soft);
  cursor: pointer;
  user-select: none;
  min-height: 28px;
}
.stem-remember input { width: 1rem; height: 1rem; accent-color: var(--stem-teal); }
.stem-submit-btn {
  width: 100%;
  border: none;
  border-radius: 12px;
  min-height: 48px;
  padding: 0.85rem 1rem;
  background: linear-gradient(135deg, var(--stem-teal-bright), var(--stem-teal-deep));
  color: #fff;
  font-weight: 700;
  font-size: 0.98rem;
  cursor: pointer;
  margin-top: 0.15rem;
  box-sizing: border-box;
}
.stem-submit-btn:disabled { opacity: 0.65; cursor: not-allowed; }
.stem-alert {
  border-radius: 12px;
  padding: 0.75rem 0.9rem;
  font-size: var(--stem-text-md);
  line-height: 1.4;
}
.stem-alert-error { background: #fef3f2; color: var(--stem-danger); border: 1px solid #fecdca; }
.stem-demos { margin-top: 0.25rem; }
.stem-demos-label { margin: 0 0 0.45rem; font-size: var(--stem-text-sm); color: var(--stem-ink-soft); font-weight: 600; }
.stem-demos-list { display: flex; flex-wrap: wrap; gap: 0.45rem; }
.stem-demo-chip {
  border: 1px solid var(--stem-line);
  background: var(--stem-mint-soft);
  color: var(--stem-teal-deep);
  border-radius: 999px;
  padding: 0.35rem 0.7rem;
  font-size: var(--stem-text-sm);
  font-weight: 600;
  cursor: pointer;
}
.stem-login-footer {
  margin-top: auto;
  padding-top: 0.5rem;
  font-size: var(--stem-text-md);
  color: var(--stem-ink-soft);
  display: grid;
  gap: 0.35rem;
}
.stem-login-footer a { color: var(--stem-teal-deep); font-weight: 600; }
@media (max-width: 860px) {
  .stem-login-shell { grid-template-columns: 1fr; min-height: auto; }
  .stem-login-panel { display: none; }
  .stem-login-brand-mobile { display: block; margin-bottom: 0.75rem; }
  .stem-login-form-wrap { padding: 1.5rem 1.25rem 1.75rem; }
}
`;
