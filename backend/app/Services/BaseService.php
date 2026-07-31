<?php

namespace App\Services;

use App\Contracts\Services\ServiceInterface;
use App\Support\TenantContext;
use Illuminate\Support\Facades\DB;

abstract class BaseService implements ServiceInterface
{
    public function __construct(
        protected TenantContext $tenantContext,
    ) {}

    /**
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     */
    protected function transaction(callable $callback): mixed
    {
        return DB::transaction($callback);
    }

    protected function tenantId(): ?int
    {
        return $this->tenantContext->tenantId();
    }

    protected function schoolId(): ?int
    {
        return $this->tenantContext->schoolId();
    }
}
