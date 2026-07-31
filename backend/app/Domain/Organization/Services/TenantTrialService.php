<?php

namespace App\Domain\Organization\Services;

use App\Domain\Billing\Models\TenantSubscription;
use App\Domain\Organization\Models\Tenant;
use Illuminate\Validation\ValidationException;

class TenantTrialService
{
    /**
     * @param  array{search?: string|null, filter?: string|null}  $filters
     * @return list<array<string, mixed>>
     */
    public function list(array $filters = []): array
    {
        $filter = $filters['filter'] ?? 'all';

        $query = Tenant::query()
            ->where('slug', '!=', 'platform')
            ->withCount('schools')
            ->with(['subscriptions' => fn ($q) => $q->where('status', 'active')->with('plan')->latest('id')->limit(1)]);

        $query->where(function ($q) use ($filter) {
            match ($filter) {
                'active' => $q->where('status', 'trial')
                    ->where(function ($inner) {
                        $inner->whereNull('trial_ends_at')
                            ->orWhere('trial_ends_at', '>', now());
                    }),
                'ending_soon' => $q->where('status', 'trial')
                    ->whereNotNull('trial_ends_at')
                    ->whereBetween('trial_ends_at', [now(), now()->addDays(7)]),
                'expired' => $q->where('status', 'trial')
                    ->whereNotNull('trial_ends_at')
                    ->where('trial_ends_at', '<=', now()),
                'converted' => $q->where('status', 'active')
                    ->whereNotNull('trial_ends_at'),
                default => $q->where(function ($inner) {
                    $inner->where('status', 'trial')
                        ->orWhere(function ($converted) {
                            $converted->where('status', 'active')->whereNotNull('trial_ends_at');
                        });
                }),
            };
        });

        if (! empty($filters['search'])) {
            $term = '%'.trim((string) $filters['search']).'%';
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', $term)
                    ->orWhere('slug', 'like', $term)
                    ->orWhere('legal_name', 'like', $term);
            });
        }

        return $query
            ->orderByRaw("CASE WHEN status = 'trial' THEN 0 ELSE 1 END")
            ->orderByRaw('CASE WHEN trial_ends_at IS NULL THEN 1 ELSE 0 END')
            ->orderBy('trial_ends_at')
            ->get()
            ->map(fn (Tenant $tenant) => $this->serialize($tenant))
            ->all();
    }

    /** @return array<string, mixed> */
    public function show(Tenant $tenant): array
    {
        $tenant->load(['subscriptions' => fn ($q) => $q->with('plan')->latest('id')->limit(3)]);

        return $this->serialize($tenant, true);
    }

    /**
     * @return array<string, int>
     */
    public function stats(): array
    {
        $base = Tenant::query()->where('slug', '!=', 'platform');

        $onTrial = (clone $base)->where('status', 'trial');

        return [
            'total_tracked' => (int) (clone $base)
                ->where(function ($q) {
                    $q->where('status', 'trial')
                        ->orWhere(function ($c) {
                            $c->where('status', 'active')->whereNotNull('trial_ends_at');
                        });
                })
                ->count(),
            'active_trials' => (int) (clone $onTrial)
                ->where(function ($q) {
                    $q->whereNull('trial_ends_at')->orWhere('trial_ends_at', '>', now());
                })
                ->count(),
            'ending_soon' => (int) (clone $onTrial)
                ->whereNotNull('trial_ends_at')
                ->whereBetween('trial_ends_at', [now(), now()->addDays(7)])
                ->count(),
            'expired' => (int) (clone $onTrial)
                ->whereNotNull('trial_ends_at')
                ->where('trial_ends_at', '<=', now())
                ->count(),
            'converted' => (int) (clone $base)
                ->where('status', 'active')
                ->whereNotNull('trial_ends_at')
                ->count(),
        ];
    }

    public function extend(Tenant $tenant, int $days, ?int $actorId = null): Tenant
    {
        $this->assertNotPlatform($tenant);

        if ($days < 1 || $days > 365) {
            throw ValidationException::withMessages([
                'days' => ['Trial extension must be between 1 and 365 days.'],
            ]);
        }

        $base = $tenant->trial_ends_at && $tenant->trial_ends_at->isFuture()
            ? $tenant->trial_ends_at->copy()
            : now();

        $tenant->forceFill([
            'status' => 'trial',
            'trial_ends_at' => $base->addDays($days),
            'updated_by' => $actorId,
        ])->save();

        return $tenant->fresh();
    }

    public function convert(Tenant $tenant, ?int $actorId = null): Tenant
    {
        $this->assertNotPlatform($tenant);

        $tenant->forceFill([
            'status' => 'active',
            'updated_by' => $actorId,
        ])->save();

        return $tenant->fresh();
    }

    public function putOnTrial(Tenant $tenant, int $days = 14, ?int $actorId = null): Tenant
    {
        $this->assertNotPlatform($tenant);

        if ($days < 1 || $days > 365) {
            throw ValidationException::withMessages([
                'days' => ['Trial length must be between 1 and 365 days.'],
            ]);
        }

        $tenant->forceFill([
            'status' => 'trial',
            'trial_ends_at' => now()->addDays($days),
            'updated_by' => $actorId,
        ])->save();

        return $tenant->fresh();
    }

    /** @return array<string, mixed> */
    public function serialize(Tenant $tenant, bool $detailed = false): array
    {
        $daysRemaining = null;
        if ($tenant->trial_ends_at) {
            $daysRemaining = (int) now()->startOfDay()->diffInDays(
                $tenant->trial_ends_at->copy()->startOfDay(),
                false
            );
        }

        $urgency = $this->urgency($tenant, $daysRemaining);
        $activeSub = $tenant->relationLoaded('subscriptions')
            ? $tenant->subscriptions->first()
            : TenantSubscription::query()
                ->with('plan')
                ->where('tenant_id', $tenant->id)
                ->where('status', 'active')
                ->latest('id')
                ->first();

        $payload = [
            'id' => $tenant->id,
            'name' => $tenant->name,
            'slug' => $tenant->slug,
            'legal_name' => $tenant->legal_name,
            'status' => $tenant->status,
            'trial_ends_at' => optional($tenant->trial_ends_at)?->toIso8601String(),
            'days_remaining' => $daysRemaining,
            'urgency' => $urgency,
            'schools_count' => (int) ($tenant->schools_count ?? $tenant->schools()->count()),
            'subscription' => $activeSub ? [
                'id' => $activeSub->id,
                'status' => $activeSub->status,
                'plan' => $activeSub->plan ? [
                    'code' => $activeSub->plan->code,
                    'name_en' => $activeSub->plan->name_en,
                    'price' => $activeSub->plan->price,
                    'currency' => $activeSub->plan->currency,
                ] : null,
            ] : null,
            'created_at' => optional($tenant->created_at)?->toIso8601String(),
            'updated_at' => optional($tenant->updated_at)?->toIso8601String(),
        ];

        if ($detailed) {
            $payload['default_locale'] = $tenant->default_locale;
            $payload['default_timezone'] = $tenant->default_timezone;
        }

        return $payload;
    }

    protected function urgency(Tenant $tenant, ?int $daysRemaining): string
    {
        if ($tenant->status === 'active') {
            return 'converted';
        }

        if ($tenant->status !== 'trial') {
            return 'other';
        }

        if ($daysRemaining === null) {
            return 'active';
        }

        if ($daysRemaining < 0) {
            return 'expired';
        }

        if ($daysRemaining <= 7) {
            return 'ending_soon';
        }

        return 'active';
    }

    protected function assertNotPlatform(Tenant $tenant): void
    {
        if ($tenant->slug === 'platform') {
            throw ValidationException::withMessages([
                'tenant' => ['The platform tenant cannot be modified this way.'],
            ]);
        }
    }
}
