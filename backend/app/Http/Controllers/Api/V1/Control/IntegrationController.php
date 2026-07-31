<?php



namespace App\Http\Controllers\Api\V1\Control;



use App\Domain\Identity\Services\RbacService;

use App\Domain\Platform\Services\ControlIntegrationService;

use App\Http\Controllers\Controller;

use Illuminate\Http\JsonResponse;

use Illuminate\Http\Request;



class IntegrationController extends Controller

{

    public function __construct(

        protected ControlIntegrationService $integrations,

        protected RbacService $rbac,

    ) {}



    public function index(Request $request, string $category): JsonResponse

    {

        $this->guard();

        $filters = $request->validate([

            'status' => ['nullable', 'string', 'max:32'],

            'active' => ['nullable', 'in:true,false'],

        ]);



        return response()->json([

            'data' => $this->integrations->list($category, $filters),

            'meta' => ['stats' => $this->integrations->stats($category)],

        ]);

    }



    public function store(Request $request, string $category): JsonResponse

    {

        $this->guard();

        $data = $request->validate([

            'code' => ['required', 'string', 'max:64'],

            'name_en' => ['required', 'string', 'max:191'],

            'name_ar' => ['nullable', 'string', 'max:191'],

            'provider' => ['nullable', 'string', 'max:64'],

            'config' => ['nullable', 'array'],

            'is_active' => ['nullable', 'boolean'],

            'is_default' => ['nullable', 'boolean'],

            'status' => ['nullable', 'in:connected,disconnected,error,testing'],

            'notes' => ['nullable', 'string'],

        ]);



        return response()->json([

            'message' => 'Integration created.',

            'data' => $this->integrations->create($category, $data, (int) $request->user()->id),

        ], 201);

    }



    public function show(string $category, string $integration): JsonResponse

    {

        $this->guard();



        return response()->json([

            'data' => $this->integrations->show($category, $integration),

        ]);

    }



    public function update(Request $request, string $category, string $integration): JsonResponse

    {

        $this->guard();

        $data = $request->validate([

            'code' => ['sometimes', 'required', 'string', 'max:64'],

            'name_en' => ['sometimes', 'required', 'string', 'max:191'],

            'name_ar' => ['nullable', 'string', 'max:191'],

            'provider' => ['nullable', 'string', 'max:64'],

            'config' => ['nullable', 'array'],

            'is_active' => ['nullable', 'boolean'],

            'is_default' => ['nullable', 'boolean'],

            'status' => ['nullable', 'in:connected,disconnected,error,testing'],

            'notes' => ['nullable', 'string'],

        ]);



        return response()->json([

            'message' => 'Integration updated.',

            'data' => $this->integrations->update($category, $integration, $data, (int) $request->user()->id),

        ]);

    }



    public function destroy(string $category, string $integration): JsonResponse

    {

        $this->guard();

        $this->integrations->delete($category, $integration);



        return response()->json(['message' => 'Integration deleted.']);

    }



    public function setDefault(Request $request, string $category, string $integration): JsonResponse

    {

        $this->guard();



        return response()->json([

            'message' => 'Default integration updated.',

            'data' => $this->integrations->setDefault($category, $integration, (int) $request->user()->id),

        ]);

    }



    public function test(Request $request, string $category, string $integration): JsonResponse

    {

        $this->guard();



        return response()->json([

            'data' => $this->integrations->testConnection($category, $integration, (int) $request->user()->id),

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


