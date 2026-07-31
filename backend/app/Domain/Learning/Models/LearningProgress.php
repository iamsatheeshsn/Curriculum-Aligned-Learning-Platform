<?php

namespace App\Domain\Learning\Models;

use App\Support\Traits\BelongsToSchool;
use App\Support\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class LearningProgress extends Model
{
    use BelongsToSchool;
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'learning_progress';

    protected $fillable = [
        'tenant_id',
        'school_id',
        'student_user_id',
        'interactive_lesson_id',
        'status',
        'progress_percent',
        'score',
        'started_at',
        'completed_at',
        'last_position_json',
    ];

    protected function casts(): array
    {
        return [
            'progress_percent' => 'float',
            'score' => 'float',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'last_position_json' => 'array',
        ];
    }

    public function lesson(): BelongsTo
    {
        return $this->belongsTo(InteractiveLesson::class, 'interactive_lesson_id');
    }
}
