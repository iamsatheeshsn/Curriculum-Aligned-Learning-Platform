import { useParams } from 'react-router-dom';
import { Button, useResolvedTenant } from '@stemora/ui';
import { PageShell } from '../components/PageShell';

const features = [
  {
    title: 'Curriculum-aligned STEM',
    body: 'Map subjects, chapters, lessons, and outcomes to your school framework—with clear versioning.',
  },
  {
    title: 'Interactive learning',
    body: 'Simulations, rich media, and homework that keep students practising between live sessions.',
  },
  {
    title: 'Assessment engine',
    body: 'Quizzes, exams, and auto-grading for objective items, plus teacher review for open responses.',
  },
  {
    title: 'Live bilingual tutoring',
    body: 'Book tutors, run classrooms, track attendance, and capture session feedback in one place.',
  },
  {
    title: 'Parent & student portals',
    body: 'Progress, schedules, and notifications that keep families informed without extra admin work.',
  },
  {
    title: 'School operations',
    body: 'Campuses, staff RBAC, billing, and reporting designed for KSA and UAE institutions.',
  },
];

export function FeaturesPage() {
  const { tenantSlug = 'al-noor' } = useParams();
  const tenant = useResolvedTenant();
  const brand = tenant?.name || tenantSlug;

  return (
    <PageShell
      title="Features"
      lead={`Everything ${brand} needs to run STEM learning and tutoring—without stitching five tools together.`}
    >
      <div className="sw-feature-grid">
        {features.map((feature, index) => (
          <article
            key={feature.title}
            className="sw-feature stem-animate-rise"
            style={{ animationDelay: `${index * 0.04}s` }}
          >
            <h3>{feature.title}</h3>
            <p>{feature.body}</p>
          </article>
        ))}
      </div>
      <div className="sw-section" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
        <Button to={`/${tenantSlug}/contact`} variant="apricot" size="sm">
          Book a school demo
        </Button>
        <Button to={`/${tenantSlug}/pricing`} variant="secondary" size="sm">
          View plans
        </Button>
      </div>
    </PageShell>
  );
}
