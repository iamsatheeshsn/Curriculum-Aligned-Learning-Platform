<?php

namespace App\Domain\Identity\Services;

use App\Domain\Organization\Models\Tenant;
use App\Models\User;
use App\Support\Enums\Portal;
use App\Support\TenantContext;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Auth\Events\Verified;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\NewAccessToken;

class AuthService
{
    public function __construct(
        protected TenantContext $tenantContext,
    ) {}

    /**
     * @param  list<string>  $allowedRoleCodes
     * @return array{user: User, token: NewAccessToken, tenant: ?Tenant, roles: list<string>, permissions: list<string>}
     */
    public function login(
        string $email,
        string $password,
        Portal $portal,
        array $allowedRoleCodes,
        ?string $tenantSlug = null,
    ): array {
        $tenant = null;

        if ($portal === Portal::Control) {
            $user = User::query()->where('email', $email)->first();
        } else {
            if (! $tenantSlug) {
                throw ValidationException::withMessages([
                    'tenant_slug' => ['Tenant slug is required for this portal.'],
                ]);
            }

            $tenant = Tenant::query()->where('slug', $tenantSlug)->first();
            if (! $tenant || in_array($tenant->status, ['suspended', 'closed'], true)) {
                throw ValidationException::withMessages([
                    'tenant_slug' => ['Tenant is unavailable.'],
                ]);
            }

            $this->tenantContext->set(
                tenantId: (int) $tenant->id,
                tenantSlug: $tenant->slug,
                locale: $tenant->default_locale,
                timezone: $tenant->default_timezone,
                portal: $portal->value,
            );

            $user = User::query()
                ->where('email', $email)
                ->where('tenant_id', $tenant->id)
                ->first();
        }

        if (! $user || ! Hash::check($password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Invalid credentials.'],
            ]);
        }

        if ($user->status !== 'active') {
            throw ValidationException::withMessages([
                'email' => ['Account is not active.'],
            ]);
        }

        $rbac = app(RbacService::class);

        $roles = array_values(array_intersect(
            array_map(
                fn (string $code) => $rbac->resolveRoleCode($code),
                $this->roleCodesForUser($user)
            ),
            array_map(
                fn (string $code) => $rbac->resolveRoleCode($code),
                $allowedRoleCodes
            )
        ));

        if ($roles === []) {
            throw ValidationException::withMessages([
                'email' => ['You are not allowed to access this portal with this role.'],
            ]);
        }

        if ($portal === Portal::Control && in_array('school_owner', $roles, true) && $user->tenant_id) {
            $tenant = Tenant::query()->find($user->tenant_id);
            if ($tenant) {
                $this->assertTenantAccessible($tenant);
                $this->tenantContext->set(
                    tenantId: (int) $tenant->id,
                    tenantSlug: $tenant->slug,
                    locale: $user->locale ?: $tenant->default_locale,
                    timezone: $tenant->default_timezone,
                    portal: $portal->value,
                );
            }
        }

        if ($portal === Portal::Control && in_array('super_admin', $roles, true)) {
            $this->tenantContext->set(portal: $portal->value, locale: $user->locale ?: 'en');
        }

        if ($portal === Portal::Control && (in_array('customer_support', $roles, true) || in_array('auditor', $roles, true))) {
            $this->tenantContext->set(portal: $portal->value, locale: $user->locale ?: 'en');
        }

        $user->forceFill(['last_login_at' => now()])->save();

        $token = $user->createToken($portal->value.'-token', [$portal->value]);

        $permissionTenantId = $tenant?->id ?? $user->tenant_id;
        $rbac->forgetUserCache($user);
        $permissions = $rbac->permissionsFor($user, $permissionTenantId);

        return [
            'user' => $user->fresh(),
            'token' => $token,
            'tenant' => $tenant,
            'roles' => $roles,
            'permissions' => $permissions,
        ];
    }

    public function logout(User $user): void
    {
        $user->currentAccessToken()?->delete();
    }

    public function logoutAll(User $user): void
    {
        $user->tokens()->delete();
    }

    /** @return list<string> */
    public function roleCodesForUser(User $user, ?int $tenantId = null): array
    {
        $query = $user->tenantRoles()->with('role');
        if ($tenantId !== null) {
            $query->where('tenant_id', $tenantId);
        }

        return $query->get()
            ->pluck('role.code')
            ->filter()
            ->map(fn (string $code) => app(\App\Domain\Identity\Services\RbacService::class)->resolveRoleCode($code))
            ->unique()
            ->values()
            ->all();
    }

    public function changePassword(User $user, string $currentPassword, string $newPassword): void
    {
        if (! Hash::check($currentPassword, $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Current password is incorrect.'],
            ]);
        }

        $user->forceFill([
            'password' => $newPassword,
            'updated_by' => $user->id,
        ])->save();

        $currentId = $user->currentAccessToken()?->id;
        $user->tokens()->when($currentId, fn ($q) => $q->where('id', '!=', $currentId))->delete();
    }

    public function sendPasswordResetLink(string $email, ?string $tenantSlug = null): string
    {
        if ($tenantSlug) {
            $tenant = Tenant::query()->where('slug', $tenantSlug)->first();
            if (! $tenant) {
                return Password::INVALID_USER;
            }

            $exists = User::query()
                ->where('email', $email)
                ->where('tenant_id', $tenant->id)
                ->exists();

            if (! $exists) {
                return Password::INVALID_USER;
            }
        }

        return Password::broker()->sendResetLink(['email' => $email]);
    }

    public function resetPassword(array $credentials): string
    {
        return Password::broker()->reset(
            $credentials,
            function (User $user, string $password): void {
                $user->forceFill([
                    'password' => $password,
                    'remember_token' => Str::random(60),
                ])->save();

                event(new PasswordReset($user));
                $user->tokens()->delete();
            }
        );
    }

    public function sendEmailVerification(User $user): void
    {
        if ($user->hasVerifiedEmail()) {
            return;
        }

        $user->sendEmailVerificationNotification();
    }

    public function verifyEmail(User $user, string $hash): void
    {
        if (! hash_equals(sha1($user->getEmailForVerification()), $hash)) {
            throw ValidationException::withMessages([
                'email' => ['Invalid verification link.'],
            ]);
        }

        if (! $user->hasVerifiedEmail()) {
            $user->markEmailAsVerified();
            event(new Verified($user));
        }
    }

    private function assertTenantAccessible(Tenant $tenant): void
    {
        if (in_array($tenant->status, ['suspended', 'closed'], true)) {
            throw ValidationException::withMessages([
                'email' => ['Your organization is suspended. Contact support.'],
            ]);
        }
    }
}
