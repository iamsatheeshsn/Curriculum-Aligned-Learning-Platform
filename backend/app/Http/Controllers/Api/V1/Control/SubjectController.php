<?php

namespace App\Http\Controllers\Api\V1\Control;

use App\Domain\Academics\Models\Subject;
use App\Domain\Academics\Services\ControlSubjectService;
use App\Domain\Identity\Services\RbacService;
use App\Domain\Organization\Models\Tenant;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SubjectController extends Controller
{
    public function __construct(
        protected ControlSubjectService $subjects,
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
            'stem_only' => ['nullable', 'boolean'],
        ]);

        return response()->json([
            'data' => $this->subjects->list([
                'search' => $data['search'] ?? null,
                'status' => $data['status'] ?? null,
                'tenant_id' => $data['tenant_id'] ?? null,
                'school_id' => $data['school_id'] ?? null,
                'curriculum_id' => $data['curriculum_id'] ?? null,
                'stem_only' => (bool) ($data['stem_only'] ?? false),
            ]),
            'meta' => [
                'stats' => $this->subjects->stats(),
                'tenants' => $this->subjects->availableSchools(),
                'curricula' => $this->subjects->availableCurricula(
                    isset($data['school_id']) ? (int) $data['school_id'] : null
                ),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->guard();

        $data = $request->validate([
            'school_id' => ['required', 'integer'],
            'curriculum_id' => ['nullable', 'integer'],
            'code' => ['required', 'string', 'max:64'],
            'name_en' => ['required', 'string', 'max:191'],
            'name_ar' => ['nullable', 'string', 'max:191'],
            'is_stem' => ['nullable', 'boolean'],
            'tutoring_enabled' => ['nullable', 'boolean'],
            'status' => ['nullable', 'in:active,archived'],
        ]);

        return response()->json([
            'message' => 'Subject created.',
            'data' => $this->subjects->create($data, $request->user()->id),
        ], 201);
    }

    public function show(int $subject): JsonResponse
    {
        $this->guard();
        $model = Subject::query()
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'))
            ->findOrFail($subject);

        return response()->json([
            'data' => $this->subjects->show($model),
        ]);
    }

    public function update(Request $request, int $subject): JsonResponse
    {
        $this->guard();
        $model = Subject::query()
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'))
            ->findOrFail($subject);

        $data = $request->validate([
            'school_id' => ['sometimes', 'integer'],
            'curriculum_id' => ['nullable', 'integer'],
            'code' => ['sometimes', 'string', 'max:64'],
            'name_en' => ['sometimes', 'required', 'string', 'max:191'],
            'name_ar' => ['nullable', 'string', 'max:191'],
            'is_stem' => ['nullable', 'boolean'],
            'tutoring_enabled' => ['nullable', 'boolean'],
            'status' => ['sometimes', 'in:active,archived'],
        ]);

        return response()->json([
            'message' => 'Subject updated.',
            'data' => $this->subjects->update($model, $data, $request->user()->id),
        ]);
    }

    public function destroy(int $subject): JsonResponse
    {
        $this->guard();
        $model = Subject::query()
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'))
            ->findOrFail($subject);
        $this->subjects->delete($model);

        return response()->json([
            'message' => 'Subject deleted.',
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
