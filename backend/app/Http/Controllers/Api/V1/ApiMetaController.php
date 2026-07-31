<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Notification\NotificationEvents;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Phase 19 — Mobile / client bootstrap metadata (no native apps in V1).
 */
class ApiMetaController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        return response()->json([
            'data' => [
                'api_version' => config('mobile.api_version'),
                'min_supported_api_version' => config('mobile.min_supported_api_version'),
                'product' => config('app.name'),
                'clients' => config('mobile.clients'),
                'auth' => config('mobile.auth'),
                'required_headers' => config('mobile.required_headers'),
                'pagination' => config('mobile.pagination'),
                'envelope' => config('mobile.envelope'),
                'locales' => ['en', 'ar'],
                'portals' => [
                    'control' => ['prefix' => '/api/v1/control', 'roles' => ['super_admin', 'tenant_owner', 'school_owner']],
                    'institution' => ['prefix' => '/api/v1/org', 'roles' => ['school_admin', 'teacher', 'tutor']],
                    'learner' => ['prefix' => '/api/v1/learner', 'roles' => ['student', 'parent']],
                ],
                'notification_events' => NotificationEvents::all(),
                'notification_channels' => NotificationEvents::defaultChannels(),
                'capabilities' => config('mobile.capability_flags'),
                'future_endpoints' => config('mobile.future_endpoints'),
                'openapi' => url('/docs/openapi/openapi-v1.yaml'),
                'health' => url('/api/v1/health'),
                'client_hint' => [
                    'x_client' => $request->header('X-Client'),
                    'x_app_version' => $request->header('X-App-Version'),
                    'x_device_id' => $request->header('X-Device-Id'),
                ],
            ],
        ]);
    }
}
