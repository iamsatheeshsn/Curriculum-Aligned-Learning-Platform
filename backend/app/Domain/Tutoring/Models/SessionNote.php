<?php

namespace App\Domain\Tutoring\Models;

use App\Support\Traits\HasAuditColumns;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class SessionNote extends Model
{
    use HasAuditColumns;
    use SoftDeletes;

    protected $fillable = [
        'tutoring_session_id',
        'tutor_profile_id',
        'notes',
        'follow_up',
        'visible_to_parent',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return ['visible_to_parent' => 'boolean'];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(TutoringSession::class, 'tutoring_session_id');
    }
}
