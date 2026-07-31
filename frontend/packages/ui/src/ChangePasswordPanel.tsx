import { useMemo, useState, type FormEvent } from 'react';
import { Button } from './Brand';
import { FormActions, TextField, validateFormFields, useFeedback } from './Feedback';
import { Panel } from './PortalShell';

export type ChangePasswordValues = {
  current_password: string;
  password: string;
  password_confirmation: string;
};

type Requirement = {
  id: string;
  label: string;
  met: boolean;
};

function passwordScore(pwd: string) {
  let score = 0;
  if (pwd.length >= 8) score += 1;
  if (pwd.length >= 12) score += 1;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
  if (/\d/.test(pwd)) score += 1;
  if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
  return score;
}

function strengthLabel(score: number) {
  if (score <= 1) return 'Weak';
  if (score <= 3) return 'Fair';
  if (score === 4) return 'Strong';
  return 'Excellent';
}

/**
 * Shared change-password workspace used by Control, Institution, and Learner portals.
 */
export function ChangePasswordPanel({
  email,
  onSubmit,
  onCancel,
}: {
  email?: string | null;
  onSubmit: (values: ChangePasswordValues) => Promise<void>;
  onCancel?: () => void;
}) {
  const feedback = useFeedback();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof ChangePasswordValues, string>>
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const score = passwordScore(password);
  const label = strengthLabel(score);

  const requirements: Requirement[] = useMemo(
    () => [
      { id: 'len', label: 'At least 8 characters', met: password.length >= 8 },
      {
        id: 'case',
        label: 'Upper and lower case letters',
        met: /[A-Z]/.test(password) && /[a-z]/.test(password),
      },
      { id: 'num', label: 'At least one number', met: /\d/.test(password) },
      {
        id: 'sym',
        label: 'At least one symbol',
        met: /[^A-Za-z0-9]/.test(password),
      },
      {
        id: 'diff',
        label: 'Different from current password',
        met: password.length > 0 && currentPassword.length > 0 && password !== currentPassword,
      },
      {
        id: 'match',
        label: 'Confirmation matches',
        met: confirm.length > 0 && password === confirm,
      },
    ],
    [password, confirm, currentPassword],
  );

  const metCount = requirements.filter((r) => r.met).length;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    const form = e.currentTarget;
    if (!validateFormFields(form)) return;

    const nextErrors: Partial<Record<keyof ChangePasswordValues, string>> = {};
    if (password.length < 8) {
      nextErrors.password = 'New password must be at least 8 characters.';
    }
    if (password !== confirm) {
      nextErrors.password_confirmation = 'Password confirmation does not match.';
    }
    if (currentPassword && password && currentPassword === password) {
      nextErrors.password = 'New password must be different from your current password.';
    }
    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      return;
    }

    setBusy(true);
    try {
      await onSubmit({
        current_password: currentPassword,
        password,
        password_confirmation: confirm,
      });
      setCurrentPassword('');
      setPassword('');
      setConfirm('');
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
      setBusy(false);
      await feedback.success({
        title: 'Password updated',
        message: 'Your password was changed successfully. Other sessions were signed out.',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not change password.';
      const lower = message.toLowerCase();
      if (lower.includes('current password')) {
        setFieldErrors({ current_password: message });
      } else if (lower.includes('confirmation') || lower.includes('confirm')) {
        setFieldErrors({ password_confirmation: message });
      } else if (lower.includes('password')) {
        setFieldErrors({ password: message });
      } else {
        setFormError(message);
      }
      setBusy(false);
    }
  }

  return (
    <div className="stem-cpw">
      <section className="stem-cpw-hero stem-animate-rise">
        <div>
          <p className="stem-cpw-eyebrow">Account · Security</p>
          <h2 className="stem-cpw-title">Change password</h2>
          <p className="stem-cpw-lead">
            Protect your account with a unique passphrase. Updating your password signs out other
            devices immediately while keeping this session active.
          </p>
          {email ? (
            <p className="stem-cpw-account">
              Signed in as <strong>{email}</strong>
            </p>
          ) : null}
        </div>
        <div className="stem-cpw-hero-aside" aria-hidden>
          <div className="stem-cpw-lock">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <rect
                x="5"
                y="10"
                width="14"
                height="11"
                rx="2.5"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <path
                d="M8 10V7.5a4 4 0 0 1 8 0V10"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <p className="stem-cpw-aside-title">Session-safe update</p>
          <p className="stem-cpw-aside-copy">
            This browser stays signed in. Other tokens are revoked after a successful change.
          </p>
        </div>
      </section>

      <div className="stem-cpw-layout">
        <Panel
          title="Update credentials"
          description="Enter your current password, then choose and confirm a new one."
        >
          <form className="stem-cpw-form" noValidate onSubmit={(e) => void handleSubmit(e)}>
            {formError ? (
              <div className="stem-cpw-alert" role="alert">
                {formError}
              </div>
            ) : null}

            <TextField
              label="Current password"
              name="current_password"
              type={showCurrent ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={currentPassword}
              error={fieldErrors.current_password}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                setFieldErrors((prev) => ({ ...prev, current_password: undefined }));
              }}
              trailing={
                <button
                  type="button"
                  className="stem-cpw-toggle"
                  onClick={() => setShowCurrent((v) => !v)}
                  aria-label={showCurrent ? 'Hide current password' : 'Show current password'}
                >
                  {showCurrent ? 'Hide' : 'Show'}
                </button>
              }
            />

            <TextField
              label="New password"
              name="password"
              type={showNew ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              error={fieldErrors.password}
              hint="Minimum 8 characters. Prefer a unique passphrase."
              onChange={(e) => {
                setPassword(e.target.value);
                setFieldErrors((prev) => ({ ...prev, password: undefined }));
              }}
              trailing={
                <button
                  type="button"
                  className="stem-cpw-toggle"
                  onClick={() => setShowNew((v) => !v)}
                  aria-label={showNew ? 'Hide new password' : 'Show new password'}
                >
                  {showNew ? 'Hide' : 'Show'}
                </button>
              }
            />

            {password ? (
              <div className="stem-cpw-strength" aria-live="polite">
                <div className="stem-cpw-strength-track">
                  <span
                    className={`stem-cpw-strength-bar is-${score}`}
                    style={{ width: `${(score / 5) * 100}%` }}
                  />
                </div>
                <span>
                  Strength: <strong>{label}</strong>
                </span>
              </div>
            ) : null}

            <TextField
              label="Confirm new password"
              name="password_confirmation"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              error={fieldErrors.password_confirmation}
              onChange={(e) => {
                setConfirm(e.target.value);
                setFieldErrors((prev) => ({ ...prev, password_confirmation: undefined }));
              }}
              trailing={
                <button
                  type="button"
                  className="stem-cpw-toggle"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? 'Hide confirmation' : 'Show confirmation'}
                >
                  {showConfirm ? 'Hide' : 'Show'}
                </button>
              }
            />

            <FormActions align="end">
              {onCancel ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={onCancel}
                  disabled={busy}
                >
                  Cancel
                </Button>
              ) : null}
              <Button type="submit" size="sm" variant="primary" disabled={busy}>
                {busy ? 'Updating…' : 'Save new password'}
              </Button>
            </FormActions>
          </form>
        </Panel>

        <aside className="stem-cpw-side" aria-live="polite">
          <div className="stem-cpw-checklist">
            <div className="stem-cpw-checklist-head">
              <h3>Password checklist</h3>
              <p>
                {password || confirm || currentPassword
                  ? `${metCount} of ${requirements.length} checks met`
                  : 'Requirements update as you type'}
              </p>
            </div>
            <ul className="stem-cpw-reqs">
              {requirements.map((req) => (
                <li key={req.id} className={req.met ? 'is-met' : undefined}>
                  <span className="stem-cpw-req-mark" aria-hidden>
                    {req.met ? '✓' : '○'}
                  </span>
                  <span>{req.label}</span>
                </li>
              ))}
            </ul>
            <div className="stem-cpw-tips-block">
              <p className="stem-cpw-tips-title">Tips</p>
              <ul>
                <li>Do not reuse passwords from other sites</li>
                <li>A short phrase with a symbol is easier to remember</li>
                <li>Never share your Control credentials</li>
              </ul>
            </div>
          </div>
        </aside>
      </div>

      <style>{styles}</style>
    </div>
  );
}

