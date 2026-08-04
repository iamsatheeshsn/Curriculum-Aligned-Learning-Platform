<?php

namespace App\Http\Controllers\Api\V1\Control;

use App\Domain\Billing\Models\Invoice;
use App\Domain\Billing\Services\InvoiceService;
use App\Domain\Billing\Services\SubscriptionService;
use App\Domain\Organization\Models\Tenant;
use App\Domain\Organization\Services\TenantService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class TenantController extends Controller
{
    public function __construct(
        protected TenantService $tenants,
        protected SubscriptionService $subscriptions,
        protected InvoiceService $invoices,
    ) {}

    public function dashboard(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($this->isPlatformOperator($user)) {
            $this->authorize('viewAny', Tenant::class);

            return response()->json([
                'data' => [
                    'role' => 'super_admin',
                    ...$this->tenants->superAdminDashboard(),
                ],
            ]);
        }

        $tenant = $this->resolveOwnedTenant($request);
        $this->authorize('view', $tenant);

        return response()->json([
            'data' => [
                'role' => 'school_owner',
                ...$this->tenants->ownerDashboard($tenant),
            ],
        ]);
    }

    public function saasAnalytics(Request $request): JsonResponse
    {
        abort_unless(
            $request->user()?->hasRole('super_admin')
                || app(\App\Domain\Identity\Services\RbacService::class)->can($request->user(), 'platform.tenants.manage'),
            403
        );

        $this->authorize('viewAny', Tenant::class);

        $months = (int) $request->integer('months', 6);

        return response()->json([
            'data' => $this->tenants->saasAnalytics($months),
        ]);
    }

    public function revenueAnalytics(Request $request): JsonResponse
    {
        abort_unless(
            $request->user()?->hasRole('super_admin')
                || app(\App\Domain\Identity\Services\RbacService::class)->can($request->user(), 'platform.tenants.manage'),
            403
        );

        $this->authorize('viewAny', Tenant::class);

        $months = (int) $request->integer('months', 6);

        return response()->json([
            'data' => $this->tenants->revenueAnalytics($months),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Tenant::class);
        $user = $request->user();

        if (! $this->isPlatformOperator($user)) {
            $tenant = $this->resolveOwnedTenant($request);
            $this->authorize('view', $tenant);

            return response()->json([
                'data' => [$this->tenants->serializeTenant($tenant)],
                'meta' => ['total' => 1],
            ]);
        }

        $paginator = $this->tenants->paginate([
            'status' => $request->input('status'),
            'search' => $request->input('search'),
            'exclude_platform' => true,
        ], (int) $request->integer('per_page', 10));

        $items = collect($paginator->items())->map(
            fn (Tenant $tenant) => $this->tenants->serializeTenant($tenant)
        );

        return response()->json([
            'data' => $items,
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Tenant::class);

        $data = $request->validate([
            'organization_name' => ['required', 'string', 'max:191'],
            'slug' => ['nullable', 'string', 'max:80', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'],
            'legal_name' => ['nullable', 'string', 'max:191'],
            'country_code' => ['required', 'string', 'size:2'],
            'locale' => ['nullable', 'string', 'max:10'],
            'plan_code' => ['nullable', 'string', 'max:64'],
            'trial_days' => ['nullable', 'integer', 'min:1', 'max:90'],
            'email' => ['required', 'email', 'max:191'],
            'password' => ['required', 'string', 'min:8'],
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:40'],
            'school_name' => ['nullable', 'string', 'max:191'],
            'school_name_ar' => ['nullable', 'string', 'max:191'],
            'school_code' => ['nullable', 'string', 'max:64'],
            'primary_color' => ['nullable', 'string', 'max:32'],
            'secondary_color' => ['nullable', 'string', 'max:32'],
        ]);

        $result = $this->tenants->provision($data);
        /** @var Tenant $tenant */
        $tenant = $result['tenant'];

        return response()->json([
            'message' => 'Tenant provisioned.',
            'data' => $this->tenants->serializeTenant($tenant->fresh()),
        ], 201);
    }

    public function show(Request $request, int $tenant): JsonResponse
    {
        $model = $this->tenants->find($tenant);
        $this->authorize('view', $model);

        return response()->json([
            'data' => [
                ...$this->tenants->serializeTenant($model),
                'branding' => $model->branding,
                'billing_contact' => $this->tenants->billingContact($model),
                'schools' => $model->schools()->orderBy('name_en')->get([
                    'id', 'code', 'name_en', 'name_ar', 'status', 'timezone',
                ]),
            ],
        ]);
    }

    public function update(Request $request, int $tenant): JsonResponse
    {
        $model = $this->tenants->find($tenant);
        $this->authorize('update', $model);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:191'],
            'legal_name' => ['nullable', 'string', 'max:191'],
            'default_locale' => ['sometimes', 'string', 'in:en,ar'],
            'default_timezone' => ['sometimes', 'string', 'max:64'],
        ]);

        $updated = $this->tenants->updateSettings($model, $data, $request->user()->id);

        return response()->json([
            'message' => 'Tenant updated.',
            'data' => $this->tenants->serializeTenant($updated),
        ]);
    }

    public function updateStatus(Request $request, int $tenant): JsonResponse
    {
        $model = $this->tenants->find($tenant);
        $this->authorize('delete', $model); // platform.tenants.manage only

        $data = $request->validate([
            'status' => ['required', 'in:trial,active,suspended,closed'],
        ]);

        $updated = $this->tenants->updateStatus($model, $data['status'], $request->user()->id);

        return response()->json([
            'message' => 'Tenant status updated.',
            'data' => $this->tenants->serializeTenant($updated),
        ]);
    }

    public function destroy(Request $request, int $tenant): JsonResponse
    {
        $model = $this->tenants->find($tenant);
        $this->authorize('delete', $model);
        $this->tenants->softDelete($model, $request->user()->id);

        return response()->json(['message' => 'Tenant deleted.']);
    }

    public function branding(Request $request, int $tenant): JsonResponse
    {
        $model = $this->tenants->find($tenant);
        $this->authorize('view', $model);

        return response()->json([
            'data' => $model->branding ?? [
                'tenant_id' => $model->id,
                'primary_color' => null,
                'secondary_color' => null,
                'logo_path' => null,
                'favicon_path' => null,
                'email_footer_en' => null,
                'email_footer_ar' => null,
            ],
        ]);
    }

    public function updateBranding(Request $request, int $tenant): JsonResponse
    {
        $model = $this->tenants->find($tenant);
        $this->authorize('update', $model);

        $user = $request->user();
        if (! $user->hasRole('super_admin') && ! $user->hasPermission('tenant.branding.manage', $model->id)) {
            abort(403, 'Missing branding permission.');
        }

        $data = $request->validate([
            'logo_path' => ['nullable', 'string', 'max:500'],
            'favicon_path' => ['nullable', 'string', 'max:500'],
            'primary_color' => ['nullable', 'string', 'max:32'],
            'secondary_color' => ['nullable', 'string', 'max:32'],
            'email_footer_en' => ['nullable', 'string'],
            'email_footer_ar' => ['nullable', 'string'],
        ]);

        $branding = $this->tenants->upsertBranding($model, $data, $user->id);

        return response()->json([
            'message' => 'Branding updated.',
            'data' => $branding,
        ]);
    }

    public function billingContact(Request $request, int $tenant): JsonResponse
    {
        $model = $this->tenants->find($tenant);
        $this->authorize('view', $model);

        return response()->json(['data' => $this->tenants->billingContact($model)]);
    }

    public function updateBillingContact(Request $request, int $tenant): JsonResponse
    {
        $model = $this->tenants->find($tenant);
        $this->authorize('manageBilling', $model);

        $data = $request->validate([
            'first_name' => ['sometimes', 'string', 'max:100'],
            'last_name' => ['sometimes', 'string', 'max:100'],
            'email' => ['sometimes', 'email', 'max:191'],
            'phone' => ['nullable', 'string', 'max:40'],
        ]);

        $contact = $this->tenants->updateBillingContact($model, $data, $request->user()->id);

        return response()->json([
            'message' => 'Billing contact updated.',
            'data' => $contact,
        ]);
    }

    public function schools(Request $request, int $tenant): JsonResponse
    {
        $model = $this->tenants->find($tenant);
        $this->authorize('view', $model);

        $schools = $model->schools()->orderBy('name_en')->get([
            'id', 'code', 'name_en', 'name_ar', 'status', 'timezone', 'country_id',
        ]);

        return response()->json(['data' => $schools]);
    }

    public function generateInvoice(Request $request, int $tenant): JsonResponse
    {
        $model = $this->tenants->find($tenant);
        $this->authorize('manageBilling', $model);

        $plan = $this->subscriptions->currentForTenant($model)?->plan;
        if (! $plan) {
            throw ValidationException::withMessages([
                'plan' => ['No active subscription plan to invoice.'],
            ]);
        }

        $invoice = $this->invoices->generateFromPlan($model, $plan, $request->user()->id);

        return response()->json([
            'message' => 'Invoice generated.',
            'data' => $this->serializeInvoice($invoice->load('items'), $model),
        ], 201);
    }

    public function invoices(Request $request, int $tenant): JsonResponse
    {
        $model = $this->tenants->find($tenant);
        $this->authorize('view', $model);

        $user = $request->user();
        if (! $user->hasRole('super_admin') && ! $user->hasPermission('tenant.billing.view', $model->id)) {
            abort(403, 'Missing billing view permission.');
        }

        $items = Invoice::query()
            ->where('tenant_id', $model->id)
            ->with('items')
            ->orderByDesc('id')
            ->paginate((int) $request->integer('per_page', 10));

        return response()->json([
            'data' => collect($items->items())->map(
                fn (Invoice $invoice) => $this->serializeInvoice($invoice, $model)
            )->values(),
            'meta' => [
                'current_page' => $items->currentPage(),
                'last_page' => $items->lastPage(),
                'per_page' => $items->perPage(),
                'total' => $items->total(),
            ],
        ]);
    }

    public function showInvoice(Request $request, int $tenant, int $invoice): JsonResponse
    {
        $model = $this->tenants->find($tenant);
        $this->authorize('view', $model);

        $user = $request->user();
        if (! $user->hasRole('super_admin') && ! $user->hasPermission('tenant.billing.view', $model->id)) {
            abort(403, 'Missing billing view permission.');
        }

        $record = Invoice::query()
            ->where('tenant_id', $model->id)
            ->with(['items', 'payments'])
            ->findOrFail($invoice);

        return response()->json([
            'data' => $this->serializeInvoice($record, $model, true),
        ]);
    }

    /** @return array<string, mixed> */
    private function serializeInvoice(Invoice $invoice, Tenant $tenant, bool $detailed = false): array
    {
        $payload = [
            'id' => $invoice->id,
            'number' => $invoice->number,
            'currency' => $invoice->currency,
            'subtotal' => $invoice->subtotal,
            'tax_total' => $invoice->tax_total,
            'total' => $invoice->total,
            'status' => $invoice->status,
            'issued_at' => $invoice->issued_at,
            'due_at' => $invoice->due_at,
            'paid_at' => $invoice->paid_at,
            'notes' => $invoice->notes,
            'items' => $invoice->relationLoaded('items')
                ? $invoice->items->map(fn ($item) => [
                    'id' => $item->id,
                    'description' => $item->description,
                    'quantity' => $item->quantity,
                    'unit_price' => $item->unit_price,
                    'line_total' => $item->line_total,
                ])->values()
                : [],
            'tenant' => [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'legal_name' => $tenant->legal_name,
                'slug' => $tenant->slug,
            ],
        ];

        if ($detailed) {
            $payload['billing_contact'] = $this->tenants->billingContact($tenant);
            $payload['payments'] = $invoice->relationLoaded('payments')
                ? $invoice->payments->map(fn ($p) => [
                    'id' => $p->id,
                    'amount' => $p->amount,
                    'currency' => $p->currency,
                    'method' => $p->method,
                    'reference' => $p->reference,
                    'paid_at' => $p->paid_at,
                ])->values()
                : [];
        }

        return $payload;
    }

    /**
     * Support and audit staff sit above any single tenant, same as super admins.
     * Callers must still pass the Tenant authorisation check; this only decides
     * whether to serve the platform-wide view or a single owned tenant.
     */
    private function isPlatformOperator(?\App\Models\User $user): bool
    {
        return $user !== null && ($user->hasRole('super_admin') || $user->tenant_id === null);
    }

    private function resolveOwnedTenant(Request $request): Tenant
    {
        $user = $request->user();
        if (! $user->tenant_id) {
            throw ValidationException::withMessages([
                'tenant' => ['No tenant context.'],
            ]);
        }

        return $this->tenants->find((int) $user->tenant_id);
    }
}
