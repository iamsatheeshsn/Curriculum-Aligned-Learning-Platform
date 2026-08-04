<?php

use App\Domain\Assessment\Models\Assessment;
use App\Domain\Learning\Models\HomeworkAssignment;
use App\Domain\Learning\Models\LessonPlan;
use Illuminate\Support\Facades\DB;

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

DB::statement('SET FOREIGN_KEY_CHECKS=0');

LessonPlan::query()->forceDelete();

$assignmentIds = HomeworkAssignment::query()->pluck('id')->all();
DB::table('assignment_submissions')->whereIn('assignment_id', $assignmentIds)->delete();
DB::table('assignments')->delete();

$assessmentIds = Assessment::query()->pluck('id')->all();
DB::table('assessment_attempts')->whereIn('assessment_id', $assessmentIds)->delete();
DB::table('assessment_questions')->whereIn('assessment_id', $assessmentIds)->delete();
DB::table('assessments')->delete();

DB::statement('SET FOREIGN_KEY_CHECKS=1');

echo "Cleared lesson plans, homework/assignments, assessments.\n";
