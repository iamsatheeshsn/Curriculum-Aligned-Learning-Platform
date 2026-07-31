# Phase 11 — Assessment Engine

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
| Question Bank | `questions`, `question_translations`, `question_options`, `question_outcomes` | MCQ, multi, boolean, numeric, short_text |
| Quiz Builder | `assessments` `type=quiz` + `assessment_questions` | Shuffle, timer, multi-attempt |
| Exams | `type=exam` | Default 1 attempt; availability window |
| Homework (scored) | `type=homework` | Complements Phase 10 `assignments` |
| Practice Exercises | `type=practice` | `counts_toward_grade=false` by default |
| Auto-Grading | `GradingService` | Objective types on submit |
| Manual Review | queue + grade response | `short_text` → `submitted` until graded |
| Progress Tracking | attempts + `/org/progress` | Class view; learner own results |

---

## 2. Institution API

| Method | Path | Permission |
| --- | --- | --- |
| GET/POST | `/org/question-bank` | `assessments.manage` |
| GET | `/org/question-bank/{id}` | manage |
| GET/POST | `/org/assessments` | manage |
| GET | `/org/assessments/{id}` | manage |
| POST | `/org/assessments/{id}/questions` | manage |
| POST | `/org/assessments/{id}/publish` | manage |
| GET | `/org/grading/queue` | `assessments.grade` |
| POST | `/org/grading/responses/{id}` | grade |
| GET | `/org/progress` | `progress.view_class` |

---

## 3. Learner API

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/learner/assessments` | `assessments.attempt` |
| POST | `/learner/assessments/{id}/start` | attempt |
| POST | `/learner/attempts/{id}/submit` | attempt |
| GET | `/learner/results` | `assessments.results.view_own` |

Correct option flags are stripped from student start payload.

---

## 4. Grading flow

1. Student starts attempt → `in_progress`
2. Submit answers → auto-grade objective items
3. If any `short_text` unanswered for points → attempt `submitted`, appears in grading queue
4. Teacher posts points → when all responses graded, attempt → `graded`

---

## 5. Domain

| Piece | Path |
| --- | --- |
| Models | `app/Domain/Assessment/Models/*` |
| Services | `QuestionBankService`, `AssessmentBuilderService`, `GradingService` |
| Controllers | Institution `QuestionBankController`, `AssessmentController`, `GradingController`; Learner `LearnerAssessmentController` |
