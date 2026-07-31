# Phase 12 — Live Tutoring Module

## K-12 STEM & Tutoring Platform

| Field | Value |
| --- | --- |
| **Status** | Implemented |
| **Date** | 29 July 2026 |
| **Institution** | `/api/v1/org/*` |
| **Learner** | `/api/v1/learner/*` |
| **SQL** | `docs/sql/learning_platform_tutoring_phase12.sql` (ratings table) |

---

## 1. Modules Delivered

| Feature | Storage | Notes |
| --- | --- | --- |
| Tutor Profiles | `tutor_profiles` + `tutor_subjects` | Bio AR/EN, subjects + languages, avg rating |
| Availability | `tutor_availabilities` + exceptions | Weekly slots + date overrides; open-slot calc |
| Session Booking | `tutoring_sessions` + participants | Overlap check; fires `TutoringSessionBooked` |
| Virtual Classroom | `meeting_provider` / `meeting_url` / `meeting_external_id` | Local provider abstraction (`config/tutoring.php`) |
| Attendance | `tutoring_attendance` | present/absent/late/excused |
| Ratings & Feedback | `tutoring_session_ratings` | 1–5 + bilingual feedback after complete |
| Session notes | `session_notes` | Optional tutor notes / parent-visible |

---

## 2. Institution API

| Method | Path | Permission |
| --- | --- | --- |
| GET/POST | `/org/tutors` | `tutoring.manage` |
| GET/PUT | `/org/tutors/{id}` | manage / view |
| GET/POST | `/org/tutors/{id}/availability` | `availability.manage` or manage |
| POST | `/org/tutors/{id}/availability/exceptions` | same |
| GET | `/org/tutors/{id}/slots?date=` | book or manage |
| GET | `/org/tutors/{id}/ratings` | manage |
| GET/POST | `/org/tutoring-sessions` | manage/conduct · book/manage |
| GET | `/org/tutoring-sessions/{id}/classroom` | join/conduct/manage |
| POST | `…/cancel`, `…/complete`, `…/attendance`, `…/notes` | book · conduct · attendance.manage |

`tutoring.manage` may book and set availability (school staff).

---

## 3. Learner API

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/learner/tutors` | book or join |
| GET | `/learner/tutors/{id}/slots` | book or join |
| POST | `/learner/tutoring/book` | `tutoring.book` (parent) |
| GET | `/learner/tutoring/sessions` | join or book |
| GET | `/learner/tutoring/sessions/{id}/join` | `tutoring.join` |
| POST | `/learner/tutoring/sessions/{id}/rate` | join (after completed) |
| GET | `/learner/tutoring/attendance` | join / view_child |

---

## 4. Virtual classroom

`MeetingProviderService` provisions a local join URL:

`{APP_URL}/classroom/{external_id}`

Swap provider via `TUTORING_MEETING_PROVIDER` without changing booking flow.

---

## 5. Domain

| Piece | Path |
| --- | --- |
| Models | `app/Domain/Tutoring/Models/*` |
| Services | `TutorProfileService`, `AvailabilityService`, `BookingService`, `MeetingProviderService`, `AttendanceService`, `RatingService` |
| Controllers | Institution `TutorProfileController`, `TutorAvailabilityController`, `TutoringSessionController`; Learner `LearnerTutoringController` |
