<?php

$base = 'http://127.0.0.1:8000/api/v1';

function req(string $method, string $url, ?string $token = null, array $body = []): array
{
    $ch = curl_init($url);
    $headers = ['Accept: application/json', 'Content-Type: application/json'];
    if ($token) {
        $headers[] = "Authorization: Bearer {$token}";
    }
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 30,
    ]);
    if ($body !== []) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }
    $raw = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return ['status' => $status, 'json' => json_decode((string) $raw, true), 'raw' => $raw];
}

$logins = [
    'super_admin' => ['admin', 'superadmin@learning-platform.local', 'ChangeMe!123', null],
    'customer_support' => ['admin', 'support@platform.test', 'Password!123', null],
    'auditor' => ['admin', 'auditor@platform.test', 'Password!123', null],
    'school_owner' => ['admin', 'owner@alnoor.test', 'Password!456', null],
];

$checks = [
    'api/v1/control/dashboard',
    'api/v1/control/tenants',
    'api/v1/org/billing/invoices',
];

foreach ($logins as $role => [$portal, $email, $pass, $slug]) {
    $payload = ['email' => $email, 'password' => $pass];
    if ($slug) {
        $payload['tenant_slug'] = $slug;
    }
    $res = req('POST', "{$base}/auth/{$portal}/login", null, $payload);
    $token = $res['json']['data']['token'] ?? null;
    if (! $token) {
        echo "$role LOGIN FAILED\n";
        continue;
    }
    echo "--- $role ---\n";
    foreach ($checks as $uri) {
        $r = req('GET', "http://127.0.0.1:8000/{$uri}", $token);
        $note = $r['json']['message'] ?? '';
        if ($r['status'] === 200) {
            $d = $r['json']['data'] ?? null;
            $note = is_array($d)
                ? ('role='.($d['role'] ?? '-').' items='.(is_array($d) && array_is_list($d) ? count($d) : count($d ?? [])))
                : 'ok';
            if (isset($r['json']['meta']['total'])) {
                $note .= ' total='.$r['json']['meta']['total'];
            }
        }
        printf("  %-3d %-38s %s\n", $r['status'], substr($uri, 7), $note);
    }
}
