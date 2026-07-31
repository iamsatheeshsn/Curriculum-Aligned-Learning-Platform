<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Phase 19 — Documented stubs for future mobile-only endpoints (501 until implemented).
 */
class MobileFutureController extends Controller
{
    public function registerDevice(Request $request): JsonResponse
    {
        $request->validate([
            'platform' => ['required', 'in:android,ios'],
            'push_token' => ['required', 'string', 'max:512'],
            'device_id' => ['nullable', 'string', 'max:191'],
        ]);

        return response()->json([
            'message' => 'Device registration is planned for a future release. Use in-app notifications for V1.',
            'code' => 'mobile_feature_planned',
            'data' => [
                'endpoint' => 'POST /api/v1/mobile/devices',
                'status' => 'planned',
            ],
        ], 501);
    }

    public function unregisterDevice(int $id): JsonResponse
    {
        return response()->json([
            'message' => 'Device unregistration is planned for a future release.',
            'code' => 'mobile_feature_planned',
            'data' => ['id' => $id, 'status' => 'planned'],
        ], 501);
    }

    public function sync(Request $request): JsonResponse
    {
        $request->validate([
            'cursor' => ['nullable', 'string'],
            'resources' => ['nullable', 'array'],
        ]);

        return response()->json([
            'message' => 'Delta sync is planned for offline mobile. Poll resource endpoints in V1.',
            'code' => 'mobile_feature_planned',
            'data' => [
                'endpoint' => 'GET /api/v1/mobile/sync',
                'status' => 'planned',
                'v1_alternative' => [
                    'GET /api/v1/learner/student/notifications',
                    'GET /api/v1/learner/homework',
                    'GET /api/v1/learner/tutoring/sessions',
                ],
            ],
        ], 501);
    }
}
