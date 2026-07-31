<?php

namespace App\Domain\Organization\Policies;

use App\Domain\Identity\Services\RbacService;
use App\Domain\Organization\Models\Tenant;
use App\Models\User;

class TenantPolicy
{
    public function __construct(
        protected RbacService $rbac,
    ) {}

    public function viewAny(User $user): bool
    {
        return $this->rbac->can($user, 'platform.tenants.manage')
            || $this->rbac->hasRole($user, 'school_owner');
    }

    public function view(User $user, Tenant $tenant): bool
    {
        if ($this->rbac->can($user, 'platform.tenants.manage')) {
            return true;
        }

        return $this->rbac->hasRole($user, 'school_owner')
            && (int) $user->tenant_id === (int) $tenant->id;
    }

    public function create(User $user): bool
    {
        return $this->rbac->can($user, 'platform.tenants.manage');
    }

    public function update(User $user, Tenant $tenant): bool
    {
        if ($this->rbac->can($user, 'platform.tenants.manage')) {
            return true;
        }

        return $this->rbac->can($user, 'tenant.settings.manage')
            && (int) $user->tenant_id === (int) $tenant->id;
    }

    public function delete(User $user, Tenant $tenant): bool
    {
        return $this->rbac->can($user, 'platform.tenants.manage');
    }

    public function manageBilling(User $user, Tenant $tenant): bool
    {
        if ($this->rbac->can($user, 'platform.tenants.manage')) {
            return true;
        }

        return $this->rbac->can($user, 'tenant.billing.manage', $tenant->id)
            && (int) $user->tenant_id === (int) $tenant->id;
    }
}
