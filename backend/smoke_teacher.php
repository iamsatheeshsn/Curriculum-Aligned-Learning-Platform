<?php

/** Temporary smoke test for the teacher portal API. */
$base = 'http://127.0.0.1:8000/api/v1';

function call(string $method, string $url, array $headers = [], ?array $body = null): array
{
    $ch = curl_init($url);
    $headers[] = 'Accept: application/json';
    if ($body !== null) {
        $headers[] = 'Content-Type: application/json';
    }
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 30,
    ]);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }
    $raw = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return ['code' => $code, 'body' => $raw, 'json' => json_decode((string) $raw, true)];
}

$email = $argv[1] ?? 'teacher@alnoor.test';
$login = call('POST', "$base/auth/teacher/login", [], [
    'email' => $email,
    'password' => 'Password!123',
    'tenant_slug' => 'al-noor',
]);

$token = $login['json']['token'] ?? $login['json']['data']['token'] ?? null;
if (! $token) {
    echo "LOGIN FAILED ({$login['code']}): ".substr((string) $login['body'], 0, 600)."\n";
    exit(1);
}
echo "Logged in as $email\n\n";

$auth = ['Authorization: Bearer '.$token, 'X-Tenant-Slug: al-noor'];

$endpoints = [
    'context' => '/org/teacher/context',
    'lesson-plans' => '/org/teacher/lesson-plans',
    'course-content' => '/org/teacher/course-content',
    'homework' => '/org/teacher/assignments?kind=homework',
    'assignments' => '/org/teacher/assignments?kind=assignment',
    'quizzes' => '/org/teacher/assessments?type=quiz',
    'exams' => '/org/teacher/assessments?type=exam',
    'attendance' => '/org/teacher/attendance',
    'grade-book' => '/org/teacher/grade-book',
    'class-progress' => '/org/teacher/class-progress',
    'resources' => '/org/teacher/resources',
    'messages' => '/org/teacher/messages',
    'recipients' => '/org/teacher/messages/recipients',
    'profile' => '/org/teacher/profile',
];

$failed = 0;
foreach ($endpoints as $label => $path) {
    $res = call('GET', $base.$path, $auth);
    $json = $res['json'];
    $count = '-';
    if (isset($json['data'])) {
        if (array_is_list($json['data'] ?? [])) {
            $count = count($json['data']).' rows';
        } elseif (is_array($json['data'])) {
            $count = 'keys: '.implode(',', array_slice(array_keys($json['data']), 0, 6));
        }
    }
    $status = $res['code'] === 200 ? 'OK ' : 'ERR';
    if ($res['code'] !== 200) {
        $failed++;
    }
    printf("%s %-16s %3d  %s\n", $status, $label, $res['code'], $count);
    if ($res['code'] !== 200) {
        echo '      '.substr((string) $res['body'], 0, 400)."\n";
    }
}

echo "\n".($failed === 0 ? "All endpoints OK\n" : "$failed endpoint(s) failed\n");
