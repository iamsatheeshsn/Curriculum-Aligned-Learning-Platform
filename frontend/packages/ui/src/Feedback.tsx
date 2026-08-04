import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { buttonSizeStyles, type ButtonSize } from './Brand';

/* -------------------------------------------------------------------------- */
/* Form field with required * and inline error                                */
/* -------------------------------------------------------------------------- */

export function FieldLabel({
  htmlFor,
  children,
  required,
  trailing,
}: {
  htmlFor?: string;
  children: ReactNode;
  required?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <div className="stem-field-label-row">
      <label htmlFor={htmlFor} className="stem-field-label">
        {children}
        {required ? (
          <span className="stem-req" aria-hidden>
            {' '}
            *
          </span>
        ) : null}
        {required ? <span className="stem-sr-only"> (required)</span> : null}
      </label>
      {trailing}
    </div>
  );
}

export function FieldError({ id, message }: { id?: string; message?: string | null }) {
  if (!message) return null;
  return (
    <p id={id} className="stem-field-error" role="alert">
      {message}
    </p>
  );
}

type ValidityTarget = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function messageFromValidity(label: string, el: ValidityTarget): string | null {
  if (el.validity.valueMissing) return `${label} is required.`;
  if (el.validity.typeMismatch) {
    return el instanceof HTMLInputElement && el.type === 'email'
      ? 'Enter a valid email address.'
      : 'Enter a valid value.';
  }
  if (el.validity.tooShort) {
    // minLength only exists on input and textarea, not select.
    const minLength = el instanceof HTMLSelectElement ? null : el.minLength;
    return minLength ? `Must be at least ${minLength} characters.` : 'Value is too short.';
  }
  if (el.validity.patternMismatch) return `Enter a valid ${label.toLowerCase()}.`;
  if (!el.validity.valid && el.validationMessage) return el.validationMessage;
  return null;
}

/** Built-in required / format errors that show under the field (not browser tooltips). */
function useFieldConstraint(label: string, externalError?: string | null) {
  const [localError, setLocalError] = useState<string | null>(null);
  const message = externalError ?? localError;
  const invalid = Boolean(message);

  const showConstraint = useCallback(
    (el: ValidityTarget) => {
      setLocalError(messageFromValidity(label, el));
    },
    [label],
  );

  const clearLocal = useCallback(() => setLocalError(null), []);

  return { message, invalid, showConstraint, clearLocal };
}

