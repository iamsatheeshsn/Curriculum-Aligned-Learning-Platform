<?php



namespace App\Http\Controllers\Api\V1\Control;



use App\Domain\Identity\Services\RbacService;

use App\Domain\Platform\Services\ControlReportService;

use App\Http\Controllers\Controller;

use Illuminate\Http\JsonResponse;

use Illuminate\Http\Request;



class ReportController extends Controller

{

    public function __construct(

        protected ControlReportService $reports,

        protected RbacService $rbac,

    ) {}



    public function revenue(Request $request): JsonResponse

    {

        $this->guard();

        $months = (int) $request->integer('months', 6);



        return response()->json([

            'data' => $this->reports->revenue($months),

        ]);

    }



    public function schools(Request $request): JsonResponse

    {

        $this->guard();

        $filters = $request->validate([

            'tenant_id' => ['nullable', 'integer'],

            'status' => ['nullable', 'string', 'max:32'],

            'search' => ['nullable', 'string', 'max:120'],

            'limit' => ['nullable', 'integer', 'min:1', 'max:500'],

        ]);



        return response()->json([

            'data' => $this->reports->schools($filters),

        ]);

    }



    public function students(Request $request): JsonResponse

    {

        $this->guard();

        $filters = $request->validate([

            'tenant_id' => ['nullable', 'integer'],

            'school_id' => ['nullable', 'integer'],

            'limit' => ['nullable', 'integer', 'min:1', 'max:500'],

        ]);



        return response()->json([

            'data' => $this->reports->students($filters),

        ]);

    }



    public function usage(Request $request): JsonResponse

    {

        $this->guard();

        $months = (int) $request->integer('months', 6);



        return response()->json([

            'data' => $this->reports->usage($months),

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

    }

}


