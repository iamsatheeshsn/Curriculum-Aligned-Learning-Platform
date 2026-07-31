<?php

namespace Tests\Feature\Api;

use App\Domain\Billing\Models\TenantSubscription;
use App\Domain\Organization\Models\Tenant;
use Tests\TestCase;

class ControlSubscriptionsDirectoryTest extends TestCase
{
    public function test_super_admin_can_list_and_manage_subscriptions(): void
    {
        $auth = $this->loginAs('admin', 'superadmin@learning-platform.local', 'ChangeMe!123');
        $tenant = Tenant::query()->where('slug', 'al-noor')->firstOrFail();

        $this->api('GET', '/control/subscriptions?active_only=1', [], $auth['headers'])
            ->assertOk()
            ->assertJsonStructure([
                'data',
                'meta' => ['stats', 'plans'],
            ]);

        $changed = $this->api('POST', '/control/subscription/change-plan', [
            'plan_code' => 'starter',
            'tenant_id' => $tenant->id,
        ], $auth['headers'])
            ->assertOk()
            ->assertJsonPath('data.subscription.plan.code', 'starter');

        $subscriptionId = $changed->json('data.subscription.id');

        $this->api('GET', '/control/subscriptions/'.$subscriptionId, [], $auth['headers'])
            ->assertOk()
            ->assertJsonPath('data.id', $subscriptionId)
            ->assertJsonPath('data.status', 'active');

        $this->api('POST', '/control/subscriptions/'.$subscriptionId.'/cancel', [], $auth['headers'])
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled');

        $this->assertSame(
            'cancelled',
            TenantSubscription::query()->findOrFail($subscriptionId)->status
        );

        // Restore an active plan for demo continuity.
        $this->api('POST', '/control/subscription/change-plan', [
            'plan_code' => 'growth',
            'tenant_id' => $tenant->id,
        ], $auth['headers'])->assertOk();
    }
}
