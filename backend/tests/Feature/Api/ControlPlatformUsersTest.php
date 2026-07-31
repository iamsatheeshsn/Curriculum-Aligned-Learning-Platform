<?php

namespace Tests\Feature\Api;

use App\Domain\Identity\Models\Role;
use App\Domain\Identity\Models\UserTenantRole;
use App\Models\User;
use Tests\TestCase;

class ControlPlatformUsersTest extends TestCase
{
    public function test_super_admin_can_manage_platform_users(): void
    {
        $auth = $this->loginAs('admin', 'superadmin@learning-platform.local', 'ChangeMe!123');

        $this->api('GET', '/control/platform-users', [], $auth['headers'])
            ->assertOk()
            ->assertJsonStructure([
                'data',
                'meta' => ['stats', 'roles'],
            ]);

        $create = $this->api('POST', '/control/platform-users', [
            'email' => 'support.ctrl@learning-platform.local',
            'password' => 'ChangeMe!123',
            'first_name' => 'Support',
            'last_name' => 'Agent',
            'phone' => '+966500000099',
            'locale' => 'en',
            'timezone' => 'Asia/Riyadh',
            'status' => 'active',
            'role_code' => 'customer_support',
        ], $auth['headers'])
            ->assertCreated()
            ->assertJsonPath('data.email', 'support.ctrl@learning-platform.local')
            ->assertJsonPath('data.role_code', 'customer_support')
            ->assertJsonPath('data.status', 'active');

        $id = (int) $create->json('data.id');

        $this->api('PUT', '/control/platform-users/'.$id, [
            'first_name' => 'Support Desk',
            'status' => 'suspended',
            'role_code' => 'auditor',
        ], $auth['headers'])
            ->assertOk()
            ->assertJsonPath('data.first_name', 'Support Desk')
            ->assertJsonPath('data.status', 'suspended')
            ->assertJsonPath('data.role_code', 'auditor');

        $this->api('DELETE', '/control/platform-users/'.$id, [], $auth['headers'])
            ->assertOk();

        $this->assertSoftDeleted('users', ['id' => $id]);

        UserTenantRole::withTrashed()->where('user_id', $id)->forceDelete();
        User::withTrashed()->where('id', $id)->forceDelete();
    }

    public function test_cannot_delete_last_super_admin(): void
    {
        $auth = $this->loginAs('admin', 'superadmin@learning-platform.local', 'ChangeMe!123');
        $superRole = Role::query()->where('code', 'super_admin')->firstOrFail();
        $admin = User::query()->where('email', 'superadmin@learning-platform.local')->firstOrFail();

        $otherSuperCount = UserTenantRole::query()
            ->where('role_id', $superRole->id)
            ->where('user_id', '!=', $admin->id)
            ->count();

        if ($otherSuperCount > 0) {
            $this->markTestSkipped('Additional super admins exist in this database.');
        }

        $this->api('DELETE', '/control/platform-users/'.$admin->id, [], $auth['headers'])
            ->assertStatus(422);
    }
}
