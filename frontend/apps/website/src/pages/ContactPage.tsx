import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import {
  Button,
  FormActions,
  TextAreaField,
  TextField,
  useFeedback,
  useResolvedTenant,
  validateFormFields,
} from '@stemora/ui';
import { PageShell } from '../components/PageShell';

type Errors = {
  name?: string;
  email?: string;
  org?: string;
  message?: string;
};

export function ContactPage() {
  const { tenantSlug = 'al-noor' } = useParams();
  const tenant = useResolvedTenant();
  const brand = tenant?.name || tenantSlug;
  const feedback = useFeedback();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [org, setOrg] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  function validate(): Errors {
    const next: Errors = {};
    if (!name.trim()) next.name = 'Full name is required.';
    if (!email.trim()) next.email = 'Work email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Enter a valid email address.';
    if (!org.trim()) next.org = 'Organisation is required.';
    if (!message.trim()) next.message = 'Please tell us how we can help.';
    else if (message.trim().length < 10) next.message = 'Message should be at least 10 characters.';
    return next;
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const constraintsOk = validateFormFields(e.currentTarget);
    const next = validate();
    setErrors(next);
    if (!constraintsOk || Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 400));
      setName('');
      setEmail('');
      setOrg('');
      setMessage('');
      setErrors({});
      await feedback.success({
        title: 'Message sent',
        message: `Thanks—the ${brand} team will reply shortly with a bilingual product walkthrough.`,
        confirmLabel: 'Done',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell
      title="Contact"
      lead={`Tell us about your schools and tutoring model—${brand} will schedule a bilingual product walkthrough.`}
    >
      <div className="sw-contact-grid">
        <form onSubmit={onSubmit} noValidate className="sw-contact-form stem-animate-rise">
          <TextField
            label="Full name"
            name="name"
            required
            value={name}
            error={errors.name}
            onChange={(e) => {
              setName(e.target.value);
              setErrors((p) => ({ ...p, name: undefined }));
            }}
          />
          <TextField
            label="Work email"
            name="email"
            type="email"
            required
            value={email}
            error={errors.email}
            autoComplete="email"
            onChange={(e) => {
              setEmail(e.target.value);
              setErrors((p) => ({ ...p, email: undefined }));
            }}
          />
          <TextField
            label="Organisation"
            name="org"
            required
            value={org}
            error={errors.org}
            onChange={(e) => {
              setOrg(e.target.value);
              setErrors((p) => ({ ...p, org: undefined }));
            }}
          />
          <TextAreaField
            label="How can we help?"
            name="message"
            required
            rows={4}
            value={message}
            error={errors.message}
            placeholder="Number of schools, students, tutoring needs…"
            onChange={(e) => {
              setMessage(e.target.value);
              setErrors((p) => ({ ...p, message: undefined }));
            }}
          />
          <FormActions>
            <Button type="submit" variant="apricot" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send message'}
            </Button>
          </FormActions>
        </form>

        <aside className="sw-aside stem-animate-rise">
          <h2>Reach {brand}</h2>
          <p>hello@{tenantSlug}.school</p>
          <p>Riyadh · Dubai</p>
          <p style={{ marginTop: '1.25rem' }}>Already a customer? Open your portal:</p>
          <ul>
            <li>
              <a href="http://localhost:5174/login">Control — Super Admin / Owner</a>
            </li>
            <li>
              <a href={`http://localhost:5175/${tenantSlug}/login`}>Institution — School / Teacher</a>
            </li>
            <li>
              <a href={`http://localhost:5178/${tenantSlug}/login`}>Learner — Student / Parent</a>
            </li>
          </ul>
        </aside>
      </div>
    </PageShell>
  );
}
