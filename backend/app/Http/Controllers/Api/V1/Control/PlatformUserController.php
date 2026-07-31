<?php

namespace App\Http\Controllers\Api\V1\Control;

use App\Domain\Identity\Services\ControlPlatformUserService;
use App\Domain\Identity\Services\RbacService;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Password;

class PlatformUserController extends Controller
{
    public function __construct(
        protected ControlPlatformUserService $users,
        protected RbacService $rbac,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->guard();

        $data = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'status' => ['nullable', 'in:active,suspended,inactive'],
            'role' => ['nullable', 'in:super_admin,customer_support,auditor'],
        ]);

        return response()->json([
            'data' => $this->users->list([
                'search' => $data['search'] ?? null,
                'status' => $data['status'] ?? null,
                'role' => $data['role'] ?? null,
            ]),
            'meta' => [
                'stats' => $this->users->stats(),
                'roles' => $this->users->availableRoles(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->guard();

        $data = $request->validate([
            'email' => ['required', 'email', 'max:190'],
            'password' => ['required', 'string', Password::defaults()],
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['nullable', 'string', 'max:100'],
            'first_name_ar' => ['nullable', 'string', 'max:100'],
            'last_name_ar' => ['nullable', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:40'],
            'locale' => ['nullable', 'string', 'max:10'],
            'timezone' => ['nullable', 'string', 'max:64'],
            'status' => ['nullable', 'in:active,suspended,inactive'],
            'role_code' => ['required', 'in:super_admin,customer_support,auditor'],
        ]);

        return response()->json([
            'message' => 'Platform user created.',
            'data' => $this->users->create($data, (int) $request->user()->id),
        ], 201);
    }

    public function show(int $user): JsonResponse
    {
        $this->guard();
        $model = User::query()->findOrFail($user);

        return response()->json([
            'data' => $this->users->show($model),
        ]);
    }

    public function update(Request $request, int $user): JsonResponse
    {
        $this->guard();
        $model = User::query()->findOrFail($user);

        $data = $request->validate([
            'email' => ['sometimes', 'required', 'email', 'max:190'],
            'password' => ['nullable', 'string', Password::defaults()],
            'first_name' => ['sometimes', 'required', 'string', 'max:100'],
            'last_name' => ['nullable', 'string', 'max:100'],
            'first_name_ar' => ['nullable', 'string', 'max:100'],
            'last_name_ar' => ['nullable', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:40'],
            'locale' => ['nullable', 'string', 'max:10'],
            'timezone' => ['nullable', 'string', 'max:64'],
            'status' => ['sometimes', 'in:active,suspended,inactive'],
            'role_code' => ['sometimes', 'in:super_admin,customer_support,auditor'],
        ]);

        return response()->json([
            'message' => 'Platform user updated.',
            'data' => $this->users->update($model, $data, (int) $request->user()->id),
        ]);
    }

    public function destroy(Request $request, int $user): JsonResponse
    {
        $this->guard();
        $model = User::query()->findOrFail($user);
        $this->users->delete($model, (int) $request->user()->id);

        return response()->json([
            'message' => 'Platform user deleted.',
        ]);
    }

    protected function guard(): void
    {
        $user = request()->user();
        abort_unless(
            $user?->hasRole('super_admin')
                || $this->rbac->can($user, 'platform.rbac.manage')
                || $this->rbac->can($user, 'platform.tenants.manage'),
            403
        );
    }
}
