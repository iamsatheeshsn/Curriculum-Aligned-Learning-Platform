<?php

namespace App\Http\Controllers\Api\V1\Institution;

use App\Domain\Academics\Services\SchoolContextService;
use App\Domain\Billing\Models\Invoice;
use App\Domain\Billing\Models\StudentInvoice;
use App\Domain\Billing\Models\TutorPayment;
use App\Domain\Billing\Services\InvoiceService;
use App\Domain\Billing\Services\SubscriptionService;
use App\Domain\Identity\Services\RbacService;
use App\Domain\Organization\Models\Tenant;
use App\Domain\Tutoring\Models\TutorProfile;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BillingController extends Controller
{
    public function __construct(
        protected SchoolContextService $schoolContext,
        protected InvoiceService $invoices,
        protected SubscriptionService $subscriptions,
        protected RbacService $rbac,
    ) {}

    public function plans(Request $request): JsonResponse
    {
        $this->authorizeBillingView($request);

        return response()->json(['data' => $this->subscriptions->listPlans()]);
    }

    public function schoolInvoices(Request $request): JsonResponse
    {
        $this->authorizeBillingView($request);
        $tenant = $this->tenant($request);

        $items = Invoice::query()
            ->where('tenant_id', $tenant->id)
            ->with('items')
            ->orderByDesc('id')
            ->paginate((int) $request->integer('per_page', 10));

        return response()->json($items);
    }

    public function createSchoolInvoice(Request $request): JsonResponse
    {
        $this->authorizeBillingManage($request);
        $tenant = $this->tenant($request);

        $data = $request->validate([
            'currency' => ['nullable', 'string', 'size:3'],
            'tax_total' => ['nullable', 'numeric', 'min:0'],
            'due_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
            'from_plan' => ['nullable', 'boolean'],
            'plan_code' => ['nullable', 'string'],
            'items' => ['nullable', 'array'],
            'items.*.description' => ['required_with:items', 'string'],
            'items.*.quantity' => ['nullable', 'numeric', 'min:0.01'],
            'items.*.unit_price' => ['required_with:items', 'numeric', 'min:0'],
        ]);

        if ($request->boolean('from_plan')) {
            $plan = $this->subscriptions->listPlans()->firstWhere('code', $data['plan_code'] ?? '')
                ?? $this->subscriptions->currentForTenant($tenant)?->plan;
            if (! $plan) {
                return response()->json(['message' => 'Plan not found.', 'code' => 'plan_missing'], 422);
            }
            $invoice = $this->invoices->generateFromPlan($tenant, $plan, $request->user()->id);
        } else {
            $invoice = $this->invoices->generateSchoolInvoice($tenant, $data);
        }

        return response()->json(['message' => 'Invoice generated.', 'data' => $invoice], 201);
    }

    public function sendSchoolInvoice(Request $request, int $invoice): JsonResponse
    {
        $this->authorizeBillingManage($request);
        $tenant = $this->tenant($request);
        $model = Invoice::query()->where('tenant_id', $tenant->id)->findOrFail($invoice);

        return response()->json([
            'message' => 'Invoice sent.',
            'data' => $this->invoices->sendInvoice($model),
        ]);
    }

    public function paySchoolInvoice(Request $request, int $invoice): JsonResponse
    {
        $this->authorizeBillingManage($request);
        $tenant = $this->tenant($request);
        $model = Invoice::query()->where('tenant_id', $tenant->id)->findOrFail($invoice);

        $minAmount = (float) $model->total <= 0 ? 0 : 0.01;
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:'.$minAmount],
            'method' => ['nullable', 'in:manual,bank,card,other'],
            'reference' => ['nullable', 'string', 'max:191'],
            'paid_at' => ['nullable', 'date'],
        ]);

        $payment = $this->invoices->recordPayment($model, $data, $request->user()->id);

        return response()->json(['message' => 'Payment recorded.', 'data' => $payment->load('invoice')]);
    }

    public function studentInvoices(Request $request): JsonResponse
    {
        $this->authorizeBillingView($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $items = StudentInvoice::query()
            ->where('school_id', $school->id)
            ->when($request->filled('student_user_id'), fn ($q) => $q->where('student_user_id', $request->integer('student_user_id')))
            ->with('items')
            ->orderByDesc('id')
            ->paginate((int) $request->integer('per_page', 10));

        return response()->json($items);
    }

    public function createStudentInvoice(Request $request): JsonResponse
    {
        $this->authorizeBillingManage($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $data = $request->validate([
            'student_user_id' => ['required', 'integer'],
            'currency' => ['nullable', 'string', 'size:3'],
            'tax_total' => ['nullable', 'numeric', 'min:0'],
            'due_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.description' => ['required', 'string'],
            'items.*.quantity' => ['nullable', 'numeric', 'min:0.01'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
        ]);

        $student = User::query()->where('tenant_id', $school->tenant_id)->findOrFail($data['student_user_id']);
        $invoice = $this->invoices->generateStudentInvoice($school, $student, $data);

        return response()->json(['message' => 'Student invoice generated.', 'data' => $invoice], 201);
    }

    public function tutorPayments(Request $request): JsonResponse
    {
        $this->authorizeBillingView($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $items = TutorPayment::query()
            ->where('school_id', $school->id)
            ->with('tutor.user:id,first_name,last_name')
            ->orderByDesc('id')
            ->paginate((int) $request->integer('per_page', 10));

        return response()->json($items);
    }

    public function createTutorPayment(Request $request): JsonResponse
    {
        $this->authorizeBillingManage($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $data = $request->validate([
            'tutor_profile_id' => ['required', 'integer'],
            'amount' => ['required', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'tutoring_session_id' => ['nullable', 'integer'],
            'period_start' => ['nullable', 'date'],
            'period_end' => ['nullable', 'date'],
            'reference' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
        ]);

        $tutor = TutorProfile::query()->where('school_id', $school->id)->findOrFail($data['tutor_profile_id']);
        $payment = $this->invoices->createTutorPayment($school, $tutor, $data);

        return response()->json(['message' => 'Tutor payment created.', 'data' => $payment], 201);
    }

    public function markTutorPaid(Request $request, int $payment): JsonResponse
    {
        $this->authorizeBillingManage($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = TutorPayment::query()->where('school_id', $school->id)->findOrFail($payment);
        $data = $request->validate(['reference' => ['nullable', 'string', 'max:191']]);

        return response()->json([
            'message' => 'Tutor payment marked paid.',
            'data' => $this->invoices->markTutorPaid($model, $data['reference'] ?? null),
        ]);
    }

    private function tenant(Request $request): Tenant
    {
        $tenantId = app(\App\Support\TenantContext::class)->tenantId()
            ?? $request->user()->tenant_id;
        return Tenant::query()->findOrFail($tenantId);
    }

    private function authorizeBillingView(Request $request): void
    {
        $user = $request->user();
        if ($this->rbac->can($user, 'tenant.billing.view') || $this->rbac->can($user, 'tenant.billing.manage') || $this->rbac->can($user, 'reports.finance.view')) {
            return;
        }
        $this->rbac->authorize($user, 'tenant.billing.view');
    }

    private function authorizeBillingManage(Request $request): void
    {
        $this->rbac->authorize($request->user(), 'tenant.billing.manage');
    }
}
