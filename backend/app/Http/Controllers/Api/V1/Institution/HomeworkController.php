<?php

namespace App\Http\Controllers\Api\V1\Institution;

use App\Domain\Academics\Services\SchoolContextService;
use App\Domain\Identity\Services\RbacService;
use App\Domain\Learning\Models\AssignmentSubmission;
use App\Domain\Learning\Models\HomeworkAssignment;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HomeworkController extends Controller
{
    public function __construct(
        protected SchoolContextService $schoolContext,
        protected RbacService $rbac,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'learning.content.assign');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $items = HomeworkAssignment::query()
            ->where('school_id', $school->id)
            ->when($request->filled('class_section_id'), fn ($q) => $q->where('class_section_id', $request->integer('class_section_id')))
            ->withCount('submissions')
            ->orderByDesc('id')
            ->paginate((int) $request->integer('per_page', 10));

        return response()->json($items);
    }

    public function store(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'learning.content.assign');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $data = $request->validate([
            'subject_id' => ['nullable', 'integer'],
            'class_section_id' => ['nullable', 'integer'],
            'title_en' => ['required', 'string', 'max:255'],
            'title_ar' => ['required', 'string', 'max:255'],
            'instructions_en' => ['nullable', 'string'],
            'instructions_ar' => ['nullable', 'string'],
            'due_at' => ['nullable', 'date'],
            'allow_late' => ['nullable', 'boolean'],
            'is_scored' => ['nullable', 'boolean'],
            'max_score' => ['nullable', 'numeric', 'min:0'],
            'include_in_reports' => ['nullable', 'boolean'],
            'status' => ['nullable', 'in:draft,published,closed'],
        ]);

        $hw = HomeworkAssignment::query()->create([
            ...$data,
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'allow_late' => $data['allow_late'] ?? true,
            'is_scored' => $data['is_scored'] ?? false,
            'include_in_reports' => $data['include_in_reports'] ?? true,
            'status' => $data['status'] ?? 'published',
        ]);

        return response()->json(['message' => 'Homework created.', 'data' => $hw], 201);
    }

    public function show(Request $request, int $homework): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'learning.content.assign');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $model = HomeworkAssignment::query()
            ->where('school_id', $school->id)
            ->with('submissions')
            ->findOrFail($homework);

        return response()->json(['data' => $model]);
    }

    public function reviewSubmission(Request $request, int $homework, int $submission): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'assessments.grade');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        HomeworkAssignment::query()->where('school_id', $school->id)->findOrFail($homework);
        $row = AssignmentSubmission::query()->where('assignment_id', $homework)->findOrFail($submission);

        $data = $request->validate([
            'score' => ['nullable', 'numeric', 'min:0'],
            'feedback' => ['nullable', 'string'],
            'status' => ['sometimes', 'in:submitted,returned,graded'],
        ]);

        $row->update([
            ...$data,
            'status' => $data['status'] ?? 'graded',
        ]);

        return response()->json(['message' => 'Submission reviewed.', 'data' => $row->fresh()]);
    }
}
