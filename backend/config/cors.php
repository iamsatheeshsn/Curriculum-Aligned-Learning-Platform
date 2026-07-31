<?php

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    // Explicit local Vite apps + FRONTEND_URL; patterns cover port shifts (e.g. 5177)
    'allowed_origins' => array_values(array_filter(array_unique([
        'http://127.0.0.1:5173',
        'http://localhost:5173',
        'http://127.0.0.1:5174',
        'http://localhost:5174',
        'http://127.0.0.1:5175',
        'http://localhost:5175',
        'http://127.0.0.1:5176',
        'http://localhost:5176',
        'http://127.0.0.1:5177',
        'http://localhost:5177',
        'http://127.0.0.1:5178',
        'http://localhost:5178',
        env('FRONTEND_URL'),
    ]))),

    'allowed_origins_patterns' => [
        '#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#',
    ],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
