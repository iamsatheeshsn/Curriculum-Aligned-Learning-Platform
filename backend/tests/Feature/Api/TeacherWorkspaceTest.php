<?php

namespace Tests\Feature\Api;

use Tests\TestCase;

class TeacherWorkspaceTest extends TestCase
{
    public function test_tutor_can_load_teacher_workspace(): void
    {
        $auth = $this->loginAs('teacher', 'tutor@alnoor.test', 'Password!123', 'al-noor');

        $this->api('GET', '/org/teacher/workspace', [], $auth['headers'])
            ->assertOk()
            ->assertJsonPath('data.capabilities.tutoring', true)
            ->assertJsonPath('data.capabilities.classes', true)
            ->assertJsonStructure([
                'data' => [
                    'school',
                    'stats',
                    'classes',
                    'sessions',
                    'availability' => ['weekly', 'open_slots', 'slot_date'],
                ],
            ]);
    }

    public function test_tutor_can_add_weekly_availability(): void
    {
        $auth = $this->loginAs('teacher', 'tutor@alnoor.test', 'Password!123', 'al-noor');

        $this->api('POST', '/org/teacher/availability', [
            'weekday' => 1,
            'start_time' => '14:00',
            'end_time' => '16:00',
            'slot_minutes' => 60,
        ], $auth['headers'])
            ->assertCreated()
            ->assertJsonPath('message', 'Tutoring slot added.');
    }
}
