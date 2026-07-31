<?php

namespace App\Domain\Curriculum\Models;

use App\Domain\Academics\Models\Subject;
use App\Domain\Organization\Models\Country;
use App\Domain\Organization\Models\School;
use App\Support\Traits\HasAuditColumns;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Curriculum extends Model
{
    use HasAuditColumns;
    use SoftDeletes;

    protected $table = 'curricula';

    protected $fillable = [
        'tenant_id',
        'school_id',
        'country_id',
        'code',
        'name_en',
        'name_ar',
        'version',
        'status',
        'published_at',
        'is_latest',
        'change_summary_en',
        'change_summary_ar',
        'source_curriculum_id',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'published_at' => 'datetime',
            'is_latest' => 'boolean',
        ];
    }

    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class);
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function source(): BelongsTo
    {
        return $this->belongsTo(self::class, 'source_curriculum_id');
    }

    public function versions(): HasMany
    {
        return $this->hasMany(self::class, 'source_curriculum_id');
    }

    public function subjects(): HasMany
    {
        return $this->hasMany(Subject::class, 'curriculum_id');
    }

    public function chapters(): HasMany
    {
        return $this->hasMany(Chapter::class, 'curriculum_id');
    }

    public function lessons(): HasMany
    {
        return $this->hasMany(CurriculumLesson::class, 'curriculum_id');
    }

    public function learningOutcomes(): HasMany
    {
        return $this->hasMany(LearningOutcome::class, 'curriculum_id');
    }

    public function versionLogs(): HasMany
    {
        return $this->hasMany(CurriculumVersionLog::class, 'curriculum_id');
    }

    public function isEditable(): bool
    {
        return in_array($this->status, ['draft', 'in_review'], true);
    }
}
