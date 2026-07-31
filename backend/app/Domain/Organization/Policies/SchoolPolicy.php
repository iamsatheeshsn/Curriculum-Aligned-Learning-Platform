<?php

namespace App\Domain\Organization\Policies;

use App\Domain\Identity\Services\RbacService;
use App\Domain\Organization\Models\School;
use App\Models\User;

class SchoolPolicy
{
    public function __construct(
        protected RbacService $rbac,
    ) {}

    public function viewAny(User $user): bool
    {
        return $this->rbac->can($user, 'school.users.view')
            || $this->rbac->can($user, 'tenant.schools.manage')
            || $this->rbac->can($user, 'school.settings.manage');
    }

    public function view(User $user, School $school): bool
    {
        if (! $this->sameTenant($user, $school) && ! $this->rbac->hasRole($user, 'super_admin')) {
            return false;
        }

        return $this->viewAny($user);
    }

    public function create(User $user): bool
    {
        return $this->rbac->can($user, 'tenant.schools.manage');
    }

    public function update(User $user, School $school): bool
    {
        return $this->sameTenant($user, $school)
            && ($this->rbac->can($user, 'school.settings.manage')
                || $this->rbac->can($user, 'tenant.schools.manage'));
    }

    public function delete(User $user, School $school): bool
    {
        return $this->sameTenant($user, $school)
            && $this->rbac->can($user, 'tenant.schools.manage');
    }

    public function manageUsers(User $user, School $school): bool
    {
        return $this->sameTenant($user, $school)
            && $this->rbac->can($user, 'school.users.manage');
    }

    private function sameTenant(User $user, School $school): bool
    {
        return $user->tenant_id !== null
            && (int) $user->tenant_id === (int) $school->tenant_id;
    }
}
