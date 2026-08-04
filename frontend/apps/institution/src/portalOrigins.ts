/** Sibling Stemora apps — override via VITE_* when Vite remaps ports. */
const env = import.meta.env as Record<string, string | undefined> | undefined;

export const WEBSITE_ORIGIN = env?.VITE_WEBSITE_ORIGIN?.replace(/\/$/, '') || 'http://localhost:5173';

export const LEARNER_ORIGIN = env?.VITE_LEARNER_ORIGIN?.replace(/\/$/, '') || 'http://localhost:5178';

export const CONTROL_ORIGIN = env?.VITE_CONTROL_ORIGIN?.replace(/\/$/, '') || 'http://localhost:5174';

export function publicSchoolSiteUrl(tenantSlug: string) {
  return `${WEBSITE_ORIGIN}/${tenantSlug}`;
}

export function learnerPortalLoginUrl(tenantSlug: string) {
  return `${LEARNER_ORIGIN}/${tenantSlug}/login`;
}
