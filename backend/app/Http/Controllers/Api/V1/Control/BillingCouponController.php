<?php

namespace App\Http\Controllers\Api\V1\Control;

use App\Domain\Billing\Models\BillingCoupon;
use App\Domain\Billing\Services\ControlCouponService;
use App\Domain\Identity\Services\RbacService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BillingCouponController extends Controller
{
    public function __construct(
        protected ControlCouponService $coupons,
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
            'data' => $this->coupons->list($data),
            'meta' => ['stats' => $this->coupons->stats()],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'code' => ['required', 'string', 'max:64'],
            'name_en' => ['required', 'string', 'max:191'],
            'name_ar' => ['nullable', 'string', 'max:191'],
            'discount_type' => ['required', 'in:percent,fixed'],
            'discount_value' => ['required', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'max_redemptions' => ['nullable', 'integer', 'min:1'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'is_active' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string'],
        ]);

        return response()->json([
            'message' => 'Coupon created.',
            'data' => $this->coupons->create($data, (int) $request->user()->id),
        ], 201);
    }

    public function show(int $coupon): JsonResponse
    {
        $this->guard();
        $model = BillingCoupon::query()->findOrFail($coupon);

        return response()->json(['data' => $this->coupons->show($model)]);
    }

    public function update(Request $request, int $coupon): JsonResponse
    {
        $this->guard();
        $model = BillingCoupon::query()->findOrFail($coupon);
        $data = $request->validate([
            'code' => ['sometimes', 'required', 'string', 'max:64'],
            'name_en' => ['sometimes', 'required', 'string', 'max:191'],
            'name_ar' => ['nullable', 'string', 'max:191'],
            'discount_type' => ['sometimes', 'in:percent,fixed'],
            'discount_value' => ['sometimes', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'max_redemptions' => ['nullable', 'integer', 'min:1'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date'],
            'is_active' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string'],
        ]);

        return response()->json([
            'message' => 'Coupon updated.',
            'data' => $this->coupons->update($model, $data, (int) $request->user()->id),
        ]);
    }

    public function destroy(int $coupon): JsonResponse
    {
        $this->guard();
        $model = BillingCoupon::query()->findOrFail($coupon);
        $this->coupons->delete($model);

        return response()->json(['message' => 'Coupon deleted.']);
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
