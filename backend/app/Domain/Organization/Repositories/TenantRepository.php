<?php

namespace App\Domain\Organization\Repositories;

use App\Domain\Organization\Models\Tenant;
use App\Repositories\Eloquent\BaseRepository;
use Illuminate\Database\Eloquent\Builder;

/** @extends BaseRepository<Tenant> */
class TenantRepository extends BaseRepository
{
    public function __construct(Tenant $model)
    {
        parent::__construct($model);
    }

    public function findBySlug(string $slug): ?Tenant
    {
        return $this->query()->where('slug', $slug)->first();
    }

    protected function applyFilters(Builder $query, array $filters): void
    {
        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function (Builder $q) use ($search): void {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('slug', 'like', "%{$search}%");
            });
        }

        if (! empty($filters['exclude_platform'])) {
            $query->where('slug', '!=', 'platform');
        }

        $query->latest('id');
    }
}
