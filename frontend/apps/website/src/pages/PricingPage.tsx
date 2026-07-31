import { useParams } from 'react-router-dom';
import { Button, useResolvedTenant } from '@stemora/ui';
import { PageShell } from '../components/PageShell';

const plans = [
  {
    code: 'Starter',
    price: 'Trial / custom',
    detail: 'Up to 200 students · 1 school · tutoring module',
    highlight: false,
  },
  {
    code: 'Growth',
    price: 'Custom quote',
    detail: 'Multi-school · virtual labs · advanced reports',
    highlight: true,
  },
  {
    code: 'Enterprise',
    price: 'Talk to us',
    detail: 'Dedicated onboarding · SLA · custom integrations',
    highlight: false,
  },
];

export function PricingPage() {
  const { tenantSlug = 'al-noor' } = useParams();
  const tenant = useResolvedTenant();
  const brand = tenant?.name || tenantSlug;
  const contact = `/${tenantSlug}/contact`;

  return (
    <PageShell
      title="Pricing"
      lead={`Transparent plans for ${brand}—private schools, international schools, and tutoring centres.`}
    >
      <div className="sw-plan-grid">
        {plans.map((plan) => (
          <article key={plan.code} className={`sw-plan ${plan.highlight ? 'is-featured' : ''} stem-animate-rise`}>
            <h3>{plan.code}</h3>
            <p className="sw-plan-price">{plan.price}</p>
            <p>{plan.detail}</p>
            <div style={{ marginTop: '0.5rem' }}>
              <Button to={contact} variant={plan.highlight ? 'apricot' : 'secondary'} size="sm">
                Request quote
              </Button>
            </div>
          </article>
        ))}
      </div>
      <p className="sw-section-lead" style={{ marginTop: '1.75rem' }}>
        Every quote includes onboarding for your curriculum tree and bilingual classroom setup.
      </p>
    </PageShell>
  );
}
