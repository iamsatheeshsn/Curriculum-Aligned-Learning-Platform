<?php

namespace App\Domain\Assessment\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuestionTranslation extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'question_id',
        'locale',
        'stem',
        'explanation',
    ];

    public function question(): BelongsTo
    {
        return $this->belongsTo(Question::class);
    }
}
