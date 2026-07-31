<?php

namespace App\Http\Controllers\Api\V1\Institution;

use App\Domain\Academics\Services\SchoolContextService;
use App\Domain\Identity\Services\RbacService;
use App\Domain\Notification\Services\PortalNotificationService;
use App\Domain\Reporting\Models\Certificate;
use App\Domain\Reporting\Services\CertificateService;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CertificateController extends Controller
{
    public function __construct(
        protected SchoolContextService $schoolContext,
        protected CertificateService $certificates,
        protected PortalNotificationService $notifications,
        protected RbacService $rbac,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'school.academics.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $items = Certificate::query()
            ->where('school_id', $school->id)
            ->when($request->filled('student_user_id'), fn ($q) => $q->where('student_user_id', $request->integer('student_user_id')))
            ->orderByDesc('issued_at')
            ->paginate((int) $request->integer('per_page', 10));

        return response()->json($items);
    }

    public function store(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'school.academics.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $data = $request->validate([
            'student_user_id' => ['required', 'integer'],
            'title_en' => ['required', 'string', 'max:255'],
            'title_ar' => ['required', 'string', 'max:255'],
            'pdf_path' => ['nullable', 'string', 'max:500'],
            'issued_at' => ['nullable', 'date'],
        ]);

        $student = User::query()->where('tenant_id', $school->tenant_id)->findOrFail($data['student_user_id']);
        $cert = $this->certificates->issue($school, $student, [
            ...$data,
            'issued_by' => $request->user()->id,
        ]);

        $this->notifications->notify($student, 'certificate.issued', [
            'title_en' => 'New certificate issued',
            'title_ar' => 'تم إصدار شهادة جديدة',
            'certificate_id' => $cert->id,
            'verification_code' => $cert->verification_code,
        ], $school->tenant_id);

        return response()->json(['message' => 'Certificate issued.', 'data' => $cert], 201);
    }

    public function void(Request $request, int $certificate): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'school.academics.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $cert = Certificate::query()->where('school_id', $school->id)->findOrFail($certificate);

        return response()->json([
            'message' => 'Certificate voided.',
            'data' => $this->certificates->void($cert),
        ]);
    }
}
