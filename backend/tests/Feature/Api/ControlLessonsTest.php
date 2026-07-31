<?php

namespace Tests\Feature\Api;

use App\Domain\Curriculum\Models\Chapter;
use App\Domain\Curriculum\Models\Curriculum;
use App\Domain\Curriculum\Models\CurriculumLesson;
use App\Domain\Organization\Models\School;
use Tests\TestCase;

class ControlLessonsTest extends TestCase
{
    public function test_super_admin_can_manage_lessons(): void
    {
        $auth = $this->loginAs('admin', 'superadmin@learning-platform.local', 'ChangeMe!123');
        $school = School::query()->where('code', 'MAIN')->firstOrFail();
        $curriculum = Curriculum::query()
            ->where('school_id', $school->id)
            ->where('is_latest', true)
            ->firstOrFail();
        $chapter = Chapter::query()
            ->where('school_id', $school->id)
            ->where('curriculum_id', $curriculum->id)
            ->firstOrFail();

        $this->api('GET', '/control/lessons', [], $auth['headers'])
            ->assertOk()
            ->assertJsonStructure([
                'data',
                'meta' => ['stats', 'tenants', 'curricula', 'chapters', 'learning_outcomes'],
            ]);

        $create = $this->api('POST', '/control/lessons', [
            'school_id' => $school->id,
            'curriculum_id' => $curriculum->id,
            'chapter_id' => $chapter->id,
            'code' => 'L-CTRL-TEST',
            'title_en' => 'Solving Equations',
            'title_ar' => 'حل المعادلات',
            'summary_en' => 'Linear equations walkthrough',
            'sequence' => 8,
            'estimated_minutes' => 35,
            'difficulty' => 'medium',
            'status' => 'draft',
        ], $auth['headers'])
            ->assertCreated()
            ->assertJsonPath('data.title_en', 'Solving Equations')
            ->assertJsonPath('data.code', 'L-CTRL-TEST')
            ->assertJsonPath('data.sequence', 8)
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.difficulty', 'medium');

        $id = (int) $create->json('data.id');

        $this->api('PUT', '/control/lessons/'.$id, [
            'title_en' => 'Solving Linear Equations',
            'status' => 'published',
            'sequence' => 9,
            'estimated_minutes' => 45,
        ], $auth['headers'])
            ->assertOk()
            ->assertJsonPath('data.title_en', 'Solving Linear Equations')
            ->assertJsonPath('data.status', 'published')
            ->assertJsonPath('data.sequence', 9)
            ->assertJsonPath('data.estimated_minutes', 45);

        $this->api('DELETE', '/control/lessons/'.$id, [], $auth['headers'])
            ->assertOk();

        $this->assertSoftDeleted('curriculum_lessons', ['id' => $id]);

        CurriculumLesson::withTrashed()->where('id', $id)->forceDelete();
    }
}
