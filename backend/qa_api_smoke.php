<?php

/**
 * QA harness: logs in as every demo role and issues a GET against every
 * registered read-only API route, reporting anything that is not a success or
 * an expected authorisation rejection.
 *
 * Usage: php qa_api_smoke.php [--json=out.json]
 */

$base = 'http://127.0.0.1:8000/api/v1';

// [login endpoint, email, password, tenant slug]. The endpoint mirrors the
// portal each role is allowed into (see AuthController).
$accounts = [
    'super_admin' => ['admin', 'superadmin@learning-platform.local', 'ChangeMe!123', null],
    'customer_support' => ['admin', 'support@platform.test', 'Password!123', null],
    'auditor' => ['admin', 'auditor@platform.test', 'Password!123', null],
    'school_owner' => ['admin', 'owner@alnoor.test', 'Password!456', null],
    'school_owner_inst' => ['teacher', 'owner@alnoor.test', 'Password!456', 'al-noor'],
    'school_admin' => ['teacher', 'admin@alnoor.test', 'Password!123', 'al-noor'],
    'campus_admin' => ['teacher', 'campus@alnoor.test', 'Password!123', 'al-noor'],
    'principal' => ['teacher', 'principal@alnoor.test', 'Password!123', 'al-noor'],
    'academic_coordinator' => ['teacher', 'coordinator@alnoor.test', 'Password!123', 'al-noor'],
    'finance_manager' => ['teacher', 'finance@alnoor.test', 'Password!123', 'al-noor'],
    'teacher' => ['teacher', 'teacher@alnoor.test', 'Password!123', 'al-noor'],
    'tutor' => ['teacher', 'tutor@alnoor.test', 'Password!123', 'al-noor'],
    'student' => ['student', 'student@alnoor.test', 'Password!123', 'al-noor'],
    'parent' => ['parent', 'parent@alnoor.test', 'Password!123', 'al-noor'],
];

function request(string $method, string $url, ?string $token = null, array $body = []): array
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
    $err = curl_error($ch);
    curl_close($ch);

    return ['status' => $status, 'body' => $raw, 'json' => json_decode((string) $raw, true), 'error' => $err];
}

// ---------------------------------------------------------------- login pass
$tokens = [];
$loginResults = [];
foreach ($accounts as $role => [$portal, $email, $password, $tenant]) {
    $payload = ['email' => $email, 'password' => $password];
    if ($tenant) {
        $payload['tenant_slug'] = $tenant;
    }
    $res = request('POST', "{$base}/auth/{$portal}/login", null, $payload);
    $token = $res['json']['data']['token'] ?? null;
    $tokens[$role] = $token;
    $loginResults[$role] = [
        'status' => $res['status'],
        'ok' => $token !== null,
        'roles' => $res['json']['data']['roles'] ?? null,
        'message' => $res['json']['message'] ?? null,
    ];
}

echo "=== LOGIN RESULTS ===\n";
foreach ($loginResults as $role => $r) {
    printf("%-22s %s  HTTP %d  %s\n", $role, $r['ok'] ? 'OK  ' : 'FAIL', $r['status'], $r['ok'] ? implode(',', $r['roles'] ?? []) : ($r['message'] ?? ''));
}

// ------------------------------------------------------------- route harvest
$routesFile = __DIR__.'/../routes.json';
$rawRoutes = (string) file_get_contents($routesFile);
// PowerShell redirection writes UTF-16LE; normalise before decoding.
if (str_starts_with($rawRoutes, "\xFF\xFE") || str_starts_with($rawRoutes, "\xFF\xFE")) {
    $rawRoutes = mb_convert_encoding($rawRoutes, 'UTF-8', 'UTF-16LE');
}
$rawRoutes = ltrim($rawRoutes, "\xEF\xBB\xBF\xFF\xFE\x00");
$routes = json_decode($rawRoutes, true);
if (! is_array($routes)) {
    fwrite(STDERR, "Could not decode routes.json: ".json_last_error_msg()."\n");
    exit(1);
}

$targets = [];
foreach ($routes as $route) {
    $uri = $route['uri'] ?? '';
    $methods = strtoupper((string) ($route['method'] ?? ''));
    if (! str_starts_with($uri, 'api/v1/')) {
        continue;
    }
    if (! str_contains($methods, 'GET')) {
        continue;
    }
    if (str_contains($uri, '{')) {
        continue; // parameterised routes need real ids; covered by the CRUD pass
    }
    if (str_contains($uri, 'logout')) {
        continue;
    }
    $targets[$uri] = true;
}
$targets = array_keys($targets);
sort($targets);

echo "\n=== ENDPOINT SWEEP (".count($targets)." GET routes x ".count(array_filter($tokens))." roles) ===\n";

$failures = [];
$counts = [];
foreach ($tokens as $role => $token) {
    if (! $token) {
        continue;
    }
    foreach ($targets as $uri) {
        $url = 'http://127.0.0.1:8000/'.$uri;
        $res = request('GET', $url, $token);
        $status = $res['status'];
        $counts[$status] = ($counts[$status] ?? 0) + 1;

        // 200/204 = fine. 401/403 = RBAC doing its job. 404 on tenant-scoped
        // data for a platform role is also expected. Anything else is a bug.
        if (in_array($status, [200, 201, 204, 401, 403], true)) {
            continue;
        }
        $failures[] = [
            'role' => $role,
            'uri' => $uri,
            'status' => $status,
            'message' => $res['json']['message'] ?? substr(strip_tags((string) $res['body']), 0, 200),
        ];
    }
}

echo "Status distribution: ".json_encode($counts)."\n";
echo "\n=== FAILURES (".count($failures).") ===\n";
foreach ($failures as $f) {
    printf("%-22s %-3d %-60s %s\n", $f['role'], $f['status'], $f['uri'], str_replace("\n", ' ', (string) $f['message']));
}

file_put_contents(__DIR__.'/../qa_api_results.json', json_encode([
    'logins' => $loginResults,
    'counts' => $counts,
    'failures' => $failures,
], JSON_PRETTY_PRINT));

echo "\nWrote qa_api_results.json\n";
