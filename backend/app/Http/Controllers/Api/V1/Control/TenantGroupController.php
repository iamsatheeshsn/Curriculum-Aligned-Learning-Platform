<?php

namespace App\Http\Controllers\Api\V1\Control;

use App\Domain\Identity\Services\RbacService;
use App\Domain\Organization\Models\Tenant;
use App\Domain\Organization\Models\TenantGroup;
use App\Domain\Organization\Services\TenantGroupService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TenantGroupController extends Controller
{
    public function __construct(
        protected TenantGroupService $groups,
        protected RbacService $rbac,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->guard();

        return response()->json([
            'data' => $this->groups->list([
                'search' => $request->input('search'),
                'status' => $request->input('status'),
            ]),
            'meta' => [
                'stats' => $this->groups->stats(),
                'tenants' => $this->groups->availableTenants(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->guard();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:191'],
            'slug' => ['nullable', 'string', 'max:80', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'],
            'description' => ['nullable', 'string', 'max:500'],
            'status' => ['nullable', 'in:active,inactive'],
            'country_code' => ['nullable', 'string', 'size:2'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'tenant_ids' => ['nullable', 'array'],
            'tenant_ids.*' => ['integer'],
        ]);

        return response()->json([
            'message' => 'School group created.',
            'data' => $this->groups->create($data),
        ], 201);
    }

    public function show(int $group): JsonResponse
    {
        $this->guard();
        $model = TenantGroup::query()->findOrFail($group);

        return response()->json([
            'data' => $this->groups->show($model),
        ]);
    }

    public function update(Request $request, int $group): JsonResponse
    {
        $this->guard();
        $model = TenantGroup::query()->findOrFail($group);

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:191'],
            'slug' => ['nullable', 'string', 'max:80', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'],
            'description' => ['nullable', 'string', 'max:500'],
            'status' => ['nullable', 'in:active,inactive'],
            'country_code' => ['nullable', 'string', 'size:2'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'tenant_ids' => ['nullable', 'array'],
            'tenant_ids.*' => ['integer'],
        ]);

        return response()->json([
            'message' => 'School group updated.',
            'data' => $this->groups->update($model, $data),
        ]);
    }

    public function destroy(int $group): JsonResponse
    {
        $this->guard();
        $model = TenantGroup::query()->findOrFail($group);
        $this->groups->delete($model);

        return response()->json([
            'message' => 'School group deleted.',
        ]);
    }

    public function syncMembers(Request $request, int $group): JsonResponse
    {
        $this->guard();
        $model = TenantGroup::query()->findOrFail($group);

        $data = $request->validate([
            'tenant_ids' => ['present', 'array'],
            'tenant_ids.*' => ['integer'],
        ]);

        return response()->json([
            'message' => 'Group members updated.',
            'data' => $this->groups->syncMembers($model, $data['tenant_ids']),
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
