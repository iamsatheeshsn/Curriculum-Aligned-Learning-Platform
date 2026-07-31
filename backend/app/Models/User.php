<?php

namespace App\Models;

use App\Domain\Identity\Models\UserTenantRole;
use App\Domain\Organization\Models\Tenant;
use App\Notifications\ResetPasswordNotification;
use App\Notifications\VerifyEmailNotification;
use App\Support\Traits\HasAuditColumns;
use App\Domain\Identity\Services\RbacService;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens;
    use HasAuditColumns;
    use HasFactory;
    use Notifiable;
    use SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'email',
        'password',
        'first_name',
        'last_name',
        'first_name_ar',
        'last_name_ar',
        'phone',
        'locale',
        'timezone',
        'status',
        'email_verified_at',
        'last_login_at',
        'created_by',
        'updated_by',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function tenantRoles(): HasMany
    {
        return $this->hasMany(UserTenantRole::class);
    }

    public function hasRole(string $code, ?int $tenantId = null): bool
    {
        return app(RbacService::class)->hasRole($this, $code, $tenantId);
    }

    public function hasPermission(string $permission, ?int $tenantId = null): bool
    {
        return app(RbacService::class)->can($this, $permission, $tenantId ?? $this->tenant_id);
    }

    /** @return list<string> */
    public function permissionCodes(?int $tenantId = null): array
    {
        return app(RbacService::class)->permissionsFor($this, $tenantId ?? $this->tenant_id);
    }

    public function sendEmailVerificationNotification(): void
    {
        $this->notify(new VerifyEmailNotification);
    }

    public function sendPasswordResetNotification(#[\SensitiveParameter] $token): void
    {
        $this->notify(new ResetPasswordNotification($token));
    }
}
