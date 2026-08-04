<?php

/**
 * QA harness: exercises the WRITE endpoints (POST/PUT/PATCH/DELETE) of the
 * Control portal API and reports which lifecycles are broken.
 *
 * Test-only: it never touches application code. Every record it creates is
 * marked with a ZZQA<random> token and is deleted again where a DELETE
 * endpoint exists; anything that cannot be removed is reported as a leftover.
 *
 * Usage:
 *   php qa_crud_control.php
 *   php qa_crud_control.php --only=chapters,lessons        # run a subset
 *   php qa_crud_control.php --only=ws/staff --adopt=ZZQA123 # reuse records
 *                                                            from a prior run
 *                                                            instead of
 *                                                            creating new ones
 */

require __DIR__.'/qa_crud_lib.php';

$MARK = 'ZZQA'.random_int(10000, 99999);
$PW = 'ZzQa!2345678';
$ONLY = [];
$ADOPT = null;
foreach ($argv as $arg) {
    if (str_starts_with($arg, '--only=')) {
        $ONLY = array_filter(array_map('trim', explode(',', substr($arg, 7))));
    }
    if (str_starts_with($arg, '--adopt=')) {
        $ADOPT = substr($arg, 8);
    }
}
if ($ADOPT) {
    $MARK = $ADOPT;
}

function qa_selected(string $name): bool
{
    global $ONLY;
    if ($ONLY === []) {
        return true;
    }
    foreach ($ONLY as $needle) {
        if (str_contains($name, $needle)) {
            return true;
        }
    }

    return false;
}

// ---------------------------------------------------------------- reporting
$ROWS = [];
$LEFTOVERS = [];
$FINDINGS = [];

function record(string $resource, string $step, string $method, string $path, array $res, bool $ok, string $note = ''): void
{
    global $ROWS;
    $ROWS[] = [
        'resource' => $resource, 'step' => $step, 'method' => $method, 'path' => $path,
        'status' => $res['status'] ?? 0, 'ok' => $ok, 'note' => $note,
    ];
}

function finding(string $severity, string $resource, string $method, string $path, $payload, array $res, string $why): void
{
    global $FINDINGS;
    $FINDINGS[] = [
        'severity' => $severity, 'resource' => $resource, 'method' => $method, 'path' => $path,
        'payload' => $payload, 'status' => $res['status'] ?? 0,
        'body' => substr(str_replace("\n", ' ', (string) ($res['body'] ?? '')), 0, 900),
        'why' => $why,
    ];
}

function leftover(string $what, $id, string $why): void
{
    global $LEFTOVERS;
    $LEFTOVERS[] = ['what' => $what, 'id' => $id, 'why' => $why];
}

/** Detect stack traces / class names / SQL leaking into an API response. */
function leaks_internals(array $res): ?string
{
    foreach (['App\\\\Domain', 'App\\Domain', 'SQLSTATE', 'QueryException', 'Illuminate\\\\Database',
        'ModelNotFoundException', 'Call to a member function', 'TypeError', '/vendor/laravel'] as $needle) {
        if (stripos((string) ($res['body'] ?? ''), $needle) !== false) {
            return $needle;
        }
    }

    return null;
}

// ---------------------------------------------------------------- login
echo "=== LOGIN ===\n";
$T = [
    'super' => qa_login('superadmin@learning-platform.local', 'ChangeMe!123'),
    'owner' => qa_login('owner@alnoor.test', 'Password!456'),
];
foreach ($T as $k => $v) {
    printf("%-6s %s\n", $k, $v ? 'token ok' : 'NO TOKEN');
}
if (! $T['super'] || ! $T['owner']) {
    fwrite(STDERR, "Cannot continue without both tokens.\n");
    exit(1);
}
$S = $T['super'];
$O = $T['owner'];

// ---------------------------------------------------------------- lookups
echo "\n=== LOOKUPS ===\n";
$ctx = [];

$countries = qa('GET', '/control/countries', $S);
$ctx['country_id'] = qa_dg($countries['json'], 'data.0.id');
$used = [];
foreach ((array) qa_dg($countries['json'], 'data', []) as $row) {
    $used[strtoupper((string) ($row['code'] ?? ''))] = true;
}
$ctx['free_country_code'] = null;
foreach (['XA', 'XB', 'XC', 'XD', 'XE', 'XZ', 'ZB', 'ZC', 'ZD', 'ZZ', 'QX', 'QZ'] as $cand) {
    if (! isset($used[$cand])) {
        $ctx['free_country_code'] = $cand;
        break;
    }
}

// A seeded chapter tells us a school/curriculum/subject/grade combination that
// is guaranteed to be internally consistent.
$chapIdx = qa('GET', '/control/chapters', $S);
$seedChapter = qa_dg($chapIdx['json'], 'data.0', []);
$ctx['school_id'] = $seedChapter['school_id'] ?? null;
$ctx['curriculum_id'] = $seedChapter['curriculum_id'] ?? qa_dg($seedChapter, 'curriculum.id');
$ctx['subject_id'] = $seedChapter['subject_id'] ?? qa_dg($seedChapter, 'subject.id');
$ctx['grade_id'] = $seedChapter['grade_id'] ?? qa_dg($seedChapter, 'grade.id');
$ctx['chapter_id'] = $seedChapter['id'] ?? null;

if (! $ctx['school_id']) {
    $gradesIdx = qa('GET', '/control/grades', $S);
    $ctx['school_id'] = qa_dg($gradesIdx['json'], 'meta.tenants.0.id');
}
if (! $ctx['curriculum_id']) {
    $curIdx = qa('GET', '/control/curricula', $S);
    $ctx['curriculum_id'] = qa_dg($curIdx['json'], 'data.0.id');
}
if (! $ctx['subject_id'] || ! $ctx['grade_id']) {
    $meta = qa('GET', '/control/chapters?school_id='.$ctx['school_id'].'&curriculum_id='.$ctx['curriculum_id'], $S);
    $ctx['subject_id'] = $ctx['subject_id'] ?: qa_dg($meta['json'], 'meta.subjects.0.id');
    $ctx['grade_id'] = $ctx['grade_id'] ?: qa_dg($meta['json'], 'meta.grades.0.id');
}

$rbacTenants = qa('GET', '/control/rbac/tenants', $S);
$ctx['alnoor_tenant_id'] = null;
foreach ((array) qa_dg($rbacTenants['json'], 'data', []) as $t) {
    if (($t['slug'] ?? '') === 'al-noor') {
        $ctx['alnoor_tenant_id'] = (int) $t['id'];
    }
}
$ctx['plan_code'] = qa_dg(qa('GET', '/control/billing/plans', $S)['json'], 'data.0.code');

$rolesIdx = qa('GET', '/control/rbac/roles', $S);
$ctx['auditor_role'] = null;
foreach ((array) qa_dg($rolesIdx['json'], 'data', []) as $r) {
    if (($r['code'] ?? '') === 'auditor') {
        $ctx['auditor_role'] = $r;
    }
}
$allPerms = array_map(fn ($p) => $p['code'], (array) qa_dg(qa('GET', '/control/rbac/permissions', $S)['json'], 'data', []));

$ayIdx = qa('GET', '/control/school-ops/academic-years', $O);
$ctx['academic_year_id'] = qa_dg($ayIdx['json'], 'data.0.id');
$ctx['current_ay_id'] = null;
foreach ((array) qa_dg($ayIdx['json'], 'data', []) as $y) {
    if (! empty($y['is_current'])) {
        $ctx['current_ay_id'] = (int) $y['id'];
    }
}
$ctx['ops_grade_id'] = qa_dg(qa('GET', '/control/school-ops/grades', $O)['json'], 'data.0.id');
$ctx['ops_class_id'] = qa_dg(qa('GET', '/control/school-ops/classes', $O)['json'], 'data.0.id');
$ctx['ops_section_id'] = qa_dg(qa('GET', '/control/school-ops/sections', $O)['json'], 'data.0.id');
$ctx['ops_subject_id'] = qa_dg(qa('GET', '/control/school-ops/subjects', $O)['json'], 'data.0.id');
$stu = qa('GET', '/control/school-ops/students', $O);
$ctx['student_user_id'] = qa_dg($stu['json'], 'data.0.user_id') ?? qa_dg($stu['json'], 'data.0.id');
$tea = qa('GET', '/control/school-ops/teachers', $O);
$ctx['teacher_user_id'] = qa_dg($tea['json'], 'data.0.user_id') ?? qa_dg($tea['json'], 'data.0.id');
$stf = qa('GET', '/control/school-workspace/staff', $O);
$ctx['staff_user_id'] = qa_dg($stf['json'], 'data.0.user_id') ?? qa_dg($stf['json'], 'data.0.id');

foreach ($ctx as $k => $v) {
    printf("%-22s %s\n", $k, is_array($v) ? '[role '.($v['code'] ?? '?').' id='.($v['id'] ?? '?').']' : var_export($v, true));
}

// ---------------------------------------------------------------- runner
/**
 * create -> read -> update -> status -> delete for one resource.
 *
 * spec keys:
 *   token, create => [method, path, payload]
 *   id_path       => string|list<string>, default 'data.id'
 *   read          => ['show'|'index', pathTemplate]     ({id} substituted)
 *   update|status => [method, pathTemplate, payload, verifyField|null, expected]
 *   delete        => [method, pathTemplate] | null
 */
