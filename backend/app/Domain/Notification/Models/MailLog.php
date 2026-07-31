<?php

namespace App\Domain\Notification\Models;

use Illuminate\Database\Eloquent\Model;

class MailLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'tenant_id',
        'to_email',
        'subject',
        'status',
        'provider_message_id',
        'created_at',
    ];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }
}
