<?php

use App\Http\Middleware\InitializeTenancy;
use App\Http\Middleware\SetLocale;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        apiPrefix: 'api',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias([
            'tenancy' => InitializeTenancy::class,
            'locale' => SetLocale::class,
            'tenant.isolation' => \App\Http\Middleware\EnsureTenantIsolation::class,
            'subscription.active' => \App\Http\Middleware\EnsureActiveSubscription::class,
            'role' => \App\Http\Middleware\EnsurePortalRoles::class,
            'permission' => \App\Http\Middleware\EnsurePermission::class,
            'school.context' => \App\Http\Middleware\BindSchoolContext::class,
        ]);

        // Token-based API (Bearer Sanctum). Do NOT enable EnsureFrontendRequestsAreStateful —
        // that forces CSRF for first-party SPA origins and breaks portal/mobile JSON clients.
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
