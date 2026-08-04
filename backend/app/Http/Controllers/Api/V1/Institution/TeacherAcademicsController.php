<?php

namespace App\Http\Controllers\Api\V1\Institution;

use App\Domain\Academics\Models\ClassAttendance;
use App\Domain\Academics\Services\SchoolContextService;
use App\Domain\Assessment\Models\Assessment;
use App\Domain\Assessment\Models\AssessmentAttempt;
use App\Domain\Identity\Services\RbacService;
use App\Domain\Learning\Models\AssignmentSubmission;
use App\Domain\Learning\Models\HomeworkAssignment;
use App\Domain\Learning\Models\LearningProgress;
use App\Http\Controllers\Api\V1\Institution\Concerns\ResolvesTeacherContext;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class TeacherAcademicsController extends Controller
{
    use ResolvesTeacherContext;

    private const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused'];

    public function __construct(
        protected SchoolContextService $schoolContext,
        protected RbacService $rbac,
    ) {}

    // ------------------------------------------------------------------
    // Homework & assignments (shared `assignments` table, split by kind)
    // ------------------------------------------------------------------

    public function assignments(Request $request): JsonResponse
    {
        $this->guardTeacher($request);
        $school = $this->teacherSchool($request);
        $kind = $request->string('kind')->toString() ?: 'homework';

        // Only the teacher's own classes, so every row resolves against the class filter.
        $ownSectionIds = $this->teacherSectionIds($request, $school);

        $query = HomeworkAssignment::query()
            ->where('school_id', $school->id)
            ->where('assignment_kind', $kind)
            ->whereIn('class_section_id', $ownSectionIds ?: [0])
            ->withCount('submissions')
            ->with('subject:id,code,name_en');

        if ($status = $request->string('status')->toString()) {
            $query->where('status', $status);
        }
        if ($sectionId = $request->integer('class_section_id')) {
            $query->where('class_section_id', $sectionId);
        }
        if ($subjectId = $request->integer('subject_id')) {
            $query->where('subject_id', $subjectId);
        }
        if ($search = trim($request->string('search')->toString())) {
            $query->where('title_en', 'like', "%{$search}%");
        }

        $rows = $query->orderByRaw('due_at IS NULL')
            ->orderByDesc('due_at')
            ->orderByDesc('id')
            ->limit(500)
            ->get();

        $ids = $rows->pluck('id')->all();
        $graded = AssignmentSubmission::query()
            ->whereIn('assignment_id', $ids ?: [0])
            ->whereNotNull('score')
            ->selectRaw('assignment_id, COUNT(*) as aggregate')
            ->groupBy('assignment_id')
            ->pluck('aggregate', 'assignment_id');

        $all = HomeworkAssignment::query()
            ->where('school_id', $school->id)
            ->where('assignment_kind', $kind)
            ->whereIn('class_section_id', $ownSectionIds ?: [0])
            ->get(['status', 'due_at']);

        return response()->json([
            'data' => $rows->map(fn (HomeworkAssignment $hw) => [
                'id' => (int) $hw->id,
                'title_en' => $hw->title_en,
                'title_ar' => $hw->title_ar,
                'instructions_en' => $hw->instructions_en,
                'subject_id' => $hw->subject_id ? (int) $hw->subject_id : null,
                'subject' => $hw->subject?->name_en,
                'class_section_id' => $hw->class_section_id ? (int) $hw->class_section_id : null,
                'due_at' => $hw->due_at?->toIso8601String(),
                'status' => $hw->status,
                'is_scored' => (bool) $hw->is_scored,
                'max_score' => $hw->max_score,
                'allow_late' => (bool) $hw->allow_late,
                'submissions_count' => (int) $hw->submissions_count,
                'graded_count' => (int) ($graded[$hw->id] ?? 0),
                'pending_count' => max(0, (int) $hw->submissions_count - (int) ($graded[$hw->id] ?? 0)),
            ])->values(),
            'meta' => [
                'kind' => $kind,
                'stats' => [
                    'total' => $all->count(),
                    'published' => $all->where('status', 'published')->count(),
                    'draft' => $all->where('status', 'draft')->count(),
                    'overdue' => $all->filter(fn ($a) => $a->due_at
                        && $a->due_at->isPast()
                        && $a->status !== 'closed')->count(),
                ],
            ],
        ]);
    }

    public function storeAssignment(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'learning.content.assign');
        $school = $this->teacherSchool($request);
        $data = $this->validateAssignment($request);

        $hw = HomeworkAssignment::query()->create([
            ...$data,
            'title_ar' => ($data['title_ar'] ?? null) ?: $data['title_en'],
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'include_in_reports' => true,
        ]);

        return response()->json(['message' => 'Saved.', 'data' => ['id' => (int) $hw->id]], 201);
    }

    public function updateAssignment(Request $request, int $assignment): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'learning.content.assign');
        $school = $this->teacherSchool($request);
        $data = $this->validateAssignment($request);

        $hw = HomeworkAssignment::query()->where('school_id', $school->id)->findOrFail($assignment);
        $hw->update([...$data, 'title_ar' => ($data['title_ar'] ?? null) ?: $data['title_en']]);

        return response()->json(['message' => 'Saved.', 'data' => ['id' => (int) $hw->id]]);
    }

    public function destroyAssignment(Request $request, int $assignment): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'learning.content.assign');
        $school = $this->teacherSchool($request);
        HomeworkAssignment::query()->where('school_id', $school->id)->findOrFail($assignment)->delete();

        return response()->json(['message' => 'Deleted.']);
    }

    public function assignmentSubmissions(Request $request, int $assignment): JsonResponse
    {
        $this->guardTeacher($request);
        $school = $this->teacherSchool($request);

        $hw = HomeworkAssignment::query()->where('school_id', $school->id)->findOrFail($assignment);
        $submissions = AssignmentSubmission::query()
            ->where('assignment_id', $hw->id)
            ->orderByDesc('submitted_at')
            ->get();

        $students = User::query()
            ->whereIn('id', $submissions->pluck('student_user_id')->unique()->all() ?: [0])
            ->get(['id', 'first_name', 'last_name', 'email'])
            ->keyBy('id');

        return response()->json([
            'data' => $submissions->map(fn (AssignmentSubmission $s) => [
                'id' => (int) $s->id,
                'student_user_id' => (int) $s->student_user_id,
                'student' => $this->personName($students->get($s->student_user_id)),
                'submitted_at' => $s->submitted_at?->toIso8601String(),
                'is_late' => (bool) $s->is_late,
                'score' => $s->score,
                'feedback' => $s->feedback,
                'status' => $s->status,
                'body_text' => $s->body_text,
            ])->values(),
            'meta' => [
                'assignment' => [
                    'id' => (int) $hw->id,
                    'title_en' => $hw->title_en,
                    'max_score' => $hw->max_score,
                    'is_scored' => (bool) $hw->is_scored,
                ],
                'stats' => [
                    'total' => $submissions->count(),
                    'graded' => $submissions->whereNotNull('score')->count(),
                    'late' => $submissions->where('is_late', true)->count(),
                ],
            ],
        ]);
    }

    public function gradeSubmission(Request $request, int $assignment, int $submission): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'assessments.grade');
        $school = $this->teacherSchool($request);

        $hw = HomeworkAssignment::query()->where('school_id', $school->id)->findOrFail($assignment);
        $row = AssignmentSubmission::query()
            ->where('assignment_id', $hw->id)
            ->findOrFail($submission);

        $data = $request->validate([
            'score' => ['nullable', 'numeric', 'min:0'],
            'feedback' => ['nullable', 'string', 'max:4000'],
            'status' => ['nullable', 'in:submitted,returned,graded'],
        ]);

        $row->update([
            'score' => $data['score'] ?? $row->score,
            'feedback' => $data['feedback'] ?? $row->feedback,
            'status' => $data['status'] ?? 'graded',
        ]);

        return response()->json(['message' => 'Submission graded.', 'data' => ['id' => (int) $row->id]]);
    }

    /** @return array<string, mixed> */
    private function validateAssignment(Request $request): array
    {
        return $request->validate([
            'title_en' => ['required', 'string', 'max:255'],
            'title_ar' => ['nullable', 'string', 'max:255'],
            'instructions_en' => ['nullable', 'string', 'max:8000'],
            'subject_id' => ['nullable', 'integer', 'exists:subjects,id'],
            'class_section_id' => ['nullable', 'integer', 'exists:class_sections,id'],
            'due_at' => ['nullable', 'date'],
            'status' => ['nullable', 'in:draft,published,closed'],
            'assignment_kind' => ['nullable', 'in:homework,assignment'],
            'is_scored' => ['nullable', 'boolean'],
            'max_score' => ['nullable', 'numeric', 'min:0', 'max:1000'],
            'allow_late' => ['nullable', 'boolean'],
        ]);
    }

    // ------------------------------------------------------------------
    // Quizzes & exams
    // ------------------------------------------------------------------

    public function assessments(Request $request): JsonResponse
    {
        $this->guardTeacher($request);
        $school = $this->teacherSchool($request);
        $type = $request->string('type')->toString() ?: 'quiz';

        // Only the teacher's own classes, so every row resolves against the class filter.
        $ownSectionIds = $this->teacherSectionIds($request, $school);

        $query = Assessment::query()
            ->where('school_id', $school->id)
            ->where('type', $type)
            ->whereIn('class_section_id', $ownSectionIds ?: [0])
            ->withCount(['assessmentQuestions', 'attempts'])
            ->with('subject:id,code,name_en');

        if ($status = $request->string('status')->toString()) {
            $query->where('status', $status);
        }
        if ($subjectId = $request->integer('subject_id')) {
            $query->where('subject_id', $subjectId);
        }
        if ($sectionId = $request->integer('class_section_id')) {
            $query->where('class_section_id', $sectionId);
        }
        if ($search = trim($request->string('search')->toString())) {
            $query->where('title_en', 'like', "%{$search}%");
        }

        $rows = $query->orderByDesc('id')->limit(500)->get();

        $pending = AssessmentAttempt::query()
            ->whereIn('assessment_id', $rows->pluck('id')->all() ?: [0])
            ->where('status', 'submitted')
            ->selectRaw('assessment_id, COUNT(*) as aggregate')
            ->groupBy('assessment_id')
            ->pluck('aggregate', 'assessment_id');

        // Averaged as a percentage — the portal renders this on a 0-100 bar.
        $averages = AssessmentAttempt::query()
            ->whereIn('assessment_id', $rows->pluck('id')->all() ?: [0])
            ->whereNotNull('score')
            ->where('max_score', '>', 0)
            ->selectRaw('assessment_id, AVG(score / max_score * 100) as aggregate')
            ->groupBy('assessment_id')
            ->pluck('aggregate', 'assessment_id');

        $all = Assessment::query()
            ->where('school_id', $school->id)
            ->where('type', $type)
            ->whereIn('class_section_id', $ownSectionIds ?: [0])
            ->get(['status']);

        return response()->json([
            'data' => $rows->map(fn (Assessment $a) => [
                'id' => (int) $a->id,
                'title_en' => $a->title_en,
                'title_ar' => $a->title_ar,
                'instructions_en' => $a->instructions_en,
                'type' => $a->type,
                'status' => $a->status,
                'subject_id' => $a->subject_id ? (int) $a->subject_id : null,
                'subject' => $a->subject?->name_en,
                'class_section_id' => $a->class_section_id ? (int) $a->class_section_id : null,
                'time_limit_seconds' => $a->time_limit_seconds,
                'max_attempts' => $a->max_attempts,
                'available_from' => $a->available_from?->toIso8601String(),
                'available_until' => $a->available_until?->toIso8601String(),
                'shuffle_questions' => (bool) $a->shuffle_questions,
                'show_results' => $a->show_results,
                'counts_toward_grade' => (bool) $a->counts_toward_grade,
                'questions_count' => (int) $a->assessment_questions_count,
                'attempts_count' => (int) $a->attempts_count,
                'pending_grading' => (int) ($pending[$a->id] ?? 0),
                'average_score' => isset($averages[$a->id]) ? round((float) $averages[$a->id], 1) : null,
                'editable' => $a->isEditable(),
            ])->values(),
            'meta' => [
                'type' => $type,
                'stats' => [
                    'total' => $all->count(),
                    'published' => $all->where('status', 'published')->count(),
                    'draft' => $all->where('status', 'draft')->count(),
                    'pending_grading' => (int) $pending->sum(),
                ],
            ],
        ]);
    }

    public function storeAssessment(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'assessments.manage');
        $school = $this->teacherSchool($request);
        $data = $this->validateAssessment($request);

        $assessment = Assessment::query()->create([
            ...$data,
            'title_ar' => ($data['title_ar'] ?? null) ?: $data['title_en'],
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'status' => $data['status'] ?? 'draft',
        ]);

        return response()->json(['message' => 'Saved.', 'data' => ['id' => (int) $assessment->id]], 201);
    }

    public function updateAssessment(Request $request, int $assessment): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'assessments.manage');
        $school = $this->teacherSchool($request);
        $data = $this->validateAssessment($request);

        $model = Assessment::query()->where('school_id', $school->id)->findOrFail($assessment);
        $model->update([...$data, 'title_ar' => ($data['title_ar'] ?? null) ?: $data['title_en']]);

        return response()->json(['message' => 'Saved.', 'data' => ['id' => (int) $model->id]]);
    }

    public function destroyAssessment(Request $request, int $assessment): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'assessments.manage');
        $school = $this->teacherSchool($request);
        Assessment::query()->where('school_id', $school->id)->findOrFail($assessment)->delete();

        return response()->json(['message' => 'Deleted.']);
    }

    public function publishAssessment(Request $request, int $assessment): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'assessments.manage');
        $school = $this->teacherSchool($request);

        $model = Assessment::query()->where('school_id', $school->id)->findOrFail($assessment);
        $model->forceFill(['status' => $model->status === 'published' ? 'draft' : 'published'])->save();

        return response()->json([
            'message' => $model->status === 'published' ? 'Assessment published.' : 'Assessment unpublished.',
            'data' => ['id' => (int) $model->id, 'status' => $model->status],
        ]);
    }

    /** @return array<string, mixed> */
    private function validateAssessment(Request $request): array
    {
        return $request->validate([
            'type' => ['required', 'in:quiz,exam,homework,practice'],
            'title_en' => ['required', 'string', 'max:255'],
            'title_ar' => ['nullable', 'string', 'max:255'],
            'instructions_en' => ['nullable', 'string', 'max:8000'],
            'subject_id' => ['nullable', 'integer', 'exists:subjects,id'],
            'class_section_id' => ['nullable', 'integer', 'exists:class_sections,id'],
            'term_id' => ['nullable', 'integer'],
            'time_limit_seconds' => ['nullable', 'integer', 'min:60', 'max:36000'],
            'max_attempts' => ['nullable', 'integer', 'min:1', 'max:10'],
            'available_from' => ['nullable', 'date'],
            'available_until' => ['nullable', 'date', 'after:available_from'],
            'shuffle_questions' => ['nullable', 'boolean'],
            'show_results' => ['nullable', 'in:never,after_submit,after_due'],
            'counts_toward_grade' => ['nullable', 'boolean'],
            'status' => ['nullable', 'in:draft,scheduled,published,closed'],
        ]);
    }

    // ------------------------------------------------------------------
    // Attendance
    // ------------------------------------------------------------------

    public function attendance(Request $request): JsonResponse
    {
        $this->guardTeacher($request);
        $school = $this->teacherSchool($request);

        $sections = $this->teacherSections($request, $school)['sections'];
        $sectionId = $request->integer('class_section_id') ?: (int) ($sections->first()->id ?? 0);
        $date = $request->string('date')->toString() ?: Carbon::now()->toDateString();

        $roster = $sectionId ? $this->sectionRoster($sectionId, $school) : collect();

        $marks = ClassAttendance::query()
            ->where('school_id', $school->id)
            ->where('class_section_id', $sectionId)
            ->whereDate('attendance_date', $date)
            ->get()
            ->keyBy('student_user_id');

        $rows = $roster->map(function (User $student) use ($marks) {
            $mark = $marks->get($student->id);

            return [
                'student_user_id' => (int) $student->id,
                'student' => $this->personName($student),
                'email' => $student->email,
                'status' => $mark?->status ?? 'present',
                'notes' => $mark?->notes,
                'recorded' => $mark !== null,
            ];
        })->values();

        // 30-day trend for the section
        $since = Carbon::parse($date)->subDays(30)->toDateString();
        $history = ClassAttendance::query()
            ->where('school_id', $school->id)
            ->where('class_section_id', $sectionId)
            ->whereDate('attendance_date', '>=', $since)
            ->whereDate('attendance_date', '<=', $date)
            ->selectRaw('attendance_date, status, COUNT(*) as aggregate')
            ->groupBy('attendance_date', 'status')
            ->get();

        $byDate = [];
        foreach ($history as $entry) {
            $key = Carbon::parse($entry->attendance_date)->toDateString();
            $byDate[$key] ??= ['date' => $key, 'present' => 0, 'absent' => 0, 'late' => 0, 'excused' => 0];
            if (isset($byDate[$key][$entry->status])) {
                $byDate[$key][$entry->status] = (int) $entry->aggregate;
            }
        }
        krsort($byDate);

        $counts = array_fill_keys(self::ATTENDANCE_STATUSES, 0);
        foreach ($rows as $row) {
            if ($row['recorded']) {
                $counts[$row['status']] = ($counts[$row['status']] ?? 0) + 1;
            }
        }
        $recorded = array_sum($counts);

        return response()->json([
            'data' => [
                'roster' => $rows,
                'history' => array_values(array_slice($byDate, 0, 15)),
            ],
            'meta' => [
                'class_section_id' => $sectionId,
                'date' => $date,
                'sections' => $this->presentSections($sections, $school),
                'stats' => [
                    'students' => $rows->count(),
                    'recorded' => $recorded,
                    'present' => $counts['present'],
                    'absent' => $counts['absent'],
                    'late' => $counts['late'],
                    'excused' => $counts['excused'],
                    'rate' => $recorded > 0
                        ? round((($counts['present'] + $counts['late']) / $recorded) * 100, 1)
                        : null,
                ],
            ],
        ]);
    }

    public function storeAttendance(Request $request): JsonResponse
    {
        $this->guardTeacher($request);
        $school = $this->teacherSchool($request);

        $data = $request->validate([
            'class_section_id' => ['required', 'integer', 'exists:class_sections,id'],
            'subject_id' => ['nullable', 'integer', 'exists:subjects,id'],
            'attendance_date' => ['required', 'date'],
            'entries' => ['required', 'array', 'min:1'],
            'entries.*.student_user_id' => ['required', 'integer'],
            'entries.*.status' => ['required', 'in:present,absent,late,excused'],
            'entries.*.notes' => ['nullable', 'string', 'max:500'],
        ]);

        $date = Carbon::parse($data['attendance_date'])->toDateString();
        $userId = $request->user()->id;

        DB::transaction(function () use ($data, $school, $date, $userId) {
            foreach ($data['entries'] as $entry) {
                ClassAttendance::query()->updateOrCreate(
                    [
                        'class_section_id' => $data['class_section_id'],
                        'student_user_id' => $entry['student_user_id'],
                        'attendance_date' => $date,
                    ],
                    [
                        'tenant_id' => $school->tenant_id,
                        'school_id' => $school->id,
                        'subject_id' => $data['subject_id'] ?? null,
                        'status' => $entry['status'],
                        'notes' => $entry['notes'] ?? null,
                        'marked_by' => $userId,
                    ]
                );
            }
        });

        return response()->json([
            'message' => 'Attendance saved.',
            'data' => ['count' => count($data['entries']), 'date' => $date],
        ]);
    }

    // ------------------------------------------------------------------
    // Grade book
    // ------------------------------------------------------------------

    public function gradeBook(Request $request): JsonResponse
    {
        $this->guardTeacher($request);
        $school = $this->teacherSchool($request);

        $sections = $this->teacherSections($request, $school)['sections'];
        $sectionId = $request->integer('class_section_id') ?: (int) ($sections->first()->id ?? 0);
        $subjectId = $request->integer('subject_id') ?: null;

        $roster = $sectionId ? $this->sectionRoster($sectionId, $school) : collect();
        $studentIds = $roster->pluck('id')->map(fn ($id) => (int) $id)->all();

        // Columns come from two sources: scored assignments and graded assessments.
        $assignments = HomeworkAssignment::query()
            ->where('school_id', $school->id)
            ->where('is_scored', true)
            ->when($sectionId, fn ($q) => $q->where(fn ($w) => $w->where('class_section_id', $sectionId)
                ->orWhereNull('class_section_id')))
            ->when($subjectId, fn ($q) => $q->where('subject_id', $subjectId))
            ->orderBy('due_at')
            ->limit(30)
            ->get(['id', 'title_en', 'max_score', 'assignment_kind', 'due_at']);

        $assessments = Assessment::query()
            ->where('school_id', $school->id)
            ->whereIn('type', ['quiz', 'exam'])
            ->when($sectionId, fn ($q) => $q->where(fn ($w) => $w->where('class_section_id', $sectionId)
                ->orWhereNull('class_section_id')))
            ->when($subjectId, fn ($q) => $q->where('subject_id', $subjectId))
            ->orderBy('available_until')
            ->limit(30)
            ->get(['id', 'title_en', 'type', 'available_until']);

        $columns = [];
        foreach ($assignments as $item) {
            $columns[] = [
                'key' => 'a'.$item->id,
                'label' => $item->title_en,
                'type' => $item->assignment_kind === 'assignment' ? 'assignment' : 'homework',
                'max_score' => $item->max_score ? (float) $item->max_score : 100.0,
                'due_at' => $item->due_at?->toIso8601String(),
            ];
        }
        foreach ($assessments as $item) {
            $columns[] = [
                'key' => 'q'.$item->id,
                'label' => $item->title_en,
                'type' => $item->type,
                'max_score' => 100.0,
                'due_at' => $item->available_until?->toIso8601String(),
            ];
        }

        $submissionScores = AssignmentSubmission::query()
            ->whereIn('assignment_id', $assignments->pluck('id')->all() ?: [0])
            ->whereIn('student_user_id', $studentIds ?: [0])
            ->whereNotNull('score')
            ->get(['assignment_id', 'student_user_id', 'score']);

        $attemptScores = AssessmentAttempt::query()
            ->whereIn('assessment_id', $assessments->pluck('id')->all() ?: [0])
            ->whereIn('student_user_id', $studentIds ?: [0])
            ->whereNotNull('score')
            ->orderBy('attempt_no')
            ->get(['assessment_id', 'student_user_id', 'score', 'max_score']);

        $cellMap = [];
        foreach ($submissionScores as $row) {
            $cellMap[(int) $row->student_user_id]['a'.$row->assignment_id] = (float) $row->score;
        }
        foreach ($attemptScores as $row) {
            $max = $row->max_score ? (float) $row->max_score : 100.0;
            $pct = $max > 0 ? round(((float) $row->score / $max) * 100, 1) : null;
            $cellMap[(int) $row->student_user_id]['q'.$row->assessment_id] = $pct;
        }

        $rows = $roster->map(function (User $student) use ($cellMap, $columns) {
            $cells = $cellMap[(int) $student->id] ?? [];
            $percentages = [];
            foreach ($columns as $column) {
                $value = $cells[$column['key']] ?? null;
                if ($value !== null && $column['max_score'] > 0) {
                    $percentages[] = ($value / $column['max_score']) * 100;
                }
            }
            $average = $percentages !== [] ? round(array_sum($percentages) / count($percentages), 1) : null;

            return [
                'student_user_id' => (int) $student->id,
                'student' => $this->personName($student),
                'email' => $student->email,
                'cells' => (object) $cells,
                'graded_count' => count($percentages),
                'average' => $average,
                'letter' => $this->letterGrade($average),
            ];
        })->values();

        $classAverages = $rows->pluck('average')->filter(fn ($v) => $v !== null);

        return response()->json([
            'data' => [
                'columns' => $columns,
                'rows' => $rows,
            ],
            'meta' => [
                'class_section_id' => $sectionId,
                'subject_id' => $subjectId,
                'sections' => $this->presentSections($sections, $school),
                'subjects' => $this->teacherSubjects($request, $school),
                'stats' => [
                    'students' => $rows->count(),
                    'columns' => count($columns),
                    'class_average' => $classAverages->isNotEmpty()
                        ? round($classAverages->avg(), 1)
                        : null,
                    'at_risk' => $rows->filter(fn ($r) => $r['average'] !== null && $r['average'] < 50)->count(),
                ],
            ],
        ]);
    }

    private function letterGrade(?float $average): ?string
    {
        if ($average === null) {
            return null;
        }

        return match (true) {
            $average >= 90 => 'A',
            $average >= 80 => 'B',
            $average >= 70 => 'C',
            $average >= 60 => 'D',
            default => 'F',
        };
    }

    // ------------------------------------------------------------------
    // Class-wide student progress
    // ------------------------------------------------------------------

    public function classProgress(Request $request): JsonResponse
    {
        $this->guardTeacher($request);
        $school = $this->teacherSchool($request);

        $sections = $this->teacherSections($request, $school)['sections'];
        $sectionId = $request->integer('class_section_id') ?: (int) ($sections->first()->id ?? 0);
        $roster = $sectionId ? $this->sectionRoster($sectionId, $school) : collect();
        $studentIds = $roster->pluck('id')->map(fn ($id) => (int) $id)->all();

        $progress = LearningProgress::query()
            ->where('school_id', $school->id)
            ->whereIn('student_user_id', $studentIds ?: [0])
            ->get(['student_user_id', 'status', 'progress_percent', 'score', 'completed_at']);

        $attempts = AssessmentAttempt::query()
            ->whereIn('student_user_id', $studentIds ?: [0])
            ->whereNotNull('score')
            ->get(['student_user_id', 'score', 'max_score']);

        $submissions = AssignmentSubmission::query()
            ->whereIn('student_user_id', $studentIds ?: [0])
            ->get(['student_user_id', 'score', 'status', 'is_late']);

        $attendance = ClassAttendance::query()
            ->where('school_id', $school->id)
            ->where('class_section_id', $sectionId)
            ->whereIn('student_user_id', $studentIds ?: [0])
            ->selectRaw('student_user_id, status, COUNT(*) as aggregate')
            ->groupBy('student_user_id', 'status')
            ->get();

        $attendanceMap = [];
        foreach ($attendance as $row) {
            $attendanceMap[(int) $row->student_user_id][$row->status] = (int) $row->aggregate;
        }

        $rows = $roster->map(function (User $student) use ($progress, $attempts, $submissions, $attendanceMap) {
            $id = (int) $student->id;
            $studentProgress = $progress->where('student_user_id', $id);
            $studentAttempts = $attempts->where('student_user_id', $id);
            $studentSubmissions = $submissions->where('student_user_id', $id);

            $assessmentPercents = $studentAttempts->map(function ($a) {
                $max = $a->max_score ? (float) $a->max_score : 100.0;

                return $max > 0 ? ((float) $a->score / $max) * 100 : null;
            })->filter(fn ($v) => $v !== null);

            $marks = $attendanceMap[$id] ?? [];
            $totalMarks = array_sum($marks);
            $attendanceRate = $totalMarks > 0
                ? round((($marks['present'] ?? 0) + ($marks['late'] ?? 0)) / $totalMarks * 100, 1)
                : null;

            return [
                'student_user_id' => $id,
                'student' => $this->personName($student),
                'email' => $student->email,
                'lessons_started' => $studentProgress->count(),
                'lessons_completed' => $studentProgress->where('status', 'completed')->count(),
                'completion_percent' => $studentProgress->isNotEmpty()
                    ? round($studentProgress->avg('progress_percent'), 1)
                    : null,
                'assessments_taken' => $studentAttempts->count(),
                'assessment_average' => $assessmentPercents->isNotEmpty()
                    ? round($assessmentPercents->avg(), 1)
                    : null,
                'submissions' => $studentSubmissions->count(),
                'late_submissions' => $studentSubmissions->where('is_late', true)->count(),
                'attendance_rate' => $attendanceRate,
            ];
        })->values();

        $averages = $rows->pluck('assessment_average')->filter(fn ($v) => $v !== null);
        $completions = $rows->pluck('completion_percent')->filter(fn ($v) => $v !== null);

        return response()->json([
            'data' => $rows,
            'meta' => [
                'class_section_id' => $sectionId,
                'sections' => $this->presentSections($sections, $school),
                'stats' => [
                    'students' => $rows->count(),
                    'average_score' => $averages->isNotEmpty() ? round($averages->avg(), 1) : null,
                    'average_completion' => $completions->isNotEmpty() ? round($completions->avg(), 1) : null,
                    'at_risk' => $rows->filter(fn ($r) => ($r['assessment_average'] !== null && $r['assessment_average'] < 50)
                        || ($r['attendance_rate'] !== null && $r['attendance_rate'] < 75))->count(),
                ],
            ],
        ]);
    }
}
