<?php

namespace Tests\Feature\Api;

use App\Domain\Academics\Models\Subject;
use App\Domain\Curriculum\Models\Curriculum;
use App\Domain\Curriculum\Models\LearningOutcome;
use App\Domain\Organization\Models\School;
use Tests\TestCase;

class ControlLearningOutcomesTest extends TestCase
{
    public function test_super_admin_can_manage_learning_outcomes(): void
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

        $this->api('GET', '/control/learning-outcomes', [], $auth['headers'])
            ->assertOk()
            ->assertJsonStructure([
                'data',
                'meta' => ['stats', 'tenants', 'curricula', 'subjects'],
            ]);

        $create = $this->api('POST', '/control/learning-outcomes', [
            'school_id' => $school->id,
            'curriculum_id' => $curriculum->id,
            'subject_id' => $subject->id,
            'code' => 'LO-CTRL-TEST',
            'statement_en' => 'Interpret algebraic expressions',
            'statement_ar' => 'تفسير التعبيرات الجبرية',
            'status' => 'active',
        ], $auth['headers'])
            ->assertCreated()
            ->assertJsonPath('data.code', 'LO-CTRL-TEST')
            ->assertJsonPath('data.statement_en', 'Interpret algebraic expressions')
            ->assertJsonPath('data.status', 'active');

        $id = (int) $create->json('data.id');

        $this->api('PUT', '/control/learning-outcomes/'.$id, [
            'statement_en' => 'Interpret and simplify algebraic expressions',
            'status' => 'archived',
        ], $auth['headers'])
            ->assertOk()
            ->assertJsonPath('data.statement_en', 'Interpret and simplify algebraic expressions')
            ->assertJsonPath('data.status', 'archived');

        $this->api('DELETE', '/control/learning-outcomes/'.$id, [], $auth['headers'])
            ->assertOk();

        $this->assertSoftDeleted('learning_outcomes', ['id' => $id]);

        LearningOutcome::withTrashed()->where('id', $id)->forceDelete();
    }
}
