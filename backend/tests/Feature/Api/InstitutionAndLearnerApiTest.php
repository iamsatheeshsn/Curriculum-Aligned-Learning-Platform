<?php

namespace Tests\Feature\Api;

use Tests\TestCase;

class InstitutionAndLearnerApiTest extends TestCase
{
    public function test_owner_can_fetch_school_report(): void
    {
        $auth = $this->loginAs('admin', 'owner@alnoor.test', 'Password!456');
        $headers = $auth['headers'] + ['X-Tenant-Slug' => 'al-noor', 'X-School-ID' => '1'];

        $this->api('GET', '/org/reports/school?school_id=1', [], $headers)
            ->assertOk()
            ->assertJsonStructure(['data']);
    }

    public function test_student_dashboard(): void
    {
        $auth = $this->loginAs('student', 'student@alnoor.test', 'Password!123', 'al-noor');

        $this->api('GET', '/learner/student/dashboard', [], $auth['headers'] + ['X-School-ID' => '1'])
            ->assertOk();
    }

    public function test_parent_dashboard(): void
    {
        $auth = $this->loginAs('parent', 'parent@alnoor.test', 'Password!123', 'al-noor');

        $this->api('GET', '/learner/parent/dashboard', [], $auth['headers'] + ['X-School-ID' => '1'])
            ->assertOk();
    }

    public function test_notification_events_catalog(): void
    {
        $auth = $this->loginAs('admin', 'owner@alnoor.test', 'Password!456');
        $headers = $auth['headers'] + ['X-Tenant-Slug' => 'al-noor'];

        $this->api('GET', '/org/notifications/events', [], $headers)
            ->assertOk()
            ->assertJsonStructure(['data' => ['events', 'channels']]);
    }

    public function test_billing_plans_list(): void
    {
        $auth = $this->loginAs('admin', 'owner@alnoor.test', 'Password!456');
        $headers = $auth['headers'] + ['X-Tenant-Slug' => 'al-noor'];

        $this->api('GET', '/org/billing/plans', [], $headers)
            ->assertOk()
            ->assertJsonStructure(['data']);
    }

    public function test_mobile_device_stub_returns_501(): void
    {
        $auth = $this->loginAs('student', 'student@alnoor.test', 'Password!123', 'al-noor');

        $this->api('POST', '/mobile/devices', [
            'platform' => 'android',
            'push_token' => 'fake-fcm-token',
        ], $auth['headers'])
            ->assertStatus(501)
            ->assertJsonPath('code', 'mobile_feature_planned');
    }
}
