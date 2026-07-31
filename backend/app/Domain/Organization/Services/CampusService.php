<?php

namespace App\Domain\Organization\Services;

use App\Domain\Billing\Models\TenantSubscription;
use App\Domain\Organization\Models\Campus;
use App\Domain\Organization\Models\School;
use App\Domain\Organization\Models\Tenant;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CampusService
{
    /**
     * @param  array{search?: string|null, status?: string|null, tenant_id?: int|null, school_id?: int|null}  $filters
     * @return list<array<string, mixed>>
     */
    public function list(array $filters = []): array
    {
        $query = Campus::query()
            ->with([
                'school:id,tenant_id,code,name_en,name_ar,status',
                'tenant:id,slug,name,status',
            ])
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'));

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['tenant_id'])) {
            $query->where('tenant_id', (int) $filters['tenant_id']);
        }

        if (! empty($filters['school_id'])) {
            $query->where('school_id', (int) $filters['school_id']);
        }

        if (! empty($filters['search'])) {
            $term = '%'.trim((string) $filters['search']).'%';
            $query->where(function ($q) use ($term) {
                $q->where('name_en', 'like', $term)
                    ->orWhere('name_ar', 'like', $term)
                    ->orWhere('code', 'like', $term)
                    ->orWhere('address', 'like', $term)
                    ->orWhereHas('school', fn ($sq) => $sq->where('name_en', 'like', $term)->orWhere('code', 'like', $term))
                    ->orWhereHas('tenant', fn ($tq) => $tq->where('name', 'like', $term)->orWhere('slug', 'like', $term));
            });
        }

        return $query->orderBy('name_en')
            ->get()
            ->map(fn (Campus $campus) => $this->serialize($campus))
            ->all();
    }

    /** @return array<string, mixed> */
    public function show(Campus $campus): array
    {
        $campus->load([
            'school:id,tenant_id,code,name_en,name_ar,status,timezone',
            'tenant:id,slug,name,status',
        ]);

        return $this->serialize($campus, true);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function create(array $data): array
    {
        $school = School::query()
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'))
            ->findOrFail((int) $data['school_id']);

        $this->assertWithinPlanLimit($school->tenant_id);

        $code = $this->uniqueCode($school->id, $data['code'] ?? null, $data['name_en']);

        $campus = Campus::query()->create([
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'code' => $code,
            'name_en' => $data['name_en'],
            'name_ar' => $data['name_ar'] ?? $data['name_en'],
            'timezone' => $data['timezone'] ?? $school->timezone,
            'address' => $data['address'] ?? null,
            'status' => $data['status'] ?? 'active',
        ]);

        return $this->show($campus->fresh());
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function update(Campus $campus, array $data): array
    {
        if (array_key_exists('school_id', $data) && (int) $data['school_id'] !== (int) $campus->school_id) {
            $school = School::query()
                ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'))
                ->findOrFail((int) $data['school_id']);
            $campus->school_id = $school->id;
            $campus->tenant_id = $school->tenant_id;
        }

        if (array_key_exists('code', $data) && $data['code']) {
            $data['code'] = $this->uniqueCode(
                (int) $campus->school_id,
                (string) $data['code'],
                $data['name_en'] ?? $campus->name_en,
                $campus->id
            );
        }

        $campus->fill(collect($data)->only([
            'code', 'name_en', 'name_ar', 'timezone', 'address', 'status',
        ])->all())->save();

        return $this->show($campus->fresh());
    }

    public function delete(Campus $campus): void
    {
        $campus->delete();
    }

    /** @return array<string, int> */
    public function stats(): array
    {
        $base = Campus::query()
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'));

        return [
            'total_campuses' => (int) (clone $base)->count(),
            'active' => (int) (clone $base)->where('status', 'active')->count(),
            'inactive' => (int) (clone $base)->where('status', 'inactive')->count(),
            'schools' => (int) School::query()
                ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'))
                ->count(),
            'tenants_with_campuses' => (int) (clone $base)->distinct('tenant_id')->count('tenant_id'),
        ];
    }

    /**
     * @return list<array{id: int, name: string, slug: string, status: string, schools: list<array{id: int, code: string, name_en: string, status: string}>}>
     */
    public function availableSchools(): array
    {
        return Tenant::query()
            ->where('slug', '!=', 'platform')
            ->with(['schools' => fn ($q) => $q->orderBy('name_en')])
            ->orderBy('name')
            ->get()
            ->map(fn (Tenant $t) => [
                'id' => $t->id,
                'name' => $t->name,
                'slug' => $t->slug,
                'status' => $t->status,
                'schools' => $t->schools->map(fn (School $s) => [
                    'id' => $s->id,
                    'code' => $s->code,
                    'name_en' => $s->name_en,
                    'status' => $s->status,
                ])->values()->all(),
            ])
            ->all();
    }

    /** @return array<string, mixed> */
    public function serialize(Campus $campus, bool $detailed = false): array
    {
        $payload = [
            'id' => $campus->id,
            'code' => $campus->code,
            'name_en' => $campus->name_en,
            'name_ar' => $campus->name_ar,
            'timezone' => $campus->timezone,
            'address' => $campus->address,
            'status' => $campus->status,
            'tenant_id' => $campus->tenant_id,
            'school_id' => $campus->school_id,
            'tenant' => $campus->relationLoaded('tenant') && $campus->tenant
                ? [
                    'id' => $campus->tenant->id,
                    'name' => $campus->tenant->name,
                    'slug' => $campus->tenant->slug,
                    'status' => $campus->tenant->status,
                ]
                : null,
            'school' => $campus->relationLoaded('school') && $campus->school
                ? [
                    'id' => $campus->school->id,
                    'code' => $campus->school->code,
                    'name_en' => $campus->school->name_en,
                    'name_ar' => $campus->school->name_ar ?? null,
                    'status' => $campus->school->status,
                    'timezone' => $campus->school->timezone ?? null,
                ]
                : null,
            'created_at' => optional($campus->created_at)?->toIso8601String(),
            'updated_at' => optional($campus->updated_at)?->toIso8601String(),
        ];

        if ($detailed) {
            $payload['plan_limit'] = $this->planLimitSnapshot((int) $campus->tenant_id);
        }

        return $payload;
    }

    /** @return array{max_campuses: int|null, current: int} */
    protected function planLimitSnapshot(int $tenantId): array
    {
        $subscription = TenantSubscription::query()
            ->with('plan:id,code,name_en,max_campuses')
            ->where('tenant_id', $tenantId)
            ->where('status', 'active')
            ->latest('id')
            ->first();

        $current = Campus::query()->where('tenant_id', $tenantId)->count();

        return [
            'max_campuses' => $subscription?->plan?->max_campuses !== null
                ? (int) $subscription->plan->max_campuses
                : null,
            'current' => $current,
            'plan_code' => $subscription?->plan?->code,
            'plan_name' => $subscription?->plan?->name_en,
        ];
    }

    protected function assertWithinPlanLimit(int $tenantId): void
    {
        $snapshot = $this->planLimitSnapshot($tenantId);
        if ($snapshot['max_campuses'] === null) {
            return;
        }

        if ($snapshot['current'] >= $snapshot['max_campuses']) {
            throw ValidationException::withMessages([
                'school_id' => [
                    "Campus limit reached for this organisation ({$snapshot['current']}/{$snapshot['max_campuses']}).",
                ],
            ]);
        }
    }

    protected function uniqueCode(int $schoolId, ?string $code, string $name, ?int $ignoreId = null): string
    {
        $base = strtoupper(Str::slug($code ?: $name, '_')) ?: 'CAMPUS';
        $base = substr(preg_replace('/[^A-Z0-9_]/', '', $base) ?: 'CAMPUS', 0, 64);
        $candidate = $base;
        $i = 2;
        while (
            Campus::withTrashed()
                ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
                ->where('school_id', $schoolId)
                ->where('code', $candidate)
                ->exists()
        ) {
            $suffix = '_'.$i;
            $candidate = substr($base, 0, 64 - strlen($suffix)).$suffix;
            $i++;
        }

        return $candidate;
    }
}
