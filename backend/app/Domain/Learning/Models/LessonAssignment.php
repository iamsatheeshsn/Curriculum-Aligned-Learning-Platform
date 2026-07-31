<?php

namespace App\Domain\Learning\Models;

use App\Support\Traits\BelongsToSchool;
use App\Support\Traits\BelongsToTenant;
use App\Support\Traits\HasAuditColumns;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class LessonAssignment extends Model
{
    use BelongsToSchool;
    use BelongsToTenant;
    use HasAuditColumns;
    use SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'school_id',
        'interactive_lesson_id',
        'class_section_id',
        'student_user_id',
        'assigned_by',
        'due_at',
        'status',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return ['due_at' => 'datetime'];
    }

    public function lesson(): BelongsTo
    {
        return $this->belongsTo(InteractiveLesson::class, 'interactive_lesson_id');
    }
}
