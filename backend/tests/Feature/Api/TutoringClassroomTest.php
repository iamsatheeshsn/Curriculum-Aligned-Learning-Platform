<?php

namespace Tests\Feature\Api;

use Tests\TestCase;

class TutoringClassroomTest extends TestCase
{
    public function test_tutor_classroom_join_url_points_to_institution_spa(): void
    {
        $auth = $this->loginAs('teacher', 'tutor@alnoor.test', 'Password!123', 'al-noor');
        $headers = $auth['headers'] + ['X-Tenant-Slug' => 'al-noor'];

        $list = $this->api('GET', '/org/tutoring-sessions?per_page=5', [], $headers)->assertOk();
        $id = $list->json('data.0.id');
        $this->assertNotEmpty($id, 'Expected at least one tutoring session');

        $response = $this->api('GET', '/org/tutoring-sessions/'.$id.'/classroom', [], $headers)
            ->assertOk()
            ->assertJsonPath('data.session_id', $id);

        $joinUrl = (string) $response->json('data.join_url');
        $this->assertStringContainsString('/classroom/', $joinUrl);
        $this->assertStringContainsString('5175', $joinUrl);
        $this->assertStringContainsString('al-noor', $joinUrl);
        $this->assertIsArray($response->json('data.participants'));
        $this->assertArrayHasKey('permissions', $response->json('data'));
    }

    public function test_student_join_url_points_to_learner_spa_classroom(): void
    {
        $auth = $this->loginAs('student', 'student@alnoor.test', 'Password!123', 'al-noor');
        $headers = $auth['headers'] + ['X-Tenant-Slug' => 'al-noor'];

        $list = $this->api('GET', '/learner/tutoring/sessions?per_page=5', [], $headers)->assertOk();
        // Laravel paginator JSON: { data: [ ...rows ], ... }
        $id = $list->json('data.0.id');
        $this->assertNotEmpty($id, 'Expected at least one tutoring session for the student');

        $response = $this->api('GET', '/learner/tutoring/sessions/'.$id.'/join', [], $headers)
            ->assertOk()
            ->assertJsonPath('data.session_id', $id);

        $joinUrl = (string) $response->json('data.join_url');
        $this->assertStringContainsString('/student/classroom/', $joinUrl);
        $this->assertStringContainsString('5178', $joinUrl);
        $this->assertStringContainsString('al-noor', $joinUrl);
        $this->assertStringContainsString('session='.$id, $joinUrl);
        $this->assertNotEmpty($response->json('data.external_id'));
        $this->assertArrayHasKey('permissions', $response->json('data'));
        $this->assertArrayHasKey('can_join', $response->json('data.permissions'));
        $this->assertArrayHasKey('can_rate', $response->json('data.permissions'));
        $this->assertArrayHasKey('attendance', $response->json('data'));
    }
}
