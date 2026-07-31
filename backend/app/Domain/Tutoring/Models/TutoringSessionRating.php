<?php

namespace App\Domain\Tutoring\Models;

use App\Support\Traits\BelongsToTenant;
use App\Support\Traits\HasAuditColumns;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class TutoringSessionRating extends Model
{
    use BelongsToTenant;
    use HasAuditColumns;
    use SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'tutoring_session_id',
        'student_user_id',
        'tutor_profile_id',
        'rating',
        'feedback',
        'feedback_ar',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return ['rating' => 'integer'];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(TutoringSession::class, 'tutoring_session_id');
    }

    public function tutor(): BelongsTo
    {
        return $this->belongsTo(TutorProfile::class, 'tutor_profile_id');
    }
}
