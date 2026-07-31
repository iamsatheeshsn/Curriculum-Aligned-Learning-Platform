<?php

namespace App\Support\Traits;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

/**
 * @mixin Model
 */
trait HasAuditColumns
{
    public static function bootHasAuditColumns(): void
    {
        static::creating(function (Model $model): void {
            $userId = Auth::id();
            if ($userId && empty($model->getAttribute('created_by'))) {
                $model->setAttribute('created_by', $userId);
            }
            if ($userId && empty($model->getAttribute('updated_by'))) {
                $model->setAttribute('updated_by', $userId);
            }
        });

        static::updating(function (Model $model): void {
            $userId = Auth::id();
            if ($userId) {
                $model->setAttribute('updated_by', $userId);
            }
        });
    }
}
