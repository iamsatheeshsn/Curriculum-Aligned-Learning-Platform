<?php

namespace Tests\Feature\Api;

use App\Domain\Organization\Models\Tenant;
use Tests\TestCase;

class ControlTenantTrialsTest extends TestCase
{
    public function test_super_admin_can_manage_trial_accounts(): void
    {
        $auth = $this->loginAs('admin', 'superadmin@learning-platform.local', 'ChangeMe!123');
        $tenant = Tenant::query()->where('slug', 'al-noor')->firstOrFail();
        $originalStatus = $tenant->status;
        $originalEnds = $tenant->trial_ends_at;

        $this->api('POST', '/control/trials/'.$tenant->id.'/start', [
            'days' => 5,
        ], $auth['headers'])
            ->assertOk()
            ->assertJsonPath('data.status', 'trial')
            ->assertJsonPath('data.urgency', 'ending_soon');

        $this->api('GET', '/control/trials?filter=active', [], $auth['headers'])
            ->assertOk()
            ->assertJsonStructure([
                'data',
                'meta' => ['stats'],
            ]);

        $this->api('POST', '/control/trials/'.$tenant->id.'/extend', [
            'days' => 5,
        ], $auth['headers'])
            ->assertOk()
            ->assertJsonPath('data.status', 'trial');

        $this->api('POST', '/control/trials/'.$tenant->id.'/convert', [], $auth['headers'])
            ->assertOk()
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.urgency', 'converted');

        // Restore prior state for local demos.
        $tenant->forceFill([
            'status' => $originalStatus,
            'trial_ends_at' => $originalEnds,
        ])->save();
    }
}
