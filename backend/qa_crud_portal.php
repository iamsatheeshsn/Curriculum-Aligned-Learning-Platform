<?php

/**
 * QA harness: full CRUD lifecycle smoke test for the Institution (teacher / tutor /
 * school staff) and Learner (student / parent) portal write endpoints.
 *
 * Every record created here carries a "ZZQA" marker and is removed again in the
 * cleanup phase. Endpoints that have no DELETE route are cleaned up directly via
 * the database using the exact ids captured during the run.
 *
 * Usage: php qa_crud_portal.php [--json=qa_crud_results.json] [--no-db-cleanup]
 */

$BASE = 'http://127.0.0.1:8000/api/v1';
$MARK = 'ZZQA'.random_int(1000, 9999);
$ARGV_OPTS = $argv ?? [];
$DB_CLEANUP = ! in_array('--no-db-cleanup', $ARGV_OPTS, true);

// ---------------------------------------------------------------- infrastructure

/** @var array<string, array<int, array<string, mixed>>> resource => steps */
$RESULTS = [];
/** @var list<array<string, mixed>> */
$DEFECTS = [];
/** @var list<array<string, mixed>> */
$NOTES = [];
/** @var array<string, list<int|string>> model class => ids to force-delete */
$DB_TRASH = [];
/** @var list<array{model:string,id:int|string,column:string,value:mixed}> */
$DB_RESTORE = [];
/** @var list<string> */
$LEFTOVERS = [];

function request(string $method, string $url, ?string $token = null, ?array $body = null): array
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
        CURLOPT_TIMEOUT => 60,
    ]);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    return [
        'status' => $status,
        'body' => (string) $raw,
        'json' => json_decode((string) $raw, true),
        'error' => $err,
    ];
}

/**
 * Institution routes are mounted under /api/v1/org, learner routes under
 * /api/v1/learner (see routes/api.php).
 */
function q(string $path, array $query = [], string $portal = 'org'): string
{
    global $BASE;
    $prefix = $portal === 'raw' ? '' : '/'.$portal;

    return $BASE.$prefix.$path.($query ? '?'.http_build_query($query) : '');
}

function lq(string $path, array $query = []): string
{
    return q($path, $query, 'learner');
}

function shortBody(array $res, int $len = 300): string
{
    $j = $res['json'];
    if (is_array($j)) {
        $msg = $j['message'] ?? null;
        $errors = isset($j['errors']) ? json_encode($j['errors']) : null;
        $out = trim((string) $msg.($errors ? ' '.$errors : ''));
        if ($out !== '') {
            return mb_substr($out, 0, $len);
        }
    }

    return mb_substr(trim(strip_tags($res['body'])), 0, $len);
}

/**
 * Record one lifecycle step.
 *
 * @param  list<int>  $expect  status codes considered a pass
 */
function step(string $resource, string $label, string $method, string $url, array $res, array $expect, ?string $detail = null): bool
{
    global $RESULTS;

    $ok = in_array($res['status'], $expect, true);
    // Keep the server message for anything non-2xx, even when the code was expected —
    // an expected 422 is only "correct behaviour" if the message says what we think.
    $auto = ($ok && $res['status'] < 400) ? '' : shortBody($res, 160);
    $RESULTS[$resource][] = [
        'step' => $label,
        'method' => $method,
        'url' => $url,
        'status' => $res['status'],
        'ok' => $ok,
        'detail' => $detail ?? $auto,
    ];

    return $ok;
}

/** Record an assertion that is not an HTTP call (round-trip / persistence checks). */
function assertStep(string $resource, string $label, bool $ok, string $detail = ''): bool
{
    global $RESULTS;

    $RESULTS[$resource][] = [
        'step' => $label,
        'method' => 'CHECK',
        'url' => '',
        'status' => $ok ? 200 : 0,
        'ok' => $ok,
        'detail' => $detail,
    ];

    return $ok;
}

function defect(string $severity, string $resource, string $summary, string $method, string $url, ?array $payload, array $res): void
{
    global $DEFECTS;

    $DEFECTS[] = [
        'severity' => $severity,
        'resource' => $resource,
        'summary' => $summary,
        'method' => $method,
        'url' => $url,
        'payload' => $payload,
        'status' => $res['status'] ?? null,
        'response' => mb_substr(trim((string) ($res['body'] ?? '')), 0, 900),
    ];
}

function note(string $text): void
{
    global $NOTES;
    $NOTES[] = $text;
}

function trash(string $model, $id): void
{
    global $DB_TRASH;
    if ($id === null) {
        return;
    }
    $DB_TRASH[$model][] = $id;
}

function restoreLater(string $model, $id, string $column, $value): void
{
    global $DB_RESTORE;
    $DB_RESTORE[] = ['model' => $model, 'id' => $id, 'column' => $column, 'value' => $value];
}

function leftover(string $text): void
{
    global $LEFTOVERS;
    $LEFTOVERS[] = $text;
}

/** A 500, or an error body that leaks internals, is always a defect. */
function scanForLeak(string $resource, string $method, string $url, ?array $payload, array $res): void
{
    static $seen = [];

    if ($res['status'] >= 500) {
        defect('HIGH', $resource, 'Unhandled server error (HTTP '.$res['status'].')', $method, $url, $payload, $res);

        return;
    }
    // A 404 for a URL that simply is not routed is a harness problem, not an app defect.
    if ($res['status'] === 404 && str_contains((string) $res['body'], 'could not be found')) {
        return;
    }
    $body = (string) $res['body'];
    $leaks = ['SQLSTATE', 'Illuminate\\', 'App\\Domain\\', 'App\\Http\\', 'vendor\\laravel', 'Stack trace'];
    foreach ($leaks as $needle) {
        if (str_contains($body, $needle)) {
            $key = $resource.'|'.$needle;
            if (isset($seen[$key])) {
                return;
            }
            $seen[$key] = true;
            defect('MEDIUM', $resource, 'Error response leaks internal details ("'.$needle.'")', $method, $url, $payload, $res);

            return;
        }
    }
}

/** Convenience wrapper: call + record + leak scan. */
function call(string $resource, string $label, string $method, string $url, ?string $token, ?array $body, array $expect): array
{
    $res = request($method, $url, $token, $body);
    step($resource, $label, $method, $url, $res, $expect);
    scanForLeak($resource, $method, $url, $body, $res);

    return $res;
}

// ---------------------------------------------------------------- login

$accounts = [
    'teacher' => ['teacher', 'teacher@alnoor.test', 'Password!123', 'al-noor'],
    'tutor' => ['teacher', 'tutor2@alnoor.test', 'Password!123', 'al-noor'],
    'school_admin' => ['teacher', 'admin@alnoor.test', 'Password!123', 'al-noor'],
    'school_owner' => ['teacher', 'owner@alnoor.test', 'Password!456', 'al-noor'],
    'student' => ['student', 'student@alnoor.test', 'Password!123', 'al-noor'],
    'parent' => ['parent', 'parent@alnoor.test', 'Password!123', 'al-noor'],
];

$T = [];
$U = [];
echo "=== LOGIN ===\n";
foreach ($accounts as $role => [$portal, $email, $password, $tenant]) {
    $res = request('POST', "{$BASE}/auth/{$portal}/login", null, [
        'email' => $email, 'password' => $password, 'tenant_slug' => $tenant,
    ]);
    $T[$role] = $res['json']['data']['token'] ?? null;
    $U[$role] = $res['json']['data']['user'] ?? $res['json']['data'] ?? null;
    printf("%-14s %s HTTP %d  user_id=%s\n", $role, $T[$role] ? 'OK  ' : 'FAIL',
        $res['status'], (string) ($U[$role]['id'] ?? '?'));
    if (! $T[$role]) {
        echo '   '.shortBody($res)."\n";
    }
}

if (! $T['teacher']) {
    fwrite(STDERR, "Teacher login failed — aborting.\n");
    exit(1);
}

$teacherId = (int) ($U['teacher']['id'] ?? 0);
$tutorId = (int) ($U['tutor']['id'] ?? 0);
$studentId = (int) ($U['student']['id'] ?? 0);
$parentId = (int) ($U['parent']['id'] ?? 0);

// ---------------------------------------------------------------- context

$ctx = request('GET', q('/teacher/context'), $T['teacher']);
$sections = $ctx['json']['data']['sections'] ?? [];
$subjects = $ctx['json']['data']['subjects'] ?? [];
$sectionId = (int) ($sections[0]['id'] ?? 0);
$subjectId = (int) ($subjects[0]['id'] ?? 0);
$schoolId = (int) ($ctx['json']['data']['school']['id'] ?? 0);
printf("\nContext: school=%d section=%d subject=%d scope=%s (%d sections, %d subjects)\n",
    $schoolId, $sectionId, $subjectId, (string) ($ctx['json']['data']['scope'] ?? '?'),
    count($sections), count($subjects));

// A section the student is actually enrolled in makes homework/attendance realistic.
$studentSectionId = $sectionId;
foreach ($sections as $s) {
    if (($s['students_count'] ?? 0) > 0) {
        $studentSectionId = (int) $s['id'];
        break;
    }
}

$today = date('Y-m-d');
$future = date('Y-m-d\TH:i:s\Z', strtotime('+7 days'));
// Far enough out that it cannot collide with a curated demo booking.
$soon = date('Y-m-d\T19:07:00\Z', strtotime('+45 days'));

