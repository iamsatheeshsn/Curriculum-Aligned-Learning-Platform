<?php

use App\Domain\Identity\Services\RbacService;
use App\Models\User;

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$rbac = app(RbacService::class);
$emails = [
    'superadmin@learning-platform.local',
    'support@platform.test',
    'auditor@platform.test',
    'owner@alnoor.test',
];

foreach ($emails as $email) {
    $u = User::query()->where('email', $email)->first();
    if (! $u) {
        echo "$email MISSING\n";
        continue;
    }
    $perms = $rbac->permissionsFor($u, $u->tenant_id);
    printf(
        "%-40s tenant_id=%-6s perms=%s\n",
        $email,
        var_export($u->tenant_id, true),
        is_array($perms) ? count($perms) : (string) $perms
    );
    foreach (['platform.tenants.manage', 'platform.audit.view', 'audit.logs.view', 'platform.plans.manage'] as $p) {
        printf("    %-28s %s\n", $p, $rbac->can($u, $p) ? 'yes' : 'no');
    }
}
