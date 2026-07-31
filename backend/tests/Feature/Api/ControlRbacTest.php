<?php

namespace Tests\Feature\Api;

use App\Domain\Identity\Models\Role;
use App\Domain\Identity\Models\UserTenantRole;
use App\Domain\Organization\Models\Tenant;
use App\Models\User;
use Tests\TestCase;

class ControlRbacTest extends TestCase
{
    public function test_login_returns_permissions_for_control_portal(): void
    {
        $response = $this->api('POST', '/auth/admin/login', [
            'email' => 'superadmin@learning-platform.local',
            'password' => 'ChangeMe!123',
        ])->assertOk();

        $response->assertJsonStructure([
            'data' => [
                'token',
                'roles',
                'permissions',
                'user',
            ],
        ]);

        $this->assertContains('super_admin', $response->json('data.roles'));
        $this->assertNotEmpty($response->json('data.permissions'));
        $this->assertContains('platform.rbac.manage', $response->json('data.permissions'));
    }

    public function test_super_admin_can_list_roles_and_sync_permissions(): void
    {
        $auth = $this->loginAs('admin', 'superadmin@learning-platform.local', 'ChangeMe!123');

        $roles = $this->api('GET', '/control/rbac/roles', [], $auth['headers'])
            ->assertOk()
            ->json('data');

        $this->assertNotEmpty($roles);

        $teacher = collect($roles)->firstWhere('code', 'teacher');
        $this->assertNotNull($teacher);

        $this->api('PUT', '/control/rbac/roles/'.$teacher['id'].'/permissions', [
            'permission_codes' => [
                'learning.content.assign',
                'assessments.grade',
            ],
        ], $auth['headers'])
            ->assertOk()
            ->assertJsonPath('data.code', 'teacher');

        $updated = $this->api('GET', '/control/rbac/roles', [], $auth['headers'])
            ->assertOk()
            ->json('data');

        $teacherUpdated = collect($updated)->firstWhere('code', 'teacher');
        $this->assertEqualsCanonicalizing(
            ['learning.content.assign', 'assessments.grade'],
            $teacherUpdated['permission_codes'],
        );
    }

    public function test_super_admin_can_assign_and_revoke_role(): void
    {
        $auth = $this->loginAs('admin', 'superadmin@learning-platform.local', 'ChangeMe!123');
        $tenant = Tenant::query()->where('slug', 'al-noor')->firstOrFail();
        $user = User::query()->where('email', 'tutor@alnoor.test')->firstOrFail();
        $role = Role::query()->where('code', 'teacher')->firstOrFail();

        // Clean any existing teacher assignment for deterministic assert
        UserTenantRole::query()
            ->where('user_id', $user->id)
            ->where('role_id', $role->id)
            ->forceDelete();

        $assign = $this->api('POST', '/control/rbac/assignments', [
            'user_id' => $user->id,
            'role_code' => 'teacher',
            'tenant_id' => $tenant->id,
        ], $auth['headers'])
            ->assertCreated()
            ->json('data');

        $this->assertSame('teacher', $assign['role']['code']);

        $this->api('DELETE', '/control/rbac/assignments/'.$assign['id'], [], $auth['headers'])
            ->assertOk();
    }

    public function test_tenant_owner_can_view_roles_but_not_edit_super_admin_matrix(): void
    {
        $auth = $this->loginAs('admin', 'owner@alnoor.test', 'Password!456');

        $this->api('GET', '/control/rbac/roles', [], $auth['headers'])->assertOk();

        $super = Role::query()->where('code', 'super_admin')->firstOrFail();

        $this->api('PUT', '/control/rbac/roles/'.$super->id.'/permissions', [
            'permission_codes' => ['tenant.settings.manage'],
        ], $auth['headers'])->assertForbidden();
    }
}
