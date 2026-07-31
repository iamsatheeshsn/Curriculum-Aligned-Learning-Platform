<?php

namespace App\Domain\Assessment\Models;

use App\Models\User;
use App\Support\Traits\BelongsToTenant;
use App\Support\Traits\HasAuditColumns;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class AssessmentAttempt extends Model
{
    use BelongsToTenant;
    use HasAuditColumns;
    use SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'assessment_id',
        'student_user_id',
        'attempt_no',
        'locale',
        'status',
        'score',
        'max_score',
        'started_at',
        'submitted_at',
        'graded_at',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'attempt_no' => 'integer',
            'score' => 'float',
            'max_score' => 'float',
            'started_at' => 'datetime',
            'submitted_at' => 'datetime',
            'graded_at' => 'datetime',
        ];
    }

    public function assessment(): BelongsTo
    {
        return $this->belongsTo(Assessment::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_user_id');
    }

    public function responses(): HasMany
    {
        return $this->hasMany(AssessmentResponse::class, 'attempt_id');
    }
}
