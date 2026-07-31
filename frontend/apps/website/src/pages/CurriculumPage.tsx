import { useParams } from 'react-router-dom';
import { Button, useResolvedTenant } from '@stemora/ui';
import { PageShell } from '../components/PageShell';

const coverage = [
  { region: 'KSA', frameworks: 'National STEM pathways · private & international school adaptations' },
  { region: 'UAE', frameworks: 'Ministry-aligned STEM strands · bilingual delivery support' },
  { region: 'School-owned', frameworks: 'Import your tree: subjects → chapters → lessons → outcomes' },
];

export function CurriculumPage() {
  const { tenantSlug = 'al-noor' } = useParams();
  const tenant = useResolvedTenant();
  const brand = tenant?.name || tenantSlug;

  return (
    <PageShell
      title="Curriculum"
      lead={`${brand} puts curriculum first—so tutoring and assessments stay anchored to what your school teaches.`}
    >
      <div className="sw-row-list">
        {coverage.map((row) => (
          <div key={row.region} className="sw-row stem-animate-rise">
            <strong>{row.region}</strong>
            <span>{row.frameworks}</span>
          </div>
        ))}
      </div>
      <section className="sw-section">
        <h2>Coverage you can measure</h2>
        <p className="sw-section-lead">
          Versioned curricula, learning-outcome reports, and completion analytics help academic leads see gaps
          before exam season—not after.
        </p>
        <Button to={`/${tenantSlug}/contact`} variant="primary" size="sm">
          Discuss your framework
        </Button>
      </section>
    </PageShell>
  );
}
