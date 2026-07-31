<?php

namespace App\Http\Controllers\Api\V1\Control;

use App\Domain\Identity\Services\RbacService;
use App\Domain\Organization\Models\Tenant;
use App\Domain\Platform\Services\SystemHealthService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SystemHealthController extends Controller
{
    public function __construct(
        protected SystemHealthService $health,
        protected RbacService $rbac,
    ) {}

    public function __invoke(Request $request): JsonResponse
    {
        abort_unless(
            $request->user()?->hasRole('super_admin')
                || $this->rbac->can($request->user(), 'platform.tenants.manage'),
            403
        );

        $this->authorize('viewAny', Tenant::class);

        return response()->json([
            'data' => $this->health->report(),
        ]);
    }
}
