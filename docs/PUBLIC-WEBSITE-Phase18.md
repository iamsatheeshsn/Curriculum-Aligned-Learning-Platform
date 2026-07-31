# Phase 18 — Public Website & Portal UI

## K-12 STEM & Tutoring Platform (Stemora)

| Field | Value |
| --- | --- |
| **Status** | Implemented (UI scaffold) |
| **Date** | 29 July 2026 |
| **Stack** | React 19 · Vite 6 · Tailwind CSS 4 · TypeScript |
| **Brand** | Stemora |

---

## 1. Deliverables

## Public website (`frontend/apps/website` · port **5173**)

Tenant-scoped marketing URLs:

| Page | Route |
| --- | --- |
| Home | `/{tenantSlug}` |
| Features | `/{tenantSlug}/features` |
| Pricing | `/{tenantSlug}/pricing` |
| Curriculum coverage | `/{tenantSlug}/curriculum` |
| Tutors | `/{tenantSlug}/tutors` |
| Contact | `/{tenantSlug}/contact` |

Example: `http://localhost:5173/al-noor`

### Portals (shared Stemora theme, portal-specific accents)

| Portal | App | Port | Roles | Tenant slug |
| --- | --- | --- | --- | --- |
| **Control** | `apps/control` | 5174 | Super Admin · Tenant Owner | No |
| **Institution** | `apps/institution` | 5175 | School · Teacher · Tutor | `/{tenantSlug}` · login `/{tenantSlug}/login` |
| **Learner** | `apps/learner` | 5176 | Student · Parent | `/{tenantSlug}/student\|parent` · login `/{tenantSlug}/login` |

### Shared packages

| Package | Purpose |
| --- | --- |
| `@stemora/ui` | Design tokens, BrandMark, Button, PortalShell |
| `@stemora/api-client` | Fetch wrapper → `/api/v1` |
| `@stemora/auth` | Session storage + AuthProvider |
| `@stemora/i18n` | EN/AR dictionaries (website) |

---

## 2. Theme (Learning / Tutoring)

| Token | Role |
| --- | --- |
| Deep teal `#0D7377` / `#065A5E` | Trust, primary actions, school ops |
| Cool mint surfaces `#EEF6F5` | Calm academic canvas + mesh gradients |
| Sky `#3A8FB7` | Institution rail / STEM signal |
| Apricot `#E8894A` | Achievement CTAs (demo, learner sign-in) |
| Display **Fraunces** · UI **Sora** | Expressive, non-default typography |

Portal accents via `data-portal="control|institution|learner"`.

---

## 3. Run locally

```bash
cd frontend
npm install
npm run dev:website      # http://127.0.0.1:5173
npm run dev:control     # http://127.0.0.1:5174
npm run dev:institution # http://127.0.0.1:5175
npm run dev:learner     # http://127.0.0.1:5176
```

API base (override with `VITE_API_BASE_URL`): `http://127.0.0.1:8000/api/v1`

### Demo logins (al-noor)

| Portal | Email | Password |
| --- | --- | --- |
| Control | `owner@alnoor.test` | `Password!456` |
| Institution | `tutor@alnoor.test` | `Password!123` |
| Learner student | `student@alnoor.test` | `Password!123` |
| Learner parent | `parent@alnoor.test` | `Password!123` |

Ensure Laravel is serving (`php artisan serve`) and CORS allows Vite origins if login is used from the browser.

---

## 4. Architecture alignment

Matches Phase 2 layout: `frontend/apps/{control,institution,learner}` + shared packages. Public marketing site added as `apps/website` for Phase 18.

Login pages call existing Sanctum endpoints (`/auth/admin|teacher|student|parent/login`). Dashboards are themed shells ready to bind to org/learner APIs from Phases 8–17.

---

## 5. Next UI increments (optional)

1. CORS / Sanctum stateful domains for local Vite hosts  
2. Bind Institution reports page to `/org/reports/*`  
3. Bind Learner homes to `/learner/student/*` and `/learner/parent/*`  
4. Contact form → notification or CRM webhook  
5. Tenant branding override (logo/colors from API)
