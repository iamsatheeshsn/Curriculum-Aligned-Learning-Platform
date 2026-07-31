<?php

namespace App\Domain\Academics\Models;

use App\Domain\Organization\Models\School;
use App\Domain\Organization\Models\Tenant;
use App\Support\Traits\BelongsToSchool;
use App\Support\Traits\BelongsToTenant;
use App\Support\Traits\HasAuditColumns;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Subject extends Model
{
    use BelongsToSchool;
    use BelongsToTenant;
    use HasAuditColumns;
    use SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'school_id',
        'curriculum_id',
        'code',
        'name_en',
        'name_ar',
        'is_stem',
        'tutoring_enabled',
        'status',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'is_stem' => 'boolean',
            'tutoring_enabled' => 'boolean',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function curriculum(): BelongsTo
    {
        return $this->belongsTo(\App\Domain\Curriculum\Models\Curriculum::class, 'curriculum_id');
    }

    public function chapters(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(\App\Domain\Curriculum\Models\Chapter::class);
    }
}
