import { useParams } from 'react-router-dom';
import { Button, useResolvedTenant } from '@stemora/ui';
import { PageShell } from '../components/PageShell';

const tutors = [
  {
    name: 'Sara Al-Harbi',
    focus: 'Physics · Grades 9–12',
    languages: 'Arabic · English',
  },
  {
    name: 'James Okonkwo',
    focus: 'Mathematics · Middle school',
    languages: 'English',
  },
  {
    name: 'Noura Al Suwaidi',
    focus: 'Biology · Lab simulations',
    languages: 'Arabic · English',
  },
];

export function TutorsPage() {
  const { tenantSlug = 'al-noor' } = useParams();
  const tenant = useResolvedTenant();
  const brand = tenant?.name || tenantSlug;

  return (
    <PageShell
      title="Tutors"
      lead={`Match ${brand} students with bilingual STEM tutors—availability, booking, classroom links, and ratings included.`}
    >
      <div className="sw-tutor-grid">
        {tutors.map((tutor) => {
          const initials = tutor.name
            .split(/\s+/)
            .map((p) => p[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();
          return (
            <article key={tutor.name} className="sw-tutor stem-animate-rise">
              <div className="sw-tutor-mark" aria-hidden>
                {initials}
              </div>
              <h3>{tutor.name}</h3>
              <p className="focus">{tutor.focus}</p>
              <p className="langs">{tutor.languages}</p>
            </article>
          );
        })}
      </div>
      <section className="sw-section">
        <h2>How tutoring works</h2>
        <p className="sw-section-lead">
          Schools manage tutor profiles, slots, and payouts in the Institution portal. Students book from the Learner
          portal with live classroom links.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', alignItems: 'center' }}>
          <Button to={`/${tenantSlug}/contact`} variant="apricot" size="sm">
            Talk to us about tutoring
          </Button>
          <a
            href={`http://localhost:5178/${tenantSlug}/login`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              minHeight: 40,
              padding: '0.55rem 0.9rem',
              borderRadius: 10,
              border: '1px solid rgba(12,124,128,0.35)',
              background: 'rgba(255,255,255,0.72)',
              color: 'var(--stem-teal-deep)',
              fontWeight: 600,
              fontSize: '0.95rem',
              textDecoration: 'none',
            }}
          >
            Open learner portal
          </a>
        </div>
      </section>
    </PageShell>
  );
}
