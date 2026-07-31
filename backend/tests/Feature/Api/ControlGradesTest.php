<?php

namespace Tests\Feature\Api;

use App\Domain\Academics\Models\Grade;
use App\Domain\Organization\Models\School;
use Tests\TestCase;

class ControlGradesTest extends TestCase
{
    public function test_super_admin_can_manage_grades(): void
    {
        $auth = $this->loginAs('admin', 'superadmin@learning-platform.local', 'ChangeMe!123');
        $school = School::query()->where('code', 'MAIN')->firstOrFail();

        $this->api('GET', '/control/grades', [], $auth['headers'])
            ->assertOk()
            ->assertJsonStructure([
                'data',
                'meta' => ['stats', 'tenants'],
            ]);

        $create = $this->api('POST', '/control/grades', [
            'school_id' => $school->id,
            'code' => 'g8',
            'name_en' => 'Grade 8',
            'name_ar' => 'الصف 8',
            'sequence' => 8,
        ], $auth['headers'])
            ->assertCreated()
            ->assertJsonPath('data.code', 'G8')
            ->assertJsonPath('data.name_en', 'Grade 8')
            ->assertJsonPath('data.sequence', 8);

        $id = (int) $create->json('data.id');

        $this->api('PUT', '/control/grades/'.$id, [
            'name_en' => 'Grade Eight',
            'sequence' => 9,
        ], $auth['headers'])
            ->assertOk()
            ->assertJsonPath('data.name_en', 'Grade Eight')
            ->assertJsonPath('data.sequence', 9);

        $this->api('DELETE', '/control/grades/'.$id, [], $auth['headers'])
            ->assertOk();

        $this->assertSoftDeleted('grades', ['id' => $id]);

        Grade::withTrashed()->where('id', $id)->forceDelete();
    }
}
