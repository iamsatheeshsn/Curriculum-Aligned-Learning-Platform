# Developer Guide

## Stack

- Backend: Laravel 12, Sanctum, domain modules under `backend/app/Domain/*`
- Frontend: React 19 + Vite + Tailwind 4 monorepo (`frontend/apps/*`, `frontend/packages/*`)
- API: `/api/v1` — Control `/control`, Institution `/org`, Learner `/learner`

## Local workflow

1. Start MySQL (XAMPP).
2. `php artisan serve` in `backend/`.
3. `npm run dev:*` for the portal you are changing.
4. Prefer hitting APIs with Bearer tokens + `X-Tenant-Slug`.

## Code layout

```text
backend/app/Domain/{Organization,Identity,Curriculum,Learning,Assessment,Tutoring,Billing,Notification,Reporting}/
backend/app/Http/Controllers/Api/V1/
backend/routes/api.php + routes/api/{auth,control,institution,learner}.php
frontend/apps/{website,control,institution,learner}
frontend/packages/{ui,api-client,auth,i18n}
```

## Conventions

- Controllers stay thin; services own transactions.
- Always scope by `tenant_id` / `school_id` via `TenantContext`.
- RBAC permissions live in `config/rbac.php` — seed, don’t hard-code matrices.
- Bilingual fields: `*_en` / `*_ar`; locale from `Accept-Language`.
- Jobs that touch tenant data should extend `TenantAwareJob`.

## Testing

```bash
cd backend
php artisan test
```

See [TESTING-Phase20.md](../TESTING-Phase20.md). Helper: `Tests\TestCase::loginAs()`.

## Adding an API

1. Domain service + model.
2. Controller method + Form Request if needed.
3. Route in the correct portal file with middleware (`auth:sanctum`, `tenant.isolation`, `subscription.active`).
4. Feature test under `tests/Feature/Api`.
5. Update OpenAPI snippet in `docs/openapi/openapi-v1.yaml` for public contracts.

## Mobile readiness

Do not build native apps in V1. Consume `GET /api/v1/meta` and OpenAPI. Planned stubs return **501** under `/api/v1/mobile/*`.
