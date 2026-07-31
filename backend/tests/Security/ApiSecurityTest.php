<?php

namespace Tests\Security;

use Tests\TestCase;

class ApiSecurityTest extends TestCase
{
    public function test_org_routes_reject_unauthenticated_requests(): void
    {
        $this->api('GET', '/org/reports/school?school_id=1', [], [
            'X-Tenant-Slug' => 'al-noor',
        ])->assertUnauthorized();
    }

    public function test_student_cannot_access_control_rbac_matrix(): void
    {
        $auth = $this->loginAs('student', 'student@alnoor.test', 'Password!123', 'al-noor');

        $this->api('GET', '/control/rbac/matrix', [], $auth['headers'])
            ->assertStatus(403);
    }

    public function test_invalid_token_rejected(): void
    {
        $this->api('GET', '/auth/me', [], [
            'Authorization' => 'Bearer totally-invalid-token',
        ])->assertUnauthorized();
    }

    public function test_parent_cannot_use_wrong_tenant_slug_for_isolation(): void
    {
        $auth = $this->loginAs('parent', 'parent@alnoor.test', 'Password!123', 'al-noor');

        // Spoof another slug while keeping al-noor token — middleware should block or fail tenant resolve.
        $headers = $auth['headers'];
        $headers['X-Tenant-Slug'] = 'nonexistent-tenant-xyz';

        $response = $this->api('GET', '/learner/parent/dashboard', [], $headers);
        $this->assertTrue(
            in_array($response->status(), [403, 404], true),
            'Expected tenant isolation failure, got '.$response->status()
        );
    }

    public function test_mobile_sync_requires_auth(): void
    {
        $this->api('GET', '/mobile/sync')->assertUnauthorized();
    }
}
