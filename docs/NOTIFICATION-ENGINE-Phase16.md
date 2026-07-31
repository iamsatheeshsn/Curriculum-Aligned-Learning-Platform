# Phase 16 — Notification Engine

## K-12 STEM & Tutoring Platform

| Field | Value |
| --- | --- |
| **Status** | Implemented |
| **Date** | 29 July 2026 |
| **Config** | `config/notifications.php` |

---

## Channels

| Channel | Status |
| --- | --- |
| In-App | Live (`notifications` table via `PortalNotificationService`) |
| Email | Live (log driver by default; set `NOTIFICATION_EMAIL_DRIVER=mail`) |
| SMS | Optional stub (`NOTIFICATION_SMS_ENABLED=true`) |
| WhatsApp | Optional stub (`NOTIFICATION_WHATSAPP_ENABLED=true`) |

## Events

- `learning.assignment_new`
- `learning.homework_due`
- `assessment.quiz_scheduled`
- `tutoring.session_reminder`
- `tutoring.session_cancelled`
- `reports.progress`
- `billing.fee_reminder`
- (+ `certificate.issued`, `tutoring.session_booked`)

## APIs

| Method | Path |
| --- | --- |
| GET | `/org/notifications/events` |
| POST | `/org/notifications/dispatch` |
| GET/PUT | `/org/notifications/preferences` |

Preferences stored in `notification_preferences`. Dispatches logged to `mail_logs` + `notification_dispatch_logs`.

`SendDomainNotificationJob` now fans out via `NotificationDispatcher` when `user_id` / `user_ids` are in the payload.
