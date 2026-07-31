<?php

namespace App\Domain\Billing\Services;

use App\Domain\Billing\Models\SubscriptionPlan;
use App\Domain\Billing\Models\TenantSubscription;
use App\Domain\Organization\Models\Tenant;
use App\Services\BaseService;
use App\Support\TenantContext;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class SubscriptionService extends BaseService
{
    public function __construct(TenantContext $tenantContext)
    {
        parent::__construct($tenantContext);
    }

    /** @return Collection<int, SubscriptionPlan> */
    public function listPlans(): Collection
    {
        return SubscriptionPlan::query()
            ->where('is_active', true)
            ->orderBy('price')
            ->get();
    }

    public function currentForTenant(Tenant $tenant): ?TenantSubscription
    {
        return TenantSubscription::query()
            ->with('plan')
            ->where('tenant_id', $tenant->id)
            ->where('status', 'active')
            ->latest('id')
            ->first();
    }

    public function assertActive(Tenant $tenant): TenantSubscription
    {
        $subscription = $this->currentForTenant($tenant);

        if (! $subscription || ! $subscription->isActive()) {
            throw ValidationException::withMessages([
                'subscription' => ['Subscription is inactive or expired.'],
            ]);
        }

        if ($tenant->status === 'trial' && $tenant->trial_ends_at && $tenant->trial_ends_at->isPast()) {
            throw ValidationException::withMessages([
                'subscription' => ['Trial period has ended.'],
            ]);
        }

        return $subscription;
    }

    public function changePlan(Tenant $tenant, string $planCode, ?int $actorId = null): TenantSubscription
    {
        $plan = SubscriptionPlan::query()
            ->where('code', $planCode)
            ->where('is_active', true)
            ->first();

        if (! $plan) {
            throw ValidationException::withMessages([
                'plan_code' => ['Invalid plan.'],
            ]);
        }

        return $this->transaction(function () use ($tenant, $plan, $actorId) {
            TenantSubscription::query()
                ->where('tenant_id', $tenant->id)
                ->where('status', 'active')
                ->update(['status' => 'cancelled', 'updated_by' => $actorId]);

            $subscription = TenantSubscription::query()->create([
                'tenant_id' => $tenant->id,
                'plan_id' => $plan->id,
                'starts_at' => now(),
                'ends_at' => null,
                'status' => 'active',
                'created_by' => $actorId,
                'updated_by' => $actorId,
            ]);

            if ($tenant->status === 'trial') {
                $tenant->forceFill(['status' => 'active', 'updated_by' => $actorId])->save();
            }

            return $subscription->load('plan');
        });
    }

    public function moduleEnabled(Tenant $tenant, string $module): bool
    {
        $subscription = $this->currentForTenant($tenant);
        if (! $subscription?->isActive()) {
            return false;
        }

        $modules = $subscription->plan?->modules_json ?? [];

        return (bool) ($modules[$module] ?? false);
    }

    /**
     * @param  array{search?: string|null, status?: string|null, plan_code?: string|null, active_only?: bool}  $filters
     * @return list<array<string, mixed>>
     */
    public function listSubscriptions(array $filters = []): array
    {
        $query = TenantSubscription::query()
            ->with([
                'plan:id,code,name_en,name_ar,price,currency,max_schools,max_campuses,max_students,max_teachers,max_storage_mb,modules_json',
                'tenant:id,slug,name,status,trial_ends_at',
            ])
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'));

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        } elseif (! empty($filters['active_only'])) {
            $query->where('status', 'active');
        }

        if (! empty($filters['plan_code'])) {
            $query->whereHas('plan', fn ($q) => $q->where('code', $filters['plan_code']));
        }

        if (! empty($filters['search'])) {
            $term = '%'.trim((string) $filters['search']).'%';
            $query->where(function ($q) use ($term) {
                $q->whereHas('tenant', fn ($tq) => $tq->where('name', 'like', $term)->orWhere('slug', 'like', $term))
                    ->orWhereHas('plan', fn ($pq) => $pq->where('name_en', 'like', $term)->orWhere('code', 'like', $term));
            });
        }

        return $query->orderByRaw("CASE WHEN status = 'active' THEN 0 ELSE 1 END")
            ->orderByDesc('starts_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn (TenantSubscription $sub) => $this->serializeSubscription($sub))
            ->all();
    }

    /** @return array<string, mixed> */
    public function showSubscription(TenantSubscription $subscription): array
    {
        $subscription->load([
            'plan:id,code,name_en,name_ar,price,currency,max_schools,max_campuses,max_students,max_teachers,max_storage_mb,modules_json',
            'tenant:id,slug,name,status,trial_ends_at,default_timezone',
        ]);

        return $this->serializeSubscription($subscription, true);
    }

    public function cancelSubscription(TenantSubscription $subscription, ?int $actorId = null): TenantSubscription
    {
        if ($subscription->status !== 'active') {
            throw ValidationException::withMessages([
                'subscription' => ['Only active subscriptions can be cancelled.'],
            ]);
        }

        $subscription->forceFill([
            'status' => 'cancelled',
            'ends_at' => now(),
            'updated_by' => $actorId,
        ])->save();

        return $subscription->fresh(['plan', 'tenant']);
    }

    /** @return array<string, mixed> */
    public function subscriptionStats(): array
    {
        $base = TenantSubscription::query()
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'));

        $active = (clone $base)->where('status', 'active')->with('plan')->get();
        $mrr = round((float) $active->sum(fn (TenantSubscription $s) => (float) ($s->plan?->price ?? 0)), 2);

        $byPlan = $active
            ->groupBy(fn (TenantSubscription $s) => $s->plan?->code ?? 'unknown')
            ->map(fn ($group, $code) => [
                'plan_code' => $code,
                'plan_name' => $group->first()?->plan?->name_en ?? $code,
                'count' => $group->count(),
                'mrr' => round((float) $group->sum(fn (TenantSubscription $s) => (float) ($s->plan?->price ?? 0)), 2),
            ])
            ->values()
            ->all();

        return [
            'total' => (int) (clone $base)->count(),
            'active' => $active->count(),
            'cancelled' => (int) (clone $base)->where('status', 'cancelled')->count(),
            'expired' => (int) (clone $base)->where('status', 'expired')->count(),
            'mrr' => $mrr,
            'arr' => round($mrr * 12, 2),
            'currency' => $active->first()?->plan?->currency ?? 'SAR',
            'by_plan' => $byPlan,
            'tenants_without_active' => (int) Tenant::query()
                ->where('slug', '!=', 'platform')
                ->whereDoesntHave('subscriptions', fn ($q) => $q->where('status', 'active'))
                ->count(),
        ];
    }

    /** @return array<string, mixed> */
    public function serializeSubscription(TenantSubscription $subscription, bool $detailed = false): array
    {
        $payload = [
            'id' => $subscription->id,
            'status' => $subscription->status,
            'is_active' => $subscription->isActive(),
            'starts_at' => optional($subscription->starts_at)?->toIso8601String(),
            'ends_at' => optional($subscription->ends_at)?->toIso8601String(),
            'tenant_id' => $subscription->tenant_id,
            'plan_id' => $subscription->plan_id,
            'tenant' => $subscription->relationLoaded('tenant') && $subscription->tenant
                ? [
                    'id' => $subscription->tenant->id,
                    'name' => $subscription->tenant->name,
                    'slug' => $subscription->tenant->slug,
                    'status' => $subscription->tenant->status,
                    'trial_ends_at' => optional($subscription->tenant->trial_ends_at)?->toIso8601String(),
                ]
                : null,
            'plan' => $subscription->relationLoaded('plan') && $subscription->plan
                ? [
                    'id' => $subscription->plan->id,
                    'code' => $subscription->plan->code,
                    'name_en' => $subscription->plan->name_en,
                    'name_ar' => $subscription->plan->name_ar,
                    'price' => $subscription->plan->price,
                    'currency' => $subscription->plan->currency,
                    'limits' => [
                        'max_schools' => $subscription->plan->max_schools,
                        'max_campuses' => $subscription->plan->max_campuses,
                        'max_students' => $subscription->plan->max_students,
                        'max_teachers' => $subscription->plan->max_teachers,
                        'max_storage_mb' => $subscription->plan->max_storage_mb,
                    ],
                    'modules' => $subscription->plan->modules_json,
                ]
                : null,
            'created_at' => optional($subscription->created_at)?->toIso8601String(),
            'updated_at' => optional($subscription->updated_at)?->toIso8601String(),
        ];

        if ($detailed && $subscription->tenant) {
            $payload['tenant']['default_timezone'] = $subscription->tenant->default_timezone ?? null;
        }

        return $payload;
    }
}
