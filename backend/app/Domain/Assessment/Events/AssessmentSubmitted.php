<?php

namespace App\Domain\Assessment\Events;

use App\Events\DomainEvent;

class AssessmentSubmitted extends DomainEvent
{
    public function __construct(
        public readonly int $attemptId,
        ?int $tenantId = null,
        ?int $schoolId = null,
        ?int $actorId = null,
    ) {
        parent::__construct($tenantId, $schoolId, $actorId);
    }
}
