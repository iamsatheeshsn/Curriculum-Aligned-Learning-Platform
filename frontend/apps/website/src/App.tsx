import { Navigate, Route, Routes } from 'react-router-dom';
import { TenantResolveGate } from '@stemora/ui';
import { SiteLayout } from './components/SiteLayout';
import { ContactPage } from './pages/ContactPage';
import { CurriculumPage } from './pages/CurriculumPage';
import { FeaturesPage } from './pages/FeaturesPage';
import { HomePage } from './pages/HomePage';
import { PricingPage } from './pages/PricingPage';
import { TutorsPage } from './pages/TutorsPage';

const DEFAULT_TENANT = 'al-noor';

/** Legacy unprefixed marketing paths → tenant-scoped URLs */
function LegacyRedirect({ page = '' }: { page?: string }) {
  const suffix = page ? `/${page}` : '';
  return <Navigate to={`/${DEFAULT_TENANT}${suffix}`} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={`/${DEFAULT_TENANT}`} replace />} />
      <Route path="/features" element={<LegacyRedirect page="features" />} />
      <Route path="/pricing" element={<LegacyRedirect page="pricing" />} />
      <Route path="/curriculum" element={<LegacyRedirect page="curriculum" />} />
      <Route path="/tutors" element={<LegacyRedirect page="tutors" />} />
      <Route path="/contact" element={<LegacyRedirect page="contact" />} />

      <Route path="/:tenantSlug" element={<TenantResolveGate portal="website" />}>
        <Route element={<SiteLayout />}>
          <Route index element={<HomePage />} />
          <Route path="features" element={<FeaturesPage />} />
          <Route path="pricing" element={<PricingPage />} />
          <Route path="curriculum" element={<CurriculumPage />} />
          <Route path="tutors" element={<TutorsPage />} />
          <Route path="contact" element={<ContactPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={`/${DEFAULT_TENANT}`} replace />} />
    </Routes>
  );
}
