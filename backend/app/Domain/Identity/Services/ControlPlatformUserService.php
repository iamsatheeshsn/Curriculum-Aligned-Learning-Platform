<?php

namespace App\Domain\Identity\Services;

use App\Domain\Identity\Models\Role;
use App\Domain\Identity\Models\UserTenantRole;
use App\Domain\Organization\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class ControlPlatformUserService
{
    public const PLATFORM_ROLES = ['super_admin', 'customer_support', 'auditor'];

    public function __construct(
        protected RbacService $rbac,
    ) {}

    /**
     * @param  array{search?: ?string, status?: ?string, role?: ?string}  $filters
     * @return list<array<string, mixed>>
     */
    public function list(array $filters = []): array
    {
        $platformId = $this->platformTenantId();
        $roleIds = $this->platformRoleIds();

        $query = User::query()
            ->with([
                'tenantRoles' => fn ($q) => $q
                    ->where('tenant_id', $platformId)
                    ->whereIn('role_id', $roleIds)
                    ->with('role:id,code,name_en,name_ar,portal,level'),
            ])
            ->whereHas('tenantRoles', function ($q) use ($platformId, $roleIds) {
                $q->where('tenant_id', $platformId)->whereIn('role_id', $roleIds);
            })
            ->when($filters['search'] ?? null, function ($q, $search) {
                $like = '%'.$search.'%';
                $q->where(function ($inner) use ($like) {
                    $inner->where('email', 'like', $like)
                        ->orWhere('first_name', 'like', $like)
                        ->orWhere('last_name', 'like', $like)
                        ->orWhere('phone', 'like', $like);
                });
            })
            ->when($filters['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->when($filters['role'] ?? null, function ($q, $roleCode) use ($platformId) {
                $q->whereHas('tenantRoles', function ($tr) use ($platformId, $roleCode) {
                    $tr->where('tenant_id', $platformId)
                        ->whereHas('role', fn ($r) => $r->where('code', $roleCode));
                });
            })
            ->orderBy('email');

        return $query->get()->map(fn (User $user) => $this->serialize($user))->all();
    }

    /**
     * @return array{total: int, active: int, suspended: int, inactive: int, by_role: array<string, int>}
     */
    public function stats(): array
    {
        $platformId = $this->platformTenantId();
        $roleIds = $this->platformRoleIds();

        $base = User::query()->whereHas('tenantRoles', function ($q) use ($platformId, $roleIds) {
            $q->where('tenant_id', $platformId)->whereIn('role_id', $roleIds);
        });

        $byRole = [];
        foreach (self::PLATFORM_ROLES as $code) {
            $byRole[$code] = (int) (clone $base)
                ->whereHas('tenantRoles', function ($q) use ($platformId, $code) {
                    $q->where('tenant_id', $platformId)
                        ->whereHas('role', fn ($r) => $r->where('code', $code));
                })
                ->count();
        }

        return [
            'total' => (int) (clone $base)->count(),
            'active' => (int) (clone $base)->where('status', 'active')->count(),
            'suspended' => (int) (clone $base)->where('status', 'suspended')->count(),
            'inactive' => (int) (clone $base)->where('status', 'inactive')->count(),
            'by_role' => $byRole,
        ];
    }

    /**
     * @return list<array{code: string, name_en: string, name_ar: ?string}>
     */
    public function availableRoles(): array
    {
        return Role::query()
            ->whereIn('code', self::PLATFORM_ROLES)
            ->orderByDesc('level')
            ->get(['code', 'name_en', 'name_ar'])
            ->map(fn (Role $role) => [
                'code' => $role->code,
                'name_en' => $role->name_en,
                'name_ar' => $role->name_ar,
            ])
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    public function show(User $user): array
    {
        $this->assertPlatformUser($user);
        $user->load([
            'tenantRoles' => fn ($q) => $q
                ->where('tenant_id', $this->platformTenantId())
                ->whereIn('role_id', $this->platformRoleIds())
                ->with('role:id,code,name_en,name_ar,portal,level'),
        ]);

        return $this->serialize($user);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function create(array $data, int $actorId): array
    {
        $roleCode = $data['role_code'];
        if (! in_array($roleCode, self::PLATFORM_ROLES, true)) {
            throw ValidationException::withMessages([
                'role_code' => ['Role must be a platform control role.'],
            ]);
        }

        $email = strtolower(trim((string) $data['email']));
        $this->assertEmailAvailable($email);

        $platformId = $this->platformTenantId();
        $role = Role::query()->where('code', $roleCode)->firstOrFail();

        $user = DB::transaction(function () use ($data, $email, $actorId, $platformId, $role) {
            $user = User::query()->create([
                'tenant_id' => null,
                'email' => $email,
                'password' => Hash::make($data['password']),
                'first_name' => trim((string) $data['first_name']),
                'last_name' => trim((string) ($data['last_name'] ?? '')),
                'first_name_ar' => isset($data['first_name_ar']) ? trim((string) $data['first_name_ar']) ?: null : null,
                'last_name_ar' => isset($data['last_name_ar']) ? trim((string) $data['last_name_ar']) ?: null : null,
                'phone' => isset($data['phone']) ? trim((string) $data['phone']) ?: null : null,
                'locale' => $data['locale'] ?? 'en',
                'timezone' => $data['timezone'] ?? 'Asia/Riyadh',
                'status' => $data['status'] ?? 'active',
                'email_verified_at' => now(),
                'created_by' => $actorId,
                'updated_by' => $actorId,
            ]);

            UserTenantRole::query()->create([
                'user_id' => $user->id,
                'tenant_id' => $platformId,
                'role_id' => $role->id,
                'school_id' => null,
                'campus_id' => null,
                'created_by' => $actorId,
                'updated_by' => $actorId,
            ]);

            return $user;
        });

        $this->rbac->forgetUserCache($user);

        return $this->show($user->fresh());
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function update(User $user, array $data, int $actorId): array
    {
        $this->assertPlatformUser($user);

        if (array_key_exists('email', $data) && $data['email'] !== null) {
            $email = strtolower(trim((string) $data['email']));
            if ($email !== strtolower($user->email)) {
                $this->assertEmailAvailable($email, $user->id);
                $user->email = $email;
            }
        }

        foreach (['first_name', 'last_name', 'first_name_ar', 'last_name_ar', 'phone', 'locale', 'timezone'] as $field) {
            if (array_key_exists($field, $data)) {
                $value = $data[$field];
                $user->{$field} = is_string($value) ? (trim($value) ?: null) : $value;
            }
        }

        if (isset($data['first_name'])) {
            $user->first_name = trim((string) $data['first_name']);
        }
        if (array_key_exists('last_name', $data)) {
            $user->last_name = trim((string) ($data['last_name'] ?? ''));
        }

        if (isset($data['status']) && in_array($data['status'], ['active', 'suspended', 'inactive'], true)) {
            if ($data['status'] !== 'active' && $this->isLastActiveSuperAdmin($user)) {
                throw ValidationException::withMessages([
                    'status' => ['Cannot deactivate or suspend the last active Super Admin.'],
                ]);
            }
            $user->status = $data['status'];
        }

        if (! empty($data['password'])) {
            $user->password = Hash::make($data['password']);
        }

        $user->updated_by = $actorId;

        DB::transaction(function () use ($user, $data, $actorId) {
            $user->save();

            if (isset($data['role_code'])) {
                $this->syncPlatformRole($user, (string) $data['role_code'], $actorId);
            }
        });

        $this->rbac->forgetUserCache($user);

        return $this->show($user->fresh());
    }

    public function delete(User $user, int $actorId): void
    {
        $this->assertPlatformUser($user);

        if ($user->id === $actorId) {
            throw ValidationException::withMessages([
                'user' => ['You cannot delete your own account.'],
            ]);
        }

        if ($this->isLastSuperAdmin($user)) {
            throw ValidationException::withMessages([
                'user' => ['Cannot delete the last Super Admin.'],
            ]);
        }

        $platformId = $this->platformTenantId();
        $roleIds = $this->platformRoleIds();

        DB::transaction(function () use ($user, $platformId, $roleIds, $actorId) {
            UserTenantRole::query()
                ->where('user_id', $user->id)
                ->where('tenant_id', $platformId)
                ->whereIn('role_id', $roleIds)
                ->each(function (UserTenantRole $assignment) use ($actorId) {
                    $assignment->updated_by = $actorId;
                    $assignment->save();
                    $assignment->delete();
                });

            $user->updated_by = $actorId;
            $user->save();
            $user->delete();
        });

        $this->rbac->forgetUserCache($user);
    }

    protected function syncPlatformRole(User $user, string $roleCode, int $actorId): void
    {
        if (! in_array($roleCode, self::PLATFORM_ROLES, true)) {
            throw ValidationException::withMessages([
                'role_code' => ['Role must be a platform control role.'],
            ]);
        }

        $current = $this->primaryPlatformRole($user);
        if ($current === 'super_admin' && $roleCode !== 'super_admin' && $this->isLastSuperAdmin($user)) {
            throw ValidationException::withMessages([
                'role_code' => ['Cannot demote the last Super Admin.'],
            ]);
        }

        $platformId = $this->platformTenantId();
        $role = Role::query()->where('code', $roleCode)->firstOrFail();
        $roleIds = $this->platformRoleIds();

        UserTenantRole::query()
            ->where('user_id', $user->id)
            ->where('tenant_id', $platformId)
            ->whereIn('role_id', $roleIds)
            ->where('role_id', '!=', $role->id)
            ->get()
            ->each(function (UserTenantRole $assignment) use ($actorId) {
                $assignment->updated_by = $actorId;
                $assignment->save();
                $assignment->delete();
            });

        $existing = UserTenantRole::withTrashed()
            ->where('user_id', $user->id)
            ->where('tenant_id', $platformId)
            ->where('role_id', $role->id)
            ->whereNull('school_id')
            ->whereNull('campus_id')
            ->first();

        if ($existing) {
            if ($existing->trashed()) {
                $existing->restore();
            }
            $existing->forceFill(['updated_by' => $actorId])->save();
        } else {
            UserTenantRole::query()->create([
                'user_id' => $user->id,
                'tenant_id' => $platformId,
                'role_id' => $role->id,
                'school_id' => null,
                'campus_id' => null,
                'created_by' => $actorId,
                'updated_by' => $actorId,
            ]);
        }
    }

    protected function assertPlatformUser(User $user): void
    {
        $platformId = $this->platformTenantId();
        $roleIds = $this->platformRoleIds();

        $exists = UserTenantRole::query()
            ->where('user_id', $user->id)
            ->where('tenant_id', $platformId)
            ->whereIn('role_id', $roleIds)
            ->exists();

        if (! $exists) {
            abort(404, 'Platform user not found.');
        }
    }

    protected function assertEmailAvailable(string $email, ?int $ignoreId = null): void
    {
        $exists = User::query()
            ->where('email', $email)
            ->whereNull('tenant_id')
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages([
                'email' => ['A platform user with this email already exists.'],
            ]);
        }
    }

    protected function isLastSuperAdmin(User $user): bool
    {
        $role = Role::query()->where('code', 'super_admin')->first();
        if (! $role) {
            return false;
        }

        $hasSuper = UserTenantRole::query()
            ->where('user_id', $user->id)
            ->where('role_id', $role->id)
            ->exists();

        if (! $hasSuper) {
            return false;
        }

        $others = UserTenantRole::query()
            ->where('role_id', $role->id)
            ->where('user_id', '!=', $user->id)
            ->count();

        return $others === 0;
    }

    protected function isLastActiveSuperAdmin(User $user): bool
    {
        if (! $this->isLastSuperAdmin($user)) {
            return false;
        }

        return $user->status === 'active';
    }

    protected function primaryPlatformRole(User $user): ?string
    {
        $platformId = $this->platformTenantId();
        $roleIds = $this->platformRoleIds();

        $assignment = UserTenantRole::query()
            ->with('role:id,code,level')
            ->where('user_id', $user->id)
            ->where('tenant_id', $platformId)
            ->whereIn('role_id', $roleIds)
            ->get()
            ->sortByDesc(fn (UserTenantRole $a) => $a->role?->level ?? 0)
            ->first();

        return $assignment?->role?->code;
    }

    /**
     * @return array<string, mixed>
     */
    protected function serialize(User $user): array
    {
        $assignments = $user->relationLoaded('tenantRoles')
            ? $user->tenantRoles
            : $user->tenantRoles()
                ->where('tenant_id', $this->platformTenantId())
                ->whereIn('role_id', $this->platformRoleIds())
                ->with('role:id,code,name_en,name_ar,portal,level')
                ->get();

        $primary = $assignments
            ->sortByDesc(fn (UserTenantRole $a) => $a->role?->level ?? 0)
            ->first();

        $name = trim(($user->first_name ?? '').' '.($user->last_name ?? ''));

        return [
            'id' => $user->id,
            'email' => $user->email,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'first_name_ar' => $user->first_name_ar,
            'last_name_ar' => $user->last_name_ar,
            'name' => $name !== '' ? $name : $user->email,
            'phone' => $user->phone,
            'locale' => $user->locale,
            'timezone' => $user->timezone,
            'status' => $user->status,
            'role_code' => $primary?->role?->code,
            'role' => $primary?->role ? [
                'id' => $primary->role->id,
                'code' => $primary->role->code,
                'name_en' => $primary->role->name_en,
                'name_ar' => $primary->role->name_ar,
                'portal' => $primary->role->portal,
                'level' => $primary->role->level,
            ] : null,
            'roles' => $assignments->map(fn (UserTenantRole $a) => [
                'assignment_id' => $a->id,
                'code' => $a->role?->code,
                'name_en' => $a->role?->name_en,
            ])->values()->all(),
            'last_login_at' => optional($user->last_login_at)?->toIso8601String(),
            'email_verified_at' => optional($user->email_verified_at)?->toIso8601String(),
            'created_at' => optional($user->created_at)?->toIso8601String(),
            'updated_at' => optional($user->updated_at)?->toIso8601String(),
            'is_last_super_admin' => $this->isLastSuperAdmin($user),
        ];
    }

    protected function platformTenantId(): int
    {
        $platform = Tenant::query()->where('slug', 'platform')->first();
        if (! $platform) {
            throw ValidationException::withMessages([
                'tenant' => ['Platform tenant is missing.'],
            ]);
        }

        return (int) $platform->id;
    }

    /** @return list<int> */
    protected function platformRoleIds(): array
    {
        return Role::query()
            ->whereIn('code', self::PLATFORM_ROLES)
            ->pluck('id')
            ->all();
    }
}
