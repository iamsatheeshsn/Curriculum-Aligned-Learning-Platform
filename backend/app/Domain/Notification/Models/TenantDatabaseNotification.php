<?php

namespace App\Domain\Notification\Models;

use Illuminate\Notifications\DatabaseNotification;

class TenantDatabaseNotification extends DatabaseNotification
{
    protected $table = 'notifications';

    protected $fillable = [
        'id',
        'tenant_id',
        'type',
        'notifiable_type',
        'notifiable_id',
        'data',
        'read_at',
    ];

    protected function casts(): array
    {
        return [
            'data' => 'array',
            'read_at' => 'datetime',
        ];
    }
}
