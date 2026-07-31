# Phase 2 — Enterprise Architecture

## K-12 STEM & Tutoring Platform

| Field | Value |
| --- | --- |
| **Document Title** | Enterprise Architecture Design |
| **Product Name** | K-12 STEM & Tutoring Platform |
| **Version** | 1.1 (Approved) |
| **Status** | Approved — Implementation Authorized |
| **Date** | 29 July 2026 |
| **Approved On** | 29 July 2026 |
| **Amended On** | 29 July 2026 |
| **Depends On** | SRS v1.0 (Approved) |
| **Stack** | Laravel 12 · PHP 8.3+ · React · Vite · Tailwind · MySQL · Sanctum · Local Storage |

---

## Document Control

| Version | Date | Author | Description |
| --- | --- | --- | --- |
| 1.0 | 2026-07-29 | Architecture | Phase 2 enterprise architecture draft |
| 1.0 | 2026-07-29 | Architecture | Stakeholder approved; implementation authorized |
| 1.1 | 2026-07-29 | Architecture | Locked 3-app portal model: Control (Super Admin + Tenant Owner); Institution (School + Teacher) with tenant slug; Learner (Student + Parent) with tenant slug |

**Approval gate:** Cleared. Scaffolding and architecture-bound implementation may proceed.

---

## 1. Architecture Goals

1. Single SaaS codebase serving multiple institutional tenants across KSA and UAE.
2. **Three web portals** sharing one Laravel REST API: Control, Institution, and Learner (see §2.3 / §3).
3. Strict tenant and school isolation at every data and file boundary; Institution and Learner portals identify tenant via **URL slug**.
4. Bilingual (AR/EN) including RTL as a platform capability, not a UI afterthought.
5. Queue-driven side effects (notifications, imports, scoring, emails).
6. Deployment that starts simple (XAMPP / single VPS) and scales to multi-node without redesign.
7. API contracts stable enough for future mobile clients (no native apps in V1).

---

## 2. System Architecture

### 2.1 High-Level View

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     CLIENTS (Responsive Web — V1)                         │
│                                                                          │
│  ┌─────────────────────┐  ┌──────────────────────┐  ┌─────────────────┐ │
│  │  CONTROL PORTAL     │  │  INSTITUTION PORTAL  │  │  LEARNER PORTAL │ │
│  │  Super Admin +      │  │  School + Teacher    │  │  Student +      │ │
│  │  Tenant Owner       │  │  /{tenantSlug}/…     │  │  Parent         │ │
│  │  (no tenant slug)   │  │                      │  │  /{tenantSlug}/…│ │
│  └─────────────────────┘  └──────────────────────┘  └─────────────────┘ │
│              React + Vite + Tailwind (3 apps, shared packages)            │
└─────────────────────────────────┬────────────────────────────────────────┘
                                  │ HTTPS / JSON
                                  │ Bearer / Cookie (Sanctum)
