<?php

namespace App\Http\Controllers\Api\V1\Institution;

use App\Domain\Academics\Services\SchoolContextService;
use App\Domain\Identity\Services\RbacService;
use App\Domain\Organization\Models\Campus;
use App\Domain\Organization\Models\Country;
use App\Domain\Organization\Models\School;
use App\Http\Controllers\Controller;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SchoolController extends Controller
{
    public function __construct(
        protected TenantContext $tenantContext,
        protected SchoolContextService $schoolContext,
        protected RbacService $rbac,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'school.users.view');

        $schools = School::query()
            ->where('tenant_id', $this->tenantContext->tenantId())
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->orderBy('name_en')
            ->paginate((int) $request->integer('per_page', 10));

        return response()->json($schools);
    }

    public function store(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'tenant.schools.manage');

        $data = $request->validate([
            'code' => ['required', 'string', 'max:64'],
            'name_en' => ['required', 'string', 'max:191'],
            'name_ar' => ['required', 'string', 'max:191'],
            'country_code' => ['required', 'string', 'size:2'],
            'timezone' => ['nullable', 'string', 'max:64'],
            'status' => ['nullable', 'in:active,inactive'],
        ]);

        $country = Country::query()->where('code', strtoupper($data['country_code']))->firstOrFail();

        $school = School::query()->create([
            'tenant_id' => $this->tenantContext->tenantId(),
            'country_id' => $country->id,
            'code' => $data['code'],
            'name_en' => $data['name_en'],
            'name_ar' => $data['name_ar'],
            'timezone' => $data['timezone'] ?? $country->default_timezone,
            'status' => $data['status'] ?? 'active',
        ]);

        return response()->json(['message' => 'School created.', 'data' => $school], 201);
    }

    public function show(Request $request, int $school): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'school.users.view');
        $model = School::query()->where('tenant_id', $this->tenantContext->tenantId())->findOrFail($school);

        return response()->json(['data' => $model->load('campuses')]);
    }

    public function update(Request $request, int $school): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'school.settings.manage');
        $model = School::query()->where('tenant_id', $this->tenantContext->tenantId())->findOrFail($school);

        $data = $request->validate([
            'code' => ['sometimes', 'string', 'max:64'],
            'name_en' => ['sometimes', 'string', 'max:191'],
            'name_ar' => ['sometimes', 'string', 'max:191'],
            'timezone' => ['nullable', 'string', 'max:64'],
            'status' => ['sometimes', 'in:active,inactive'],
        ]);

        $model->update($data);

        return response()->json(['message' => 'School updated.', 'data' => $model->fresh()]);
    }

    public function destroy(Request $request, int $school): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'tenant.schools.manage');
        $model = School::query()->where('tenant_id', $this->tenantContext->tenantId())->findOrFail($school);
        $model->delete();

        return response()->json(['message' => 'School deleted.']);
    }
}
