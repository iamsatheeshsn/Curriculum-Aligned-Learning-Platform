# Architecture Guide

Concise operator-facing summary. Full design: [ARCHITECTURE-Phase2.md](../ARCHITECTURE-Phase2.md).

## System shape

```text
Website + Control + Institution + Learner (React)
                 │  HTTPS JSON + Bearer
                 ▼
         Laravel /api/v1
    Auth · Tenancy · RBAC · Domains
                 │
         MySQL + Local files + Queues
```

## Tenancy

- One SaaS codebase; many tenants (`tenants.slug`).
- Institution & Learner bind tenant via `X-Tenant-Slug` / login body.
- School isolation via `school_id` / `X-School-ID`.
- Suspended tenants cannot authenticate into org/learner portals.

## Portals & roles

| Portal | Roles |
| --- | --- |
| Control | Super Admin, Tenant Owner |
| Institution | School Admin, Campus Admin, Principal, Coordinator, Teacher, Tutor, Finance |
| Learner | Student, Parent |

## Domain modules

Organization · Identity/RBAC · Curriculum · Interactive Learning · Assessment · Tutoring · Student/Parent portals · Reporting · Notifications · Billing

## Cross-cutting

- **Auth:** Sanctum personal access tokens (mobile-ready).
- **i18n:** EN/AR + RTL-ready UI.
- **Notifications:** in-app + email (+ SMS/WhatsApp stubs).
- **Billing:** subscription plans, school/student invoices, tutor payments.
- **Mobile (Phase 19):** same API; `/meta` + OpenAPI; push/sync planned (501).

## Frontend monorepo

`frontend/apps/{website,control,institution,learner}` sharing `@stemora/ui`, `api-client`, `auth`, `i18n`. Theme tokens encode the Stemora learning/tutoring brand.

## Evolution

1. Complete SPA ↔ API wiring for all org screens.
2. Harden migrations vs SQL scripts.
3. Native apps against frozen `/api/v1` contract.
4. Scale: read replicas, object storage, dedicated queue nodes — without changing portal boundaries.
