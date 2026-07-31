<?php

use App\Http\Controllers\Api\V1\ApiMetaController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\MobileFutureController;
use App\Http\Middleware\InitializeTenancy;
use App\Http\Middleware\SetLocale;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->middleware([SetLocale::class])->group(function () {
    Route::get('/health', HealthController::class);
    Route::get('/meta', ApiMetaController::class);

    Route::middleware([InitializeTenancy::class])->group(function () {
        Route::get('/tenants/by-slug/{slug}', function (string $slug) {
            $tenant = app(\App\Domain\Organization\Services\TenantService::class)->findBySlug($slug);

            if (! $tenant) {
                return response()->json(['message' => 'Not found', 'code' => 'tenant_not_found'], 404);
            }

            return response()->json([
                'data' => [
                    'id' => $tenant->id,
                    'slug' => $tenant->slug,
                    'name' => $tenant->name,
                    'status' => $tenant->status,
                    'default_locale' => $tenant->default_locale,
                    'default_timezone' => $tenant->default_timezone,
                ],
            ]);
        });

        // Future mobile-only surfaces (501 stubs — design contract for Android/iOS)
        Route::prefix('mobile')->middleware(['auth:sanctum'])->group(function () {
            Route::post('/devices', [MobileFutureController::class, 'registerDevice']);
            Route::delete('/devices/{id}', [MobileFutureController::class, 'unregisterDevice']);
            Route::get('/sync', [MobileFutureController::class, 'sync']);
        });

        // Portal route groups
        Route::prefix('control')->group(base_path('routes/api/control.php'));
        Route::prefix('org')->group(base_path('routes/api/institution.php'));
        Route::prefix('learner')->group(base_path('routes/api/learner.php'));
        Route::prefix('auth')->group(base_path('routes/api/auth.php'));
    });
});