export function TextField({
  label,
  required,
  error,
  hint,
  trailing,
  onBlur,
  onChange,
  onInvalid,
  ...input
}: {
  label: string;
  required?: boolean;
  error?: string | null;
  hint?: string;
  trailing?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>) {
  const autoId = useId();
  const id = input.id ?? autoId;
  const errorId = `${id}-error`;
  const { message, invalid, showConstraint, clearLocal } = useFieldConstraint(label, error);

  return (
    <div className={`stem-ff ${invalid ? 'is-invalid' : ''}`}>
      <FieldLabel htmlFor={id} required={required} trailing={trailing}>
        {label}
      </FieldLabel>
      <input
        {...input}
        id={id}
        required={required}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        className={`stem-ff-input ${input.className ?? ''}`}
        onChange={(e) => {
          clearLocal();
          onChange?.(e);
        }}
        onBlur={(e) => {
          if (required || e.currentTarget.value) showConstraint(e.currentTarget);
          onBlur?.(e);
        }}
        onInvalid={(e) => {
          e.preventDefault();
          showConstraint(e.currentTarget);
          onInvalid?.(e);
        }}
      />
      {hint && !message ? <span className="stem-ff-hint">{hint}</span> : null}
      <FieldError id={errorId} message={message} />
      <style>{fieldStyles}</style>
    </div>
  );
}

export function TextAreaField({
  label,
  required,
  error,
  hint,
  onBlur,
  onChange,
  onInvalid,
  ...textarea
}: {
  label: string;
  required?: boolean;
  error?: string | null;
  hint?: string;
} & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const autoId = useId();
  const id = textarea.id ?? autoId;
  const errorId = `${id}-error`;
  const { message, invalid, showConstraint, clearLocal } = useFieldConstraint(label, error);

  return (
    <div className={`stem-ff ${invalid ? 'is-invalid' : ''}`}>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <textarea
        {...textarea}
        id={id}
        required={required}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        className={`stem-ff-input stem-ff-textarea ${textarea.className ?? ''}`}
        onChange={(e) => {
          clearLocal();
          onChange?.(e);
        }}
        onBlur={(e) => {
          if (required || e.currentTarget.value) showConstraint(e.currentTarget);
          onBlur?.(e);
        }}
        onInvalid={(e) => {
          e.preventDefault();
          showConstraint(e.currentTarget);
          onInvalid?.(e);
        }}
      />
      {hint && !message ? <span className="stem-ff-hint">{hint}</span> : null}
      <FieldError id={errorId} message={message} />
      <style>{fieldStyles}</style>
    </div>
  );
}

export function SelectField({
  label,
  required,
  error,
  hint,
  children,
  className,
  onBlur,
  onChange,
  onInvalid,
  ...select
}: {
  label: string;
  required?: boolean;
  error?: string | null;
  hint?: string;
  children: ReactNode;
} & SelectHTMLAttributes<HTMLSelectElement>) {
  const autoId = useId();
  const id = select.id ?? autoId;
  const errorId = `${id}-error`;
  const { message, invalid, showConstraint, clearLocal } = useFieldConstraint(label, error);

  return (
    <div className={`stem-ff ${invalid ? 'is-invalid' : ''}`}>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <select
        {...select}
        id={id}
        required={required}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        className={`stem-ff-input stem-ff-select ${className ?? ''}`}
        onChange={(e) => {
          clearLocal();
          onChange?.(e);
        }}
        onBlur={(e) => {
          if (required) showConstraint(e.currentTarget);
          onBlur?.(e);
        }}
        onInvalid={(e) => {
          e.preventDefault();
          showConstraint(e.currentTarget);
          onInvalid?.(e);
        }}
      >
        {children}
      </select>
      {hint && !message ? <span className="stem-ff-hint">{hint}</span> : null}
      <FieldError id={errorId} message={message} />
      <style>{fieldStyles}</style>
    </div>
  );
}

/** Consistent action row under forms / filter bars */
export function FormActions({
  children,
  align = 'start',
  fieldRow = false,
}: {
  children: ReactNode;
  align?: 'start' | 'end' | 'stretch';
  /** Set when the actions sit in a grid row beside labelled fields, so the
   *  buttons line up with the inputs instead of floating up to the labels. */
  fieldRow?: boolean;
}) {
  return (
    <div className={`stem-form-actions is-${align}${fieldRow ? ' is-field-row' : ''}`}>
      {children}
      <style>{fieldStyles}</style>
    </div>
  );
}

/** Compact filter / search row with matched control heights */
export function Toolbar({
  children,
  align = 'end',
  as: Tag = 'div',
  onSubmit,
}: {
  children: ReactNode;
  align?: 'start' | 'end';
  as?: 'div' | 'form';
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
}) {
  const props: { className: string; onSubmit?: (e: FormEvent<HTMLFormElement>) => void } = {
    className: `stem-toolbar is-${align}`,
  };
  if (Tag === 'form') {
    props.onSubmit = onSubmit;
  }
  return createElement(Tag, props, children, createElement('style', null, fieldStyles));
}

/**
 * Run constraint checks on every field so each required/invalid control
 * can show its inline FieldError (call from submit with form noValidate).
 */
export function validateFormFields(form: HTMLFormElement): boolean {
  let valid = true;
  for (const el of Array.from(form.elements)) {
    if (
      !(
        el instanceof HTMLInputElement ||
        el instanceof HTMLSelectElement ||
        el instanceof HTMLTextAreaElement
      )
    ) {
      continue;
    }
    if (!el.willValidate) continue;
    if (!el.checkValidity()) valid = false;
  }
  if (!valid) {
    const first = form.querySelector(':invalid');
    if (first instanceof HTMLElement) first.focus();
  }
  return valid;
}

const fieldStyles = `
.stem-field-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  min-height: 1.25rem;
}
.stem-field-label {
  font-size: var(--stem-text-md);
  font-weight: 600;
  line-height: 1.3;
  color: var(--stem-ink);
}
.stem-req { color: #d92d20; font-weight: 700; }
.stem-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0,0,0,0);
  border: 0;
}
.stem-ff { display: grid; gap: 0.4rem; width: 100%; min-width: 0; }
/* Shared so buttons sitting in a field row can match the input height exactly. */
.stem-ff, .stem-form-actions { --stem-field-h: 45px; }
.stem-ff-input {
  width: 100%;
  min-height: var(--stem-field-h);
  padding: 0.7rem 0.9rem;
  border-radius: 12px;
  border: 1px solid var(--stem-line);
  background: #fff;
  color: var(--stem-ink);
  font: inherit;
  font-size: var(--stem-text-base);
  line-height: 1.35;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.stem-ff-input::placeholder { color: #98a2b3; }
.stem-ff-input:focus {
  border-color: var(--stem-teal);
  box-shadow: var(--stem-focus);
}
.stem-ff.is-invalid .stem-ff-input {
  border-color: #f04438;
  box-shadow: 0 0 0 3px rgba(240,68,56,0.12);
  background: #fffbfa;
}
.stem-ff-textarea {
  resize: vertical;
  min-height: 110px;
  line-height: 1.5;
}
.stem-ff-select {
  appearance: none;
  background-image:
    linear-gradient(45deg, transparent 50%, var(--stem-ink-soft) 50%),
    linear-gradient(135deg, var(--stem-ink-soft) 50%, transparent 50%);
  background-position:
    calc(100% - 16px) calc(50% - 3px),
    calc(100% - 11px) calc(50% - 3px);
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
  padding-right: 2.25rem;
  cursor: pointer;
}
.stem-ff-hint { font-size: var(--stem-text-sm); line-height: 1.35; color: var(--stem-ink-soft); }
.stem-field-error { margin: 0; font-size: var(--stem-text-md); line-height: 1.35; color: #d92d20; font-weight: 500; }
.stem-form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  margin-top: 0.15rem;
}
.stem-form-actions.is-end { justify-content: flex-end; }
.stem-form-actions.is-stretch > * { flex: 1 1 auto; }
/* Bottom-align with the sibling inputs and match their height. Button sets its
   own min-height inline, so this override has to win against that. */
.stem-form-actions.is-field-row {
  align-self: end;
  margin-top: 0;
  min-height: var(--stem-field-h);
}
.stem-form-actions.is-field-row > *,
.stem-form-actions.is-field-row .stem-btn,
.stem-form-actions.is-field-row button:not(.stem-btn) {
  min-height: var(--stem-field-h) !important;
}
.stem-form-actions .stem-btn--md {
  min-height: 44px;
  box-sizing: border-box;
}
.stem-form-actions .stem-btn--sm,
.stem-form-actions .stem-btn,
.stem-form-actions button:not(.stem-btn) {
  min-height: 40px;
  box-sizing: border-box;
}
.stem-form-actions .stem-btn--xs {
  min-height: 34px;
  box-sizing: border-box;
}
.stem-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}
.stem-toolbar.is-end { justify-content: flex-end; }
.stem-toolbar.is-start { justify-content: flex-start; }
.stem-toolbar .stem-ff { width: auto; flex: 1 1 160px; max-width: 240px; }
/* Match on "not a control-shaped input" rather than listing text types: most
   call sites render a bare <input> with no type attribute, which an
   input[type="text"] selector never matches, leaving the field unstyled. */
.stem-toolbar .stem-ff-input,
.stem-toolbar input:not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="range"]):not([type="color"]):not([type="file"]),
.stem-toolbar select {
  min-height: 40px;
  padding: 0.55rem 0.9rem;
  border-radius: 10px;
  border: 1px solid var(--stem-line);
  background: #fff;
  color: var(--stem-ink);
  font: inherit;
  font-size: var(--stem-text-md);
  line-height: 1.25;
  box-sizing: border-box;
  outline: none;
  min-width: 140px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.stem-toolbar input:focus,
.stem-toolbar select:focus {
  border-color: var(--stem-teal);
  box-shadow: var(--stem-focus);
}
.stem-toolbar select {
  appearance: none;
  background-image:
    linear-gradient(45deg, transparent 50%, var(--stem-ink-soft) 50%),
    linear-gradient(135deg, var(--stem-ink-soft) 50%, transparent 50%);
  background-position:
    calc(100% - 16px) calc(50% - 3px),
    calc(100% - 11px) calc(50% - 3px);
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
  padding-right: 2.25rem;
  cursor: pointer;
}
.stem-toolbar .stem-btn--md {
  min-height: 44px;
  box-sizing: border-box;
}
.stem-toolbar .stem-btn--sm,
.stem-toolbar .stem-btn,
.stem-toolbar button:not(.stem-btn) {
  min-height: 40px;
  box-sizing: border-box;
}
.stem-toolbar .stem-btn--xs {
  min-height: 34px;
  box-sizing: border-box;
}
`;

/* -------------------------------------------------------------------------- */
/* Overlay primitives                                                         */
/* -------------------------------------------------------------------------- */

function Overlay({
  open,
  onClose,
  children,
  labelledBy,
}: {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  labelledBy?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="stem-overlay" role="presentation" onClick={onClose}>
      <div
        ref={panelRef}
        className="stem-overlay-panel stem-animate-rise"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
      <style>{overlayStyles}</style>
    </div>
  );
}

const overlayStyles = `
.stem-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 1.25rem;
  background: rgba(11, 36, 49, 0.45);
  backdrop-filter: blur(6px);
}
.stem-overlay-panel {
  width: min(420px, 100%);
  background: #fff;
  border-radius: 20px;
  border: 1px solid var(--stem-line);
  box-shadow: 0 28px 64px rgba(6, 90, 94, 0.22);
  padding: 1.6rem 1.45rem 1.35rem;
  outline: none;
}
.stem-modal-icon {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  margin: 0 auto 1rem;
  font-size: var(--stem-text-2xl);
  font-weight: 700;
}
.stem-modal-icon.success {
  background: linear-gradient(145deg, #dcfae6, #abefc6);
  color: #067647;
}
.stem-modal-icon.danger {
  background: linear-gradient(145deg, #fee4e2, #fecdca);
  color: #b42318;
}
.stem-modal-icon.warn {
  background: linear-gradient(145deg, #fef0c7, #fedf89);
  color: #b54708;
}
.stem-modal-icon.info {
  background: linear-gradient(145deg, #e0f2fe, #b9e6fe);
  color: #026aa2;
}
.stem-modal-title {
  margin: 0 0 0.45rem;
  text-align: center;
  font-family: var(--stem-font-display);
  font-size: var(--stem-text-2xl);
}
.stem-modal-body {
  margin: 0 0 1.25rem;
  text-align: center;
  color: var(--stem-ink-soft);
  font-size: var(--stem-text-base);
  line-height: 1.5;
}
.stem-modal-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.65rem;
}
.stem-modal-actions.single { grid-template-columns: 1fr; }
.stem-modal-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  padding: 0.55rem 0.9rem;
  min-height: 40px;
  box-sizing: border-box;
  font-weight: 600;
  font-size: var(--stem-text-md);
  line-height: 1.25;
  cursor: pointer;
  border: 1px solid transparent;
  font-family: inherit;
  white-space: nowrap;
}
.stem-modal-btn:disabled { opacity: 0.65; cursor: not-allowed; }
.stem-modal-btn.ghost {
  background: #fff;
  border-color: var(--stem-line);
  color: var(--stem-ink);
}
.stem-modal-btn.primary {
  background: linear-gradient(135deg, var(--stem-teal-bright), var(--stem-teal-deep));
  color: #fff;
}
.stem-modal-btn.danger {
  background: linear-gradient(135deg, #f04438, #b42318);
  color: #fff;
}
.stem-modal-btn.warn {
  background: linear-gradient(135deg, #f79009, #dc6803);
  color: #fff;
}
`;

export function SuccessModal({
  open,
  title = 'Success',
  message,
  confirmLabel = 'Continue',
  onClose,
}: {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  onClose: () => void;
}) {
  const titleId = useId();
  return (
    <Overlay open={open} onClose={onClose} labelledBy={titleId}>
      <div className="stem-modal-icon success" aria-hidden>
        ✓
      </div>
      <h2 id={titleId} className="stem-modal-title">
        {title}
      </h2>
      <p className="stem-modal-body">{message}</p>
      <div className="stem-modal-actions single">
        <button type="button" className="stem-modal-btn primary" onClick={onClose}>
          {confirmLabel}
        </button>
      </div>
    </Overlay>
  );
}

export function ErrorModal({
  open,
  title = 'Something went wrong',
  message,
  confirmLabel = 'Close',
  onClose,
}: {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  onClose: () => void;
}) {
  const titleId = useId();
  return (
    <Overlay open={open} onClose={onClose} labelledBy={titleId}>
      <div className="stem-modal-icon danger" aria-hidden>
        !
      </div>
      <h2 id={titleId} className="stem-modal-title">
        {title}
      </h2>
      <p className="stem-modal-body">{message}</p>
      <div className="stem-modal-actions single">
        <button type="button" className="stem-modal-btn danger" onClick={onClose}>
          {confirmLabel}
        </button>
      </div>
    </Overlay>
  );
}

export type ConfirmTone = 'danger' | 'warn' | 'info' | 'primary';

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'warn',
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const iconClass = tone === 'danger' ? 'danger' : tone === 'info' ? 'info' : tone === 'primary' ? 'info' : 'warn';
  const btnClass = tone === 'danger' ? 'danger' : tone === 'warn' ? 'warn' : 'primary';
  const icon = tone === 'danger' ? '!' : tone === 'info' ? 'i' : '?';

  return (
    <Overlay open={open} onClose={busy ? undefined : onCancel} labelledBy={titleId}>
      <div className={`stem-modal-icon ${iconClass}`} aria-hidden>
        {icon}
      </div>
      <h2 id={titleId} className="stem-modal-title">
        {title}
      </h2>
      <p className="stem-modal-body">{message}</p>
      <div className="stem-modal-actions">
        <button type="button" className="stem-modal-btn ghost" disabled={busy} onClick={onCancel}>
          {cancelLabel}
        </button>
        <button type="button" className={`stem-modal-btn ${btnClass}`} disabled={busy} onClick={onConfirm}>
          {busy ? 'Please wait…' : confirmLabel}
        </button>
      </div>
    </Overlay>
  );
}

