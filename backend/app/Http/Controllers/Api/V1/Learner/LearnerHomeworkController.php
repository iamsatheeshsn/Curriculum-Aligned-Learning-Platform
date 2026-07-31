<?php

namespace App\Http\Controllers\Api\V1\Learner;

use App\Domain\Academics\Services\SchoolContextService;
use App\Domain\Identity\Services\RbacService;
use App\Domain\Learning\Models\AssignmentSubmission;
use App\Domain\Learning\Models\HomeworkAssignment;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LearnerHomeworkController extends Controller
{
    public function __construct(
        protected SchoolContextService $schoolContext,
        protected RbacService $rbac,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'learning.content.consume');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $items = HomeworkAssignment::query()
            ->where('school_id', $school->id)
            ->where('status', 'published')
            ->orderByDesc('due_at')
            ->paginate((int) $request->integer('per_page', 10));

        return response()->json($items);
    }

    public function submit(Request $request, int $homework): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'learning.content.consume');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $hw = HomeworkAssignment::query()
            ->where('school_id', $school->id)
            ->where('status', 'published')
            ->findOrFail($homework);

        $data = $request->validate([
            'body_text' => ['nullable', 'string'],
            'file_path' => ['nullable', 'string', 'max:500'],
        ]);

        $late = $hw->due_at && now()->gt($hw->due_at);
        if ($late && ! $hw->allow_late) {
            return response()->json(['message' => 'Late submissions are not allowed.', 'code' => 'late_blocked'], 422);
        }

        $submission = AssignmentSubmission::query()->updateOrCreate(
            ['assignment_id' => $hw->id, 'student_user_id' => $request->user()->id],
            [
                'tenant_id' => $school->tenant_id,
                'body_text' => $data['body_text'] ?? null,
                'file_path' => $data['file_path'] ?? null,
                'submitted_at' => now(),
                'is_late' => $late,
                'status' => 'submitted',
            ]
        );

        return response()->json(['message' => 'Homework submitted.', 'data' => $submission]);
    }
}
