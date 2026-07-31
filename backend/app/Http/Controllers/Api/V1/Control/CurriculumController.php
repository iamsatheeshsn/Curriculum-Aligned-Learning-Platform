<?php

namespace App\Http\Controllers\Api\V1\Control;

use App\Domain\Curriculum\Models\Curriculum;
use App\Domain\Curriculum\Services\ControlCurriculumService;
use App\Domain\Identity\Services\RbacService;
use App\Domain\Organization\Models\Tenant;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CurriculumController extends Controller
{
    public function __construct(
        protected ControlCurriculumService $curricula,
        protected RbacService $rbac,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->guard();

        $data = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'in:draft,in_review,published,superseded'],
            'country_id' => ['nullable', 'integer'],
            'scope' => ['nullable', 'in:all,platform,school'],
            'latest_only' => ['nullable', 'boolean'],
        ]);

        return response()->json([
            'data' => $this->curricula->list([
                'search' => $data['search'] ?? null,
                'status' => $data['status'] ?? null,
                'country_id' => $data['country_id'] ?? null,
                'scope' => $data['scope'] ?? 'all',
                'latest_only' => (bool) ($data['latest_only'] ?? false),
            ]),
            'meta' => [
                'stats' => $this->curricula->stats(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->guard();

        $data = $request->validate([
            'country_id' => ['nullable', 'integer'],
            'country_code' => ['nullable', 'string', 'size:2'],
            'code' => ['required', 'string', 'max:64'],
            'name_en' => ['required', 'string', 'max:191'],
            'name_ar' => ['nullable', 'string', 'max:191'],
            'version' => ['nullable', 'string', 'max:32'],
            'change_summary_en' => ['nullable', 'string'],
            'change_summary_ar' => ['nullable', 'string'],
        ]);

        return response()->json([
            'message' => 'Curriculum created.',
            'data' => $this->curricula->create($data, $request->user()->id),
        ], 201);
    }

    public function show(int $curriculum): JsonResponse
    {
        $this->guard();
        $model = Curriculum::query()->findOrFail($curriculum);

        return response()->json([
            'data' => $this->curricula->show($model),
        ]);
    }

    public function update(Request $request, int $curriculum): JsonResponse
    {
        $this->guard();
        $model = Curriculum::query()->findOrFail($curriculum);

        $data = $request->validate([
            'country_id' => ['nullable', 'integer'],
            'country_code' => ['nullable', 'string', 'size:2'],
            'name_en' => ['sometimes', 'required', 'string', 'max:191'],
            'name_ar' => ['nullable', 'string', 'max:191'],
            'change_summary_en' => ['nullable', 'string'],
            'change_summary_ar' => ['nullable', 'string'],
            'status' => ['sometimes', 'in:draft,in_review'],
        ]);

        return response()->json([
            'message' => 'Curriculum updated.',
            'data' => $this->curricula->update($model, $data, $request->user()->id),
        ]);
    }

    public function publish(Request $request, int $curriculum): JsonResponse
    {
        $this->guard();
        $model = Curriculum::query()->findOrFail($curriculum);

        $data = $request->validate([
            'summary_en' => ['nullable', 'string'],
            'summary_ar' => ['nullable', 'string'],
        ]);

        return response()->json([
            'message' => 'Curriculum published.',
            'data' => $this->curricula->publish(
                $model,
                $data['summary_en'] ?? null,
                $data['summary_ar'] ?? null,
            ),
        ]);
    }

    public function newVersion(Request $request, int $curriculum): JsonResponse
    {
        $this->guard();
        $model = Curriculum::query()->findOrFail($curriculum);

        $data = $request->validate([
            'version' => ['required', 'string', 'max:32'],
            'summary_en' => ['nullable', 'string'],
            'summary_ar' => ['nullable', 'string'],
        ]);

        return response()->json([
            'message' => 'New curriculum version created as draft.',
            'data' => $this->curricula->newVersion(
                $model,
                $data['version'],
                $data['summary_en'] ?? null,
                $data['summary_ar'] ?? null,
            ),
        ], 201);
    }

    public function destroy(int $curriculum): JsonResponse
    {
        $this->guard();
        $model = Curriculum::query()->findOrFail($curriculum);
        $this->curricula->delete($model);

        return response()->json([
            'message' => 'Curriculum deleted.',
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
