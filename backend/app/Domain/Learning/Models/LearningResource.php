<?php

namespace App\Domain\Learning\Models;

use App\Domain\Academics\Models\Subject;
use App\Support\Traits\BelongsToSchool;
use App\Support\Traits\BelongsToTenant;
use App\Support\Traits\HasAuditColumns;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class LearningResource extends Model
{
    use BelongsToSchool;
    use BelongsToTenant;
    use HasAuditColumns;
    use SoftDeletes;

    protected $table = 'learning_resources';

    protected $fillable = [
        'tenant_id',
        'school_id',
        'title_en',
        'title_ar',
        'resource_type',
        'url',
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
