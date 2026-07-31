<?php

namespace Tests\Feature\Api;

use App\Domain\Organization\Models\Campus;
use App\Domain\Organization\Models\School;
use App\Domain\Organization\Models\Tenant;
use Tests\TestCase;

class ControlCampusesTest extends TestCase
{
    public function test_super_admin_can_manage_campuses(): void
    {
        $auth = $this->loginAs('admin', 'superadmin@learning-platform.local', 'ChangeMe!123');
        $tenant = Tenant::query()->where('slug', 'al-noor')->firstOrFail();
        $school = School::query()->where('tenant_id', $tenant->id)->firstOrFail();

        // Keep room under plan max_campuses for a create assertion.
        Campus::query()->where('school_id', $school->id)->each(fn (Campus $c) => $c->delete());

        $code = 'TST'.strtoupper(substr(uniqid(), -4));

        $created = $this->api('POST', '/control/campuses', [
            'school_id' => $school->id,
            'code' => $code,
            'name_en' => 'Jeddah Campus',
            'name_ar' => 'حرم جدة',
            'timezone' => 'Asia/Riyadh',
            'address' => 'Jeddah Corniche',
            'status' => 'active',
        ], $auth['headers'])
            ->assertCreated()
            ->assertJsonPath('data.code', $code)
            ->assertJsonPath('data.school.id', $school->id)
            ->assertJsonPath('data.tenant.slug', 'al-noor');

        $campusId = $created->json('data.id');

        $this->api('GET', '/control/campuses', [], $auth['headers'])
            ->assertOk()
            ->assertJsonStructure([
                'data',
                'meta' => ['stats', 'tenants'],
            ]);

        $this->api('PUT', '/control/campuses/'.$campusId, [
            'name_en' => 'Jeddah Waterfront Campus',
            'address' => 'North Corniche',
            'status' => 'inactive',
        ], $auth['headers'])
            ->assertOk()
            ->assertJsonPath('data.name_en', 'Jeddah Waterfront Campus')
            ->assertJsonPath('data.status', 'inactive');

        $this->api('DELETE', '/control/campuses/'.$campusId, [], $auth['headers'])
            ->assertOk();

        $this->assertSoftDeleted('campuses', ['id' => $campusId]);
        $this->assertNull(Campus::query()->find($campusId));
    }
}
