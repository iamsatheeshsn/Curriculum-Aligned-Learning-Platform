<?php

namespace App\Http\Controllers\Api\V1\Institution;

use App\Domain\Academics\Services\SchoolContextService;
use App\Domain\Identity\Services\RbacService;
use App\Domain\Tutoring\Models\SessionNote;
use App\Domain\Tutoring\Models\TutorProfile;
use App\Domain\Tutoring\Models\TutoringSession;
use App\Domain\Tutoring\Models\TutoringSessionRating;
use App\Domain\Tutoring\Services\AttendanceService;
use App\Domain\Tutoring\Services\BookingService;
use App\Domain\Tutoring\Services\MeetingProviderService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TutoringSessionController extends Controller
{
    public function __construct(
        protected SchoolContextService $schoolContext,
        protected BookingService $booking,
        protected AttendanceService $attendance,
        protected MeetingProviderService $meetings,
        protected RbacService $rbac,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorizeManageOrConduct($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $items = TutoringSession::query()
            ->where('school_id', $school->id)
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('tutor_profile_id'), fn ($q) => $q->where('tutor_profile_id', $request->integer('tutor_profile_id')))
            ->with(['tutor.user:id,first_name,last_name,email', 'subject:id,code,name_en,name_ar', 'participants:id,first_name,last_name,email'])
            ->orderByDesc('starts_at')
            ->paginate((int) $request->integer('per_page', 10));

        return response()->json($items);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeBook($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $data = $request->validate([
            'tutor_profile_id' => ['required', 'integer'],
            'subject_id' => ['required', 'integer'],
            'language' => ['required', 'in:en,ar'],
            'session_type' => ['nullable', 'in:one_to_one,small_group'],
            'starts_at' => ['required', 'date'],
            'ends_at' => ['nullable', 'date', 'after:starts_at'],
            'duration_minutes' => ['nullable', 'integer', 'min:15', 'max:240'],
            'campus_id' => ['nullable', 'integer'],
            'student_user_id' => ['nullable', 'integer'],
            'student_user_ids' => ['nullable', 'array'],
            'student_user_ids.*' => ['integer'],
        ]);

        $tutor = TutorProfile::query()->where('school_id', $school->id)->findOrFail($data['tutor_profile_id']);
        $session = $this->booking->book($school, $tutor, $data, $request->user()->id);

        return response()->json(['message' => 'Session booked.', 'data' => $session], 201);
    }

    public function show(Request $request, int $session): JsonResponse
    {
        $this->authorizeManageOrConduct($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $model = TutoringSession::query()
            ->where('school_id', $school->id)
            ->with(['tutor.user', 'subject', 'participants', 'attendanceRecords', 'notes', 'ratings'])
            ->findOrFail($session);

        return response()->json(['data' => $model]);
    }

    public function classroom(Request $request, int $session): JsonResponse
    {
        $user = $request->user();
        if (! ($this->rbac->can($user, 'tutoring.join')
            || $this->rbac->can($user, 'tutoring.conduct')
            || $this->rbac->can($user, 'tutoring.manage'))) {
            $this->rbac->authorize($user, 'tutoring.join');
        }

        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = TutoringSession::query()
            ->where('school_id', $school->id)
            ->with([
                'subject:id,code,name_en',
                'tutor.user:id,first_name,last_name,email',
                'participants:id,first_name,last_name,email',
                'attendanceRecords',
                'notes',
            ])
            ->findOrFail($session);

        if (in_array($model->status, ['cancelled'], true)) {
            return response()->json(['message' => 'Session is cancelled.', 'code' => 'session_cancelled'], 422);
        }

        // Entering the classroom moves scheduled/confirmed sessions into live conduct.
        if (in_array($model->status, ['scheduled', 'confirmed'], true)
            && ($this->rbac->can($user, 'tutoring.conduct') || $this->rbac->can($user, 'tutoring.manage'))) {
            $model->forceFill(['status' => 'in_progress'])->save();
        }

        $joinUrl = $this->meetings->resolveJoinUrl($model);
        $attendanceByStudent = $model->attendanceRecords->keyBy('student_user_id');
        $tutorUser = $model->tutor?->user;
        $note = $model->notes;

        return response()->json([
            'data' => [
                'session_id' => $model->id,
                'provider' => $model->meeting_provider,
                'join_url' => $joinUrl,
                'external_id' => $model->meeting_external_id,
                'starts_at' => $model->starts_at?->toIso8601String(),
                'ends_at' => $model->ends_at?->toIso8601String(),
                'status' => $model->status,
                'language' => $model->language,
                'session_type' => $model->session_type,
                'subject' => $model->subject ? [
                    'id' => $model->subject->id,
                    'code' => $model->subject->code,
                    'name_en' => $model->subject->name_en,
                ] : null,
                'tutor' => $tutorUser ? [
                    'id' => $tutorUser->id,
                    'first_name' => $tutorUser->first_name,
                    'last_name' => $tutorUser->last_name,
                    'email' => $tutorUser->email,
                ] : null,
                'participants' => $model->participants->map(function ($p) use ($attendanceByStudent) {
                    $att = $attendanceByStudent->get($p->id);

                    return [
                        'id' => $p->id,
                        'first_name' => $p->first_name,
                        'last_name' => $p->last_name,
                        'email' => $p->email,
                        'role' => $p->pivot->role ?? 'learner',
                        'attendance_status' => $att?->status,
                        'attendance_notes' => $att?->notes,
                    ];
                })->values(),
                'note' => $note ? [
                    'id' => $note->id,
                    'notes' => $note->notes,
                    'follow_up' => $note->follow_up,
                    'visible_to_parent' => (bool) $note->visible_to_parent,
                ] : null,
                'permissions' => [
                    'mark_attendance' => $this->rbac->can($user, 'tutoring.attendance.manage')
                        || $this->rbac->can($user, 'tutoring.manage'),
                    'save_notes' => $this->rbac->can($user, 'tutoring.conduct')
                        || $this->rbac->can($user, 'tutoring.manage'),
                    'complete' => $this->rbac->can($user, 'tutoring.conduct')
                        || $this->rbac->can($user, 'tutoring.manage'),
                ],
            ],
            'join_url' => $joinUrl,
        ]);
    }

    public function cancel(Request $request, int $session): JsonResponse
    {
        $this->authorizeBook($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = TutoringSession::query()->where('school_id', $school->id)->findOrFail($session);

        $data = $request->validate(['reason' => ['nullable', 'string', 'max:500']]);

        return response()->json([
            'message' => 'Session cancelled.',
            'data' => $this->booking->cancel($model, $data['reason'] ?? null),
        ]);
    }

    public function complete(Request $request, int $session): JsonResponse
    {
        $this->authorizeManageOrConduct($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = TutoringSession::query()->where('school_id', $school->id)->findOrFail($session);

        return response()->json([
            'message' => 'Session completed.',
            'data' => $this->booking->complete($model),
        ]);
    }

    public function markAttendance(Request $request, int $session): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'tutoring.attendance.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = TutoringSession::query()->where('school_id', $school->id)->findOrFail($session);

        $data = $request->validate([
            'student_user_id' => ['required', 'integer'],
            'status' => ['required', 'in:present,absent,late,excused'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $row = $this->attendance->mark(
            $model,
            $data['student_user_id'],
            $data['status'],
            $request->user()->id,
            $data['notes'] ?? null,
        );

        return response()->json(['message' => 'Attendance marked.', 'data' => $row]);
    }

    public function storeNote(Request $request, int $session): JsonResponse
    {
        $this->authorizeManageOrConduct($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = TutoringSession::query()->where('school_id', $school->id)->findOrFail($session);

        $data = $request->validate([
            'notes' => ['required', 'string'],
            'follow_up' => ['nullable', 'string'],
            'visible_to_parent' => ['nullable', 'boolean'],
        ]);

        $note = SessionNote::query()->updateOrCreate(
            ['tutoring_session_id' => $model->id],
            [
                'tutor_profile_id' => $model->tutor_profile_id,
                'notes' => $data['notes'],
                'follow_up' => $data['follow_up'] ?? null,
                'visible_to_parent' => $data['visible_to_parent'] ?? true,
            ]
        );

        return response()->json(['message' => 'Session note saved.', 'data' => $note]);
    }

    public function ratings(Request $request, int $tutor): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'tutoring.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        TutorProfile::query()->where('school_id', $school->id)->findOrFail($tutor);

        $items = TutoringSessionRating::query()
            ->where('tutor_profile_id', $tutor)
            ->orderByDesc('id')
            ->paginate((int) $request->integer('per_page', 10));

        return response()->json($items);
    }

    private function authorizeBook(Request $request): void
    {
        $user = $request->user();
        if ($this->rbac->can($user, 'tutoring.book') || $this->rbac->can($user, 'tutoring.manage')) {
            return;
        }
        $this->rbac->authorize($user, 'tutoring.book');
    }

    private function authorizeManageOrConduct(Request $request): void
    {
        $user = $request->user();
        if ($this->rbac->can($user, 'tutoring.manage') || $this->rbac->can($user, 'tutoring.conduct')) {
            return;
        }
        $this->rbac->authorize($user, 'tutoring.manage');
    }
}
