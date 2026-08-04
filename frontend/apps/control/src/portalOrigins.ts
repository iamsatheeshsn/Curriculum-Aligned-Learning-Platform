/** Sibling Stemora apps — override via VITE_* when Vite remaps ports. */
const env = (import.meta as { env?: Record<string, string | undefined> }).env;

export const WEBSITE_ORIGIN = env?.VITE_WEBSITE_ORIGIN?.replace(/\/$/, '') || 'http://localhost:5173';

export const INSTITUTION_ORIGIN =
  env?.VITE_INSTITUTION_ORIGIN?.replace(/\/$/, '') || 'http://localhost:5175';

export const LEARNER_ORIGIN = env?.VITE_LEARNER_ORIGIN?.replace(/\/$/, '') || 'http://localhost:5178';

export function publicSchoolSiteUrl(tenantSlug: string) {
  return `${WEBSITE_ORIGIN}/${tenantSlug}`;
}

export function institutionPortalLoginUrl(tenantSlug: string) {
  return `${INSTITUTION_ORIGIN}/${tenantSlug}/login`;
}

export function learnerPortalLoginUrl(tenantSlug: string) {
  return `${LEARNER_ORIGIN}/${tenantSlug}/login`;
}
