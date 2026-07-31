<?php

namespace App\Domain\Billing\Services;

use App\Domain\Billing\Models\Invoice;
use App\Domain\Billing\Models\InvoiceItem;
use App\Domain\Billing\Models\Payment;
use App\Domain\Billing\Models\StudentInvoice;
use App\Domain\Billing\Models\StudentInvoiceItem;
use App\Domain\Billing\Models\SubscriptionPlan;
use App\Domain\Billing\Models\TutorPayment;
use App\Domain\Notification\NotificationEvents;
use App\Domain\Notification\Services\NotificationDispatcher;
use App\Domain\Organization\Models\School;
use App\Domain\Organization\Models\Tenant;
use App\Domain\Tutoring\Models\TutorProfile;
use App\Models\User;
use App\Services\BaseService;
use App\Support\TenantContext;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class InvoiceService extends BaseService
{
    public function __construct(
        TenantContext $tenantContext,
        protected NotificationDispatcher $notifier,
    ) {
        parent::__construct($tenantContext);
    }

    public function generateSchoolInvoice(Tenant $tenant, array $data): Invoice
    {
        return $this->transaction(function () use ($tenant, $data) {
            $items = $data['items'] ?? [];
            if ($items === []) {
                throw ValidationException::withMessages(['items' => ['At least one line item is required.']]);
            }

            $subtotal = 0.0;
            foreach ($items as $item) {
                $qty = (float) ($item['quantity'] ?? 1);
                $price = (float) $item['unit_price'];
                $subtotal += $qty * $price;
            }
            $tax = (float) ($data['tax_total'] ?? 0);
            $total = $subtotal + $tax;

            $invoice = Invoice::query()->create([
                'tenant_id' => $tenant->id,
                'number' => $data['number'] ?? $this->nextNumber('INV'),
                'currency' => $data['currency'] ?? 'SAR',
                'subtotal' => $subtotal,
                'tax_total' => $tax,
                'total' => $total,
                'status' => 'draft',
                'due_at' => $data['due_at'] ?? now()->addDays(14),
                'notes' => $data['notes'] ?? null,
            ]);

            foreach ($items as $item) {
                $qty = (float) ($item['quantity'] ?? 1);
                $price = (float) $item['unit_price'];
                InvoiceItem::query()->create([
                    'invoice_id' => $invoice->id,
                    'description' => $item['description'],
                    'quantity' => $qty,
                    'unit_price' => $price,
                    'line_total' => $qty * $price,
                ]);
            }

            return $invoice->load('items');
        });
    }

    public function sendInvoice(Invoice $invoice): Invoice
    {
        if (! in_array($invoice->status, ['draft', 'overdue'], true)) {
            throw ValidationException::withMessages(['status' => ['Only draft/overdue invoices can be sent.']]);
        }

        $invoice->forceFill([
            'status' => 'sent',
            'issued_at' => $invoice->issued_at ?? now(),
        ])->save();

        return $invoice->fresh('items');
    }

    public function recordPayment(Invoice $invoice, array $data, ?int $actorId = null): Payment
    {
        if (in_array($invoice->status, ['void', 'paid'], true)) {
            throw ValidationException::withMessages(['invoice' => ['Invoice cannot accept payments.']]);
        }

        return $this->transaction(function () use ($invoice, $data, $actorId) {
            $amount = (float) $data['amount'];
            $invoiceTotal = (float) $invoice->total;

            // Zero-total (e.g. free plan) invoices: record a $0 payment and mark paid.
            if ($invoiceTotal <= 0 && $amount <= 0) {
                $payment = Payment::query()->create([
                    'tenant_id' => $invoice->tenant_id,
                    'invoice_id' => $invoice->id,
                    'amount' => 0,
                    'currency' => $data['currency'] ?? $invoice->currency,
                    'method' => $data['method'] ?? 'manual',
                    'reference' => $data['reference'] ?? 'FREE',
                    'paid_at' => $data['paid_at'] ?? now(),
                    'created_by' => $actorId,
                    'updated_by' => $actorId,
                ]);
                $invoice->forceFill(['status' => 'paid', 'paid_at' => now()])->save();

                return $payment;
            }

            $payment = Payment::query()->create([
                'tenant_id' => $invoice->tenant_id,
                'invoice_id' => $invoice->id,
                'amount' => $amount,
                'currency' => $data['currency'] ?? $invoice->currency,
                'method' => $data['method'] ?? 'manual',
                'reference' => $data['reference'] ?? null,
                'paid_at' => $data['paid_at'] ?? now(),
                'created_by' => $actorId,
                'updated_by' => $actorId,
            ]);

            $paid = (float) $invoice->payments()->sum('amount');
            if ($paid >= $invoiceTotal) {
                $invoice->forceFill(['status' => 'paid', 'paid_at' => now()])->save();
            }

            return $payment;
        });
    }

    public function generateFromPlan(Tenant $tenant, SubscriptionPlan $plan, ?int $actorId = null): Invoice
    {
        return $this->generateSchoolInvoice($tenant, [
            'currency' => $plan->currency,
            'items' => [[
                'description' => "Subscription: {$plan->name_en} ({$plan->code})",
                'quantity' => 1,
                'unit_price' => (float) $plan->price,
            ]],
            'notes' => 'Auto-generated from subscription plan',
        ]);
    }

    public function generateStudentInvoice(School $school, User $student, array $data): StudentInvoice
    {
        return $this->transaction(function () use ($school, $student, $data) {
            $items = $data['items'] ?? [];
            if ($items === []) {
                throw ValidationException::withMessages(['items' => ['At least one line item is required.']]);
            }

            $subtotal = 0.0;
            foreach ($items as $item) {
                $qty = (float) ($item['quantity'] ?? 1);
                $price = (float) $item['unit_price'];
                $subtotal += $qty * $price;
            }
            $tax = (float) ($data['tax_total'] ?? 0);

            $invoice = StudentInvoice::query()->create([
                'tenant_id' => $school->tenant_id,
                'school_id' => $school->id,
                'student_user_id' => $student->id,
                'number' => $data['number'] ?? $this->nextNumber('STU'),
                'currency' => $data['currency'] ?? 'SAR',
                'subtotal' => $subtotal,
                'tax_total' => $tax,
                'total' => $subtotal + $tax,
                'status' => $data['status'] ?? 'sent',
                'issued_at' => now(),
                'due_at' => $data['due_at'] ?? now()->addDays(7),
                'notes' => $data['notes'] ?? null,
            ]);

            foreach ($items as $item) {
                $qty = (float) ($item['quantity'] ?? 1);
                $price = (float) $item['unit_price'];
                StudentInvoiceItem::query()->create([
                    'student_invoice_id' => $invoice->id,
                    'description' => $item['description'],
                    'quantity' => $qty,
                    'unit_price' => $price,
                    'line_total' => $qty * $price,
                ]);
            }

            $this->notifier->dispatch($student, NotificationEvents::FEE_REMINDER, [
                'title_en' => 'Fee reminder',
                'title_ar' => 'تذكير بالرسوم',
                'body_en' => "Invoice {$invoice->number} due {$invoice->due_at}",
                'body_ar' => "الفاتورة {$invoice->number}",
                'invoice_id' => $invoice->id,
                'total' => $invoice->total,
            ], $school->tenant_id);

            return $invoice->load('items');
        });
    }

    public function createTutorPayment(School $school, TutorProfile $tutor, array $data): TutorPayment
    {
        return TutorPayment::query()->create([
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'tutor_profile_id' => $tutor->id,
            'tutoring_session_id' => $data['tutoring_session_id'] ?? null,
            'amount' => $data['amount'],
            'currency' => $data['currency'] ?? 'SAR',
            'status' => $data['status'] ?? 'pending',
            'period_start' => $data['period_start'] ?? null,
            'period_end' => $data['period_end'] ?? null,
            'reference' => $data['reference'] ?? null,
            'notes' => $data['notes'] ?? null,
        ]);
    }

    public function markTutorPaid(TutorPayment $payment, ?string $reference = null): TutorPayment
    {
        $payment->forceFill([
            'status' => 'paid',
            'paid_at' => now(),
            'reference' => $reference ?? $payment->reference,
        ])->save();

        return $payment->fresh();
    }

    private function nextNumber(string $prefix): string
    {
        return sprintf('%s-%s-%s', $prefix, now()->format('Ymd'), strtoupper(Str::random(6)));
    }
}
