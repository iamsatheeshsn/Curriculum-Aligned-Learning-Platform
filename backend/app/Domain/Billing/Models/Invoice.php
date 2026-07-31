<?php

namespace App\Domain\Billing\Models;

use App\Domain\Organization\Models\Tenant;
use App\Support\Traits\BelongsToTenant;
use App\Support\Traits\HasAuditColumns;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Invoice extends Model
{
    use BelongsToTenant;
    use HasAuditColumns;
    use SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'number',
        'currency',
        'subtotal',
        'tax_total',
        'total',
        'status',
        'issued_at',
        'due_at',
        'paid_at',
        'notes',
        'pdf_path',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'subtotal' => 'float',
            'tax_total' => 'float',
            'total' => 'float',
            'issued_at' => 'datetime',
            'due_at' => 'datetime',
            'paid_at' => 'datetime',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(InvoiceItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }
}
