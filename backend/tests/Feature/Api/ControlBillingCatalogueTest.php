<?php

namespace Tests\Feature\Api;

use App\Domain\Billing\Models\BillingCoupon;
use App\Domain\Billing\Models\BillingTax;
use App\Domain\Billing\Models\SubscriptionPlan;
use App\Domain\Organization\Models\Tenant;
use Tests\TestCase;

class ControlBillingCatalogueTest extends TestCase
{
    public function test_super_admin_can_manage_billing_catalogue(): void
    {
        $auth = $this->loginAs('admin', 'superadmin@learning-platform.local', 'ChangeMe!123');

        $this->api('GET', '/control/billing/plans', [], $auth['headers'])
            ->assertOk()
            ->assertJsonStructure(['data', 'meta' => ['stats']]);

        $suffix = strtoupper(substr(uniqid(), -6));

        $plan = $this->api('POST', '/control/billing/plans', [
            'code' => "CTRL-{$suffix}",
            'name_en' => 'Control Test Plan',
            'name_ar' => 'خطة اختبار',
            'price' => 99,
            'currency' => 'SAR',
            'max_schools' => 2,
            'is_active' => true,
            'modules' => ['curriculum' => true],
        ], $auth['headers'])
            ->assertCreated()
            ->assertJsonPath('data.code', "CTRL-{$suffix}");

        $planId = (int) $plan->json('data.id');

        $this->api('PUT', '/control/billing/plans/'.$planId, [
            'price' => 120,
            'is_active' => false,
        ], $auth['headers'])
            ->assertOk()
            ->assertJsonPath('data.status', 'inactive');

        $this->api('GET', '/control/billing/invoices', [], $auth['headers'])
            ->assertOk()
            ->assertJsonStructure(['data', 'meta' => ['stats', 'tenants']]);

        $this->api('GET', '/control/billing/payments', [], $auth['headers'])
            ->assertOk()
            ->assertJsonStructure(['data', 'meta' => ['stats']]);

        $coupon = $this->api('POST', '/control/billing/coupons', [
            'code' => "SAVE{$suffix}",
            'name_en' => 'Save 10%',
            'discount_type' => 'percent',
            'discount_value' => 10,
            'is_active' => true,
        ], $auth['headers'])
            ->assertCreated()
            ->assertJsonPath('data.code', "SAVE{$suffix}");

        $couponId = (int) $coupon->json('data.id');
        $this->api('DELETE', '/control/billing/coupons/'.$couponId, [], $auth['headers'])->assertOk();
        $this->assertSoftDeleted('billing_coupons', ['id' => $couponId]);

        $tax = $this->api('POST', '/control/billing/taxes', [
            'code' => "VAT{$suffix}",
            'name_en' => 'VAT 15%',
            'rate_percent' => 15,
            'country_code' => 'SA',
            'is_active' => true,
        ], $auth['headers'])
            ->assertCreated()
            ->assertJsonPath('data.code', "VAT{$suffix}");

        $taxId = (int) $tax->json('data.id');
        $this->api('DELETE', '/control/billing/taxes/'.$taxId, [], $auth['headers'])->assertOk();
        $this->assertSoftDeleted('billing_taxes', ['id' => $taxId]);

        $this->api('DELETE', '/control/billing/plans/'.$planId, [], $auth['headers'])->assertOk();
        $this->assertSoftDeleted('subscription_plans', ['id' => $planId]);

        BillingCoupon::withTrashed()->where('id', $couponId)->forceDelete();
        BillingTax::withTrashed()->where('id', $taxId)->forceDelete();
        SubscriptionPlan::withTrashed()->where('id', $planId)->forceDelete();
    }

    public function test_can_generate_send_and_pay_invoice(): void
    {
        $auth = $this->loginAs('admin', 'superadmin@learning-platform.local', 'ChangeMe!123');
        $tenant = Tenant::query()->where('slug', '!=', 'platform')->orderBy('id')->first();
        if (! $tenant) {
            $this->markTestSkipped('No tenant available.');
        }

        $create = $this->api('POST', '/control/billing/invoices/generate', [
            'tenant_id' => $tenant->id,
        ], $auth['headers']);

        if ($create->status() === 422) {
            $this->markTestSkipped('Tenant has no active subscription plan.');
        }

        $create->assertCreated();
        $id = (int) $create->json('data.id');

        $this->api('POST', '/control/billing/invoices/'.$id.'/send', [], $auth['headers'])
            ->assertOk()
            ->assertJsonPath('data.status', 'sent');

        $this->api('POST', '/control/billing/invoices/'.$id.'/pay', [
            'amount' => (float) $create->json('data.total'),
            'method' => 'manual',
            'reference' => 'TEST-PAY',
        ], $auth['headers'])
            ->assertOk()
            ->assertJsonPath('data.status', 'paid');
    }
}
