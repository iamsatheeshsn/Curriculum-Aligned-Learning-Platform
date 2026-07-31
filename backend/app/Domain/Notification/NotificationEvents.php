<?php

namespace App\Domain\Notification;

final class NotificationEvents
{
    public const NEW_ASSIGNMENT = 'learning.assignment_new';
    public const HOMEWORK_DUE = 'learning.homework_due';
    public const QUIZ_SCHEDULED = 'assessment.quiz_scheduled';
    public const TUTOR_SESSION_REMINDER = 'tutoring.session_reminder';
    public const SESSION_CANCELLATION = 'tutoring.session_cancelled';
    public const PROGRESS_REPORT = 'reports.progress';
    public const FEE_REMINDER = 'billing.fee_reminder';
    public const CERTIFICATE_ISSUED = 'certificate.issued';
    public const SESSION_BOOKED = 'tutoring.session_booked';

    /** @return list<string> */
    public static function all(): array
    {
        return [
            self::NEW_ASSIGNMENT,
            self::HOMEWORK_DUE,
            self::QUIZ_SCHEDULED,
            self::TUTOR_SESSION_REMINDER,
            self::SESSION_CANCELLATION,
            self::PROGRESS_REPORT,
            self::FEE_REMINDER,
            self::CERTIFICATE_ISSUED,
            self::SESSION_BOOKED,
        ];
    }

    /** @return list<string> */
    public static function defaultChannels(): array
    {
        return ['in_app', 'email', 'sms', 'whatsapp'];
    }

    /** Channels that must not be fully disabled for security-critical events (optional policy). */
    public static function isCritical(string $event): bool
    {
        return in_array($event, [self::SESSION_CANCELLATION, self::FEE_REMINDER], true);
    }
}
