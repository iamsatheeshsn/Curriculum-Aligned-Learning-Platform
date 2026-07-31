<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function api(string $method, string $uri, array $data = [], array $headers = [])
    {
        $headers = array_merge([
            'Accept' => 'application/json',
        ], $headers);

        return $this->json($method, '/api/v1'.$uri, $data, $headers);
    }

    /** @return array{token: string, headers: array<string, string>} */
    protected function loginAs(string $portal, string $email, string $password, ?string $tenantSlug = null): array
    {
        $path = match ($portal) {
            'admin' => '/auth/admin/login',
            'teacher' => '/auth/teacher/login',
            'student' => '/auth/student/login',
            'parent' => '/auth/parent/login',
            default => throw new \InvalidArgumentException($portal),
        };

        $body = ['email' => $email, 'password' => $password];
        if ($tenantSlug !== null) {
            $body['tenant_slug'] = $tenantSlug;
        }

        $headers = [];
        if ($tenantSlug !== null) {
            $headers['X-Tenant-Slug'] = $tenantSlug;
        }

        $response = $this->api('POST', $path, $body, $headers);
        $response->assertOk();

        $token = $response->json('data.token');
        $authHeaders = [
            'Authorization' => 'Bearer '.$token,
            'Accept' => 'application/json',
        ];
        if ($tenantSlug !== null) {
            $authHeaders['X-Tenant-Slug'] = $tenantSlug;
        }

        return ['token' => $token, 'headers' => $authHeaders, 'response' => $response];
    }
}