/* -------------------------------------------------------------------------- */
/* Feedback provider — success popup + confirm API                            */
/* -------------------------------------------------------------------------- */

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
};

type SuccessOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
};

type FeedbackApi = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  success: (options: SuccessOptions) => Promise<void>;
  error: (options: SuccessOptions) => Promise<void>;
};

const FeedbackContext = createContext<FeedbackApi | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { open: boolean }) | null>(null);
  const [successState, setSuccessState] = useState<(SuccessOptions & { open: boolean }) | null>(null);
  const [errorState, setErrorState] = useState<(SuccessOptions & { open: boolean }) | null>(null);
  const confirmResolver = useRef<((value: boolean) => void) | null>(null);
  const successResolver = useRef<(() => void) | null>(null);
  const errorResolver = useRef<(() => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      confirmResolver.current = resolve;
      setConfirmState({ ...options, open: true });
    });
  }, []);

  const success = useCallback((options: SuccessOptions) => {
    return new Promise<void>((resolve) => {
      successResolver.current = resolve;
      setSuccessState({ ...options, open: true });
    });
  }, []);

  const error = useCallback((options: SuccessOptions) => {
    return new Promise<void>((resolve) => {
      errorResolver.current = resolve;
      setErrorState({ ...options, open: true });
    });
  }, []);

  const api = useMemo(() => ({ confirm, success, error }), [confirm, success, error]);

  return createElement(
    FeedbackContext.Provider,
    { value: api },
    children,
    createElement(ConfirmDialog, {
      open: Boolean(confirmState?.open),
      title: confirmState?.title ?? '',
      message: confirmState?.message ?? '',
      confirmLabel: confirmState?.confirmLabel,
      cancelLabel: confirmState?.cancelLabel,
      tone: confirmState?.tone,
      onCancel: () => {
        setConfirmState(null);
        confirmResolver.current?.(false);
        confirmResolver.current = null;
      },
      onConfirm: () => {
        setConfirmState(null);
        confirmResolver.current?.(true);
        confirmResolver.current = null;
      },
    }),
    createElement(SuccessModal, {
      open: Boolean(successState?.open),
      title: successState?.title,
      message: successState?.message ?? '',
      confirmLabel: successState?.confirmLabel,
      onClose: () => {
        setSuccessState(null);
        successResolver.current?.();
        successResolver.current = null;
      },
    }),
    createElement(ErrorModal, {
      open: Boolean(errorState?.open),
      title: errorState?.title,
      message: errorState?.message ?? '',
      confirmLabel: errorState?.confirmLabel,
      onClose: () => {
        setErrorState(null);
        errorResolver.current?.();
        errorResolver.current = null;
      },
    }),
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    throw new Error('useFeedback must be used within FeedbackProvider');
  }
  return ctx;
}

