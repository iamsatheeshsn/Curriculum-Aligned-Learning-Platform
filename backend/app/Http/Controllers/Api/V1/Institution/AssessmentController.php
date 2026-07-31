<?php

namespace App\Http\Controllers\Api\V1\Institution;

use App\Domain\Academics\Services\SchoolContextService;
use App\Domain\Assessment\Models\Assessment;
use App\Domain\Assessment\Services\AssessmentBuilderService;
use App\Domain\Identity\Services\RbacService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AssessmentController extends Controller
{
    public function __construct(
        protected SchoolContextService $schoolContext,
        protected AssessmentBuilderService $builder,
        protected RbacService $rbac,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'assessments.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $items = Assessment::query()
            ->where('school_id', $school->id)
            ->when($request->filled('type'), fn ($q) => $q->where('type', $request->string('type')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->withCount('assessmentQuestions')
            ->orderByDesc('id')
            ->paginate((int) $request->integer('per_page', 10));

        return response()->json($items);
    }

    public function store(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'assessments.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $data = $request->validate([
            'type' => ['required', 'in:quiz,exam,homework,practice'],
            'title_en' => ['required', 'string', 'max:255'],
            'title_ar' => ['required', 'string', 'max:255'],
            'instructions_en' => ['nullable', 'string'],
            'instructions_ar' => ['nullable', 'string'],
            'subject_id' => ['nullable', 'integer'],
            'term_id' => ['nullable', 'integer'],
            'class_section_id' => ['nullable', 'integer'],
            'time_limit_seconds' => ['nullable', 'integer', 'min:60'],
            'max_attempts' => ['nullable', 'integer', 'min:1'],
            'available_from' => ['nullable', 'date'],
            'available_until' => ['nullable', 'date', 'after:available_from'],
            'shuffle_questions' => ['nullable', 'boolean'],
            'show_results' => ['nullable', 'in:never,after_submit,after_due'],
            'counts_toward_grade' => ['nullable', 'boolean'],
        ]);

        $assessment = $this->builder->create($school, $data);

        return response()->json(['message' => 'Assessment created.', 'data' => $assessment], 201);
    }

    public function show(Request $request, int $assessment): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'assessments.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $model = Assessment::query()
            ->where('school_id', $school->id)
            ->with(['assessmentQuestions.question.translations', 'assessmentQuestions.question.options'])
            ->findOrFail($assessment);

        return response()->json(['data' => $model]);
    }

    public function attachQuestion(Request $request, int $assessment): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'assessments.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = Assessment::query()->where('school_id', $school->id)->findOrFail($assessment);

        $data = $request->validate([
            'question_id' => ['required', 'integer'],
            'points' => ['nullable', 'numeric', 'min:0'],
            'sequence' => ['nullable', 'integer', 'min:1'],
        ]);

        $row = $this->builder->attachQuestion($model, $data['question_id'], $data['points'] ?? null, $data['sequence'] ?? null);

        return response()->json(['message' => 'Question attached.', 'data' => $row], 201);
    }

    public function publish(Request $request, int $assessment): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'assessments.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = Assessment::query()->where('school_id', $school->id)->findOrFail($assessment);

        return response()->json([
            'message' => 'Assessment published.',
            'data' => $this->builder->publish($model),
        ]);
    }
}
