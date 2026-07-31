<?php

namespace App\Domain\Tutoring\Events;

use App\Events\DomainEvent;

class TutoringSessionBooked extends DomainEvent
{
    public function __construct(
        public readonly int $sessionId,
        ?int $tenantId = null,
        ?int $schoolId = null,
        ?int $actorId = null,
    ) {
        parent::__construct($tenantId, $schoolId, $actorId);
    }
}
