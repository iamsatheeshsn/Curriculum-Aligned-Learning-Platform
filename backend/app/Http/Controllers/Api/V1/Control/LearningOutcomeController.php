<?php

namespace App\Http\Controllers\Api\V1\Control;

use App\Domain\Curriculum\Models\LearningOutcome;
use App\Domain\Curriculum\Services\ControlLearningOutcomeService;
use App\Domain\Identity\Services\RbacService;
use App\Domain\Organization\Models\Tenant;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LearningOutcomeController extends Controller
{
    public function __construct(
        protected ControlLearningOutcomeService $outcomes,
        protected RbacService $rbac,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->guard();

        $data = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'in:active,archived'],
            'tenant_id' => ['nullable', 'integer'],
            'school_id' => ['nullable', 'integer'],
            'curriculum_id' => ['nullable', 'integer'],
            'subject_id' => ['nullable', 'integer'],
        ]);

        $schoolId = isset($data['school_id']) ? (int) $data['school_id'] : null;
        $curriculumId = isset($data['curriculum_id']) ? (int) $data['curriculum_id'] : null;

        return response()->json([
            'data' => $this->outcomes->list([
                'search' => $data['search'] ?? null,
                'status' => $data['status'] ?? null,
                'tenant_id' => $data['tenant_id'] ?? null,
                'school_id' => $schoolId,
                'curriculum_id' => $curriculumId,
                'subject_id' => $data['subject_id'] ?? null,
            ]),
            'meta' => [
                'stats' => $this->outcomes->stats(),
                'tenants' => $this->outcomes->availableSchools(),
                ...$this->outcomes->lookupOptions($schoolId, $curriculumId),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->guard();

        $data = $request->validate([
            'school_id' => ['required', 'integer'],
            'curriculum_id' => ['required', 'integer'],
            'subject_id' => ['nullable', 'integer'],
            'code' => ['required', 'string', 'max:64'],
            'statement_en' => ['required', 'string'],
            'statement_ar' => ['nullable', 'string'],
            'status' => ['nullable', 'in:active,archived'],
        ]);

        return response()->json([
            'message' => 'Learning outcome created.',
            'data' => $this->outcomes->create($data, $request->user()->id),
        ], 201);
    }

    public function show(int $outcome): JsonResponse
    {
        $this->guard();
        $model = LearningOutcome::query()
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'))
            ->findOrFail($outcome);

        return response()->json([
            'data' => $this->outcomes->show($model),
        ]);
    }

    public function update(Request $request, int $outcome): JsonResponse
    {
        $this->guard();
        $model = LearningOutcome::query()
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'))
            ->findOrFail($outcome);

        $data = $request->validate([
            'school_id' => ['sometimes', 'integer'],
            'curriculum_id' => ['sometimes', 'integer'],
            'subject_id' => ['nullable', 'integer'],
            'code' => ['sometimes', 'required', 'string', 'max:64'],
            'statement_en' => ['sometimes', 'required', 'string'],
            'statement_ar' => ['nullable', 'string'],
            'status' => ['sometimes', 'in:active,archived'],
        ]);

        return response()->json([
            'message' => 'Learning outcome updated.',
            'data' => $this->outcomes->update($model, $data, $request->user()->id),
        ]);
    }

    public function destroy(int $outcome): JsonResponse
    {
        $this->guard();
        $model = LearningOutcome::query()
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'))
            ->findOrFail($outcome);
        $this->outcomes->delete($model);

        return response()->json([
            'message' => 'Learning outcome deleted.',
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
