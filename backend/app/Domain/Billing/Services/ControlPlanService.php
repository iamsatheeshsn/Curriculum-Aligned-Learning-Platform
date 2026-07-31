<?php

namespace App\Domain\Billing\Services;

use App\Domain\Billing\Models\SubscriptionPlan;
use App\Domain\Billing\Models\TenantSubscription;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ControlPlanService
{
    /** @param  array{search?: ?string, status?: ?string}  $filters
     *  @return list<array<string, mixed>>
     */
    public function list(array $filters = []): array
    {
        return $this->baseQuery($filters)
            ->orderBy('price')
            ->get()
            ->map(fn (SubscriptionPlan $plan) => $this->serialize($plan))
            ->all();
    }

    /** @return array{total: int, active: int, inactive: int, with_subscriptions: int} */
    public function stats(): array
    {
        $base = SubscriptionPlan::query();

        return [
            'total' => (int) (clone $base)->count(),
            'active' => (int) (clone $base)->where('is_active', true)->count(),
            'inactive' => (int) (clone $base)->where('is_active', false)->count(),
            'with_subscriptions' => (int) (clone $base)->whereHas('subscriptions')->count(),
        ];
    }

    /** @return array<string, mixed> */
    public function show(SubscriptionPlan $plan): array
    {
        return $this->serialize($plan, true);
    }

    /** @param  array<string, mixed>  $data
     *  @return array<string, mixed>
     */
    public function create(array $data, int $actorId): array
    {
        $code = strtoupper(trim((string) $data['code']));
        $trashed = SubscriptionPlan::withTrashed()->where('code', $code)->first();

        if ($trashed && ! $trashed->trashed()) {
            throw ValidationException::withMessages(['code' => ['Plan code already exists.']]);
        }

        $payload = $this->normalize($data, $code);

        $plan = DB::transaction(function () use ($trashed, $payload, $actorId) {
            if ($trashed?->trashed()) {
                $trashed->restore();
                $trashed->fill($payload);
                $trashed->updated_by = $actorId;
                $trashed->save();

                return $trashed;
            }

            return SubscriptionPlan::query()->create([
                ...$payload,
                'created_by' => $actorId,
                'updated_by' => $actorId,
            ]);
        });

        return $this->show($plan->fresh());
    }

    /** @param  array<string, mixed>  $data
     *  @return array<string, mixed>
     */
    public function update(SubscriptionPlan $plan, array $data, int $actorId): array
    {
        $code = array_key_exists('code', $data)
            ? strtoupper(trim((string) $data['code']))
            : $plan->code;

        if ($code !== $plan->code) {
            $exists = SubscriptionPlan::withTrashed()
                ->where('code', $code)
                ->where('id', '!=', $plan->id)
                ->exists();
            if ($exists) {
                throw ValidationException::withMessages(['code' => ['Plan code already exists.']]);
            }
        }

        $plan->fill($this->normalize($data, $code, $plan));
        $plan->updated_by = $actorId;
        $plan->save();

        return $this->show($plan->fresh());
    }

    public function delete(SubscriptionPlan $plan): void
    {
        $active = TenantSubscription::query()
            ->where('plan_id', $plan->id)
            ->where('status', 'active')
            ->count();

        if ($active > 0) {
            throw ValidationException::withMessages([
                'plan' => ['Cannot delete a plan with active subscriptions. Deactivate it instead.'],
            ]);
        }

        $plan->delete();
    }

    /** @param  array{search?: ?string, status?: ?string}  $filters */
    protected function baseQuery(array $filters)
    {
        return SubscriptionPlan::query()
            ->withCount([
                'subscriptions as subscriptions_count',
                'subscriptions as active_subscriptions_count' => fn ($q) => $q->where('status', 'active'),
            ])
            ->when($filters['search'] ?? null, function ($q, $search) {
                $like = '%'.$search.'%';
                $q->where(function ($inner) use ($like) {
                    $inner->where('code', 'like', $like)
                        ->orWhere('name_en', 'like', $like)
                        ->orWhere('name_ar', 'like', $like);
                });
            })
            ->when(($filters['status'] ?? null) === 'active', fn ($q) => $q->where('is_active', true))
            ->when(($filters['status'] ?? null) === 'inactive', fn ($q) => $q->where('is_active', false));
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    protected function normalize(array $data, string $code, ?SubscriptionPlan $existing = null): array
    {
        $modules = $data['modules'] ?? $data['modules_json'] ?? $existing?->modules_json ?? [];
        if (is_string($modules)) {
            $modules = json_decode($modules, true) ?: [];
        }

        return [
            'code' => $code,
            'name_en' => trim((string) ($data['name_en'] ?? $existing?->name_en ?? '')),
            'name_ar' => trim((string) ($data['name_ar'] ?? $existing?->name_ar ?? $data['name_en'] ?? '')),
            'price' => (float) ($data['price'] ?? $existing?->price ?? 0),
            'currency' => strtoupper((string) ($data['currency'] ?? $existing?->currency ?? 'SAR')),
            'max_schools' => isset($data['max_schools']) ? (int) $data['max_schools'] : $existing?->max_schools,
            'max_campuses' => isset($data['max_campuses']) ? (int) $data['max_campuses'] : $existing?->max_campuses,
            'max_students' => isset($data['max_students']) ? (int) $data['max_students'] : $existing?->max_students,
            'max_teachers' => isset($data['max_teachers']) ? (int) $data['max_teachers'] : $existing?->max_teachers,
            'max_storage_mb' => isset($data['max_storage_mb']) ? (int) $data['max_storage_mb'] : $existing?->max_storage_mb,
            'modules_json' => $modules,
            'is_active' => array_key_exists('is_active', $data)
                ? (bool) $data['is_active']
                : ($existing?->is_active ?? true),
        ];
    }

    /** @return array<string, mixed> */
    protected function serialize(SubscriptionPlan $plan, bool $detailed = false): array
    {
        if (! $plan->relationLoaded('subscriptions') && $detailed) {
            $plan->loadCount([
                'subscriptions as subscriptions_count',
                'subscriptions as active_subscriptions_count' => fn ($q) => $q->where('status', 'active'),
            ]);
        }

        return [
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
            'modules' => $plan->modules_json ?? [],
            'is_active' => (bool) $plan->is_active,
            'status' => $plan->is_active ? 'active' : 'inactive',
            'usage' => [
                'subscriptions' => (int) ($plan->subscriptions_count ?? 0),
                'active_subscriptions' => (int) ($plan->active_subscriptions_count ?? 0),
            ],
            'created_at' => optional($plan->created_at)?->toIso8601String(),
            'updated_at' => optional($plan->updated_at)?->toIso8601String(),
        ];
    }
}
