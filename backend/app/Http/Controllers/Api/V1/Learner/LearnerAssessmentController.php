<?php

namespace App\Http\Controllers\Api\V1\Learner;

use App\Domain\Academics\Services\SchoolContextService;
use App\Domain\Assessment\Models\Assessment;
use App\Domain\Assessment\Models\AssessmentAttempt;
use App\Domain\Assessment\Services\GradingService;
use App\Domain\Identity\Services\RbacService;
use App\Domain\Learning\Models\LearningProgress;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LearnerAssessmentController extends Controller
{
    public function __construct(
        protected SchoolContextService $schoolContext,
        protected GradingService $grading,
        protected RbacService $rbac,
    ) {}

    public function available(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'assessments.attempt');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $items = Assessment::query()
            ->where('school_id', $school->id)
            ->where('status', 'published')
            ->when($request->filled('type'), fn ($q) => $q->where('type', $request->string('type')))
            ->orderByDesc('id')
            ->paginate((int) $request->integer('per_page', 10));

        return response()->json($items);
    }

    public function start(Request $request, int $assessment): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'assessments.attempt');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = Assessment::query()->where('school_id', $school->id)->findOrFail($assessment);

        $locale = $request->string('locale', 'en')->toString();
        $attempt = $this->grading->startAttempt($model, $request->user()->id, $locale);

        $payload = $attempt->toArray();
        if (isset($payload['assessment']['assessment_questions'])) {
            foreach ($payload['assessment']['assessment_questions'] as &$aq) {
                if (isset($aq['question']['options'])) {
                    foreach ($aq['question']['options'] as &$opt) {
                        unset($opt['is_correct']);
                    }
                }
            }
            unset($aq, $opt);
        }

        return response()->json(['message' => 'Attempt started.', 'data' => $payload], 201);
    }

    public function submit(Request $request, int $attempt): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'assessments.attempt');
        $row = AssessmentAttempt::query()
            ->where('student_user_id', $request->user()->id)
            ->findOrFail($attempt);

        $data = $request->validate([
            'answers' => ['required', 'array'],
            'answers.*.question_id' => ['required', 'integer'],
            'answers.*.response' => ['nullable', 'array'],
        ]);

        $result = $this->grading->submitAttempt($row, $data['answers']);

        return response()->json(['message' => 'Attempt submitted.', 'data' => $result]);
    }

    public function myResults(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'assessments.results.view_own');

        $items = AssessmentAttempt::query()
            ->where('student_user_id', $request->user()->id)
            ->whereIn('status', ['graded', 'submitted'])
            ->with('assessment:id,title_en,title_ar,type,show_results')
            ->orderByDesc('submitted_at')
            ->paginate((int) $request->integer('per_page', 10));

        return response()->json($items);
    }

    public function myProgress(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'progress.view_own');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        return response()->json([
            'data' => LearningProgress::query()
                ->where('school_id', $school->id)
                ->where('student_user_id', $request->user()->id)
                ->with('lesson:id,title_en,title_ar')
                ->orderByDesc('updated_at')
                ->get(),
        ]);
    }
}
