<?php

namespace App\Http\Controllers\Api\V1\Learner;

use App\Domain\Academics\Services\SchoolContextService;
use App\Domain\Billing\Models\StudentInvoice;
use App\Domain\Identity\Services\ChildAccessService;
use App\Domain\Identity\Services\RbacService;
use App\Domain\Learning\Models\LearnerMessage;
use App\Domain\Learning\Services\ParentPortalService;
use App\Domain\Notification\Services\PortalNotificationService;
use App\Domain\Organization\Models\SchoolNotification;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ParentPortalController extends Controller
{
    public function __construct(
        protected SchoolContextService $schoolContext,
        protected ParentPortalService $portal,
        protected ChildAccessService $children,
        protected PortalNotificationService $notifications,
        protected RbacService $rbac,
    ) {}

    public function dashboard(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'progress.view_child');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        return response()->json([
            'data' => $this->portal->dashboard($request->user(), $school->id),
        ]);
    }

    public function children(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'progress.view_child');

        return response()->json([
            'data' => $this->children->childrenFor($request->user())->map->only([
                'id', 'first_name', 'last_name', 'email', 'locale',
            ]),
        ]);
    }

    public function progress(Request $request, int $student): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'progress.view_child');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        return response()->json([
            'data' => $this->portal->childProgress($request->user(), $student, $school->id),
        ]);
    }

    public function attendance(Request $request, int $student): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'tutoring.attendance.view_child');

        return response()->json([
            'data' => $this->portal->childAttendance($request->user(), $student),
        ]);
    }

    public function homework(Request $request, int $student): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'homework.view_child');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        return response()->json([
            'data' => $this->portal->childHomework($request->user(), $student, $school->id),
        ]);
    }

    public function assessmentResults(Request $request, int $student): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'assessments.results.view_child');

        return response()->json([
            'data' => $this->portal->childAssessmentResults($request->user(), $student),
        ]);
    }

    public function tutorSessions(Request $request, int $student): JsonResponse
    {
        $user = $request->user();
        if (! ($this->rbac->can($user, 'tutoring.book') || $this->rbac->can($user, 'tutoring.attendance.view_child'))) {
            $this->rbac->authorize($user, 'tutoring.book');
        }
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        return response()->json([
            'data' => $this->portal->childTutorSessions($request->user(), $student, $school->id),
        ]);
    }

    public function notifications(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'progress.view_child');

        return response()->json(
            $this->notifications->listFor($request->user(), (int) $request->integer('per_page', 10))
        );
    }

    public function markNotificationRead(Request $request, string $notification): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'progress.view_child');

        return response()->json([
            'message' => 'Notification marked read.',
            'data' => $this->notifications->markRead($request->user(), $notification),
        ]);
    }

    public function markAllNotificationsRead(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'progress.view_child');
        $count = $this->notifications->markAllRead($request->user());

        return response()->json(['message' => 'All notifications marked read.', 'data' => ['updated' => $count]]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'progress.view_child');

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

    public function fees(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'progress.view_child');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $childIds = $this->children->childrenFor($request->user())->pluck('id');

        if ($request->filled('student_user_id')) {
            $studentId = (int) $request->integer('student_user_id');
            $this->children->assertLinked($request->user(), $studentId);
            $childIds = collect([$studentId]);
        }

        $invoices = StudentInvoice::query()
            ->with(['items', 'student:id,first_name,last_name,email'])
            ->where('school_id', $school->id)
            ->whereIn('student_user_id', $childIds)
            ->orderByDesc('issued_at')
            ->orderByDesc('id')
            ->get()
            ->map(function (StudentInvoice $invoice) {
                $student = $invoice->student;

                return [
                    'id' => $invoice->id,
                    'number' => $invoice->number,
                    'currency' => $invoice->currency,
                    'subtotal' => $invoice->subtotal,
                    'tax_total' => $invoice->tax_total,
                    'total' => $invoice->total,
                    'status' => $invoice->status,
                    'due_at' => $invoice->due_at,
                    'paid_at' => $invoice->paid_at,
                    'issued_at' => $invoice->issued_at,
                    'notes' => $invoice->notes,
                    'student_user_id' => $invoice->student_user_id,
                    'student_first_name' => $student?->first_name,
                    'student_last_name' => $student?->last_name,
                    'student_name' => $student
                        ? (trim(($student->first_name ?? '').' '.($student->last_name ?? '')) ?: $student->email)
                        : null,
                    'items' => $invoice->items,
                ];
            });

        return response()->json(['data' => $invoices]);
    }

    public function notices(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'progress.view_child');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $items = SchoolNotification::query()
            ->where('school_id', $school->id)
            ->where('status', 'sent')
            ->whereIn('audience', ['all', 'parents'])
            ->orderByDesc('sent_at')
            ->get();

        return response()->json(['data' => $items]);
    }

    public function messages(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'progress.view_child');
        $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $items = LearnerMessage::query()
            ->where('user_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['data' => $items]);
    }

    public function storeMessage(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'progress.view_child');
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
        $this->rbac->authorize($request->user(), 'progress.view_child');
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
