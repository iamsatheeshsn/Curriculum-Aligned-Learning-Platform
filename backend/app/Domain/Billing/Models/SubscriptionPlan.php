<?php

namespace App\Domain\Billing\Models;

use App\Support\Traits\HasAuditColumns;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class SubscriptionPlan extends Model
{
    use HasAuditColumns;
    use SoftDeletes;

    protected $fillable = [
        'code',
        'name_en',
        'name_ar',
        'price',
        'currency',
        'max_schools',
        'max_campuses',
        'max_students',
        'max_teachers',
        'max_storage_mb',
        'modules_json',
        'is_active',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'modules_json' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(TenantSubscription::class, 'plan_id');
    }
}
