<?php

namespace App\Http\Controllers\Api\V1\Institution;

use App\Domain\Academics\Services\SchoolContextService;
use App\Domain\Assessment\Models\AssessmentAttempt;
use App\Domain\Assessment\Models\AssessmentResponse;
use App\Domain\Assessment\Services\GradingService;
use App\Domain\Identity\Services\RbacService;
use App\Domain\Learning\Models\LearningProgress;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GradingController extends Controller
{
    public function __construct(
        protected SchoolContextService $schoolContext,
        protected GradingService $grading,
        protected RbacService $rbac,
    ) {}

    public function reviewQueue(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'assessments.grade');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $items = AssessmentAttempt::query()
            ->where('status', 'submitted')
            ->whereHas('assessment', fn ($q) => $q->where('school_id', $school->id))
            ->with([
                'assessment:id,title_en,title_ar,type',
                'responses' => fn ($q) => $q->whereNull('points_awarded'),
            ])
            ->orderBy('submitted_at')
            ->paginate((int) $request->integer('per_page', 10));

        return response()->json($items);
    }

    public function gradeResponse(Request $request, int $response): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'assessments.grade');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $row = AssessmentResponse::query()
            ->whereHas('attempt.assessment', fn ($q) => $q->where('school_id', $school->id))
            ->findOrFail($response);

        $data = $request->validate([
            'points_awarded' => ['required', 'numeric', 'min:0'],
            'is_correct' => ['nullable', 'boolean'],
        ]);

        $graded = $this->grading->manualGrade(
            $row,
            (float) $data['points_awarded'],
            $data['is_correct'] ?? null,
            $request->user()->id,
        );

        return response()->json(['message' => 'Response graded.', 'data' => $graded]);
    }

    public function classProgress(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'progress.view_class');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $learning = LearningProgress::query()
            ->where('school_id', $school->id)
            ->when($request->filled('interactive_lesson_id'), fn ($q) => $q->where('interactive_lesson_id', $request->integer('interactive_lesson_id')))
            ->orderByDesc('updated_at')
            ->limit(100)
            ->get();

        $attempts = AssessmentAttempt::query()
            ->whereHas('assessment', fn ($q) => $q->where('school_id', $school->id)->where('counts_toward_grade', true))
            ->whereIn('status', ['graded', 'submitted'])
            ->with('assessment:id,title_en,type,counts_toward_grade')
            ->orderByDesc('submitted_at')
            ->limit(100)
            ->get();

        return response()->json([
            'data' => [
                'learning_progress' => $learning,
                'assessment_attempts' => $attempts,
            ],
        ]);
    }
}
