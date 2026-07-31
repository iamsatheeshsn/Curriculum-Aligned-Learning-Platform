<?php

namespace Database\Seeders;

use App\Domain\Identity\Models\Role;
use App\Domain\Identity\Models\UserTenantRole;
use App\Domain\Organization\Models\Country;
use App\Domain\Organization\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class SuperAdminSeeder extends Seeder
{
    public function run(): void
    {
        $country = Country::query()->where('code', 'SA')->firstOrFail();
        $role = Role::query()->where('code', 'super_admin')->firstOrFail();

        $platform = Tenant::query()->firstOrCreate(
            ['slug' => 'platform'],
            [
                'name' => 'Platform',
                'legal_name' => 'K-12 STEM Platform Operator',
                'primary_country_id' => $country->id,
                'default_locale' => 'en',
                'default_timezone' => 'Asia/Riyadh',
                'status' => 'active',
            ]
        );

        $admin = User::query()->updateOrCreate(
            [
                'email' => 'superadmin@learning-platform.local',
                'tenant_id' => null,
            ],
            [
                'password' => Hash::make('ChangeMe!123'),
                'first_name' => 'Super',
                'last_name' => 'Admin',
                'locale' => 'en',
                'status' => 'active',
                'email_verified_at' => now(),
            ]
        );

        UserTenantRole::query()->updateOrCreate(
            [
                'user_id' => $admin->id,
                'tenant_id' => $platform->id,
                'role_id' => $role->id,
                'school_id' => null,
                'campus_id' => null,
            ],
            []
        );
    }
}
