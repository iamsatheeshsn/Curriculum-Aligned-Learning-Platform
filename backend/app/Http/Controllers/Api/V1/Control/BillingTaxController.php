<?php

namespace App\Http\Controllers\Api\V1\Control;

use App\Domain\Billing\Models\BillingTax;
use App\Domain\Billing\Services\ControlTaxService;
use App\Domain\Identity\Services\RbacService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BillingTaxController extends Controller
{
    public function __construct(
        protected ControlTaxService $taxes,
        protected RbacService $rbac,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'status' => ['nullable', 'in:active,inactive'],
        ]);

        return response()->json([
            'data' => $this->taxes->list($data),
            'meta' => ['stats' => $this->taxes->stats()],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'code' => ['required', 'string', 'max:64'],
            'name_en' => ['required', 'string', 'max:191'],
            'name_ar' => ['nullable', 'string', 'max:191'],
            'rate_percent' => ['required', 'numeric', 'min:0', 'max:100'],
            'country_code' => ['nullable', 'string', 'size:2'],
            'is_inclusive' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string'],
        ]);

        return response()->json([
            'message' => 'Tax created.',
            'data' => $this->taxes->create($data, (int) $request->user()->id),
        ], 201);
    }

    public function show(int $tax): JsonResponse
    {
        $this->guard();
        $model = BillingTax::query()->findOrFail($tax);

        return response()->json(['data' => $this->taxes->show($model)]);
    }

    public function update(Request $request, int $tax): JsonResponse
    {
        $this->guard();
        $model = BillingTax::query()->findOrFail($tax);
        $data = $request->validate([
            'code' => ['sometimes', 'required', 'string', 'max:64'],
            'name_en' => ['sometimes', 'required', 'string', 'max:191'],
            'name_ar' => ['nullable', 'string', 'max:191'],
            'rate_percent' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'country_code' => ['nullable', 'string', 'size:2'],
            'is_inclusive' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string'],
        ]);

        return response()->json([
            'message' => 'Tax updated.',
            'data' => $this->taxes->update($model, $data, (int) $request->user()->id),
        ]);
    }

    public function destroy(int $tax): JsonResponse
    {
        $this->guard();
        $model = BillingTax::query()->findOrFail($tax);
        $this->taxes->delete($model);

        return response()->json(['message' => 'Tax deleted.']);
    }

    protected function guard(): void
    {
        $user = request()->user();
        abort_unless(
            $user?->hasRole('super_admin')
                || $this->rbac->can($user, 'platform.plans.manage')
                || $this->rbac->can($user, 'platform.tenants.manage'),
            403
        );
    }
}
