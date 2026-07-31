<?php

namespace Tests\Feature\Api;

use App\Domain\Academics\Models\Grade;
use App\Domain\Academics\Models\Subject;
use App\Domain\Curriculum\Models\Chapter;
use App\Domain\Curriculum\Models\Curriculum;
use App\Domain\Organization\Models\School;
use Tests\TestCase;

class ControlChaptersTest extends TestCase
{
    public function test_super_admin_can_manage_chapters(): void
    {
        $auth = $this->loginAs('admin', 'superadmin@learning-platform.local', 'ChangeMe!123');
        $school = School::query()->where('code', 'MAIN')->firstOrFail();
        $curriculum = Curriculum::query()
            ->where('school_id', $school->id)
            ->where('is_latest', true)
            ->firstOrFail();
        $subject = Subject::query()
            ->where('school_id', $school->id)
            ->where(function ($q) use ($curriculum) {
                $q->where('curriculum_id', $curriculum->id)->orWhereNull('curriculum_id');
            })
            ->firstOrFail();
        $grade = Grade::query()->where('school_id', $school->id)->firstOrFail();

        $this->api('GET', '/control/chapters', [], $auth['headers'])
            ->assertOk()
            ->assertJsonStructure([
                'data',
                'meta' => ['stats', 'tenants', 'curricula', 'subjects', 'grades'],
            ]);

        $create = $this->api('POST', '/control/chapters', [
            'school_id' => $school->id,
            'curriculum_id' => $curriculum->id,
            'subject_id' => $subject->id,
            'grade_id' => $grade->id,
            'title_en' => 'Geometry Intro',
            'title_ar' => 'مقدمة الهندسة',
            'sequence' => 9,
            'status' => 'draft',
        ], $auth['headers'])
            ->assertCreated()
            ->assertJsonPath('data.title_en', 'Geometry Intro')
            ->assertJsonPath('data.sequence', 9)
            ->assertJsonPath('data.status', 'draft');

        $id = (int) $create->json('data.id');

        $this->api('PUT', '/control/chapters/'.$id, [
            'title_en' => 'Geometry Foundations',
            'status' => 'published',
            'sequence' => 10,
        ], $auth['headers'])
            ->assertOk()
            ->assertJsonPath('data.title_en', 'Geometry Foundations')
            ->assertJsonPath('data.status', 'published')
            ->assertJsonPath('data.sequence', 10);

        $this->api('DELETE', '/control/chapters/'.$id, [], $auth['headers'])
            ->assertOk();

        $this->assertSoftDeleted('chapters', ['id' => $id]);

        Chapter::withTrashed()->where('id', $id)->forceDelete();
    }
}
