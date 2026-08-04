<?php

use App\Domain\Identity\Services\RbacService;
use App\Models\User;

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$rbac = app(RbacService::class);
$auth = app(App\Domain\Identity\Services\AuthService::class);

$users = User::query()->orderBy('id')->get();
$byRole = [];
foreach ($users as $u) {
    $codes = $auth->roleCodesForUser($u);
    sort($codes);
    $key = implode('+', $codes) ?: '(none)';
    $byRole[$key][] = $u->email;
}

ksort($byRole);
foreach ($byRole as $key => $emails) {
    printf("%-24s n=%-4d e.g. %s\n", $key, count($emails), implode(', ', array_slice($emails, 0, 3)));
}
