<?php

return [
    'channels' => [
        'email' => [
            'enabled' => true,
            'driver' => env('NOTIFICATION_EMAIL_DRIVER', 'log'), // log|mail
        ],
        'sms' => [
            'enabled' => (bool) env('NOTIFICATION_SMS_ENABLED', false),
            'provider' => env('NOTIFICATION_SMS_PROVIDER', 'stub'),
        ],
        'whatsapp' => [
            'enabled' => (bool) env('NOTIFICATION_WHATSAPP_ENABLED', false),
            'provider' => env('NOTIFICATION_WHATSAPP_PROVIDER', 'stub'),
        ],
        'in_app' => [
            'enabled' => true,
        ],
    ],
];
