<?php

namespace App\Domain\Organization\Models;

use App\Support\Traits\BelongsToSchool;
use App\Support\Traits\BelongsToTenant;
use App\Support\Traits\HasAuditColumns;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class SchoolNotification extends Model
{
    use BelongsToSchool;
    use BelongsToTenant;
    use HasAuditColumns;
    use SoftDeletes;

    protected $table = 'school_notifications';

    protected $fillable = [
        'tenant_id',
        'school_id',
        'title',
        'body',
        'channel',
        'audience',
        'status',
        'sent_at',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'sent_at' => 'datetime',
        ];
    }
}
