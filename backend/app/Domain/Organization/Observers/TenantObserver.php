<?php

namespace App\Domain\Organization\Observers;

use App\Domain\Organization\Models\Tenant;
use Illuminate\Support\Facades\Log;

class TenantObserver
{
    public function created(Tenant $tenant): void
    {
        Log::info('Tenant created', ['tenant_id' => $tenant->id, 'slug' => $tenant->slug]);
    }

    public function updated(Tenant $tenant): void
    {
        if ($tenant->wasChanged('status')) {
            Log::warning('Tenant status changed', [
                'tenant_id' => $tenant->id,
                'status' => $tenant->status,
            ]);
        }
    }

    public function deleted(Tenant $tenant): void
    {
        Log::warning('Tenant soft-deleted', ['tenant_id' => $tenant->id]);
    }
}
