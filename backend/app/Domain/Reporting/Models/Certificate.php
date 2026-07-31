<?php

namespace App\Domain\Reporting\Models;

use App\Models\User;
use App\Support\Traits\BelongsToSchool;
use App\Support\Traits\BelongsToTenant;
use App\Support\Traits\HasAuditColumns;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Certificate extends Model
{
    use BelongsToSchool;
    use BelongsToTenant;
    use HasAuditColumns;
    use SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'school_id',
        'student_user_id',
        'title_en',
        'title_ar',
        'issued_at',
        'voided_at',
        'pdf_path',
        'verification_code',
        'snapshot_json',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'issued_at' => 'datetime',
            'voided_at' => 'datetime',
            'snapshot_json' => 'array',
        ];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_user_id');
    }

    public function isActive(): bool
    {
        return $this->voided_at === null;
    }
}
