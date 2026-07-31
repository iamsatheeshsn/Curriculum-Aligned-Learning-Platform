<?php

namespace App\Domain\Assessment\Models;

use App\Domain\Academics\Models\Subject;
use App\Support\Traits\BelongsToSchool;
use App\Support\Traits\BelongsToTenant;
use App\Support\Traits\HasAuditColumns;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Assessment extends Model
{
    use BelongsToSchool;
    use BelongsToTenant;
    use HasAuditColumns;
    use SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'school_id',
        'subject_id',
        'term_id',
        'class_section_id',
        'type',
        'title_en',
        'title_ar',
        'instructions_en',
        'instructions_ar',
        'time_limit_seconds',
        'max_attempts',
        'available_from',
        'available_until',
        'shuffle_questions',
        'show_results',
        'counts_toward_grade',
        'status',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'available_from' => 'datetime',
            'available_until' => 'datetime',
            'shuffle_questions' => 'boolean',
            'counts_toward_grade' => 'boolean',
            'time_limit_seconds' => 'integer',
            'max_attempts' => 'integer',
        ];
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function questions(): BelongsToMany
    {
        return $this->belongsToMany(Question::class, 'assessment_questions')
            ->withPivot(['id', 'sequence', 'points'])
            ->orderByPivot('sequence');
    }

    public function assessmentQuestions(): HasMany
    {
        return $this->hasMany(AssessmentQuestion::class)->orderBy('sequence');
    }

    public function attempts(): HasMany
    {
        return $this->hasMany(AssessmentAttempt::class);
    }

    public function isEditable(): bool
    {
        return in_array($this->status, ['draft', 'scheduled'], true);
    }
}
