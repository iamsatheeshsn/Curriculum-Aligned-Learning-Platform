<?php

namespace App\Domain\Academics\Services;

use App\Domain\Academics\Models\AcademicYear;
use App\Domain\Organization\Models\School;
use App\Services\BaseService;
use App\Support\TenantContext;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;

class SchoolContextService extends BaseService
{
    public function __construct(TenantContext $tenantContext)
    {
        parent::__construct($tenantContext);
    }

    public function resolveSchool(?int $schoolId = null): School
    {
        $tenantId = $this->tenantId();
        if (! $tenantId) {
            throw ValidationException::withMessages(['school_id' => ['Tenant context required.']]);
        }

        $id = $schoolId
            ?? $this->schoolId()
            ?? request()->integer('school_id')
            ?: null;

        if (! $id) {
            // default to first active school for tenant
            $school = School::query()
                ->where('tenant_id', $tenantId)
                ->where('status', 'active')
                ->orderBy('id')
                ->first();
        } else {
            $school = School::query()
                ->where('tenant_id', $tenantId)
                ->where('id', $id)
                ->first();
        }

        if (! $school) {
            throw ValidationException::withMessages(['school_id' => ['School not found in tenant.']]);
        }

        $this->tenantContext->set(schoolId: (int) $school->id);

        return $school;
    }

    public function assertBelongsToSchool(Model $model, School $school): void
    {
        if (isset($model->school_id) && (int) $model->school_id !== (int) $school->id) {
            abort(404);
        }
        if (isset($model->tenant_id) && (int) $model->tenant_id !== (int) $school->tenant_id) {
            abort(404);
        }
    }

    public function setCurrentYear(School $school, AcademicYear $year): void
    {
        if ((int) $year->school_id !== (int) $school->id) {
            abort(404);
        }

        AcademicYear::query()
            ->where('school_id', $school->id)
            ->where('id', '!=', $year->id)
            ->update(['is_current' => false]);

        $year->forceFill(['is_current' => true, 'status' => 'active'])->save();
    }
}
