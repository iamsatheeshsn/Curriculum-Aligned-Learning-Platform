<?php

namespace App\Domain\Tutoring\Models;

use App\Domain\Academics\Models\Subject;
use App\Models\User;
use App\Support\Traits\BelongsToSchool;
use App\Support\Traits\BelongsToTenant;
use App\Support\Traits\HasAuditColumns;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class TutoringTimetableSlot extends Model
{
    use BelongsToSchool;
    use BelongsToTenant;
    use HasAuditColumns;
    use SoftDeletes;

    protected $table = 'tutoring_timetable_slots';

    protected $fillable = [
        'tenant_id',
        'school_id',
        'day_of_week',
        'start_time',
        'end_time',
        'tutor_user_id',
        'subject_id',
        'status',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'day_of_week' => 'integer',
        ];
    }

    public function tutorUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'tutor_user_id');
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }
}
