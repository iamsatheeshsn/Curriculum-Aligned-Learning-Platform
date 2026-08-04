<?php

$data = json_decode((string) file_get_contents(__DIR__.'/../qa_api_results.json'), true);
$failures = $data['failures'] ?? [];

// Messages that describe correct behaviour rather than a defect.
$expected = [
    'Tenant context required.',
    'No tutor profile is linked to your account.',
    'The student user id field is required.',
    'student_user_id is required.',
    'Delta sync is planned for offline mobile. Poll resource endpoints in V1.',
];

$suspect = [];
foreach ($failures as $f) {
    $msg = trim((string) $f['message']);
    if (in_array($msg, $expected, true)) {
        continue;
    }
    $key = $f['status'].' | '.$f['uri'].' | '.$msg;
    $suspect[$key][] = $f['role'];
}

echo "=== SUSPECT FAILURES (".count($suspect)." distinct) ===\n\n";
foreach ($suspect as $key => $roles) {
    echo $key."\n    roles: ".implode(', ', $roles)."\n\n";
}
