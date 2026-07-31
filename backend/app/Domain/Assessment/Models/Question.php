<?php

namespace App\Domain\Assessment\Models;

use App\Domain\Academics\Models\Subject;
use App\Domain\Curriculum\Models\LearningOutcome;
use App\Support\Traits\BelongsToSchool;
use App\Support\Traits\BelongsToTenant;
use App\Support\Traits\HasAuditColumns;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Question extends Model
{
    use BelongsToSchool;
    use BelongsToTenant;
    use HasAuditColumns;
    use SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'school_id',
        'subject_id',
        'type',
        'difficulty',
        'default_points',
        'status',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return ['default_points' => 'float'];
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function translations(): HasMany
    {
        return $this->hasMany(QuestionTranslation::class);
    }

    public function options(): HasMany
    {
        return $this->hasMany(QuestionOption::class)->orderBy('sequence');
    }

    public function learningOutcomes(): BelongsToMany
    {
        return $this->belongsToMany(
            LearningOutcome::class,
            'question_outcomes',
            'question_id',
            'learning_outcome_id'
        );
    }

    public function isObjective(): bool
    {
        return in_array($this->type, ['mcq', 'multi', 'boolean', 'numeric'], true);
    }
}
