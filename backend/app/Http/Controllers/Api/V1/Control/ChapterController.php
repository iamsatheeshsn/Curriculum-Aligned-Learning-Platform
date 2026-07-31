<?php

namespace App\Http\Controllers\Api\V1\Control;

use App\Domain\Curriculum\Models\Chapter;
use App\Domain\Curriculum\Services\ControlChapterService;
use App\Domain\Identity\Services\RbacService;
use App\Domain\Organization\Models\Tenant;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChapterController extends Controller
{
    public function __construct(
        protected ControlChapterService $chapters,
        protected RbacService $rbac,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->guard();

        $data = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'in:draft,published,archived'],
            'tenant_id' => ['nullable', 'integer'],
            'school_id' => ['nullable', 'integer'],
            'curriculum_id' => ['nullable', 'integer'],
            'subject_id' => ['nullable', 'integer'],
            'grade_id' => ['nullable', 'integer'],
        ]);

        $schoolId = isset($data['school_id']) ? (int) $data['school_id'] : null;
        $curriculumId = isset($data['curriculum_id']) ? (int) $data['curriculum_id'] : null;

        return response()->json([
            'data' => $this->chapters->list([
                'search' => $data['search'] ?? null,
                'status' => $data['status'] ?? null,
                'tenant_id' => $data['tenant_id'] ?? null,
                'school_id' => $schoolId,
                'curriculum_id' => $curriculumId,
                'subject_id' => $data['subject_id'] ?? null,
                'grade_id' => $data['grade_id'] ?? null,
            ]),
            'meta' => [
                'stats' => $this->chapters->stats(),
                'tenants' => $this->chapters->availableSchools(),
                ...$this->chapters->lookupOptions($schoolId, $curriculumId),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->guard();

        $data = $request->validate([
            'school_id' => ['required', 'integer'],
            'curriculum_id' => ['required', 'integer'],
            'subject_id' => ['required', 'integer'],
            'grade_id' => ['required', 'integer'],
            'title_en' => ['required', 'string', 'max:255'],
            'title_ar' => ['nullable', 'string', 'max:255'],
            'sequence' => ['nullable', 'integer', 'min:1'],
            'status' => ['nullable', 'in:draft,published,archived'],
        ]);

        return response()->json([
            'message' => 'Chapter created.',
            'data' => $this->chapters->create($data, $request->user()->id),
        ], 201);
    }

    public function show(int $chapter): JsonResponse
    {
        $this->guard();
        $model = Chapter::query()
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'))
            ->findOrFail($chapter);

        return response()->json([
            'data' => $this->chapters->show($model),
        ]);
    }

    public function update(Request $request, int $chapter): JsonResponse
    {
        $this->guard();
        $model = Chapter::query()
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'))
            ->findOrFail($chapter);

        $data = $request->validate([
            'school_id' => ['sometimes', 'integer'],
            'curriculum_id' => ['sometimes', 'integer'],
            'subject_id' => ['sometimes', 'integer'],
            'grade_id' => ['sometimes', 'integer'],
            'title_en' => ['sometimes', 'required', 'string', 'max:255'],
            'title_ar' => ['nullable', 'string', 'max:255'],
            'sequence' => ['sometimes', 'integer', 'min:1'],
            'status' => ['sometimes', 'in:draft,published,archived'],
        ]);

        return response()->json([
            'message' => 'Chapter updated.',
            'data' => $this->chapters->update($model, $data, $request->user()->id),
        ]);
    }

    public function destroy(int $chapter): JsonResponse
    {
        $this->guard();
        $model = Chapter::query()
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'))
            ->findOrFail($chapter);
        $this->chapters->delete($model);

        return response()->json([
            'message' => 'Chapter deleted.',
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