try {

    // ============================================================ 1. LESSON PLANS
    $R = 'teacher.lesson_plans';
    $payload = [
        'title_en' => "{$MARK} Lesson Plan",
        'title_ar' => "{$MARK} خطة",
        'subject_id' => $subjectId ?: null,
        'class_section_id' => $sectionId ?: null,
        'planned_on' => $today,
        'duration_minutes' => 45,
        'objectives' => "{$MARK} objectives",
        'materials' => 'whiteboard',
        'activities' => 'group work',
        'status' => 'draft',
    ];
    $res = call($R, 'CREATE', 'POST', q('/teacher/lesson-plans'), $T['teacher'], $payload, [201]);
    $planId = (int) ($res['json']['data']['id'] ?? 0);
    if ($planId) {
        trash(\App\Domain\Learning\Models\LessonPlan::class, $planId);
    }

    $res = call($R, 'READ list', 'GET', q('/teacher/lesson-plans', ['search' => $MARK]), $T['teacher'], null, [200]);
    $row = collect_find($res['json']['data'] ?? [], 'id', $planId);
    assertStep($R, 'READ round-trip',
        $row !== null && ($row['title_en'] ?? '') === $payload['title_en'] && ($row['objectives'] ?? '') === $payload['objectives'] && ($row['duration_minutes'] ?? null) == 45,
        $row === null ? 'created plan not returned by list' : 'title/objectives/duration match');
    if ($row === null && $planId) {
        defect('HIGH', $R, 'Created lesson plan is not returned by its own list endpoint', 'GET', q('/teacher/lesson-plans', ['search' => $MARK]), null, $res);
    }

    $update = $payload;
    $update['title_en'] = "{$MARK} Lesson Plan (updated)";
    $update['duration_minutes'] = 60;
    $update['status'] = 'published';
    $res = call($R, 'UPDATE', 'PUT', q("/teacher/lesson-plans/{$planId}"), $T['teacher'], $update, [200]);
    $res = request('GET', q('/teacher/lesson-plans', ['search' => $MARK]), $T['teacher']);
    $row = collect_find($res['json']['data'] ?? [], 'id', $planId);
    $persisted = $row !== null && ($row['title_en'] ?? '') === $update['title_en'] && ($row['duration_minutes'] ?? null) == 60;
    assertStep($R, 'UPDATE persisted', $persisted, $persisted ? 'title+duration changed' : 'update did not persist: '.json_encode($row));
    if (! $persisted && $planId) {
        defect('HIGH', $R, 'PUT returned success but the change did not persist', 'PUT', q("/teacher/lesson-plans/{$planId}"), $update, $res);
    }

    assertStep($R, 'STATUS change (draft->published)', ($row['status'] ?? null) === 'published', 'status='.($row['status'] ?? 'null'));

    $res = call($R, 'DUPLICATE', 'POST', q("/teacher/lesson-plans/{$planId}/duplicate"), $T['teacher'], [], [201]);
    $copyId = (int) ($res['json']['data']['id'] ?? 0);
    if ($copyId) {
        trash(\App\Domain\Learning\Models\LessonPlan::class, $copyId);
    }

    // Cross-teacher scoping: the tutor account must not be able to touch it.
    if ($T['tutor'] && $planId) {
        $res = request('PUT', q("/teacher/lesson-plans/{$planId}"), $T['tutor'], $update);
        step($R, 'SCOPING other teacher UPDATE', 'PUT', q("/teacher/lesson-plans/{$planId}"), $res, [403, 404]);
        if (in_array($res['status'], [200, 201], true)) {
            defect('HIGH', $R, 'Another teacher can update a lesson plan they do not own', 'PUT', q("/teacher/lesson-plans/{$planId}"), $update, $res);
        }
        $res = request('DELETE', q("/teacher/lesson-plans/{$planId}"), $T['tutor']);
        step($R, 'SCOPING other teacher DELETE', 'DELETE', q("/teacher/lesson-plans/{$planId}"), $res, [403, 404]);
        if ($res['status'] === 200) {
            defect('HIGH', $R, 'Another teacher can delete a lesson plan they do not own', 'DELETE', q("/teacher/lesson-plans/{$planId}"), null, $res);
        }
    }

    foreach (array_filter([$copyId, $planId]) as $id) {
        $res = call($R, 'DELETE'.($id === $copyId ? ' (copy)' : ''), 'DELETE', q("/teacher/lesson-plans/{$id}"), $T['teacher'], null, [200, 204]);
    }
    $res = request('GET', q('/teacher/lesson-plans', ['search' => $MARK]), $T['teacher']);
    $remaining = count($res['json']['data'] ?? []);
    assertStep($R, 'DELETE verified gone', $remaining === 0, "remaining rows with marker: {$remaining}");
    if ($remaining > 0) {
        defect('HIGH', $R, 'DELETE returned success but rows are still listed', 'DELETE', q('/teacher/lesson-plans/{id}'), null, $res);
    }

    // ============================================================ 2. RESOURCES
    $R = 'teacher.resources';
    $payload = [
        'type' => 'pdf',
        'title_en' => "{$MARK} Resource",
        'title_ar' => "{$MARK} مورد",
        'external_url' => 'https://example.com/'.strtolower($MARK).'.pdf',
        'mime_type' => 'application/pdf',
    ];
    $res = call($R, 'CREATE', 'POST', q('/teacher/resources'), $T['teacher'], $payload, [201]);
    $assetId = (int) ($res['json']['data']['id'] ?? 0);
    if ($assetId) {
        trash(\App\Domain\Learning\Models\MediaAsset::class, $assetId);
    }

    $res = call($R, 'READ list', 'GET', q('/teacher/resources', ['search' => $MARK]), $T['teacher'], null, [200]);
    $row = collect_find($res['json']['data'] ?? [], 'id', $assetId);
    assertStep($R, 'READ round-trip',
        $row !== null && ($row['title_en'] ?? '') === $payload['title_en'] && ($row['external_url'] ?? '') === $payload['external_url'],
        $row === null ? 'not listed' : 'title/url match');

    $update = $payload;
    $update['title_en'] = "{$MARK} Resource (updated)";
    $update['type'] = 'video';
    $update['duration_seconds'] = 120;
    call($R, 'UPDATE', 'PUT', q("/teacher/resources/{$assetId}"), $T['teacher'], $update, [200]);
    $res = request('GET', q('/teacher/resources', ['search' => $MARK]), $T['teacher']);
    $row = collect_find($res['json']['data'] ?? [], 'id', $assetId);
    $persisted = $row !== null && ($row['title_en'] ?? '') === $update['title_en'] && ($row['type'] ?? '') === 'video';
    assertStep($R, 'UPDATE persisted', $persisted, $persisted ? 'title+type changed' : 'not persisted: '.json_encode($row));
    if (! $persisted && $assetId) {
        defect('HIGH', $R, 'PUT returned success but the change did not persist', 'PUT', q("/teacher/resources/{$assetId}"), $update, $res);
    }

    // Correct behaviour probe: neither link nor path must be rejected.
    $bad = ['type' => 'pdf', 'title_en' => "{$MARK} invalid"];
    $res = request('POST', q('/teacher/resources'), $T['teacher'], $bad);
    step($R, 'VALIDATION no url/path', 'POST', q('/teacher/resources'), $res, [422]);
    scanForLeak($R, 'POST', q('/teacher/resources'), $bad, $res);
    if ($res['status'] === 201) {
        trash(\App\Domain\Learning\Models\MediaAsset::class, (int) ($res['json']['data']['id'] ?? 0));
        defect('MEDIUM', $R, 'Resource without link or file path was accepted despite the guard', 'POST', q('/teacher/resources'), $bad, $res);
    }

    call($R, 'DELETE', 'DELETE', q("/teacher/resources/{$assetId}"), $T['teacher'], null, [200, 204]);
    $res = request('GET', q('/teacher/resources', ['search' => $MARK]), $T['teacher']);
    $remaining = count($res['json']['data'] ?? []);
    assertStep($R, 'DELETE verified gone', $remaining === 0, "remaining: {$remaining}");

    // ============================================================ 3. MESSAGES
    $R = 'teacher.messages';
    $res = call($R, 'READ recipients', 'GET', q('/teacher/messages/recipients'), $T['teacher'], null, [200]);
    $recipients = $res['json']['data'] ?? [];
    $recipientId = $teacherId; // self-addressed keeps inbox + sent both testable

    // Capture pre-existing unread ids so read-all can be undone afterwards.
    $inbox = request('GET', q('/teacher/messages', ['box' => 'inbox']), $T['teacher']);
    $preUnread = [];
    foreach ($inbox['json']['data'] ?? [] as $m) {
        if (($m['read_at'] ?? null) === null) {
            $preUnread[] = (int) $m['id'];
        }
    }

    $payload = [
        'recipient_user_id' => $recipientId,
        'subject' => "{$MARK} Message",
        'body' => "{$MARK} body text",
        'category' => 'academic',
    ];
    $res = call($R, 'CREATE', 'POST', q('/teacher/messages'), $T['teacher'], $payload, [201]);
    $msgId = (int) ($res['json']['data']['id'] ?? 0);
    if ($msgId) {
        trash(\App\Domain\Learning\Models\StaffMessage::class, $msgId);
    }

    $res = call($R, 'READ list', 'GET', q('/teacher/messages', ['box' => 'inbox', 'search' => $MARK]), $T['teacher'], null, [200]);
    $row = collect_find($res['json']['data'] ?? [], 'id', $msgId);
    assertStep($R, 'READ round-trip',
        $row !== null && ($row['subject'] ?? '') === $payload['subject'] && ($row['category'] ?? '') === 'academic',
        $row === null ? 'not in inbox' : 'subject/category match');

    call($R, 'STATUS mark read', 'POST', q("/teacher/messages/{$msgId}/read"), $T['teacher'], [], [200]);
    $res = request('GET', q('/teacher/messages', ['box' => 'inbox', 'search' => $MARK]), $T['teacher']);
    $row = collect_find($res['json']['data'] ?? [], 'id', $msgId);
    assertStep($R, 'STATUS persisted', ($row['read_at'] ?? null) !== null, 'read_at='.json_encode($row['read_at'] ?? null));

    $res = call($R, 'STATUS mark-all read', 'POST', q('/teacher/messages/read-all'), $T['teacher'], [], [200]);
    foreach ($preUnread as $id) {
        restoreLater(\App\Domain\Learning\Models\StaffMessage::class, $id, 'read_at', null);
    }
    if ($preUnread) {
        note('teacher.messages: read-all marked '.count($preUnread).' pre-existing demo messages read; read_at restored to NULL in cleanup.');
    }

    call($R, 'DELETE', 'DELETE', q("/teacher/messages/{$msgId}"), $T['teacher'], null, [200, 204]);
    $res = request('GET', q('/teacher/messages', ['box' => 'inbox', 'search' => $MARK]), $T['teacher']);
    assertStep($R, 'DELETE verified gone', count($res['json']['data'] ?? []) === 0, '');

    // ============================================================ 4. HOMEWORK (assignments, kind=homework)
    $R = 'teacher.homework';
    $payload = [
        'title_en' => "{$MARK} Homework",
        'instructions_en' => "{$MARK} do the exercises",
        'subject_id' => $subjectId ?: null,
        'class_section_id' => $studentSectionId ?: null,
        'due_at' => $future,
        'status' => 'published',
        'assignment_kind' => 'homework',
        'is_scored' => true,
        'max_score' => 20,
        'allow_late' => true,
    ];
    $res = call($R, 'CREATE', 'POST', q('/teacher/assignments'), $T['teacher'], $payload, [201]);
    $hwId = (int) ($res['json']['data']['id'] ?? 0);
    if ($hwId) {
        trash(\App\Domain\Learning\Models\HomeworkAssignment::class, $hwId);
    }

    $res = call($R, 'READ list', 'GET', q('/teacher/assignments', ['kind' => 'homework', 'search' => $MARK]), $T['teacher'], null, [200]);
    $row = collect_find($res['json']['data'] ?? [], 'id', $hwId);
    assertStep($R, 'READ round-trip',
        $row !== null && ($row['title_en'] ?? '') === $payload['title_en'] && ($row['max_score'] ?? null) == 20,
        $row === null ? 'created homework not listed (section scope?)' : 'title/max_score match');
    if ($row === null && $hwId) {
        defect('MEDIUM', $R, 'Created homework is not returned by the teacher assignments list', 'GET', q('/teacher/assignments', ['kind' => 'homework', 'search' => $MARK]), null, $res);
    }

    $update = $payload;
    $update['title_en'] = "{$MARK} Homework (updated)";
    $update['max_score'] = 25;
    call($R, 'UPDATE', 'PUT', q("/teacher/assignments/{$hwId}"), $T['teacher'], $update, [200]);
    $res = request('GET', q('/teacher/assignments', ['kind' => 'homework', 'search' => $MARK]), $T['teacher']);
    $row = collect_find($res['json']['data'] ?? [], 'id', $hwId);
    $persisted = $row !== null && ($row['title_en'] ?? '') === $update['title_en'] && ($row['max_score'] ?? null) == 25;
    assertStep($R, 'UPDATE persisted', $persisted, $persisted ? 'title+max_score changed' : json_encode($row));

    // ---- learner submits, teacher grades
    $R2 = 'learner.homework_submission';
    $subId = 0;
    if ($T['student'] && $hwId) {
        $res = call($R2, 'CREATE submit', 'POST', lq("/homework/{$hwId}/submit"), $T['student'], ['body_text' => "{$MARK} my answer"], [200, 201]);
        $subId = (int) ($res['json']['data']['id'] ?? 0);
        if ($subId) {
            trash(\App\Domain\Learning\Models\AssignmentSubmission::class, $subId);
        }

        $res = call($R2, 'READ back (teacher)', 'GET', q("/teacher/assignments/{$hwId}/submissions"), $T['teacher'], null, [200]);
        $row = collect_find($res['json']['data'] ?? [], 'id', $subId);
        assertStep($R2, 'READ round-trip', $row !== null && ($row['body_text'] ?? '') === "{$MARK} my answer", $row === null ? 'submission not listed' : 'body matches');

        $res = call($R2, 'UPDATE resubmit', 'POST', lq("/homework/{$hwId}/submit"), $T['student'], ['body_text' => "{$MARK} my answer v2"], [200, 201]);
        $res = request('GET', q("/teacher/assignments/{$hwId}/submissions"), $T['teacher']);
        $row = collect_find($res['json']['data'] ?? [], 'id', $subId);
        assertStep($R2, 'UPDATE persisted', ($row['body_text'] ?? '') === "{$MARK} my answer v2", 'body='.json_encode($row['body_text'] ?? null));

        $grade = ['score' => 18, 'feedback' => "{$MARK} good work", 'status' => 'graded'];
        call($R2, 'STATUS grade', 'POST', q("/teacher/assignments/{$hwId}/submissions/{$subId}/grade"), $T['teacher'], $grade, [200]);
        $res = request('GET', q("/teacher/assignments/{$hwId}/submissions"), $T['teacher']);
        $row = collect_find($res['json']['data'] ?? [], 'id', $subId);
        $graded = $row !== null && (float) ($row['score'] ?? -1) === 18.0 && ($row['status'] ?? '') === 'graded';
        assertStep($R2, 'STATUS persisted', $graded, 'score='.json_encode($row['score'] ?? null).' status='.json_encode($row['status'] ?? null));
    }

    call($R, 'DELETE', 'DELETE', q("/teacher/assignments/{$hwId}"), $T['teacher'], null, [200, 204]);
    $res = request('GET', q('/teacher/assignments', ['kind' => 'homework', 'search' => $MARK]), $T['teacher']);
    $remaining = count($res['json']['data'] ?? []);
    assertStep($R, 'DELETE verified gone', $remaining === 0, "remaining: {$remaining}");

    // The submission has no delete endpoint of its own — check whether it survived.
    if ($subId) {
        $res = request('GET', q("/teacher/assignments/{$hwId}/submissions"), $T['teacher']);
        assertStep($R2, 'DELETE cascade (parent removed)', in_array($res['status'], [404, 200], true), 'HTTP '.$res['status']);
    }

    // ------------------------------------------------------- 4b. workspace homework route
    // A second, older create path for the same table (TeacherWorkspaceController).
    $R = 'teacher.workspace_homework';
    $payload = [
        'title_en' => "{$MARK} Workspace Homework",
        'instructions_en' => "{$MARK} via workspace route",
        'class_section_id' => $studentSectionId ?: null,
        'subject_id' => $subjectId ?: null,
        'due_at' => $future,
        'status' => 'draft',
        'is_scored' => true,
        'max_score' => 10,
    ];
    $res = call($R, 'CREATE', 'POST', q('/teacher/homework'), $T['teacher'], $payload, [201]);
    $wsHwId = (int) ($res['json']['data']['id'] ?? 0);
    if ($wsHwId) {
        trash(\App\Domain\Learning\Models\HomeworkAssignment::class, $wsHwId);
        $res = call($R, 'READ back', 'GET', q('/teacher/assignments', ['kind' => 'homework', 'search' => $MARK]), $T['teacher'], null, [200]);
        $row = collect_find($res['json']['data'] ?? [], 'id', $wsHwId);
        assertStep($R, 'READ round-trip', $row !== null && ($row['status'] ?? '') === 'draft', $row === null ? 'not listed' : 'status=draft');

        // A learner must not be able to submit against a draft assignment.
        if ($T['student']) {
            $res = request('POST', lq("/homework/{$wsHwId}/submit"), $T['student'], ['body_text' => "{$MARK} should be blocked"]);
            step($R, 'GUARD submit to draft blocked', 'POST', lq("/homework/{$wsHwId}/submit"), $res, [403, 404, 422]);
            scanForLeak($R, 'POST', lq("/homework/{$wsHwId}/submit"), null, $res);
            if (in_array($res['status'], [200, 201], true)) {
                trash(\App\Domain\Learning\Models\AssignmentSubmission::class, (int) ($res['json']['data']['id'] ?? 0));
                defect('MEDIUM', $R, 'A student can submit homework that is still in draft status', 'POST', lq("/homework/{$wsHwId}/submit"), ['body_text' => 'x'], $res);
            }
        }

        call($R, 'DELETE', 'DELETE', q("/teacher/assignments/{$wsHwId}"), $T['teacher'], null, [200, 204]);
        $res = request('GET', q('/teacher/assignments', ['kind' => 'homework', 'search' => $MARK]), $T['teacher']);
        assertStep($R, 'DELETE verified gone', count($res['json']['data'] ?? []) === 0, '');
    }

    // ============================================================ 5. ASSIGNMENTS (kind=assignment)
    $R = 'teacher.assignments';
    $payload = [
        'title_en' => "{$MARK} Assignment",
        'instructions_en' => "{$MARK} project brief",
        'subject_id' => $subjectId ?: null,
        'class_section_id' => $sectionId ?: null,
        'due_at' => $future,
        'status' => 'draft',
        'assignment_kind' => 'assignment',
        'is_scored' => true,
        'max_score' => 50,
    ];
    $res = call($R, 'CREATE', 'POST', q('/teacher/assignments'), $T['teacher'], $payload, [201]);
    $asgId = (int) ($res['json']['data']['id'] ?? 0);
    if ($asgId) {
        trash(\App\Domain\Learning\Models\HomeworkAssignment::class, $asgId);
    }
    $res = call($R, 'READ list', 'GET', q('/teacher/assignments', ['kind' => 'assignment', 'search' => $MARK]), $T['teacher'], null, [200]);
    $row = collect_find($res['json']['data'] ?? [], 'id', $asgId);
    assertStep($R, 'READ round-trip', $row !== null && ($row['status'] ?? '') === 'draft', $row === null ? 'not listed' : 'status=draft');

    $update = $payload;
    $update['status'] = 'published';
    $update['title_en'] = "{$MARK} Assignment (updated)";
    call($R, 'STATUS draft->published', 'PUT', q("/teacher/assignments/{$asgId}"), $T['teacher'], $update, [200]);
    $res = request('GET', q('/teacher/assignments', ['kind' => 'assignment', 'search' => $MARK]), $T['teacher']);
    $row = collect_find($res['json']['data'] ?? [], 'id', $asgId);
    assertStep($R, 'STATUS persisted', ($row['status'] ?? '') === 'published' && ($row['title_en'] ?? '') === $update['title_en'], json_encode($row['status'] ?? null));

    call($R, 'DELETE', 'DELETE', q("/teacher/assignments/{$asgId}"), $T['teacher'], null, [200, 204]);
    $res = request('GET', q('/teacher/assignments', ['kind' => 'assignment', 'search' => $MARK]), $T['teacher']);
    assertStep($R, 'DELETE verified gone', count($res['json']['data'] ?? []) === 0, '');

    // ============================================================ 6. QUIZZES
    $R = 'teacher.quizzes';
    $payload = [
        'type' => 'quiz',
        'title_en' => "{$MARK} Quiz",
        'instructions_en' => "{$MARK} answer all",
        'subject_id' => $subjectId ?: null,
        'class_section_id' => $studentSectionId ?: null,
        'time_limit_seconds' => 900,
        'max_attempts' => 2,
        'available_from' => $today.'T00:00:00Z',
        'available_until' => $future,
        'shuffle_questions' => true,
        'show_results' => 'after_submit',
        'counts_toward_grade' => true,
        'status' => 'draft',
    ];
    $res = call($R, 'CREATE', 'POST', q('/teacher/assessments'), $T['teacher'], $payload, [201]);
    $quizId = (int) ($res['json']['data']['id'] ?? 0);
    if ($quizId) {
        trash(\App\Domain\Assessment\Models\Assessment::class, $quizId);
    }

    $res = call($R, 'READ list', 'GET', q('/teacher/assessments', ['type' => 'quiz', 'search' => $MARK]), $T['teacher'], null, [200]);
    $row = collect_find($res['json']['data'] ?? [], 'id', $quizId);
    assertStep($R, 'READ round-trip',
        $row !== null && ($row['title_en'] ?? '') === $payload['title_en'] && ($row['max_attempts'] ?? null) == 2 && ($row['time_limit_seconds'] ?? null) == 900,
        $row === null ? 'not listed' : 'title/attempts/limit match');

    $update = $payload;
    $update['title_en'] = "{$MARK} Quiz (updated)";
    $update['max_attempts'] = 3;
    call($R, 'UPDATE', 'PUT', q("/teacher/assessments/{$quizId}"), $T['teacher'], $update, [200]);
    $res = request('GET', q('/teacher/assessments', ['type' => 'quiz', 'search' => $MARK]), $T['teacher']);
    $row = collect_find($res['json']['data'] ?? [], 'id', $quizId);
    $persisted = $row !== null && ($row['title_en'] ?? '') === $update['title_en'] && ($row['max_attempts'] ?? null) == 3;
    assertStep($R, 'UPDATE persisted', $persisted, $persisted ? 'ok' : json_encode($row));

    $res = call($R, 'STATUS publish', 'POST', q("/teacher/assessments/{$quizId}/publish"), $T['teacher'], [], [200]);
    assertStep($R, 'STATUS = published', ($res['json']['data']['status'] ?? '') === 'published', 'status='.($res['json']['data']['status'] ?? '?'));
    $res2 = call($R, 'STATUS unpublish (toggle)', 'POST', q("/teacher/assessments/{$quizId}/publish"), $T['teacher'], [], [200]);
    assertStep($R, 'STATUS toggled back to draft', ($res2['json']['data']['status'] ?? '') === 'draft', 'status='.($res2['json']['data']['status'] ?? '?'));
    call($R, 'STATUS republish', 'POST', q("/teacher/assessments/{$quizId}/publish"), $T['teacher'], [], [200]);

    // learner attempt on the (question-less) quiz
    $R3 = 'learner.quiz_attempt';
    if ($T['student'] && $quizId) {
        $res = call($R3, 'CREATE start attempt', 'POST', lq("/assessments/{$quizId}/start"), $T['student'], ['locale' => 'en'], [201, 422]);
        $attemptId = (int) ($res['json']['data']['id'] ?? 0);
        if ($attemptId) {
            trash(\App\Domain\Assessment\Models\AssessmentAttempt::class, $attemptId);
            // The quiz has no questions, so an empty-but-present answer set is the
            // only valid shape here.
            $res = call($R3, 'STATUS submit attempt', 'POST', lq("/attempts/{$attemptId}/submit"), $T['student'],
                ['answers' => [['question_id' => 0, 'response' => []]]], [200, 422]);
            call($R3, 'READ results', 'GET', lq('/results'), $T['student'], null, [200]);

            // Another learner must not be able to submit someone else's attempt.
            if ($T['parent']) {
                $res = request('POST', lq("/attempts/{$attemptId}/submit"), $T['parent'], ['answers' => []]);
                step($R3, 'SCOPING other user attempt', 'POST', lq("/attempts/{$attemptId}/submit"), $res, [403, 404, 422]);
                if ($res['status'] === 200) {
                    defect('HIGH', $R3, "Another account can submit a student's assessment attempt", 'POST', lq("/attempts/{$attemptId}/submit"), null, $res);
                }
            }
        }
    }

    call($R, 'DELETE', 'DELETE', q("/teacher/assessments/{$quizId}"), $T['teacher'], null, [200, 204]);
    $res = request('GET', q('/teacher/assessments', ['type' => 'quiz', 'search' => $MARK]), $T['teacher']);
    $remaining = count($res['json']['data'] ?? []);
    assertStep($R, 'DELETE verified gone', $remaining === 0, "remaining: {$remaining}");

    // ============================================================ 7. EXAMS
    $R = 'teacher.exams';
    $payload = [
        'type' => 'exam',
        'title_en' => "{$MARK} Exam",
        'subject_id' => $subjectId ?: null,
        'class_section_id' => $sectionId ?: null,
        'time_limit_seconds' => 3600,
        'available_from' => $today.'T00:00:00Z',
        'available_until' => $future,
        'show_results' => 'after_due',
        'status' => 'draft',
    ];
    $res = call($R, 'CREATE', 'POST', q('/teacher/assessments'), $T['teacher'], $payload, [201]);
    $examId = (int) ($res['json']['data']['id'] ?? 0);
    if ($examId) {
        trash(\App\Domain\Assessment\Models\Assessment::class, $examId);
    }
    $res = call($R, 'READ list', 'GET', q('/teacher/assessments', ['type' => 'exam', 'search' => $MARK]), $T['teacher'], null, [200]);
    $row = collect_find($res['json']['data'] ?? [], 'id', $examId);
    assertStep($R, 'READ round-trip', $row !== null && ($row['time_limit_seconds'] ?? null) == 3600, $row === null ? 'not listed' : 'ok');

    $update = $payload;
    $update['title_en'] = "{$MARK} Exam (updated)";
    $update['time_limit_seconds'] = 5400;
    call($R, 'UPDATE', 'PUT', q("/teacher/assessments/{$examId}"), $T['teacher'], $update, [200]);
    $res = request('GET', q('/teacher/assessments', ['type' => 'exam', 'search' => $MARK]), $T['teacher']);
    $row = collect_find($res['json']['data'] ?? [], 'id', $examId);
    assertStep($R, 'UPDATE persisted', ($row['time_limit_seconds'] ?? null) == 5400 && ($row['title_en'] ?? '') === $update['title_en'], json_encode($row['time_limit_seconds'] ?? null));

    call($R, 'STATUS publish', 'POST', q("/teacher/assessments/{$examId}/publish"), $T['teacher'], [], [200]);
    call($R, 'DELETE', 'DELETE', q("/teacher/assessments/{$examId}"), $T['teacher'], null, [200, 204]);
    $res = request('GET', q('/teacher/assessments', ['type' => 'exam', 'search' => $MARK]), $T['teacher']);
    assertStep($R, 'DELETE verified gone', count($res['json']['data'] ?? []) === 0, '');

    // Validation probe: available_until before available_from must be rejected.
    $bad = $payload;
    $bad['available_from'] = $future;
    $bad['available_until'] = $today.'T00:00:00Z';
    $res = request('POST', q('/teacher/assessments'), $T['teacher'], $bad);
    step($R, 'VALIDATION until<from', 'POST', q('/teacher/assessments'), $res, [422]);
    scanForLeak($R, 'POST', q('/teacher/assessments'), $bad, $res);
    if ($res['status'] === 201) {
        trash(\App\Domain\Assessment\Models\Assessment::class, (int) ($res['json']['data']['id'] ?? 0));
    }

    // ============================================================ 8. ATTENDANCE
    $R = 'teacher.attendance';
    // Deliberately a date far outside the demo range so no curated row is overwritten.
    $attDate = '2019-09-03';
    $res = call($R, 'READ roster', 'GET', q('/teacher/attendance', ['class_section_id' => $studentSectionId, 'date' => $attDate]), $T['teacher'], null, [200]);
    $roster = $res['json']['data']['roster'] ?? [];
    $preRecorded = count(array_filter($roster, fn ($r) => ! empty($r['recorded'])));
    assertStep($R, 'baseline date is empty', $preRecorded === 0, "pre-existing marks on {$attDate}: {$preRecorded}");

    if ($roster) {
        $entries = [];
        foreach (array_slice($roster, 0, 3) as $i => $r) {
            $entries[] = [
                'student_user_id' => (int) $r['student_user_id'],
                'status' => ['present', 'absent', 'late'][$i % 3],
                'notes' => "{$MARK} mark",
            ];
        }
        $payload = [
            'class_section_id' => $studentSectionId,
            'subject_id' => $subjectId ?: null,
            'attendance_date' => $attDate,
            'entries' => $entries,
        ];
        call($R, 'CREATE marks', 'POST', q('/teacher/attendance'), $T['teacher'], $payload, [200, 201]);

        $res = request('GET', q('/teacher/attendance', ['class_section_id' => $studentSectionId, 'date' => $attDate]), $T['teacher']);
        $back = $res['json']['data']['roster'] ?? [];
        $okAll = true;
        foreach ($entries as $e) {
            $r = collect_find($back, 'student_user_id', $e['student_user_id']);
            if ($r === null || ($r['status'] ?? '') !== $e['status'] || empty($r['recorded'])) {
                $okAll = false;
            }
        }
        assertStep($R, 'READ round-trip', $okAll, $okAll ? 'all marks persisted with correct status' : 'mismatch');

        $entries[0]['status'] = 'excused';
        $payload['entries'] = $entries;
        call($R, 'UPDATE (re-mark)', 'POST', q('/teacher/attendance'), $T['teacher'], $payload, [200, 201]);
        $res = request('GET', q('/teacher/attendance', ['class_section_id' => $studentSectionId, 'date' => $attDate]), $T['teacher']);
        $back = $res['json']['data']['roster'] ?? [];
        $r = collect_find($back, 'student_user_id', $entries[0]['student_user_id']);
        assertStep($R, 'UPDATE persisted', ($r['status'] ?? '') === 'excused', 'status='.($r['status'] ?? '?'));

        $bad = $payload;
        $bad['entries'][0]['status'] = 'teleported';
        $res = request('POST', q('/teacher/attendance'), $T['teacher'], $bad);
        step($R, 'VALIDATION bad status', 'POST', q('/teacher/attendance'), $res, [422]);
        scanForLeak($R, 'POST', q('/teacher/attendance'), $bad, $res);

        assertStep($R, 'DELETE', false, 'no DELETE endpoint exists for attendance marks — cleaned up via DB');
        note("teacher.attendance: marks for section {$studentSectionId} on {$attDate} have no API delete route; removed in DB cleanup.");
        $GLOBALS['ATT_CLEANUP'] = ['section' => $studentSectionId, 'date' => $attDate];
    }

    // ============================================================ 9. TEACHER PROFILE
    $R = 'teacher.profile';
    $res = call($R, 'READ', 'GET', q('/teacher/profile'), $T['teacher'], null, [200]);
    $origUser = $res['json']['data']['user'] ?? [];
    $origPhone = $origUser['phone'] ?? null;
    $origTz = $origUser['timezone'] ?? null;

    $payload = ['phone' => "+9715{$MARK}", 'timezone' => 'Asia/Riyadh'];
    call($R, 'UPDATE', 'PUT', q('/teacher/profile'), $T['teacher'], $payload, [200]);
    $res = request('GET', q('/teacher/profile'), $T['teacher']);
    $now = $res['json']['data']['user'] ?? [];
    assertStep($R, 'UPDATE persisted', ($now['phone'] ?? '') === $payload['phone'], 'phone='.json_encode($now['phone'] ?? null));

    $res = call($R, 'RESTORE original', 'PUT', q('/teacher/profile'), $T['teacher'], ['phone' => $origPhone, 'timezone' => $origTz], [200]);
    $res = request('GET', q('/teacher/profile'), $T['teacher']);
    $now = $res['json']['data']['user'] ?? [];
    assertStep($R, 'RESTORE verified', ($now['phone'] ?? null) === $origPhone, 'phone='.json_encode($now['phone'] ?? null));
    if (($now['phone'] ?? null) !== $origPhone) {
        leftover("teacher user {$teacherId} phone left as ".json_encode($now['phone'] ?? null).' (original '.json_encode($origPhone).')');
    }

    // ============================================================ 10. TEACHER READ-ONLY VERIFICATION
    $R = 'teacher.readonly';
    call($R, 'grade book', 'GET', q('/teacher/grade-book', ['class_section_id' => $studentSectionId]), $T['teacher'], null, [200]);
    call($R, 'class progress', 'GET', q('/teacher/class-progress', ['class_section_id' => $studentSectionId]), $T['teacher'], null, [200]);
    call($R, 'course content', 'GET', q('/teacher/course-content'), $T['teacher'], null, [200]);
    call($R, 'workspace', 'GET', q('/teacher/workspace'), $T['teacher'], null, [200]);

    // Unauthenticated write must be rejected.
    $res = request('POST', q('/teacher/lesson-plans'), null, ['title_en' => "{$MARK} anon"]);
    step($R, 'AUTH anonymous write rejected', 'POST', q('/teacher/lesson-plans'), $res, [401]);
    if (in_array($res['status'], [200, 201], true)) {
        defect('CRITICAL', $R, 'Unauthenticated POST created a record', 'POST', q('/teacher/lesson-plans'), ['title_en' => 'anon'], $res);
    }

    // ============================================================ 10b. SCOPING PROBES
    $R = 'scoping';
    if ($T['school_admin']) {
        $mySections = array_map(fn ($s) => (int) $s['id'], $sections);

        // (a) Can a teacher read submissions for an assignment belonging to a class
        //     they are not assigned to? The controller only filters on school_id.
        $res = request('GET', q('/homework', ['per_page' => 100]), $T['school_admin']);
        $foreign = null;
        foreach ($res['json']['data'] ?? [] as $hw) {
            $sid = (int) ($hw['class_section_id'] ?? 0);
            if ($sid && ! in_array($sid, $mySections, true)) {
                $foreign = $hw;
                break;
            }
        }
        if ($foreign) {
            $res = request('GET', q("/teacher/assignments/{$foreign['id']}/submissions"), $T['teacher']);
            step($R, 'foreign-class assignment read', 'GET', q("/teacher/assignments/{$foreign['id']}/submissions"), $res, [403, 404]);
            if ($res['status'] === 200) {
                defect('LOW', $R, 'A teacher can read submissions for an assignment attached to a class section they are not assigned to (controller scopes by school_id only)',
                    'GET', q("/teacher/assignments/{$foreign['id']}/submissions"), null, $res);
            }
        } else {
            assertStep($R, 'foreign-class assignment read', true, 'no assignment outside this teacher\'s sections to probe with');
        }

        // (a2) Same question for the write path, proved on a record the harness owns
        //      so no curated assignment is touched.
        $res = request('GET', q('/sections', ['per_page' => 200]), $T['school_admin']);
        $probeSections = $res['json']['data'] ?? ($res['json'] ?? []);
        $foreignSectionId = 0;
        foreach ((array) $probeSections as $s) {
            $sid = (int) ($s['id'] ?? 0);
            if ($sid && ! in_array($sid, $mySections, true)) {
                $foreignSectionId = $sid;
                break;
            }
        }
        if ($foreignSectionId) {
            $payload = [
                'title_en' => "{$MARK} Foreign Section Assignment",
                'class_section_id' => $foreignSectionId,
                'status' => 'draft',
                'assignment_kind' => 'assignment',
            ];
            $res = request('POST', q('/teacher/assignments'), $T['school_admin'], $payload);
            $foreignId = (int) ($res['json']['data']['id'] ?? 0);
            if ($foreignId) {
                trash(\App\Domain\Learning\Models\HomeworkAssignment::class, $foreignId);
                $upd = $payload;
                $upd['title_en'] = "{$MARK} Foreign Section Assignment (hijacked)";
                $res = request('PUT', q("/teacher/assignments/{$foreignId}"), $T['teacher'], $upd);
                step($R, 'foreign-class assignment UPDATE', 'PUT', q("/teacher/assignments/{$foreignId}"), $res, [403, 404]);
                if ($res['status'] === 200) {
                    defect('MEDIUM', $R, 'A teacher can update an assignment belonging to a class section they are not assigned to (updateAssignment scopes by school_id only)',
                        'PUT', q("/teacher/assignments/{$foreignId}"), $upd, $res);
                }
                $res = request('DELETE', q("/teacher/assignments/{$foreignId}"), $T['teacher']);
                step($R, 'foreign-class assignment DELETE', 'DELETE', q("/teacher/assignments/{$foreignId}"), $res, [403, 404]);
                if ($res['status'] === 200) {
                    defect('MEDIUM', $R, 'A teacher can delete an assignment belonging to a class section they are not assigned to (destroyAssignment scopes by school_id only)',
                        'DELETE', q("/teacher/assignments/{$foreignId}"), null, $res);
                }
            }
        }

        // (b) Can a teacher mark attendance for a section they do not teach?
        $res = request('GET', q('/sections', ['per_page' => 200]), $T['school_admin']);
        $allSections = $res['json']['data'] ?? ($res['json'] ?? []);
        $otherSectionId = 0;
        foreach ((array) $allSections as $s) {
            $sid = (int) ($s['id'] ?? 0);
            if ($sid && ! in_array($sid, $mySections, true)) {
                $otherSectionId = $sid;
                break;
            }
        }
        if ($otherSectionId && $studentId) {
            $probeDate = '2019-09-05';
            $payload = [
                'class_section_id' => $otherSectionId,
                'attendance_date' => $probeDate,
                'entries' => [['student_user_id' => $studentId, 'status' => 'present', 'notes' => "{$MARK} scope probe"]],
            ];
            $res = request('POST', q('/teacher/attendance'), $T['teacher'], $payload);
            step($R, 'attendance for unassigned section', 'POST', q('/teacher/attendance'), $res, [403, 404, 422]);
            scanForLeak($R, 'POST', q('/teacher/attendance'), $payload, $res);
            if (in_array($res['status'], [200, 201], true)) {
                defect('MEDIUM', $R, 'A teacher can write attendance for a class section they are not assigned to, and for a student not enrolled in it (storeAttendance validates existence only)',
                    'POST', q('/teacher/attendance'), $payload, $res);
                $GLOBALS['ATT_PROBE_CLEANUP'] = ['section' => $otherSectionId, 'date' => $probeDate];
            }
        } else {
            assertStep($R, 'attendance for unassigned section', true, 'no unassigned section available to probe with');
        }
    }

    // ============================================================ 11. TUTOR
    $R = 'tutor.profile';
    $tutorProfileId = 0;
    $tutorSubjectId = 0;
    if ($T['tutor']) {
        $res = call($R, 'READ', 'GET', q('/teacher/profile'), $T['tutor'], null, [200]);
        $tutorProfileId = (int) ($res['json']['data']['tutor_profile']['id'] ?? 0);
        $tutorSubjectId = (int) ($res['json']['data']['tutor_profile']['subjects'][0]['id'] ?? 0);
        $tOrigBio = $res['json']['data']['tutor_profile']['bio_en'] ?? null;
        $tOrigPhone = $res['json']['data']['user']['phone'] ?? null;

        $payload = ['phone' => "+9716{$MARK}", 'bio_en' => "{$MARK} bio"];
        call($R, 'UPDATE', 'PUT', q('/teacher/profile'), $T['tutor'], $payload, [200]);
        $res = request('GET', q('/teacher/profile'), $T['tutor']);
        $ok = ($res['json']['data']['user']['phone'] ?? '') === $payload['phone']
            && ($res['json']['data']['tutor_profile']['bio_en'] ?? '') === $payload['bio_en'];
        assertStep($R, 'UPDATE persisted', $ok, 'phone/bio');
        call($R, 'RESTORE original', 'PUT', q('/teacher/profile'), $T['tutor'], ['phone' => $tOrigPhone, 'bio_en' => $tOrigBio], [200]);
        $res = request('GET', q('/teacher/profile'), $T['tutor']);
        $restored = ($res['json']['data']['user']['phone'] ?? null) === $tOrigPhone
            && ($res['json']['data']['tutor_profile']['bio_en'] ?? null) === $tOrigBio;
        assertStep($R, 'RESTORE verified', $restored, '');
        if (! $restored) {
            leftover("tutor user {$tutorId} profile not fully restored");
        }
    }

    // ---- availability
    $R = 'tutor.availability';
    if ($T['tutor'] && $tutorProfileId) {
        $payload = ['weekday' => 6, 'start_time' => '21:00', 'end_time' => '22:00', 'slot_minutes' => 30];
        $res = call($R, 'CREATE (workspace route)', 'POST', q('/teacher/availability'), $T['tutor'], $payload, [201]);
        $availId = (int) ($res['json']['data']['id'] ?? 0);
        if ($availId) {
            trash(\App\Domain\Tutoring\Models\TutorAvailability::class, $availId);
        }

        $res = call($R, 'READ back', 'GET', q("/tutors/{$tutorProfileId}/availability"), $T['tutor'], null, [200, 403]);
        if ($res['status'] === 200) {
            $row = collect_find($res['json']['data']['weekly'] ?? [], 'id', $availId);
            assertStep($R, 'READ round-trip', $row !== null && (int) ($row['weekday'] ?? -1) === 6, $row === null ? 'not listed' : 'weekday=6');
        }

        $payload2 = ['exception_date' => '2019-09-04', 'is_available' => false, 'reason' => "{$MARK} unavailable"];
        $res = call($R, 'CREATE exception', 'POST', q("/tutors/{$tutorProfileId}/availability/exceptions"), $T['tutor'], $payload2, [201, 403]);
        if ($res['status'] === 201) {
            trash(\App\Domain\Tutoring\Models\TutorAvailabilityException::class, (int) ($res['json']['data']['id'] ?? 0));
        }

        $bad = ['weekday' => 6, 'start_time' => '22:00', 'end_time' => '21:00'];
        $res = request('POST', q('/teacher/availability'), $T['tutor'], $bad);
        step($R, 'VALIDATION end<start', 'POST', q('/teacher/availability'), $res, [422]);
        scanForLeak($R, 'POST', q('/teacher/availability'), $bad, $res);
        if ($res['status'] === 201) {
            trash(\App\Domain\Tutoring\Models\TutorAvailability::class, (int) ($res['json']['data']['id'] ?? 0));
            defect('MEDIUM', $R, 'Availability slot with end_time before start_time was accepted', 'POST', q('/teacher/availability'), $bad, $res);
        }

        assertStep($R, 'DELETE', false, 'no DELETE endpoint for availability slots/exceptions — cleaned up via DB');
    }

    // ---- tutoring sessions
    $R = 'tutor.sessions';
    $sessionId = 0;
    if ($T['tutor'] && $tutorProfileId && $studentId) {
        // The booking service rejects subjects the tutor does not teach, so use one of theirs.
        $payload = [
            'tutor_profile_id' => $tutorProfileId,
            'subject_id' => ($tutorSubjectId ?: $subjectId),
            'language' => 'en',
            'session_type' => 'one_to_one',
            'starts_at' => $soon,
            'duration_minutes' => 60,
            'student_user_ids' => [$studentId],
        ];
        $res = call($R, 'CREATE (book)', 'POST', q('/tutoring-sessions'), $T['tutor'], $payload, [201, 403, 422]);
        $sessionId = (int) ($res['json']['data']['id'] ?? 0);

        // Fall back to the school admin if the tutor is not allowed to book.
        if (! $sessionId && $T['school_admin']) {
            $res = call($R, 'CREATE (book as admin)', 'POST', q('/tutoring-sessions'), $T['school_admin'], $payload, [201, 403, 422]);
            $sessionId = (int) ($res['json']['data']['id'] ?? 0);
        }

        if ($sessionId) {
            trash(\App\Domain\Tutoring\Models\TutoringSession::class, $sessionId);
            $tok = $T['tutor'];
            $res = call($R, 'READ back', 'GET', q("/tutoring-sessions/{$sessionId}"), $tok, null, [200, 403]);
            if ($res['status'] === 200) {
                $d = $res['json']['data'] ?? [];
                assertStep($R, 'READ round-trip', (int) ($d['tutor_profile_id'] ?? 0) === $tutorProfileId && ($d['language'] ?? '') === 'en', 'tutor/language match');
            }

            $res = call($R, 'STATUS notes', 'POST', q("/tutoring-sessions/{$sessionId}/notes"), $tok, ['notes' => "{$MARK} session note", 'follow_up' => 'revise ch.3'], [200, 201, 403]);
            if (in_array($res['status'], [200, 201], true)) {
                trash(\App\Domain\Tutoring\Models\SessionNote::class, (int) ($res['json']['data']['id'] ?? 0));
            }

            $res = call($R, 'STATUS mark attendance', 'POST', q("/tutoring-sessions/{$sessionId}/attendance"), $tok, ['student_user_id' => $studentId, 'status' => 'present', 'notes' => "{$MARK}"], [200, 201, 403]);
            if (in_array($res['status'], [200, 201], true)) {
                trash(\App\Domain\Tutoring\Models\TutoringAttendance::class, (int) ($res['json']['data']['id'] ?? 0));
            }

            // Portal-specific note endpoint (updateOrCreate keyed on session+tutor).
            $res = call('tutor.session_notes', 'CREATE via portal', 'POST', q('/teacher/session-notes'), $tok, [
                'tutoring_session_id' => $sessionId, 'notes' => "{$MARK} portal note", 'visible_to_parent' => true,
            ], [201, 403, 422]);
            if ($res['status'] === 201) {
                trash(\App\Domain\Tutoring\Models\SessionNote::class, (int) ($res['json']['data']['id'] ?? 0));
                $res2 = call('tutor.session_notes', 'READ back', 'GET', q('/teacher/session-notes'), $tok, null, [200, 422]);
                if ($res2['status'] === 200) {
                    $found = null;
                    foreach ($res2['json']['data'] ?? [] as $n) {
                        if (str_contains((string) ($n['notes'] ?? ''), $MARK)) {
                            $found = $n;
                        }
                    }
                    assertStep('tutor.session_notes', 'READ round-trip', $found !== null, $found ? 'note listed' : 'not listed');
                }
                $res3 = call('tutor.session_notes', 'UPDATE (upsert)', 'POST', q('/teacher/session-notes'), $tok, [
                    'tutoring_session_id' => $sessionId, 'notes' => "{$MARK} portal note v2",
                ], [201]);
                $res4 = request('GET', q('/teacher/session-notes'), $tok);
                $hit = false;
                foreach ($res4['json']['data'] ?? [] as $n) {
                    if (($n['notes'] ?? '') === "{$MARK} portal note v2") {
                        $hit = true;
                    }
                }
                assertStep('tutor.session_notes', 'UPDATE persisted', $hit, '');
                assertStep('tutor.session_notes', 'DELETE', false, 'no DELETE endpoint for session notes — cleaned up via DB');
            }

            // student rates the session
            if ($T['student']) {
                $res = call('learner.session_rating', 'CREATE rate', 'POST', lq("/tutoring/sessions/{$sessionId}/rate"), $T['student'], ['rating' => 5, 'feedback' => "{$MARK} great"], [201, 403, 404, 422]);
                if ($res['status'] === 201) {
                    trash(\App\Domain\Tutoring\Models\TutoringSessionRating::class, (int) ($res['json']['data']['id'] ?? 0));
                }
                call('learner.session_rating', 'READ my sessions', 'GET', lq('/tutoring/sessions'), $T['student'], null, [200]);
            }

            $res = call($R, 'STATUS cancel', 'POST', q("/tutoring-sessions/{$sessionId}/cancel"), $T['school_admin'] ?: $tok, ['reason' => "{$MARK} qa cleanup"], [200, 403]);
            if ($res['status'] === 200) {
                assertStep($R, 'STATUS persisted', ($res['json']['data']['status'] ?? '') === 'cancelled', 'status='.($res['json']['data']['status'] ?? '?'));
            }
            assertStep($R, 'DELETE', false, 'no DELETE endpoint for tutoring sessions — cleaned up via DB');
        }
    }

    $R = 'tutor.readonly';
    if ($T['tutor']) {
        call($R, 'students', 'GET', q('/teacher/students'), $T['tutor'], null, [200, 422]);
        call($R, 'earnings', 'GET', q('/teacher/earnings'), $T['tutor'], null, [200, 422]);
        $res = call($R, 'notifications', 'GET', q('/teacher/notifications'), $T['tutor'], null, [200]);
        // Re-marking an already-read notification is idempotent, so it exercises the
        // endpoint without changing any curated demo state.
        $alreadyRead = null;
        foreach ($res['json']['data'] ?? [] as $n) {
            if (($n['read_at'] ?? null) !== null) {
                $alreadyRead = $n['id'];
                break;
            }
        }
        if ($alreadyRead !== null) {
            call($R, 'STATUS mark read (idempotent)', 'POST', q("/teacher/notifications/{$alreadyRead}/read"), $T['tutor'], [], [200]);
        } else {
            assertStep($R, 'STATUS mark read (idempotent)', true, 'skipped — no already-read notification available');
        }
        call($R, 'student-progress (missing param)', 'GET', q('/teacher/student-progress'), $T['tutor'], null, [422]);
    }

    // ============================================================ 12. STUDENT PORTAL
    $R = 'student.profile';
    if ($T['student']) {
        $res = call($R, 'READ dashboard', 'GET', lq('/student/dashboard'), $T['student'], null, [200]);
        $me = request('GET', q('/auth/me', [], 'raw'), $T['student']);
        $origSPhone = $me['json']['data']['user']['phone'] ?? ($me['json']['data']['phone'] ?? null);

        $payload = ['phone' => "+9717{$MARK}", 'locale' => 'en'];
        $res = call($R, 'UPDATE', 'PUT', lq('/student/profile'), $T['student'], $payload, [200]);
        assertStep($R, 'UPDATE persisted', ($res['json']['data']['phone'] ?? '') === $payload['phone'], 'phone='.json_encode($res['json']['data']['phone'] ?? null));
        $res = call($R, 'RESTORE original', 'PUT', lq('/student/profile'), $T['student'], ['phone' => $origSPhone], [200]);
        $restored = ($res['json']['data']['phone'] ?? null) === $origSPhone;
        assertStep($R, 'RESTORE verified', $restored, 'phone='.json_encode($res['json']['data']['phone'] ?? null));
        if (! $restored) {
            leftover("student user {$studentId} phone left as ".json_encode($res['json']['data']['phone'] ?? null));
        }

        $R = 'student.messages';
        $payload = ['subject' => "{$MARK} Student Message", 'body' => "{$MARK} please help"];
        $res = call($R, 'CREATE', 'POST', lq('/student/messages'), $T['student'], $payload, [201]);
        $smId = (int) ($res['json']['data']['id'] ?? 0);
        if ($smId) {
            trash(\App\Domain\Learning\Models\LearnerMessage::class, $smId);
        }
        $res = call($R, 'READ list', 'GET', lq('/student/messages'), $T['student'], null, [200]);
        $row = collect_find($res['json']['data'] ?? [], 'id', $smId);
        assertStep($R, 'READ round-trip', $row !== null && ($row['subject'] ?? '') === $payload['subject'], $row === null ? 'not listed' : 'subject matches');
        $res = call($R, 'STATUS mark read', 'POST', lq("/student/messages/{$smId}/read"), $T['student'], [], [200]);
        assertStep($R, 'STATUS persisted', ($res['json']['data']['read_at'] ?? null) !== null, 'read_at='.json_encode($res['json']['data']['read_at'] ?? null));
        assertStep($R, 'UPDATE', false, 'no update endpoint (by design)');
        assertStep($R, 'DELETE', false, 'no DELETE endpoint for learner messages — cleaned up via DB');

        $bad = ['subject' => ''];
        $res = request('POST', lq('/student/messages'), $T['student'], $bad);
        step($R, 'VALIDATION empty subject', 'POST', lq('/student/messages'), $res, [422]);
        scanForLeak($R, 'POST', lq('/student/messages'), $bad, $res);
    }

    // ============================================================ 13. PARENT PORTAL
    $R = 'parent.profile';
    if ($T['parent']) {
        call($R, 'READ dashboard', 'GET', lq('/parent/dashboard'), $T['parent'], null, [200]);
        $res = request('GET', q('/auth/me', [], 'raw'), $T['parent']);
        $origPPhone = $res['json']['data']['user']['phone'] ?? ($res['json']['data']['phone'] ?? null);

        $payload = ['phone' => "+9718{$MARK}"];
        $res = call($R, 'UPDATE', 'PUT', lq('/parent/profile'), $T['parent'], $payload, [200]);
        assertStep($R, 'UPDATE persisted', ($res['json']['data']['phone'] ?? '') === $payload['phone'], 'phone='.json_encode($res['json']['data']['phone'] ?? null));
        $res = call($R, 'RESTORE original', 'PUT', lq('/parent/profile'), $T['parent'], ['phone' => $origPPhone], [200]);
        $restored = ($res['json']['data']['phone'] ?? null) === $origPPhone;
        assertStep($R, 'RESTORE verified', $restored, '');
        if (! $restored) {
            leftover("parent user {$parentId} phone left as ".json_encode($res['json']['data']['phone'] ?? null));
        }

        $R = 'parent.messages';
        $payload = ['subject' => "{$MARK} Parent Message", 'body' => "{$MARK} question about homework"];
        $res = call($R, 'CREATE', 'POST', lq('/parent/messages'), $T['parent'], $payload, [201]);
        $pmId = (int) ($res['json']['data']['id'] ?? 0);
        if ($pmId) {
            trash(\App\Domain\Learning\Models\LearnerMessage::class, $pmId);
        }
        $res = call($R, 'READ list', 'GET', lq('/parent/messages'), $T['parent'], null, [200]);
        $row = collect_find($res['json']['data'] ?? [], 'id', $pmId);
        assertStep($R, 'READ round-trip', $row !== null && ($row['subject'] ?? '') === $payload['subject'], $row === null ? 'not listed' : 'subject matches');
        $res = call($R, 'STATUS mark read', 'POST', lq("/parent/messages/{$pmId}/read"), $T['parent'], [], [200]);
        assertStep($R, 'STATUS persisted', ($res['json']['data']['read_at'] ?? null) !== null, '');
        assertStep($R, 'DELETE', false, 'no DELETE endpoint for learner messages — cleaned up via DB');

        // Cross-account scoping: the student must not be able to read the parent's message.
        if ($T['student'] && $pmId) {
            $res = request('POST', lq("/student/messages/{$pmId}/read"), $T['student'], []);
            step($R, 'SCOPING other user message', 'POST', lq("/student/messages/{$pmId}/read"), $res, [403, 404]);
            if ($res['status'] === 200) {
                defect('HIGH', $R, "A student can mark another user's message as read", 'POST', lq("/student/messages/{$pmId}/read"), null, $res);
            }
        }
    }

    // ============================================================ 14. BILLING (school staff)
    $R = 'billing.invoices';
    $billTok = $T['school_owner'] ?: $T['school_admin'];
    if ($billTok) {
        // RBAC probe first: a plain teacher must not be able to create invoices.
        $res = request('POST', q('/billing/invoices'), $T['teacher'], ['notes' => "{$MARK}"]);
        step($R, 'RBAC teacher blocked', 'POST', q('/billing/invoices'), $res, [403]);

        $payload = [
            'currency' => 'SAR',
            'due_at' => $future,
            'notes' => "{$MARK} school invoice",
            'items' => [['description' => "{$MARK} item", 'quantity' => 2, 'unit_price' => 50]],
        ];
        $res = call($R, 'CREATE', 'POST', q('/billing/invoices'), $billTok, $payload, [201, 403]);
        $invId = (int) ($res['json']['data']['id'] ?? 0);
        if ($invId) {
            trash(\App\Domain\Billing\Models\Invoice::class, $invId);
            $res = call($R, 'READ list', 'GET', q('/billing/invoices', ['per_page' => 50]), $billTok, null, [200]);
            $row = collect_find($res['json']['data'] ?? [], 'id', $invId);
            assertStep($R, 'READ round-trip', $row !== null && (float) ($row['total'] ?? 0) > 0, $row === null ? 'not listed' : 'total='.($row['total'] ?? '?'));

            $res = call($R, 'STATUS send', 'POST', q("/billing/invoices/{$invId}/send"), $billTok, [], [200, 403, 422]);
            $res = call($R, 'STATUS pay', 'POST', q("/billing/invoices/{$invId}/payments"), $billTok, ['amount' => 100, 'method' => 'manual', 'reference' => "{$MARK}"], [200, 201, 403, 422]);
            if (in_array($res['status'], [200, 201], true)) {
                trash(\App\Domain\Billing\Models\Payment::class, (int) ($res['json']['data']['id'] ?? 0));
            }
            $res = request('GET', q('/billing/invoices', ['per_page' => 50]), $billTok);
            $row = collect_find($res['json']['data'] ?? [], 'id', $invId);
            assertStep($R, 'STATUS persisted', in_array((string) ($row['status'] ?? ''), ['paid', 'partially_paid', 'sent', 'issued'], true), 'status='.($row['status'] ?? '?'));
            assertStep($R, 'DELETE', false, 'no DELETE endpoint for invoices — cleaned up via DB');
        }

        $R = 'billing.student_invoices';
        $payload = [
            'student_user_id' => $studentId,
            'currency' => 'SAR',
            'due_at' => $future,
            'notes' => "{$MARK} student invoice",
            'items' => [['description' => "{$MARK} tuition", 'quantity' => 1, 'unit_price' => 75]],
        ];
        $res = call($R, 'CREATE', 'POST', q('/billing/student-invoices'), $billTok, $payload, [201, 403]);
        $sInvId = (int) ($res['json']['data']['id'] ?? 0);
        if ($sInvId) {
            trash(\App\Domain\Billing\Models\StudentInvoice::class, $sInvId);
            $res = call($R, 'READ list', 'GET', q('/billing/student-invoices', ['per_page' => 50]), $billTok, null, [200]);
            $row = collect_find($res['json']['data'] ?? [], 'id', $sInvId);
            assertStep($R, 'READ round-trip', $row !== null, $row === null ? 'not listed' : 'total='.($row['total'] ?? '?'));
            assertStep($R, 'UPDATE', false, 'no update endpoint (by design)');
            assertStep($R, 'DELETE', false, 'no DELETE endpoint — cleaned up via DB');
        }

        $R = 'billing.tutor_payments';
        if ($tutorProfileId) {
            $payload = [
                'tutor_profile_id' => $tutorProfileId,
                'amount' => 123.45,
                'currency' => 'SAR',
                'period_start' => $today,
                'period_end' => $today,
                'notes' => "{$MARK} tutor payment",
            ];
            $res = call($R, 'CREATE', 'POST', q('/billing/tutor-payments'), $billTok, $payload, [201, 403]);
            $tpId = (int) ($res['json']['data']['id'] ?? 0);
            if ($tpId) {
                trash(\App\Domain\Billing\Models\TutorPayment::class, $tpId);
                $res = call($R, 'READ list', 'GET', q('/billing/tutor-payments', ['per_page' => 50]), $billTok, null, [200]);
                $row = collect_find($res['json']['data'] ?? [], 'id', $tpId);
                assertStep($R, 'READ round-trip', $row !== null && (float) ($row['amount'] ?? 0) === 123.45, $row === null ? 'not listed' : 'amount ok');
                $res = call($R, 'STATUS mark paid', 'POST', q("/billing/tutor-payments/{$tpId}/mark-paid"), $billTok, ['reference' => "{$MARK}"], [200, 403, 422]);
                if ($res['status'] === 200) {
                    assertStep($R, 'STATUS persisted', ($res['json']['data']['status'] ?? '') === 'paid', 'status='.($res['json']['data']['status'] ?? '?'));
                }
                assertStep($R, 'DELETE', false, 'no DELETE endpoint — cleaned up via DB');
            }
        }
    }

} catch (\Throwable $e) {
    echo "\n!! Harness exception: ".$e->getMessage().' @ '.$e->getFile().':'.$e->getLine()."\n";
}

