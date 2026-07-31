<?php

namespace App\Http\Controllers\Api\V1\Institution;

use App\Domain\Academics\Services\SchoolContextService;
use App\Domain\Assessment\Models\Question;
use App\Domain\Assessment\Services\QuestionBankService;
use App\Domain\Identity\Services\RbacService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class QuestionBankController extends Controller
{
    public function __construct(
        protected SchoolContextService $schoolContext,
        protected QuestionBankService $bank,
        protected RbacService $rbac,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'assessments.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $items = Question::query()
            ->where('school_id', $school->id)
            ->when($request->filled('type'), fn ($q) => $q->where('type', $request->string('type')))
            ->when($request->filled('subject_id'), fn ($q) => $q->where('subject_id', $request->integer('subject_id')))
            ->with(['translations', 'options'])
            ->orderByDesc('id')
            ->paginate((int) $request->integer('per_page', 10));

        return response()->json($items);
    }

    public function store(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'assessments.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $data = $request->validate([
            'subject_id' => ['nullable', 'integer'],
            'type' => ['required', 'in:mcq,multi,boolean,numeric,short_text'],
            'difficulty' => ['nullable', 'in:easy,medium,hard'],
            'default_points' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', 'in:active,archived'],
            'translations' => ['required', 'array', 'min:1'],
            'translations.*.locale' => ['required', 'string', 'max:10'],
            'translations.*.stem' => ['required', 'string'],
            'translations.*.explanation' => ['nullable', 'string'],
            'options' => ['nullable', 'array'],
            'options.*.locale' => ['nullable', 'string', 'max:10'],
            'options.*.label' => ['required', 'string', 'max:500'],
            'options.*.is_correct' => ['nullable', 'boolean'],
            'options.*.sequence' => ['nullable', 'integer', 'min:1'],
            'learning_outcome_ids' => ['nullable', 'array'],
            'learning_outcome_ids.*' => ['integer'],
        ]);

        $question = $this->bank->create($school, $data);

        return response()->json(['message' => 'Question created.', 'data' => $question], 201);
    }

    public function show(Request $request, int $question): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'assessments.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $model = Question::query()
            ->where('school_id', $school->id)
            ->with(['translations', 'options', 'learningOutcomes'])
            ->findOrFail($question);

        return response()->json(['data' => $model]);
    }
}
