# Teacher Guide

## Sign in

Institution portal → tenant slug + teacher credentials  
`POST /api/v1/auth/teacher/login`

## Daily workflow

1. **Classes** — confirm sections and timetable slots.
2. **Lessons** — interactive lessons and resources under `/org/interactive-lessons`, `/org/resources`.
3. **Homework** — create via `/org/homework`; students submit on Learner portal.
4. **Assessments** — question bank + quizzes/exams `/org/question-bank`, `/org/assessments`.
5. **Grading** — `/org/grading/queue` for manual items; objective items auto-grade.
6. **Progress** — `/org/progress` and teacher report `/org/reports/teacher`.

## Notifications

Students get in-app (and email if enabled) for new assignments, homework due, and quiz scheduled. Prefer publishing with clear due dates.

## Dual role

If you are also a tutor, manage availability under Tutoring (see Tutor Guide) in the same Institution portal.
