<?php

namespace App\Http\Controllers\Api\V1\Control;

use App\Domain\Billing\Models\Invoice;
use App\Domain\Billing\Services\ControlInvoiceDirectoryService;
use App\Domain\Identity\Services\RbacService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BillingInvoiceController extends Controller
{
    public function __construct(
        protected ControlInvoiceDirectoryService $invoices,
        protected RbacService $rbac,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'status' => ['nullable', 'in:draft,sent,paid,overdue,void'],
            'tenant_id' => ['nullable', 'integer'],
        ]);

        return response()->json([
            'data' => $this->invoices->list([
                'search' => $data['search'] ?? null,
                'status' => $data['status'] ?? null,
                'tenant_id' => isset($data['tenant_id']) ? (int) $data['tenant_id'] : null,
            ]),
            'meta' => [
                'stats' => $this->invoices->stats(),
                'tenants' => $this->invoices->availableTenants(),
            ],
        ]);
    }

    public function show(int $invoice): JsonResponse
    {
        $this->guard();
        $model = Invoice::query()->findOrFail($invoice);

        return response()->json(['data' => $this->invoices->show($model)]);
    }

    public function send(int $invoice): JsonResponse
    {
        $this->guard();
        $model = Invoice::query()->findOrFail($invoice);

        return response()->json([
            'message' => 'Invoice sent.',
            'data' => $this->invoices->send($model),
        ]);
    }

    public function pay(Request $request, int $invoice): JsonResponse
    {
        $this->guard();
        $model = Invoice::query()->findOrFail($invoice);
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'method' => ['nullable', 'string', 'max:32'],
            'reference' => ['nullable', 'string', 'max:191'],
            'paid_at' => ['nullable', 'date'],
        ]);

        return response()->json([
            'message' => 'Payment recorded.',
            'data' => $this->invoices->pay($model, $data, (int) $request->user()->id),
        ]);
    }

    public function generate(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'tenant_id' => ['required', 'integer', 'exists:tenants,id'],
        ]);

        return response()->json([
            'message' => 'Invoice generated.',
            'data' => $this->invoices->generate((int) $data['tenant_id'], (int) $request->user()->id),
        ], 201);
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
