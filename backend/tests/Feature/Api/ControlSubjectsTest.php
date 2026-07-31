<?php

namespace Tests\Feature\Api;

use App\Domain\Academics\Models\Subject;
use App\Domain\Organization\Models\School;
use Tests\TestCase;

class ControlSubjectsTest extends TestCase
{
    public function test_super_admin_can_manage_subjects(): void
    {
        $auth = $this->loginAs('admin', 'superadmin@learning-platform.local', 'ChangeMe!123');
        $school = School::query()->where('code', 'MAIN')->firstOrFail();

        $this->api('GET', '/control/subjects', [], $auth['headers'])
            ->assertOk()
            ->assertJsonStructure([
                'data',
                'meta' => ['stats', 'tenants', 'curricula'],
            ]);

        $create = $this->api('POST', '/control/subjects', [
            'school_id' => $school->id,
            'code' => 'sci',
            'name_en' => 'Science',
            'name_ar' => 'العلوم',
            'is_stem' => true,
            'tutoring_enabled' => true,
            'status' => 'active',
        ], $auth['headers'])
            ->assertCreated()
            ->assertJsonPath('data.code', 'SCI')
            ->assertJsonPath('data.name_en', 'Science')
            ->assertJsonPath('data.is_stem', true);

        $id = (int) $create->json('data.id');

        $this->api('PUT', '/control/subjects/'.$id, [
            'name_en' => 'General Science',
            'status' => 'archived',
            'tutoring_enabled' => false,
        ], $auth['headers'])
            ->assertOk()
            ->assertJsonPath('data.name_en', 'General Science')
            ->assertJsonPath('data.status', 'archived')
            ->assertJsonPath('data.tutoring_enabled', false);

        $this->api('DELETE', '/control/subjects/'.$id, [], $auth['headers'])
            ->assertOk();

        $this->assertSoftDeleted('subjects', ['id' => $id]);

        Subject::withTrashed()->where('id', $id)->forceDelete();
    }
}
