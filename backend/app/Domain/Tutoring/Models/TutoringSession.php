<?php

namespace App\Domain\Tutoring\Models;

use App\Domain\Academics\Models\Subject;
use App\Models\User;
use App\Support\Traits\BelongsToSchool;
use App\Support\Traits\BelongsToTenant;
use App\Support\Traits\HasAuditColumns;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class TutoringSession extends Model
{
    use BelongsToSchool;
    use BelongsToTenant;
    use HasAuditColumns;
    use SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'school_id',
        'campus_id',
        'tutor_profile_id',
        'subject_id',
        'language',
        'session_type',
        'starts_at',
        'ends_at',
        'status',
        'meeting_provider',
        'meeting_url',
        'meeting_external_id',
        'recording_url',
        'cancelled_at',
        'cancel_reason',
        'minutes_consumed',
        'booked_by',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'minutes_consumed' => 'integer',
        ];
    }

    public function tutor(): BelongsTo
    {
        return $this->belongsTo(TutorProfile::class, 'tutor_profile_id');
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function booker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'booked_by');
    }

    public function participants(): BelongsToMany
    {
        return $this->belongsToMany(
            User::class,
            'tutoring_session_participants',
            'tutoring_session_id',
            'student_user_id'
        )->withPivot(['id', 'role']);
    }

    public function attendanceRecords(): HasMany
    {
        return $this->hasMany(TutoringAttendance::class, 'tutoring_session_id');
    }

    public function notes(): HasOne
    {
        return $this->hasOne(SessionNote::class, 'tutoring_session_id');
    }

    public function ratings(): HasMany
    {
        return $this->hasMany(TutoringSessionRating::class, 'tutoring_session_id');
    }
}
