<?php

namespace App\Domain\Organization\Events;

use App\Events\DomainEvent;
use App\Domain\Organization\Models\Tenant;

class TenantCreated extends DomainEvent
{
    public function __construct(
        public readonly Tenant $tenant,
        ?int $actorId = null,
    ) {
        parent::__construct(
            tenantId: (int) $tenant->id,
            actorId: $actorId,
        );
    }
}
