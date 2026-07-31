<?php

namespace App\Domain\Notification\Listeners;

use App\Domain\Tutoring\Events\TutoringSessionBooked;
use App\Jobs\Default\SendDomainNotificationJob;

class SendTutoringSessionBookedNotifications
{
    public function handle(TutoringSessionBooked $event): void
    {
        SendDomainNotificationJob::dispatch(
            tenantId: $event->tenantId,
            schoolId: $event->schoolId,
            actorId: $event->actorId,
            eventType: 'tutoring.session_booked',
            payload: ['session_id' => $event->sessionId],
        );
    }
}
