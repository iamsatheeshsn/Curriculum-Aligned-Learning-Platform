<?php

namespace App\Support;

final class TenantContext
{
    private ?int $tenantId = null;

    private ?string $tenantSlug = null;

    private ?int $schoolId = null;

    private ?int $campusId = null;

    private string $locale = 'en';

    private ?string $timezone = null;

    private ?string $countryCode = null;

    private string $portal = 'control';

    public function set(
        ?int $tenantId = null,
        ?string $tenantSlug = null,
        ?int $schoolId = null,
        ?int $campusId = null,
        ?string $locale = null,
        ?string $timezone = null,
        ?string $countryCode = null,
        ?string $portal = null,
    ): void {
        $this->tenantId = $tenantId ?? $this->tenantId;
        $this->tenantSlug = $tenantSlug ?? $this->tenantSlug;
        $this->schoolId = $schoolId ?? $this->schoolId;
        $this->campusId = $campusId ?? $this->campusId;
        $this->locale = $locale ?? $this->locale;
        $this->timezone = $timezone ?? $this->timezone;
        $this->countryCode = $countryCode ?? $this->countryCode;
        $this->portal = $portal ?? $this->portal;
    }

    public function clear(): void
    {
        $this->tenantId = null;
        $this->tenantSlug = null;
        $this->schoolId = null;
        $this->campusId = null;
        $this->locale = 'en';
        $this->timezone = null;
        $this->countryCode = null;
        $this->portal = 'control';
    }

    public function tenantId(): ?int
    {
        return $this->tenantId;
    }

    public function tenantSlug(): ?string
    {
        return $this->tenantSlug;
    }

    public function schoolId(): ?int
    {
        return $this->schoolId;
    }

    public function campusId(): ?int
    {
        return $this->campusId;
    }

    public function locale(): string
    {
        return $this->locale;
    }

    public function timezone(): ?string
    {
        return $this->timezone;
    }

    public function countryCode(): ?string
    {
        return $this->countryCode;
    }

    public function portal(): string
    {
        return $this->portal;
    }

    public function hasTenant(): bool
    {
        return $this->tenantId !== null;
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'tenant_id' => $this->tenantId,
            'tenant_slug' => $this->tenantSlug,
            'school_id' => $this->schoolId,
            'campus_id' => $this->campusId,
            'locale' => $this->locale,
            'timezone' => $this->timezone,
            'country_code' => $this->countryCode,
            'portal' => $this->portal,
        ];
    }
}
