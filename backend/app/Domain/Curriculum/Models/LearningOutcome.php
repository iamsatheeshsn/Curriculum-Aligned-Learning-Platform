<?php

namespace App\Domain\Curriculum\Models;

use App\Domain\Academics\Models\Subject;
use App\Domain\Organization\Models\School;
use App\Domain\Organization\Models\Tenant;
use App\Support\Traits\BelongsToSchool;
use App\Support\Traits\BelongsToTenant;
use App\Support\Traits\HasAuditColumns;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class LearningOutcome extends Model
{
    use BelongsToSchool;
    use BelongsToTenant;
    use HasAuditColumns;
    use SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'school_id',
        'curriculum_id',
        'subject_id',
        'code',
        'statement_en',
        'statement_ar',
        'status',
        'created_by',
        'updated_by',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function curriculum(): BelongsTo
    {
        return $this->belongsTo(Curriculum::class, 'curriculum_id');
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function lessons(): BelongsToMany
    {
        return $this->belongsToMany(
            CurriculumLesson::class,
            'lesson_learning_outcomes',
            'learning_outcome_id',
            'curriculum_lesson_id'
        )->withPivot(['id', 'created_at']);
    }
}
