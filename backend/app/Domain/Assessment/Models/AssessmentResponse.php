<?php

namespace App\Domain\Assessment\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssessmentResponse extends Model
{
    protected $fillable = [
        'attempt_id',
        'question_id',
        'response_json',
        'is_correct',
        'points_awarded',
        'graded_by',
    ];

    protected function casts(): array
    {
        return [
            'response_json' => 'array',
            'is_correct' => 'boolean',
            'points_awarded' => 'float',
        ];
    }

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(AssessmentAttempt::class, 'attempt_id');
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(Question::class);
    }
}