┌─────────────────────────────────▼────────────────────────────────────────┐
│                     API GATEWAY SURFACE (Nginx / Apache)                  │
│                     /api/v1/*  ·  portal static assets                     │
└─────────────────────────────────┬────────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼────────────────────────────────────────┐
│                         LARAVEL 12 APPLICATION                            │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌────────────────┐ │
│  │ HTTP Kernel │→ │ Middleware    │→ │ Controllers │→ │ Domain Services│ │
│  │ Routing     │  │ Tenant/School │  │ Form Req.   │  │ Actions/DTOs   │ │
│  │ Sanctum     │  │ RBAC · Locale │  │ API Resources│ │ Policies       │ │
│  └─────────────┘  └──────────────┘  └─────────────┘  └────────┬───────┘ │
│         │                │                                      │         │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────────────┐  ┌─────────▼──────┐ │
│  │ Queue Workers│  │ Notifications│  │ Local Storage │  │ MySQL (tenant │ │
│  │ Jobs/Events  │  │ Mail · In-App │  │ media files   │  │ aware schema) │ │
│  └─────────────┘  └─────────────┘  └──────────────┘  └────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Logical Layers

| Layer | Responsibility |
| --- | --- |
| **Presentation (Portals)** | Role-specific UX; no business rules beyond display/validation hints |
| **API (Laravel)** | Auth, authorization, tenancy resolution, validation, orchestration |
| **Domain** | Learning, Assessment, Tutoring, Org, Identity, Notifications |
| **Infrastructure** | MySQL, local disk, queues, mail, meeting-provider adapters |
| **Cross-cutting** | Logging, audit, i18n, rate limits, feature flags |

### 2.3 Portal Packaging (Locked Decision)

**Three React applications** consume the **same** versioned REST API (`/api/v1`). Role suites are combined as follows:

| App ID | Portal Name | Roles Served | Tenant in URL |
| --- | --- | --- | --- |
| **P1** | **Control Portal** | Platform Super Admin **and** Tenant Owner | **No** — platform-level host/path |
| **P2** | **Institution Portal** | School Admin, Campus Admin, Academic Coordinator, Teacher, Tutor (School + Teacher experiences) | **Yes** — `/{tenantSlug}/…` |
| **P3** | **Learner Portal** | Student **and** Parent | **Yes** — `/{tenantSlug}/…` |

Within each app, navigation and route guards switch experiences by role (e.g. Institution: school-ops vs teacher; Learner: student vs parent).

#### URL Conventions

| Portal | Example URL patterns |
| --- | --- |
| Control | `https://control.example.com/` or `https://example.com/control/` |
| Institution | `https://institution.example.com/{tenantSlug}/dashboard` · `…/{tenantSlug}/classes` |
| Learner | `https://learner.example.com/{tenantSlug}/home` · `…/{tenantSlug}/parent/…` |

`tenantSlug` is a unique, URL-safe identifier on the `tenants` table (e.g. `al-noor-riyadh`, `brightminds-dubai`). It is the **primary public identifier** for Institution and Learner apps.

#### Frontend packaging

- **Three Vite apps** under `frontend/apps/{control,institution,learner}`
- Shared code in `frontend/packages/{api-client,ui,i18n,auth}`
- Separate deploys/CDN paths allowed; shared API origin

### 2.4 Laravel REST API Design Principles

| Principle | Decision |
| --- | --- |
| Style | REST/JSON, resource-oriented |
| Versioning | URI prefix `/api/v1` |
| Auth | Laravel Sanctum (SPA cookie for web; token-ready for future mobile) |
| Errors | Consistent envelope `{ message, errors, code }` |
| Pagination | Cursor or page-based; default page size capped |
| Filtering | Explicit query params; never raw client SQL-like filters |
| Idempotency | Critical POSTs (bookings) support idempotency keys where needed |
| Docs | OpenAPI (generated or maintained) before mobile phase |
| Tenant hint | Institution/Learner clients send resolved tenant via header `X-Tenant-Slug` (and/or path-derived context) matching URL slug; server validates against auth membership |

---

## 3. Portal Design

### 3.0 Portal Map (Authoritative)

```
CONTROL PORTAL (no tenant slug)
  ├── Super Admin     → platform operations
  └── Tenant Owner    → own-tenant administration (schools, billing contact, entitlements view)

INSTITUTION PORTAL  /{tenantSlug}/…
  ├── School Admin / Campus Admin / Academic Coordinator  → institutional ops
  └── Teacher / Tutor                                       → teaching & tutoring delivery

LEARNER PORTAL  /{tenantSlug}/…
  ├── Student  → learn, assess, join tutoring
  └── Parent   → monitor children, book tutoring
```

### 3.1 Control Portal (Super Admin + Tenant Owner)

**Purpose:** Single console for platform operation **and** tenant ownership. No `tenantSlug` in the URL.

#### Super Admin experience

- Create / suspend / delete tenants (including assigning unique `slug`)
- Assign subscription entitlements and module flags
- Global localization packs oversight
- Platform audit and operational dashboards
- Support tools (controlled impersonation with full audit)
- Country defaults (KSA/UAE) and system reference data

#### Tenant Owner experience

- Manage **their** tenant profile, branding, locale defaults
- Create/manage schools and high-level campus structure
- View entitlements / subscription status for their tenant
- Designate School Admins; oversee tenant-wide users at ownership level
- Tenant-level audit and summary reports
- **Cannot** access other tenants; **does not** use Institution/Learner slug URLs for day-to-day ownership work

**Key screens:** (Super Admin) Tenants, Feature flags, Platform users, System settings · (Tenant Owner) My Tenant, Schools, Owners’ team, Entitlements, Tenant audit.

**Auth note:** After login, UI branches by role. Tenant Owner context is bound to their `tenant_id` from the user record (not from URL slug).

### 3.2 Institution Portal (School + Teacher) — `/{tenantSlug}/…`

**Purpose:** Staff-facing operations for a **specific tenant**, identified by slug in every route.

**Tenant binding:** App boots on `/{tenantSlug}/…` → resolves tenant → sends `X-Tenant-Slug` on API calls → server verifies user membership in that tenant. Mismatch → 403.

#### School experience (School Admin, Campus Admin, Academic Coordinator)

- Academic years, grades, classes, sections, subjects
- User provisioning (teachers, students, parents) and bulk import
- Curriculum mapping & content publishing policies
- Tutoring packages, rooms/resources, utilization reports
- Campus-level and school-level analytics
- Announcements to roles/classes
- School/campus settings within the slug tenant

#### Teacher experience (Teacher, Tutor)

- Class dashboard and roster
- Assign pathways / lessons / homework
- Question bank & assessment authoring (scoped)
- Grading (auto + manual)
- Progress monitoring and interventions
- Tutor availability & session conduct
- Class announcements

**Key route examples**

- `/{tenantSlug}/login`
- `/{tenantSlug}/school/people`
- `/{tenantSlug}/school/academics`
- `/{tenantSlug}/teacher/classes`
- `/{tenantSlug}/teacher/assessments`
- `/{tenantSlug}/tutoring/schedule`

### 3.3 Learner Portal (Student + Parent) — `/{tenantSlug}/…`

**Purpose:** Family-facing learning and engagement for a **specific tenant**, identified by slug.

**Tenant binding:** Same slug + membership verification pattern as Institution Portal. Students/parents only access the tenant they belong to.

#### Student experience

- Learning home (assigned pathways)
- Lesson player (bilingual content)
- Assessment attempts
- Progress view
- Tutoring calendar & join
- Notifications inbox
- Language switcher (AR/EN)

#### Parent experience

- Multi-child switcher
- Progress and assessment summaries (policy-aware)
- Upcoming deadlines and sessions
- Book / cancel tutoring per school policy
- Notification preferences
- Language switcher (AR/EN)

**Key route examples**

- `/{tenantSlug}/login`
- `/{tenantSlug}/student/home`
- `/{tenantSlug}/student/lessons/:id`
- `/{tenantSlug}/parent/children`
- `/{tenantSlug}/parent/tutoring/book`

### 3.4 Cross-Portal UX Rules

- Control Portal uses platform branding; Institution/Learner apply **tenant branding** resolved via slug.
- Shared design tokens via `frontend/packages/ui` (Tailwind theme).
- RTL mirrored layouts when `locale = ar`.
- Mobile-web responsive especially for Learner Portal.
- Deep links in emails must include the correct portal host **and** `tenantSlug` for Institution/Learner.
- Users with multiple roles use the portal that matches the task; deep-link helpers may switch apps when needed.

---

## 4. Folder Structure

### 4.1 Monorepo Layout (Recommended)

```
learning_platform/
├── docs/
│   ├── SRS-K12-STEM-Tutoring-Platform.md
│   └── ARCHITECTURE-Phase2.md
├── backend/                          # Laravel 12 API
│   ├── app/
│   │   ├── Domain/                   # Domain modules (pure-ish business)
│   │   │   ├── Identity/
│   │   │   ├── Organization/         # Tenant, School, Campus, Country
│   │   │   ├── Academics/
│   │   │   ├── Learning/
│   │   │   ├── Assessment/
│   │   │   ├── Tutoring/
│   │   │   ├── Notification/
│   │   │   └── Reporting/
│   │   ├── Http/
│   │   │   ├── Controllers/Api/V1/
│   │   │   ├── Middleware/
│   │   │   ├── Requests/
│   │   │   └── Resources/
│   │   ├── Jobs/
│   │   ├── Events/
│   │   ├── Listeners/
│   │   ├── Notifications/
│   │   ├── Policies/
│   │   ├── Providers/
│   │   ├── Support/                  # TenantContext, Locale, Result types
│   │   └── Models/                   # Eloquent models (or under Domain)
│   ├── bootstrap/
│   ├── config/
│   ├── database/
│   │   ├── migrations/
│   │   ├── seeders/
│   │   └── factories/
│   ├── routes/
│   │   ├── api.php
│   │   ├── channels.php
│   │   └── console.php
│   ├── storage/
│   │   └── app/
│   │       └── tenants/              # Local storage root per tenant
│   │           └── {tenant_id}/
│   │               └── schools/{school_id}/...
│   ├── tests/
│   │   ├── Feature/
│   │   ├── Unit/
│   │   └── Isolation/                # Tenant/school leak tests
│   ├── lang/
│   │   ├── en/
│   │   └── ar/
│   └── artisan
├── frontend/
│   ├── apps/
│   │   ├── control/                  # Super Admin + Tenant Owner (no slug)
│   │   │   ├── index.html
│   │   │   ├── src/
│   │   │   │   ├── app/
│   │   │   │   ├── features/
│   │   │   │   │   ├── super-admin/
│   │   │   │   │   └── tenant-owner/
│   │   │   │   └── main.tsx
│   │   │   ├── package.json
│   │   │   └── vite.config.ts
│   │   ├── institution/              # School + Teacher (/{tenantSlug}/…)
│   │   │   ├── index.html
│   │   │   ├── src/
│   │   │   │   ├── app/             # slug-aware router
│   │   │   │   ├── features/
│   │   │   │   │   ├── school/
│   │   │   │   │   └── teacher/
│   │   │   │   └── main.tsx
│   │   │   ├── package.json
│   │   │   └── vite.config.ts
│   │   └── learner/                  # Student + Parent (/{tenantSlug}/…)
│   │       ├── index.html
│   │       ├── src/
│   │       │   ├── app/             # slug-aware router
│   │       │   ├── features/
│   │       │   │   ├── student/
│   │       │   │   └── parent/
│   │       │   └── main.tsx
│   │       ├── package.json
│   │       └── vite.config.ts
│   ├── packages/
│   │   ├── api-client/
│   │   ├── auth/
│   │   ├── i18n/
│   │   └── ui/
│   ├── package.json                  # workspace root
│   └── tailwind.preset.js
└── README.md
```

### 4.2 API Route Grouping (Logical)

```
/api/v1
  /auth/*
  /control/*        # super admin + tenant owner surfaces
  /org/*            # school/campus (institution; slug-scoped)
  /academics/*
  /learning/*
  /assessments/*
  /tutoring/*
  /parents/*        # parent-scoped aggregates (learner)
  /notifications/*
  /reports/*
  /media/*
  /tenants/by-slug/{slug}   # public/light resolve for portal bootstrap
```

Controllers remain thin; domain services own transactions and events.

### 4.3 Domain Module Internal Pattern

Each domain module typically contains:

```
Domain/Learning/
  Actions/          # CreatePathway, AssignLesson, RecordProgress
  Models/ or Entities/
  Enums/
  Events/
  Policies/         # if not global
  Data/DTO/
```

---

## 5. Multi-Tenant Strategy

### 5.1 Tenancy Model

**Pattern:** Shared database, shared schema, **discriminator column** `tenant_id` on all tenant-owned tables (row-level tenancy).

**Why for V1**

- Fits single MySQL deployment and XAMPP/VPS pilots
- Simpler migrations and reporting across ops
- Adequate isolation when enforced in middleware + global scopes + policies + automated tests

**Future path:** Database-per-tenant or schema-per-tenant for enterprise isolation deals — design code so `TenantContext` can later swap connection resolvers without rewriting domains.

### 5.2 Hierarchy

```
Platform
 └── Tenant (billing & isolation root)
      ├── Settings, entitlements, branding
      ├── Country presence (KSA, UAE, …)
      └── Schools[]
           └── Campuses[]
                └── Academic structures & users
```

| Level | Isolation Meaning |
| --- | --- |
| **Tenant** | Hard security boundary — no cross-tenant reads/writes |
| **School** | Hard institutional boundary within tenant — default deny across schools |
| **Campus** | Operational scope — users/resources usually campus-scoped |
| **Class/Section** | Teaching scope |

### 5.3 Tenant Resolution

#### Control Portal

1. Authenticated user’s role determines scope.
2. **Super Admin:** optional `X-Tenant-ID` when acting on a specific tenant (audited).
3. **Tenant Owner:** `tenant_id` taken from the user/owner membership — **not** from URL slug.

#### Institution & Learner Portals

1. Frontend reads `tenantSlug` from the URL path.
2. Client sends `X-Tenant-Slug: {tenantSlug}` on API requests (Sanctum session/token also present).
3. Middleware resolves slug → `tenant_id`; rejects unknown/suspended tenants.
4. Middleware verifies the authenticated user belongs to that tenant (and role is allowed on this portal).
5. Reject with 403 on slug/membership mismatch (do not silently switch tenants).

`TenantContext` (request-scoped singleton) holds:

- `tenant_id`
- `tenant_slug`
- `school_id` (active school context when applicable)
- `campus_id` (optional active campus)
- `locale`
- `timezone`
- `country_code`
- `portal` (`control` | `institution` | `learner`)

### 5.4 Enforcement Mechanisms

| Mechanism | Use |
| --- | --- |
| Middleware `InitializeTenancy` | Bind TenantContext |
| Eloquent Global Scopes | Auto-filter by `tenant_id` |
| Model observers / traits `BelongsToTenant` | Auto-set `tenant_id` on create |
| Policies / Gates | School & role checks |
| Form Requests | Validate IDs belong to current tenant/school |
| Storage paths | Prefixed by tenant (and school) |
| Queued jobs | Serialize `tenant_id` + re-bind context in `handle()` |
| Feature tests | Attempt cross-tenant access → expect 403/404 |

### 5.5 Platform vs Tenant Data

| Data | Scope |
| --- | --- |
| Plan definitions, countries list, language packs | Platform |
| Schools, users, content, sessions, grades | Tenant |
| Optional shared curriculum templates | Platform templates → cloned into tenant |

---

## 6. School Isolation

### 6.1 Principle

Within a tenant that has multiple schools, **School A must not see School B’s students, grades, content assignments, or tutoring records** unless a role is explicitly tenant-wide (Tenant Owner) and the action is intentional.

### 6.2 Rules

1. Every school-owned row carries `tenant_id` + `school_id`.
2. Campus rows carry `school_id`.
3. Users have memberships: `user_school_role` (user, school, role, optional campus).
4. Teachers/students are enrolled per school; parents link to students (hence inherit school visibility through children only).
5. Content may be:

   - **Tenant library** (shared templates)
   - **School-owned** published instances

6. API paths that accept `school_id` must verify membership.
7. Reports default to active school/campus context.
8. File paths: `tenants/{tenant}/schools/{school}/...`

### 6.3 Cross-School Roles

| Role | Cross-school? | Portal |
| --- | --- | --- |
| Platform Super Admin | Yes (all tenants) — audited | Control |
| Tenant Owner | Yes (all schools in **own** tenant) | Control |
| School Admin | No — own school only | Institution `/{slug}` |
| Campus Admin | No — own campus only | Institution `/{slug}` |
| Teacher / Tutor | No — assigned scope only | Institution `/{slug}` |
| Student / Parent | No — assigned/linked scope only | Learner `/{slug}` |

### 6.4 Isolation Test Matrix (Mandatory)

- Create Student in School A; Teacher in School B cannot GET student
- Assessment attempt IDs are non-enumerable across schools (404 not 403 when hiding existence is preferred for students)
- Media URLs signed or authorized; guessing other school paths fails
- Queue job for School A cannot write progress to School B IDs

---

## 7. Multi-Language Strategy

### 7.1 Languages (V1)

| Code | Language | Direction |
| --- | --- | --- |
| `en` | English | LTR |
| `ar` | Arabic | RTL |

### 7.2 Layers of Localization

| Layer | Approach |
| --- | --- |
| **UI strings** | Frontend i18n dictionaries (`en.json`, `ar.json`); no hard-coded user strings in portals |
| **API validation/messages** | Laravel `lang/en`, `lang/ar`; `Accept-Language` or user preference |
| **Domain content** | Translatable columns or `translations` JSON / side table for lessons, questions, announcements |
| **Emails / notifications** | Rendered in recipient’s preferred locale |
| **Dates/numbers** | Locale + school/campus timezone |

### 7.3 Content Translation Model

Recommended V1 pattern for learning/assessment content:

```
content_items
  id, tenant_id, school_id?, type, ...

content_item_translations
  content_item_id, locale (en|ar), title, body, metadata
```

Fallback: if requested locale missing → fall back to tenant default → then `en`.

### 7.4 RTL Strategy

- `dir="rtl"` on `<html>` when locale is `ar`
- Tailwind logical properties (`ms-`, `me-`, `ps-`, `pe-`, `start/end`) preferred over `left/right`
- Mirrored navigation and iconography where direction matters
- Visual QA checklist per portal for Arabic

### 7.5 Locale Resolution Order

1. Explicit user profile preference  
2. `Accept-Language` on anonymous auth screens  
3. School / tenant default  
4. Platform default (`en`)

### 7.6 Country Coupling

| Country | Default locale suggestion | Timezone examples |
| --- | --- | --- |
| KSA | `ar` (configurable) | Asia/Riyadh |
| UAE | `en` or `ar` (school choice) | Asia/Dubai |

Country also drives calendar week-start and future compliance flags — not only language.

---

## 8. Security Architecture

### 8.1 Authentication

- Laravel Sanctum for SPA (httpOnly cookies + CSRF) in V1 web
- Token abilities reserved for future mobile
- Password hashing via framework secure defaults
- Password reset with time-limited tokens
- Login throttling / lockout
- Optional MFA for Control Portal privileged roles (Super Admin, Tenant Owner) (Should)

### 8.2 Authorization

- RBAC with roles listed in SRS
- Laravel Policies on domain models
- Permission checks always server-side
- Parent access only via `parent_student` links
- Minors: guardian-linked onboarding; restricted messaging defaults

### 8.3 Application Security Controls

| Control | Implementation Intent |
| --- | --- |
| TLS | Required in production |
| CSRF | Sanctum SPA flow |
| XSS | React escaping + CSP headers |
| SQLi | Eloquent/query builder only |
| Mass assignment | Explicit `$fillable` / DTOs |
| File uploads | MIME/size allow-lists; store outside public raw exec paths; serve via authorized routes |
| Rate limits | Auth, booking, export, password reset |
| Secrets | `.env` / server env; never in repo |
| Audit log | Auth events, role changes, grade overrides, exports, impersonation |
| Session | Idle timeout for privileged roles |

### 8.4 Data Protection

- Encryption in transit; encrypt sensitive fields at rest where warranted (e.g., tokens)
- PII minimization on logs
- Export and deletion workflows for compliance requests
- Backups encrypted and access-controlled

### 8.5 API Security Headers (Production Baseline)

- `Strict-Transport-Security`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy`
- `Content-Security-Policy` (tuned for SPA)
- `Permissions-Policy`

---

## 9. Queue Architecture

### 9.1 Purpose

Move slow/side-effect work off the HTTP request path for reliability and scale.

### 9.2 V1 Broker

| Environment | Driver |
| --- | --- |
| Local/XAMPP | `database` queue (simple) or Redis if available |
| Production | **Redis** recommended; `database` acceptable for early pilots |

### 9.3 Workers

- `php artisan queue:work` (supervised via Supervisor/systemd in production)
- Separate queues by priority:

| Queue | Examples |
| --- | --- |
| `high` | Tutoring reminders due soon, password reset email |
| `default` | Notifications, scoring finalization |
| `low` | CSV imports, report generation, storage cleanup |
| `mail` | All outbound email (optional split) |

### 9.4 Job Catalog (V1)

| Job | Trigger | Notes |
| --- | --- | --- |
| `SendNotificationJob` | Domain events | Locale-aware |
| `SendEmailJob` | Notification channels | Tenant-branded templates |
| `ProcessBulkUserImportJob` | Admin upload | Chunked; progress status |
| `FinalizeAssessmentAttemptJob` | Attempt submit | Auto-score + events |
| `GenerateReportExportJob` | Report request | Writes file under tenant path |
| `DispatchTutoringRemindersJob` | Scheduler | Periodic scan |
| `PurgeExpiredTokensJob` | Scheduler | Maintenance |

### 9.5 Tenant Context in Jobs

Every job payload includes at minimum:

- `tenant_id`
- optional `school_id`
- `actor_id` (when relevant)
- `locale` (when rendering)

`handle()` must call `TenantContext::set(...)` before queries.

### 9.6 Reliability

- Retries with exponential backoff
- `failed_jobs` table + alert hook
- Idempotent job handlers where duplicate delivery is possible
- Horizon (optional later) for Redis monitoring

### 9.7 Scheduler

Laravel Scheduler entries for reminders, cleanup, and digest emails — single cron: `* * * * * php artisan schedule:run`.

---

## 10. Notification Architecture

### 10.1 Channels (V1)

| Channel | Use |
| --- | --- |
| **In-app** | Persistent notification center per user |
| **Email** | Critical and digest events |
| SMS / WhatsApp | Future enhancement |

### 10.2 Pipeline

```
Domain Event
    → Listener / Notifier
        → Resolve recipients (role, parent links, preferences)
            → Render template (locale AR/EN)
                → Persist in-app record
                → Queue email job (if channel enabled)
                    → Mail transport
```

### 10.3 Core Event Catalog

Aligned with SRS:

- User invited / password reset
- Content assigned
- Assessment available / due / graded
- Tutoring booked / reminder / cancelled / completed
- Announcement published
- Optional progress milestones

### 10.4 Data Model (Logical)

- `notifications` (Laravel database notifications or custom table)
- `notification_preferences` (user_id, event_type, channel, enabled)
- `mail_logs` (optional operational trace without body PII overload)

### 10.5 Preferences & Policy

- Parents/students can disable non-critical email
- Security and booking confirmations remain mandatory
- School may enforce minimum parent notification set

### 10.6 Template Strategy

- Blade or Markdown mail templates per locale: `resources/views/mail/{locale}/...`
- Variables sanitized; no raw student PII in subject lines beyond necessity
- Tenant logo/name merge from tenant settings

---

## 11. Deployment Architecture

### 11.1 V1 Target Topologies

#### A. Development (current constraint friendly)

```
Windows + XAMPP
  Apache → public/ (Laravel) + Vite dev server (proxy API)
  MySQL
  Queue worker in terminal
  Local storage under storage/app/tenants
```

#### B. Production Pilot (Single VPS)

```
                    Internet
                       │
                   TLS (Nginx)
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   Static SPA     /api/v1/*      (optional /storage authorized)
   (built React)   PHP-FPM
                   Laravel
                       │
        ┌──────────────┼──────────────┐
        │              │              │
      MySQL          Redis         Local/NFS disk
                   (queue/cache)   (tenant media)
        │
   queue workers + scheduler (Supervisor)
```

### 11.2 Process Roles

| Process | Role |
| --- | --- |
| Web (Nginx + PHP-FPM) | HTTP API + SPA |
| Queue workers | Async jobs |
| Scheduler | Cron entrypoint |
| MySQL | System of record |
| Redis | Queue/cache (prod) |
| Backup agent | DB + `storage/app/tenants` |

### 11.3 Environment Separation

| Env | Purpose |
| --- | --- |
| `local` | Developer machines |
| `staging` | UAT / school pilots |
| `production` | Live tenants |

Secrets and `APP_KEY` unique per environment; debug off in production.

### 11.4 Release Pipeline (Recommended)

1. Run tests (including isolation suite)
2. Build frontend (`vite build`)
3. Deploy backend + `public/spa` assets
4. `php artisan migrate --force`
5. Restart PHP-FPM / queue workers
6. Smoke check `/api/v1/health`

### 11.5 Storage & Backup

- Media under tenant-scoped local disk
- Nightly MySQL dump + filesystem snapshot
- Retention policy per compliance settings
- Restore drill documented before first paid tenant

### 11.6 Scaling Path (No Redesign)

| Pressure | Scale action |
| --- | --- |
| More HTTP traffic | More PHP-FPM nodes behind load balancer (stateless app) |
| More jobs | More queue workers / partitioned queues |
| DB load | Read replicas later; indexes first |
| Disk | Move to S3-compatible object storage (FE-05) without changing domain APIs |
| Regional residency | Deploy regional stack; pin tenant to region |

### 11.7 Health & Observability

- `GET /api/v1/health` (app, db, queue lag basic)
- Centralized logs (stack trace redaction for PII)
- Error tracking (e.g., Sentry) recommended for staging/prod
- Audit log retained separately from application debug logs

---

## 12. End-to-End Request Flow (Example)

**Parent books tutoring session**

1. Learner Portal (`/{tenantSlug}/…`) → `POST /api/v1/tutoring/sessions` (+ `X-Tenant-Slug`)
2. Sanctum authenticates; TenantContext bound
3. Policy checks parent↔student link and school booking rules
4. Tutoring domain reserves slot (transaction)
5. Domain event `TutoringSessionBooked`
6. Listener queues `SendNotificationJob` (parent, student, tutor)
7. API returns session resource
8. Workers send in-app + email in recipient locales
9. Scheduler later queues reminders on `high` queue

---

## 13. Technology Mapping Summary

| Concern | Choice |
| --- | --- |
| API | Laravel 12 REST `/api/v1` |
| Auth | Sanctum |
| Portals | 3 React apps: Control · Institution · Learner (shared packages) |
| Tenant URL | `tenant.slug` required for Institution & Learner routes |
| DB | MySQL shared schema + `tenant_id` / `school_id` |
| Tenancy | Row-level + context middleware + scopes |
| i18n | Frontend dictionaries + Laravel lang + content translations |
| Files | Local `storage/app/tenants/{id}/...` |
| Queues | Database/Redis + prioritized workers |
| Notifications | DB in-app + queued email |
| Deploy | Nginx/Apache + PHP-FPM + workers + MySQL |

---

## 14. Open Decisions (Confirm Before Build)

| ID | Decision | Options | Recommendation |
| --- | --- | --- | --- |
| OD-01 | Frontend packaging | ~~Single SPA~~ / 3 apps | **Locked:** 3 apps (Control, Institution, Learner) |
| OD-01b | Tenant URL strategy | Subdomain vs path slug | **Locked:** path `/{tenantSlug}/…` on Institution & Learner |
| OD-02 | Queue driver (prod) | Database vs Redis | Redis |
| OD-03 | Meeting provider | Zoom / Teams / Meet / WebRTC | Adapter interface; pick one for V1 |
| OD-04 | Content translation storage | JSON column vs translation table | Translation table |
| OD-05 | SPA auth mode | Cookie Sanctum vs token-only | Cookie Sanctum for web; tokens ready |
| OD-06 | Control host layout | Subdomain vs path `/control` | Either; keep cookies/CSRF origins aligned |

---

## 15. Architecture Acceptance Criteria

- [ ] Three portals mapped to shared `/api/v1` with RBAC boundaries
- [ ] Control Portal serves Super Admin **and** Tenant Owner (no tenant slug)
- [ ] Institution Portal serves School + Teacher with `/{tenantSlug}/…`
- [ ] Learner Portal serves Student + Parent with `/{tenantSlug}/…`
- [ ] Slug resolution + membership checks documented and testable
- [ ] Folder structure matches 3-app + packages monorepo plan
- [ ] Tenant isolation strategy documented and testable
- [ ] School isolation rules explicit for multi-school tenants
- [ ] AR/EN + RTL strategy defined for UI, API, content, notifications
- [ ] Security controls cover authn/z, uploads, audit, headers
- [ ] Queues carry tenant context; priorities defined
- [ ] Notification pipeline and event catalog defined
- [ ] Deployment topologies for local and production pilot defined |

---

## 16. Approval Sign-Off

| Role | Name | Signature | Date |
| --- | --- | --- | --- |
| Business Owner | | | |
| Engineering Lead | | | |
| Security Reviewer | | | |

---

## 17. Next Steps (After Approval)

1. Phase 3 — UX sitemap & wireflows for **Control**, **Institution**, **Learner**  
2. Logical ERD + API resource catalog (include `tenants.slug`)  
3. Sprint-0 backlog from Must requirements  
4. Scaffold `backend/` + `frontend/apps/{control,institution,learner}` + shared packages

---

**End of Document — Status: APPROVED (v1.1) — 3-PORTAL MODEL LOCKED**
