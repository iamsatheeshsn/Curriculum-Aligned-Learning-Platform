<?php

namespace App\Domain\Learning\Models;

use App\Models\User;
use App\Support\Traits\BelongsToSchool;
use App\Support\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class StaffMessage extends Model
{
    use BelongsToSchool;
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'staff_messages';

    protected $fillable = [
        'tenant_id',
        'school_id',
        'sender_user_id',
        'recipient_user_id',
        'subject',
        'body',
        'category',
        'read_at',
    ];

    protected function casts(): array
    {
        return [
            'read_at' => 'datetime',
        ];
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_user_id');
    }

    public function recipient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recipient_user_id');
    }
}
