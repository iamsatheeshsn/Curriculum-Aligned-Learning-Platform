<?php

namespace App\Domain\Assessment\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssessmentQuestion extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'assessment_id',
        'question_id',
        'sequence',
        'points',
    ];

    protected function casts(): array
    {
        return [
            'sequence' => 'integer',
            'points' => 'float',
        ];
    }

    public function assessment(): BelongsTo
    {
        return $this->belongsTo(Assessment::class);
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(Question::class);
    }
}