function lifecycle(string $name, array $spec): array
{
    global $ADOPT, $MARK;
    $token = $spec['token'];
    $out = ['id' => null, 'created' => false, 'deleted' => false, 'record' => null];
    if (! qa_selected($name)) {
        return $out;
    }

    $idPaths = (array) ($spec['id_path'] ?? 'data.id');
    $id = null;

    if ($ADOPT && ! empty($spec['read']) && $spec['read'][0] === 'index') {
        // Reuse a record created by an earlier run instead of creating a new one.
        $r = qa('GET', $spec['read'][1], $token);
        foreach ((array) qa_dg($r['json'], 'data', []) as $row) {
            if (str_contains(strtoupper(json_encode($row)), strtoupper($MARK))) {
                $id = $row['id'] ?? ($row['user_id'] ?? null);
                $out['record'] = $row;
            }
        }
        record($name, 'create', 'POST', $spec['create'][1], ['status' => 0], $id !== null, $id !== null ? 'adopted existing record id '.$id : 'no adoptable record found for marker '.$MARK);
        if ($id === null) {
            return $out;
        }
        $out['id'] = $id;
        $out['created'] = true;
    } else {
        [$m, $p, $payload] = $spec['create'];
        $res = qa($m, $p, $token, $payload);
        $okCreate = in_array($res['status'], [200, 201], true);
        record($name, 'create', $m, $p, $res, $okCreate, $okCreate ? '' : qa_msg($res));
        if (! $okCreate) {
            $sev = $res['status'] >= 500 ? 'HIGH' : ($res['status'] === 422 ? 'CHECK' : 'MED');
            finding($sev, $name, $m, $p, $payload, $res, 'CREATE returned '.$res['status'].' for a payload built from the controller validation rules');

            return $out;
        }
        if ($leak = leaks_internals($res)) {
            finding('MED', $name, $m, $p, $payload, $res, "Response leaks internal detail ({$leak})");
        }
        foreach ($idPaths as $ip) {
            $id = $id ?? qa_dg($res['json'], $ip);
        }
        $out['id'] = $id;
        $out['created'] = true;
        $out['record'] = qa_dg($res['json'], 'data');
        if ($id === null) {
            finding('MED', $name, $m, $p, $payload, $res, 'CREATE succeeded but the response exposes no identifier at '.implode('/', $idPaths));

            return $out;
        }
    }

    $sub = fn (string $t) => str_replace('{id}', (string) $id, $t);

    $reread = function (?string $field) use ($spec, $token, $sub, $id) {
        if (empty($spec['read']) || $field === null) {
            return null;
        }
        [$mode, $rp] = $spec['read'];
        $r = qa('GET', $sub($rp), $token);
        if ($mode === 'show') {
            return qa_dg($r['json'], 'data.'.$field);
        }
        foreach ((array) qa_dg($r['json'], 'data', []) as $row) {
            if (isset($row['id']) && (string) $row['id'] === (string) $id) {
                return $row[$field] ?? null;
            }
        }

        return null;
    };
    $norm = fn ($v) => is_bool($v) ? ($v ? '1' : '0') : (string) $v;

    // 2. READ BACK
    if (! empty($spec['read'])) {
        [$mode, $rp] = $spec['read'];
        $rpath = $sub($rp);
        $r = qa('GET', $rpath, $token);
        $okRead = false;
        if ($mode === 'show') {
            $okRead = $r['status'] === 200 && qa_dg($r['json'], 'data') !== null;
        } else {
            foreach ((array) qa_dg($r['json'], 'data', []) as $row) {
                if (isset($row['id']) && (string) $row['id'] === (string) $id) {
                    $okRead = true;
                }
            }
        }
        record($name, 'read', 'GET', $rpath, $r, $okRead, $okRead ? '' : 'record not visible after create ('.qa_msg($r).')');
        if (! $okRead) {
            finding('HIGH', $name, 'GET', $rpath, null, $r, 'Record created (id '.$id.') is not returned by the read endpoint');
        }
    }

    // 3. UPDATE  4. STATUS
    foreach (['update', 'status'] as $phase) {
        if (empty($spec[$phase])) {
            continue;
        }
        [$um, $up, $upayload, $vfield, $vexp] = $spec[$phase];
        $upath = $sub($up);
        $u = qa($um, $upath, $token, $upayload);
        $ok = in_array($u['status'], [200, 201, 204], true);
        $note = $ok ? '' : qa_msg($u);
        if ($ok && $vfield !== null) {
            $persisted = $reread($vfield);
            if ($persisted === null && empty($spec['read'])) {
                $persisted = qa_dg($u['json'], 'data.'.$vfield);
            }
            if ($norm($persisted) !== $norm($vexp)) {
                $ok = false;
                $note = strtoupper($phase)." did not persist: {$vfield}=".var_export($persisted, true).' expected '.var_export($vexp, true);
                finding('HIGH', $name, $um, $upath, $upayload, $u, strtoupper($phase).' returned '.$u['status'].' but '.$note);
            }
        }
        record($name, $phase, $um, $upath, $u, $ok, $note);
        if (! $ok && $u['status'] >= 500) {
            finding('HIGH', $name, $um, $upath, $upayload, $u, strtoupper($phase).' returned '.$u['status']);
        } elseif (! $ok && ! in_array($u['status'], [200, 201, 204], true)) {
            finding('MED', $name, $um, $upath, $upayload, $u, strtoupper($phase).' returned unexpected '.$u['status']);
        }
        if ($leak = leaks_internals($u)) {
            finding('MED', $name, $um, $upath, $upayload, $u, "Response leaks internal detail ({$leak})");
        }
    }

    // 5. DELETE
    if (! empty($spec['delete'])) {
        [$dm, $dp] = $spec['delete'];
        $dpath = $sub($dp);
        $d = qa($dm, $dpath, $token);
        $okDelete = in_array($d['status'], [200, 202, 204], true);
        $note = $okDelete ? '' : qa_msg($d);
        if ($okDelete && ! empty($spec['read'])) {
            [$mode, $rp] = $spec['read'];
            $r4 = qa('GET', $sub($rp), $token);
            $still = false;
            if ($mode === 'show') {
                $still = $r4['status'] === 200 && qa_dg($r4['json'], 'data.id') !== null;
            } else {
                foreach ((array) qa_dg($r4['json'], 'data', []) as $row) {
                    if (isset($row['id']) && (string) $row['id'] === (string) $id) {
                        $still = true;
                    }
                }
            }
            if ($still) {
                $okDelete = false;
                $note = 'DELETE returned success but the record is still returned by the read endpoint';
                finding('HIGH', $name, $dm, $dpath, null, $d, $note);
            }
        }
        $out['deleted'] = $okDelete;
        record($name, 'delete', $dm, $dpath, $d, $okDelete, $note);
        if (! $okDelete) {
            leftover($name, $id, 'DELETE returned '.$d['status'].': '.qa_msg($d, 160));
            if ($d['status'] >= 500) {
                finding('HIGH', $name, $dm, $dpath, null, $d, 'DELETE returned '.$d['status']);
            } elseif (! in_array($d['status'], [409, 422], true)) {
                finding('MED', $name, $dm, $dpath, null, $d, 'DELETE returned unexpected '.$d['status']);
            }
        }
        if ($leak = leaks_internals($d)) {
            finding('MED', $name, $dm, $dpath, null, $d, "Response leaks internal detail ({$leak})");
        }
    } elseif (! array_key_exists('delete', $spec)) {
        leftover($name, $id, 'no DELETE endpoint is registered for this resource');
        record($name, 'delete', '-', '-', ['status' => 0], false, 'no DELETE route registered');
    }

    return $out;
}

/** One-off write probe that is not part of a lifecycle. */
function probe(string $name, string $step, string $m, string $p, ?string $token, $body = null, array $okStatuses = [200, 201, 204]): array
{
    if (! qa_selected($name)) {
        return ['status' => 0, 'body' => '', 'json' => null];
    }
    $r = qa($m, $p, $token, $body);
    $ok = in_array($r['status'], $okStatuses, true);
    record($name, $step, $m, $p, $r, $ok, $ok ? '' : qa_msg($r));
    if (! $ok) {
        finding($r['status'] >= 500 ? 'HIGH' : 'MED', $name, $m, $p, $body, $r, $step.' returned '.$r['status']);
    }
    if ($leak = leaks_internals($r)) {
        finding('MED', $name, $m, $p, $body, $r, "Response leaks internal detail ({$leak})");
    }

    return $r;
}

echo "\n=== LIFECYCLES (marker {$MARK}) ===\n";
$created = [];

// ---------------------------------------------------------------- PLATFORM
$created['countries'] = lifecycle('countries', [
    'token' => $S,
    'create' => ['POST', '/control/countries', [
        'code' => $ctx['free_country_code'] ?? 'XA',
        'name_en' => "QA Country {$MARK}",
        'name_ar' => "QA {$MARK}",
        'default_locale' => 'en',
        'default_timezone' => 'Asia/Riyadh',
        'is_active' => true,
    ]],
    'read' => ['show', '/control/countries/{id}'],
    'update' => ['PUT', '/control/countries/{id}', ['name_en' => "QA Country {$MARK} Updated"], 'name_en', "QA Country {$MARK} Updated"],
    'status' => ['PUT', '/control/countries/{id}', ['is_active' => false], 'is_active', false],
    'delete' => ['DELETE', '/control/countries/{id}'],
]);

// Curricula: publish makes a record permanently read-only, so the delete step
// is reached by first superseding it with a new version.
$created['curricula'] = lifecycle('curricula', [
    'token' => $S,
    'create' => ['POST', '/control/curricula', [
        'country_id' => $ctx['country_id'],
        'code' => "ZZQA-CUR-{$MARK}",
        'name_en' => "QA Curriculum {$MARK}",
        'version' => '1.0',
    ]],
    'read' => ['show', '/control/curricula/{id}'],
    'update' => ['PUT', '/control/curricula/{id}', ['name_en' => "QA Curriculum {$MARK} Updated"], 'name_en', "QA Curriculum {$MARK} Updated"],
    'status' => ['POST', '/control/curricula/{id}/publish', ['summary_en' => 'QA publish'], 'status', 'published'],
    'delete' => null,
]);
$curId = $created['curricula']['id'] ?? null;
if ($curId && qa_selected('curricula')) {
    // A published curriculum can only be removed after a new version supersedes it.
    $nv = probe('curricula', 'new-version', 'POST', "/control/curricula/{$curId}/versions", $S, ['version' => '2.0', 'summary_en' => 'QA v2'], [200, 201]);
    $cloneId = qa_dg($nv['json'], 'data.id');

    // Regression check: for platform curricula (school_id NULL) the version guard
    // uses where('school_id', null), which never matches.
    $dupe = qa('POST', "/control/curricula/{$curId}/versions", $S, ['version' => '2.0', 'summary_en' => 'QA dup']);
    $dupeId = qa_dg($dupe['json'], 'data.id');
    record('curricula', 'dup-version', 'POST', "/control/curricula/{$curId}/versions", $dupe, $dupe['status'] === 422, $dupe['status'] === 422 ? '' : 'duplicate version accepted with HTTP '.$dupe['status']);
    if (in_array($dupe['status'], [200, 201], true)) {
        finding('HIGH', 'curricula', 'POST', "/control/curricula/{$curId}/versions", ['version' => '2.0'], $dupe, 'Creating a second version with an already-used version string is accepted instead of rejected with 422');
    }

    $family = qa('GET', "/control/curricula/{$curId}", $S);
    $latestFlags = [];
    foreach ((array) qa_dg($family['json'], 'data.version_family', []) as $row) {
        if (! empty($row['is_latest'])) {
            $latestFlags[] = $row['version'];
        }
    }
    record('curricula', 'is-latest', 'GET', "/control/curricula/{$curId}", $family, count($latestFlags) <= 1, count($latestFlags) <= 1 ? '' : 'multiple versions flagged is_latest: '.implode(',', $latestFlags));
    if (count($latestFlags) > 1) {
        finding('MED', 'curricula', 'POST', "/control/curricula/{$curId}/versions", ['version' => '2.0'], $family, 'After creating a new version, '.count($latestFlags).' versions ('.implode(',', $latestFlags).') are still flagged is_latest');
    }

    foreach (array_filter([$dupeId, $cloneId, $curId]) as $cid) {
        $d = qa('DELETE', "/control/curricula/{$cid}", $S);
        $ok = in_array($d['status'], [200, 204], true);
        record('curricula', 'delete', 'DELETE', "/control/curricula/{$cid}", $d, $ok, $ok ? '' : qa_msg($d));
        if (! $ok) {
            leftover('curricula', $cid, 'DELETE returned '.$d['status'].': '.qa_msg($d, 160));
        }
    }
}

