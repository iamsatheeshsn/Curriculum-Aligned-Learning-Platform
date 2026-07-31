<?php

namespace App\Http\Controllers\Api\V1\Institution;

use App\Domain\Academics\Models\Subject;
use App\Domain\Academics\Services\SchoolContextService;
use App\Domain\Identity\Services\RbacService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SubjectController extends Controller
{
    public function __construct(
        protected SchoolContextService $schoolContext,
        protected RbacService $rbac,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'curriculum.view');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $items = Subject::query()
            ->where('school_id', $school->id)
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->filled('curriculum_id'), fn ($q) => $q->where('curriculum_id', $request->integer('curriculum_id')))
            ->when($request->boolean('stem_only'), fn ($q) => $q->where('is_stem', true))
            ->orderBy('code')
            ->paginate((int) $request->integer('per_page', 10));

        return response()->json($items);
    }

    public function store(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'curriculum.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $data = $request->validate([
            'code' => ['required', 'string', 'max:64'],
            'name_en' => ['required', 'string', 'max:191'],
            'name_ar' => ['required', 'string', 'max:191'],
            'is_stem' => ['nullable', 'boolean'],
            'tutoring_enabled' => ['nullable', 'boolean'],
            'status' => ['nullable', 'in:active,archived'],
            'curriculum_id' => ['nullable', 'integer'],
        ]);

        $subject = Subject::query()->create([
            ...$data,
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'is_stem' => $data['is_stem'] ?? true,
            'tutoring_enabled' => $data['tutoring_enabled'] ?? true,
            'status' => $data['status'] ?? 'active',
        ]);

        return response()->json(['message' => 'Subject created.', 'data' => $subject], 201);
    }

    public function update(Request $request, int $subject): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'curriculum.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = Subject::query()->where('school_id', $school->id)->findOrFail($subject);

        $data = $request->validate([
            'code' => ['sometimes', 'string', 'max:64'],
            'name_en' => ['sometimes', 'string', 'max:191'],
            'name_ar' => ['sometimes', 'string', 'max:191'],
            'is_stem' => ['nullable', 'boolean'],
            'tutoring_enabled' => ['nullable', 'boolean'],
            'status' => ['sometimes', 'in:active,archived'],
        ]);

        $model->update($data);

        return response()->json(['message' => 'Subject updated.', 'data' => $model->fresh()]);
    }

    public function destroy(Request $request, int $subject): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'curriculum.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        Subject::query()->where('school_id', $school->id)->findOrFail($subject)->delete();

        return response()->json(['message' => 'Subject deleted.']);
    }
}
