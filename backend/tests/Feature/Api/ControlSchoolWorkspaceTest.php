<?php

namespace Tests\Feature\Api;

use Tests\TestCase;

class ControlSchoolWorkspaceTest extends TestCase
{
    /** @return array<string, string> */
    private function ownerHeaders(): array
    {
        $auth = $this->loginAs('admin', 'owner@alnoor.test', 'Password!456');

        return $auth['headers'] + ['X-Tenant-Slug' => 'al-noor'];
    }

    public function test_owner_can_list_staff(): void
    {
        $this->api('GET', '/control/school-workspace/staff', [], $this->ownerHeaders())
            ->assertOk()
            ->assertJsonStructure([
                'data',
                'meta' => ['stats' => ['total', 'active']],
            ]);
    }

    public function test_owner_can_create_course(): void
    {
        $this->api('POST', '/control/school-workspace/courses', [
            'code' => 'WS-SCI-'.uniqid(),
            'title_en' => 'Workspace Science',
            'title_ar' => 'علوم مساحة العمل',
            'status' => 'active',
        ], $this->ownerHeaders())
            ->assertCreated()
            ->assertJsonPath('data.title_en', 'Workspace Science')
            ->assertJsonStructure([
                'data' => ['id', 'code', 'title_en', 'title_ar', 'status'],
            ]);
    }

    public function test_owner_can_get_organisation_settings(): void
    {
        $this->api('GET', '/control/school-workspace/settings/organisation', [], $this->ownerHeaders())
            ->assertOk()
            ->assertJsonStructure([
                'data' => ['name', 'slug', 'timezone', 'locale', 'status'],
            ]);
    }

    public function test_owner_can_get_finance_reports(): void
    {
        $this->api('GET', '/control/school-workspace/finance/reports', [], $this->ownerHeaders())
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'kpis' => ['fees_collected', 'tutor_payments', 'expenses', 'net'],
                    'rows',
                    'currency',
                    'generated_at',
                ],
            ]);
    }

    public function test_owner_can_list_notifications(): void
    {
        $this->api('GET', '/control/school-workspace/notifications', [], $this->ownerHeaders())
            ->assertOk()
            ->assertJsonStructure([
                'data',
                'meta' => ['stats' => ['total', 'draft', 'sent']],
            ]);
    }

    public function test_owner_can_create_staff_with_password_and_login(): void
    {
        $email = 'staff.pwd.'.uniqid().'@alnoor.test';
        $password = 'Welcome!123';

        $this->api('POST', '/control/school-workspace/staff', [
            'email' => $email,
            'password' => $password,
            'first_name' => 'Pwd',
            'last_name' => 'Staff',
            'role' => 'school_admin',
        ], $this->ownerHeaders())
            ->assertCreated()
            ->assertJsonPath('data.email', $email);

        $this->api('POST', '/auth/teacher/login', [
            'email' => $email,
            'password' => $password,
            'tenant_slug' => 'al-noor',
        ])->assertOk()->assertJsonStructure(['data' => ['token']]);
    }

    public function test_owner_can_create_tutor_with_password_and_login(): void
    {
        $email = 'tutor.pwd.'.uniqid().'@alnoor.test';
        $password = 'Welcome!123';

        $this->api('POST', '/control/school-workspace/tutoring/tutors', [
            'email' => $email,
            'password' => $password,
            'first_name' => 'Pwd',
            'last_name' => 'Tutor',
            'hourly_rate' => 120,
        ], $this->ownerHeaders())
            ->assertCreated()
            ->assertJsonPath('data.email', $email);

        $this->api('POST', '/auth/teacher/login', [
            'email' => $email,
            'password' => $password,
            'tenant_slug' => 'al-noor',
        ])->assertOk()->assertJsonStructure(['data' => ['token']]);
    }

    public function test_create_staff_requires_password(): void
    {
        $this->api('POST', '/control/school-workspace/staff', [
            'email' => 'staff.missing.'.uniqid().'@alnoor.test',
            'first_name' => 'No',
            'last_name' => 'Password',
            'role' => 'school_admin',
        ], $this->ownerHeaders())
            ->assertStatus(422);
    }
}
