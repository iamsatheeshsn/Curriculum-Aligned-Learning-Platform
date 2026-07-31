<?php

namespace App\Domain\Identity\Services;

use App\Domain\Identity\Models\Permission;
use App\Domain\Identity\Models\Role;
use App\Models\User;
use App\Support\TenantContext;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

class RbacService
{
    public function __construct(
        protected TenantContext $tenantContext,
    ) {}

    public function resolveRoleCode(string $code): string
    {
        $aliases = config('rbac.aliases', []);

        return $aliases[$code] ?? $code;
    }

    /** @return list<string> */
    public function roleCodesFor(User $user, ?int $tenantId = null): array
    {
        $query = $user->tenantRoles()->with('role');
        if ($tenantId !== null) {
            $query->where(function ($q) use ($tenantId) {
                $q->where('tenant_id', $tenantId)
                    ->orWhereHas('role', fn ($r) => $r->where('code', 'super_admin'));
            });
        }

        return $query->get()
            ->pluck('role.code')
            ->filter()
            ->map(fn (string $code) => $this->resolveRoleCode($code))
            ->unique()
            ->values()
            ->all();
    }

    public function hasRole(User $user, string $roleCode, ?int $tenantId = null): bool
    {
        $roleCode = $this->resolveRoleCode($roleCode);
        $codes = $this->roleCodesFor($user, $tenantId);

        return in_array($roleCode, $codes, true)
            || ($roleCode === 'school_owner' && in_array('tenant_owner', $this->rawRoleCodes($user), true));
    }

    public function hasAnyRole(User $user, array $roleCodes, ?int $tenantId = null): bool
    {
        foreach ($roleCodes as $code) {
            if ($this->hasRole($user, $code, $tenantId)) {
                return true;
            }
        }

        return false;
    }

    /** @return list<string> */
    public function permissionsFor(User $user, ?int $tenantId = null): array
    {
        $cacheKey = sprintf('rbac:perms:%d:%s', $user->id, $tenantId ?? 'all');

        return Cache::remember($cacheKey, 300, function () use ($user, $tenantId) {
            $roleIds = $user->tenantRoles()
                ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
                ->pluck('role_id');

            // Super admin roles may be on platform tenant
            if ($user->tenant_id === null) {
                $roleIds = $user->tenantRoles()->pluck('role_id');
            }

            $roles = Role::query()->with('permissions')->whereIn('id', $roleIds)->get();
            $permissions = [];

            foreach ($roles as $role) {
                $codes = config('rbac.matrix.'.$this->resolveRoleCode($role->code), []);
                if ($codes === ['*'] || in_array('*', $codes, true)) {
                    return Permission::query()->pluck('code')->all();
                }

                foreach ($role->permissions as $permission) {
                    $permissions[] = $permission->code;
                }
            }

            return array_values(array_unique($permissions));
        });
    }

    public function can(User $user, string $permission, ?int $tenantId = null): bool
    {
        $permissions = $this->permissionsFor($user, $tenantId ?? $user->tenant_id);

        return in_array($permission, $permissions, true);
    }

    public function authorize(User $user, string $permission, ?int $tenantId = null): void
    {
        if (! $this->can($user, $permission, $tenantId)) {
            abort(403, 'Missing permission: '.$permission);
        }
    }

    public function forgetUserCache(User $user): void
    {
        Cache::forget(sprintf('rbac:perms:%d:all', $user->id));
        if ($user->tenant_id) {
            Cache::forget(sprintf('rbac:perms:%d:%d', $user->id, $user->tenant_id));
        }
    }

    /** @return Collection<int, Role> */
    public function hierarchyTree(): Collection
    {
        return Role::query()
            ->with(['parent', 'children'])
            ->orderByDesc('level')
            ->orderBy('code')
            ->get();
    }

    /** @return list<string> */
    private function rawRoleCodes(User $user): array
    {
        return $user->tenantRoles()->with('role')->get()->pluck('role.code')->filter()->all();
    }
}
