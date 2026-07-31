# Phase 13 — Student Portal

## K-12 STEM & Tutoring Platform

| Field | Value |
| --- | --- |
| **Status** | Implemented |
| **Date** | 29 July 2026 |
| **Base path** | `/api/v1/learner/student/*` |

---

## Modules

| Feature | Endpoint | Notes |
| --- | --- | --- |
| Dashboard | `GET /student/dashboard` | Stats + upcoming tutoring + recent progress |
| Courses | `GET /student/courses` | Subjects with lesson completion % |
| Lessons | `GET /student/lessons` | Assigned published lessons + progress |
| Homework | `GET /student/homework` | Assignments + own submission |
| Assessments | `GET /student/assessments` | Published assessments + attempts |
| Progress | `GET /student/progress` | Learning + graded attempts summary |
| Certificates | `GET /student/certificates` | Active certificates |
| Notifications | `GET /student/notifications` | In-app inbox; mark read / read-all |

Existing action APIs remain under `/learner/lessons`, `/homework`, `/assessments`, etc.

Permissions: student role (`progress.view_own`, `learning.content.consume`, `assessments.attempt`).

Issue certificates from Institution: `POST /org/certificates`.

---

## Domain

- `StudentPortalService`
- `Certificate` + `CertificateService`
- `PortalNotificationService` + `TenantDatabaseNotification`
