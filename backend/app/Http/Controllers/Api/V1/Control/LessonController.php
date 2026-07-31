<?php

namespace App\Http\Controllers\Api\V1\Control;

use App\Domain\Curriculum\Models\CurriculumLesson;
use App\Domain\Curriculum\Services\ControlLessonService;
use App\Domain\Identity\Services\RbacService;
use App\Domain\Organization\Models\Tenant;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LessonController extends Controller
{
    public function __construct(
        protected ControlLessonService $lessons,
        protected RbacService $rbac,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->guard();

        $data = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'in:draft,published,archived'],
            'difficulty' => ['nullable', 'in:easy,medium,hard'],
            'tenant_id' => ['nullable', 'integer'],
            'school_id' => ['nullable', 'integer'],
            'curriculum_id' => ['nullable', 'integer'],
            'chapter_id' => ['nullable', 'integer'],
        ]);

        $schoolId = isset($data['school_id']) ? (int) $data['school_id'] : null;
        $curriculumId = isset($data['curriculum_id']) ? (int) $data['curriculum_id'] : null;

        return response()->json([
            'data' => $this->lessons->list([
                'search' => $data['search'] ?? null,
                'status' => $data['status'] ?? null,
                'difficulty' => $data['difficulty'] ?? null,
                'tenant_id' => $data['tenant_id'] ?? null,
                'school_id' => $schoolId,
                'curriculum_id' => $curriculumId,
                'chapter_id' => $data['chapter_id'] ?? null,
            ]),
            'meta' => [
                'stats' => $this->lessons->stats(),
                'tenants' => $this->lessons->availableSchools(),
                ...$this->lessons->lookupOptions($schoolId, $curriculumId),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->guard();

        $data = $request->validate([
            'school_id' => ['required', 'integer'],
            'curriculum_id' => ['required', 'integer'],
            'chapter_id' => ['required', 'integer'],
            'code' => ['nullable', 'string', 'max:64'],
            'title_en' => ['required', 'string', 'max:255'],
            'title_ar' => ['nullable', 'string', 'max:255'],
            'summary_en' => ['nullable', 'string'],
            'summary_ar' => ['nullable', 'string'],
            'sequence' => ['nullable', 'integer', 'min:1'],
            'estimated_minutes' => ['nullable', 'integer', 'min:1'],
            'difficulty' => ['nullable', 'in:easy,medium,hard'],
            'status' => ['nullable', 'in:draft,published,archived'],
            'learning_outcome_ids' => ['nullable', 'array'],
            'learning_outcome_ids.*' => ['integer'],
        ]);

        return response()->json([
            'message' => 'Lesson created.',
            'data' => $this->lessons->create($data, $request->user()->id),
        ], 201);
    }

    public function show(int $lesson): JsonResponse
    {
        $this->guard();
        $model = CurriculumLesson::query()
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'))
            ->findOrFail($lesson);

        return response()->json([
            'data' => $this->lessons->show($model),
        ]);
    }

    public function update(Request $request, int $lesson): JsonResponse
    {
        $this->guard();
        $model = CurriculumLesson::query()
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'))
            ->findOrFail($lesson);

        $data = $request->validate([
            'school_id' => ['sometimes', 'integer'],
            'curriculum_id' => ['sometimes', 'integer'],
            'chapter_id' => ['sometimes', 'integer'],
            'code' => ['nullable', 'string', 'max:64'],
            'title_en' => ['sometimes', 'required', 'string', 'max:255'],
            'title_ar' => ['nullable', 'string', 'max:255'],
            'summary_en' => ['nullable', 'string'],
            'summary_ar' => ['nullable', 'string'],
            'sequence' => ['sometimes', 'integer', 'min:1'],
            'estimated_minutes' => ['nullable', 'integer', 'min:1'],
            'difficulty' => ['nullable', 'in:easy,medium,hard'],
            'status' => ['sometimes', 'in:draft,published,archived'],
            'learning_outcome_ids' => ['nullable', 'array'],
            'learning_outcome_ids.*' => ['integer'],
        ]);

        return response()->json([
            'message' => 'Lesson updated.',
            'data' => $this->lessons->update($model, $data, $request->user()->id),
        ]);
    }

    public function destroy(int $lesson): JsonResponse
    {
        $this->guard();
        $model = CurriculumLesson::query()
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'))
            ->findOrFail($lesson);
        $this->lessons->delete($model);

        return response()->json([
            'message' => 'Lesson deleted.',
        ]);
    }

    protected function guard(): void
    {
        $user = request()->user();
        abort_unless(
            $user?->hasRole('super_admin')
                || $this->rbac->can($user, 'platform.tenants.manage')
                || $this->rbac->can($user, 'curriculum.manage'),
            403
        );
        $this->authorize('viewAny', Tenant::class);
    }
}
