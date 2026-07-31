<?php

namespace Tests\Unit;

use App\Domain\Identity\Services\RbacService;
use App\Support\TenantContext;
use Tests\TestCase;

class RbacServiceUnitTest extends TestCase
{
    public function test_resolve_role_code_uses_aliases(): void
    {
        $svc = new RbacService(app(TenantContext::class));

        $this->assertSame('school_owner', $svc->resolveRoleCode('tenant_owner'));
        $this->assertSame('teacher', $svc->resolveRoleCode('teacher'));
    }
}
