<?php

namespace App\Domain\Notification\Models;

use Illuminate\Database\Eloquent\Model;

class NotificationDispatchLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'tenant_id',
        'event_type',
        'channel',
        'user_id',
        'status',
        'provider_message_id',
        'payload_json',
        'error_message',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'payload_json' => 'array',
            'created_at' => 'datetime',
        ];
    }
}
