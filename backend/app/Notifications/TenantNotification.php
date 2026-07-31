<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

abstract class TenantNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly ?int $tenantId = null,
        public readonly string $locale = 'en',
    ) {
        $this->onQueue('mail');
        $this->locale($locale);
    }

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    protected function brandedMail(): MailMessage
    {
        return (new MailMessage)
            ->greeting($this->locale === 'ar' ? 'مرحباً' : 'Hello');
    }
}
