<?php

namespace App\Http\Controllers\Api\V1\Learner;

use App\Domain\Academics\Services\SchoolContextService;
use App\Domain\Identity\Services\RbacService;
use App\Domain\Tutoring\Models\TutorProfile;
use App\Domain\Tutoring\Models\TutoringAttendance;
use App\Domain\Tutoring\Models\TutoringSession;
use App\Domain\Tutoring\Services\AvailabilityService;
use App\Domain\Tutoring\Services\BookingService;
use App\Domain\Tutoring\Services\MeetingProviderService;
use App\Domain\Tutoring\Services\RatingService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class LearnerTutoringController extends Controller
{
    public function __construct(
        protected SchoolContextService $schoolContext,
        protected BookingService $booking,
        protected AvailabilityService $availability,
        protected RatingService $ratings,
        protected MeetingProviderService $meetings,
        protected RbacService $rbac,
    ) {}

    public function tutors(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! ($this->rbac->can($user, 'tutoring.book') || $this->rbac->can($user, 'tutoring.join'))) {
            $this->rbac->authorize($user, 'tutoring.book');
        }
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $items = TutorProfile::query()
            ->where('school_id', $school->id)
            ->where('status', 'active')
            ->with(['user:id,first_name,last_name', 'subjects:id,code,name_en,name_ar'])
            ->withAvg('ratings', 'rating')
            ->orderBy('id')
            ->get();

        return response()->json(['data' => $items]);
    }

    public function slots(Request $request, int $tutor): JsonResponse
    {
        $user = $request->user();
        if (! ($this->rbac->can($user, 'tutoring.book') || $this->rbac->can($user, 'tutoring.join'))) {
            $this->rbac->authorize($user, 'tutoring.book');
        }
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $profile = TutorProfile::query()->where('school_id', $school->id)->where('status', 'active')->findOrFail($tutor);

        $data = $request->validate(['date' => ['required', 'date']]);

        return response()->json([
            'data' => $this->availability->openSlots($profile, Carbon::parse($data['date'])),
        ]);
    }

    public function book(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'tutoring.book');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $data = $request->validate([
            'tutor_profile_id' => ['required', 'integer'],
            'subject_id' => ['required', 'integer'],
            'language' => ['required', 'in:en,ar'],
            'starts_at' => ['required', 'date'],
            'ends_at' => ['nullable', 'date', 'after:starts_at'],
            'duration_minutes' => ['nullable', 'integer', 'min:15', 'max:240'],
            'student_user_id' => ['required', 'integer'],
            'session_type' => ['nullable', 'in:one_to_one,small_group'],
        ]);

        $tutor = TutorProfile::query()->where('school_id', $school->id)->findOrFail($data['tutor_profile_id']);
        $session = $this->booking->book($school, $tutor, $data, $request->user()->id);

        return response()->json(['message' => 'Session booked.', 'data' => $session], 201);
    }

    public function mySessions(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! ($this->rbac->can($user, 'tutoring.join') || $this->rbac->can($user, 'tutoring.book'))) {
            $this->rbac->authorize($user, 'tutoring.join');
        }
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $items = TutoringSession::query()
            ->where('school_id', $school->id)
            ->whereHas('participants', fn ($q) => $q->where('users.id', $user->id))
            ->with(['tutor.user:id,first_name,last_name', 'subject:id,code,name_en'])
            ->orderByDesc('starts_at')
            ->paginate((int) $request->integer('per_page', 10));

        return response()->json($items);
    }

    public function join(Request $request, int $session): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'tutoring.join');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $user = $request->user();

        $model = TutoringSession::query()
            ->where('school_id', $school->id)
            ->whereHas('participants', fn ($q) => $q->where('users.id', $user->id))
            ->with([
                'tutor.user:id,first_name,last_name,email',
                'subject:id,code,name_en',
                'notes',
                'attendanceRecords' => fn ($q) => $q->where('student_user_id', $user->id),
                'ratings' => fn ($q) => $q->where('student_user_id', $user->id),
            ])
            ->findOrFail($session);

        if ($model->status === 'cancelled') {
            return response()->json(['message' => 'Session cancelled.', 'code' => 'session_cancelled'], 422);
        }

        $joinUrl = $this->meetings->resolveJoinUrl($model, 'learner');
        $tutorUser = $model->tutor?->user;
        $attendance = $model->attendanceRecords->first();
        $note = $model->notes;
        $rating = $model->ratings->first();
        // Students only see notes the tutor marked visible to parents.
        $sharedNote = ($note && (bool) $note->visible_to_parent) ? $note : null;

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
                'attendance' => $attendance ? [
                    'status' => $attendance->status,
                    'notes' => $attendance->notes,
                    'marked_at' => $attendance->marked_at?->toIso8601String(),
                ] : null,
                'note' => $sharedNote ? [
                    'notes' => $sharedNote->notes,
                    'follow_up' => $sharedNote->follow_up,
                ] : null,
                'rating' => $rating ? [
                    'rating' => $rating->rating,
                    'feedback' => $rating->feedback,
                ] : null,
                'permissions' => [
                    'can_join' => ! in_array($model->status, ['cancelled', 'completed'], true),
                    'can_rate' => $model->status === 'completed',
                ],
            ],
            'join_url' => $joinUrl,
        ]);
    }

    public function rate(Request $request, int $session): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'tutoring.join');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $model = TutoringSession::query()
            ->where('school_id', $school->id)
            ->whereHas('participants', fn ($q) => $q->where('users.id', $request->user()->id))
            ->findOrFail($session);

        $data = $request->validate([
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'feedback' => ['nullable', 'string'],
            'feedback_ar' => ['nullable', 'string'],
        ]);

        $row = $this->ratings->rate(
            $model,
            $request->user()->id,
            $data['rating'],
            $data['feedback'] ?? null,
            $data['feedback_ar'] ?? null,
        );

        return response()->json(['message' => 'Feedback submitted.', 'data' => $row], 201);
    }

    public function myAttendance(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! ($this->rbac->can($user, 'tutoring.join') || $this->rbac->can($user, 'tutoring.attendance.view_child'))) {
            $this->rbac->authorize($user, 'tutoring.join');
        }

        $studentId = $request->integer('student_user_id') ?: $user->id;
        if ($studentId !== $user->id) {
            $this->rbac->authorize($user, 'tutoring.attendance.view_child');
        }

        $items = TutoringAttendance::query()
            ->where('student_user_id', $studentId)
            ->with('session:id,starts_at,ends_at,status,subject_id,tutor_profile_id')
            ->orderByDesc('marked_at')
            ->paginate((int) $request->integer('per_page', 10));

        return response()->json($items);
    }
}
