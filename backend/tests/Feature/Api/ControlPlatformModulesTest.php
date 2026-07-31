<?php



namespace Tests\Feature\Api;



use App\Domain\Audit\Models\AuditLog;

use App\Domain\Audit\Services\ControlAuditService;

use App\Domain\Platform\Models\PlatformIntegration;

use App\Domain\Platform\Models\PlatformSetting;

use Tests\TestCase;



class ControlPlatformModulesTest extends TestCase

{

    public function test_super_admin_can_manage_integrations_reports_audit_and_settings(): void

    {

        $auth = $this->loginAs('admin', 'superadmin@learning-platform.local', 'ChangeMe!123');



        $integrations = $this->api('GET', '/control/integrations/payment', [], $auth['headers'])

            ->assertOk()

            ->assertJsonStructure(['data', 'meta' => ['stats' => ['total', 'active', 'connected']]]);



        $this->assertGreaterThanOrEqual(4, count($integrations->json('data')));

        $this->assertContains('stripe', array_column($integrations->json('data'), 'code'));



        $this->api('PUT', '/control/integrations/payment/stripe', [

            'is_active' => true,

            'config' => ['api_key' => 'sk_test_secret_value'],

        ], $auth['headers'])

            ->assertOk()

            ->assertJsonPath('data.code', 'stripe')

            ->assertJsonPath('data.config.api_key', '********');



        $this->api('POST', '/control/integrations/payment/stripe/default', [], $auth['headers'])

            ->assertOk()

            ->assertJsonPath('data.is_default', true);



        $test = $this->api('POST', '/control/integrations/payment/stripe/test', [], $auth['headers'])

            ->assertOk()

            ->assertJsonPath('data.success', true)

            ->assertJsonPath('data.status', 'connected');



        $suffix = strtolower(substr(uniqid(), -6));

        $created = $this->api('POST', '/control/integrations/payment', [

            'code' => "custom_{$suffix}",

            'name_en' => 'Custom Gateway',

            'is_active' => true,

        ], $auth['headers'])

            ->assertCreated()

            ->assertJsonPath('data.code', "custom_{$suffix}");



        $customCode = $created->json('data.code');

        $this->api('DELETE', '/control/integrations/payment/'.$customCode, [], $auth['headers'])->assertOk();



        $this->api('GET', '/control/reports/revenue?months=6', [], $auth['headers'])

            ->assertOk()

            ->assertJsonStructure([

                'data' => [

                    'period' => ['months', 'from', 'to'],

                    'kpis' => ['mrr', 'arr'],

                    'revenue_trend',

                    'generated_at',

                ],

            ]);



        $this->api('GET', '/control/reports/schools', [], $auth['headers'])

            ->assertOk()

            ->assertJsonStructure(['data' => ['summary', 'schools', 'generated_at']]);



        $this->api('GET', '/control/reports/students', [], $auth['headers'])

            ->assertOk()

            ->assertJsonStructure(['data' => ['summary', 'by_tenant', 'recent', 'generated_at']]);



        $this->api('GET', '/control/reports/usage?months=6', [], $auth['headers'])

            ->assertOk()

            ->assertJsonStructure([

                'data' => [

                    'period',

                    'kpis' => ['total_tenants', 'mrr'],

                    'status_mix',

                    'generated_at',

                ],

            ]);



        $this->api('GET', '/control/audit/activity', [], $auth['headers'])

            ->assertOk()

            ->assertJsonStructure(['data', 'meta' => ['stats']]);



        $this->api('GET', '/control/audit/logins', [], $auth['headers'])

            ->assertOk()

            ->assertJsonStructure(['data', 'meta' => ['stats' => ['total', 'today', 'unique_users']]]);



        $log = app(ControlAuditService::class)->record([

            'actor_user_id' => (int) $auth['response']->json('data.user.id'),

            'action' => 'platform.settings.updated',

            'properties' => ['group' => 'global'],

            'ip_address' => '127.0.0.1',

        ]);



        $logId = (int) $log['id'];

        $this->assertNotNull($logId);



        $this->api('GET', '/control/audit/logs', [], $auth['headers'])

            ->assertOk()

            ->assertJsonStructure(['data', 'meta' => ['stats']]);



        $this->api('GET', '/control/audit/logs/'.$logId, [], $auth['headers'])

            ->assertOk()

            ->assertJsonPath('data.id', $logId)

            ->assertJsonPath('data.action', 'platform.settings.updated');



        $this->api('GET', '/control/settings/global', [], $auth['headers'])

            ->assertOk()

            ->assertJsonStructure(['data' => ['group', 'settings']]);



        $this->api('PUT', '/control/settings/global', [

            'settings' => [

                'platform_name' => 'Stemora Control',

                'support_email' => 'ops@learning-platform.local',

            ],

        ], $auth['headers'])

            ->assertOk()

            ->assertJsonPath('data.settings.platform_name', 'Stemora Control');



        $this->api('POST', '/control/settings/backup/run', [], $auth['headers'])

            ->assertOk()

            ->assertJsonStructure(['data' => ['job_id', 'status', 'artifacts']]);



        AuditLog::query()->where('id', $logId)->delete();

        PlatformIntegration::withTrashed()->where('code', "custom_{$suffix}")->forceDelete();

        PlatformSetting::query()->where('group_key', 'global')->whereIn('setting_key', ['platform_name', 'support_email'])->delete();

        PlatformSetting::query()->where('group_key', 'backup')->whereIn('setting_key', ['last_backup_at', 'last_backup_status'])->delete();

    }



    public function test_integration_categories_seed_defaults(): void

    {

        $auth = $this->loginAs('admin', 'superadmin@learning-platform.local', 'ChangeMe!123');



        foreach (['payment', 'email', 'sms', 'video', 'ai'] as $category) {

            $response = $this->api('GET', '/control/integrations/'.$category, [], $auth['headers'])

                ->assertOk();



            $this->assertGreaterThanOrEqual(3, count($response->json('data')));

        }

    }

}


