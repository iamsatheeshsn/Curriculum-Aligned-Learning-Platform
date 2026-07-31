# Phase 5 — Laravel Backend Foundation

## K-12 STEM & Tutoring Platform

| Field | Value |
| --- | --- |
| **Document Title** | Laravel Backend Foundation |
| **Version** | 1.0 |
| **Status** | Implemented (Foundation) |
| **Date** | 29 July 2026 |
| **Location** | `backend/` |
| **Stack** | Laravel 12 · PHP 8.2+ · Sanctum · MySQL `learning_platform` |

---

## 1. Objectives

Establish a maintainable Laravel backend foundation with:

- Repository Pattern
- Service Layer
- Policies (RBAC)
- Domain Events + Listeners
- Model Observers
- Queues (priority lanes)
- Notifications (mail + database)
- Multi-tenant context middleware
- API route skeleton for Control / Institution / Learner

---

## 2. Folder Structure

```
backend/
├── app/
│   ├── Contracts/
│   │   ├── Repositories/RepositoryInterface.php
│   │   └── Services/ServiceInterface.php
│   ├── Domain/
│   │   ├── Identity/       Models, Repositories, Services, Events, Policies, Observers
│   │   ├── Organization/   Tenants, Schools, …
│   │   ├── Academics/
│   │   ├── Learning/
│   │   ├── Assessment/
│   │   ├── Tutoring/
│   │   ├── Billing/
│   │   ├── Notification/   Listeners bridging domain → jobs/notifications
│   │   └── Reporting/
│   ├── Events/DomainEvent.php
│   ├── Http/
│   │   ├── Controllers/Api/V1/{Auth,Control,Institution,Learner}/
│   │   ├── Middleware/{InitializeTenancy,SetLocale}.php
│   │   ├── Requests/
│   │   └── Resources/
│   ├── Jobs/
│   │   ├── TenantAwareJob.php
│   │   ├── High/
│   │   ├── Default/
│   │   ├── Low/
│   │   └── Mail/
│   ├── Listeners/
│   ├── Models/User.php
│   ├── Notifications/
│   ├── Observers/
│   ├── Policies/
│   ├── Providers/{AppServiceProvider,AuthServiceProvider}.php
│   ├── Repositories/Eloquent/BaseRepository.php
│   ├── Services/BaseService.php
│   └── Support/
│       ├── TenantContext.php
│       └── Traits/{BelongsToTenant,HasAuditColumns}.php
├── routes/
│   ├── api.php
│   └── api/{auth,control,institution,learner}.php
├── lang/{en,ar}/
└── storage/app/tenants/
```

---

## 3. Pattern Guide

### 3.1 Repository Pattern

| Piece | Role |
| --- | --- |
| `RepositoryInterface` | Contract for CRUD + paginate |
| `BaseRepository` | Eloquent implementation |
| Domain `*Repository` | Filters, slug lookups, scoped queries |

**Flow:** Controller → Service → Repository → Model/DB

### 3.2 Service Layer

| Piece | Role |
| --- | --- |
| `BaseService` | Transactions + TenantContext helpers |
| Domain `*Service` | Business rules, emits events |

Example: `TenantService::create()` persists via `TenantRepository` and fires `TenantCreated`.

### 3.3 Policies

| Piece | Role |
| --- | --- |
| `AuthServiceProvider` | Maps models → policies |
| `TenantPolicy` | Super Admin / Tenant Owner rules |

Authorize in controllers: `$this->authorize('update', $tenant)`.

### 3.4 Events

| Event | Purpose |
| --- | --- |
| `DomainEvent` | Base with tenant/school/actor |
| `TenantCreated` | SaaS onboarding side effects |
| `TutoringSessionBooked` | Notification pipeline |
| `AssessmentSubmitted` | Scoring / notify |

### 3.5 Observers

| Observer | Model | Notes |
| --- | --- | --- |
| `TenantObserver` | `Tenant` | Audit-style logging on create/update/delete |

Register in `AppServiceProvider::boot()`.

### 3.6 Queues

| Queue | Job examples |
| --- | --- |
| `high` | Reminders, password reset |
| `default` | Domain notification fan-out |
| `low` | CSV imports, exports |
| `mail` | Outbound email |

All extend `TenantAwareJob` and re-bind `TenantContext` in `handle()`.

`.env`: `QUEUE_CONNECTION=database` (Redis later).

Workers:

```bash
php artisan queue:work --queue=high,default,mail,low
```

### 3.7 Notifications

| Class | Channels |
| --- | --- |
| `TenantNotification` | Base queued mail+database, locale-aware |
| `TutoringSessionBookedNotification` | Example bilingual tutoring alert |

Listeners dispatch jobs rather than sending inline.

---

## 4. Tenancy Middleware

`InitializeTenancy` resolves tenant from:

1. `X-Tenant-Slug` or route `{tenantSlug}` (Institution/Learner)
2. Authenticated user’s `tenant_id` (Tenant Owner)
3. `X-Tenant-ID` for Super Admin (audited at service layer)
4. Optional `X-School-ID`

`BelongsToTenant` global scope filters by `TenantContext`.

---

## 5. API Surface (Foundation)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/health` | App + DB health |
| GET | `/api/v1/tenants/by-slug/{slug}` | Portal bootstrap |
| * | `/api/v1/auth/*` | Stubs (501 until auth phase) |
| * | `/api/v1/control/*` | Control portal (auth) |
| * | `/api/v1/org/*` | Institution |
| * | `/api/v1/learner/*` | Learner |

---

## 6. Database Wiring

| Setting | Value |
| --- | --- |
| `DB_CONNECTION` | `mysql` |
| `DB_DATABASE` | `learning_platform` |
| Schema source | Phase 4 SQL (already applied) |

Laravel default SQLite migrations from install are **not** the source of truth for production schema. Domain migrations may be added later to mirror Phase 4 for fresh environments.

---

## 7. Sample Domain Slice (Organization)

Implemented as the reference pattern:

- Model: `Tenant`, `School`
- Repository: `TenantRepository`
- Service: `TenantService`
- Policy: `TenantPolicy`
- Event: `TenantCreated`
- Observer: `TenantObserver`

Other domains have folder skeletons ready for the same pattern.

---

## 8. Next Implementation Steps

1. Auth endpoints (Sanctum login/logout/me) + role guards per portal  
2. Eloquent models for remaining Phase 4 tables  
3. Fill Institution/Learner/Control controllers  
4. Wire tutoring booking end-to-end through events → jobs → notifications  
5. Isolation feature tests  

---

**End of Phase 5 Foundation Document**
