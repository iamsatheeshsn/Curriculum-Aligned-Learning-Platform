<?php

namespace App\Domain\Learning\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LessonBlock extends Model
{
    protected $fillable = [
        'interactive_lesson_id',
        'block_type',
        'sequence',
        'payload_json',
        'media_asset_id',
    ];

    protected function casts(): array
    {
        return [
            'payload_json' => 'array',
            'sequence' => 'integer',
        ];
    }

    public function lesson(): BelongsTo
    {
        return $this->belongsTo(InteractiveLesson::class, 'interactive_lesson_id');
    }

    public function mediaAsset(): BelongsTo
    {
        return $this->belongsTo(MediaAsset::class, 'media_asset_id');
    }
}
