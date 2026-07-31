<?php

namespace App\Http\Controllers\Api\V1\Control;

use App\Domain\Identity\Services\RbacService;
use App\Domain\Organization\Models\Tenant;
use App\Domain\Organization\Services\TenantTrialService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TenantTrialController extends Controller
{
    public function __construct(
        protected TenantTrialService $trials,
        protected RbacService $rbac,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->guard();

        $data = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'filter' => ['nullable', 'in:all,active,ending_soon,expired,converted'],
        ]);

        return response()->json([
            'data' => $this->trials->list([
                'search' => $data['search'] ?? null,
                'filter' => $data['filter'] ?? 'all',
            ]),
            'meta' => [
                'stats' => $this->trials->stats(),
            ],
        ]);
    }

    public function show(int $tenant): JsonResponse
    {
        $this->guard();
        $model = Tenant::query()
            ->where('slug', '!=', 'platform')
            ->findOrFail($tenant);

        return response()->json([
            'data' => $this->trials->show($model),
        ]);
    }

    public function extend(Request $request, int $tenant): JsonResponse
    {
        $this->guard();
        $model = Tenant::query()
            ->where('slug', '!=', 'platform')
            ->findOrFail($tenant);

        $data = $request->validate([
            'days' => ['required', 'integer', 'min:1', 'max:365'],
        ]);

        $updated = $this->trials->extend($model, (int) $data['days'], $request->user()->id);

        return response()->json([
            'message' => 'Trial extended.',
            'data' => $this->trials->show($updated),
        ]);
    }

    public function convert(Request $request, int $tenant): JsonResponse
    {
        $this->guard();
        $model = Tenant::query()
            ->where('slug', '!=', 'platform')
            ->findOrFail($tenant);

        $updated = $this->trials->convert($model, $request->user()->id);

        return response()->json([
            'message' => 'Trial converted to active.',
            'data' => $this->trials->show($updated),
        ]);
    }

    public function putOnTrial(Request $request, int $tenant): JsonResponse
    {
        $this->guard();
        $model = Tenant::query()
            ->where('slug', '!=', 'platform')
            ->findOrFail($tenant);

        $data = $request->validate([
            'days' => ['nullable', 'integer', 'min:1', 'max:365'],
        ]);

        $updated = $this->trials->putOnTrial(
            $model,
            (int) ($data['days'] ?? 14),
            $request->user()->id,
        );

        return response()->json([
            'message' => 'Organisation placed on trial.',
            'data' => $this->trials->show($updated),
        ]);
    }

    protected function guard(): void
    {
        $user = request()->user();
        abort_unless(
            $user?->hasRole('super_admin')
                || $this->rbac->can($user, 'platform.tenants.manage'),
            403
        );
        $this->authorize('viewAny', Tenant::class);
    }
}