$created['grades'] = lifecycle('grades', [
    'token' => $S,
    'create' => ['POST', '/control/grades', [
        'school_id' => $ctx['school_id'], 'code' => "ZZQAG{$MARK}",
        'name_en' => "QA Grade {$MARK}", 'sequence' => 99,
    ]],
    'read' => ['show', '/control/grades/{id}'],
    'update' => ['PUT', '/control/grades/{id}', ['name_en' => "QA Grade {$MARK} Updated"], 'name_en', "QA Grade {$MARK} Updated"],
    'delete' => ['DELETE', '/control/grades/{id}'],
]);

$created['subjects'] = lifecycle('subjects', [
    'token' => $S,
    'create' => ['POST', '/control/subjects', [
        'school_id' => $ctx['school_id'], 'curriculum_id' => $ctx['curriculum_id'],
        'code' => "ZZQA-SUB-{$MARK}", 'name_en' => "QA Subject {$MARK}", 'status' => 'active',
    ]],
    'read' => ['show', '/control/subjects/{id}'],
    'update' => ['PUT', '/control/subjects/{id}', ['name_en' => "QA Subject {$MARK} Updated"], 'name_en', "QA Subject {$MARK} Updated"],
    'status' => ['PUT', '/control/subjects/{id}', ['status' => 'archived'], 'status', 'archived'],
    'delete' => ['DELETE', '/control/subjects/{id}'],
]);

$created['chapters'] = lifecycle('chapters', [
    'token' => $S,
    'create' => ['POST', '/control/chapters', [
        'school_id' => $ctx['school_id'], 'curriculum_id' => $ctx['curriculum_id'],
        'subject_id' => $ctx['subject_id'], 'grade_id' => $ctx['grade_id'],
        'title_en' => "QA Chapter {$MARK}", 'sequence' => 99, 'status' => 'draft',
    ]],
    'read' => ['show', '/control/chapters/{id}'],
    'update' => ['PUT', '/control/chapters/{id}', ['title_en' => "QA Chapter {$MARK} Updated"], 'title_en', "QA Chapter {$MARK} Updated"],
    'status' => ['PUT', '/control/chapters/{id}', ['status' => 'published'], 'status', 'published'],
    'delete' => ['DELETE', '/control/chapters/{id}'],
]);

$created['lessons'] = lifecycle('lessons', [
    'token' => $S,
    'create' => ['POST', '/control/lessons', [
        'school_id' => $ctx['school_id'], 'curriculum_id' => $ctx['curriculum_id'],
        'chapter_id' => $ctx['chapter_id'], 'title_en' => "QA Lesson {$MARK}",
        'sequence' => 99, 'difficulty' => 'easy', 'status' => 'draft',
    ]],
    'read' => ['show', '/control/lessons/{id}'],
    'update' => ['PUT', '/control/lessons/{id}', ['title_en' => "QA Lesson {$MARK} Updated"], 'title_en', "QA Lesson {$MARK} Updated"],
    'status' => ['PUT', '/control/lessons/{id}', ['status' => 'published'], 'status', 'published'],
    'delete' => ['DELETE', '/control/lessons/{id}'],
]);

$created['learning-outcomes'] = lifecycle('learning-outcomes', [
    'token' => $S,
    'create' => ['POST', '/control/learning-outcomes', [
        'school_id' => $ctx['school_id'], 'curriculum_id' => $ctx['curriculum_id'],
        'subject_id' => $ctx['subject_id'], 'code' => "ZZQA-LO-{$MARK}",
        'statement_en' => "QA outcome {$MARK}", 'status' => 'active',
    ]],
    'read' => ['show', '/control/learning-outcomes/{id}'],
    'update' => ['PUT', '/control/learning-outcomes/{id}', ['statement_en' => "QA outcome {$MARK} Updated"], 'statement_en', "QA outcome {$MARK} Updated"],
    'status' => ['PUT', '/control/learning-outcomes/{id}', ['status' => 'archived'], 'status', 'archived'],
    'delete' => ['DELETE', '/control/learning-outcomes/{id}'],
]);

$created['tenant-groups'] = lifecycle('tenant-groups', [
    'token' => $S,
    'create' => ['POST', '/control/tenant-groups', [
        'name' => "QA Group {$MARK}", 'slug' => 'zzqa-group-'.strtolower($MARK),
        'description' => 'QA harness', 'status' => 'active',
    ]],
    'read' => ['show', '/control/tenant-groups/{id}'],
    'update' => ['PUT', '/control/tenant-groups/{id}', ['name' => "QA Group {$MARK} Updated"], 'name', "QA Group {$MARK} Updated"],
    'status' => ['PUT', '/control/tenant-groups/{id}', ['status' => 'inactive'], 'status', 'inactive'],
    'delete' => ['DELETE', '/control/tenant-groups/{id}'],
]);

$created['campuses'] = lifecycle('campuses', [
    'token' => $S,
    'create' => ['POST', '/control/campuses', [
        'school_id' => $ctx['school_id'], 'code' => "ZZQA-CMP-{$MARK}",
        'name_en' => "QA Campus {$MARK}", 'status' => 'active',
    ]],
    'read' => ['show', '/control/campuses/{id}'],
    'update' => ['PUT', '/control/campuses/{id}', ['name_en' => "QA Campus {$MARK} Updated"], 'name_en', "QA Campus {$MARK} Updated"],
    'status' => ['PUT', '/control/campuses/{id}', ['status' => 'inactive'], 'status', 'inactive'],
    'delete' => ['DELETE', '/control/campuses/{id}'],
]);

$created['billing/plans'] = lifecycle('billing/plans', [
    'token' => $S,
    'create' => ['POST', '/control/billing/plans', [
        'code' => "ZZQA-PLAN-{$MARK}", 'name_en' => "QA Plan {$MARK}",
        'price' => 19.99, 'currency' => 'SAR', 'max_schools' => 1, 'is_active' => true,
    ]],
    'read' => ['show', '/control/billing/plans/{id}'],
    'update' => ['PUT', '/control/billing/plans/{id}', ['name_en' => "QA Plan {$MARK} Updated"], 'name_en', "QA Plan {$MARK} Updated"],
    'status' => ['PUT', '/control/billing/plans/{id}', ['is_active' => false], 'is_active', false],
    'delete' => ['DELETE', '/control/billing/plans/{id}'],
]);

$created['billing/coupons'] = lifecycle('billing/coupons', [
    'token' => $S,
    'create' => ['POST', '/control/billing/coupons', [
        'code' => "ZZQA-CPN-{$MARK}", 'name_en' => "QA Coupon {$MARK}",
        'discount_type' => 'percent', 'discount_value' => 10, 'is_active' => true,
    ]],
    'read' => ['show', '/control/billing/coupons/{id}'],
    'update' => ['PUT', '/control/billing/coupons/{id}', ['name_en' => "QA Coupon {$MARK} Updated"], 'name_en', "QA Coupon {$MARK} Updated"],
    'status' => ['PUT', '/control/billing/coupons/{id}', ['is_active' => false], 'is_active', false],
    'delete' => ['DELETE', '/control/billing/coupons/{id}'],
]);

$created['billing/taxes'] = lifecycle('billing/taxes', [
    'token' => $S,
    'create' => ['POST', '/control/billing/taxes', [
        'code' => "ZZQA-TAX-{$MARK}", 'name_en' => "QA Tax {$MARK}",
        'rate_percent' => 5, 'country_code' => 'SA', 'is_active' => true,
    ]],
    'read' => ['show', '/control/billing/taxes/{id}'],
    'update' => ['PUT', '/control/billing/taxes/{id}', ['name_en' => "QA Tax {$MARK} Updated"], 'name_en', "QA Tax {$MARK} Updated"],
    'status' => ['PUT', '/control/billing/taxes/{id}', ['is_active' => false], 'is_active', false],
    'delete' => ['DELETE', '/control/billing/taxes/{id}'],
]);

$created['platform-users'] = lifecycle('platform-users', [
    'token' => $S,
    'create' => ['POST', '/control/platform-users', [
        'email' => "zzqa.user.{$MARK}@qa.local", 'password' => $PW,
        'first_name' => "QA{$MARK}", 'last_name' => 'Probe',
        'role_code' => 'customer_support', 'status' => 'active',
    ]],
    'read' => ['show', '/control/platform-users/{id}'],
    'update' => ['PUT', '/control/platform-users/{id}', ['first_name' => "QA{$MARK}Upd"], 'first_name', "QA{$MARK}Upd"],
    'status' => ['PUT', '/control/platform-users/{id}', ['status' => 'suspended'], 'status', 'suspended'],
    'delete' => ['DELETE', '/control/platform-users/{id}'],
]);

