<?php

namespace App\Http\Controllers\Api\V1\Institution;

use App\Domain\Academics\Models\SchoolClass;
use App\Domain\Academics\Services\SchoolContextService;
use App\Domain\Assessment\Models\Assessment;
use App\Domain\Assessment\Models\AssessmentAttempt;
use App\Domain\Identity\Services\RbacService;
use App\Domain\Learning\Models\HomeworkAssignment;
use App\Domain\Tutoring\Models\TutorProfile;
use App\Domain\Tutoring\Models\TutoringSession;
use App\Domain\Tutoring\Services\AvailabilityService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class TeacherWorkspaceController extends Controller
{
    public function __construct(
        protected SchoolContextService $schoolContext,
        protected AvailabilityService $availability,
        protected RbacService $rbac,
    ) {}

    /**
     * Aggregated teacher / tutor workspace for the Institution portal.
     */
    public function home(Request $request): JsonResponse
    {
        $user = $request->user();
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $canAcademics = $this->rbac->can($user, 'school.academics.manage')
            || $this->rbac->can($user, 'curriculum.view')
            || $this->rbac->can($user, 'learning.content.assign');
        $canAssign = $this->rbac->can($user, 'learning.content.assign');
        $canGrade = $this->rbac->can($user, 'assessments.grade');
        $canTutor = $this->rbac->can($user, 'tutoring.conduct')
            || $this->rbac->can($user, 'tutoring.manage')
            || $this->rbac->can($user, 'tutoring.availability.manage');

        $tutorProfile = TutorProfile::query()
            ->where('school_id', $school->id)
            ->where('user_id', $user->id)
            ->first();

        $classes = [];
        if ($canAcademics) {
            $classes = SchoolClass::query()
                ->where('school_id', $school->id)
                ->with(['grade:id,name_en,code', 'campus:id,name_en', 'sections:id,school_class_id,name,section_code,status'])
                ->orderBy('code')
                ->limit(20)
                ->get()
                ->map(fn (SchoolClass $class) => [
                    'id' => $class->id,
                    'code' => $class->code,
                    'name_en' => $class->name_en,
                    'name_ar' => $class->name_ar,
                    'status' => $class->status,
                    'grade' => $class->grade?->name_en,
                    'campus' => $class->campus?->name_en,
                    'sections' => $class->sections->map(fn ($s) => [
                        'id' => $s->id,
                        'name' => $s->name,
                        'section_code' => $s->section_code,
                        'status' => $s->status,
                    ])->values(),
                ]);
        }

        $homework = [];
        if ($canAssign) {
            $homework = HomeworkAssignment::query()
                ->where('school_id', $school->id)
                ->withCount('submissions')
                ->orderByDesc('due_at')
                ->orderByDesc('id')
                ->limit(15)
                ->get()
                ->map(fn (HomeworkAssignment $hw) => [
                    'id' => $hw->id,
                    'title_en' => $hw->title_en,
                    'title_ar' => $hw->title_ar,
                    'status' => $hw->status,
                    'due_at' => $hw->due_at?->toIso8601String(),
                    'submissions_count' => $hw->submissions_count,
                    'max_score' => $hw->max_score,
                    'is_scored' => (bool) $hw->is_scored,
                ]);
        }

        $assessments = [];
        if ($canAssign || $canGrade) {
            $assessments = Assessment::query()
                ->where('school_id', $school->id)
                ->orderByDesc('id')
                ->limit(10)
                ->get(['id', 'title_en', 'type', 'status', 'available_until'])
                ->map(fn (Assessment $a) => [
                    'id' => $a->id,
                    'title_en' => $a->title_en,
                    'type' => $a->type,
                    'status' => $a->status,
                    'due_at' => $a->available_until?->toIso8601String(),
                ]);
        }

        $toGrade = 0;
        if ($canGrade) {
            $toGrade = AssessmentAttempt::query()
                ->where('status', 'submitted')
                ->whereHas('assessment', fn ($q) => $q->where('school_id', $school->id))
                ->count();
        }

        $sessions = [];
        $weekly = [];
        $openSlots = [];
        if ($canTutor) {
            $sessionQuery = TutoringSession::query()
                ->where('school_id', $school->id)
                ->with([
                    'tutor.user:id,first_name,last_name,email',
                    'subject:id,code,name_en,name_ar',
                    'participants:id,first_name,last_name,email',
                ])
                ->orderByDesc('starts_at')
                ->limit(15);

            if ($tutorProfile && ! $this->rbac->can($user, 'tutoring.manage')) {
                $sessionQuery->where('tutor_profile_id', $tutorProfile->id);
            }

            $sessions = $sessionQuery->get()->map(fn (TutoringSession $s) => [
                'id' => $s->id,
                'starts_at' => $s->starts_at?->toIso8601String(),
                'ends_at' => $s->ends_at?->toIso8601String(),
                'status' => $s->status,
                'language' => $s->language,
                'session_type' => $s->session_type,
                'meeting_url' => $s->meeting_url,
                'subject' => $s->subject?->name_en,
                'tutor' => $s->tutor?->user
                    ? trim(($s->tutor->user->first_name ?? '').' '.($s->tutor->user->last_name ?? ''))
                    : null,
                'students' => $s->participants->map(fn ($p) => trim(($p->first_name ?? '').' '.($p->last_name ?? '')) ?: $p->email)->values(),
            ]);

            if ($tutorProfile) {
                $weekly = $tutorProfile->availabilities()
                    ->orderBy('weekday')
                    ->orderBy('start_time')
                    ->get()
                    ->map(fn ($row) => [
                        'id' => $row->id,
                        'weekday' => $row->weekday,
                        'start_time' => substr((string) $row->start_time, 0, 5),
                        'end_time' => substr((string) $row->end_time, 0, 5),
                        'slot_minutes' => $row->slot_minutes,
                        'is_active' => (bool) $row->is_active,
                        'timezone' => $row->timezone,
                    ]);

                $slotDate = Carbon::parse($request->input('slot_date', now($school->timezone ?: 'Asia/Riyadh')->toDateString()));
                try {
                    $openSlots = collect($this->availability->openSlots($tutorProfile, $slotDate))
                        ->take(12)
                        ->values()
                        ->all();
                } catch (\Throwable) {
                    $openSlots = [];
                }
            }
        }

        $upcomingCount = collect($sessions)->filter(function ($s) {
            return in_array($s['status'], ['scheduled', 'confirmed', 'in_progress'], true)
                && $s['starts_at']
                && Carbon::parse($s['starts_at'])->isFuture();
        })->count();

        return response()->json([
            'data' => [
                'school' => [
                    'id' => $school->id,
                    'name_en' => $school->name_en,
                    'name_ar' => $school->name_ar,
                    'code' => $school->code,
                    'timezone' => $school->timezone,
                ],
                'capabilities' => [
                    'classes' => $canAcademics,
                    'assignments' => $canAssign,
                    'grading' => $canGrade,
                    'tutoring' => $canTutor,
                    'manage_availability' => $this->rbac->can($user, 'tutoring.availability.manage')
                        || $this->rbac->can($user, 'tutoring.manage'),
                ],
                'tutor_profile' => $tutorProfile ? [
                    'id' => $tutorProfile->id,
                    'status' => $tutorProfile->status,
                    'bio_en' => $tutorProfile->bio_en,
                ] : null,
                'stats' => [
                    'classes' => count($classes),
                    'assignments' => count($homework) + count($assessments),
                    'to_grade' => $toGrade,
                    'upcoming_sessions' => $upcomingCount,
                    'open_slots' => count($openSlots),
                    'weekly_slots' => count($weekly),
                ],
                'classes' => $classes,
                'homework' => $homework,
                'assessments' => $assessments,
                'sessions' => $sessions,
                'availability' => [
                    'weekly' => $weekly,
                    'open_slots' => $openSlots,
                    'slot_date' => $request->input('slot_date', now($school->timezone ?: 'Asia/Riyadh')->toDateString()),
                ],
            ],
        ]);
    }

    public function storeHomework(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'learning.content.assign');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $data = $request->validate([
            'title_en' => ['required', 'string', 'max:255'],
            'title_ar' => ['nullable', 'string', 'max:255'],
            'instructions_en' => ['nullable', 'string'],
            'due_at' => ['nullable', 'date'],
            'status' => ['nullable', 'in:draft,published,closed'],
            'class_section_id' => ['nullable', 'integer'],
            'subject_id' => ['nullable', 'integer'],
            'is_scored' => ['nullable', 'boolean'],
            'max_score' => ['nullable', 'numeric', 'min:0'],
        ]);

        $hw = HomeworkAssignment::query()->create([
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'subject_id' => $data['subject_id'] ?? null,
            'class_section_id' => $data['class_section_id'] ?? null,
            'title_en' => $data['title_en'],
            'title_ar' => ($data['title_ar'] ?? null) ?: $data['title_en'],
            'instructions_en' => $data['instructions_en'] ?? null,
            'due_at' => $data['due_at'] ?? null,
            'allow_late' => true,
            'is_scored' => $data['is_scored'] ?? false,
            'max_score' => $data['max_score'] ?? null,
            'include_in_reports' => true,
            'status' => $data['status'] ?? 'published',
        ]);

        return response()->json(['message' => 'Assignment created.', 'data' => $hw], 201);
    }

    public function storeAvailability(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! ($this->rbac->can($user, 'tutoring.availability.manage') || $this->rbac->can($user, 'tutoring.manage'))) {
            $this->rbac->authorize($user, 'tutoring.availability.manage');
        }

        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $profile = TutorProfile::query()
            ->where('school_id', $school->id)
            ->where('user_id', $user->id)
            ->first();

        if (! $profile) {
            throw ValidationException::withMessages([
                'tutor' => ['No tutor profile is linked to your account.'],
            ]);
        }

        $data = $request->validate([
            'weekday' => ['required', 'integer', 'min:0', 'max:6'],
            'start_time' => ['required', 'date_format:H:i'],
            'end_time' => ['required', 'date_format:H:i', 'after:start_time'],
            'slot_minutes' => ['nullable', 'integer', 'min:15', 'max:240'],
            'timezone' => ['nullable', 'string', 'max:64'],
        ]);

        $row = $this->availability->addWeekly($profile, [
            ...$data,
            'timezone' => $data['timezone'] ?? ($school->timezone ?: 'Asia/Riyadh'),
            'is_active' => true,
        ]);

        return response()->json(['message' => 'Tutoring slot added.', 'data' => $row], 201);
    }
}
