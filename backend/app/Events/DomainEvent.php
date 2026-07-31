<?php

namespace App\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

abstract class DomainEvent
{
    use Dispatchable;
    use SerializesModels;

    public function __construct(
        public readonly ?int $tenantId = null,
        public readonly ?int $schoolId = null,
        public readonly ?int $actorId = null,
    ) {}
}
