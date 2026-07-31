<?php

namespace App\Domain\Assessment\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuestionOption extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'question_id',
        'locale',
        'label',
        'is_correct',
        'sequence',
    ];

    protected function casts(): array
    {
        return [
            'is_correct' => 'boolean',
            'sequence' => 'integer',
        ];
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(Question::class);
    }
}
