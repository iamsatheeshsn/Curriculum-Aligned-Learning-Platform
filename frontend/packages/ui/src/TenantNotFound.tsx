import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { BrandMark, Button } from './Brand';

const API_BASE = import.meta.env?.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1';
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type ResolveState =
  | { status: 'loading' }
  | { status: 'ok'; name: string }
  | { status: 'missing'; reason: 'not_found' | 'unavailable' | 'invalid' };

export type TenantPortalKind = 'institution' | 'learner' | 'website';

export type ResolvedTenant = {
  slug: string;
  name: string;
};

const ResolvedTenantContext = createContext<ResolvedTenant | null>(null);

/** Tenant resolved by `TenantResolveGate` (name + slug). */
export function useResolvedTenant(): ResolvedTenant | null {
  return useContext(ResolvedTenantContext);
}

/** Keep the browser tab title in sync with the active tenant brand. */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

function demoLoginPath(portal: TenantPortalKind, demoSlug = 'al-noor') {
  if (portal === 'website') return `/${demoSlug}`;
  return `/${demoSlug}/login`;
}

function demoHomePath(portal: TenantPortalKind, demoSlug = 'al-noor') {
  if (portal === 'website') return `/${demoSlug}`;
  return portal === 'institution' ? `/${demoSlug}` : `/${demoSlug}/student`;
}

/**
 * Validates `/:tenantSlug` against the API before rendering portal routes.
 * Invalid / unknown / suspended tenants get a branded 404.
 */
