<?php

namespace App\Domain\Billing\Models;

use App\Domain\Tutoring\Models\TutorProfile;
use App\Support\Traits\BelongsToSchool;
use App\Support\Traits\BelongsToTenant;
use App\Support\Traits\HasAuditColumns;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class TutorPayment extends Model
{
    use BelongsToSchool;
    use BelongsToTenant;
    use HasAuditColumns;
    use SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'school_id',
        'tutor_profile_id',
        'tutoring_session_id',
        'amount',
        'currency',
        'status',
        'period_start',
        'period_end',
        'paid_at',
        'reference',
        'notes',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'float',
            'period_start' => 'date',
            'period_end' => 'date',
            'paid_at' => 'datetime',
        ];
    }

    public function tutor(): BelongsTo
    {
        return $this->belongsTo(TutorProfile::class, 'tutor_profile_id');
    }
}
