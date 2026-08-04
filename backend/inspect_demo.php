<?php

use Illuminate\Support\Facades\DB;

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

foreach (['assignments', 'lesson_plans', 'media_assets', 'assessments'] as $table) {
    echo "== {$table}\n";
    foreach (DB::select("SHOW COLUMNS FROM {$table} LIKE 'title_ar'") as $c) {
        echo "   title_ar null={$c->Null} default=".var_export($c->Default, true)."\n";
    }
}

echo "\nmedia_assets sample:\n";
foreach (DB::table('media_assets')->limit(4)->get() as $m) {
    echo '  '.json_encode($m)."\n";
}
