<?php

namespace App\Domain\Billing\Models;

use App\Support\Traits\HasAuditColumns;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class BillingCoupon extends Model
{
    use HasAuditColumns;
    use SoftDeletes;

    protected $table = 'billing_coupons';

    protected $fillable = [
        'code',
        'name_en',
        'name_ar',
        'discount_type',
        'discount_value',
        'currency',
        'max_redemptions',
        'redemptions_count',
        'starts_at',
        'ends_at',
        'is_active',
        'notes',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'discount_value' => 'decimal:2',
            'max_redemptions' => 'integer',
            'redemptions_count' => 'integer',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }
}
