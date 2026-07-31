# School Administrator Guide

## Who this is for

School Admin, Campus Admin, Principal, Academic Coordinator, Finance Manager — **Institution portal**.

## Sign in

1. Open Institution portal (`http://localhost:5175` locally).
2. Enter tenant slug (e.g. `al-noor`), work email, password.
3. API: `POST /api/v1/auth/teacher/login` with `tenant_slug`.

## Typical tasks

| Task | Where / API |
| --- | --- |
| Schools & campuses | `/org/schools`, `/org/campuses` |
| Grades, classes, sections | `/org/grades`, `/org/classes`, `/org/sections` |
| Academic year & calendar | `/org/academic-years`, `/org/calendar-events` |
| Curriculum publish | `/org/curricula/.../publish` |
| Timetable | `/org/timetables` |
| Reports | `/org/reports/*` |
| Parent–student links | `/org/parent-links` |
| Certificates | `/org/certificates` |
| Student invoices / tutor pay | `/org/billing/student-invoices`, `/org/billing/tutor-payments` |
| Notifications dispatch | `/org/notifications/dispatch` |

## Best practices

- Keep `X-School-ID` set when working in multi-campus tenants.
- Publish curriculum versions before teachers assign lessons.
- Review tutor payouts weekly; mark paid with a bank reference.
- Use reports before parent evenings: curriculum completion + learning outcomes.

## Branding & billing (tenant owner)

Tenant owners also use the **Control portal** for subscription plan and school invoices (`/control/subscription/*`, `/org/billing/invoices`).
