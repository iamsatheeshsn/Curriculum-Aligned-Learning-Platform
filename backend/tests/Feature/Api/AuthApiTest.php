<?php

namespace Tests\Feature\Api;

use Tests\TestCase;

class AuthApiTest extends TestCase
{
    public function test_admin_login_returns_bearer_token(): void
    {
        $this->api('POST', '/auth/admin/login', [
            'email' => 'owner@alnoor.test',
            'password' => 'Password!456',
        ])
            ->assertOk()
            ->assertJsonPath('data.token_type', 'Bearer')
            ->assertJsonStructure(['data' => ['token', 'user', 'roles']]);
    }

    public function test_student_login_requires_tenant(): void
    {
        $this->api('POST', '/auth/student/login', [
            'email' => 'student@alnoor.test',
            'password' => 'Password!123',
            'tenant_slug' => 'al-noor',
        ], ['X-Tenant-Slug' => 'al-noor'])
            ->assertOk()
            ->assertJsonStructure(['data' => ['token', 'user']]);
    }

    public function test_invalid_credentials_rejected(): void
    {
        $this->api('POST', '/auth/admin/login', [
            'email' => 'owner@alnoor.test',
            'password' => 'wrong-password',
        ])->assertStatus(422);
    }

    public function test_me_requires_authentication(): void
    {
        $this->api('GET', '/auth/me')->assertUnauthorized();
    }

    public function test_me_with_token(): void
    {
        $auth = $this->loginAs('admin', 'owner@alnoor.test', 'Password!456');

        $this->api('GET', '/auth/me', [], $auth['headers'])
            ->assertOk()
            ->assertJsonPath('data.user.email', 'owner@alnoor.test');
    }
}
