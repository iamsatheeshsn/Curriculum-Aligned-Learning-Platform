<?php

namespace Tests\Feature\Api;

use Tests\TestCase;

class ControlSchoolOpsTest extends TestCase
{
    /** @return array<string, string> */
    private function ownerHeaders(): array
    {
        $auth = $this->loginAs('admin', 'owner@alnoor.test', 'Password!456');

        return $auth['headers'] + ['X-Tenant-Slug' => 'al-noor'];
    }

    public function test_owner_can_get_school_profile(): void
    {
        $this->api('GET', '/control/school-ops/school', [], $this->ownerHeaders())
            ->assertOk()
            ->assertJsonStructure([
                'data' => ['id', 'code', 'name_en', 'name_ar', 'status', 'campuses'],
            ]);
    }

    public function test_owner_can_list_campuses(): void
    {
        $this->api('GET', '/control/school-ops/campuses', [], $this->ownerHeaders())
            ->assertOk()
            ->assertJsonStructure([
                'data',
                'meta' => ['stats' => ['total', 'active', 'inactive']],
            ]);
    }

    public function test_owner_can_list_academic_years(): void
    {
        $this->api('GET', '/control/school-ops/academic-years', [], $this->ownerHeaders())
            ->assertOk()
            ->assertJsonStructure([
                'data',
                'meta' => ['stats' => ['total', 'current', 'active']],
            ]);
    }

    public function test_owner_can_list_grades(): void
    {
        $response = $this->api('GET', '/control/school-ops/grades', [], $this->ownerHeaders())
            ->assertOk()
            ->assertJsonStructure([
                'data',
                'meta' => ['stats' => ['total']],
            ]);

        $this->assertIsArray($response->json('data'));
    }

    public function test_owner_can_list_students(): void
    {
        $this->api('GET', '/control/school-ops/students', [], $this->ownerHeaders())
            ->assertOk()
            ->assertJsonStructure([
                'data',
                'meta' => ['stats'],
            ]);
    }

    public function test_owner_can_list_parents(): void
    {
        $this->api('GET', '/control/school-ops/parents', [], $this->ownerHeaders())
            ->assertOk()
            ->assertJsonStructure([
                'data',
                'meta' => ['stats' => ['parents', 'links']],
            ]);
    }

    public function test_owner_can_list_teachers(): void
    {
        $this->api('GET', '/control/school-ops/teachers', [], $this->ownerHeaders())
            ->assertOk()
            ->assertJsonStructure([
                'data',
                'meta' => ['stats' => ['total']],
            ]);
    }

    public function test_owner_can_create_teacher_with_password_and_login(): void
    {
        $email = 'teacher.pwd.'.uniqid().'@alnoor.test';
        $password = 'Welcome!123';

        $this->api('POST', '/control/school-ops/teachers', [
            'email' => $email,
            'password' => $password,
            'first_name' => 'Pwd',
            'last_name' => 'Teacher',
        ], $this->ownerHeaders())
            ->assertCreated()
            ->assertJsonPath('data.email', $email);

        $this->api('POST', '/auth/teacher/login', [
            'email' => $email,
            'password' => $password,
            'tenant_slug' => 'al-noor',
        ])->assertOk()->assertJsonStructure(['data' => ['token']]);
    }

    public function test_owner_can_create_parent_with_password_and_login(): void
    {
        $email = 'parent.pwd.'.uniqid().'@alnoor.test';
        $password = 'Welcome!123';

        $this->api('POST', '/control/school-ops/parents', [
            'email' => $email,
            'password' => $password,
            'first_name' => 'Pwd',
            'last_name' => 'Parent',
        ], $this->ownerHeaders())
            ->assertCreated()
            ->assertJsonPath('data.email', $email);

        $this->api('POST', '/auth/parent/login', [
            'email' => $email,
            'password' => $password,
            'tenant_slug' => 'al-noor',
        ])->assertOk()->assertJsonStructure(['data' => ['token']]);
    }

    public function test_create_teacher_requires_password(): void
    {
        $this->api('POST', '/control/school-ops/teachers', [
            'email' => 'missing.pwd.'.uniqid().'@alnoor.test',
            'first_name' => 'No',
            'last_name' => 'Password',
        ], $this->ownerHeaders())
            ->assertStatus(422);
    }
}
