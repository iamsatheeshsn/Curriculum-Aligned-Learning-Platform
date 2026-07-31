<?php

namespace Tests\Feature\Api;

use App\Domain\Organization\Models\Tenant;
use Tests\TestCase;

class ControlTenantDashboardTest extends TestCase
{
    public function test_super_admin_can_load_dashboard_and_list_tenants(): void
    {
        $auth = $this->loginAs('admin', 'superadmin@learning-platform.local', 'ChangeMe!123');

        $this->api('GET', '/control/dashboard', [], $auth['headers'])
            ->assertOk()
            ->assertJsonPath('data.role', 'super_admin')
            ->assertJsonStructure([
                'data' => [
                    'stats' => ['total_tenants', 'active', 'trial', 'suspended'],
                    'plan_health',
                    'plans',
                    'recent_tenants',
                ],
            ]);

        $this->api('GET', '/control/tenants', [], $auth['headers'])
            ->assertOk()
            ->assertJsonStructure(['data', 'meta']);
    }

    public function test_super_admin_can_load_saas_analytics(): void
    {
        $auth = $this->loginAs('admin', 'superadmin@learning-platform.local', 'ChangeMe!123');

        $this->api('GET', '/control/analytics/saas?months=6', [], $auth['headers'])
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'period' => ['months', 'from', 'to'],
                    'kpis' => [
                        'total_tenants',
                        'active_tenants',
                        'mrr',
                        'conversion_rate',
                        'schools',
                        'users',
                    ],
                    'status_mix',
                    'plan_mix',
                    'tenant_growth',
                    'revenue_trend',
                    'invoice_summary',
                    'trials_ending_soon',
                    'recent_signups',
                    'top_tenants',
                    'generated_at',
                ],
            ])
            ->assertJsonPath('data.period.months', 6);
    }

    public function test_super_admin_can_load_revenue_analytics(): void
    {
        $auth = $this->loginAs('admin', 'superadmin@learning-platform.local', 'ChangeMe!123');

        $this->api('GET', '/control/analytics/revenue?months=6', [], $auth['headers'])
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'period' => ['months', 'from', 'to'],
                    'kpis' => [
                        'mrr',
                        'arr',
                        'paid_revenue_period',
                        'payments_collected',
                        'outstanding_amount',
                        'collection_rate',
                    ],
                    'revenue_trend',
                    'payments_trend',
                    'revenue_by_plan',
                    'invoice_pipeline',
                    'top_paying_tenants',
                    'outstanding_invoices',
                    'recent_payments',
                    'generated_at',
                ],
            ])
            ->assertJsonPath('data.period.months', 6);
    }

    public function test_super_admin_can_load_system_health(): void
    {
        $auth = $this->loginAs('admin', 'superadmin@learning-platform.local', 'ChangeMe!123');

        $this->api('GET', '/control/analytics/system-health', [], $auth['headers'])
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'overall',
                    'summary' => ['total_checks', 'ok', 'warn', 'critical', 'avg_latency_ms'],
                    'checks',
                    'runtime' => ['app_name', 'env', 'php_version', 'laravel_version'],
                    'platform' => ['tenants', 'schools', 'users'],
                    'failed_jobs',
                    'queue_stats' => ['pending', 'failed', 'batches'],
                    'generated_at',
                ],
            ]);
    }

    public function test_tenant_owner_dashboard_includes_schools_and_branding(): void
    {
        $auth = $this->loginAs('admin', 'owner@alnoor.test', 'Password!456');

        $this->api('GET', '/control/dashboard', [], $auth['headers'])
            ->assertOk()
            ->assertJsonPath('data.role', 'school_owner')
            ->assertJsonStructure([
                'data' => [
                    'tenant' => ['id', 'slug', 'name', 'status'],
                    'schools',
                    'branding',
                    'billing_contact',
                    'invoices',
                    'usage',
                ],
            ]);
    }

    public function test_super_admin_can_update_tenant_status(): void
    {
        $auth = $this->loginAs('admin', 'superadmin@learning-platform.local', 'ChangeMe!123');
        $tenant = Tenant::query()->where('slug', 'al-noor')->first();
        $this->assertNotNull($tenant);

        $original = $tenant->status;

        $this->api('PATCH', '/control/tenants/'.$tenant->id.'/status', [
            'status' => 'suspended',
        ], $auth['headers'])
            ->assertOk()
            ->assertJsonPath('data.status', 'suspended');

        $this->api('PATCH', '/control/tenants/'.$tenant->id.'/status', [
            'status' => $original === 'suspended' ? 'active' : $original,
        ], $auth['headers'])->assertOk();
    }

    public function test_owner_can_generate_and_fetch_invoice_for_print(): void
    {
        $auth = $this->loginAs('admin', 'owner@alnoor.test', 'Password!456');
        $tenant = Tenant::query()->where('slug', 'al-noor')->firstOrFail();

        $created = $this->api('POST', '/control/tenants/'.$tenant->id.'/invoices', [], $auth['headers'])
            ->assertCreated()
            ->assertJsonStructure([
                'data' => [
                    'id',
                    'number',
                    'items',
                    'tenant' => ['slug', 'name'],
                ],
            ]);

        $invoiceId = $created->json('data.id');

        $this->api('GET', '/control/tenants/'.$tenant->id.'/invoices/'.$invoiceId, [], $auth['headers'])
            ->assertOk()
            ->assertJsonPath('data.id', $invoiceId)
            ->assertJsonStructure([
                'data' => [
                    'items',
                    'billing_contact',
                    'tenant',
                ],
            ]);
    }
}
