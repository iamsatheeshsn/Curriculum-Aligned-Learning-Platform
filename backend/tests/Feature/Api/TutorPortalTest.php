<?php

namespace Tests\Feature\Api;

use Tests\TestCase;

class TutorPortalTest extends TestCase
{
    /** @return array<string, string> */
    private function tutorHeaders(): array
    {
        $auth = $this->loginAs('teacher', 'tutor@alnoor.test', 'Password!123', 'al-noor');

        return $auth['headers'] + ['X-Tenant-Slug' => 'al-noor'];
    }

    public function test_tutor_can_load_workspace(): void
    {
        $this->api('GET', '/org/teacher/workspace', [], $this->tutorHeaders())
            ->assertOk()
            ->assertJsonStructure(['data' => ['school', 'stats', 'sessions', 'availability']]);
    }

    public function test_tutor_can_load_profile_and_students(): void
    {
        $this->api('GET', '/org/teacher/profile', [], $this->tutorHeaders())
            ->assertOk()
            ->assertJsonStructure(['data' => ['user', 'tutor_profile', 'school']]);

        $this->api('GET', '/org/teacher/students', [], $this->tutorHeaders())
            ->assertOk()
            ->assertJsonStructure(['data', 'meta' => ['stats']]);
    }

    public function test_tutor_can_load_earnings_and_notifications(): void
    {
        $this->api('GET', '/org/teacher/earnings', [], $this->tutorHeaders())
            ->assertOk()
            ->assertJsonStructure(['data', 'meta' => ['stats']]);

        $this->api('GET', '/org/teacher/notifications', [], $this->tutorHeaders())
            ->assertOk()
            ->assertJsonStructure(['data', 'meta' => ['stats']]);
    }
}
