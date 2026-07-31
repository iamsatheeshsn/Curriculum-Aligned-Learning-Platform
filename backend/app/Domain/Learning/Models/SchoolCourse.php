<?php

namespace App\Domain\Learning\Models;

use App\Domain\Academics\Models\Subject;
use App\Support\Traits\BelongsToSchool;
use App\Support\Traits\BelongsToTenant;
use App\Support\Traits\HasAuditColumns;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class SchoolCourse extends Model
{
    use BelongsToSchool;
    use BelongsToTenant;
    use HasAuditColumns;
    use SoftDeletes;

    protected $table = 'school_courses';

    protected $fillable = [
        'tenant_id',
        'school_id',
        'code',
        'title_en',
        'title_ar',
        'subject_id',
        'description',
        'status',
        'created_by',
        'updated_by',
    ];

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function lessons(): HasMany
    {
        return $this->hasMany(SchoolLesson::class, 'course_id');
    }
}
