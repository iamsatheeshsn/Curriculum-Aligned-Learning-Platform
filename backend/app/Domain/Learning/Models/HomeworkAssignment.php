<?php

namespace App\Domain\Learning\Models;

use App\Domain\Academics\Models\Subject;
use App\Support\Traits\BelongsToSchool;
use App\Support\Traits\BelongsToTenant;
use App\Support\Traits\HasAuditColumns;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class HomeworkAssignment extends Model
{
    use BelongsToSchool;
    use BelongsToTenant;
    use HasAuditColumns;
    use SoftDeletes;

    protected $table = 'assignments';

    protected $fillable = [
        'tenant_id',
        'school_id',
        'subject_id',
        'class_section_id',
        'title_en',
        'title_ar',
        'instructions_en',
        'instructions_ar',
        'due_at',
        'allow_late',
        'is_scored',
        'max_score',
        'include_in_reports',
        'status',
        'assignment_kind',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'due_at' => 'datetime',
            'allow_late' => 'boolean',
            'is_scored' => 'boolean',
            'include_in_reports' => 'boolean',
            'max_score' => 'float',
        ];
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(AssignmentSubmission::class, 'assignment_id');
    }
}
