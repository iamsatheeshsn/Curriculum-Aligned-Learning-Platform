<?php

namespace App\Domain\Notification\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\User;

class NotificationPreference extends Model
{
    protected $fillable = [
        'tenant_id',
        'user_id',
        'event_type',
        'channel',
        'is_enabled',
    ];

    protected function casts(): array
    {
        return ['is_enabled' => 'boolean'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
