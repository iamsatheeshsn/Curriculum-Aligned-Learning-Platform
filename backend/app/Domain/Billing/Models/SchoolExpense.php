<?php

namespace App\Domain\Billing\Models;

use App\Support\Traits\BelongsToSchool;
use App\Support\Traits\BelongsToTenant;
use App\Support\Traits\HasAuditColumns;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class SchoolExpense extends Model
{
    use BelongsToSchool;
    use BelongsToTenant;
    use HasAuditColumns;
    use SoftDeletes;

    protected $table = 'school_expenses';

    protected $fillable = [
        'tenant_id',
        'school_id',
        'category',
        'title',
        'amount',
        'currency',
        'spent_on',
        'status',
        'notes',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'float',
            'spent_on' => 'date',
        ];
    }
}
