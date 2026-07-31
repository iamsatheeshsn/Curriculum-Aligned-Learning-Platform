<?php

namespace App\Jobs\Mail;

use App\Jobs\TenantAwareJob;
use Illuminate\Support\Facades\Log;

class SendQueuedMailJob extends TenantAwareJob
{
    public function __construct(
        ?int $tenantId = null,
        ?int $schoolId = null,
        ?string $locale = null,
        ?int $actorId = null,
        public readonly string $mailable = '',
        public readonly string $toEmail = '',
    ) {
        parent::__construct($tenantId, $schoolId, $locale, $actorId);
        $this->onQueue('mail');
    }

    public function handle(): void
    {
        $this->bindTenantContext();
        Log::info('Queued mail job', [
            'mailable' => $this->mailable,
            'to' => $this->toEmail,
            'locale' => $this->locale,
        ]);
    }
}
