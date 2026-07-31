<?php

namespace App\Jobs\High;

use App\Jobs\TenantAwareJob;
use Illuminate\Support\Facades\Log;

/**
 * High-priority queue placeholder (password reset, tutoring reminders).
 */
class ExampleHighPriorityJob extends TenantAwareJob
{
    public function __construct(
        ?int $tenantId = null,
        ?int $schoolId = null,
        ?string $locale = null,
        ?int $actorId = null,
        public readonly string $message = '',
    ) {
        parent::__construct($tenantId, $schoolId, $locale, $actorId);
        $this->onQueue('high');
    }

    public function handle(): void
    {
        $this->bindTenantContext();
        Log::info('High priority job executed', [
            'tenant_id' => $this->tenantId,
            'message' => $this->message,
        ]);
    }
}
