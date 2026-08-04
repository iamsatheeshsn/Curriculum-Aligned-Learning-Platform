<?php

namespace App\Domain\Academics\Models;

use App\Models\User;
use App\Support\Traits\BelongsToSchool;
use App\Support\Traits\BelongsToTenant;
use App\Support\Traits\HasAuditColumns;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class ClassAttendance extends Model
{
    use BelongsToSchool;
    use BelongsToTenant;
    use HasAuditColumns;
    use SoftDeletes;

    protected $table = 'class_attendance';

    protected $fillable = [
        'tenant_id',
        'school_id',
        'class_section_id',
        'student_user_id',
        'subject_id',
        'attendance_date',
        'status',
        'notes',
        'marked_by',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'attendance_date' => 'date',
        ];
    }

    public function classSection(): BelongsTo
    {
        return $this->belongsTo(ClassSection::class);
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_user_id');
    }
}
