# Phase 19 — Future Mobile API Readiness

## K-12 STEM & Tutoring Platform (Stemora)

| Field | Value |
| --- | --- |
| **Status** | Designed (no native apps in V1) |
| **Date** | 29 July 2026 |
| **API** | `/api/v1` shared with web portals |
| **OpenAPI** | [`docs/openapi/openapi-v1.yaml`](openapi/openapi-v1.yaml) |

---

## 1. Principle

Android and iOS **will not** ship in Version 1. The same Sanctum-protected REST API used by Control, Institution, and Learner portals is the contract mobile teams must implement later. This phase freezes conventions, headers, envelopes, and capability discovery so native work can start without a redesign.

**Out of scope:** Flutter/React Native/Swift/Kotlin apps, App Store builds, offline SQLite clients.

---

## 2. Bootstrap endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/health` | Liveness; includes `api_version` |
| `GET` | `/api/v1/meta` | Capabilities, portals, headers, future stubs |
| `GET` | `/api/v1/tenants/by-slug/{slug}` | Tenant resolve before login UI |

Config: `backend/config/mobile.php`.

---

## 3. Auth & headers (mobile checklist)

1. Login via role endpoint → store `data.token`.
2. Every authenticated call: `Authorization: Bearer {token}`.
3. Institution/Learner: `X-Tenant-Slug: {slug}` (also send `tenant_slug` on login body).
4. School-scoped org calls: `X-School-ID` or `school_id` query.
5. Locale: `Accept-Language: en` or `ar`.
6. Optional telemetry: `X-Client: android|ios`, `X-App-Version`, `X-Device-Id`.

Token abilities are portal-scoped (`control` / `institution` / `learner`). V1 has **no refresh token** — on 401, re-authenticate.

---

## 4. Portal → mobile surface map

| Mobile persona | Login | Primary prefix |
| --- | --- | --- |
| Student | `POST /auth/student/login` | `/learner/student/*`, `/learner/*` |
| Parent | `POST /auth/parent/login` | `/learner/parent/*` |
| Teacher / Tutor | `POST /auth/teacher/login` | `/org/*` (RBAC filtered) |
| School admin | `POST /auth/teacher/login` | `/org/*` |
| Tenant owner | `POST /auth/admin/login` | `/control/*` |

Deep links should include tenant slug: `stemora://{slug}/student/...`.

---

## 5. Response conventions

**Success:** `{ "message"?: string, "data"?: object }`  
**Error:** `{ "message": string, "code"?: string, "errors"?: object }`  
**Pagination:** Laravel length-aware (`page`, `per_page`, max 100).

Treat unknown `code` values as generic failures; known codes include `tenant_not_found`, `tenant_mismatch`, `subscription_inactive`, `forbidden`, `mobile_feature_planned`.

---

## 6. Planned mobile-only endpoints (stubs → 501)

| Method | Path | Status |
| --- | --- | --- |
| `POST` | `/api/v1/mobile/devices` | Planned (push) |
| `DELETE` | `/api/v1/mobile/devices/{id}` | Planned |
| `GET` | `/api/v1/mobile/sync` | Planned (offline delta) |

V1 apps (when built) must use existing notification and list endpoints until these return 2xx.

---

## 7. Capability flags (`GET /meta`)

| Flag | V1 |
| --- | --- |
| `live_tutoring` | true |
| `assessments` | true |
| `parent_portal` | true |
| `in_app_notifications` | true |
| `push_notifications` | false |
| `offline_sync` | false |
| `biometric_login_hint` | true (client-side only) |

Mobile builds should gate UI on these flags + subscription modules from tenant context.

---

## 8. Security notes for native clients

- Store tokens in platform secure storage (Keychain / Keystore), never logs.
- Certificate pinning optional for production; TLS required.
- Do not embed Super Admin credentials in mobile builds.
- Parent APIs must only request linked children; server enforces `ChildAccessService`.
- Rate-limit login on client after repeated 422/401.

---

## 9. Suggested native backlog (post-V1)

1. Implement OpenAPI client generation from `openapi-v1.yaml`.
2. Ship student + parent apps first; teacher tablet later.
3. Implement `/mobile/devices` + FCM/APNs.
4. Add refresh tokens if session length becomes a UX issue.
5. Optional `/mobile/sync` with cursor per resource type.
