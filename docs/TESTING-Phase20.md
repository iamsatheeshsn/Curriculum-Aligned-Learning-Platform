# Phase 20 — Testing

## K-12 STEM & Tutoring Platform

| Field | Value |
| --- | --- |
| **Status** | Implemented |
| **Date** | 29 July 2026 |
| **Runner** | PHPUnit via `php artisan test` |
| **DB** | Uses application MySQL (`learning_platform`) with seeded `al-noor` tenant |

---

## 1. Suites

| Suite | Directory | Focus |
| --- | --- | --- |
| Unit | `tests/Unit` | NotificationEvents, Rbac aliases, mobile config |
| Feature / API | `tests/Feature` | Health, meta, auth, org reports, learner dashboards, mobile 501 stubs |
| Security | `tests/Security` | Unauthenticated org, student vs control RBAC, bad token, tenant spoof |
| Performance | `tests/Performance` | Latency budgets for health, meta, login, school report |

---

## 2. Commands

```bash
cd backend
php artisan test
php artisan test --testsuite=Unit
php artisan test --testsuite=Feature
php artisan test --testsuite=Security
php artisan test --testsuite=Performance
```

Demo credentials expected:

| Role | Email | Password |
| --- | --- | --- |
| Tenant owner | `owner@alnoor.test` | `Password!456` |
| Student | `student@alnoor.test` | `Password!123` |
| Parent | `parent@alnoor.test` | `Password!123` |

---

## 3. Helpers

`Tests\TestCase` provides:

- `api($method, $uri, $data, $headers)` — prefix `/api/v1`
- `loginAs($portal, $email, $password, $tenantSlug?)` — returns Bearer headers

---

## 4. Coverage notes

- Tests are **integration-leaning** against the seeded database (schema lives primarily in SQL docs, not full Laravel migrations).
- Do not enable `RefreshDatabase` until a complete migration set exists.
- Performance thresholds are soft CI budgets (local XAMPP); tighten for production SLOs later.
- Expand with factories when Domain models gain dedicated factories.

---

## 5. Related

- Phase 19 mobile stubs are covered (`POST /mobile/devices` → 501).
- Security suite asserts portal RBAC boundaries for learner vs control.
