<?php

namespace App\Policies;

use App\Domain\Identity\Services\RbacService;
use App\Models\User;

/**
 * Generic permission-backed policy helpers for domain resources.
 */
class RbacPolicy
{
    public function __construct(
        protected RbacService $rbac,
    ) {}

    protected function allow(User $user, string $permission, ?int $tenantId = null): bool
    {
        return $this->rbac->can($user, $permission, $tenantId ?? $user->tenant_id);
    }
}
