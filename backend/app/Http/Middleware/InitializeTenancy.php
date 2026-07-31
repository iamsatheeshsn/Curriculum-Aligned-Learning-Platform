<?php

namespace App\Http\Middleware;

use App\Domain\Organization\Repositories\TenantRepository;
use App\Support\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class InitializeTenancy
{
    public function __construct(
        protected TenantContext $tenantContext,
        protected TenantRepository $tenants,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $slug = $request->header('X-Tenant-Slug')
            ?? $request->route('tenantSlug');

        if (is_string($slug) && $slug !== '') {
            $tenant = $this->tenants->findBySlug($slug);
            if (! $tenant || $tenant->status === 'suspended') {
                return response()->json([
                    'message' => 'Tenant not found or unavailable.',
                    'code' => 'tenant_unavailable',
                ], 404);
            }

            $this->tenantContext->set(
                tenantId: (int) $tenant->id,
                tenantSlug: $tenant->slug,
                locale: $tenant->default_locale,
                timezone: $tenant->default_timezone,
                portal: $request->header('X-Portal', 'institution'),
            );
        } elseif ($request->user()?->tenant_id) {
            $this->tenantContext->set(
                tenantId: (int) $request->user()->tenant_id,
                locale: $request->user()->locale ?? 'en',
                portal: $request->header('X-Portal', 'control'),
            );
        } elseif ($request->header('X-Tenant-ID') && $request->user()) {
            // Super Admin acting on a tenant (audited at controller/service layer).
            $this->tenantContext->set(
                tenantId: (int) $request->header('X-Tenant-ID'),
                portal: 'control',
            );
        }

        if ($request->header('X-School-ID')) {
            $this->tenantContext->set(schoolId: (int) $request->header('X-School-ID'));
        }

        if ($request->header('Accept-Language')) {
            $locale = substr((string) $request->header('Accept-Language'), 0, 2);
            if (in_array($locale, ['en', 'ar'], true)) {
                $this->tenantContext->set(locale: $locale);
                app()->setLocale($locale);
            }
        }

        return $next($request);
    }
}
