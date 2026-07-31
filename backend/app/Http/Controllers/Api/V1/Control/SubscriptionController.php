<?php

namespace App\Http\Controllers\Api\V1\Control;

use App\Domain\Billing\Models\TenantSubscription;
use App\Domain\Billing\Services\SubscriptionService;
use App\Domain\Identity\Services\RbacService;
use App\Domain\Organization\Models\Tenant;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\TenantResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class SubscriptionController extends Controller
{
    public function __construct(
        protected SubscriptionService $subscriptions,
        protected RbacService $rbac,
    ) {}

    public function plans(): JsonResponse
    {
        $plans = $this->subscriptions->listPlans()->map(fn ($plan) => [
            'id' => $plan->id,
            'code' => $plan->code,
            'name_en' => $plan->name_en,
            'name_ar' => $plan->name_ar,
            'price' => $plan->price,
            'currency' => $plan->currency,
            'max_schools' => $plan->max_schools,
            'max_campuses' => $plan->max_campuses,
            'max_students' => $plan->max_students,
            'max_teachers' => $plan->max_teachers,
            'max_storage_mb' => $plan->max_storage_mb,
            'modules' => $plan->modules_json,
        ]);

        return response()->json(['data' => $plans]);
    }

    public function index(Request $request): JsonResponse
    {
        $this->guardManage();

        return response()->json([
            'data' => $this->subscriptions->listSubscriptions([
                'search' => $request->input('search'),
                'status' => $request->input('status'),
                'plan_code' => $request->input('plan_code'),
                'active_only' => $request->boolean('active_only'),
            ]),
            'meta' => [
                'stats' => $this->subscriptions->subscriptionStats(),
                'plans' => $this->subscriptions->listPlans()->map(fn ($plan) => [
                    'code' => $plan->code,
                    'name_en' => $plan->name_en,
                    'price' => $plan->price,
                    'currency' => $plan->currency,
                ])->values()->all(),
            ],
        ]);
    }

    public function show(int $subscription): JsonResponse
    {
        $this->guardManage();
        $model = TenantSubscription::query()
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'))
            ->findOrFail($subscription);

        return response()->json([
            'data' => $this->subscriptions->showSubscription($model),
        ]);
    }

    public function cancel(int $subscription, Request $request): JsonResponse
    {
        $this->guardManage();
        $model = TenantSubscription::query()
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'))
            ->findOrFail($subscription);

        $updated = $this->subscriptions->cancelSubscription($model, $request->user()->id);

        return response()->json([
            'message' => 'Subscription cancelled.',
            'data' => $this->subscriptions->showSubscription($updated),
        ]);
    }

    public function current(Request $request): JsonResponse
    {
        $tenantId = $request->integer('tenant_id') ?: null;
        $tenant = $this->resolveTenant($request, $tenantId ?: null);
        $subscription = $this->subscriptions->currentForTenant($tenant);

        return response()->json([
            'data' => [
                'tenant' => new TenantResource($tenant),
                'subscription' => $subscription ? [
                    'id' => $subscription->id,
                    'status' => $subscription->status,
                    'is_active' => $subscription->isActive(),
                    'starts_at' => $subscription->starts_at,
                    'ends_at' => $subscription->ends_at,
                    'plan' => [
                        'code' => $subscription->plan?->code,
                        'name_en' => $subscription->plan?->name_en,
                        'name_ar' => $subscription->plan?->name_ar,
                        'modules' => $subscription->plan?->modules_json,
                        'limits' => [
                            'max_schools' => $subscription->plan?->max_schools,
                            'max_campuses' => $subscription->plan?->max_campuses,
                            'max_students' => $subscription->plan?->max_students,
                            'max_teachers' => $subscription->plan?->max_teachers,
                            'max_storage_mb' => $subscription->plan?->max_storage_mb,
                        ],
                    ],
                ] : null,
            ],
        ]);
    }

    public function changePlan(Request $request): JsonResponse
    {
        $data = $request->validate([
            'plan_code' => ['required', 'string', 'max:64'],
            'tenant_id' => ['nullable', 'integer'],
        ]);

        $tenant = $this->resolveTenant($request, $data['tenant_id'] ?? null);
        $subscription = $this->subscriptions->changePlan(
            $tenant,
            $data['plan_code'],
            $request->user()->id,
        );

        return response()->json([
            'message' => 'Subscription plan updated.',
            'data' => [
                'subscription' => [
                    'id' => $subscription->id,
                    'status' => $subscription->status,
                    'plan' => [
                        'code' => $subscription->plan?->code,
                        'name_en' => $subscription->plan?->name_en,
                    ],
                ],
            ],
        ]);
    }

    protected function guardManage(): void
    {
        $user = request()->user();
        abort_unless(
            $user?->hasRole('super_admin')
                || $this->rbac->can($user, 'platform.tenants.manage')
                || $this->rbac->can($user, 'platform.plans.manage'),
            403
        );
        $this->authorize('viewAny', Tenant::class);
    }

    private function resolveTenant(Request $request, ?int $tenantId = null): Tenant
    {
        $user = $request->user();

        if ($user->hasRole('super_admin')) {
            $id = $tenantId ?: $request->integer('tenant_id') ?: null;
            if ($id) {
                $tenant = Tenant::query()->find($id);
                if (! $tenant) {
                    throw ValidationException::withMessages(['tenant_id' => ['Tenant not found.']]);
                }

                return $tenant;
            }
        }

        if (! $user->tenant_id) {
            throw ValidationException::withMessages(['tenant' => ['No tenant context. Pass tenant_id for Super Admin.']]);
        }

        return Tenant::query()->findOrFail($user->tenant_id);
    }
}
