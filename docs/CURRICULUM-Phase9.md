# Phase 9 — Curriculum Management

## K-12 STEM & Tutoring Platform

| Field | Value |
| --- | --- |
| **Status** | Implemented |
| **Date** | 29 July 2026 |
| **Base path** | `/api/v1/org/*` |
| **SQL** | `docs/sql/learning_platform_curriculum_phase9.sql` |

---

## 1. Modules Delivered

| Module | Storage | Notes |
| --- | --- | --- |
| Curriculum | `curricula` | Draft / in_review / published / superseded; `is_latest`, `version` |
| Grade Levels | `grades` | Reused from Phase 8; also `GET /org/curriculum/grade-levels` |
| Subjects | `subjects` | Scoped by `curriculum_id` under a curriculum version |
| Chapters | `chapters` | Subject + grade + sequence within a curriculum |
| Lessons | `curriculum_lessons` | Nested under chapters; link LOs via pivot |
| Learning Outcomes | `learning_outcomes` | Curriculum-scoped statements |
| Versioning | `curriculum_version_logs` + clone | Publish + deep-clone new draft version |

**Edit rule:** only `draft` / `in_review` curricula can be mutated. Published trees are read-only; create a new version to change content.

---

## 2. API Map

All require `auth:sanctum` + `tenant.isolation` + `subscription.active`.  
Pass `school_id` query/body or header `X-School-ID` when needed.  
Permissions: `curriculum.view` / `curriculum.manage`.

### Curriculum
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/org/curricula` | Filters: `code`, `status`, `latest_only` |
| POST | `/org/curricula` | Creates draft v1 (or given `version`) |
| GET | `/org/curricula/{id}` | Full detail + nested relations |
| PUT | `/org/curricula/{id}` | Editable statuses only |
| GET | `/org/curricula/{id}/tree` | Subjects, chapters, lessons, LOs |
| POST | `/org/curricula/{id}/publish` | Marks published + logs |
| POST | `/org/curricula/{id}/new-version` | Deep clone → new draft |
| GET | `/org/curricula/{id}/versions` | Sibling versions + logs |

### Grade levels
| Method | Path |
| --- | --- |
| GET | `/org/curriculum/grade-levels` |
| GET/POST | `/org/grades` (Phase 8) |

### Subjects / Chapters / Lessons / Outcomes
| Method | Path |
| --- | --- |
| POST | `/org/curricula/{id}/subjects` |
| POST | `/org/curricula/{id}/chapters` |
| PUT | `/org/curricula/{id}/chapters/{chapter}` |
| POST | `/org/curricula/{id}/chapters/{chapter}/lessons` |
| PUT | `/org/curricula/{id}/chapters/{chapter}/lessons/{lesson}` |
| POST | `/org/curricula/{id}/learning-outcomes` |
| PUT | `/org/curricula/{id}/learning-outcomes/{outcome}` |

Lesson create/update accepts `learning_outcome_ids[]` (synced to `lesson_learning_outcomes`).

School-level subjects from Phase 8 remain at `/org/subjects` (optional `curriculum_id` filter).

---

## 3. Versioning Flow

1. **Create** curriculum → `status=draft`, `is_latest=true`
2. Add subjects → outcomes → chapters → lessons (link LOs)
3. **Publish** → `status=published`, `published_at` set; tree becomes read-only
4. **New version** (`version` required) → deep-clones subjects/chapters/lessons/LOs/pivots into a new draft; prior published row → `superseded`; new row is `is_latest`
5. Edit the new draft; publish again when ready

`CurriculumVersioningService` owns publish + clone. Every create/publish/version action writes `curriculum_version_logs`.

---

## 4. Domain

| Piece | Path |
| --- | --- |
| Models | `app/Domain/Curriculum/Models/*` |
| Versioning | `app/Domain/Curriculum/Services/CurriculumVersioningService.php` |
| API | `app/Http/Controllers/Api/V1/Institution/CurriculumController.php` |

---

## 5. Acceptance

- [x] Curriculum CRUD with draft/publish lifecycle  
- [x] Grade levels accessible for curriculum authors  
- [x] Subjects, chapters, lessons, learning outcomes under a curriculum  
- [x] Lesson ↔ outcome linking  
- [x] Immutable published versions + clone-based updates  
- [x] Version history + audit log rows  
