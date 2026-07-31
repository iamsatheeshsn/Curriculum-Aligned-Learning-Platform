# Phase 14 — Parent Portal

## K-12 STEM & Tutoring Platform

| Field | Value |
| --- | --- |
| **Status** | Implemented |
| **Date** | 29 July 2026 |
| **Base path** | `/api/v1/learner/parent/*` |

---

## Modules

| Feature | Endpoint | Permission |
| --- | --- | --- |
| Dashboard | `GET /parent/dashboard` | `progress.view_child` |
| Children | `GET /parent/children` | view_child |
| Student Progress | `GET /parent/children/{id}/progress` | view_child |
| Attendance | `GET /parent/children/{id}/attendance` | `tutoring.attendance.view_child` |
| Homework | `GET /parent/children/{id}/homework` | `homework.view_child` |
| Assessment Results | `GET /parent/children/{id}/assessments` | `assessments.results.view_child` |
| Tutor Sessions | `GET /parent/children/{id}/tutoring` | book / attendance.view_child |
| Notifications | `GET /parent/notifications` | view_child |

Child access is enforced via `parent_student_links` (`ChildAccessService`).

Staff create links: `POST /org/parent-links`.

Parents book tutoring via existing `/learner/tutoring/book`.

---

## Domain

- `ParentPortalService`
- `ParentStudentLink` + `ChildAccessService`
