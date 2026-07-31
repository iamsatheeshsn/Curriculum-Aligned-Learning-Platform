<?php

namespace App\Domain\Organization\Models;

use App\Support\Traits\HasAuditColumns;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class TenantBranding extends Model
{
    use HasAuditColumns;
    use SoftDeletes;

    protected $table = 'tenant_branding';

    protected $fillable = [
        'tenant_id',
        'logo_path',
        'favicon_path',
        'primary_color',
        'secondary_color',
        'email_footer_en',
        'email_footer_ar',
        'created_by',
        'updated_by',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
