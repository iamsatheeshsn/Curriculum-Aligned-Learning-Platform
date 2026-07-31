<?php



namespace App\Http\Controllers\Api\V1\Control;



use App\Domain\Audit\Models\AuditLog;

use App\Domain\Audit\Services\ControlAuditService;

use App\Domain\Identity\Services\RbacService;

use App\Http\Controllers\Controller;

use Illuminate\Http\JsonResponse;

use Illuminate\Http\Request;



class AuditController extends Controller

{

    public function __construct(

        protected ControlAuditService $audit,

        protected RbacService $rbac,

    ) {}



    public function activity(Request $request): JsonResponse

    {

        $this->guard();

        $filters = $this->filters($request);



        return response()->json([

            'data' => $this->audit->activity($filters),

            'meta' => ['stats' => $this->audit->activityStats()],

        ]);

    }



    public function logins(Request $request): JsonResponse

    {

        $this->guard();

        $filters = $this->filters($request);



        return response()->json([

            'data' => $this->audit->logins($filters),

            'meta' => ['stats' => $this->audit->loginStats()],

        ]);

    }



    public function logs(Request $request): JsonResponse

    {

        $this->guard();

        $filters = $this->filters($request);

        $filters['action'] = $request->input('action');



        return response()->json([

            'data' => $this->audit->logs($filters),

            'meta' => ['stats' => $this->audit->logStats()],

        ]);

    }



    public function show(int $log): JsonResponse

    {

        $this->guard();

        $model = AuditLog::query()->findOrFail($log);



        return response()->json([

            'data' => $this->audit->show($model),

        ]);

    }



    /** @return array<string, mixed> */

    protected function filters(Request $request): array

    {

        return $request->validate([

            'search' => ['nullable', 'string', 'max:120'],

            'tenant_id' => ['nullable', 'integer'],

            'actor_user_id' => ['nullable', 'integer'],

            'from' => ['nullable', 'date'],

            'to' => ['nullable', 'date'],

            'limit' => ['nullable', 'integer', 'min:1', 'max:500'],

        ]);

    }



    protected function guard(): void

    {

        $user = request()->user();

        abort_unless(

            $user?->hasRole('super_admin')

                || $this->rbac->can($user, 'platform.tenants.manage')

                || $this->rbac->can($user, 'platform.audit.view')

                || $this->rbac->can($user, 'audit.logs.view'),

            403

        );

    }

}


