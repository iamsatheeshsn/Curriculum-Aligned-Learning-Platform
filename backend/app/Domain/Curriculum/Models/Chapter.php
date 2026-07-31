<?php

namespace App\Domain\Curriculum\Models;

use App\Domain\Academics\Models\Grade;
use App\Domain\Academics\Models\Subject;
use App\Domain\Organization\Models\School;
use App\Domain\Organization\Models\Tenant;
use App\Support\Traits\BelongsToSchool;
use App\Support\Traits\BelongsToTenant;
use App\Support\Traits\HasAuditColumns;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Chapter extends Model
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
        'grade_id',
        'title_en',
        'title_ar',
        'sequence',
        'status',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return ['sequence' => 'integer'];
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

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function grade(): BelongsTo
    {
        return $this->belongsTo(Grade::class);
    }

    public function lessons(): HasMany
    {
        return $this->hasMany(CurriculumLesson::class, 'chapter_id')->orderBy('sequence');
    }
}
