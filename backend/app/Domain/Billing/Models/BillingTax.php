<?php

namespace App\Domain\Billing\Models;

use App\Support\Traits\HasAuditColumns;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class BillingTax extends Model
{
    use HasAuditColumns;
    use SoftDeletes;

    protected $table = 'billing_taxes';

    protected $fillable = [
        'code',
        'name_en',
        'name_ar',
        'rate_percent',
        'country_code',
        'is_inclusive',
        'is_active',
        'notes',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'rate_percent' => 'decimal:4',
            'is_inclusive' => 'boolean',
            'is_active' => 'boolean',
        ];
    }
}
