<?php

namespace App\Domain\Learning\Models;

use App\Domain\Curriculum\Models\CurriculumLesson;
use App\Support\Traits\BelongsToSchool;
use App\Support\Traits\BelongsToTenant;
use App\Support\Traits\HasAuditColumns;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class InteractiveLesson extends Model
{
    use BelongsToSchool;
    use BelongsToTenant;
    use HasAuditColumns;
    use SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'school_id',
        'curriculum_lesson_id',
        'title_en',
        'title_ar',
        'status',
        'completion_rule',
        'published_at',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return ['published_at' => 'datetime'];
    }

    public function curriculumLesson(): BelongsTo
    {
        return $this->belongsTo(CurriculumLesson::class, 'curriculum_lesson_id');
    }

    public function blocks(): HasMany
    {
        return $this->hasMany(LessonBlock::class)->orderBy('sequence');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(LessonAssignment::class);
    }

    public function progressRecords(): HasMany
    {
        return $this->hasMany(LearningProgress::class);
    }

    public function isPublished(): bool
    {
        return $this->status === 'published';
    }
}