$created['tenants'] = lifecycle('tenants', [
    'token' => $S,
    'create' => ['POST', '/control/tenants', [
        'organization_name' => "QA Org {$MARK}", 'slug' => 'zzqa-org-'.strtolower($MARK),
        'legal_name' => "QA Org {$MARK} LLC", 'country_code' => 'SA', 'locale' => 'en',
        'plan_code' => $ctx['plan_code'], 'trial_days' => 14,
        'email' => "zzqa.owner.{$MARK}@qa.local", 'password' => $PW,
        'first_name' => 'QA', 'last_name' => 'Owner', 'school_name' => "QA School {$MARK}",
    ]],
    'read' => ['show', '/control/tenants/{id}'],
    'update' => ['PUT', '/control/tenants/{id}', ['name' => "QA Org {$MARK} Updated"], 'name', "QA Org {$MARK} Updated"],
    'status' => ['PATCH', '/control/tenants/{id}/status', ['status' => 'suspended'], 'status', 'suspended'],
    'delete' => null, // deleted at the end, after the dependent probes below
]);
$qaTenantId = $created['tenants']['id'] ?? null;

if ($qaTenantId) {
    probe('tenants/branding', 'update', 'PUT', "/control/tenants/{$qaTenantId}/branding", $S, [
        'primary_color' => '#123456', 'secondary_color' => '#654321', 'email_footer_en' => "QA {$MARK}",
    ]);
    probe('tenants/billing-contact', 'update', 'PUT', "/control/tenants/{$qaTenantId}/billing-contact", $S, [
        'first_name' => 'QA', 'last_name' => 'Billing', 'email' => "zzqa.billing.{$MARK}@qa.local",
    ]);
    probe('trials', 'start', 'POST', "/control/trials/{$qaTenantId}/start", $S, ['days' => 10]);
    probe('trials', 'extend', 'POST', "/control/trials/{$qaTenantId}/extend", $S, ['days' => 5]);
    probe('trials', 'convert', 'POST', "/control/trials/{$qaTenantId}/convert", $S, null);
    if ($ctx['plan_code']) {
        probe('subscription/change-plan', 'update', 'POST', '/control/subscription/change-plan', $S, [
            'plan_code' => $ctx['plan_code'], 'tenant_id' => $qaTenantId,
        ]);
    }

    $inv = probe('tenants/invoices', 'create', 'POST', "/control/tenants/{$qaTenantId}/invoices", $S, null, [200, 201]);
    $invId = qa_dg($inv['json'], 'data.id');
    $inv2 = probe('billing/invoices', 'create', 'POST', '/control/billing/invoices/generate', $S, ['tenant_id' => $qaTenantId], [200, 201]);
    $inv2Id = qa_dg($inv2['json'], 'data.id');
    $target = $inv2Id ?: $invId;
    if ($target) {
        probe('billing/invoices', 'status(send)', 'POST', "/control/billing/invoices/{$target}/send", $S, null);
        probe('billing/invoices', 'status(pay)', 'POST', "/control/billing/invoices/{$target}/pay", $S, ['amount' => 1, 'method' => 'qa']);
    }
    foreach (array_filter([$invId, $inv2Id]) as $lid) {
        leftover('billing/invoices', $lid, 'no DELETE endpoint (invoice belongs to the QA tenant '.$qaTenantId.', which is soft-deleted at the end of the run)');
    }

    // Only ever cancel the QA tenant's own subscription, never a seeded one.
    $subs = qa('GET', '/control/subscriptions', $S);
    $qaSubId = null;
    foreach ((array) qa_dg($subs['json'], 'data', []) as $row) {
        $tid = $row['tenant_id'] ?? qa_dg($row, 'tenant.id');
        if ((int) $tid === (int) $qaTenantId) {
            $qaSubId = $row['id'] ?? null;
        }
    }
    if ($qaSubId) {
        probe('subscriptions', 'status(cancel)', 'POST', "/control/subscriptions/{$qaSubId}/cancel", $S, null);
    } else {
        record('subscriptions', 'status(cancel)', 'POST', '/control/subscriptions/{id}/cancel', ['status' => 0], false, 'skipped: could not locate the QA tenant subscription');
    }
}

// ------------------------------------------------------------- integrations
$intCode = 'zzqa'.strtolower($MARK);
$originalDefault = qa_dg(qa('GET', '/control/integrations/payment', $S)['json'], 'meta.stats.default_code');

$created['integrations'] = lifecycle('integrations', [
    'token' => $S,
    'create' => ['POST', '/control/integrations/payment', [
        'code' => $intCode, 'name_en' => "QA Integration {$MARK}", 'provider' => 'zzqa',
        'config' => ['api_key' => 'qa-secret-value'], 'is_active' => true, 'status' => 'disconnected',
    ]],
    'id_path' => 'data.code',
    'read' => ['show', '/control/integrations/payment/{id}'],
    'update' => ['PUT', '/control/integrations/payment/{id}', ['name_en' => "QA Integration {$MARK} Updated"], 'name_en', "QA Integration {$MARK} Updated"],
    'status' => ['POST', '/control/integrations/payment/{id}/test', null, null, null],
    'delete' => null, // deleted below, after the set-default probe
]);
if (($created['integrations']['id'] ?? null) && qa_selected('integrations')) {
    probe('integrations', 'status(default)', 'POST', "/control/integrations/payment/{$intCode}/default", $S, null);
    if ($originalDefault && $originalDefault !== $intCode) {
        $rd = qa('POST', "/control/integrations/payment/{$originalDefault}/default", $S);
        record('integrations', 'restore-default', 'POST', "/control/integrations/payment/{$originalDefault}/default", $rd, $rd['status'] === 200, $rd['status'] === 200 ? '' : qa_msg($rd));
        if ($rd['status'] !== 200) {
            leftover('integrations payment default', $originalDefault, 'could not restore the original default provider');
        }
    }
    $dd = qa('DELETE', "/control/integrations/payment/{$intCode}", $S);
    $ok = in_array($dd['status'], [200, 204], true);
    record('integrations', 'delete', 'DELETE', "/control/integrations/payment/{$intCode}", $dd, $ok, $ok ? '' : qa_msg($dd));
    if (! $ok) {
        leftover('integrations/payment', $intCode, 'DELETE returned '.$dd['status']);
    }
}

// ------------------------------------------------------------------ settings
if (qa_selected('settings')) {
    $origName = qa_dg(qa('GET', '/control/settings/global', $S)['json'], 'data.settings.platform_name');
    $su = qa('PUT', '/control/settings/global', $S, ['settings' => ['platform_name' => "QA Platform {$MARK}"]]);
    $okSu = $su['status'] === 200 && qa_dg($su['json'], 'data.settings.platform_name') === "QA Platform {$MARK}";
    record('settings/global', 'update', 'PUT', '/control/settings/global', $su, $okSu, $okSu ? '' : qa_msg($su));
    if (! $okSu) {
        finding($su['status'] >= 500 ? 'HIGH' : 'MED', 'settings/global', 'PUT', '/control/settings/global', ['settings' => ['platform_name' => '...']], $su, 'settings update returned '.$su['status'].' or did not persist');
    }
    $sr = qa('PUT', '/control/settings/global', $S, ['settings' => ['platform_name' => $origName]]);
    record('settings/global', 'restore', 'PUT', '/control/settings/global', $sr, $sr['status'] === 200, $sr['status'] === 200 ? '' : qa_msg($sr));
    if ($sr['status'] !== 200) {
        leftover('settings/global.platform_name', $origName, 'could not restore the original value');
    }
    probe('settings/backup', 'run', 'POST', '/control/settings/backup/run', $S, null);
    $bad = qa('PUT', '/control/settings/not-a-group', $S, ['settings' => ['x' => 1]]);
    record('settings/{group}', 'invalid-group', 'PUT', '/control/settings/not-a-group', $bad, in_array($bad['status'], [404, 422], true), 'expected 422/404');
    if ($bad['status'] >= 500) {
        finding('MED', 'settings/{group}', 'PUT', '/control/settings/not-a-group', ['settings' => ['x' => 1]], $bad, 'invalid settings group returns '.$bad['status'].' instead of 422');
    }
}

// ---------------------------------------------------------------- RBAC
if (qa_selected('rbac') && $ctx['auditor_role']) {
    $roleId = $ctx['auditor_role']['id'];
    $origPerms = $ctx['auditor_role']['permission_codes'] ?? [];
    if (in_array('*', $origPerms, true)) {
        record('rbac/role-permissions', 'update', 'PUT', "/control/rbac/roles/{$roleId}/permissions", ['status' => 0], false, 'skipped: config-wildcard role, mutating it is unsafe');
    } else {
        $extra = null;
        foreach ($allPerms as $pc) {
            if (! in_array($pc, $origPerms, true)) {
                $extra = $pc;
                break;
            }
        }
        $newSet = $extra ? array_merge($origPerms, [$extra]) : $origPerms;
        $ru = qa('PUT', "/control/rbac/roles/{$roleId}/permissions", $S, ['permission_codes' => $newSet]);
        $got = qa_dg($ru['json'], 'data.permission_codes', []);
        $okRu = $ru['status'] === 200 && count($got) === count($newSet);
        record('rbac/role-permissions', 'update', 'PUT', "/control/rbac/roles/{$roleId}/permissions", $ru, $okRu, $okRu ? '' : qa_msg($ru));
        if (! $okRu) {
            finding($ru['status'] >= 500 ? 'HIGH' : 'MED', 'rbac/role-permissions', 'PUT', "/control/rbac/roles/{$roleId}/permissions", ['permission_codes' => '<'.count($newSet).' codes>'], $ru, 'role permission sync returned '.$ru['status'].' or did not persist');
        }
        $rr = qa('PUT', "/control/rbac/roles/{$roleId}/permissions", $S, ['permission_codes' => $origPerms]);
        $restored = qa_dg($rr['json'], 'data.permission_codes', []);
        sort($restored);
        $origSorted = $origPerms;
        sort($origSorted);
        $okRr = $rr['status'] === 200 && $restored === $origSorted;
        record('rbac/role-permissions', 'restore', 'PUT', "/control/rbac/roles/{$roleId}/permissions", $rr, $okRr, $okRr ? '' : qa_msg($rr));
        if (! $okRr) {
            leftover('rbac role auditor (id '.$roleId.')', implode(',', $origPerms), 'could not restore the original permission set');
        }
    }

    $rbad = qa('PUT', "/control/rbac/roles/{$roleId}/permissions", $S, ['permission_codes' => ['zzqa.not.a.permission']]);
    record('rbac/role-permissions', 'invalid-perm', 'PUT', "/control/rbac/roles/{$roleId}/permissions", $rbad, $rbad['status'] === 422, 'expected 422');
    if ($rbad['status'] !== 422) {
        finding($rbad['status'] >= 500 ? 'HIGH' : 'MED', 'rbac/role-permissions', 'PUT', "/control/rbac/roles/{$roleId}/permissions", ['permission_codes' => ['zzqa.not.a.permission']], $rbad, 'unknown permission code returns '.$rbad['status'].' instead of 422');
    }
}

