import { Link, useParams } from 'react-router-dom';
import { Button, useResolvedTenant } from '@stemora/ui';

export function HomePage() {
  const { tenantSlug = 'al-noor' } = useParams();
  const tenant = useResolvedTenant();
  const brandName = tenant?.name || tenantSlug;
  const base = `/${tenantSlug}`;

  return (
    <div className="sw-home">
      <section className="sw-home-hero" aria-label={`${brandName} home`}>
        <div className="sw-home-hero-media" aria-hidden />
        <div className="sw-home-hero-content stem-animate-rise">
          <p className="sw-home-brand">{brandName}</p>
          <h1>STEM pathways and live tutoring for every classroom.</h1>
          <p className="sw-home-lead">
            Curriculum-aligned lessons, bilingual sessions, and progress families can trust.
          </p>
          <div className="sw-home-cta">
            <Button to={`${base}/contact`} variant="apricot">
              Book a school demo
            </Button>
            <Button to={`${base}/features`} variant="secondary">
              Explore the platform
            </Button>
          </div>
        </div>
      </section>

      <section className="sw-wrap sw-home-paths">
        <div className="sw-section stem-animate-rise">
          <p className="sw-eyebrow">{brandName}</p>
          <h2>Built for how schools actually teach</h2>
          <p className="sw-section-lead">
            One place for curriculum, interactive STEM, assessments, and tutoring—scoped to your school.
          </p>
          <div className="sw-path-grid">
            <Link to={`${base}/curriculum`} className="sw-path">
              <strong>Curriculum</strong>
              <span>Subjects, chapters, and outcomes mapped to your framework.</span>
            </Link>
            <Link to={`${base}/tutors`} className="sw-path">
              <strong>Live tutoring</strong>
              <span>Bilingual tutors, booking, classrooms, and attendance.</span>
            </Link>
            <Link to={`${base}/pricing`} className="sw-path">
              <strong>Plans</strong>
              <span>Starter to enterprise options for schools and centres.</span>
            </Link>
          </div>
        </div>
      </section>

      <style>{homeStyles}</style>
    </div>
  );
}

const homeStyles = `
.sw-home { min-width: 0; }
.sw-home-hero {
  position: relative;
  min-height: min(92vh, 820px);
  display: grid;
  align-items: end;
  color: #f4fbf9;
  overflow: hidden;
}
.sw-home-hero-media {
  position: absolute; inset: 0;
  background:
    linear-gradient(105deg, rgba(5,60,64,0.88) 0%, rgba(5,84,86,0.55) 42%, rgba(10,54,68,0.35) 100%),
    radial-gradient(circle at 70% 40%, rgba(18,160,171,0.35), transparent 45%),
    linear-gradient(160deg, #055456 0%, #0c7c80 40%, #1a6a7a 70%, #e98945 140%);
  background-size: cover;
  transform: scale(1.02);
  animation: sw-hero-drift 18s ease-in-out infinite alternate;
}
.sw-home-hero-media::after {
  content: '';
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: linear-gradient(180deg, rgba(0,0,0,0.55), transparent 85%);
}
.sw-home-hero-content {
  position: relative; z-index: 1;
  max-width: 1120px; width: 100%;
  margin: 0 auto; padding: clamp(5.5rem, 14vh, 8rem) 1.25rem clamp(3rem, 8vh, 4.5rem);
}
.sw-home-brand {
  margin: 0 0 0.85rem;
  font-family: var(--stem-font-display);
  font-size: clamp(2.6rem, 7vw, 4.4rem);
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1.05;
  animation: sw-brand-in 0.9s ease both;
}
.sw-home-hero h1 {
  margin: 0;
  max-width: 18ch;
  font-family: var(--stem-font-body);
  font-size: clamp(1.25rem, 2.4vw, 1.7rem);
  font-weight: 600;
  line-height: 1.35;
  color: rgba(232,246,243,0.95);
}
.sw-home-lead {
  margin: 0.9rem 0 0;
  max-width: 34rem;
  font-size: 1.05rem;
  line-height: 1.55;
  color: rgba(232,246,243,0.82);
}
.sw-home-cta {
  display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center;
  margin-top: 1.6rem;
}
.sw-home-paths { padding-block: 3.25rem 5rem; }
.sw-path-grid {
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.25rem 1.75rem;
}
.sw-path {
  display: grid; gap: 0.4rem; min-width: 0;
  padding-top: 1rem; border-top: 2px solid rgba(12,124,128,0.28);
  text-decoration: none; color: inherit;
  transition: border-color 0.2s ease, transform 0.2s ease;
}
.sw-path:hover { border-color: var(--stem-teal-deep); transform: translateY(-2px); }
.sw-path strong { font-size: 1.12rem; }
.sw-path span { color: var(--stem-ink-soft); font-size: 0.95rem; line-height: 1.5; }
@keyframes sw-hero-drift {
  from { transform: scale(1.02) translate3d(0,0,0); }
  to { transform: scale(1.06) translate3d(-1.5%, -1%, 0); }
}
@keyframes sw-brand-in {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .sw-home-hero-media { animation: none; }
  .sw-home-brand { animation: none; }
}
@media (max-width: 800px) {
  .sw-home-hero { min-height: min(88vh, 720px); }
  .sw-path-grid { grid-template-columns: 1fr; }
}
`;
