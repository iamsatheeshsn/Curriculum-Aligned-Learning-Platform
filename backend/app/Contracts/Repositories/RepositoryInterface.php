<?php

namespace App\Contracts\Repositories;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

/**
 * @template TModel of Model
 */
interface RepositoryInterface
{
    /** @return TModel|null */
    public function find(int|string $id): ?Model;

    /** @return TModel */
    public function findOrFail(int|string $id): Model;

    /** @return Collection<int, TModel> */
    public function all(array $columns = ['*']): Collection;

    /** @param array<string, mixed> $data @return TModel */
    public function create(array $data): Model;

    /** @param array<string, mixed> $data @return TModel */
    public function update(int|string $id, array $data): Model;

    public function delete(int|string $id): bool;

    /** @param array<string, mixed> $filters */
    public function paginate(array $filters = [], int $perPage = 10): LengthAwarePaginator;
}
