<?php

namespace App\Domain\Curriculum\Models;

use App\Domain\Organization\Models\School;
use App\Domain\Organization\Models\Tenant;
use App\Support\Traits\BelongsToSchool;
use App\Support\Traits\BelongsToTenant;
use App\Support\Traits\HasAuditColumns;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class CurriculumLesson extends Model
{
    use BelongsToSchool;
    use BelongsToTenant;
    use HasAuditColumns;
    use SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'school_id',
        'curriculum_id',
        'chapter_id',
        'code',
        'title_en',
        'title_ar',
        'summary_en',
        'summary_ar',
        'sequence',
        'estimated_minutes',
        'difficulty',
        'status',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'sequence' => 'integer',
            'estimated_minutes' => 'integer',
        ];
    }

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

    public function chapter(): BelongsTo
    {
        return $this->belongsTo(Chapter::class);
    }

    public function learningOutcomes(): BelongsToMany
    {
        return $this->belongsToMany(
            LearningOutcome::class,
            'lesson_learning_outcomes',
            'curriculum_lesson_id',
            'learning_outcome_id'
        )->withPivot(['id', 'created_at']);
    }
}
