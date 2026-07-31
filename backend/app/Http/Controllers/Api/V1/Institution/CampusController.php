<?php

namespace App\Http\Controllers\Api\V1\Institution;

use App\Domain\Academics\Services\SchoolContextService;
use App\Domain\Identity\Services\RbacService;
use App\Domain\Organization\Models\Campus;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CampusController extends Controller
{
    public function __construct(
        protected SchoolContextService $schoolContext,
        protected RbacService $rbac,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'school.campuses.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $items = Campus::query()
            ->where('school_id', $school->id)
            ->orderBy('name_en')
            ->paginate((int) $request->integer('per_page', 10));

        return response()->json($items);
    }

    public function store(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'school.campuses.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $data = $request->validate([
            'code' => ['required', 'string', 'max:64'],
            'name_en' => ['required', 'string', 'max:191'],
            'name_ar' => ['required', 'string', 'max:191'],
            'timezone' => ['nullable', 'string', 'max:64'],
            'address' => ['nullable', 'string', 'max:500'],
            'status' => ['nullable', 'in:active,inactive'],
        ]);

        $campus = Campus::query()->create([
            ...$data,
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'status' => $data['status'] ?? 'active',
        ]);

        return response()->json(['message' => 'Campus created.', 'data' => $campus], 201);
    }

    public function update(Request $request, int $campus): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'school.campuses.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = Campus::query()->where('school_id', $school->id)->findOrFail($campus);

        $data = $request->validate([
            'code' => ['sometimes', 'string', 'max:64'],
            'name_en' => ['sometimes', 'string', 'max:191'],
            'name_ar' => ['sometimes', 'string', 'max:191'],
            'timezone' => ['nullable', 'string', 'max:64'],
            'address' => ['nullable', 'string', 'max:500'],
            'status' => ['sometimes', 'in:active,inactive'],
        ]);

        $model->update($data);

        return response()->json(['message' => 'Campus updated.', 'data' => $model->fresh()]);
    }

    public function destroy(Request $request, int $campus): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'school.campuses.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        Campus::query()->where('school_id', $school->id)->findOrFail($campus)->delete();

        return response()->json(['message' => 'Campus deleted.']);
    }
}
