<?php

namespace App\Domain\Reporting\Services;

use App\Domain\Organization\Models\School;
use App\Domain\Reporting\Models\Certificate;
use App\Models\User;
use App\Services\BaseService;
use App\Support\TenantContext;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CertificateService extends BaseService
{
    public function __construct(TenantContext $tenantContext)
    {
        parent::__construct($tenantContext);
    }

    public function issue(School $school, User $student, array $data): Certificate
    {
        if ((int) $student->tenant_id !== (int) $school->tenant_id) {
            throw ValidationException::withMessages(['student_user_id' => ['Student not in tenant.']]);
        }

        return Certificate::query()->create([
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'student_user_id' => $student->id,
            'title_en' => $data['title_en'],
            'title_ar' => $data['title_ar'],
            'issued_at' => $data['issued_at'] ?? now(),
            'pdf_path' => $data['pdf_path'] ?? null,
            'verification_code' => strtoupper(Str::random(12)),
            'snapshot_json' => [
                'student_name_en' => trim($student->first_name.' '.$student->last_name),
                'student_name_ar' => trim(($student->first_name_ar ?? '').' '.($student->last_name_ar ?? '')),
                'email' => $student->email,
                'issued_by' => $data['issued_by'] ?? null,
            ],
        ]);
    }

    public function void(Certificate $certificate): Certificate
    {
        if ($certificate->voided_at) {
            throw ValidationException::withMessages(['certificate' => ['Already voided.']]);
        }

        $certificate->forceFill(['voided_at' => now()])->save();

        return $certificate->fresh();
    }
}
