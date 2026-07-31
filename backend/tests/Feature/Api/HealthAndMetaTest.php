<?php

namespace Tests\Feature\Api;

use Tests\TestCase;

class HealthAndMetaTest extends TestCase
{
    public function test_health_endpoint_reports_ok_and_api_version(): void
    {
        $this->api('GET', '/health')
            ->assertOk()
            ->assertJsonPath('status', 'ok')
            ->assertJsonPath('api_version', config('mobile.api_version'))
            ->assertJsonStructure(['status', 'app', 'api_version', 'database', 'timestamp']);
    }

    public function test_meta_endpoint_lists_portals_and_capabilities(): void
    {
        $this->api('GET', '/meta', [], ['X-Client' => 'android', 'X-App-Version' => '0.1.0'])
            ->assertOk()
            ->assertJsonPath('data.api_version', '1.0.0')
            ->assertJsonPath('data.capabilities.push_notifications', false)
            ->assertJsonPath('data.client_hint.x_client', 'android')
            ->assertJsonStructure([
                'data' => [
                    'portals' => ['control', 'institution', 'learner'],
                    'notification_events',
                    'future_endpoints',
                ],
            ]);
    }

    public function test_tenant_by_slug_found(): void
    {
        $this->api('GET', '/tenants/by-slug/al-noor')
            ->assertOk()
            ->assertJsonPath('data.slug', 'al-noor');
    }

    public function test_tenant_by_slug_missing(): void
    {
        $this->api('GET', '/tenants/by-slug/does-not-exist-xyz')
            ->assertNotFound()
            ->assertJsonPath('code', 'tenant_not_found');
    }
}
