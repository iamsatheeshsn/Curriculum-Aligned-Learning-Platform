<?php

namespace App\Domain\Tutoring\Models;

use App\Support\Traits\BelongsToTenant;
use App\Support\Traits\HasAuditColumns;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class TutoringAttendance extends Model
{
    use BelongsToTenant;
    use HasAuditColumns;
    use SoftDeletes;

    protected $table = 'tutoring_attendance';

    protected $fillable = [
        'tenant_id',
        'tutoring_session_id',
        'student_user_id',
        'status',
        'marked_by',
        'marked_at',
        'notes',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return ['marked_at' => 'datetime'];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(TutoringSession::class, 'tutoring_session_id');
    }
}
