<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;

class TutoringSessionBookedNotification extends TenantNotification
{
    public function __construct(
        ?int $tenantId = null,
        string $locale = 'en',
        public readonly int $sessionId = 0,
        public readonly string $subjectName = '',
        public readonly string $startsAt = '',
    ) {
        parent::__construct($tenantId, $locale);
    }

    public function toMail(object $notifiable): MailMessage
    {
        $subject = $this->locale === 'ar'
            ? 'تم حجز جلسة التدريس'
            : 'Tutoring session booked';

        return $this->brandedMail()
            ->subject($subject)
            ->line($this->locale === 'ar'
                ? "المادة: {$this->subjectName}"
                : "Subject: {$this->subjectName}")
            ->line($this->locale === 'ar'
                ? "الوقت: {$this->startsAt}"
                : "When: {$this->startsAt}");
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'tutoring.session_booked',
            'session_id' => $this->sessionId,
            'subject' => $this->subjectName,
            'starts_at' => $this->startsAt,
            'tenant_id' => $this->tenantId,
        ];
    }
}
