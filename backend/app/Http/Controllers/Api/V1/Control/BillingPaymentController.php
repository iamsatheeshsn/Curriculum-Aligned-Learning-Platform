<?php

namespace App\Http\Controllers\Api\V1\Control;

use App\Domain\Billing\Models\Payment;
use App\Domain\Billing\Services\ControlPaymentDirectoryService;
use App\Domain\Identity\Services\RbacService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BillingPaymentController extends Controller
{
    public function __construct(
        protected ControlPaymentDirectoryService $payments,
        protected RbacService $rbac,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'tenant_id' => ['nullable', 'integer'],
            'method' => ['nullable', 'string', 'max:32'],
        ]);

        return response()->json([
            'data' => $this->payments->list([
                'search' => $data['search'] ?? null,
                'tenant_id' => isset($data['tenant_id']) ? (int) $data['tenant_id'] : null,
                'method' => $data['method'] ?? null,
            ]),
            'meta' => ['stats' => $this->payments->stats()],
        ]);
    }

    public function show(int $payment): JsonResponse
    {
        $this->guard();
        $model = Payment::query()->findOrFail($payment);

        return response()->json(['data' => $this->payments->show($model)]);
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
