# Phase 6 — Authentication & SaaS Foundation

## K-12 STEM & Tutoring Platform

| Field | Value |
| --- | --- |
| **Status** | Implemented |
| **Date** | 29 July 2026 |
| **Auth** | Laravel Sanctum (Bearer tokens) |
| **DB** | `learning_platform` |

---

## 1. Capabilities Delivered

| Feature | Endpoint / Mechanism |
| --- | --- |
| School Registration | `POST /api/v1/auth/register/school` |
| Admin Login (Super Admin + Tenant Owner) | `POST /api/v1/auth/admin/login` |
| Teacher Login (Institution staff) | `POST /api/v1/auth/teacher/login` |
| Student Login | `POST /api/v1/auth/student/login` |
| Parent Login | `POST /api/v1/auth/parent/login` |
| Tenant Isolation | `tenant.isolation` middleware |
| Subscription Management | `/api/v1/control/subscription/*` |
| Email Verification | signed `GET /api/v1/auth/email/verify/{id}/{hash}` + resend |
| Forgot Password | `POST /api/v1/auth/forgot-password` |
| Reset Password | `POST /api/v1/auth/reset-password` |
| Change Password | `POST /api/v1/auth/change-password` |

Also: `GET /api/v1/auth/me`, `POST /api/v1/auth/logout`

---

## 2. Portal Mapping

| Login API | Portal | Allowed roles | Tenant slug |
| --- | --- | --- | --- |
| Admin | Control | `super_admin`, `tenant_owner` | No |
| Teacher | Institution | `school_admin`, `campus_admin`, `academic_coordinator`, `teacher`, `tutor` | **Required** |
| Student | Learner | `student` | **Required** |
| Parent | Learner | `parent` | **Required** |

Institution/Learner requests should send `X-Tenant-Slug` (and login body `tenant_slug`).

---

## 3. School Registration Flow

Creates in one transaction:

1. Tenant (`status=trial`, unique `slug`)
2. Branding row
3. Active `TenantSubscription` (default plan `starter`)
4. Tenant Owner user + `tenant_owner` role
5. Primary School
6. Sanctum token + email verification notification

**Sample body**

```json
{
  "organization_name": "Al Noor Schools",
  "slug": "al-noor",
  "country_code": "SA",
  "email": "owner@school.test",
  "password": "Password!123",
  "password_confirmation": "Password!123",
  "first_name": "Omar",
  "last_name": "Hassan",
  "school_name": "Al Noor Riyadh",
  "locale": "ar",
  "plan_code": "starter"
}
```

---

## 4. Tenant Isolation

Middleware `EnsureTenantIsolation` (`tenant.isolation`):

- Blocks cross-tenant access for non–super-admin users
- Binds `TenantContext` from authenticated user when missing
- Rejects suspended/closed tenants
- Super Admin may use `X-Tenant-ID` (via `InitializeTenancy`)

Institution/Learner route groups also use `subscription.active` (HTTP 402 when inactive/expired).

---

## 5. Subscription Management

| Method | Path | Access |
| --- | --- | --- |
| GET | `/api/v1/control/subscription/plans` | Public catalog |
| GET | `/api/v1/control/subscription/current` | Auth + isolation |
| POST | `/api/v1/control/subscription/change-plan` | `super_admin` or `tenant_owner` |

Body for change: `{ "plan_code": "growth", "tenant_id": optional for super admin }`

---

## 6. Password & Email

- **Forgot / Reset:** Laravel password broker + bilingual `ResetPasswordNotification`
- **Change:** Requires current password; revokes other tokens
- **Verify:** Signed API URL; resend via authenticated endpoint
- Emails use `MAIL_MAILER=log` locally (check `storage/logs`)

---

## 7. Seeded Super Admin

| Field | Value |
| --- | --- |
| Email | `superadmin@learning-platform.local` |
| Password | `ChangeMe!123` |
| Role | `super_admin` |

Seeder: `php artisan db:seed --class=SuperAdminSeeder`

---

## 8. Key Classes

- `AuthService`, `SchoolRegistrationService`, `SubscriptionService`
- `AuthController`, `SubscriptionController`
- Middleware: `EnsureTenantIsolation`, `EnsureActiveSubscription`, `EnsurePortalRoles`
- Notifications: `VerifyEmailNotification`, `ResetPasswordNotification`

---

## 9. Notes

- V1 emails are **globally unique** (simplifies password reset).
- Teacher/Student/Parent users must be provisioned under a tenant (Institution admin flows in later phases).
- Change default Super Admin password before any shared environment.

---

**End of Phase 6**
