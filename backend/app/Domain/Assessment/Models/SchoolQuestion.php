<?php

namespace App\Domain\Assessment\Models;

use App\Domain\Academics\Models\Subject;
use App\Support\Traits\BelongsToSchool;
use App\Support\Traits\BelongsToTenant;
use App\Support\Traits\HasAuditColumns;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class SchoolQuestion extends Model
{
    use BelongsToSchool;
    use BelongsToTenant;
    use HasAuditColumns;
    use SoftDeletes;

    protected $table = 'school_questions';

    protected $fillable = [
        'tenant_id',
        'school_id',
        'stem_en',
        'stem_ar',
        'type',
        'difficulty',
        'subject_id',
        'status',
        'created_by',
        'updated_by',
    ];

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }
}
