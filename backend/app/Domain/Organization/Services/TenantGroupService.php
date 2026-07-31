<?php

namespace App\Domain\Organization\Services;

use App\Domain\Organization\Models\Tenant;
use App\Domain\Organization\Models\TenantGroup;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class TenantGroupService
{
    /** @param array{search?: string|null, status?: string|null} $filters
     * @return list<array<string, mixed>>
     */
    public function list(array $filters = []): array
    {
        $query = TenantGroup::query()->withCount([
            'tenants as members_count' => fn ($q) => $q->where('slug', '!=', 'platform'),
        ]);

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['search'])) {
            $term = '%'.trim((string) $filters['search']).'%';
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', $term)
                    ->orWhere('slug', 'like', $term)
                    ->orWhere('description', 'like', $term);
            });
        }

        return $query->orderBy('name')
            ->get()
            ->map(fn (TenantGroup $group) => $this->serialize($group))
            ->all();
    }

    /** @return array<string, mixed> */
    public function show(TenantGroup $group): array
    {
        $group->loadCount([
            'tenants as members_count' => fn ($q) => $q->where('slug', '!=', 'platform'),
        ]);
        $group->load(['tenants' => fn ($q) => $q->where('slug', '!=', 'platform')->orderBy('name')]);

        return $this->serialize($group, true);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function create(array $data): array
    {
        $slug = $this->uniqueSlug($data['slug'] ?? null, $data['name']);

        $group = TenantGroup::query()->create([
            'name' => $data['name'],
            'slug' => $slug,
            'description' => $data['description'] ?? null,
            'status' => $data['status'] ?? 'active',
            'country_code' => isset($data['country_code']) ? strtoupper((string) $data['country_code']) : null,
            'notes' => $data['notes'] ?? null,
        ]);

        if (! empty($data['tenant_ids']) && is_array($data['tenant_ids'])) {
            $this->syncMembers($group, array_map('intval', $data['tenant_ids']));
        }

        return $this->show($group->fresh());
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function update(TenantGroup $group, array $data): array
    {
        if (array_key_exists('slug', $data) && $data['slug']) {
            $data['slug'] = $this->uniqueSlug((string) $data['slug'], $data['name'] ?? $group->name, $group->id);
        }

        if (isset($data['country_code'])) {
            $data['country_code'] = strtoupper((string) $data['country_code']);
        }

        $group->fill(collect($data)->only([
            'name', 'slug', 'description', 'status', 'country_code', 'notes',
        ])->all())->save();

        if (array_key_exists('tenant_ids', $data) && is_array($data['tenant_ids'])) {
            $this->syncMembers($group, array_map('intval', $data['tenant_ids']));
        }

        return $this->show($group->fresh());
    }

    public function delete(TenantGroup $group): void
    {
        DB::transaction(function () use ($group) {
            Tenant::query()
                ->where('tenant_group_id', $group->id)
                ->update(['tenant_group_id' => null]);
            $group->delete();
        });
    }

    /**
     * @param  list<int>  $tenantIds
     * @return array<string, mixed>
     */
    public function syncMembers(TenantGroup $group, array $tenantIds): array
    {
        $tenantIds = array_values(array_unique(array_filter($tenantIds)));

        $validIds = Tenant::query()
            ->where('slug', '!=', 'platform')
            ->whereIn('id', $tenantIds)
            ->pluck('id')
            ->all();

        if (count($validIds) !== count($tenantIds)) {
            throw ValidationException::withMessages([
                'tenant_ids' => ['One or more tenants are invalid.'],
            ]);
        }

        DB::transaction(function () use ($group, $validIds) {
            Tenant::query()
                ->where('tenant_group_id', $group->id)
                ->whereNotIn('id', $validIds)
                ->update(['tenant_group_id' => null]);

            if ($validIds !== []) {
                Tenant::query()
                    ->whereIn('id', $validIds)
                    ->update(['tenant_group_id' => $group->id]);
            }
        });

        return $this->show($group->fresh());
    }

    /** @return array<string, int> */
    public function stats(): array
    {
        $base = TenantGroup::query();

        return [
            'total_groups' => (int) (clone $base)->count(),
            'active' => (int) (clone $base)->where('status', 'active')->count(),
            'inactive' => (int) (clone $base)->where('status', 'inactive')->count(),
            'members' => (int) Tenant::query()
                ->where('slug', '!=', 'platform')
                ->whereNotNull('tenant_group_id')
                ->count(),
            'ungrouped' => (int) Tenant::query()
                ->where('slug', '!=', 'platform')
                ->whereNull('tenant_group_id')
                ->count(),
        ];
    }

    /**
     * @return list<array{id: int, name: string, slug: string, status: string, tenant_group_id: int|null}>
     */
    public function availableTenants(): array
    {
        return Tenant::query()
            ->where('slug', '!=', 'platform')
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'status', 'tenant_group_id'])
            ->map(fn (Tenant $t) => [
                'id' => $t->id,
                'name' => $t->name,
                'slug' => $t->slug,
                'status' => $t->status,
                'tenant_group_id' => $t->tenant_group_id,
            ])
            ->all();
    }

    /** @return array<string, mixed> */
    public function serialize(TenantGroup $group, bool $withMembers = false): array
    {
        $payload = [
            'id' => $group->id,
            'name' => $group->name,
            'slug' => $group->slug,
            'description' => $group->description,
            'status' => $group->status,
            'country_code' => $group->country_code,
            'notes' => $group->notes,
            'members_count' => (int) ($group->members_count ?? $group->tenants()->where('slug', '!=', 'platform')->count()),
            'created_at' => optional($group->created_at)?->toIso8601String(),
            'updated_at' => optional($group->updated_at)?->toIso8601String(),
        ];

        if ($withMembers) {
            $payload['members'] = $group->tenants
                ->filter(fn (Tenant $t) => $t->slug !== 'platform')
                ->values()
                ->map(fn (Tenant $t) => [
                    'id' => $t->id,
                    'name' => $t->name,
                    'slug' => $t->slug,
                    'status' => $t->status,
                    'schools_count' => $t->schools()->count(),
                ])
                ->all();
        }

        return $payload;
    }

    protected function uniqueSlug(?string $slug, string $name, ?int $ignoreId = null): string
    {
        $base = Str::slug($slug ?: $name) ?: 'group';
        $candidate = $base;
        $i = 2;
        while (
            TenantGroup::withTrashed()
                ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
                ->where('slug', $candidate)
                ->exists()
        ) {
            $candidate = $base.'-'.$i;
            $i++;
        }

        return $candidate;
    }
}
