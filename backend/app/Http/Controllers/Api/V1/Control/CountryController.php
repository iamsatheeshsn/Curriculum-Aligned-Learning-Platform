<?php

namespace App\Http\Controllers\Api\V1\Control;

use App\Domain\Identity\Services\RbacService;
use App\Domain\Organization\Models\Country;
use App\Domain\Organization\Models\Tenant;
use App\Domain\Organization\Services\CountryService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CountryController extends Controller
{
    public function __construct(
        protected CountryService $countries,
        protected RbacService $rbac,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->guard();

        $data = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'in:active,inactive'],
        ]);

        return response()->json([
            'data' => $this->countries->list([
                'search' => $data['search'] ?? null,
                'status' => $data['status'] ?? null,
            ]),
            'meta' => [
                'stats' => $this->countries->stats(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->guard();

        $data = $request->validate([
            'code' => ['required', 'string', 'size:2'],
            'name_en' => ['required', 'string', 'max:100'],
            'name_ar' => ['nullable', 'string', 'max:100'],
            'default_locale' => ['nullable', 'string', 'max:10'],
            'default_timezone' => ['nullable', 'string', 'max:64'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        return response()->json([
            'message' => 'Country created.',
            'data' => $this->countries->create($data, $request->user()->id),
        ], 201);
    }

    public function show(int $country): JsonResponse
    {
        $this->guard();
        $model = Country::query()->findOrFail($country);

        return response()->json([
            'data' => $this->countries->show($model),
        ]);
    }

    public function update(Request $request, int $country): JsonResponse
    {
        $this->guard();
        $model = Country::query()->findOrFail($country);

        $data = $request->validate([
            'code' => ['sometimes', 'string', 'size:2'],
            'name_en' => ['sometimes', 'required', 'string', 'max:100'],
            'name_ar' => ['nullable', 'string', 'max:100'],
            'default_locale' => ['nullable', 'string', 'max:10'],
            'default_timezone' => ['nullable', 'string', 'max:64'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        return response()->json([
            'message' => 'Country updated.',
            'data' => $this->countries->update($model, $data, $request->user()->id),
        ]);
    }

    public function destroy(int $country): JsonResponse
    {
        $this->guard();
        $model = Country::query()->findOrFail($country);
        $this->countries->delete($model);

        return response()->json([
            'message' => 'Country deleted.',
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
