# Phase 7 — Roles & Permissions (RBAC)

## K-12 STEM & Tutoring Platform

| Field | Value |
| --- | --- |
| **Status** | Implemented |
| **Date** | 29 July 2026 |
| **Config** | `backend/config/rbac.php` |
| **SQL** | `docs/sql/learning_platform_rbac_phase7.sql` |
| **Seeder** | `php artisan db:seed --class=RbacSeeder` |

---

## 1. Roles

| Code | Name | Portal | Level |
| --- | --- | --- | --- |
| `super_admin` | Super Admin | control | 100 |
| `school_owner` | School Owner | control | 90 |
| `customer_support` | Customer Support | control | 85 |
| `auditor` | Auditor | control | 80 |
| `school_admin` | School Administrator | institution | 80 |
| `principal` | Principal | institution | 78 |
| `campus_admin` | Campus Administrator | institution | 72 |
| `academic_coordinator` | Academic Coordinator | institution | 70 |
| `finance_manager` | Finance Manager | institution | 65 |
| `teacher` | Teacher | institution | 50 |
| `tutor` | Tutor | institution | 50 |
| `parent` | Parent | learner | 20 |
| `student` | Student | learner | 10 |

**Alias:** `tenant_owner` → `school_owner` (Phase 6 compatibility)

---

## 2. Role Hierarchy

```text
super_admin
├── customer_support
└── auditor

school_owner
├── school_admin
├── principal
│   └── academic_coordinator
│       ├── teacher
│       └── tutor
└── finance_manager

parent   (learner — no org parent)
student  (learner — no org parent)
```

Hierarchy informs org design; **enforcement is via explicit `permission_role` grants** (not automatic inheritance).

---

## 3. Permission Matrix (summary)

| Permission group | SA | Owner | SchAdmin | Principal | AcadCoord | Finance | Teacher | Tutor | Student | Parent | Support | Auditor |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Platform tenants/plans | ✓ | | | | | | | | | | | |
| Support / impersonate | ✓ | | | | | | | | | | ✓* | |
| Audit logs | ✓ | ✓ | | | | | | | | | ✓ | ✓ |
| Tenant billing manage | ✓ | ✓ | | | | ✓ | | | | | | |
| Schools / campuses / users | ✓ | ✓ | ✓ | view | view | view | | | | | view | |
| Curriculum manage | ✓ | ✓ | | ✓ | ✓ | | | | | | | |
| Learning assign/manage | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ | | | | | |
| Learning consume | ✓ | | | | | | | | ✓ | | | |
| Assessments manage/grade | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ | | | | | |
| Assessments attempt | ✓ | | | | | | | | ✓ | | | |
| Child results / homework | ✓ | | | | | | | | | ✓ | | |
| Tutoring manage | ✓ | ✓ | ✓ | ✓ | | | | | | | | |
| Tutoring conduct | ✓ | | | | | | ✓ | ✓ | | | | |
| Tutoring book/join | ✓ | | | | | | | | join | book | | |
| Reports (academic/tutor/finance) | ✓ | ✓ | subset | subset | acad | finance | acad | tutor | | | subset | ✓ |

\*Support: limited (`platform.support.access`, view-only scopes). Full matrix in `config/rbac.php`.

---

## 4. Policies

| Policy | Target |
| --- | --- |
| `TenantPolicy` | Tenant CRUD + billing |
| `SchoolPolicy` | School CRUD + manage users |
| `LearningContentPolicy` | manage / assign / consume (Gates) |
| `AssessmentPolicy` | manage / grade / attempt |
| `TutoringPolicy` | manage / conduct / book / join |

`Gate::before`: **Super Admin** bypasses all abilities.

---

## 5. Middleware

| Alias | Class | Usage |
| --- | --- | --- |
| `role:a,b` | `EnsurePortalRoles` | Require any listed role |
| `permission:x,y` | `EnsurePermission` | Require any listed permission |
| `tenant.isolation` | `EnsureTenantIsolation` | Cross-tenant block |
| `subscription.active` | `EnsureActiveSubscription` | Paid/trial gate |

Example:

```php
Route::middleware(['auth:sanctum', 'tenant.isolation', 'permission:tutoring.manage'])
```

---

## 6. Seeders

1. `RbacSeeder` — roles, permissions, matrix, migrates `tenant_owner` → `school_owner`
2. `SuperAdminSeeder` — platform super admin (runs after RBAC)

```bash
php artisan db:seed --class=RbacSeeder
php artisan db:seed --class=SuperAdminSeeder
```

---

## 7. API (Control)

| Method | Path |
| --- | --- |
| GET | `/api/v1/control/rbac/me` |
| GET | `/api/v1/control/rbac/roles` |
| GET | `/api/v1/control/rbac/permissions` |
| GET | `/api/v1/control/rbac/matrix` |

`GET /api/v1/auth/me` also returns `roles` + `permissions`.

---

## 8. Key classes

- `config/rbac.php` — source of truth
- `RbacService` — role/permission checks + cache
- `EnsurePermission` / `EnsurePortalRoles`
- Models: `Role`, `Permission`, `permission_role`

---

**End of Phase 7**
