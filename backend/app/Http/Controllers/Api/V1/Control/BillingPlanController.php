<?php

namespace App\Http\Controllers\Api\V1\Control;

use App\Domain\Billing\Models\SubscriptionPlan;
use App\Domain\Billing\Services\ControlPlanService;
use App\Domain\Identity\Services\RbacService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BillingPlanController extends Controller
{
    public function __construct(
        protected ControlPlanService $plans,
        protected RbacService $rbac,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'status' => ['nullable', 'in:active,inactive'],
        ]);

        return response()->json([
            'data' => $this->plans->list($data),
            'meta' => ['stats' => $this->plans->stats()],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'code' => ['required', 'string', 'max:64'],
            'name_en' => ['required', 'string', 'max:191'],
            'name_ar' => ['nullable', 'string', 'max:191'],
            'price' => ['required', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'max_schools' => ['nullable', 'integer', 'min:0'],
            'max_campuses' => ['nullable', 'integer', 'min:0'],
            'max_students' => ['nullable', 'integer', 'min:0'],
            'max_teachers' => ['nullable', 'integer', 'min:0'],
            'max_storage_mb' => ['nullable', 'integer', 'min:0'],
            'modules' => ['nullable', 'array'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        return response()->json([
            'message' => 'Plan created.',
            'data' => $this->plans->create($data, (int) $request->user()->id),
        ], 201);
    }

    public function show(int $plan): JsonResponse
    {
        $this->guard();
        $model = SubscriptionPlan::query()->findOrFail($plan);

        return response()->json(['data' => $this->plans->show($model)]);
    }

    public function update(Request $request, int $plan): JsonResponse
    {
        $this->guard();
        $model = SubscriptionPlan::query()->findOrFail($plan);
        $data = $request->validate([
            'code' => ['sometimes', 'required', 'string', 'max:64'],
            'name_en' => ['sometimes', 'required', 'string', 'max:191'],
            'name_ar' => ['nullable', 'string', 'max:191'],
            'price' => ['sometimes', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'max_schools' => ['nullable', 'integer', 'min:0'],
            'max_campuses' => ['nullable', 'integer', 'min:0'],
            'max_students' => ['nullable', 'integer', 'min:0'],
            'max_teachers' => ['nullable', 'integer', 'min:0'],
            'max_storage_mb' => ['nullable', 'integer', 'min:0'],
            'modules' => ['nullable', 'array'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        return response()->json([
            'message' => 'Plan updated.',
            'data' => $this->plans->update($model, $data, (int) $request->user()->id),
        ]);
    }

    public function destroy(int $plan): JsonResponse
    {
        $this->guard();
        $model = SubscriptionPlan::query()->findOrFail($plan);
        $this->plans->delete($model);

        return response()->json(['message' => 'Plan deleted.']);
    }

    protected function guard(): void
    {
        $user = request()->user();
        abort_unless(
            $user?->hasRole('super_admin')
                || $this->rbac->can($user, 'platform.plans.manage')
                || $this->rbac->can($user, 'platform.tenants.manage'),
            403
        );
    }
}