export function TenantResolveGate({
  portal,
  children,
  demoSlug = 'al-noor',
}: {
  portal: TenantPortalKind;
  /** Prefer nested routes + Outlet; optional explicit children */
  children?: ReactNode;
  demoSlug?: string;
}) {
  const { tenantSlug = '' } = useParams();
  const [state, setState] = useState<ResolveState>({ status: 'loading' });

  useEffect(() => {
    const slug = tenantSlug.trim().toLowerCase();
    if (!slug || !SLUG_PATTERN.test(slug)) {
      setState({ status: 'missing', reason: 'invalid' });
      return;
    }

    let cancelled = false;
    setState({ status: 'loading' });

    (async () => {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(`${API_BASE}/tenants/by-slug/${encodeURIComponent(slug)}`, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        if (cancelled) return;
        if (!res.ok) {
          setState({ status: 'missing', reason: 'not_found' });
          return;
        }
        const json = (await res.json()) as {
          data?: { name?: string; status?: string };
        };
        const status = json.data?.status;
        if (status === 'suspended' || status === 'closed') {
          setState({ status: 'missing', reason: 'unavailable' });
          return;
        }
        setState({ status: 'ok', name: json.data?.name ?? slug });
      } catch {
        if (!cancelled) setState({ status: 'missing', reason: 'not_found' });
      } finally {
        window.clearTimeout(timer);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  useEffect(() => {
    if (state.status !== 'ok') return;
    const previous = document.title;
    document.title = state.name;
    return () => {
      document.title = previous;
    };
  }, [state]);

  const resolved =
    state.status === 'ok'
      ? { slug: tenantSlug.trim().toLowerCase(), name: state.name }
      : null;

  if (state.status === 'loading') {
    return <TenantLoadingScreen portal={portal} slug={tenantSlug} />;
  }

  if (state.status === 'missing' || !resolved) {
    return (
      <TenantNotFoundPage
        portal={portal}
        slug={tenantSlug}
        reason={state.status === 'missing' ? state.reason : 'not_found'}
        demoSlug={demoSlug}
      />
    );
  }

  return (
    <ResolvedTenantContext.Provider value={resolved}>
      {children ?? <Outlet />}
    </ResolvedTenantContext.Provider>
  );
}

export function TenantLoadingScreen({
  portal,
  slug,
}: {
  portal: TenantPortalKind;
  slug?: string;
}) {
  return (
    <div data-portal={portal} className="stem-mesh stem-grid-overlay stem-tenant-resolve">
      <div className="stem-tenant-resolve-card stem-animate-fade">
        <BrandMark />
        <div className="stem-tenant-spinner" aria-hidden />
        <p className="stem-tenant-resolve-muted">
          Looking up school{slug ? ` · ${slug}` : ''}…
        </p>
      </div>
      <style>{tenantResolveStyles}</style>
    </div>
  );
}

export function TenantNotFoundPage({
  portal,
  slug,
  reason = 'not_found',
  demoSlug = 'al-noor',
}: {
  portal: TenantPortalKind;
  slug?: string;
  reason?: 'not_found' | 'unavailable' | 'invalid';
  demoSlug?: string;
}) {
  const title =
    reason === 'unavailable'
      ? 'School unavailable'
      : reason === 'invalid'
        ? 'Invalid school link'
        : 'School not found';

  const body =
    reason === 'unavailable'
      ? 'This school tenant is temporarily unavailable. Please contact your administrator or try again later.'
      : reason === 'invalid'
        ? 'The school address in the URL is not a valid tenant slug. Check the link you were given.'
        : 'We couldn’t find a school matching this URL. Double-check the tenant slug, or open the demo school below.';

  const portalLabel =
    portal === 'institution' ? 'Institution portal' : portal === 'website' ? 'Public website' : 'Learner portal';

  return (
    <div data-portal={portal} className="stem-mesh stem-grid-overlay stem-tenant-404">
      <div className="stem-tenant-404-inner stem-animate-rise">
        <div className="stem-tenant-404-brand">
          <BrandMark size="lg" />
          <span className="stem-chip">{portalLabel}</span>
        </div>

        <div className="stem-tenant-404-visual" aria-hidden>
          <span className="stem-tenant-404-code">404</span>
          <div className="stem-tenant-404-orb" />
        </div>

        <h1 className="stem-tenant-404-title">{title}</h1>
        <p className="stem-tenant-404-body">{body}</p>

        {slug ? (
          <p className="stem-tenant-404-slug">
            Requested slug · <code>{slug}</code>
          </p>
        ) : null}

        <div className="stem-tenant-404-actions">
          <Button to={demoLoginPath(portal, demoSlug)} variant="primary" size="sm">
            Open demo school sign-in
          </Button>
          <Button to={demoHomePath(portal, demoSlug)} variant="secondary" size="sm">
            Go to {demoSlug}
          </Button>
        </div>

        <p className="stem-tenant-404-foot">
          {portal === 'website' ? (
            <>
              Try portals ·{' '}
              <a href={`http://localhost:5175/${demoSlug}/login`}>Institution</a>
              {' · '}
              <a href={`http://localhost:5178/${demoSlug}/login`}>Learner</a>
            </>
          ) : (
            <>
              Public site ·{' '}
              <a href={`http://localhost:5173/${demoSlug}`}>Stemora / {demoSlug}</a>
              {portal === 'institution' ? (
                <>
                  {' · '}
                  <a href={`http://localhost:5178/${demoSlug}/login`}>Learner portal</a>
                </>
              ) : (
                <>
                  {' · '}
                  <a href={`http://localhost:5175/${demoSlug}/login`}>Institution portal</a>
                </>
              )}
            </>
          )}
        </p>
      </div>
      <style>{tenantResolveStyles}</style>
    </div>
  );
}

const tenantResolveStyles = `
.stem-tenant-resolve,
.stem-tenant-404 {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 2rem 1.25rem;
}
.stem-tenant-resolve-card {
  display: grid;
  gap: 1rem;
  justify-items: center;
  text-align: center;
  padding: 2rem 1.75rem;
  background: rgba(255,255,255,0.88);
  border: 1px solid var(--stem-line);
  border-radius: var(--stem-radius);
  box-shadow: var(--stem-shadow);
  min-width: min(100%, 320px);
}
.stem-tenant-resolve-muted {
  margin: 0;
  color: var(--stem-ink-soft);
  font-size: var(--stem-text-base);
}
.stem-tenant-spinner {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 3px solid var(--stem-mint);
  border-top-color: var(--stem-teal);
  animation: stem-spin 0.75s linear infinite;
}
@keyframes stem-spin {
  to { transform: rotate(360deg); }
}
.stem-tenant-404-inner {
  width: min(100%, 560px);
  text-align: center;
  padding: 2.25rem 1.75rem 2rem;
  background: linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(238,248,246,0.92) 100%);
  border: 1px solid var(--stem-line);
  border-radius: 24px;
  box-shadow: var(--stem-shadow-lg);
}
.stem-tenant-404-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}
.stem-tenant-404-visual {
  position: relative;
  margin: 0.5rem 0 1.25rem;
  display: grid;
  place-items: center;
}
.stem-tenant-404-code {
  position: relative;
  z-index: 1;
  font-family: var(--stem-font-display);
  font-size: clamp(4.5rem, 14vw, 6.5rem);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.04em;
  background: linear-gradient(135deg, var(--stem-teal-deep), var(--stem-sky) 55%, var(--stem-apricot));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.stem-tenant-404-orb {
  position: absolute;
  width: 140px;
  height: 140px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 35% 30%, rgba(255,255,255,0.7), transparent 45%),
    radial-gradient(circle at 70% 70%, rgba(233,137,69,0.25), transparent 50%),
    rgba(18, 160, 171, 0.18);
  filter: blur(2px);
  animation: stem-drift 6s ease-in-out infinite;
}
.stem-tenant-404-title {
  margin: 0 0 0.65rem;
  font-size: clamp(1.65rem, 4vw, 2.15rem);
}
.stem-tenant-404-body {
  margin: 0 auto 1.15rem;
  max-width: 42ch;
  color: var(--stem-ink-soft);
  font-size: 1rem;
}
.stem-tenant-404-slug {
  margin: 0 0 1.5rem;
  font-size: var(--stem-text-md);
  color: var(--stem-ink-soft);
}
.stem-tenant-404-slug code {
  display: inline-block;
  margin-left: 0.25rem;
  padding: 0.2rem 0.55rem;
  border-radius: 8px;
  background: var(--stem-mint-soft);
  border: 1px solid var(--stem-line);
  color: var(--stem-teal-deep);
  font-weight: 600;
  font-size: var(--stem-text-md);
}
.stem-tenant-404-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  justify-content: center;
  margin-bottom: 1.35rem;
}
.stem-tenant-404-foot {
  margin: 0;
  font-size: var(--stem-text-md);
  color: var(--stem-ink-soft);
}
.stem-tenant-404-foot a {
  color: var(--stem-teal-deep);
  font-weight: 600;
}
.stem-tenant-404-foot a:hover {
  text-decoration: underline;
}
@media (prefers-reduced-motion: reduce) {
  .stem-tenant-spinner,
  .stem-tenant-404-orb {
    animation: none;
  }
}
`;

declare global {
  interface ImportMeta {
    env?: Record<string, string>;
  }
}
