<?php

namespace App\Http\Controllers\Api\V1\Control;

use App\Domain\Identity\Services\RbacService;
use App\Domain\Organization\Models\Campus;
use App\Domain\Organization\Models\Tenant;
use App\Domain\Organization\Services\CampusService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CampusController extends Controller
{
    public function __construct(
        protected CampusService $campuses,
        protected RbacService $rbac,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->guard();

        return response()->json([
            'data' => $this->campuses->list([
                'search' => $request->input('search'),
                'status' => $request->input('status'),
                'tenant_id' => $request->integer('tenant_id') ?: null,
                'school_id' => $request->integer('school_id') ?: null,
            ]),
            'meta' => [
                'stats' => $this->campuses->stats(),
                'tenants' => $this->campuses->availableSchools(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->guard();

        $data = $request->validate([
            'school_id' => ['required', 'integer'],
            'code' => ['nullable', 'string', 'max:64'],
            'name_en' => ['required', 'string', 'max:191'],
            'name_ar' => ['nullable', 'string', 'max:191'],
            'timezone' => ['nullable', 'string', 'max:64'],
            'address' => ['nullable', 'string', 'max:500'],
            'status' => ['nullable', 'in:active,inactive'],
        ]);

        return response()->json([
            'message' => 'Campus created.',
            'data' => $this->campuses->create($data),
        ], 201);
    }

    public function show(int $campus): JsonResponse
    {
        $this->guard();
        $model = Campus::query()
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'))
            ->findOrFail($campus);

        return response()->json([
            'data' => $this->campuses->show($model),
        ]);
    }

    public function update(Request $request, int $campus): JsonResponse
    {
        $this->guard();
        $model = Campus::query()
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'))
            ->findOrFail($campus);

        $data = $request->validate([
            'school_id' => ['sometimes', 'integer'],
            'code' => ['nullable', 'string', 'max:64'],
            'name_en' => ['sometimes', 'required', 'string', 'max:191'],
            'name_ar' => ['nullable', 'string', 'max:191'],
            'timezone' => ['nullable', 'string', 'max:64'],
            'address' => ['nullable', 'string', 'max:500'],
            'status' => ['nullable', 'in:active,inactive'],
        ]);

        return response()->json([
            'message' => 'Campus updated.',
            'data' => $this->campuses->update($model, $data),
        ]);
    }

    public function destroy(int $campus): JsonResponse
    {
        $this->guard();
        $model = Campus::query()
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'))
            ->findOrFail($campus);
        $this->campuses->delete($model);

        return response()->json([
            'message' => 'Campus deleted.',
        ]);
    }

    protected function guard(): void
    {
        $user = request()->user();
        abort_unless(
            $user?->hasRole('super_admin')
                || $this->rbac->can($user, 'platform.tenants.manage'),
            403
        );
        $this->authorize('viewAny', Tenant::class);
    }
}
