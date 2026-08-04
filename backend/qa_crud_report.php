<?php

// Small viewer for qa_crud_control_results.json (test-only helper).
$file = $argv[2] ?? (__DIR__.'/qa_crud_control_results.json');
$j = json_decode((string) file_get_contents($file), true);
$from = (int) ($argv[1] ?? 0);
foreach ($j['rows'] as $i => $r) {
    if ($i < $from) {
        continue;
    }
    printf("%3d %-42s %-18s %-6s %-5s %s\n", $i, $r['resource'], $r['step'], (string) $r['status'], $r['ok'] ? 'PASS' : 'FAIL', substr($r['note'], 0, 100));
}
echo "\n--- findings ---\n";
foreach ($j['findings'] as $k => $f) {
    printf("#%d [%s] %s %s %s -> HTTP %d :: %s\n", $k + 1, $f['severity'], $f['resource'], $f['method'], $f['path'], $f['status'], substr($f['why'], 0, 120));
}
