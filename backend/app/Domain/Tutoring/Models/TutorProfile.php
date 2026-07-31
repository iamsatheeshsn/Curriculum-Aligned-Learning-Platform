<?php

namespace App\Domain\Tutoring\Models;

use App\Domain\Academics\Models\Subject;
use App\Domain\Organization\Models\School;
use App\Models\User;
use App\Support\Traits\BelongsToTenant;
use App\Support\Traits\HasAuditColumns;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class TutorProfile extends Model
{
    use BelongsToTenant;
    use HasAuditColumns;
    use SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'user_id',
        'school_id',
        'bio_en',
        'bio_ar',
        'hourly_rate',
        'status',
        'created_by',
        'updated_by',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function subjects(): BelongsToMany
    {
        return $this->belongsToMany(Subject::class, 'tutor_subjects', 'tutor_profile_id', 'subject_id')
            ->withPivot('languages_json');
    }

    public function availabilities(): HasMany
    {
        return $this->hasMany(TutorAvailability::class);
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(TutoringSession::class);
    }

    public function ratings(): HasMany
    {
        return $this->hasMany(TutoringSessionRating::class);
    }
}
