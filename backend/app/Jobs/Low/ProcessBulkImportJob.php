<?php

namespace App\Jobs\Low;

use App\Jobs\TenantAwareJob;
use Illuminate\Support\Facades\Log;

class ProcessBulkImportJob extends TenantAwareJob
{
    public function __construct(
        ?int $tenantId = null,
        ?int $schoolId = null,
        ?string $locale = null,
        ?int $actorId = null,
        public readonly string $importPath = '',
    ) {
        parent::__construct($tenantId, $schoolId, $locale, $actorId);
        $this->onQueue('low');
    }

    public function handle(): void
    {
        $this->bindTenantContext();
        Log::info('Bulk import job started', ['path' => $this->importPath]);
    }
}
