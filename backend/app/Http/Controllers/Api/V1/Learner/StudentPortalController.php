<?php

namespace App\Http\Controllers\Api\V1\Learner;

use App\Domain\Academics\Services\SchoolContextService;
use App\Domain\Identity\Services\RbacService;
use App\Domain\Learning\Models\LearnerMessage;
use App\Domain\Learning\Services\StudentPortalService;
use App\Domain\Notification\Services\PortalNotificationService;
use App\Domain\Reporting\Models\Certificate;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StudentPortalController extends Controller
{
    public function __construct(
        protected SchoolContextService $schoolContext,
        protected StudentPortalService $portal,
        protected PortalNotificationService $notifications,
        protected RbacService $rbac,
    ) {}

    public function dashboard(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'progress.view_own');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        return response()->json([
            'data' => $this->portal->dashboard($request->user(), $school->id),
        ]);
    }

    public function courses(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'learning.content.consume');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        return response()->json([
            'data' => $this->portal->courses($request->user(), $school->id),
        ]);
    }

    public function lessons(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'learning.content.consume');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        return response()->json([
            'data' => $this->portal->lessons($request->user(), $school->id),
        ]);
    }

    public function homework(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'learning.content.consume');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        return response()->json([
            'data' => $this->portal->homework($request->user(), $school->id),
        ]);
    }

    public function assessments(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'assessments.attempt');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        return response()->json([
            'data' => $this->portal->assessments($request->user(), $school->id),
        ]);
    }

    public function progress(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'progress.view_own');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        return response()->json([
            'data' => $this->portal->progressSummary($request->user(), $school->id),
        ]);
    }

    public function certificates(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'progress.view_own');

        $items = Certificate::query()
            ->where('student_user_id', $request->user()->id)
            ->whereNull('voided_at')
            ->orderByDesc('issued_at')
            ->get();

        return response()->json(['data' => $items]);
    }

    public function notifications(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'progress.view_own');

        return response()->json(
            $this->notifications->listFor($request->user(), (int) $request->integer('per_page', 10))
        );
    }

    public function markNotificationRead(Request $request, string $notification): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'progress.view_own');

        return response()->json([
            'message' => 'Notification marked read.',
            'data' => $this->notifications->markRead($request->user(), $notification),
        ]);
    }

    public function markAllNotificationsRead(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'progress.view_own');
        $count = $this->notifications->markAllRead($request->user());

        return response()->json(['message' => 'All notifications marked read.', 'data' => ['updated' => $count]]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'progress.view_own');

        $data = $request->validate([
            'first_name' => ['sometimes', 'string', 'max:100'],
            'last_name' => ['nullable', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:32'],
            'locale' => ['nullable', 'string', 'max:16'],
            'timezone' => ['nullable', 'string', 'max:64'],
        ]);

        $user = $request->user();
        $user->fill(collect($data)->only(['first_name', 'last_name', 'phone', 'locale', 'timezone'])->all());
        $user->save();

        return response()->json([
            'message' => 'Profile updated.',
            'data' => $user->only(['id', 'first_name', 'last_name', 'email', 'phone', 'locale', 'timezone']),
        ]);
    }

    public function messages(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'progress.view_own');
        $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $items = LearnerMessage::query()
            ->where('user_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['data' => $items]);
    }

    public function storeMessage(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'progress.view_own');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $data = $request->validate([
            'subject' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string'],
        ]);

        $message = LearnerMessage::query()->create([
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'user_id' => $request->user()->id,
            'direction' => 'outbound',
            'subject' => $data['subject'],
            'body' => $data['body'],
        ]);

        return response()->json([
            'message' => 'Message sent.',
            'data' => $message,
        ], 201);
    }

    public function markMessageRead(Request $request, int $id): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'progress.view_own');
        $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $message = LearnerMessage::query()
            ->where('user_id', $request->user()->id)
            ->findOrFail($id);

        if ($message->read_at === null) {
            $message->read_at = now();
            $message->save();
        }

        return response()->json([
            'message' => 'Message marked read.',
            'data' => $message,
        ]);
    }
}
