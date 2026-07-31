# Phase 17 — Billing & Subscription

## K-12 STEM & Tutoring Platform

| Field | Value |
| --- | --- |
| **Status** | Implemented |
| **Date** | 29 July 2026 |
| **SQL** | `docs/sql/learning_platform_billing_notify_phase15_17.sql` |
| **Base** | `/api/v1/org/billing/*` (+ Phase 6 `/control/subscription/*`) |

---

## Modules

| Feature | Storage / API |
| --- | --- |
| Subscription plans | Existing `subscription_plans` · `GET /billing/plans` |
| School billing | `invoices` + `invoice_items` + `payments` |
| Student billing | `student_invoices` + items · fee reminder notification |
| Tutor payments | `tutor_payments` |
| Invoice generation | `InvoiceService` (manual lines or from plan) |

## APIs

| Method | Path |
| --- | --- |
| GET | `/billing/plans` |
| GET/POST | `/billing/invoices` |
| POST | `/billing/invoices/{id}/send` |
| POST | `/billing/invoices/{id}/payments` |
| GET/POST | `/billing/student-invoices` |
| GET/POST | `/billing/tutor-payments` |
| POST | `/billing/tutor-payments/{id}/mark-paid` |

Permissions: `tenant.billing.view` / `tenant.billing.manage`.
