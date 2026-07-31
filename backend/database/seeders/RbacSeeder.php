<?php

namespace Database\Seeders;

use App\Domain\Identity\Models\Permission;
use App\Domain\Identity\Models\Role;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class RbacSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();
        $hierarchy = config('rbac.hierarchy');
        $roleMeta = config('rbac.roles');
        $permissions = config('rbac.permissions');
        $matrix = config('rbac.matrix');

        DB::transaction(function () use ($now, $hierarchy, $roleMeta, $permissions, $matrix) {
            // Permissions
            $permissionIds = [];
            foreach ($permissions as $perm) {
                $model = Permission::query()->updateOrCreate(
                    ['code' => $perm['code']],
                    [
                        'group_code' => $perm['group'],
                        'name_en' => $perm['name_en'],
                        'name_ar' => $perm['name_ar'],
                        'description_en' => $perm['name_en'],
                        'description_ar' => $perm['name_ar'],
                        'updated_at' => $now,
                        'created_at' => $now,
                    ]
                );
                $permissionIds[$perm['code']] = $model->id;
            }

            // Roles (first pass without parent)
            $roleIds = [];
            foreach ($hierarchy as $code => $meta) {
                $info = $roleMeta[$code];
                $role = Role::query()->updateOrCreate(
                    ['code' => $code],
                    [
                        'name_en' => $info['name_en'],
                        'name_ar' => $info['name_ar'],
                        'portal' => $meta['portal'],
                        'level' => $meta['level'],
                        'description_en' => $info['description_en'],
                        'description_ar' => $info['description_ar'],
                        'is_system' => true,
                        'updated_at' => $now,
                        'created_at' => $now,
                    ]
                );
                $roleIds[$code] = $role->id;
            }

            // Parents
            foreach ($hierarchy as $code => $meta) {
                $parentCode = $meta['parent'] ?? null;
                Role::query()->where('id', $roleIds[$code])->update([
                    'parent_role_id' => $parentCode ? ($roleIds[$parentCode] ?? null) : null,
                ]);
            }

            // Migrate legacy tenant_owner → school_owner assignments
            $legacy = Role::query()->where('code', 'tenant_owner')->first();
            if ($legacy && isset($roleIds['school_owner'])) {
                DB::table('user_tenant_roles')
                    ->where('role_id', $legacy->id)
                    ->update(['role_id' => $roleIds['school_owner']]);
                DB::table('permission_role')->where('role_id', $legacy->id)->delete();
                $legacy->delete();
            }

            // Matrix → permission_role
            foreach ($matrix as $roleCode => $codes) {
                if (! isset($roleIds[$roleCode])) {
                    continue;
                }
                $roleId = $roleIds[$roleCode];
                DB::table('permission_role')->where('role_id', $roleId)->delete();

                if ($codes === ['*']) {
                    $attach = array_values($permissionIds);
                } else {
                    $attach = [];
                    foreach ($codes as $code) {
                        if (isset($permissionIds[$code])) {
                            $attach[] = $permissionIds[$code];
                        }
                    }
                }

                $rows = array_map(fn ($permissionId) => [
                    'permission_id' => $permissionId,
                    'role_id' => $roleId,
                ], $attach);

                foreach (array_chunk($rows, 100) as $chunk) {
                    DB::table('permission_role')->insert($chunk);
                }
            }
        });
    }
}
