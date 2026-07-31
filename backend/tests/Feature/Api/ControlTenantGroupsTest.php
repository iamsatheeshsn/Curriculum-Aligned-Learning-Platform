<?php

namespace Tests\Feature\Api;

use App\Domain\Organization\Models\Tenant;
use App\Domain\Organization\Models\TenantGroup;
use Tests\TestCase;

class ControlTenantGroupsTest extends TestCase
{
    public function test_super_admin_can_manage_school_groups(): void
    {
        $auth = $this->loginAs('admin', 'superadmin@learning-platform.local', 'ChangeMe!123');
        $tenant = Tenant::query()->where('slug', 'al-noor')->firstOrFail();

        $slug = 'gulf-education-'.substr(uniqid(), -6);

        $created = $this->api('POST', '/control/tenant-groups', [
            'name' => 'Gulf Education Network',
            'slug' => $slug,
            'description' => 'Regional school network',
            'status' => 'active',
            'country_code' => 'SA',
            'tenant_ids' => [$tenant->id],
        ], $auth['headers'])
            ->assertCreated()
            ->assertJsonPath('data.slug', $slug)
            ->assertJsonPath('data.members_count', 1);

        $groupId = $created->json('data.id');

        $this->api('GET', '/control/tenant-groups', [], $auth['headers'])
            ->assertOk()
            ->assertJsonStructure([
                'data',
                'meta' => ['stats', 'tenants'],
            ]);

        $this->api('PUT', '/control/tenant-groups/'.$groupId, [
            'name' => 'Gulf Education Network',
            'description' => 'Updated description',
            'status' => 'active',
        ], $auth['headers'])
            ->assertOk()
            ->assertJsonPath('data.description', 'Updated description');

        $this->api('PUT', '/control/tenant-groups/'.$groupId.'/members', [
            'tenant_ids' => [],
        ], $auth['headers'])
            ->assertOk()
            ->assertJsonPath('data.members_count', 0);

        $this->api('DELETE', '/control/tenant-groups/'.$groupId, [], $auth['headers'])
            ->assertOk();

        $this->assertSoftDeleted('tenant_groups', ['id' => $groupId]);
        $this->assertNull(Tenant::query()->find($tenant->id)?->tenant_group_id);
    }
}
