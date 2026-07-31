<?php

namespace App\Domain\Curriculum\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CurriculumVersionLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'tenant_id',
        'school_id',
        'curriculum_id',
        'source_curriculum_id',
        'from_version',
        'to_version',
        'action',
        'summary_en',
        'summary_ar',
        'created_by',
        'created_at',
    ];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }

    public function curriculum(): BelongsTo
    {
        return $this->belongsTo(Curriculum::class, 'curriculum_id');
    }

    public function sourceCurriculum(): BelongsTo
    {
        return $this->belongsTo(Curriculum::class, 'source_curriculum_id');
    }
}