// ---------------------------------------------------------------- helpers used above

function collect_find(array $rows, string $key, $value): ?array
{
    foreach ($rows as $r) {
        if (is_array($r) && isset($r[$key]) && (string) $r[$key] === (string) $value) {
            return $r;
        }
    }

    return null;
}

// ---------------------------------------------------------------- report

echo "\n";
echo str_repeat('=', 100)."\n";
echo "CRUD LIFECYCLE RESULTS (marker {$MARK})\n";
echo str_repeat('=', 100)."\n";
$totals = ['pass' => 0, 'fail' => 0];
foreach ($RESULTS as $resource => $steps) {
    echo "\n### {$resource}\n";
    foreach ($steps as $s) {
        $flag = $s['ok'] ? 'PASS' : 'FAIL';
        $totals[$s['ok'] ? 'pass' : 'fail']++;
        printf("  %-32s %-6s %-4s %-4s %s\n", $s['step'], $s['method'], $s['status'] ?: '-', $flag,
            mb_substr((string) $s['detail'], 0, 90));
    }
}
printf("\nTotals: %d pass / %d fail\n", $totals['pass'], $totals['fail']);

echo "\n".str_repeat('=', 100)."\n";
echo 'DEFECT CANDIDATES ('.count($DEFECTS).")\n";
echo str_repeat('=', 100)."\n";
foreach ($DEFECTS as $i => $d) {
    printf("\n[%d] %s %s — %s\n    %s %s\n    payload: %s\n    HTTP %s: %s\n",
        $i + 1, $d['severity'], $d['resource'], $d['summary'], $d['method'], $d['url'],
        json_encode($d['payload']), (string) $d['status'], str_replace("\n", ' ', (string) $d['response']));
}

