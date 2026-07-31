<?php

namespace App\Domain\Organization\Models;

use App\Domain\Billing\Models\TenantSubscription;
use App\Support\Traits\HasAuditColumns;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Tenant extends Model
{
    use HasAuditColumns;
    use SoftDeletes;

    protected $fillable = [
        'tenant_group_id',
        'slug',
        'name',
        'legal_name',
        'primary_country_id',
        'default_locale',
        'default_timezone',
        'status',
        'settings',
        'trial_ends_at',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'trial_ends_at' => 'datetime',
            'settings' => 'array',
        ];
    }

    public function group(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(TenantGroup::class, 'tenant_group_id');
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(TenantSubscription::class);
    }

    public function branding(): HasOne
    {
        return $this->hasOne(TenantBranding::class);
    }

    public function schools(): HasMany
    {
        return $this->hasMany(School::class);
    }
}