if (qa_selected('rbac')) {
    $au = qa('POST', '/control/platform-users', $S, [
        'email' => "zzqa.assign.{$MARK}@qa.local", 'password' => $PW,
        'first_name' => "QA{$MARK}A", 'last_name' => 'Assign', 'role_code' => 'auditor',
    ]);
    $assignUserId = qa_dg($au['json'], 'data.id');
    record('rbac/assignments', 'setup(user)', 'POST', '/control/platform-users', $au, $assignUserId !== null, $assignUserId !== null ? '' : qa_msg($au));
    if ($assignUserId) {
        if ($ctx['alnoor_tenant_id']) {
            $as = qa('POST', '/control/rbac/assignments', $S, [
                'user_id' => $assignUserId, 'role_code' => 'auditor', 'tenant_id' => $ctx['alnoor_tenant_id'],
            ]);
            $assignId = qa_dg($as['json'], 'data.id');
            $okAs = in_array($as['status'], [200, 201], true) && $assignId !== null;
            record('rbac/assignments', 'create', 'POST', '/control/rbac/assignments', $as, $okAs, $okAs ? '' : qa_msg($as));
            if (! $okAs) {
                finding($as['status'] >= 500 ? 'HIGH' : 'MED', 'rbac/assignments', 'POST', '/control/rbac/assignments', ['user_id' => $assignUserId, 'role_code' => 'auditor', 'tenant_id' => $ctx['alnoor_tenant_id']], $as, 'assign returned '.$as['status']);
            }
            if ($assignId) {
                $rv = qa('DELETE', "/control/rbac/assignments/{$assignId}", $S);
                $okRv = in_array($rv['status'], [200, 204], true);
                record('rbac/assignments', 'delete', 'DELETE', "/control/rbac/assignments/{$assignId}", $rv, $okRv, $okRv ? '' : qa_msg($rv));
                if (! $okRv) {
                    leftover('rbac assignment', $assignId, 'revoke returned '.$rv['status']);
                    finding($rv['status'] >= 500 ? 'HIGH' : 'MED', 'rbac/assignments', 'DELETE', "/control/rbac/assignments/{$assignId}", null, $rv, 'revoke returned '.$rv['status']);
                }
            }
        }
        $du = qa('DELETE', "/control/platform-users/{$assignUserId}", $S);
        $okDu = in_array($du['status'], [200, 204], true);
        record('rbac/assignments', 'cleanup(user)', 'DELETE', "/control/platform-users/{$assignUserId}", $du, $okDu, $okDu ? '' : qa_msg($du));
        if (! $okDu) {
            leftover('platform-user', $assignUserId, 'delete returned '.$du['status']);
        }
    }
}

// ---------------------------------------------------------------- SCHOOL OPS
$created['ops/campuses'] = lifecycle('school-ops/campuses', [
    'token' => $O,
    'create' => ['POST', '/control/school-ops/campuses', [
        'code' => "ZZQA-OC-{$MARK}", 'name_en' => "QA Ops Campus {$MARK}",
        'name_ar' => "QA {$MARK}", 'status' => 'active',
    ]],
    'read' => ['index', '/control/school-ops/campuses'],
    'update' => ['PUT', '/control/school-ops/campuses/{id}', ['name_en' => "QA Ops Campus {$MARK} Upd"], 'name_en', "QA Ops Campus {$MARK} Upd"],
    'status' => ['PUT', '/control/school-ops/campuses/{id}', ['status' => 'inactive'], 'status', 'inactive'],
    'delete' => ['DELETE', '/control/school-ops/campuses/{id}'],
]);

$created['ops/academic-years'] = lifecycle('school-ops/academic-years', [
    'token' => $O,
    'create' => ['POST', '/control/school-ops/academic-years', [
        'name' => "QA AY {$MARK}", 'starts_on' => '2031-08-01',
        'ends_on' => '2032-06-30', 'status' => 'planned',
    ]],
    'read' => ['index', '/control/school-ops/academic-years'],
    'status' => ['POST', '/control/school-ops/academic-years/{id}/current', null, 'is_current', true],
]);
if (qa_selected('school-ops/academic-years') && $ctx['current_ay_id']) {
    $rc = qa('POST', "/control/school-ops/academic-years/{$ctx['current_ay_id']}/current", $O);
    record('school-ops/academic-years', 'restore-current', 'POST', "/control/school-ops/academic-years/{$ctx['current_ay_id']}/current", $rc, $rc['status'] === 200, $rc['status'] === 200 ? '' : qa_msg($rc));
    if ($rc['status'] !== 200) {
        leftover('school-ops current academic year', $ctx['current_ay_id'], 'could not restore the original current year');
    }
}

$created['ops/terms'] = lifecycle('school-ops/terms', [
    'token' => $O,
    'create' => ['POST', '/control/school-ops/terms', [
        'academic_year_id' => ($created['ops/academic-years']['id'] ?? null) ?: $ctx['academic_year_id'],
        'name_en' => "QA Term {$MARK}", 'name_ar' => "QA {$MARK}", 'sequence' => 9,
        'starts_on' => '2031-09-01', 'ends_on' => '2031-12-15', 'status' => 'upcoming',
    ]],
    'read' => ['index', '/control/school-ops/terms'],
    'update' => ['PUT', '/control/school-ops/terms/{id}', ['name_en' => "QA Term {$MARK} Upd"], 'name_en', "QA Term {$MARK} Upd"],
    'status' => ['PUT', '/control/school-ops/terms/{id}', ['status' => 'active'], 'status', 'active'],
]);

$created['ops/subjects'] = lifecycle('school-ops/subjects', [
    'token' => $O,
    'create' => ['POST', '/control/school-ops/subjects', [
        'code' => "ZZQA-OS-{$MARK}", 'name_en' => "QA Ops Subject {$MARK}",
        'name_ar' => "QA {$MARK}", 'status' => 'active',
    ]],
    'read' => ['index', '/control/school-ops/subjects'],
    'update' => ['PUT', '/control/school-ops/subjects/{id}', ['name_en' => "QA Ops Subject {$MARK} Upd"], 'name_en', "QA Ops Subject {$MARK} Upd"],
    'status' => ['PUT', '/control/school-ops/subjects/{id}', ['status' => 'archived'], 'status', 'archived'],
    'delete' => ['DELETE', '/control/school-ops/subjects/{id}'],
]);

$created['ops/grades'] = lifecycle('school-ops/grades', [
    'token' => $O,
    'create' => ['POST', '/control/school-ops/grades', [
        'code' => "ZZQAOG{$MARK}", 'name_en' => "QA Ops Grade {$MARK}",
        'name_ar' => "QA {$MARK}", 'sequence' => 98,
    ]],
    'read' => ['index', '/control/school-ops/grades'],
    'update' => ['PUT', '/control/school-ops/grades/{id}', ['name_en' => "QA Ops Grade {$MARK} Upd"], 'name_en', "QA Ops Grade {$MARK} Upd"],
    'delete' => ['DELETE', '/control/school-ops/grades/{id}'],
]);

$created['ops/classes'] = lifecycle('school-ops/classes', [
    'token' => $O,
    'create' => ['POST', '/control/school-ops/classes', [
        'academic_year_id' => $ctx['academic_year_id'], 'grade_id' => $ctx['ops_grade_id'],
        'code' => "ZZQAC{$MARK}", 'name_en' => "QA Class {$MARK}",
        'name_ar' => "QA {$MARK}", 'status' => 'active',
    ]],
    'read' => ['index', '/control/school-ops/classes'],
    'update' => ['PUT', '/control/school-ops/classes/{id}', ['name_en' => "QA Class {$MARK} Upd"], 'name_en', "QA Class {$MARK} Upd"],
    'status' => ['PUT', '/control/school-ops/classes/{id}', ['status' => 'inactive'], 'status', 'inactive'],
    'delete' => ['DELETE', '/control/school-ops/classes/{id}'],
]);

$created['ops/sections'] = lifecycle('school-ops/sections', [
    'token' => $O,
    'create' => ['POST', '/control/school-ops/sections', [
        'academic_year_id' => $ctx['academic_year_id'], 'grade_id' => $ctx['ops_grade_id'],
        'school_class_id' => $ctx['ops_class_id'], 'name' => "QA Section {$MARK}",
        'section_code' => 'Z'.substr($MARK, -3), 'status' => 'active',
    ]],
    'read' => ['index', '/control/school-ops/sections'],
    'update' => ['PUT', '/control/school-ops/sections/{id}', ['name' => "QA Section {$MARK} Upd"], 'name', "QA Section {$MARK} Upd"],
    'status' => ['PUT', '/control/school-ops/sections/{id}', ['status' => 'inactive'], 'status', 'inactive'],
    'delete' => ['DELETE', '/control/school-ops/sections/{id}'],
]);

$created['ops/teachers'] = lifecycle('school-ops/teachers', [
    'token' => $O,
    'create' => ['POST', '/control/school-ops/teachers', [
        'email' => "zzqa.teacher.{$MARK}@qa.local", 'password' => $PW,
        'first_name' => "QA{$MARK}", 'last_name' => 'Teacher',
    ]],
    'id_path' => ['data.id', 'data.user_id'],
    'read' => ['index', '/control/school-ops/teachers'],
]);
$qaTeacherUserId = qa_dg($created['ops/teachers']['record'] ?? [], 'user_id') ?: ($created['ops/teachers']['id'] ?? null);