// ---------------------------------------------------------------- cleanup

echo "\n".str_repeat('=', 100)."\n";
echo "CLEANUP\n";
echo str_repeat('=', 100)."\n";

if (! $DB_CLEANUP) {
    echo "Skipped (--no-db-cleanup).\n";
    foreach ($DB_TRASH as $model => $ids) {
        leftover($model.': '.implode(',', array_unique($ids)));
    }
} else {
    require __DIR__.'/vendor/autoload.php';
    $app = require __DIR__.'/bootstrap/app.php';
    $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
    $db = $app->make(Illuminate\Database\DatabaseManager::class);

    $tableFor = function (string $model) {
        return (new $model)->getTable();
    };

    // Attendance rows created by the harness (no API delete route).
    foreach (['ATT_CLEANUP', 'ATT_PROBE_CLEANUP'] as $key) {
        if (! isset($GLOBALS[$key])) {
            continue;
        }
        $c = $GLOBALS[$key];
        $n = $db->table('class_attendance')
            ->where('class_section_id', $c['section'])
            ->whereDate('attendance_date', $c['date'])
            ->delete();
        printf("  %-52s removed %d\n", 'class_attendance ('.$c['date'].')', $n);
    }

    foreach ($DB_TRASH as $model => $ids) {
        $ids = array_values(array_unique(array_filter($ids)));
        if (! $ids) {
            continue;
        }
        try {
            $table = $tableFor($model);
            // Remove dependents first where a foreign key would block the delete.
            if ($table === 'tutoring_sessions') {
                $db->table('tutoring_session_participants')->whereIn('tutoring_session_id', $ids)->delete();
                $db->table('session_notes')->whereIn('tutoring_session_id', $ids)->delete();
                $db->table('tutoring_attendance')->whereIn('tutoring_session_id', $ids)->delete();
                $db->table('tutoring_session_ratings')->whereIn('tutoring_session_id', $ids)->delete();
            }
            if ($table === 'invoices') {
                $db->table('invoice_items')->whereIn('invoice_id', $ids)->delete();
                $db->table('payments')->whereIn('invoice_id', $ids)->delete();
            }
            if ($table === 'student_invoices') {
                $db->table('student_invoice_items')->whereIn('student_invoice_id', $ids)->delete();
            }
            if ($table === 'assignments') {
                $db->table('assignment_submissions')->whereIn('assignment_id', $ids)->delete();
            }
            if ($table === 'assessments') {
                $attemptIds = $db->table('assessment_attempts')->whereIn('assessment_id', $ids)->pluck('id')->all();
                if ($attemptIds) {
                    $db->table('assessment_responses')->whereIn('attempt_id', $attemptIds)->delete();
                }
                $db->table('assessment_attempts')->whereIn('assessment_id', $ids)->delete();
                $db->table('assessment_questions')->whereIn('assessment_id', $ids)->delete();
            }
            $db->table($table)->whereIn('id', $ids)->delete();
            // Some rows are already gone via a parent cascade above, so verify by
            // existence rather than by the number of rows this statement touched.
            $still = $db->table($table)->whereIn('id', $ids)->pluck('id')->all();
            printf("  %-52s %d ids, %d still present\n", $table, count($ids), count($still));
            if ($still) {
                leftover($table.' ids '.implode(',', $still).' could not be deleted');
            }
        } catch (\Throwable $e) {
            printf("  %-52s ERROR %s\n", $model, $e->getMessage());
            leftover($model.' ids '.implode(',', $ids).' — cleanup failed: '.$e->getMessage());
        }
    }

    foreach ($DB_RESTORE as $r) {
        try {
            $db->table($tableFor($r['model']))->where('id', $r['id'])->update([$r['column'] => $r['value']]);
        } catch (\Throwable $e) {
            leftover($r['model'].' id '.$r['id'].' '.$r['column'].' not restored: '.$e->getMessage());
        }
    }
    if ($DB_RESTORE) {
        printf("  %-52s restored %d\n", 'read_at on pre-existing demo rows', count($DB_RESTORE));
    }

    // Verification sweep. Matches the ZZQA prefix rather than this run's marker so
    // leftovers from an earlier aborted run are picked up too — nothing outside this
    // harness ever writes that prefix.
    $sweepMark = 'ZZQA';
    $sweep = [
        'assignment_submissions' => 'body_text',
        'tutoring_session_ratings' => 'feedback',
        'session_notes' => 'notes',
        'tutoring_attendance' => 'notes',
        'tutoring_sessions' => 'cancel_reason',
        'class_attendance' => 'notes',
        'tutor_availability_exceptions' => 'reason',
        'lesson_plans' => 'title_en',
        'media_assets' => 'title_en',
        'staff_messages' => 'subject',
        'assignments' => 'title_en',
        'assessments' => 'title_en',
        'learner_messages' => 'subject',
        'invoices' => 'notes',
        'student_invoices' => 'notes',
        'tutor_payments' => 'notes',
    ];
    echo "\n  marker sweep:\n";
    foreach ($sweep as $table => $column) {
        try {
            $rows = $db->table($table)->where($column, 'like', "%{$sweepMark}%")->pluck('id')->all();
            if (! $rows) {
                printf("    %-28s clean\n", $table);

                continue;
            }
            // Second pass: anything the id-based cleanup missed gets removed by marker.
            if ($table === 'assessments') {
                $attemptIds = $db->table('assessment_attempts')->whereIn('assessment_id', $rows)->pluck('id')->all();
                if ($attemptIds) {
                    $db->table('assessment_responses')->whereIn('attempt_id', $attemptIds)->delete();
                }
                $db->table('assessment_attempts')->whereIn('assessment_id', $rows)->delete();
                $db->table('assessment_questions')->whereIn('assessment_id', $rows)->delete();
            }
            if ($table === 'assignments') {
                $db->table('assignment_submissions')->whereIn('assignment_id', $rows)->delete();
            }
            if ($table === 'tutoring_sessions') {
                $db->table('tutoring_session_participants')->whereIn('tutoring_session_id', $rows)->delete();
                $db->table('session_notes')->whereIn('tutoring_session_id', $rows)->delete();
                $db->table('tutoring_attendance')->whereIn('tutoring_session_id', $rows)->delete();
                $db->table('tutoring_session_ratings')->whereIn('tutoring_session_id', $rows)->delete();
            }
            $db->table($table)->whereIn('id', $rows)->delete();
            $still = $db->table($table)->where($column, 'like', "%{$sweepMark}%")->pluck('id')->all();
            if ($still) {
                printf("    %-28s LEFTOVER ids: %s\n", $table, implode(',', $still));
                leftover($table.' ids '.implode(',', $still).' still carry the marker');
            } else {
                printf("    %-28s cleaned on second pass (ids %s)\n", $table, implode(',', $rows));
            }
        } catch (\Throwable $e) {
            printf("    %-28s skipped (%s)\n", $table, $e->getMessage());
        }
    }
}

echo "\nNOTES\n";
foreach ($NOTES as $n) {
    echo '  - '.$n."\n";
}
echo "\nLEFTOVERS (".count($LEFTOVERS).")\n";
foreach ($LEFTOVERS as $l) {
    echo '  - '.$l."\n";
}

$out = __DIR__.'/qa_crud_results.json';
file_put_contents($out, json_encode([
    'marker' => $MARK,
    'results' => $RESULTS,
    'defects' => $DEFECTS,
    'notes' => $NOTES,
    'leftovers' => $LEFTOVERS,
    'totals' => $totals,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
echo "\nWrote {$out}\n";
