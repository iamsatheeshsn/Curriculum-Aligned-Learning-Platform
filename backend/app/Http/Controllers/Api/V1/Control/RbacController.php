<?php

namespace App\Http\Controllers\Api\V1\Control;

use App\Domain\Identity\Models\Permission;
use App\Domain\Identity\Models\Role;
use App\Domain\Identity\Models\UserTenantRole;
use App\Domain\Identity\Services\RbacService;
use App\Domain\Organization\Models\Tenant;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class RbacController extends Controller
{
    public function __construct(
        protected RbacService $rbac,
    ) {}

    public function roles(): JsonResponse
    {
        $roles = Role::query()
            ->with(['parent:id,code,name_en', 'permissions:id,code,group_code,name_en'])
            ->orderByDesc('level')
            ->get([
                'id',
                'code',
                'name_en',
                'name_ar',
                'portal',
                'level',
                'parent_role_id',
                'description_en',
                'description_ar',
                'is_system',
            ]);

        $data = $roles->map(function (Role $role) {
            $permissionCodes = $role->permissions->pluck('code')->values()->all();
            $configCodes = config('rbac.matrix.'.$this->rbac->resolveRoleCode($role->code), []);
            $isWildcard = $configCodes === ['*'] || in_array('*', $configCodes, true);

            return [
                'id' => $role->id,
                'code' => $role->code,
                'name_en' => $role->name_en,
                'name_ar' => $role->name_ar,
                'portal' => $role->portal,
                'level' => $role->level,
                'parent_role_id' => $role->parent_role_id,
                'parent' => $role->parent,
                'description_en' => $role->description_en,
                'description_ar' => $role->description_ar,
                'is_system' => (bool) $role->is_system,
                'is_wildcard' => $isWildcard,
                'permission_codes' => $isWildcard ? ['*'] : $permissionCodes,
                'permissions_count' => $isWildcard
                    ? Permission::query()->count()
                    : count($permissionCodes),
            ];
        });

        return response()->json(['data' => $data]);
    }

    public function permissions(): JsonResponse
    {
        $permissions = Permission::query()
            ->orderBy('group_code')
            ->orderBy('code')
            ->get(['id', 'code', 'group_code', 'name_en', 'name_ar']);

        $grouped = $permissions->groupBy('group_code')->map(fn ($items, $group) => [
            'group' => $group,
            'permissions' => $items->values(),
        ])->values();

        return response()->json([
            'data' => $permissions,
            'grouped' => $grouped,
        ]);
    }

    public function matrix(): JsonResponse
    {
        $roles = Role::query()
            ->with('permissions:id,code')
            ->orderByDesc('level')
            ->get(['id', 'code', 'name_en', 'portal', 'level', 'is_system']);

        $live = [];
        foreach ($roles as $role) {
            $configCodes = config('rbac.matrix.'.$this->rbac->resolveRoleCode($role->code), []);
            if ($configCodes === ['*'] || in_array('*', $configCodes, true)) {
                $live[$role->code] = ['*'];
            } else {
                $live[$role->code] = $role->permissions->pluck('code')->values()->all();
            }
        }

        return response()->json([
            'data' => [
                'hierarchy' => config('rbac.hierarchy'),
                'matrix' => $live,
                'config_matrix' => config('rbac.matrix'),
                'aliases' => config('rbac.aliases'),
            ],
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'data' => [
                'roles' => $this->rbac->roleCodesFor($user),
                'permissions' => $this->rbac->permissionsFor($user, $user->tenant_id),
            ],
        ]);
    }

    public function syncRolePermissions(Request $request, Role $role): JsonResponse
    {
        $this->assertCanManageRbac($request->user());

        if ($role->code === 'super_admin') {
            throw ValidationException::withMessages([
                'role' => ['Super Admin always has full access and cannot be edited.'],
            ]);
        }

        $data = $request->validate([
            'permission_codes' => ['required', 'array'],
            'permission_codes.*' => ['string', Rule::exists('permissions', 'code')],
        ]);

        $permissionIds = Permission::query()
            ->whereIn('code', $data['permission_codes'])
            ->pluck('id')
            ->all();

        DB::transaction(function () use ($role, $permissionIds) {
            $role->permissions()->sync($permissionIds);
        });

        $this->forgetRoleCaches($role);

        $role->load('permissions:id,code,group_code,name_en');

        return response()->json([
            'message' => 'Role permissions updated.',
            'data' => [
                'id' => $role->id,
                'code' => $role->code,
                'permission_codes' => $role->permissions->pluck('code')->values()->all(),
            ],
        ]);
    }

    public function assignments(Request $request): JsonResponse
    {
        $actor = $request->user();
        $isPlatform = $this->rbac->can($actor, 'platform.rbac.manage')
            || $this->rbac->hasRole($actor, 'super_admin');

        $validated = $request->validate([
            'tenant_id' => ['nullable', 'integer', 'exists:tenants,id'],
            'search' => ['nullable', 'string', 'max:120'],
            'role' => ['nullable', 'string', 'max:64'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $tenantId = $isPlatform
            ? ($validated['tenant_id'] ?? null)
            : $actor->tenant_id;

        if (! $isPlatform && ! $tenantId) {
            abort(403, 'Tenant scope required.');
        }

        $query = User::query()
            ->with([
                'tenant:id,name,slug',
                'tenantRoles.role:id,code,name_en,portal,level',
            ])
            ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
            ->when(
                $isPlatform && ! $tenantId,
                fn ($q) => $q->where(function ($inner) {
                    $inner->whereNull('tenant_id')
                        ->orWhereHas('tenantRoles');
                })
            )
            ->when($validated['search'] ?? null, function ($q, $search) {
                $like = '%'.$search.'%';
                $q->where(function ($inner) use ($like) {
                    $inner->where('email', 'like', $like)
                        ->orWhere('first_name', 'like', $like)
                        ->orWhere('last_name', 'like', $like);
                });
            })
            ->when($validated['role'] ?? null, function ($q, $roleCode) {
                $q->whereHas('tenantRoles.role', fn ($r) => $r->where('code', $roleCode));
            })
            ->orderBy('email');

        $paginator = $query->paginate($validated['per_page'] ?? 10);

        $rows = collect($paginator->items())->map(function (User $user) {
            return [
                'id' => $user->id,
                'email' => $user->email,
                'name' => trim(($user->first_name ?? '').' '.($user->last_name ?? '')) ?: $user->email,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'status' => $user->status,
                'tenant' => $user->tenant
                    ? ['id' => $user->tenant->id, 'name' => $user->tenant->name, 'slug' => $user->tenant->slug]
                    : null,
                'assignments' => $user->tenantRoles->map(fn (UserTenantRole $a) => [
                    'id' => $a->id,
                    'tenant_id' => $a->tenant_id,
                    'school_id' => $a->school_id,
                    'campus_id' => $a->campus_id,
                    'role' => $a->role ? [
                        'id' => $a->role->id,
                        'code' => $a->role->code,
                        'name_en' => $a->role->name_en,
                        'portal' => $a->role->portal,
                        'level' => $a->role->level,
                    ] : null,
                ])->values(),
            ];
        });

        return response()->json([
            'data' => $rows,
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function assign(Request $request): JsonResponse
    {
        $actor = $request->user();
        $data = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'role_code' => ['required', 'string', 'exists:roles,code'],
            'tenant_id' => ['nullable', 'integer', 'exists:tenants,id'],
            'school_id' => ['nullable', 'integer', 'exists:schools,id'],
            'campus_id' => ['nullable', 'integer', 'exists:campuses,id'],
        ]);

        $role = Role::query()->where('code', $data['role_code'])->firstOrFail();
        $target = User::query()->findOrFail($data['user_id']);
        $tenantId = $this->resolveAssignmentTenant($actor, $target, $data['tenant_id'] ?? null, $role);

        $this->assertCanAssignRole($actor, $role, $tenantId);

        $assignment = UserTenantRole::query()->updateOrCreate(
            [
                'user_id' => $target->id,
                'tenant_id' => $tenantId,
                'role_id' => $role->id,
                'school_id' => $data['school_id'] ?? null,
                'campus_id' => $data['campus_id'] ?? null,
            ],
            [
                'updated_by' => $actor->id,
                'created_by' => $actor->id,
            ]
        );

        $this->rbac->forgetUserCache($target);

        $assignment->load('role:id,code,name_en,portal,level');

        return response()->json([
            'message' => 'Role assigned.',
            'data' => [
                'id' => $assignment->id,
                'user_id' => $target->id,
                'tenant_id' => $assignment->tenant_id,
                'role' => [
                    'id' => $assignment->role->id,
                    'code' => $assignment->role->code,
                    'name_en' => $assignment->role->name_en,
                    'portal' => $assignment->role->portal,
                ],
            ],
        ], 201);
    }

    public function revoke(Request $request, UserTenantRole $assignment): JsonResponse
    {
        $actor = $request->user();
        $assignment->load('role', 'user');

        if (! $assignment->role || ! $assignment->user) {
            abort(404);
        }

        $this->assertCanAssignRole($actor, $assignment->role, (int) $assignment->tenant_id);

        // Prevent removing the last super_admin assignment
        if ($assignment->role->code === 'super_admin') {
            $remaining = UserTenantRole::query()
                ->where('role_id', $assignment->role_id)
                ->where('id', '!=', $assignment->id)
                ->count();
            if ($remaining === 0) {
                throw ValidationException::withMessages([
                    'assignment' => ['Cannot revoke the last Super Admin assignment.'],
                ]);
            }
        }

        $user = $assignment->user;
        $assignment->delete();
        $this->rbac->forgetUserCache($user);

        return response()->json(['message' => 'Role assignment revoked.']);
    }

    public function tenantsForFilter(Request $request): JsonResponse
    {
        $actor = $request->user();
        if (! $this->rbac->can($actor, 'platform.rbac.manage') && ! $this->rbac->hasRole($actor, 'super_admin')) {
            abort(403);
        }

        $tenants = Tenant::query()
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'status']);

        return response()->json(['data' => $tenants]);
    }

    protected function assertCanManageRbac(User $actor): void
    {
        if ($this->rbac->hasRole($actor, 'super_admin') || $this->rbac->can($actor, 'platform.rbac.manage')) {
            return;
        }

        abort(403, 'Missing permission: platform.rbac.manage');
    }

    protected function assertCanAssignRole(User $actor, Role $role, int $tenantId): void
    {
        $isPlatform = $this->rbac->hasRole($actor, 'super_admin')
            || $this->rbac->can($actor, 'platform.rbac.manage');

        if ($isPlatform) {
            return;
        }

        if (! $this->rbac->can($actor, 'school.users.manage', $actor->tenant_id)
            && ! $this->rbac->can($actor, 'tenant.settings.manage', $actor->tenant_id)) {
            abort(403, 'Missing permission to manage user roles.');
        }

        if ((int) $actor->tenant_id !== $tenantId) {
            abort(403, 'Cannot manage roles outside your organisation.');
        }

        if (in_array($role->code, ['super_admin', 'customer_support', 'auditor'], true)
            || $role->portal === 'control' && $role->code !== 'school_owner') {
            abort(403, 'You cannot assign platform roles.');
        }
    }

    protected function resolveAssignmentTenant(User $actor, User $target, ?int $requestedTenantId, Role $role): int
    {
        $isPlatform = $this->rbac->hasRole($actor, 'super_admin')
            || $this->rbac->can($actor, 'platform.rbac.manage');

        if ($role->code === 'super_admin') {
            $platform = Tenant::query()->where('slug', 'platform')->first();
            if (! $platform) {
                throw ValidationException::withMessages([
                    'tenant_id' => ['Platform tenant is missing.'],
                ]);
            }

            return (int) $platform->id;
        }

        if ($isPlatform) {
            $tenantId = $requestedTenantId ?? $target->tenant_id;
            if (! $tenantId) {
                throw ValidationException::withMessages([
                    'tenant_id' => ['Select a tenant for this assignment.'],
                ]);
            }

            return (int) $tenantId;
        }

        if (! $actor->tenant_id) {
            abort(403, 'Tenant scope required.');
        }

        return (int) $actor->tenant_id;
    }

    protected function forgetRoleCaches(Role $role): void
    {
        $userIds = UserTenantRole::query()
            ->where('role_id', $role->id)
            ->pluck('user_id')
            ->unique();

        foreach ($userIds as $userId) {
            Cache::forget(sprintf('rbac:perms:%d:all', $userId));
            $user = User::query()->find($userId);
            if ($user?->tenant_id) {
                Cache::forget(sprintf('rbac:perms:%d:%d', $userId, $user->tenant_id));
            }
        }
    }
}
