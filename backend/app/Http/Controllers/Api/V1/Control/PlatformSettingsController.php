<?php



namespace App\Http\Controllers\Api\V1\Control;



use App\Domain\Identity\Services\RbacService;

use App\Domain\Platform\Services\ControlPlatformSettingsService;

use App\Http\Controllers\Controller;

use Illuminate\Http\JsonResponse;

use Illuminate\Http\Request;



class PlatformSettingsController extends Controller

{

    public function __construct(

        protected ControlPlatformSettingsService $settings,

        protected RbacService $rbac,

    ) {}



    public function show(string $group): JsonResponse

    {

        $this->guard();



        return response()->json([

            'data' => $this->settings->getGroup($group),

        ]);

    }



    public function update(Request $request, string $group): JsonResponse

    {

        $this->guard();

        $data = $request->validate([

            'settings' => ['required', 'array'],

        ]);



        return response()->json([

            'message' => 'Settings updated.',

            'data' => $this->settings->updateGroup($group, $data['settings'], (int) $request->user()->id),

        ]);

    }



    public function runBackup(Request $request): JsonResponse

    {

        $this->guard();



        return response()->json([

            'message' => 'Backup completed.',

            'data' => $this->settings->runBackup((int) $request->user()->id),

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


