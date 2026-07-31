<?php

namespace App\Jobs;

use App\Support\TenantContext;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

abstract class TenantAwareJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function __construct(
        public readonly ?int $tenantId = null,
        public readonly ?int $schoolId = null,
        public readonly ?string $locale = null,
        public readonly ?int $actorId = null,
    ) {}

    protected function bindTenantContext(): void
    {
        app(TenantContext::class)->set(
            tenantId: $this->tenantId,
            schoolId: $this->schoolId,
            locale: $this->locale,
        );
    }
}
