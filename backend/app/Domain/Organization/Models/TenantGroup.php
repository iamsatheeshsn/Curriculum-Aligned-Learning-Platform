<?php

namespace App\Domain\Organization\Models;

use App\Support\Traits\HasAuditColumns;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class TenantGroup extends Model
{
    use HasAuditColumns;
    use SoftDeletes;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'status',
        'country_code',
        'notes',
        'created_by',
        'updated_by',
    ];

    public function tenants(): HasMany
    {
        return $this->hasMany(Tenant::class, 'tenant_group_id');
    }
}
