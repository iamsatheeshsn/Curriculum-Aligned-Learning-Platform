<?php

namespace App\Domain\Billing\Services;

use App\Domain\Billing\Models\Invoice;
use App\Domain\Billing\Models\Payment;
use App\Domain\Organization\Models\Tenant;
use App\Domain\Organization\Services\TenantService;
use Illuminate\Validation\ValidationException;

class ControlInvoiceDirectoryService
{
    public function __construct(
        protected InvoiceService $invoices,
        protected SubscriptionService $subscriptions,
        protected TenantService $tenants,
    ) {}

    /** @param  array{search?: ?string, status?: ?string, tenant_id?: ?int}  $filters
     *  @return list<array<string, mixed>>
     */
    public function list(array $filters = []): array
    {
        return $this->baseQuery($filters)
            ->with(['items', 'tenant:id,name,legal_name,slug'])
            ->orderByDesc('id')
            ->get()
            ->map(fn (Invoice $invoice) => $this->serialize($invoice, $invoice->tenant, false))
            ->all();
    }

    /** @return array<string, mixed> */
    public function stats(): array
    {
        $base = Invoice::query();

        return [
            'total' => (int) (clone $base)->count(),
            'draft' => (int) (clone $base)->where('status', 'draft')->count(),
            'sent' => (int) (clone $base)->where('status', 'sent')->count(),
            'paid' => (int) (clone $base)->where('status', 'paid')->count(),
            'overdue' => (int) (clone $base)->where('status', 'overdue')->count(),
            'void' => (int) (clone $base)->where('status', 'void')->count(),
            'outstanding_total' => (float) (clone $base)->whereIn('status', ['draft', 'sent', 'overdue'])->sum('total'),
        ];
    }

    /** @return list<array{id: int, name: string, slug: string}> */
    public function availableTenants(): array
    {
        return Tenant::query()
            ->where('slug', '!=', 'platform')
            ->orderBy('name')
            ->get(['id', 'name', 'slug'])
            ->map(fn (Tenant $t) => ['id' => $t->id, 'name' => $t->name, 'slug' => $t->slug])
            ->all();
    }

    /** @return array<string, mixed> */
    public function show(Invoice $invoice): array
    {
        $invoice->load(['items', 'payments', 'tenant']);

        return $this->serialize($invoice, $invoice->tenant, true);
    }

    /** @return array<string, mixed> */
    public function send(Invoice $invoice): array
    {
        $updated = $this->invoices->sendInvoice($invoice);

        return $this->show($updated->fresh());
    }

    /** @param  array<string, mixed>  $data
     *  @return array<string, mixed>
     */
    public function pay(Invoice $invoice, array $data, int $actorId): array
    {
        $this->invoices->recordPayment($invoice, $data, $actorId);

        return $this->show($invoice->fresh());
    }

    /** @return array<string, mixed> */
    public function generate(int $tenantId, int $actorId): array
    {
        $tenant = Tenant::query()->findOrFail($tenantId);
        $plan = $this->subscriptions->currentForTenant($tenant)?->plan;
        if (! $plan) {
            throw ValidationException::withMessages([
                'tenant_id' => ['No active subscription plan to invoice for this organisation.'],
            ]);
        }

        $invoice = $this->invoices->generateFromPlan($tenant, $plan, $actorId);

        return $this->show($invoice->fresh());
    }

    /** @param  array{search?: ?string, status?: ?string, tenant_id?: ?int}  $filters */
    protected function baseQuery(array $filters)
    {
        return Invoice::query()
            ->when($filters['tenant_id'] ?? null, fn ($q, $id) => $q->where('tenant_id', $id))
            ->when($filters['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->when($filters['search'] ?? null, function ($q, $search) {
                $like = '%'.$search.'%';
                $q->where(function ($inner) use ($like) {
                    $inner->where('number', 'like', $like)
                        ->orWhereHas('tenant', function ($t) use ($like) {
                            $t->where('name', 'like', $like)->orWhere('slug', 'like', $like);
                        });
                });
            });
    }

    /** @return array<string, mixed> */
    protected function serialize(Invoice $invoice, ?Tenant $tenant, bool $detailed = false): array
    {
        $tenant ??= $invoice->tenant;
        $payload = [
            'id' => $invoice->id,
            'number' => $invoice->number,
            'currency' => $invoice->currency,
            'subtotal' => $invoice->subtotal,
            'tax_total' => $invoice->tax_total,
            'total' => $invoice->total,
            'status' => $invoice->status,
            'issued_at' => optional($invoice->issued_at)?->toIso8601String(),
            'due_at' => optional($invoice->due_at)?->toIso8601String(),
            'paid_at' => optional($invoice->paid_at)?->toIso8601String(),
            'notes' => $invoice->notes,
            'items' => $invoice->relationLoaded('items')
                ? $invoice->items->map(fn ($item) => [
                    'id' => $item->id,
                    'description' => $item->description,
                    'quantity' => $item->quantity,
                    'unit_price' => $item->unit_price,
                    'line_total' => $item->line_total,
                ])->values()->all()
                : [],
            'tenant' => $tenant ? [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'legal_name' => $tenant->legal_name,
                'slug' => $tenant->slug,
            ] : null,
            'created_at' => optional($invoice->created_at)?->toIso8601String(),
            'updated_at' => optional($invoice->updated_at)?->toIso8601String(),
        ];

        if ($detailed && $tenant) {
            $payload['billing_contact'] = $this->tenants->billingContact($tenant);
            $payload['payments'] = $invoice->relationLoaded('payments')
                ? $invoice->payments->map(fn (Payment $p) => [
                    'id' => $p->id,
                    'amount' => $p->amount,
                    'currency' => $p->currency,
                    'method' => $p->method,
                    'reference' => $p->reference,
                    'paid_at' => optional($p->paid_at)?->toIso8601String(),
                ])->values()->all()
                : [];
        }

        return $payload;
    }
}
