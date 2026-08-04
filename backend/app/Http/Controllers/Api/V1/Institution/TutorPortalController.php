<?php

namespace App\Http\Controllers\Api\V1\Institution;

use App\Domain\Academics\Services\SchoolContextService;
use App\Domain\Billing\Models\TutorPayment;
use App\Domain\Identity\Services\RbacService;
use App\Domain\Notification\Services\PortalNotificationService;
use App\Domain\Tutoring\Models\SessionNote;
use App\Domain\Tutoring\Models\TutorProfile;
use App\Domain\Tutoring\Models\TutoringSession;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TutorPortalController extends Controller
{
    public function __construct(
        protected SchoolContextService $schoolContext,
        protected RbacService $rbac,
        protected PortalNotificationService $notifications,
    ) {}

    protected function guardTutor(Request $request): void
    {
        $user = $request->user();
        abort_unless(
            $user?->hasRole('tutor')
                || $user?->hasRole('teacher')
                || $this->rbac->can($user, 'tutoring.conduct')
                || $this->rbac->can($user, 'tutoring.manage')
                || $this->rbac->can($user, 'tutoring.availability.manage'),
            403
        );
    }

    protected function resolveProfile(Request $request): TutorProfile
    {
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $profile = TutorProfile::query()
            ->where('school_id', $school->id)
            ->where('user_id', $request->user()->id)
            ->first();

        if (! $profile) {
            throw ValidationException::withMessages([
                'tutor' => ['No tutor profile is linked to your account.'],
            ]);
        }

        return $profile;
    }

    public function students(Request $request): JsonResponse
    {
        $this->guardTutor($request);
        $profile = $this->resolveProfile($request);

        $sessions = TutoringSession::query()
            ->where('tutor_profile_id', $profile->id)
            ->with(['participants:id,first_name,last_name,email,status'])
            ->orderByDesc('starts_at')
            ->limit(200)
            ->get();

        $map = [];
        foreach ($sessions as $session) {
            foreach ($session->participants as $student) {
                $id = (int) $student->id;
                if (! isset($map[$id])) {
                    $map[$id] = [
                        'user_id' => $id,
                        'first_name' => $student->first_name,
                        'last_name' => $student->last_name,
                        'email' => $student->email,
                        'status' => $student->status,
                        'sessions_count' => 0,
                        'last_session_at' => null,
                        'upcoming_count' => 0,
                    ];
                }
                $map[$id]['sessions_count']++;
                $starts = $session->starts_at?->toIso8601String();
                if ($starts && ($map[$id]['last_session_at'] === null || $starts > $map[$id]['last_session_at'])) {
                    $map[$id]['last_session_at'] = $starts;
                }
                if (in_array($session->status, ['scheduled', 'confirmed', 'in_progress'], true)
                    && $session->starts_at
                    && $session->starts_at->isFuture()) {
                    $map[$id]['upcoming_count']++;
                }
            }
        }

        $rows = array_values($map);
        usort($rows, fn ($a, $b) => strcmp((string) ($b['last_session_at'] ?? ''), (string) ($a['last_session_at'] ?? '')));

        return response()->json([
            'data' => $rows,
            'meta' => [
                'stats' => [
                    'total' => count($rows),
                    'with_upcoming' => count(array_filter($rows, fn ($r) => ($r['upcoming_count'] ?? 0) > 0)),
                ],
            ],
        ]);
    }

    public function sessionNotes(Request $request): JsonResponse
    {
        $this->guardTutor($request);
        $profile = $this->resolveProfile($request);

        $notes = SessionNote::query()
            ->where('tutor_profile_id', $profile->id)
            ->with([
                'session:id,starts_at,ends_at,status,subject_id',
                'session.subject:id,name_en',
                'session.participants:id,first_name,last_name,email',
            ])
            ->orderByDesc('id')
            ->limit(100)
            ->get()
            ->map(function (SessionNote $note) {
                $session = $note->session;

                return [
                    'id' => $note->id,
                    'notes' => $note->notes,
                    'follow_up' => $note->follow_up,
                    'visible_to_parent' => (bool) $note->visible_to_parent,
                    'created_at' => $note->created_at?->toIso8601String(),
                    'session' => $session ? [
                        'id' => $session->id,
                        'starts_at' => $session->starts_at?->toIso8601String(),
                        'status' => $session->status,
                        'subject' => $session->subject?->name_en,
                        'students' => $session->participants->map(
                            fn ($p) => trim(($p->first_name ?? '').' '.($p->last_name ?? '')) ?: $p->email
                        )->values(),
                    ] : null,
                ];
            });

        return response()->json([
            'data' => $notes,
            'meta' => ['stats' => ['total' => $notes->count()]],
        ]);
    }

    public function storeSessionNote(Request $request): JsonResponse
    {
        $this->guardTutor($request);
        $profile = $this->resolveProfile($request);
        $data = $request->validate([
            'tutoring_session_id' => ['required', 'integer'],
            'notes' => ['required', 'string'],
            'follow_up' => ['nullable', 'string'],
            'visible_to_parent' => ['nullable', 'boolean'],
        ]);

        $session = TutoringSession::query()
            ->where('tutor_profile_id', $profile->id)
            ->findOrFail((int) $data['tutoring_session_id']);

        $note = SessionNote::query()->updateOrCreate(
            [
                'tutoring_session_id' => $session->id,
                'tutor_profile_id' => $profile->id,
            ],
            [
                'notes' => $data['notes'],
                'follow_up' => $data['follow_up'] ?? null,
                'visible_to_parent' => (bool) ($data['visible_to_parent'] ?? false),
                'updated_by' => $request->user()->id,
                'created_by' => $request->user()->id,
            ]
        );

        return response()->json(['message' => 'Session note saved.', 'data' => $note], 201);
    }

    public function earnings(Request $request): JsonResponse
    {
        $this->guardTutor($request);
        $profile = $this->resolveProfile($request);

        $rows = TutorPayment::query()
            ->where('tutor_profile_id', $profile->id)
            ->orderByDesc('period_end')
            ->orderByDesc('id')
            ->limit(100)
            ->get()
            ->map(fn (TutorPayment $p) => [
                'id' => $p->id,
                'amount' => $p->amount,
                'currency' => $p->currency ?? 'SAR',
                'status' => $p->status,
                'period_start' => $p->period_start?->toDateString(),
                'period_end' => $p->period_end?->toDateString(),
                'paid_at' => $p->paid_at?->toIso8601String(),
                'reference' => $p->reference,
                'notes' => $p->notes,
            ]);

        $paid = (float) TutorPayment::query()->where('tutor_profile_id', $profile->id)->where('status', 'paid')->sum('amount');
        $pending = (float) TutorPayment::query()->where('tutor_profile_id', $profile->id)->whereIn('status', ['pending', 'approved', 'due'])->sum('amount');

        return response()->json([
            'data' => $rows,
            'meta' => [
                'stats' => [
                    'total' => $rows->count(),
                    'paid_total' => round($paid, 2),
                    'pending_total' => round($pending, 2),
                    'currency' => $rows->first()['currency'] ?? 'SAR',
                ],
            ],
        ]);
    }

    public function notifications(Request $request): JsonResponse
    {
        $this->guardTutor($request);
        $user = $request->user();
        $page = $this->notifications->listFor($user, (int) $request->integer('per_page', 10));

        return response()->json([
            'data' => collect($page->items())->map(fn ($n) => [
                'id' => $n->id,
                'type' => $n->type,
                'data' => $n->data,
                'read_at' => $n->read_at,
                'created_at' => $n->created_at?->toIso8601String(),
            ])->values(),
            'meta' => [
                'stats' => [
                    'total' => $page->total(),
                    'unread' => $this->notifications->unreadCount($user),
                ],
            ],
        ]);
    }

    public function markNotificationRead(Request $request, string $id): JsonResponse
    {
        $this->guardTutor($request);
        $row = $this->notifications->markRead($request->user(), $id);

        return response()->json(['message' => 'Marked as read.', 'data' => ['id' => $row->id, 'read_at' => $row->read_at]]);
    }

    public function markAllNotificationsRead(Request $request): JsonResponse
    {
        $this->guardTutor($request);
        $count = $this->notifications->markAllRead($request->user());

        return response()->json(['message' => 'All notifications marked as read.', 'data' => ['updated' => $count]]);
    }

    public function profile(Request $request): JsonResponse
    {
        $this->guardTutor($request);
        $user = $request->user();
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $profile = TutorProfile::query()
            ->where('school_id', $school->id)
            ->where('user_id', $user->id)
            ->with(['subjects:id,code,name_en'])
            ->first();

        return response()->json([
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'email' => $user->email,
                    'first_name' => $user->first_name,
                    'last_name' => $user->last_name,
                    'phone' => $user->phone ?? null,
                    'locale' => $user->locale ?? 'en',
                    'timezone' => $user->timezone ?? null,
                    'status' => $user->status,
                ],
                'tutor_profile' => $profile ? [
                    'id' => $profile->id,
                    'status' => $profile->status,
                    'bio_en' => $profile->bio_en,
                    'bio_ar' => $profile->bio_ar,
                    'hourly_rate' => $profile->hourly_rate ?? null,
                    'subjects' => $profile->subjects->map(fn ($s) => [
                        'id' => $s->id,
                        'code' => $s->code,
                        'name_en' => $s->name_en,
                    ])->values(),
                ] : null,
                'school' => [
                    'id' => $school->id,
                    'name_en' => $school->name_en,
                    'code' => $school->code,
                ],
            ],
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $this->guardTutor($request);
        $user = $request->user();
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $data = $request->validate([
            'first_name' => ['sometimes', 'string', 'max:100'],
            'last_name' => ['nullable', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:32'],
            'locale' => ['nullable', 'string', 'max:16'],
            'timezone' => ['nullable', 'string', 'max:64'],
            'bio_en' => ['nullable', 'string'],
            'bio_ar' => ['nullable', 'string'],
            'hourly_rate' => ['nullable', 'numeric', 'min:0'],
        ]);

        $profileFields = collect($data)->only(['bio_en', 'bio_ar', 'hourly_rate'])->all();

        DB::transaction(function () use ($user, $school, $data, $profileFields) {
            $user->fill(collect($data)->only(['first_name', 'last_name', 'phone', 'locale', 'timezone'])->all());
            $user->save();

            $profile = TutorProfile::query()
                ->where('school_id', $school->id)
                ->where('user_id', $user->id)
                ->first();

            // Teachers have no tutor profile until they supply tutoring details; create one lazily
            // rather than rejecting the whole save.
            if (! $profile && array_filter($profileFields, fn ($v) => $v !== null && $v !== '') === []) {
                return;
            }

            $profile ??= new TutorProfile([
                'tenant_id' => $school->tenant_id,
                'school_id' => $school->id,
                'user_id' => $user->id,
                'status' => 'active',
            ]);

            $profile->fill($profileFields);
            $profile->save();
        });

        return response()->json([
            'message' => 'Profile updated.',
            'data' => $this->profile($request)->getData(true)['data'],
        ]);
    }

    public function studentProgress(Request $request): JsonResponse
    {
        $this->guardTutor($request);
        $profile = $this->resolveProfile($request);
        $studentId = (int) $request->integer('student_user_id');
        abort_unless($studentId > 0, 422, 'student_user_id is required.');

        $linked = TutoringSession::query()
            ->where('tutor_profile_id', $profile->id)
            ->whereHas('participants', fn ($q) => $q->where('users.id', $studentId))
            ->exists();
        abort_unless($linked, 403);

        $student = User::query()->findOrFail($studentId);
        $sessions = TutoringSession::query()
            ->where('tutor_profile_id', $profile->id)
            ->whereHas('participants', fn ($q) => $q->where('users.id', $studentId))
            ->with(['subject:id,name_en', 'attendanceRecords' => fn ($q) => $q->where('student_user_id', $studentId)])
            ->orderByDesc('starts_at')
            ->limit(50)
            ->get()
            ->map(fn (TutoringSession $s) => [
                'id' => $s->id,
                'starts_at' => $s->starts_at?->toIso8601String(),
                'status' => $s->status,
                'subject' => $s->subject?->name_en,
                'attendance' => optional($s->attendanceRecords->first())->status,
            ]);

        $attendance = $sessions->pluck('attendance')->filter()->countBy()->all();

        return response()->json([
            'data' => [
                'student' => [
                    'user_id' => $student->id,
                    'first_name' => $student->first_name,
                    'last_name' => $student->last_name,
                    'email' => $student->email,
                ],
                'sessions' => $sessions,
                'attendance_summary' => $attendance,
                'stats' => [
                    'sessions' => $sessions->count(),
                    'completed' => $sessions->where('status', 'completed')->count(),
                    'upcoming' => $sessions->whereIn('status', ['scheduled', 'confirmed'])->count(),
                ],
            ],
        ]);
    }
}
