import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { BrandMark, Button, useResolvedTenant } from '@stemora/ui';
import { useI18n } from '@stemora/i18n';
import { siteStyles } from './siteStyles';

export function SiteLayout() {
  const { t, locale, setLocale } = useI18n();
  const { tenantSlug = 'al-noor' } = useParams();
  const tenant = useResolvedTenant();
  const brandName = tenant?.name || tenantSlug;
  const base = `/${tenantSlug}`;

  const links = [
    { to: base, labelKey: 'nav.home', end: true },
    { to: `${base}/features`, labelKey: 'nav.features' },
    { to: `${base}/pricing`, labelKey: 'nav.pricing' },
    { to: `${base}/curriculum`, labelKey: 'nav.curriculum' },
    { to: `${base}/tutors`, labelKey: 'nav.tutors' },
    { to: `${base}/contact`, labelKey: 'nav.contact' },
  ] as const;

  return (
    <div className="sw-root min-h-screen flex flex-col">
      <header className="sw-header">
        <div className="sw-nav">
          <NavLink to={base} aria-label={`${brandName} home`} className="sw-brand">
            <BrandMark name={brandName} />
          </NavLink>
          <nav className="sw-nav-links" aria-label="Primary">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={'end' in link ? link.end : false}
                className={({ isActive }) => `sw-nav-link ${isActive ? 'is-active' : ''}`}
              >
                {t(link.labelKey)}
              </NavLink>
            ))}
          </nav>
          <div className="sw-nav-actions">
            <button
              type="button"
              className="sw-lang"
              onClick={() => setLocale(locale === 'en' ? 'ar' : 'en')}
              aria-label="Toggle language"
            >
              {locale === 'en' ? 'العربية' : 'EN'}
            </button>
            <Button to={`${base}/contact`} variant="primary" size="sm">
              {t('cta.demo')}
            </Button>
          </div>
        </div>
      </header>

      <main className="sw-main">
        <Outlet />
      </main>

      <footer className="sw-footer">
        <div className="sw-footer-inner">
          <div className="sw-footer-brand">
            <BrandMark inverted name={brandName} color="var(--sw-footer-ink)" />
            <p className="sw-footer-lead">
              Bilingual K–12 STEM learning and live tutoring for {brandName} families and classrooms.
            </p>
          </div>
          <div className="sw-footer-col">
            <h3>Explore</h3>
            <nav aria-label="Footer">
              {links.map((link) => (
                <NavLink key={link.to} to={link.to} end={'end' in link ? link.end : false}>
                  {t(link.labelKey)}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="sw-footer-col">
            <h3>Portals</h3>
            <a href={`http://localhost:5175/${tenantSlug}/login`}>Institution</a>
            <a href={`http://localhost:5178/${tenantSlug}/login`}>Learner</a>
            <a href="http://localhost:5174/login">Control</a>
          </div>
          <div className="sw-footer-col">
            <h3>Contact</h3>
            <Link to={`${base}/contact`}>Book a school demo</Link>
            <a href={`mailto:hello@${tenantSlug.replace(/[^a-z0-9-]/gi, '')}.school`}>
              hello@{tenantSlug}.school
            </a>
            <p className="sw-footer-meta">Riyadh · Dubai</p>
          </div>
        </div>
        <div className="sw-footer-bar">
          <p>© {new Date().getFullYear()} {brandName}</p>
          <p>School website · {tenantSlug}</p>
        </div>
      </footer>

      <style>{siteStyles}</style>
    </div>
  );
}
