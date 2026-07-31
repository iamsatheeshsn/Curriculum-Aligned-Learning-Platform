# Tutor Guide

## Sign in

Same Institution portal as teachers (`/auth/teacher/login`) with tutor role.

## Setup

1. Complete **tutor profile** (`/org/tutors`).
2. Set **availability** and open **slots**.
3. Accept bookings from students/parents via Learner tutoring APIs.

## Live session flow

| Step | Action |
| --- | --- |
| Before | Confirm reminder notification; open classroom URL |
| During | Mark attendance; keep bilingual notes if needed |
| After | Complete session; ratings appear on your profile |
| Payout | School finance creates tutor payment → marked paid |

Endpoints: `/org/tutoring-sessions/{id}/classroom|attendance|notes|complete|cancel`.

## Tips

- Cancel early so `tutoring.session_cancelled` notifies families.
- Keep slot capacity realistic to avoid no-shows.
- Use Arabic or English consistently with the student’s preference (`Accept-Language` / profile locale).
