<?php

namespace App\Domain\Organization\Services;

use App\Domain\Billing\Models\SubscriptionPlan;
use App\Domain\Billing\Models\TenantSubscription;
use App\Domain\Identity\Models\Role;
use App\Domain\Identity\Models\UserTenantRole;
use App\Domain\Organization\Events\TenantCreated;
use App\Domain\Organization\Models\Country;
use App\Domain\Organization\Models\School;
use App\Domain\Organization\Models\Tenant;
use App\Domain\Organization\Models\TenantBranding;
use App\Models\User;
use App\Services\BaseService;
use App\Support\TenantContext;
use Illuminate\Auth\Events\Registered;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SchoolRegistrationService extends BaseService
{
    public function __construct(TenantContext $tenantContext)
    {
        parent::__construct($tenantContext);
    }

    /** @param array<string, mixed> $data */
    public function register(array $data): array
    {
        return $this->transaction(function () use ($data) {
            $slug = Str::slug($data['slug'] ?? $data['organization_name']);
            if (Tenant::withTrashed()->where('slug', $slug)->exists()) {
                throw ValidationException::withMessages([
                    'slug' => ['This organization slug is already taken.'],
                ]);
            }

            if (User::query()->where('email', $data['email'])->exists()) {
                throw ValidationException::withMessages([
                    'email' => ['This email is already registered.'],
                ]);
            }

            $country = Country::query()
                ->where('code', strtoupper($data['country_code']))
                ->where('is_active', true)
                ->first();

            if (! $country) {
                throw ValidationException::withMessages([
                    'country_code' => ['Unsupported country.'],
                ]);
            }

            $planCode = $data['plan_code'] ?? 'starter';
            $plan = SubscriptionPlan::query()
                ->where('code', $planCode)
                ->where('is_active', true)
                ->first();

            if (! $plan) {
                throw ValidationException::withMessages([
                    'plan_code' => ['Invalid subscription plan.'],
                ]);
            }

            $tenant = Tenant::query()->create([
                'slug' => $slug,
                'name' => $data['organization_name'],
                'legal_name' => $data['legal_name'] ?? $data['organization_name'],
                'primary_country_id' => $country->id,
                'default_locale' => $data['locale'] ?? $country->default_locale,
                'default_timezone' => $country->default_timezone,
                'status' => 'trial',
                'trial_ends_at' => now()->addDays((int) ($data['trial_days'] ?? 14)),
            ]);

            TenantBranding::query()->create([
                'tenant_id' => $tenant->id,
                'primary_color' => $data['primary_color'] ?? null,
                'secondary_color' => $data['secondary_color'] ?? null,
            ]);

            $subscription = TenantSubscription::query()->create([
                'tenant_id' => $tenant->id,
                'plan_id' => $plan->id,
                'starts_at' => now(),
                'ends_at' => $tenant->trial_ends_at,
                'status' => 'active',
            ]);

            $owner = User::query()->create([
                'tenant_id' => $tenant->id,
                'email' => $data['email'],
                'password' => $data['password'],
                'first_name' => $data['first_name'],
                'last_name' => $data['last_name'],
                'phone' => $data['phone'] ?? null,
                'locale' => $data['locale'] ?? $tenant->default_locale,
                'timezone' => $tenant->default_timezone,
                'status' => 'active',
            ]);

            $ownerRole = Role::query()->where('code', 'school_owner')->firstOrFail();
            UserTenantRole::query()->create([
                'user_id' => $owner->id,
                'tenant_id' => $tenant->id,
                'role_id' => $ownerRole->id,
            ]);

            $school = School::query()->create([
                'tenant_id' => $tenant->id,
                'country_id' => $country->id,
                'code' => $data['school_code'] ?? 'MAIN',
                'name_en' => $data['school_name'] ?? $data['organization_name'],
                'name_ar' => $data['school_name_ar'] ?? $data['school_name'] ?? $data['organization_name'],
                'status' => 'active',
                'timezone' => $tenant->default_timezone,
                'created_by' => $owner->id,
                'updated_by' => $owner->id,
            ]);

            event(new TenantCreated($tenant, $owner->id));
            event(new Registered($owner));

            $owner->sendEmailVerificationNotification();

            $token = $owner->createToken('control-token', ['control']);

            return [
                'tenant' => $tenant->fresh(),
                'school' => $school->fresh(),
                'user' => $owner->fresh(),
                'subscription' => $subscription->load('plan'),
                'token' => $token,
                'roles' => ['school_owner'],
            ];
        });
    }
}
