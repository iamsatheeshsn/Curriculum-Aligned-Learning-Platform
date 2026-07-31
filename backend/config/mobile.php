<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Mobile API readiness (Phase 19) — no native apps in V1
    |--------------------------------------------------------------------------
    | Android/iOS clients must consume the same /api/v1 contract as web portals.
    */
    'api_version' => '1.0.0',
    'min_supported_api_version' => '1.0.0',
    'openapi_path' => 'docs/openapi/openapi-v1.yaml',

    'clients' => [
        'android' => ['status' => 'planned', 'min_os' => 'Android 10'],
        'ios' => ['status' => 'planned', 'min_os' => 'iOS 15'],
        'web' => ['status' => 'ga', 'portals' => ['control', 'institution', 'learner', 'website']],
    ],

    'auth' => [
        'scheme' => 'Bearer',
        'token_header' => 'Authorization',
        'token_type' => 'Laravel Sanctum personal access token',
        'abilities_by_portal' => [
            'control' => ['control'],
            'institution' => ['institution'],
            'learner' => ['learner'],
        ],
        'refresh' => 'not_supported_v1_relogin',
    ],

    'required_headers' => [
        'Accept' => 'application/json',
        'Authorization' => 'Bearer {token} (authenticated routes)',
        'X-Tenant-Slug' => 'required for institution & learner',
        'X-School-ID' => 'recommended when school-scoped',
        'Accept-Language' => 'en|ar',
        'X-Portal' => 'optional: control|institution|learner',
        'X-Client' => 'optional: android|ios|web',
        'X-App-Version' => 'optional semver of mobile build',
        'X-Device-Id' => 'optional stable device UUID for future push',
    ],

    'pagination' => [
        'style' => 'laravel_length_aware',
        'query' => ['page', 'per_page'],
        'default_per_page' => 10,
        'max_per_page' => 100,
    ],

    'envelope' => [
        'success' => ['message?', 'data?'],
        'error' => ['message', 'code?', 'errors?'],
    ],

    'future_endpoints' => [
        'POST /api/v1/mobile/devices' => 'Register FCM/APNs device token (planned)',
        'DELETE /api/v1/mobile/devices/{id}' => 'Unregister device (planned)',
        'POST /api/v1/auth/token/refresh' => 'Optional refresh tokens (planned)',
        'GET /api/v1/mobile/sync' => 'Delta sync cursor for offline (planned)',
    ],

    'capability_flags' => [
        'live_tutoring' => true,
        'assessments' => true,
        'parent_portal' => true,
        'in_app_notifications' => true,
        'push_notifications' => false,
        'offline_sync' => false,
        'biometric_login_hint' => true,
    ],
];
