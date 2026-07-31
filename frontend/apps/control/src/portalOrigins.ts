/** Sibling Stemora apps — override via VITE_* when Vite remaps ports. */
export const WEBSITE_ORIGIN =
  (import.meta.env.VITE_WEBSITE_ORIGIN as string | undefined)?.replace(/\/$/, '') ||
  'http://localhost:5173';

export const INSTITUTION_ORIGIN =
  (import.meta.env.VITE_INSTITUTION_ORIGIN as string | undefined)?.replace(/\/$/, '') ||
  'http://localhost:5175';

export const LEARNER_ORIGIN =
  (import.meta.env.VITE_LEARNER_ORIGIN as string | undefined)?.replace(/\/$/, '') ||
  'http://localhost:5176';

export function publicSchoolSiteUrl(tenantSlug: string) {
  return `${WEBSITE_ORIGIN}/${tenantSlug}`;
}

export function institutionPortalLoginUrl(tenantSlug: string) {
  return `${INSTITUTION_ORIGIN}/${tenantSlug}/login`;
}

export function learnerPortalLoginUrl(tenantSlug: string) {
  return `${LEARNER_ORIGIN}/${tenantSlug}/login`;
}
