<?php

// One-off cleanup for records left behind by qa_crud_control.php (test-only).
require __DIR__.'/qa_crud_lib.php';

$S = qa_login('superadmin@learning-platform.local', 'ChangeMe!123');
$O = qa_login('owner@alnoor.test', 'Password!456');
$marker = $argv[1] ?? 'ZZQA56723';

// 1. country created by the authorisation probe
$c = qa('GET', '/control/countries', $S);
foreach ((array) qa_dg($c['json'], 'data', []) as $row) {
    if (($row['code'] ?? '') === 'ZY' || str_contains((string) ($row['name_en'] ?? ''), 'Should Fail') || str_contains((string) ($row['name_en'] ?? ''), 'QA Country')) {
        $d = qa('DELETE', '/control/countries/'.$row['id'], $S);
        printf("country %-4s %-22s -> HTTP %d\n", $row['id'], $row['code'].' '.$row['name_en'], $d['status']);
    }
}

// 2. orphan platform users
$u = qa('GET', '/control/platform-users?search=zzqa', $S);
foreach ((array) qa_dg($u['json'], 'data', []) as $row) {
    if (str_contains(strtolower((string) ($row['email'] ?? '')), 'zzqa')) {
        $d = qa('DELETE', '/control/platform-users/'.$row['id'], $S);
        printf("platform-user %-4s %-40s -> HTTP %d\n", $row['id'], $row['email'], $d['status']);
    }
}

// 3. QA curricula. A published curriculum is read-only and undeletable, so it
//    first has to be superseded by a new version; the clone is then removed too.
for ($pass = 0; $pass < 3; $pass++) {
    $cur = qa('GET', '/control/curricula?search=ZZQA', $S);
    $rows = array_values(array_filter(
        (array) qa_dg($cur['json'], 'data', []),
        fn ($r) => str_contains((string) ($r['code'] ?? ''), 'ZZQA') || str_contains((string) ($r['name_en'] ?? ''), 'QA Curriculum')
    ));
    if ($rows === []) {
        break;
    }
    foreach ($rows as $row) {
        $id = $row['id'];
        if (($row['status'] ?? '') === 'published') {
            $v = qa('POST', "/control/curricula/{$id}/versions", $S, ['version' => 'zzqa-cleanup-'.$pass, 'summary_en' => 'QA cleanup']);
            printf("curriculum %-4s supersede -> HTTP %d\n", $id, $v['status']);
        }
        $del = qa('DELETE', '/control/curricula/'.$id, $S);
        printf("curriculum %-4s %-24s delete HTTP %d %s\n", $id, (string) ($row['code'] ?? ''), $del['status'], $del['status'] === 200 ? '' : qa_msg($del, 120));
    }
}

// 4. any leftover ZZQA integrations
foreach (['payment', 'email', 'sms', 'video', 'ai'] as $cat) {
    $i = qa('GET', '/control/integrations/'.$cat, $S);
    foreach ((array) qa_dg($i['json'], 'data', []) as $row) {
        if (str_starts_with((string) ($row['code'] ?? ''), 'zzqa') || str_starts_with((string) ($row['code'] ?? ''), 'denyqa')) {
            $d = qa('DELETE', "/control/integrations/{$cat}/".$row['code'], $S);
            printf("integration %-8s %-20s -> HTTP %d\n", $cat, $row['code'], $d['status']);
        }
    }
}

// 5. leftover ZZQA school-groups / plans / coupons / taxes / campuses
$sweeps = [
    ['/control/tenant-groups', '/control/tenant-groups/%d', 'name', $S],
    ['/control/billing/plans', '/control/billing/plans/%d', 'code', $S],
    ['/control/billing/coupons', '/control/billing/coupons/%d', 'code', $S],
    ['/control/billing/taxes', '/control/billing/taxes/%d', 'code', $S],
    ['/control/campuses', '/control/campuses/%d', 'code', $S],
    ['/control/grades', '/control/grades/%d', 'code', $S],
    ['/control/subjects', '/control/subjects/%d', 'code', $S],
    ['/control/school-ops/subjects', '/control/school-ops/subjects/%d', 'code', $O],
    ['/control/school-ops/grades', '/control/school-ops/grades/%d', 'code', $O],
    ['/control/school-ops/campuses', '/control/school-ops/campuses/%d', 'code', $O],
];
foreach ($sweeps as [$list, $del, $field, $tok]) {
    $r = qa('GET', $list, $tok);
    foreach ((array) qa_dg($r['json'], 'data', []) as $row) {
        $hay = strtoupper((string) ($row[$field] ?? '').' '.($row['name_en'] ?? '').' '.($row['name'] ?? ''));
        if (str_contains($hay, 'ZZQA') || str_contains($hay, 'QA GROUP') || str_contains($hay, 'SHOULD FAIL')) {
            $d = qa('DELETE', sprintf($del, $row['id']), $tok);
            printf("%-34s %-6s %-24s -> HTTP %d\n", $list, $row['id'], substr($hay, 0, 24), $d['status']);
        }
    }
}

echo "cleanup done\n";
