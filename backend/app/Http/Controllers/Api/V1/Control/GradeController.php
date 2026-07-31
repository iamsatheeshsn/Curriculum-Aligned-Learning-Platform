<?php

namespace App\Http\Controllers\Api\V1\Control;

use App\Domain\Academics\Models\Grade;
use App\Domain\Academics\Services\ControlGradeService;
use App\Domain\Identity\Services\RbacService;
use App\Domain\Organization\Models\Tenant;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GradeController extends Controller
{
    public function __construct(
        protected ControlGradeService $grades,
        protected RbacService $rbac,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->guard();

        $data = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'tenant_id' => ['nullable', 'integer'],
            'school_id' => ['nullable', 'integer'],
        ]);

        return response()->json([
            'data' => $this->grades->list([
                'search' => $data['search'] ?? null,
                'tenant_id' => $data['tenant_id'] ?? null,
                'school_id' => $data['school_id'] ?? null,
            ]),
            'meta' => [
                'stats' => $this->grades->stats(),
                'tenants' => $this->grades->availableSchools(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->guard();

        $data = $request->validate([
            'school_id' => ['required', 'integer'],
            'code' => ['required', 'string', 'max:32'],
            'name_en' => ['required', 'string', 'max:100'],
            'name_ar' => ['nullable', 'string', 'max:100'],
            'sequence' => ['required', 'integer', 'min:0'],
        ]);

        return response()->json([
            'message' => 'Grade created.',
            'data' => $this->grades->create($data, $request->user()->id),
        ], 201);
    }

    public function show(int $grade): JsonResponse
    {
        $this->guard();
        $model = Grade::query()
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'))
            ->findOrFail($grade);

        return response()->json([
            'data' => $this->grades->show($model),
        ]);
    }

    public function update(Request $request, int $grade): JsonResponse
    {
        $this->guard();
        $model = Grade::query()
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'))
            ->findOrFail($grade);

        $data = $request->validate([
            'school_id' => ['sometimes', 'integer'],
            'code' => ['sometimes', 'string', 'max:32'],
            'name_en' => ['sometimes', 'required', 'string', 'max:100'],
            'name_ar' => ['nullable', 'string', 'max:100'],
            'sequence' => ['sometimes', 'integer', 'min:0'],
        ]);

        return response()->json([
            'message' => 'Grade updated.',
            'data' => $this->grades->update($model, $data, $request->user()->id),
        ]);
    }

    public function destroy(int $grade): JsonResponse
    {
        $this->guard();
        $model = Grade::query()
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'))
            ->findOrFail($grade);
        $this->grades->delete($model);

        return response()->json([
            'message' => 'Grade deleted.',
        ]);
    }

    protected function guard(): void
    {
        $user = request()->user();
        abort_unless(
            $user?->hasRole('super_admin')
                || $this->rbac->can($user, 'platform.tenants.manage')
                || $this->rbac->can($user, 'curriculum.manage'),
            403
        );
        $this->authorize('viewAny', Tenant::class);
    }
}
