<?php

namespace App\Http\Controllers\Api\V1\Institution;

use App\Domain\Academics\Models\ClassSection;
use App\Domain\Academics\Services\SchoolContextService;
use App\Domain\Curriculum\Models\Chapter;
use App\Domain\Curriculum\Models\CurriculumLesson;
use App\Domain\Identity\Services\RbacService;
use App\Domain\Learning\Models\InteractiveLesson;
use App\Domain\Learning\Models\LessonPlan;
use App\Domain\Learning\Models\MediaAsset;
use App\Domain\Learning\Models\StaffMessage;
use App\Http\Controllers\Api\V1\Institution\Concerns\ResolvesTeacherContext;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class TeacherPortalController extends Controller
{
    use ResolvesTeacherContext;

    public function __construct(
        protected SchoolContextService $schoolContext,
        protected RbacService $rbac,
    ) {}

    /**
     * Shared bootstrap payload every teacher page needs: school, sections, subjects, filters.
     */
    public function context(Request $request): JsonResponse
    {
        $this->guardTeacher($request);
        $school = $this->teacherSchool($request);
        $user = $request->user();
        $context = $this->teacherSections($request, $school);
        $year = $this->currentYear($school);

        return response()->json([
            'data' => [
                'school' => [
                    'id' => (int) $school->id,
                    'name_en' => $school->name_en,
                    'name_ar' => $school->name_ar,
                    'code' => $school->code,
                    'timezone' => $school->timezone,
                ],
                'teacher' => [
                    'id' => (int) $user->id,
                    'name' => $this->personName($user),
                    'email' => $user->email,
                ],
                'academic_year' => $year ? [
                    'id' => (int) $year->id,
                    'name' => $year->name,
                    'is_current' => (bool) $year->is_current,
                ] : null,
                'scope' => $context['scope'],
                'sections' => $this->presentSections($context['sections'], $school),
                'subjects' => $this->teacherSubjects($request, $school),
                'capabilities' => [
                    'assign' => $this->rbac->can($user, 'learning.content.assign'),
                    'manage_content' => $this->rbac->can($user, 'learning.content.manage'),
                    'manage_assessments' => $this->rbac->can($user, 'assessments.manage'),
                    'grade' => $this->rbac->can($user, 'assessments.grade'),
                    'view_progress' => $this->rbac->can($user, 'progress.view_class'),
                ],
            ],
        ]);
    }

    // ------------------------------------------------------------------
    // Lesson plans
    // ------------------------------------------------------------------

    public function lessonPlans(Request $request): JsonResponse
    {
        $this->guardTeacher($request);
        $school = $this->teacherSchool($request);
        $user = $request->user();

        $query = LessonPlan::query()
            ->where('school_id', $school->id)
            ->where('teacher_user_id', $user->id)
            ->with([
                'subject:id,code,name_en',
                'classSection:id,name,section_code,school_class_id,grade_id',
                'classSection.schoolClass:id,name_en',
                'classSection.grade:id,name_en',
            ]);

        if ($sectionId = $request->integer('class_section_id')) {
            $query->where('class_section_id', $sectionId);
        }
        if ($subjectId = $request->integer('subject_id')) {
            $query->where('subject_id', $subjectId);
        }
        if ($status = $request->string('status')->toString()) {
            $query->where('status', $status);
        }
        if ($search = trim($request->string('search')->toString())) {
            $query->where(fn ($q) => $q->where('title_en', 'like', "%{$search}%")
                ->orWhere('objectives', 'like', "%{$search}%"));
        }
        if ($from = $request->string('from')->toString()) {
            $query->whereDate('planned_on', '>=', $from);
        }
        if ($to = $request->string('to')->toString()) {
            $query->whereDate('planned_on', '<=', $to);
        }

        $rows = $query->orderByRaw('planned_on IS NULL')
            ->orderByDesc('planned_on')
            ->orderByDesc('id')
            ->limit(500)
            ->get();

        $all = LessonPlan::query()
            ->where('school_id', $school->id)
            ->where('teacher_user_id', $user->id)
            ->get(['status', 'planned_on']);

        $weekStart = Carbon::now()->startOfWeek();
        $weekEnd = Carbon::now()->endOfWeek();

        return response()->json([
            'data' => $rows->map(fn (LessonPlan $plan) => $this->presentLessonPlan($plan))->values(),
            'meta' => [
                'stats' => [
                    'total' => $all->count(),
                    'draft' => $all->where('status', 'draft')->count(),
                    'published' => $all->where('status', 'published')->count(),
                    'this_week' => $all->filter(fn ($p) => $p->planned_on
                        && $p->planned_on->between($weekStart, $weekEnd))->count(),
                ],
            ],
        ]);
    }

    public function storeLessonPlan(Request $request): JsonResponse
    {
        $this->guardTeacher($request);
        $school = $this->teacherSchool($request);
        $data = $this->validateLessonPlan($request);

        $plan = LessonPlan::query()->create([
            ...$data,
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'teacher_user_id' => $request->user()->id,
        ]);

        return response()->json([
            'message' => 'Lesson plan created.',
            'data' => $this->presentLessonPlan($plan->fresh(['subject', 'classSection.schoolClass', 'classSection.grade'])),
        ], 201);
    }

    public function updateLessonPlan(Request $request, int $plan): JsonResponse
    {
        $this->guardTeacher($request);
        $model = $this->findLessonPlan($request, $plan);
        $model->update($this->validateLessonPlan($request));

        return response()->json([
            'message' => 'Lesson plan updated.',
            'data' => $this->presentLessonPlan($model->fresh(['subject', 'classSection.schoolClass', 'classSection.grade'])),
        ]);
    }

    public function destroyLessonPlan(Request $request, int $plan): JsonResponse
    {
        $this->guardTeacher($request);
        $this->findLessonPlan($request, $plan)->delete();

        return response()->json(['message' => 'Lesson plan deleted.']);
    }

    public function duplicateLessonPlan(Request $request, int $plan): JsonResponse
    {
        $this->guardTeacher($request);
        $source = $this->findLessonPlan($request, $plan);

        $copy = $source->replicate(['created_at', 'updated_at']);
        $copy->title_en = mb_substr($source->title_en.' (copy)', 0, 255);
        $copy->status = 'draft';
        $copy->planned_on = $source->planned_on?->copy()->addWeek();
        $copy->save();

        return response()->json([
            'message' => 'Lesson plan duplicated.',
            'data' => $this->presentLessonPlan($copy->fresh(['subject', 'classSection.schoolClass', 'classSection.grade'])),
        ], 201);
    }

    /** @return array<string, mixed> */
    private function validateLessonPlan(Request $request): array
    {
        return $request->validate([
            'title_en' => ['required', 'string', 'max:255'],
            'title_ar' => ['nullable', 'string', 'max:255'],
            'subject_id' => ['nullable', 'integer', 'exists:subjects,id'],
            'class_section_id' => ['nullable', 'integer', 'exists:class_sections,id'],
            'curriculum_lesson_id' => ['nullable', 'integer', 'exists:curriculum_lessons,id'],
            'planned_on' => ['nullable', 'date'],
            'duration_minutes' => ['nullable', 'integer', 'min:5', 'max:600'],
            'objectives' => ['nullable', 'string', 'max:4000'],
            'materials' => ['nullable', 'string', 'max:4000'],
            'activities' => ['nullable', 'string', 'max:4000'],
            'assessment_notes' => ['nullable', 'string', 'max:4000'],
            'homework_notes' => ['nullable', 'string', 'max:4000'],
            'status' => ['nullable', 'in:draft,published,archived'],
        ]);
    }

    private function findLessonPlan(Request $request, int $id): LessonPlan
    {
        $school = $this->teacherSchool($request);

        return LessonPlan::query()
            ->where('school_id', $school->id)
            ->where('teacher_user_id', $request->user()->id)
            ->findOrFail($id);
    }

    /** @return array<string, mixed> */
    private function presentLessonPlan(LessonPlan $plan): array
    {
        return [
            'id' => (int) $plan->id,
            'title_en' => $plan->title_en,
            'title_ar' => $plan->title_ar,
            'subject_id' => $plan->subject_id ? (int) $plan->subject_id : null,
            'subject' => $plan->subject?->name_en,
            'class_section_id' => $plan->class_section_id ? (int) $plan->class_section_id : null,
            'class_section' => $this->sectionLabel($plan->classSection),
            'curriculum_lesson_id' => $plan->curriculum_lesson_id ? (int) $plan->curriculum_lesson_id : null,
            'planned_on' => $plan->planned_on?->toDateString(),
            'duration_minutes' => $plan->duration_minutes,
            'objectives' => $plan->objectives,
            'materials' => $plan->materials,
            'activities' => $plan->activities,
            'assessment_notes' => $plan->assessment_notes,
            'homework_notes' => $plan->homework_notes,
            'status' => $plan->status,
            'updated_at' => $plan->updated_at?->toIso8601String(),
        ];
    }

    // ------------------------------------------------------------------
    // Course content
    // ------------------------------------------------------------------

    public function courseContent(Request $request): JsonResponse
    {
        $this->guardTeacher($request);
        $school = $this->teacherSchool($request);

        // Keep the tree to the subjects this teacher actually teaches, so it matches the
        // subject filter options. Teachers with no assignments still see the whole school.
        $context = $this->teacherSections($request, $school);
        $scopedSubjectIds = $context['scope'] === 'assigned' ? $context['subject_ids'] : [];

        $chapterQuery = Chapter::query()
            ->where('school_id', $school->id)
            ->with(['subject:id,code,name_en', 'grade:id,name_en']);

        if ($scopedSubjectIds !== []) {
            $chapterQuery->whereIn('subject_id', $scopedSubjectIds);
        }

        if ($subjectId = $request->integer('subject_id')) {
            $chapterQuery->where('subject_id', $subjectId);
        }

        $chapters = $chapterQuery->orderBy('sequence')->orderBy('id')->limit(200)->get();
        $chapterIds = $chapters->pluck('id')->all();

        $lessonQuery = CurriculumLesson::query()
            ->where('school_id', $school->id)
            ->whereIn('chapter_id', $chapterIds ?: [0]);

        if ($search = trim($request->string('search')->toString())) {
            $lessonQuery->where(fn ($q) => $q->where('title_en', 'like', "%{$search}%")
                ->orWhere('code', 'like', "%{$search}%"));
        }

        $lessons = $lessonQuery->orderBy('sequence')->orderBy('id')->limit(1000)->get();
        $byChapter = $lessons->groupBy('chapter_id');

        $tree = $chapters->map(function (Chapter $chapter) use ($byChapter) {
            $items = $byChapter->get($chapter->id, collect());

            return [
                'id' => (int) $chapter->id,
                'title_en' => $chapter->title_en,
                'title_ar' => $chapter->title_ar,
                'sequence' => (int) $chapter->sequence,
                'status' => $chapter->status,
                'subject' => $chapter->subject?->name_en,
                'subject_id' => $chapter->subject_id ? (int) $chapter->subject_id : null,
                'grade' => $chapter->grade?->name_en,
                'lessons_count' => $items->count(),
                'lessons' => $items->map(fn (CurriculumLesson $lesson) => [
                    'id' => (int) $lesson->id,
                    'code' => $lesson->code,
                    'title_en' => $lesson->title_en,
                    'title_ar' => $lesson->title_ar,
                    'summary_en' => $lesson->summary_en,
                    'sequence' => (int) $lesson->sequence,
                    'estimated_minutes' => $lesson->estimated_minutes,
                    'difficulty' => $lesson->difficulty,
                    'status' => $lesson->status,
                ])->values(),
            ];
        })->filter(fn ($c) => $c['lessons_count'] > 0 || ! $request->string('search')->toString())
            ->values();

        $interactiveQuery = InteractiveLesson::query()
            ->where('school_id', $school->id)
            ->withCount('blocks');

        $interactiveSubjectIds = $subjectId ? [$subjectId] : $scopedSubjectIds;
        if ($interactiveSubjectIds !== []) {
            $interactiveQuery->whereHas(
                'curriculumLesson.chapter',
                fn ($q) => $q->whereIn('subject_id', $interactiveSubjectIds)
            );
        }

        if ($search) {
            $interactiveQuery->where(fn ($q) => $q->where('title_en', 'like', "%{$search}%")
                ->orWhere('title_ar', 'like', "%{$search}%"));
        }

        $interactive = $interactiveQuery
            ->orderByDesc('id')
            ->limit(100)
            ->get()
            ->map(fn (InteractiveLesson $lesson) => [
                'id' => (int) $lesson->id,
                'title_en' => $lesson->title_en,
                'title_ar' => $lesson->title_ar,
                'status' => $lesson->status,
                'completion_rule' => $lesson->completion_rule,
                'blocks_count' => (int) $lesson->blocks_count,
                'published_at' => $lesson->published_at?->toIso8601String(),
            ])->values();

        return response()->json([
            'data' => [
                'chapters' => $tree,
                'interactive_lessons' => $interactive,
            ],
            'meta' => [
                'stats' => [
                    'chapters' => $chapters->count(),
                    'lessons' => $lessons->count(),
                    'interactive' => $interactive->count(),
                    'published' => $lessons->where('status', 'published')->count(),
                ],
            ],
        ]);
    }

    // ------------------------------------------------------------------
    // Resources (media library)
    // ------------------------------------------------------------------

    public function resources(Request $request): JsonResponse
    {
        $this->guardTeacher($request);
        $school = $this->teacherSchool($request);

        $query = MediaAsset::query()
            ->where(fn ($q) => $q->where('school_id', $school->id)->orWhereNull('school_id'));

        if ($type = $request->string('type')->toString()) {
            $query->where('type', $type);
        }
        if ($search = trim($request->string('search')->toString())) {
            $query->where(fn ($q) => $q->where('title_en', 'like', "%{$search}%")
                ->orWhere('title_ar', 'like', "%{$search}%"));
        }

        $rows = $query->orderByDesc('id')->limit(500)->get();
        $all = MediaAsset::query()
            ->where(fn ($q) => $q->where('school_id', $school->id)->orWhereNull('school_id'))
            ->get(['type', 'size_bytes']);

        return response()->json([
            'data' => $rows->map(fn (MediaAsset $asset) => $this->presentAsset($asset, $school->id))->values(),
            'meta' => [
                'stats' => [
                    'total' => $all->count(),
                    'video' => $all->where('type', 'video')->count(),
                    'pdf' => $all->where('type', 'pdf')->count(),
                    'image' => $all->where('type', 'image')->count(),
                    'audio' => $all->where('type', 'audio')->count(),
                    'other' => $all->where('type', 'other')->count(),
                ],
            ],
        ]);
    }

    public function storeResource(Request $request): JsonResponse
    {
        $this->guardTeacher($request);
        $school = $this->teacherSchool($request);
        $data = $this->validateResource($request);

        $asset = MediaAsset::query()->create([
            ...$data,
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
        ]);

        return response()->json([
            'message' => 'Resource added.',
            'data' => $this->presentAsset($asset, $school->id),
        ], 201);
    }

    public function updateResource(Request $request, int $asset): JsonResponse
    {
        $this->guardTeacher($request);
        $school = $this->teacherSchool($request);
        $model = MediaAsset::query()->where('school_id', $school->id)->findOrFail($asset);
        $model->update($this->validateResource($request));

        return response()->json([
            'message' => 'Resource updated.',
            'data' => $this->presentAsset($model->fresh(), $school->id),
        ]);
    }

    public function destroyResource(Request $request, int $asset): JsonResponse
    {
        $this->guardTeacher($request);
        $school = $this->teacherSchool($request);
        MediaAsset::query()->where('school_id', $school->id)->findOrFail($asset)->delete();

        return response()->json(['message' => 'Resource removed.']);
    }

    /** @return array<string, mixed> */
    private function validateResource(Request $request): array
    {
        $data = $request->validate([
            'type' => ['required', 'in:video,pdf,image,audio,other'],
            'title_en' => ['required', 'string', 'max:255'],
            'title_ar' => ['nullable', 'string', 'max:255'],
            'external_url' => ['nullable', 'url', 'max:1000'],
            'disk_path' => ['nullable', 'string', 'max:500'],
            'mime_type' => ['nullable', 'string', 'max:128'],
            'duration_seconds' => ['nullable', 'integer', 'min:0'],
        ]);

        if (blank($data['external_url'] ?? null) && blank($data['disk_path'] ?? null)) {
            abort(422, 'Provide either a link or a file path for the resource.');
        }

        return $data;
    }

    /** @return array<string, mixed> */
    private function presentAsset(MediaAsset $asset, int $schoolId): array
    {
        return [
            'id' => (int) $asset->id,
            'type' => $asset->type,
            'title_en' => $asset->title_en,
            'title_ar' => $asset->title_ar,
            'external_url' => $asset->external_url,
            'disk_path' => $asset->disk_path,
            'mime_type' => $asset->mime_type,
            'duration_seconds' => $asset->duration_seconds,
            'size_bytes' => $asset->size_bytes,
            'is_global' => $asset->school_id === null,
            'editable' => (int) $asset->school_id === $schoolId,
            'created_at' => $asset->created_at?->toIso8601String(),
        ];
    }

    // ------------------------------------------------------------------
    // Messages
    // ------------------------------------------------------------------

    public function messages(Request $request): JsonResponse
    {
        $this->guardTeacher($request);
        $school = $this->teacherSchool($request);
        $user = $request->user();
        $box = $request->string('box')->toString() ?: 'inbox';

        $query = StaffMessage::query()
            ->where('school_id', $school->id)
            ->with(['sender:id,first_name,last_name,email', 'recipient:id,first_name,last_name,email']);

        if ($box === 'sent') {
            $query->where('sender_user_id', $user->id);
        } else {
            $query->where('recipient_user_id', $user->id);
        }

        if ($search = trim($request->string('search')->toString())) {
            $query->where(fn ($q) => $q->where('subject', 'like', "%{$search}%")
                ->orWhere('body', 'like', "%{$search}%"));
        }
        if ($category = $request->string('category')->toString()) {
            $query->where('category', $category);
        }

        $rows = $query->orderByDesc('created_at')->orderByDesc('id')->limit(300)->get();

        $inboxTotal = StaffMessage::query()
            ->where('school_id', $school->id)
            ->where('recipient_user_id', $user->id)
            ->count();
        $unread = StaffMessage::query()
            ->where('school_id', $school->id)
            ->where('recipient_user_id', $user->id)
            ->whereNull('read_at')
            ->count();
        $sentTotal = StaffMessage::query()
            ->where('school_id', $school->id)
            ->where('sender_user_id', $user->id)
            ->count();

        return response()->json([
            'data' => $rows->map(fn (StaffMessage $m) => [
                'id' => (int) $m->id,
                'subject' => $m->subject,
                'body' => $m->body,
                'category' => $m->category,
                'read_at' => $m->read_at?->toIso8601String(),
                'created_at' => $m->created_at?->toIso8601String(),
                'sender_id' => (int) $m->sender_user_id,
                'sender' => $this->personName($m->sender),
                'recipient_id' => (int) $m->recipient_user_id,
                'recipient' => $this->personName($m->recipient),
                'direction' => (int) $m->sender_user_id === (int) $user->id ? 'sent' : 'inbox',
            ])->values(),
            'meta' => [
                'box' => $box,
                'stats' => [
                    'inbox' => $inboxTotal,
                    'unread' => $unread,
                    'sent' => $sentTotal,
                ],
            ],
        ]);
    }

    public function messageRecipients(Request $request): JsonResponse
    {
        $this->guardTeacher($request);
        $school = $this->teacherSchool($request);
        $user = $request->user();

        $sectionIds = $this->teacherSectionIds($request, $school);
        $studentIds = \App\Domain\Academics\Models\Enrollment::query()
            ->where('school_id', $school->id)
            ->whereIn('class_section_id', $sectionIds ?: [0])
            ->pluck('student_user_id')
            ->unique()
            ->all();

        $staff = User::query()
            ->where('tenant_id', $school->tenant_id)
            ->where('id', '!=', $user->id)
            ->where('status', 'active')
            ->orderBy('first_name')
            ->limit(300)
            ->get(['id', 'first_name', 'last_name', 'email']);

        return response()->json([
            'data' => $staff->map(fn (User $u) => [
                'id' => (int) $u->id,
                'name' => $this->personName($u),
                'email' => $u->email,
                'is_student' => in_array((int) $u->id, array_map('intval', $studentIds), true),
            ])->values(),
        ]);
    }

    public function storeMessage(Request $request): JsonResponse
    {
        $this->guardTeacher($request);
        $school = $this->teacherSchool($request);

        $data = $request->validate([
            'recipient_user_id' => ['required', 'integer', 'exists:users,id'],
            'subject' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string', 'max:8000'],
            'category' => ['nullable', 'in:general,academic,behaviour,attendance,parent'],
        ]);

        $message = StaffMessage::query()->create([
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'sender_user_id' => $request->user()->id,
            'recipient_user_id' => $data['recipient_user_id'],
            'subject' => $data['subject'],
            'body' => $data['body'],
            'category' => $data['category'] ?? 'general',
        ]);

        return response()->json(['message' => 'Message sent.', 'data' => ['id' => (int) $message->id]], 201);
    }

    public function markMessageRead(Request $request, int $message): JsonResponse
    {
        $this->guardTeacher($request);
        $school = $this->teacherSchool($request);

        $row = StaffMessage::query()
            ->where('school_id', $school->id)
            ->where('recipient_user_id', $request->user()->id)
            ->findOrFail($message);

        if (! $row->read_at) {
            $row->forceFill(['read_at' => now()])->save();
        }

        return response()->json(['message' => 'Marked as read.', 'data' => ['id' => (int) $row->id]]);
    }

    public function markAllMessagesRead(Request $request): JsonResponse
    {
        $this->guardTeacher($request);
        $school = $this->teacherSchool($request);

        $updated = StaffMessage::query()
            ->where('school_id', $school->id)
            ->where('recipient_user_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json(['message' => 'All messages marked as read.', 'data' => ['updated' => $updated]]);
    }

    public function destroyMessage(Request $request, int $message): JsonResponse
    {
        $this->guardTeacher($request);
        $school = $this->teacherSchool($request);
        $userId = $request->user()->id;

        StaffMessage::query()
            ->where('school_id', $school->id)
            ->where(fn ($q) => $q->where('recipient_user_id', $userId)->orWhere('sender_user_id', $userId))
            ->findOrFail($message)
            ->delete();

        return response()->json(['message' => 'Message deleted.']);
    }
}
