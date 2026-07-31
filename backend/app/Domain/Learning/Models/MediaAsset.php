<?php

namespace App\Domain\Learning\Models;

use App\Support\Traits\BelongsToTenant;
use App\Support\Traits\HasAuditColumns;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class MediaAsset extends Model
{
    use BelongsToTenant;
    use HasAuditColumns;
    use SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'school_id',
        'type',
        'title_en',
        'title_ar',
        'disk_path',
        'external_url',
        'mime_type',
        'size_bytes',
        'duration_seconds',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'size_bytes' => 'integer',
            'duration_seconds' => 'integer',
        ];
    }
}
