<?php

namespace App\Support\Traits;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/** @mixin Model */
trait BelongsToSchool
{
    public static function bootBelongsToSchool(): void
    {
        static::creating(function (Model $model): void {
            if (empty($model->getAttribute('school_id'))) {
                $schoolId = app(\App\Support\TenantContext::class)->schoolId();
                if ($schoolId !== null) {
                    $model->setAttribute('school_id', $schoolId);
                }
            }
        });

        static::addGlobalScope('school', function (Builder $builder): void {
            $schoolId = app(\App\Support\TenantContext::class)->schoolId();
            if ($schoolId !== null) {
                $builder->where($builder->getModel()->getTable().'.school_id', $schoolId);
            }
        });
    }
}
