# Phase 15 — Reports & Analytics

## K-12 STEM & Tutoring Platform

| Field | Value |
| --- | --- |
| **Status** | Implemented |
| **Date** | 29 July 2026 |
| **Base path** | `/api/v1/org/reports/*` |

---

## Reports

| Report | Endpoint | Permission |
| --- | --- | --- |
| Student | `GET /reports/student?student_user_id=` | `reports.academic.view` |
| Teacher / class | `GET /reports/teacher?subject_id=` | academic |
| Tutor performance | `GET /reports/tutor-performance` | `reports.tutor.view` |
| School analytics | `GET /reports/school` | `school.reports.view` |
| Curriculum completion | `GET /reports/curriculum-completion` | academic |
| Learning outcomes | `GET /reports/learning-outcomes` | academic |

Service: `AnalyticsReportService`

Docs companion phases: 16 Notification, 17 Billing.
