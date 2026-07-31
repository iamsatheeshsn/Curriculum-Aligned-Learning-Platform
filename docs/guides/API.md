# API Documentation

Base URL: `{APP_URL}/api/v1`  
OpenAPI: [`../openapi/openapi-v1.yaml`](../openapi/openapi-v1.yaml)  
Bootstrap: `GET /meta`, `GET /health`

## Authentication

| Login | Roles |
| --- | --- |
| `POST /auth/admin/login` | Super Admin, Tenant Owner |
| `POST /auth/teacher/login` | School staff, teacher, tutor |
| `POST /auth/student/login` | Student |
| `POST /auth/parent/login` | Parent |

Response includes `data.token` (Bearer). Session helpers: `GET /auth/me`, `POST /auth/logout`, password & email verify routes under `/auth/*`.

## Headers

| Header | When |
| --- | --- |
| `Authorization: Bearer …` | Authenticated |
| `X-Tenant-Slug` | Institution & Learner |
| `X-School-ID` | School-scoped org calls |
| `Accept-Language` | `en` \| `ar` |
| `X-Client` / `X-App-Version` / `X-Device-Id` | Optional mobile telemetry |

## Portal prefixes

| Prefix | Middleware highlights |
| --- | --- |
| `/control/*` | Sanctum + tenant isolation (plans public) |
| `/org/*` | Sanctum + isolation + active subscription |
| `/learner/*` | Same as org |
| `/mobile/*` | Sanctum; **501 planned** stubs |

## Major resource groups (`/org`)

Schools, campuses, grades, classes, sections, academic years, calendar, subjects, curricula (+ tree/publish/versions), timetables, resources, simulations, interactive lessons, homework, question bank, assessments, grading, progress, tutors & sessions, certificates, parent-links, reports, notifications, billing.

## Major resource groups (`/learner`)

Lessons/progress, homework submit, assessments attempts, tutoring book/join/rate, student portal aggregates, parent child aggregates, notifications.

## Errors

```json
{ "message": "…", "code": "tenant_mismatch", "errors": { } }
```

HTTP: 401, 403, 402 (subscription), 404, 422, 501 (mobile planned), 503 (health degraded).

## Pagination

Query: `page`, `per_page` (default 20, max 100). Laravel length-aware JSON.

## Mobile future

See [MOBILE-API-Phase19.md](../MOBILE-API-Phase19.md). Do not rely on `/mobile/*` until status leaves `planned`.
