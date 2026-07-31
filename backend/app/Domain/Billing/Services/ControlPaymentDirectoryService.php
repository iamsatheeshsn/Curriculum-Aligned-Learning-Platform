<?php

namespace App\Domain\Billing\Services;

use App\Domain\Billing\Models\Payment;

class ControlPaymentDirectoryService
{
    /** @param  array{search?: ?string, tenant_id?: ?int, method?: ?string}  $filters
     *  @return list<array<string, mixed>>
     */
    public function list(array $filters = []): array
    {
        return $this->baseQuery($filters)
            ->with(['tenant:id,name,slug', 'invoice:id,number,status,total,currency'])
            ->orderByDesc('paid_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn (Payment $payment) => $this->serialize($payment))
            ->all();
    }

    /** @return array{total: int, amount_sum: float, currency: string, by_method: array<string, int>} */
    public function stats(): array
    {
        $base = Payment::query();
        $byMethod = (clone $base)
            ->selectRaw('method, COUNT(*) as c')
            ->groupBy('method')
            ->pluck('c', 'method')
            ->map(fn ($c) => (int) $c)
            ->all();

        return [
            'total' => (int) (clone $base)->count(),
            'amount_sum' => (float) (clone $base)->sum('amount'),
            'currency' => (string) ((clone $base)->value('currency') ?: 'SAR'),
            'by_method' => $byMethod,
        ];
    }

    /** @return array<string, mixed> */
    public function show(Payment $payment): array
    {
        $payment->load(['tenant:id,name,slug,legal_name', 'invoice:id,number,status,total,currency,tenant_id']);

        return $this->serialize($payment, true);
    }

    /** @param  array{search?: ?string, tenant_id?: ?int, method?: ?string}  $filters */
    protected function baseQuery(array $filters)
    {
        return Payment::query()
            ->when($filters['tenant_id'] ?? null, fn ($q, $id) => $q->where('tenant_id', $id))
            ->when($filters['method'] ?? null, fn ($q, $method) => $q->where('method', $method))
            ->when($filters['search'] ?? null, function ($q, $search) {
                $like = '%'.$search.'%';
                $q->where(function ($inner) use ($like) {
                    $inner->where('reference', 'like', $like)
                        ->orWhere('method', 'like', $like)
                        ->orWhereHas('invoice', fn ($i) => $i->where('number', 'like', $like))
                        ->orWhereHas('tenant', fn ($t) => $t->where('name', 'like', $like)->orWhere('slug', 'like', $like));
                });
            });
    }

    /** @return array<string, mixed> */
    protected function serialize(Payment $payment, bool $detailed = false): array
    {
        return [
            'id' => $payment->id,
            'amount' => $payment->amount,
            'currency' => $payment->currency,
            'method' => $payment->method,
            'reference' => $payment->reference,
            'paid_at' => optional($payment->paid_at)?->toIso8601String(),
            'tenant' => $payment->tenant ? [
                'id' => $payment->tenant->id,
                'name' => $payment->tenant->name,
                'slug' => $payment->tenant->slug,
                'legal_name' => $detailed ? $payment->tenant->legal_name : null,
            ] : null,
            'invoice' => $payment->invoice ? [
                'id' => $payment->invoice->id,
                'number' => $payment->invoice->number,
                'status' => $payment->invoice->status,
                'total' => $payment->invoice->total,
                'currency' => $payment->invoice->currency,
            ] : null,
            'created_at' => optional($payment->created_at)?->toIso8601String(),
        ];
    }
}