$created['ops/students'] = lifecycle('school-ops/students', [
    'token' => $O,
    'create' => ['POST', '/control/school-ops/students', [
        'email' => "zzqa.student.{$MARK}@qa.local", 'password' => $PW,
        'first_name' => "QA{$MARK}", 'last_name' => 'Student',
        'academic_year_id' => $ctx['academic_year_id'], 'class_section_id' => $ctx['ops_section_id'],
        'grade_id' => $ctx['ops_grade_id'], 'status' => 'active',
    ]],
    'id_path' => ['data.id', 'data.user_id'],
    'read' => ['index', '/control/school-ops/students'],
    'update' => ['PUT', '/control/school-ops/students/{id}', ['first_name' => "QA{$MARK}Upd"], null, null],
    'status' => ['PUT', '/control/school-ops/students/{id}', ['status' => 'inactive'], null, null],
]);
$qaStudentUserId = qa_dg($created['ops/students']['record'] ?? [], 'user_id') ?: ($created['ops/students']['id'] ?? null);

$created['ops/parents'] = lifecycle('school-ops/parents', [
    'token' => $O,
    'create' => ['POST', '/control/school-ops/parents', [
        'email' => "zzqa.parent.{$MARK}@qa.local", 'password' => $PW,
        'first_name' => "QA{$MARK}", 'last_name' => 'Parent',
        'student_user_id' => $qaStudentUserId ?: $ctx['student_user_id'],
        'relationship' => 'father', 'is_primary' => true,
    ]],
    'id_path' => ['data.id', 'data.user_id'],
    'read' => ['index', '/control/school-ops/parents'],
]);

$created['ops/transfers'] = lifecycle('school-ops/transfers', [
    'token' => $O,
    'create' => ['POST', '/control/school-ops/transfers', [
        'student_user_id' => $qaStudentUserId ?: $ctx['student_user_id'],
        'class_section_id' => $ctx['ops_section_id'], 'grade_id' => $ctx['ops_grade_id'],
        'academic_year_id' => $ctx['academic_year_id'],
    ]],
    'id_path' => ['data.id', 'data.enrollment_id'],
    'read' => ['index', '/control/school-ops/transfers'],
]);

$created['ops/tutors'] = lifecycle('school-ops/tutors', [
    'token' => $O,
    'create' => ['POST', '/control/school-ops/tutors', [
        'user_id' => $qaTeacherUserId ?: $ctx['teacher_user_id'],
        'bio_en' => "QA tutor {$MARK}", 'status' => 'active',
    ]],
    'read' => ['index', '/control/school-ops/tutors'],
    'update' => ['PUT', '/control/school-ops/tutors/{id}', ['bio_en' => "QA tutor {$MARK} Upd"], null, null],
    'status' => ['PUT', '/control/school-ops/tutors/{id}', ['status' => 'inactive'], 'status', 'inactive'],
]);

$created['ops/teaching-assignments'] = lifecycle('school-ops/teaching-assignments', [
    'token' => $O,
    'create' => ['POST', '/control/school-ops/teaching-assignments', [
        'teacher_user_id' => $qaTeacherUserId ?: $ctx['teacher_user_id'],
        'subject_id' => $ctx['ops_subject_id'], 'class_section_id' => $ctx['ops_section_id'],
        'academic_year_id' => $ctx['academic_year_id'], 'status' => 'active', 'notes' => "QA {$MARK}",
    ]],
    'read' => ['index', '/control/school-ops/teaching-assignments'],
    'update' => ['PUT', '/control/school-ops/teaching-assignments/{id}', ['notes' => "QA {$MARK} Upd"], null, null],
    'status' => ['PUT', '/control/school-ops/teaching-assignments/{id}', ['status' => 'inactive'], 'status', 'inactive'],
    'delete' => ['DELETE', '/control/school-ops/teaching-assignments/{id}'],
]);

if (qa_selected('school-ops/school')) {
    $origSchoolName = qa_dg(qa('GET', '/control/school-ops/school', $O)['json'], 'data.name_en');
    $spu = qa('PUT', '/control/school-ops/school', $O, ['name_en' => "QA School {$MARK}"]);
    $okSpu = $spu['status'] === 200 && qa_dg($spu['json'], 'data.name_en') === "QA School {$MARK}";
    record('school-ops/school', 'update', 'PUT', '/control/school-ops/school', $spu, $okSpu, $okSpu ? '' : qa_msg($spu));
    if (! $okSpu) {
        finding($spu['status'] >= 500 ? 'HIGH' : 'MED', 'school-ops/school', 'PUT', '/control/school-ops/school', ['name_en' => '...'], $spu, 'school profile update returned '.$spu['status'].' or did not persist');
    }
    $spr = qa('PUT', '/control/school-ops/school', $O, ['name_en' => $origSchoolName]);
    record('school-ops/school', 'restore', 'PUT', '/control/school-ops/school', $spr, $spr['status'] === 200, $spr['status'] === 200 ? '' : qa_msg($spr));
    if ($spr['status'] !== 200) {
        leftover('school-ops school name_en', $origSchoolName, 'could not restore the original school name');
    }
}

// ---------------------------------------------------------- SCHOOL WORKSPACE
$created['ws/staff'] = lifecycle('school-workspace/staff', [
    'token' => $O,
    'create' => ['POST', '/control/school-workspace/staff', [
        'email' => "zzqa.staff.{$MARK}@qa.local", 'password' => $PW,
        'first_name' => "QA{$MARK}", 'last_name' => 'Staff', 'status' => 'active',
    ]],
    'id_path' => ['data.id', 'data.user_id'],
    'read' => ['index', '/control/school-workspace/staff'],
    'update' => ['PUT', '/control/school-workspace/staff/{id}', ['first_name' => "QA{$MARK}Upd"], null, null],
    'status' => ['PUT', '/control/school-workspace/staff/{id}', ['status' => 'inactive'], null, null],
]);
$qaStaffUserId = qa_dg($created['ws/staff']['record'] ?? [], 'user_id') ?: ($created['ws/staff']['id'] ?? null);

$created['ws/staff-attendance'] = lifecycle('school-workspace/staff-attendance', [
    'token' => $O,
    'create' => ['POST', '/control/school-workspace/staff-attendance', [
        'user_id' => $qaStaffUserId ?: $ctx['staff_user_id'],
        'attendance_date' => date('Y-m-d'), 'status' => 'present', 'notes' => "QA {$MARK}",
    ]],
    'read' => ['index', '/control/school-workspace/staff-attendance'],
    'update' => ['PUT', '/control/school-workspace/staff-attendance/{id}', ['notes' => "QA {$MARK} Upd"], null, null],
    'status' => ['PUT', '/control/school-workspace/staff-attendance/{id}', ['status' => 'late'], 'status', 'late'],
]);

$created['ws/courses'] = lifecycle('school-workspace/courses', [
    'token' => $O,
    'create' => ['POST', '/control/school-workspace/courses', [
        'code' => "ZZQA-CO-{$MARK}", 'title_en' => "QA Course {$MARK}",
        'subject_id' => $ctx['ops_subject_id'], 'status' => 'active',
    ]],
    'read' => ['index', '/control/school-workspace/courses'],
    'update' => ['PUT', '/control/school-workspace/courses/{id}', ['title_en' => "QA Course {$MARK} Upd"], 'title_en', "QA Course {$MARK} Upd"],
    'status' => ['PUT', '/control/school-workspace/courses/{id}', ['status' => 'archived'], 'status', 'archived'],
    'delete' => null, // deleted after its lessons
]);
$qaCourseId = $created['ws/courses']['id'] ?? null;

$created['ws/lessons'] = lifecycle('school-workspace/lessons', [
    'token' => $O,
    'create' => ['POST', '/control/school-workspace/lessons', [
        'course_id' => $qaCourseId, 'title_en' => "QA WS Lesson {$MARK}",
        'sort_order' => 1, 'duration_minutes' => 45, 'status' => 'active',
    ]],
    'read' => ['index', '/control/school-workspace/lessons'],
    'update' => ['PUT', '/control/school-workspace/lessons/{id}', ['title_en' => "QA WS Lesson {$MARK} Upd"], 'title_en', "QA WS Lesson {$MARK} Upd"],
    'status' => ['PUT', '/control/school-workspace/lessons/{id}', ['status' => 'archived'], 'status', 'archived'],
    'delete' => ['DELETE', '/control/school-workspace/lessons/{id}'],
]);
if ($qaCourseId) {
    $dc = qa('DELETE', "/control/school-workspace/courses/{$qaCourseId}", $O);
    $okDc = in_array($dc['status'], [200, 204], true);
    record('school-workspace/courses', 'delete', 'DELETE', "/control/school-workspace/courses/{$qaCourseId}", $dc, $okDc, $okDc ? '' : qa_msg($dc));
    if (! $okDc) {
        leftover('school-workspace/courses', $qaCourseId, 'DELETE returned '.$dc['status'].': '.qa_msg($dc, 160));
        finding($dc['status'] >= 500 ? 'HIGH' : 'MED', 'school-workspace/courses', 'DELETE', "/control/school-workspace/courses/{$qaCourseId}", null, $dc, 'DELETE returned '.$dc['status']);
    }
}

$created['ws/resources'] = lifecycle('school-workspace/resources', [
    'token' => $O,
    'create' => ['POST', '/control/school-workspace/resources', [
        'title_en' => "QA Resource {$MARK}", 'resource_type' => 'link',
        'url' => 'https://example.test/zzqa', 'subject_id' => $ctx['ops_subject_id'], 'status' => 'active',
    ]],
    'read' => ['index', '/control/school-workspace/resources'],
    'update' => ['PUT', '/control/school-workspace/resources/{id}', ['title_en' => "QA Resource {$MARK} Upd"], 'title_en', "QA Resource {$MARK} Upd"],
    'status' => ['PUT', '/control/school-workspace/resources/{id}', ['status' => 'archived'], 'status', 'archived'],
    'delete' => ['DELETE', '/control/school-workspace/resources/{id}'],
]);

