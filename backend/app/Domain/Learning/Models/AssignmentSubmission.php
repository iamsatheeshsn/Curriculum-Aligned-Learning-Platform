<?php

namespace App\Domain\Learning\Models;

use App\Support\Traits\BelongsToTenant;
use App\Support\Traits\HasAuditColumns;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class AssignmentSubmission extends Model
{
    use BelongsToTenant;
    use HasAuditColumns;
    use SoftDeletes;

    protected $fillable = [
        'assignment_id',
        'student_user_id',
        'tenant_id',
        'body_text',
        'file_path',
        'submitted_at',
        'is_late',
        'score',
        'feedback',
        'status',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'submitted_at' => 'datetime',
            'is_late' => 'boolean',
            'score' => 'float',
        ];
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(HomeworkAssignment::class, 'assignment_id');
    }
}
