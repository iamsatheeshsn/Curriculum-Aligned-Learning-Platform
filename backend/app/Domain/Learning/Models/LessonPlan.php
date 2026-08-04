<?php

namespace App\Domain\Learning\Models;

use App\Domain\Academics\Models\ClassSection;
use App\Domain\Academics\Models\Subject;
use App\Domain\Curriculum\Models\CurriculumLesson;
use App\Models\User;
use App\Support\Traits\BelongsToSchool;
use App\Support\Traits\BelongsToTenant;
use App\Support\Traits\HasAuditColumns;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class LessonPlan extends Model
{
    use BelongsToSchool;
    use BelongsToTenant;
    use HasAuditColumns;
    use SoftDeletes;

    protected $table = 'lesson_plans';

    protected $fillable = [
        'tenant_id',
        'school_id',
        'teacher_user_id',
        'subject_id',
        'class_section_id',
        'curriculum_lesson_id',
        'title_en',
        'title_ar',
        'planned_on',
        'duration_minutes',
        'objectives',
        'materials',
        'activities',
        'assessment_notes',
        'homework_notes',
        'status',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'planned_on' => 'date',
            'duration_minutes' => 'integer',
        ];
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function classSection(): BelongsTo
    {
        return $this->belongsTo(ClassSection::class);
    }

    public function curriculumLesson(): BelongsTo
    {
        return $this->belongsTo(CurriculumLesson::class);
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'teacher_user_id');
    }
}