$created['ws/assignments'] = lifecycle('school-workspace/assignments', [
    'token' => $O,
    'create' => ['POST', '/control/school-workspace/assignments', [
        'title_en' => "QA Assignment {$MARK}", 'subject_id' => $ctx['ops_subject_id'],
        'class_section_id' => $ctx['ops_section_id'], 'due_at' => date('Y-m-d H:i:s', strtotime('+10 days')),
        'max_score' => 100, 'status' => 'published',
    ]],
    'read' => ['index', '/control/school-workspace/assignments'],
    'update' => ['PUT', '/control/school-workspace/assignments/{id}', ['title_en' => "QA Assignment {$MARK} Upd"], 'title_en', "QA Assignment {$MARK} Upd"],
    'status' => ['PUT', '/control/school-workspace/assignments/{id}', ['status' => 'draft'], 'status', 'draft'],
    'delete' => ['DELETE', '/control/school-workspace/assignments/{id}'],
]);

$created['ws/homework'] = lifecycle('school-workspace/homework', [
    'token' => $O,
    'create' => ['POST', '/control/school-workspace/homework', [
        'title_en' => "QA Homework {$MARK}", 'instructions_en' => 'QA instructions',
        'subject_id' => $ctx['ops_subject_id'], 'class_section_id' => $ctx['ops_section_id'],
        'due_at' => date('Y-m-d H:i:s', strtotime('+5 days')), 'status' => 'published',
    ]],
    'read' => ['index', '/control/school-workspace/homework'],
    'update' => ['PUT', '/control/school-workspace/homework/{id}', ['title_en' => "QA Homework {$MARK} Upd"], 'title_en', "QA Homework {$MARK} Upd"],
    'status' => ['PUT', '/control/school-workspace/homework/{id}', ['status' => 'draft'], 'status', 'draft'],
    'delete' => ['DELETE', '/control/school-workspace/homework/{id}'],
]);

$created['ws/questions'] = lifecycle('school-workspace/questions', [
    'token' => $O,
    'create' => ['POST', '/control/school-workspace/questions', [
        'stem_en' => "QA Question {$MARK}?", 'type' => 'mcq', 'difficulty' => 'easy',
        'subject_id' => $ctx['ops_subject_id'], 'status' => 'active',
    ]],
    'read' => ['index', '/control/school-workspace/questions'],
    'update' => ['PUT', '/control/school-workspace/questions/{id}', ['stem_en' => "QA Question {$MARK} Upd?"], 'stem_en', "QA Question {$MARK} Upd?"],
    'status' => ['PUT', '/control/school-workspace/questions/{id}', ['status' => 'archived'], 'status', 'archived'],
    'delete' => ['DELETE', '/control/school-workspace/questions/{id}'],
]);

$created['ws/quizzes'] = lifecycle('school-workspace/quizzes', [
    'token' => $O,
    'create' => ['POST', '/control/school-workspace/quizzes', [
        'title_en' => "QA Quiz {$MARK}", 'subject_id' => $ctx['ops_subject_id'],
        'time_limit_seconds' => 600, 'max_attempts' => 2, 'status' => 'draft',
    ]],
    'read' => ['index', '/control/school-workspace/quizzes'],
    'update' => ['PUT', '/control/school-workspace/quizzes/{id}', ['title_en' => "QA Quiz {$MARK} Upd"], 'title_en', "QA Quiz {$MARK} Upd"],
    'status' => ['PUT', '/control/school-workspace/quizzes/{id}', ['status' => 'published'], 'status', 'published'],
    'delete' => ['DELETE', '/control/school-workspace/quizzes/{id}'],
]);

$created['ws/exams'] = lifecycle('school-workspace/exams', [
    'token' => $O,
    'create' => ['POST', '/control/school-workspace/exams', [
        'title_en' => "QA Exam {$MARK}", 'subject_id' => $ctx['ops_subject_id'],
        'time_limit_seconds' => 3600, 'max_attempts' => 1, 'status' => 'draft',
    ]],
    'read' => ['index', '/control/school-workspace/exams'],
    'update' => ['PUT', '/control/school-workspace/exams/{id}', ['title_en' => "QA Exam {$MARK} Upd"], 'title_en', "QA Exam {$MARK} Upd"],
    'status' => ['PUT', '/control/school-workspace/exams/{id}', ['status' => 'published'], 'status', 'published'],
    'delete' => ['DELETE', '/control/school-workspace/exams/{id}'],
]);

$created['ws/tutoring-tutors'] = lifecycle('school-workspace/tutoring/tutors', [
    'token' => $O,
    'create' => ['POST', '/control/school-workspace/tutoring/tutors', [
        'email' => "zzqa.wstutor.{$MARK}@qa.local", 'password' => $PW,
        'first_name' => "QA{$MARK}", 'last_name' => 'WsTutor', 'hourly_rate' => 50, 'status' => 'active',
    ]],
    'id_path' => ['data.id', 'data.user_id'],
    'read' => ['index', '/control/school-workspace/tutoring/tutors'],
    'update' => ['PUT', '/control/school-workspace/tutoring/tutors/{id}', ['first_name' => "QA{$MARK}Upd"], null, null],
    'status' => ['PUT', '/control/school-workspace/tutoring/tutors/{id}', ['status' => 'inactive'], null, null],
]);
$qaWsTutorUserId = qa_dg($created['ws/tutoring-tutors']['record'] ?? [], 'user_id') ?: ($created['ws/tutoring-tutors']['id'] ?? null);

$created['ws/bookings'] = lifecycle('school-workspace/tutoring/bookings', [
    'token' => $O,
    'create' => ['POST', '/control/school-workspace/tutoring/bookings', [
        'tutor_user_id' => $qaWsTutorUserId ?: $ctx['teacher_user_id'],
        'student_user_id' => $qaStudentUserId ?: $ctx['student_user_id'],
        'starts_at' => date('Y-m-d H:i:s', strtotime('+3 days')),
        'ends_at' => date('Y-m-d H:i:s', strtotime('+3 days +1 hour')),
        'subject_id' => $ctx['ops_subject_id'], 'status' => 'scheduled',
    ]],
    'read' => ['index', '/control/school-workspace/tutoring/bookings'],
    'update' => ['PUT', '/control/school-workspace/tutoring/bookings/{id}', ['status' => 'completed'], 'status', 'completed'],
]);

$created['ws/timetable'] = lifecycle('school-workspace/tutoring/timetable', [
    'token' => $O,
    'create' => ['POST', '/control/school-workspace/tutoring/timetable', [
        'day_of_week' => 3, 'start_time' => '09:00', 'end_time' => '10:00',
        'tutor_user_id' => $qaWsTutorUserId ?: $ctx['teacher_user_id'],
        'subject_id' => $ctx['ops_subject_id'], 'status' => 'active',
    ]],
    'read' => ['index', '/control/school-workspace/tutoring/timetable'],
    'update' => ['PUT', '/control/school-workspace/tutoring/timetable/{id}', ['end_time' => '11:00'], null, null],
    'status' => ['PUT', '/control/school-workspace/tutoring/timetable/{id}', ['status' => 'inactive'], 'status', 'inactive'],
    'delete' => ['DELETE', '/control/school-workspace/tutoring/timetable/{id}'],
]);

$created['ws/fees'] = lifecycle('school-workspace/finance/fees', [
    'token' => $O,
    'create' => ['POST', '/control/school-workspace/finance/fees', [
        'student_user_id' => $qaStudentUserId ?: $ctx['student_user_id'],
        'number' => "ZZQA-INV-{$MARK}", 'total' => 250.00, 'currency' => 'SAR',
        'due_at' => date('Y-m-d', strtotime('+30 days')), 'notes' => "QA {$MARK}", 'status' => 'draft',
    ]],
    'read' => ['index', '/control/school-workspace/finance/fees'],
    'update' => ['PUT', '/control/school-workspace/finance/fees/{id}', ['total' => 300.00], null, null],
    'status' => ['PUT', '/control/school-workspace/finance/fees/{id}', ['status' => 'paid'], 'status', 'paid'],
]);

$created['ws/tutor-payments'] = lifecycle('school-workspace/finance/tutor-payments', [
    'token' => $O,
    'create' => ['POST', '/control/school-workspace/finance/tutor-payments', [
        'tutor_user_id' => $qaWsTutorUserId ?: $ctx['teacher_user_id'],
        'amount' => 120.50, 'currency' => 'SAR', 'paid_at' => date('Y-m-d'),
        'reference' => "ZZQA-PAY-{$MARK}", 'status' => 'pending',
    ]],
    'read' => ['index', '/control/school-workspace/finance/tutor-payments'],
    'update' => ['PUT', '/control/school-workspace/finance/tutor-payments/{id}', ['amount' => 150.00], null, null],
    'status' => ['PUT', '/control/school-workspace/finance/tutor-payments/{id}', ['status' => 'paid'], 'status', 'paid'],
]);

$created['ws/expenses'] = lifecycle('school-workspace/finance/expenses', [
    'token' => $O,
    'create' => ['POST', '/control/school-workspace/finance/expenses', [
        'title' => "QA Expense {$MARK}", 'category' => 'supplies', 'amount' => 75.25,
        'currency' => 'SAR', 'spent_on' => date('Y-m-d'), 'notes' => "QA {$MARK}", 'status' => 'pending',
    ]],
    'read' => ['index', '/control/school-workspace/finance/expenses'],
    'update' => ['PUT', '/control/school-workspace/finance/expenses/{id}', ['title' => "QA Expense {$MARK} Upd"], 'title', "QA Expense {$MARK} Upd"],
    'status' => ['PUT', '/control/school-workspace/finance/expenses/{id}', ['status' => 'approved'], 'status', 'approved'],
    'delete' => ['DELETE', '/control/school-workspace/finance/expenses/{id}'],
]);

$created['ws/notifications'] = lifecycle('school-workspace/notifications', [
    'token' => $O,
    'create' => ['POST', '/control/school-workspace/notifications', [
        'title' => "QA Notification {$MARK}", 'body' => 'QA harness notification body.',
        'channel' => 'in_app', 'audience' => 'staff',
    ]],
    'read' => ['index', '/control/school-workspace/notifications'],
    'status' => ['POST', '/control/school-workspace/notifications/{id}/send', null, null, null],
]);

