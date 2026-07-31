<?php

namespace Tests\Feature\Api;

use App\Domain\Organization\Models\Country;
use Tests\TestCase;

class ControlCountriesTest extends TestCase
{
    public function test_super_admin_can_manage_countries(): void
    {
        $auth = $this->loginAs('admin', 'superadmin@learning-platform.local', 'ChangeMe!123');

        $this->api('GET', '/control/countries', [], $auth['headers'])
            ->assertOk()
            ->assertJsonStructure([
                'data',
                'meta' => ['stats'],
            ]);

        $create = $this->api('POST', '/control/countries', [
            'code' => 'kw',
            'name_en' => 'Kuwait',
            'name_ar' => 'الكويت',
            'default_locale' => 'ar',
            'default_timezone' => 'Asia/Kuwait',
            'is_active' => true,
        ], $auth['headers'])
            ->assertCreated()
            ->assertJsonPath('data.code', 'KW')
            ->assertJsonPath('data.name_en', 'Kuwait');

        $id = (int) $create->json('data.id');

        $this->api('PUT', '/control/countries/'.$id, [
            'name_en' => 'State of Kuwait',
            'is_active' => false,
        ], $auth['headers'])
            ->assertOk()
            ->assertJsonPath('data.name_en', 'State of Kuwait')
            ->assertJsonPath('data.status', 'inactive');

        $this->api('DELETE', '/control/countries/'.$id, [], $auth['headers'])
            ->assertOk();

        $this->assertSoftDeleted('countries', ['id' => $id]);

        // Restore seed cleanliness if soft-deleted KW somehow conflicts later.
        Country::withTrashed()->where('code', 'KW')->forceDelete();
    }
}
