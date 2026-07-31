<?php

namespace App\Domain\Learning\Models;

use App\Models\User;
use App\Support\Traits\BelongsToSchool;
use App\Support\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LearnerMessage extends Model
{
    use BelongsToSchool;
    use BelongsToTenant;

    protected $table = 'learner_messages';

    protected $fillable = [
        'tenant_id',
        'school_id',
        'user_id',
        'direction',
        'subject',
        'body',
        'read_at',
    ];

    protected function casts(): array
    {
        return [
            'read_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