if (qa_selected('school-workspace/settings')) {
    $origOrgName = qa_dg(qa('GET', '/control/school-workspace/settings/organisation', $O)['json'], 'data.name');
    $ou = qa('PUT', '/control/school-workspace/settings/organisation', $O, ['name' => "QA Org WS {$MARK}"]);
    record('school-workspace/settings/organisation', 'update', 'PUT', '/control/school-workspace/settings/organisation', $ou, $ou['status'] === 200, $ou['status'] === 200 ? '' : qa_msg($ou));
    if ($ou['status'] >= 500) {
        finding('HIGH', 'school-workspace/settings/organisation', 'PUT', '/control/school-workspace/settings/organisation', ['name' => '...'], $ou, 'returned '.$ou['status']);
    }
    $our = qa('PUT', '/control/school-workspace/settings/organisation', $O, ['name' => $origOrgName]);
    record('school-workspace/settings/organisation', 'restore', 'PUT', '/control/school-workspace/settings/organisation', $our, $our['status'] === 200, $our['status'] === 200 ? '' : qa_msg($our));
    if ($our['status'] !== 200) {
        leftover('school-workspace organisation name', $origOrgName, 'could not restore');
    }

    $origBrand = (array) qa_dg(qa('GET', '/control/school-workspace/settings/branding', $O)['json'], 'data', []);
    $bu = qa('PUT', '/control/school-workspace/settings/branding', $O, ['app_name' => "QA Brand {$MARK}"]);
    record('school-workspace/settings/branding', 'update', 'PUT', '/control/school-workspace/settings/branding', $bu, $bu['status'] === 200, $bu['status'] === 200 ? '' : qa_msg($bu));
    if ($bu['status'] >= 500) {
        finding('HIGH', 'school-workspace/settings/branding', 'PUT', '/control/school-workspace/settings/branding', ['app_name' => '...'], $bu, 'returned '.$bu['status']);
    }
    $bur = qa('PUT', '/control/school-workspace/settings/branding', $O, ['app_name' => $origBrand['app_name'] ?? null]);
    record('school-workspace/settings/branding', 'restore', 'PUT', '/control/school-workspace/settings/branding', $bur, $bur['status'] === 200, $bur['status'] === 200 ? '' : qa_msg($bur));
    if ($bur['status'] !== 200) {
        leftover('school-workspace branding app_name', $origBrand['app_name'] ?? null, 'could not restore');
    }
}

// ------------------------------------------------------------ authorisation
if (qa_selected('AUTHZ')) {
    $authzProbes = [
        ['countries', 'POST', '/control/countries', ['code' => $ctx['free_country_code'] === 'XA' ? 'XB' : 'XA', 'name_en' => "QA Deny {$MARK}"], '/control/countries/%s'],
        ['billing/plans', 'POST', '/control/billing/plans', ['code' => "ZZQA-DENY-{$MARK}", 'name_en' => 'QA Deny', 'price' => 1], '/control/billing/plans/%s'],
        ['platform-users', 'POST', '/control/platform-users', ['email' => "zzqa.deny.{$MARK}@qa.local", 'password' => $PW, 'first_name' => 'Deny', 'role_code' => 'super_admin'], '/control/platform-users/%s'],
        ['tenant-groups', 'POST', '/control/tenant-groups', ['name' => "QA Deny {$MARK}"], '/control/tenant-groups/%s'],
        ['integrations', 'POST', '/control/integrations/payment', ['code' => 'denyqa'.strtolower($MARK), 'name_en' => 'QA Deny'], '/control/integrations/payment/%s'],
        ['settings', 'PUT', '/control/settings/global', ['settings' => ['platform_name' => 'QA Deny']], null],
    ];
    foreach ($authzProbes as [$rname, $m, $p, $payload, $undo]) {
        $r = qa($m, $p, $O, $payload);
        $ok = in_array($r['status'], [401, 403], true);
        record('AUTHZ '.$rname, 'owner-denied', $m, $p, $r, $ok, $ok ? '' : 'expected 401/403, got '.$r['status'].' '.qa_msg($r, 120));
        if (in_array($r['status'], [200, 201], true)) {
            finding('HIGH', 'AUTHZ '.$rname, $m, $p, $payload, $r, 'school_owner (tenant-scoped, no platform permission) was allowed to write a platform-scoped resource');
            $newId = qa_dg($r['json'], 'data.id') ?? qa_dg($r['json'], 'data.code');
            if ($undo && $newId) {
                $un = qa('DELETE', sprintf($undo, $newId), $S);
                record('AUTHZ '.$rname, 'undo', 'DELETE', sprintf($undo, $newId), $un, in_array($un['status'], [200, 204], true), '');
                if (! in_array($un['status'], [200, 204], true)) {
                    leftover($rname.' (created by unauthorised owner)', $newId, 'could not undo the authorisation probe');
                }
            }
        }
    }
}

if (qa_selected('VALIDATION')) {
    foreach ([
        ['countries', 'POST', '/control/countries', [], $S],
        ['billing/plans', 'POST', '/control/billing/plans', [], $S],
        ['school-ops/classes', 'POST', '/control/school-ops/classes', [], $O],
        ['school-workspace/courses', 'POST', '/control/school-workspace/courses', [], $O],
    ] as [$rname, $m, $p, $payload, $tok]) {
        $r = qa($m, $p, $tok, $payload);
        $ok = $r['status'] === 422;
        record('VALIDATION '.$rname, 'empty-payload', $m, $p, $r, $ok, $ok ? '' : 'expected 422, got '.$r['status']);
        if ($r['status'] >= 500) {
            finding('HIGH', 'VALIDATION '.$rname, $m, $p, $payload, $r, 'empty payload causes '.$r['status'].' instead of a 422');
        }
    }
}

if (qa_selected('NOTFOUND')) {
    foreach ([
        ['countries', 'PUT', '/control/countries/99999999', ['name_en' => 'x'], $S],
        ['billing/plans', 'DELETE', '/control/billing/plans/99999999', null, $S],
        ['school-ops/classes', 'PUT', '/control/school-ops/classes/99999999', ['name_en' => 'x'], $O],
        ['school-workspace/courses', 'DELETE', '/control/school-workspace/courses/99999999', null, $O],
    ] as [$rname, $m, $p, $payload, $tok]) {
        $r = qa($m, $p, $tok, $payload);
        $ok = in_array($r['status'], [403, 404, 422], true);
        record('NOTFOUND '.$rname, 'missing-id', $m, $p, $r, $ok, $ok ? '' : 'expected 404, got '.$r['status']);
        if ($r['status'] >= 500) {
            finding('MED', 'NOTFOUND '.$rname, $m, $p, $payload, $r, 'unknown id causes '.$r['status'].' instead of a 404');
        }
        if ($leak = leaks_internals($r)) {
            finding('MED', 'NOTFOUND '.$rname, $m, $p, $payload, $r, "Error response leaks internal detail ({$leak})");
        }
    }
}

// ---------------------------------------------------- final tenant teardown
if ($qaTenantId) {
    $dt = qa('DELETE', "/control/tenants/{$qaTenantId}", $S);
    $okDt = in_array($dt['status'], [200, 204], true);
    record('tenants', 'delete', 'DELETE', "/control/tenants/{$qaTenantId}", $dt, $okDt, $okDt ? '' : qa_msg($dt));
    if (! $okDt) {
        leftover('tenants', $qaTenantId, 'DELETE returned '.$dt['status'].': '.qa_msg($dt, 160));
        finding($dt['status'] >= 500 ? 'HIGH' : 'MED', 'tenants', 'DELETE', "/control/tenants/{$qaTenantId}", null, $dt, 'DELETE returned '.$dt['status']);
    }
}

// ---------------------------------------------------------------- output
echo "\n\n================= RESULTS (marker {$MARK}) =================\n";
printf("%-44s %-16s %-6s %-5s %s\n", 'RESOURCE', 'STEP', 'HTTP', 'OK', 'NOTE');
echo str_repeat('-', 150)."\n";
foreach ($ROWS as $r) {
    printf("%-44s %-16s %-6s %-5s %s\n", substr($r['resource'], 0, 44), substr($r['step'], 0, 16), $r['status'] ?: '-', $r['ok'] ? 'PASS' : 'FAIL', substr($r['note'], 0, 88));
}

$byResource = [];
foreach ($ROWS as $r) {
    $byResource[$r['resource']][$r['step']] = $r['ok'];
}
echo "\n================= PER-RESOURCE MATRIX =================\n";
printf("%-44s %-8s %-8s %-8s %-8s %-8s\n", 'RESOURCE', 'CREATE', 'READ', 'UPDATE', 'STATUS', 'DELETE');
foreach ($byResource as $name => $steps) {
    $cell = function ($k) use ($steps) {
        $seen = null;
        foreach ($steps as $sk => $ok) {
            if (str_starts_with($sk, $k)) {
                $seen = ($seen === false) ? false : $ok;
            }
        }

        return $seen === null ? '-' : ($seen ? 'pass' : 'FAIL');
    };
    printf("%-44s %-8s %-8s %-8s %-8s %-8s\n", substr($name, 0, 44), $cell('create'), $cell('read'), $cell('update'), $cell('status'), $cell('delete'));
}

echo "\n================= CANDIDATE DEFECTS (".count($FINDINGS).") =================\n";
foreach ($FINDINGS as $i => $f) {
    printf(
        "#%d [%s] %s\n    %s %s\n    payload: %s\n    HTTP %d :: %s\n    why: %s\n\n",
        $i + 1, $f['severity'], $f['resource'], $f['method'], $f['path'],
        $f['payload'] === null ? '(none)' : substr(json_encode($f['payload']), 0, 400),
        $f['status'], $f['body'], $f['why']
    );
}

echo "\n================= LEFTOVERS (".count($LEFTOVERS).") =================\n";
foreach ($LEFTOVERS as $l) {
    printf("%-48s id=%-14s %s\n", $l['what'], (string) $l['id'], $l['why']);
}

$outFile = __DIR__.'/qa_crud_control_results_'.$MARK.'.json';
file_put_contents($outFile, json_encode([
    'marker' => $MARK, 'context' => $ctx, 'rows' => $ROWS,
    'findings' => $FINDINGS, 'leftovers' => $LEFTOVERS, 'created' => $created,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

echo "\nWrote ".basename($outFile)."\n";