/** Optional hook when provider may be absent (falls back to window.confirm / alert). */
export function useFeedbackOptional(): FeedbackApi {
  const ctx = useContext(FeedbackContext);
  return (
    ctx ?? {
      confirm: async (options) => window.confirm(`${options.title}\n\n${options.message}`),
      success: async (options) => {
        window.alert(options.message);
      },
      error: async (options) => {
        window.alert(`${options.title ?? 'Something went wrong'}\n\n${options.message}`);
      },
    }
  );
}

export function ConfirmButton({
  children,
  title,
  message,
  confirmLabel,
  tone = 'warn',
  onConfirm,
  style,
  className,
  variant = 'secondary',
  size = 'sm',
}: {
  children: ReactNode;
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: ConfirmTone;
  onConfirm: () => void | Promise<void>;
  style?: CSSProperties;
  className?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'apricot';
  size?: ButtonSize;
}) {
  const feedback = useFeedbackOptional();
  const [busy, setBusy] = useState(false);

  const palette: Record<string, CSSProperties> = {
    primary: {
      background: 'linear-gradient(135deg, var(--stem-teal-bright), var(--stem-teal-deep))',
      color: '#fff',
      border: '1px solid transparent',
      boxShadow: '0 10px 22px rgba(5, 84, 86, 0.18)',
    },
    secondary: {
      background: 'rgba(255,255,255,0.72)',
      color: 'var(--stem-teal-deep)',
      border: '1px solid rgba(12, 124, 128, 0.35)',
    },
    danger: {
      background: '#b42318',
      color: '#fff',
      border: '1px solid transparent',
    },
    apricot: {
      background: 'linear-gradient(135deg, #f0a05c, var(--stem-apricot-deep))',
      color: '#fff',
      border: '1px solid transparent',
      boxShadow: '0 10px 22px rgba(201, 106, 46, 0.22)',
    },
  };

  return (
    <button
      type="button"
      className={['stem-btn', `stem-btn--${size}`, className].filter(Boolean).join(' ')}
      disabled={busy}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        verticalAlign: 'middle',
        fontWeight: 600,
        boxSizing: 'border-box',
        cursor: busy ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        textAlign: 'center',
        whiteSpace: 'nowrap',
        opacity: busy ? 0.65 : 1,
        ...buttonSizeStyles[size],
        ...palette[variant],
        ...style,
      }}
      onClick={async () => {
        const ok = await feedback.confirm({ title, message, confirmLabel, tone });
        if (!ok) return;
        setBusy(true);
        try {
          await onConfirm();
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? 'Working…' : children}
    </button>
  );
}
