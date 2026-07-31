<?php

namespace App\Domain\Academics\Models;

use App\Domain\Organization\Models\Campus;
use App\Domain\Organization\Models\School;
use App\Support\Traits\BelongsToSchool;
use App\Support\Traits\BelongsToTenant;
use App\Support\Traits\HasAuditColumns;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class SchoolClass extends Model
{
    use BelongsToSchool;
    use BelongsToTenant;
    use HasAuditColumns;
    use SoftDeletes;

    protected $table = 'school_classes';

    protected $fillable = [
        'tenant_id',
        'school_id',
        'campus_id',
        'academic_year_id',
        'grade_id',
        'code',
        'name_en',
        'name_ar',
        'status',
        'created_by',
        'updated_by',
    ];

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function campus(): BelongsTo
    {
        return $this->belongsTo(Campus::class);
    }

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }

    public function grade(): BelongsTo
    {
        return $this->belongsTo(Grade::class);
    }

    public function sections(): HasMany
    {
        return $this->hasMany(ClassSection::class, 'school_class_id');
    }
}