const styles = `
.stem-cpw { display: grid; gap: 1rem; }
.stem-cpw-hero {
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
.stem-cpw-eyebrow {
  margin: 0 0 0.3rem;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--stem-teal-deep);
}
.stem-cpw-title {
  margin: 0 0 0.35rem;
  font-family: var(--stem-font-display);
  font-size: clamp(1.35rem, 1.8vw, 1.55rem);
  letter-spacing: -0.03em;
  color: var(--stem-ink);
}
.stem-cpw-lead {
  margin: 0;
  color: var(--stem-ink-soft);
  line-height: 1.5;
  max-width: 40rem;
  font-size: var(--stem-text-base);
}
.stem-cpw-account {
  margin: 0.75rem 0 0;
  font-size: var(--stem-text-md);
  color: var(--stem-ink-soft);
}
.stem-cpw-hero-aside {
  display: grid;
  gap: 0.45rem;
  justify-items: start;
  padding: 1rem 1.1rem;
  border-radius: 14px;
  background: rgba(255,255,255,0.72);
  border: 1px solid rgba(12, 124, 128, 0.16);
}
.stem-cpw-lock {
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 12px;
  display: grid;
  place-items: center;
  color: #055456;
  background: #eef8f6;
  border: 1px solid rgba(12, 124, 128, 0.22);
}
.stem-cpw-aside-title {
  margin: 0.15rem 0 0;
  font-size: var(--stem-text-base);
  font-weight: 700;
  color: var(--stem-ink);
}
.stem-cpw-aside-copy {
  margin: 0;
  font-size: var(--stem-text-md);
  line-height: 1.45;
  color: var(--stem-ink-soft);
}
.stem-cpw-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(260px, 0.75fr);
  gap: 1rem;
  align-items: start;
}
.stem-cpw-form { display: grid; gap: 0.95rem; }
.stem-cpw-alert {
  padding: 0.8rem 0.95rem;
  border-radius: 12px;
  background: #fef3f2;
  border: 1px solid #fecdca;
  color: var(--stem-danger);
  font-size: var(--stem-text-base);
}
.stem-cpw-toggle {
  border: none;
  background: transparent;
  color: var(--stem-teal-deep);
  font-size: var(--stem-text-sm);
  font-weight: 650;
  cursor: pointer;
  padding: 0;
}
.stem-cpw-toggle:hover { text-decoration: underline; }
.stem-cpw-strength {
  display: grid;
  gap: 0.35rem;
  margin-top: -0.25rem;
  font-size: var(--stem-text-sm);
  color: var(--stem-ink-soft);
}
.stem-cpw-strength strong { color: var(--stem-ink); font-weight: 700; }
.stem-cpw-strength-track {
  height: 6px;
  border-radius: 999px;
  background: #e4ece8;
  overflow: hidden;
}
.stem-cpw-strength-bar {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #c07a3a;
  transition: width 0.2s ease, background 0.2s ease;
}
.stem-cpw-strength-bar.is-2,
.stem-cpw-strength-bar.is-3 { background: #c4a035; }
.stem-cpw-strength-bar.is-4,
.stem-cpw-strength-bar.is-5 { background: var(--stem-teal); }
.stem-cpw-side { position: sticky; top: 0.75rem; }
.stem-cpw-checklist {
  display: grid;
  gap: 1rem;
  padding: 1.1rem 1.15rem;
  border-radius: 16px;
  border: 1px solid var(--stem-line);
  background: #fff;
}
.stem-cpw-checklist-head h3 {
  margin: 0;
  font-size: var(--stem-text-xl);
  letter-spacing: -0.02em;
}
.stem-cpw-checklist-head p {
  margin: 0.25rem 0 0;
  font-size: var(--stem-text-md);
  color: var(--stem-ink-soft);
}
.stem-cpw-reqs {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.55rem;
}
.stem-cpw-reqs li {
  display: flex;
  gap: 0.55rem;
  align-items: flex-start;
  font-size: var(--stem-text-md);
  color: var(--stem-ink-soft);
}
.stem-cpw-reqs li.is-met { color: #047857; font-weight: 600; }
.stem-cpw-req-mark {
  flex: 0 0 auto;
  width: 1.15rem;
  text-align: center;
  font-size: var(--stem-text-md);
  line-height: 1.35;
}
.stem-cpw-tips-block {
  padding-top: 0.85rem;
  border-top: 1px solid var(--stem-line);
}
.stem-cpw-tips-title {
  margin: 0 0 0.45rem;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--stem-ink-soft);
}
.stem-cpw-tips-block ul {
  margin: 0;
  padding-left: 1.1rem;
  display: grid;
  gap: 0.35rem;
  font-size: var(--stem-text-md);
  color: var(--stem-ink-soft);
  line-height: 1.45;
}
@media (max-width: 960px) {
  .stem-cpw-hero,
  .stem-cpw-layout { grid-template-columns: 1fr; }
  .stem-cpw-side { position: static; }
}
`;
