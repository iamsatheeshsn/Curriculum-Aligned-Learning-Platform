<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class HealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $dbOk = false;
        try {
            DB::connection()->getPdo();
            $dbOk = true;
        } catch (\Throwable) {
            $dbOk = false;
        }

        return response()->json([
            'status' => $dbOk ? 'ok' : 'degraded',
            'app' => config('app.name'),
            'api_version' => config('mobile.api_version'),
            'database' => $dbOk ? 'connected' : 'unavailable',
            'timestamp' => now()->toIso8601String(),
        ], $dbOk ? 200 : 503);
    }
}
