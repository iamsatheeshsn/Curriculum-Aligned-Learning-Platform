<?php

namespace App\Http\Middleware;

use App\Domain\Billing\Services\SubscriptionService;
use App\Domain\Organization\Models\Tenant;
use App\Support\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureTenantIsolation
{
    public function __construct(
        protected TenantContext $tenantContext,
        protected SubscriptionService $subscriptions,
    ) {}

    public function handle(Request $request, Closure $next, string ...$guards): Response
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.', 'code' => 'unauthenticated'], 401);
        }

        // Platform control operators (null tenant_id) may operate cross-tenant via X-Tenant-ID
        // already bound in InitializeTenancy. Super Admin, Customer Support, and Auditor share this path.
        $isPlatformOperator = $user->tenant_id === null && (
            $user->hasRole('super_admin')
            || $user->hasRole('customer_support')
            || $user->hasRole('auditor')
        );

        if (! $isPlatformOperator) {
            $contextTenantId = $this->tenantContext->tenantId();

            if ($user->tenant_id === null) {
                return response()->json(['message' => 'Forbidden.', 'code' => 'forbidden'], 403);
            }

            if ($contextTenantId !== null && (int) $contextTenantId !== (int) $user->tenant_id) {
                return response()->json([
                    'message' => 'Tenant isolation violation.',
                    'code' => 'tenant_mismatch',
                ], 403);
            }

            if ($contextTenantId === null) {
                $this->tenantContext->set(
                    tenantId: (int) $user->tenant_id,
                    tenantSlug: $user->tenant?->slug,
                    locale: $user->locale ?? 'en',
                );
            }

            $tenant = Tenant::query()->find($user->tenant_id);
            if (! $tenant || in_array($tenant->status, ['suspended', 'closed'], true)) {
                return response()->json([
                    'message' => 'Tenant unavailable.',
                    'code' => 'tenant_unavailable',
                ], 403);
            }
        }

        return $next($request);
    }
}
