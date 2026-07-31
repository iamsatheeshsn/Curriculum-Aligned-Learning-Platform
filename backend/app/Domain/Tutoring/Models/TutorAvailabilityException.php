<?php

namespace App\Domain\Tutoring\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class TutorAvailabilityException extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'tutor_profile_id',
        'exception_date',
        'is_available',
        'start_time',
        'end_time',
        'reason',
    ];

    protected function casts(): array
    {
        return [
            'exception_date' => 'date',
            'is_available' => 'boolean',
        ];
    }

    public function tutor(): BelongsTo
    {
        return $this->belongsTo(TutorProfile::class, 'tutor_profile_id');
    }
}
