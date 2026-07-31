<?php

namespace App\Http\Middleware;

use App\Domain\Billing\Services\SubscriptionService;
use App\Domain\Organization\Models\Tenant;
use App\Support\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureActiveSubscription
{
    public function __construct(
        protected TenantContext $tenantContext,
        protected SubscriptionService $subscriptions,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $tenantId = $this->tenantContext->tenantId() ?? $request->user()?->tenant_id;
        if (! $tenantId) {
            return $next($request); // platform super admin
        }

        $tenant = Tenant::query()->find($tenantId);
        if (! $tenant) {
            return response()->json(['message' => 'Tenant not found.', 'code' => 'tenant_not_found'], 404);
        }

        try {
            $this->subscriptions->assertActive($tenant);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'errors' => $e->errors(),
                'code' => 'subscription_inactive',
            ], 402);
        }

        return $next($request);
    }
}
