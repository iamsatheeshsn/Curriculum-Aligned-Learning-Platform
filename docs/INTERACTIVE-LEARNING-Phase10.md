# Phase 10 — Interactive Learning Module

## K-12 STEM & Tutoring Platform

| Field | Value |
| --- | --- |
| **Status** | Implemented |
| **Date** | 29 July 2026 |
| **Institution** | `/api/v1/org/*` |
| **Learner** | `/api/v1/learner/*` |

---

## 1. Modules Delivered

| Feature | Storage | Notes |
| --- | --- | --- |
| Lesson Viewer | `interactive_lessons` + `lesson_blocks` | Author in org; play/resume in learner |
| Interactive Activities | `lesson_blocks` (`activity`, `check`, `virtual_lab`) | Listed via `/org/activities` |
| STEM Simulations | `media_assets` (`mime=application/x-simulation`) + `simulation` blocks | Register + embed |
| Practice Exercises | In-lesson `check` blocks; full practice via Phase 11 `type=practice` | — |
| Homework | `assignments` + `assignment_submissions` | Separate from quiz homework |
| Resource Library | `media_assets` | video/pdf/image/audio/other |
| Progress | `learning_progress` | Start/resume/complete |

---

## 2. Institution API

Permissions: `learning.content.manage` / `assign` (grade homework uses `assessments.grade`).

| Method | Path |
| --- | --- |
| CRUD | `/org/resources` |
| POST/GET | `/org/simulations` |
| GET | `/org/activities` |
| CRUD + blocks | `/org/interactive-lessons`… |
| POST | `/org/interactive-lessons/{id}/publish` |
| POST | `/org/interactive-lessons/{id}/assign` |
| CRUD-ish | `/org/homework`… |
| POST | `/org/homework/{id}/submissions/{sid}/review` |

**Block types:** `text`, `video`, `pdf`, `simulation`, `virtual_lab`, `embed`, `check`, `activity`

**Completion rules:** `view_all`, `pass_checks`

---

## 3. Learner API

Permissions: `learning.content.consume`, `progress.view_own`

| Method | Path |
| --- | --- |
| GET | `/learner/lessons` |
| GET | `/learner/lessons/{id}` (viewer + progress start) |
| POST | `/learner/lessons/{id}/progress` |
| GET/POST | `/learner/homework`, `/learner/homework/{id}/submit` |
| GET | `/learner/progress` |

---

## 4. Domain

| Piece | Path |
| --- | --- |
| Models | `app/Domain/Learning/Models/*` |
| Lesson service | `InteractiveLessonService` |
| Controllers | Institution `InteractiveLessonController`, `ResourceLibraryController`, `HomeworkController`; Learner `LessonViewerController`, `LearnerHomeworkController` |
