<?php

namespace App\Jobs\Default;

use App\Domain\Notification\Services\NotificationDispatcher;
use App\Jobs\TenantAwareJob;
use App\Models\User;
use Illuminate\Support\Facades\Log;

class SendDomainNotificationJob extends TenantAwareJob
{
    public function __construct(
        ?int $tenantId = null,
        ?int $schoolId = null,
        ?string $locale = null,
        ?int $actorId = null,
        public readonly string $eventType = '',
        public readonly array $payload = [],
    ) {
        parent::__construct($tenantId, $schoolId, $locale, $actorId);
        $this->onQueue('default');
    }

    public function handle(NotificationDispatcher $dispatcher): void
    {
        $this->bindTenantContext();

        $userIds = $this->payload['user_ids'] ?? [];
        if (isset($this->payload['user_id'])) {
            $userIds[] = $this->payload['user_id'];
        }
        $userIds = array_values(array_unique(array_filter(array_map('intval', $userIds))));

        if ($userIds === []) {
            Log::info('Domain notification job: no recipients', [
                'event' => $this->eventType,
                'tenant_id' => $this->tenantId,
            ]);

            return;
        }

        $users = User::query()->whereIn('id', $userIds)->get();
        $dispatcher->dispatchMany($users, $this->eventType, $this->payload, $this->tenantId);
    }
}
