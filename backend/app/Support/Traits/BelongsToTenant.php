<?php

namespace App\Support\Traits;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * @mixin Model
 */
trait BelongsToTenant
{
    public static function bootBelongsToTenant(): void
    {
        static::creating(function (Model $model): void {
            if (empty($model->getAttribute('tenant_id'))) {
                $tenantId = app(\App\Support\TenantContext::class)->tenantId();
                if ($tenantId !== null) {
                    $model->setAttribute('tenant_id', $tenantId);
                }
            }
        });

        static::addGlobalScope('tenant', function (Builder $builder): void {
            $tenantId = app(\App\Support\TenantContext::class)->tenantId();
            if ($tenantId !== null) {
                $builder->where($builder->getModel()->getTable().'.tenant_id', $tenantId);
            }
        });
    }
}
