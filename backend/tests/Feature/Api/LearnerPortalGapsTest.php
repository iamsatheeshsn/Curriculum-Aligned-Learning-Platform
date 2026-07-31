<?php

namespace Tests\Feature\Api;

use Tests\TestCase;

class LearnerPortalGapsTest extends TestCase
{
    public function test_student_can_update_profile(): void
    {
        $auth = $this->loginAs('student', 'student@alnoor.test', 'Password!123', 'al-noor');
        $headers = $auth['headers'] + ['X-School-ID' => '1'];

        $this->api('PUT', '/learner/student/profile', [
            'first_name' => 'Updated',
            'last_name' => 'Student',
            'phone' => '+966500000099',
            'locale' => 'en',
            'timezone' => 'Asia/Riyadh',
        ], $headers)
            ->assertOk()
            ->assertJsonPath('data.first_name', 'Updated')
            ->assertJsonPath('data.last_name', 'Student')
            ->assertJsonPath('data.phone', '+966500000099');
    }

    public function test_parent_can_list_fees(): void
    {
        $auth = $this->loginAs('parent', 'parent@alnoor.test', 'Password!123', 'al-noor');

        $this->api('GET', '/learner/parent/fees', [], $auth['headers'] + ['X-School-ID' => '1'])
            ->assertOk()
            ->assertJsonStructure(['data']);
    }

    public function test_parent_can_list_notices(): void
    {
        $auth = $this->loginAs('parent', 'parent@alnoor.test', 'Password!123', 'al-noor');

        $this->api('GET', '/learner/parent/notices', [], $auth['headers'] + ['X-School-ID' => '1'])
            ->assertOk()
            ->assertJsonStructure(['data']);
    }

    public function test_student_can_list_messages(): void
    {
        $auth = $this->loginAs('student', 'student@alnoor.test', 'Password!123', 'al-noor');

        $this->api('GET', '/learner/student/messages', [], $auth['headers'] + ['X-School-ID' => '1'])
            ->assertOk()
            ->assertJsonStructure(['data']);
    }
}
