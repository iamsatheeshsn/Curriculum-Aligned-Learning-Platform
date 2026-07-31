<?php

namespace App\Domain\Academics\Models;

use App\Domain\Organization\Models\School;
use App\Models\User;
use App\Support\Traits\BelongsToSchool;
use App\Support\Traits\BelongsToTenant;
use App\Support\Traits\HasAuditColumns;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class TeachingAssignment extends Model
{
    use BelongsToSchool;
    use BelongsToTenant;
    use HasAuditColumns;
    use SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'school_id',
        'teacher_user_id',
        'subject_id',
        'class_section_id',
        'academic_year_id',
        'status',
        'notes',
        'created_by',
        'updated_by',
    ];

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'teacher_user_id');
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function classSection(): BelongsTo
    {
        return $this->belongsTo(ClassSection::class);
    }

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }
}
