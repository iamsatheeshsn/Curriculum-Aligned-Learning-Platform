<?php

namespace App\Domain\Organization\Services;

use App\Domain\Billing\Models\Invoice;
use App\Domain\Billing\Models\Payment;
use App\Domain\Billing\Models\SubscriptionPlan;
use App\Domain\Billing\Models\TenantSubscription;
use App\Domain\Billing\Services\SubscriptionService;
use App\Domain\Identity\Models\Role;
use App\Domain\Identity\Models\UserTenantRole;
use App\Domain\Organization\Events\TenantCreated;
use App\Domain\Organization\Models\School;
use App\Domain\Organization\Models\Tenant;
use App\Domain\Organization\Models\TenantBranding;
use App\Domain\Organization\Repositories\TenantRepository;
use App\Models\User;
use App\Services\BaseService;
use App\Support\TenantContext;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class TenantService extends BaseService
{
    public function __construct(
        TenantContext $tenantContext,
        protected TenantRepository $tenants,
        protected SubscriptionService $subscriptions,
        protected SchoolRegistrationService $registration,
    ) {
        parent::__construct($tenantContext);
    }

    /** @param array<string, mixed> $data */
    public function create(array $data): Tenant
    {
        return $this->transaction(function () use ($data) {
            $data['slug'] = $data['slug'] ?? Str::slug($data['name']);

            /** @var Tenant $tenant */
            $tenant = $this->tenants->create($data);

            event(new TenantCreated($tenant, Auth::id()));

            return $tenant;
        });
    }

    public function findBySlug(string $slug): ?Tenant
    {
        return $this->tenants->findBySlug($slug);
    }

    public function find(int $id): Tenant
    {
        return $this->tenants->findOrFail($id);
    }

    /** @param array<string, mixed> $filters */
    public function paginate(array $filters = [], int $perPage = 10): LengthAwarePaginator
    {
        return $this->tenants->paginate($filters, $perPage);
    }

    /**
     * Super-admin provisioning — creates tenant, owner, school, branding, trial subscription.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function provision(array $data): array
    {
        return $this->registration->register($data);
    }

    public function updateStatus(Tenant $tenant, string $status, ?int $actorId = null): Tenant
    {
        $allowed = ['trial', 'active', 'suspended', 'closed'];
        if (! in_array($status, $allowed, true)) {
            throw ValidationException::withMessages([
                'status' => ['Invalid tenant status.'],
            ]);
        }

        if ($tenant->slug === 'platform') {
            throw ValidationException::withMessages([
                'status' => ['The platform tenant cannot be modified this way.'],
            ]);
        }

        $tenant->forceFill([
            'status' => $status,
            'updated_by' => $actorId,
        ])->save();

        return $tenant->fresh();
    }

    public function softDelete(Tenant $tenant, ?int $actorId = null): void
    {
        if ($tenant->slug === 'platform') {
            throw ValidationException::withMessages([
                'tenant' => ['The platform tenant cannot be deleted.'],
            ]);
        }

        $tenant->forceFill(['updated_by' => $actorId, 'status' => 'closed'])->save();
        $tenant->delete();
    }

    /** @param array<string, mixed> $data */
    public function updateSettings(Tenant $tenant, array $data, ?int $actorId = null): Tenant
    {
        $tenant->fill(array_intersect_key($data, array_flip([
            'name',
            'legal_name',
            'default_locale',
            'default_timezone',
        ])));
        $tenant->updated_by = $actorId;
        $tenant->save();

        return $tenant->fresh();
    }

    /** @param array<string, mixed> $data */
    public function upsertBranding(Tenant $tenant, array $data, ?int $actorId = null): TenantBranding
    {
        $payload = array_intersect_key($data, array_flip([
            'logo_path',
            'favicon_path',
            'primary_color',
            'secondary_color',
            'email_footer_en',
            'email_footer_ar',
        ]));
        $payload['updated_by'] = $actorId;

        $branding = $tenant->branding;
        if (! $branding) {
            $payload['tenant_id'] = $tenant->id;
            $payload['created_by'] = $actorId;

            return TenantBranding::query()->create($payload);
        }

        $branding->fill($payload);
        $branding->save();

        return $branding->fresh();
    }

    /** @return array{first_name:?string,last_name:?string,email:?string,phone:?string,user_id:?int} */
    public function billingContact(Tenant $tenant): array
    {
        $owner = $this->ownerUser($tenant);

        return [
            'user_id' => $owner?->id,
            'first_name' => $owner?->first_name,
            'last_name' => $owner?->last_name,
            'email' => $owner?->email,
            'phone' => $owner?->phone,
        ];
    }

    /** @param array<string, mixed> $data */
    public function updateBillingContact(Tenant $tenant, array $data, ?int $actorId = null): array
    {
        $owner = $this->ownerUser($tenant);
        if (! $owner) {
            throw ValidationException::withMessages([
                'billing_contact' => ['No school owner found for this tenant.'],
            ]);
        }

        if (! empty($data['email']) && $data['email'] !== $owner->email) {
            $exists = User::query()
                ->where('email', $data['email'])
                ->where('id', '!=', $owner->id)
                ->exists();
            if ($exists) {
                throw ValidationException::withMessages([
                    'email' => ['This email is already in use.'],
                ]);
            }
        }

        $owner->fill(array_intersect_key($data, array_flip([
            'first_name',
            'last_name',
            'email',
            'phone',
        ])));
        $owner->updated_by = $actorId;
        $owner->save();

        return $this->billingContact($tenant);
    }

    public function ownerUser(Tenant $tenant): ?User
    {
        $roleId = Role::query()->where('code', 'school_owner')->value('id');
        if (! $roleId) {
            return null;
        }

        $link = UserTenantRole::query()
            ->where('tenant_id', $tenant->id)
            ->where('role_id', $roleId)
            ->orderBy('id')
            ->first();

        return $link?->user;
    }

    /** @return array<string, mixed> */
    public function serializeTenant(Tenant $tenant): array
    {
        $subscription = $this->subscriptions->currentForTenant($tenant);
        $schoolsCount = School::query()->where('tenant_id', $tenant->id)->count();

        return [
            'id' => $tenant->id,
            'slug' => $tenant->slug,
            'name' => $tenant->name,
            'legal_name' => $tenant->legal_name,
            'status' => $tenant->status,
            'default_locale' => $tenant->default_locale,
            'default_timezone' => $tenant->default_timezone,
            'trial_ends_at' => $tenant->trial_ends_at,
            'tenant_group_id' => $tenant->tenant_group_id,
            'group' => $tenant->relationLoaded('group') && $tenant->group
                ? [
                    'id' => $tenant->group->id,
                    'name' => $tenant->group->name,
                    'slug' => $tenant->group->slug,
                ]
                : null,
            'schools_count' => $schoolsCount,
            'subscription' => $subscription ? [
                'id' => $subscription->id,
                'status' => $subscription->status,
                'is_active' => $subscription->isActive(),
                'starts_at' => $subscription->starts_at,
                'ends_at' => $subscription->ends_at,
                'plan' => [
                    'code' => $subscription->plan?->code,
                    'name_en' => $subscription->plan?->name_en,
                    'name_ar' => $subscription->plan?->name_ar,
                    'price' => $subscription->plan?->price,
                    'currency' => $subscription->plan?->currency,
                    'limits' => [
                        'max_schools' => $subscription->plan?->max_schools,
                        'max_campuses' => $subscription->plan?->max_campuses,
                        'max_students' => $subscription->plan?->max_students,
                        'max_teachers' => $subscription->plan?->max_teachers,
                        'max_storage_mb' => $subscription->plan?->max_storage_mb,
                    ],
                    'modules' => $subscription->plan?->modules_json,
                ],
            ] : null,
        ];
    }

    /** @return array<string, mixed> */
    public function superAdminDashboard(): array
    {
        $base = Tenant::query()->where('slug', '!=', 'platform');

        $byStatus = (clone $base)
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $planHealth = TenantSubscription::query()
            ->where('status', 'active')
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'))
            ->with('plan')
            ->get()
            ->groupBy(fn (TenantSubscription $s) => $s->plan?->code ?? 'unknown')
            ->map(fn ($group, $code) => [
                'plan_code' => $code,
                'plan_name' => $group->first()?->plan?->name_en ?? $code,
                'active_subscriptions' => $group->count(),
            ])
            ->values()
            ->all();

        $recent = (clone $base)
            ->latest('id')
            ->limit(8)
            ->get()
            ->map(fn (Tenant $t) => $this->serializeTenant($t))
            ->all();

        $trialsEnding = (clone $base)
            ->where('status', 'trial')
            ->whereNotNull('trial_ends_at')
            ->where('trial_ends_at', '<=', now()->addDays(7))
            ->orderBy('trial_ends_at')
            ->limit(5)
            ->get(['id', 'name', 'slug', 'trial_ends_at', 'status']);

        $plans = SubscriptionPlan::query()->where('is_active', true)->orderBy('price')->get([
            'id', 'code', 'name_en', 'name_ar', 'price', 'currency',
            'max_schools', 'max_students', 'max_teachers', 'modules_json',
        ]);

        return [
            'stats' => [
                'total_tenants' => (int) (clone $base)->count(),
                'active' => (int) ($byStatus['active'] ?? 0),
                'trial' => (int) ($byStatus['trial'] ?? 0),
                'suspended' => (int) ($byStatus['suspended'] ?? 0),
                'closed' => (int) ($byStatus['closed'] ?? 0),
            ],
            'plan_health' => $planHealth,
            'plans' => $plans,
            'recent_tenants' => $recent,
            'trials_ending_soon' => $trialsEnding,
        ];
    }

    /** @return array<string, mixed> */
    public function ownerDashboard(Tenant $tenant): array
    {
        $schools = School::query()
            ->where('tenant_id', $tenant->id)
            ->orderBy('name_en')
            ->get(['id', 'code', 'name_en', 'name_ar', 'status', 'timezone']);

        $branding = $tenant->branding;
        $invoices = Invoice::query()
            ->where('tenant_id', $tenant->id)
            ->orderByDesc('id')
            ->limit(8)
            ->get(['id', 'number', 'currency', 'total', 'status', 'due_at', 'issued_at', 'paid_at']);

        $studentsApprox = UserTenantRole::query()
            ->where('tenant_id', $tenant->id)
            ->whereHas('role', fn ($q) => $q->where('code', 'student'))
            ->count();

        return [
            'tenant' => $this->serializeTenant($tenant),
            'schools' => $schools,
            'branding' => $branding ? [
                'logo_path' => $branding->logo_path,
                'favicon_path' => $branding->favicon_path,
                'primary_color' => $branding->primary_color,
                'secondary_color' => $branding->secondary_color,
                'email_footer_en' => $branding->email_footer_en,
                'email_footer_ar' => $branding->email_footer_ar,
            ] : null,
            'billing_contact' => $this->billingContact($tenant),
            'invoices' => $invoices,
            'usage' => [
                'schools' => $schools->count(),
                'students' => $studentsApprox,
            ],
        ];
    }

    /**
     * Platform SaaS analytics for Super Admin / control operators.
     *
     * @return array<string, mixed>
     */
    public function saasAnalytics(int $months = 6): array
    {
        $months = max(3, min(24, $months));
        $from = now()->startOfMonth()->subMonths($months - 1);
        $tenantBase = Tenant::query()->where('slug', '!=', 'platform');
        $tenantIds = (clone $tenantBase)->pluck('id');

        $byStatus = (clone $tenantBase)
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $totalTenants = (int) (clone $tenantBase)->count();
        $active = (int) ($byStatus['active'] ?? 0);
        $trial = (int) ($byStatus['trial'] ?? 0);
        $suspended = (int) ($byStatus['suspended'] ?? 0);
        $closed = (int) ($byStatus['closed'] ?? 0);
        $convertible = $active + $trial;
        $conversionRate = $convertible > 0
            ? round(($active / $convertible) * 100, 1)
            : 0.0;

        $activeSubs = TenantSubscription::query()
            ->where('status', 'active')
            ->whereIn('tenant_id', $tenantIds)
            ->with('plan')
            ->get();

        $mrr = round((float) $activeSubs->sum(fn (TenantSubscription $s) => (float) ($s->plan?->price ?? 0)), 2);
        $currency = $activeSubs->first()?->plan?->currency
            ?? SubscriptionPlan::query()->where('is_active', true)->value('currency')
            ?? 'SAR';

        $planMix = $activeSubs
            ->groupBy(fn (TenantSubscription $s) => $s->plan?->code ?? 'unknown')
            ->map(function ($group, $code) {
                $plan = $group->first()?->plan;
                $price = (float) ($plan?->price ?? 0);
                $count = $group->count();

                return [
                    'plan_code' => $code,
                    'plan_name' => $plan?->name_en ?? $code,
                    'subscriptions' => $count,
                    'unit_price' => $price,
                    'mrr' => round($price * $count, 2),
                ];
            })
            ->sortByDesc('subscriptions')
            ->values()
            ->all();

        $schoolsCount = School::query()->whereIn('tenant_id', $tenantIds)->count();
        $usersCount = UserTenantRole::query()
            ->whereIn('tenant_id', $tenantIds)
            ->distinct('user_id')
            ->count('user_id');

        $monthKeys = [];
        for ($i = 0; $i < $months; $i++) {
            $cursor = $from->copy()->addMonths($i);
            $monthKeys[] = [
                'month' => $cursor->format('Y-m'),
                'label' => $cursor->format('M Y'),
            ];
        }

        $tenantCreates = (clone $tenantBase)
            ->where('created_at', '>=', $from)
            ->get(['created_at']);
        $createsByMonth = $tenantCreates
            ->groupBy(fn (Tenant $t) => $t->created_at?->format('Y-m') ?? '')
            ->map->count();

        $tenantGrowth = collect($monthKeys)->map(fn (array $row) => [
            'month' => $row['month'],
            'label' => $row['label'],
            'new_tenants' => (int) ($createsByMonth[$row['month']] ?? 0),
        ])->all();

        $paidInvoices = Invoice::query()
            ->whereIn('tenant_id', $tenantIds)
            ->where('status', 'paid')
            ->where(function ($q) use ($from) {
                $q->where('paid_at', '>=', $from)
                    ->orWhere(function ($q2) use ($from) {
                        $q2->whereNull('paid_at')->where('issued_at', '>=', $from);
                    });
            })
            ->get(['total', 'paid_at', 'issued_at', 'currency']);

        $revenueByMonthMap = $paidInvoices->groupBy(function (Invoice $invoice) {
            $when = $invoice->paid_at ?? $invoice->issued_at;

            return $when ? $when->format('Y-m') : '';
        })->map(fn ($group) => round((float) $group->sum('total'), 2));

        $revenueTrend = collect($monthKeys)->map(fn (array $row) => [
            'month' => $row['month'],
            'label' => $row['label'],
            'revenue' => (float) ($revenueByMonthMap[$row['month']] ?? 0),
        ])->all();

        $invoiceByStatus = Invoice::query()
            ->whereIn('tenant_id', $tenantIds)
            ->selectRaw('status, COUNT(*) as total, COALESCE(SUM(total), 0) as amount')
            ->groupBy('status')
            ->get()
            ->map(fn ($row) => [
                'status' => (string) $row->status,
                'count' => (int) $row->total,
                'amount' => round((float) $row->amount, 2),
            ])
            ->all();

        $statusMix = collect(['active', 'trial', 'suspended', 'closed'])
            ->map(fn (string $status) => [
                'status' => $status,
                'count' => (int) ($byStatus[$status] ?? 0),
                'percent' => $totalTenants > 0
                    ? round(((int) ($byStatus[$status] ?? 0) / $totalTenants) * 100, 1)
                    : 0.0,
            ])
            ->all();

        $trialsEnding = (clone $tenantBase)
            ->where('status', 'trial')
            ->whereNotNull('trial_ends_at')
            ->where('trial_ends_at', '<=', now()->addDays(14))
            ->orderBy('trial_ends_at')
            ->limit(10)
            ->get(['id', 'name', 'slug', 'trial_ends_at', 'status'])
            ->map(fn (Tenant $t) => [
                'id' => $t->id,
                'name' => $t->name,
                'slug' => $t->slug,
                'status' => $t->status,
                'trial_ends_at' => optional($t->trial_ends_at)?->toIso8601String(),
                'days_remaining' => $t->trial_ends_at
                    ? (int) now()->startOfDay()->diffInDays($t->trial_ends_at->copy()->startOfDay(), false)
                    : null,
            ])
            ->all();

        $recentSignups = (clone $tenantBase)
            ->withCount('schools')
            ->latest('created_at')
            ->limit(8)
            ->get()
            ->map(fn (Tenant $t) => [
                'id' => $t->id,
                'name' => $t->name,
                'slug' => $t->slug,
                'status' => $t->status,
                'schools_count' => (int) $t->schools_count,
                'created_at' => optional($t->created_at)?->toIso8601String(),
            ])
            ->all();

        $topTenants = (clone $tenantBase)
            ->withCount('schools')
            ->orderByDesc('schools_count')
            ->limit(8)
            ->get()
            ->map(fn (Tenant $t) => [
                'id' => $t->id,
                'name' => $t->name,
                'slug' => $t->slug,
                'status' => $t->status,
                'schools_count' => (int) $t->schools_count,
            ])
            ->all();

        $newInPeriod = (int) (clone $tenantBase)->where('created_at', '>=', $from)->count();
        $paidRevenuePeriod = round((float) $paidInvoices->sum('total'), 2);

        return [
            'period' => [
                'months' => $months,
                'from' => $from->toDateString(),
                'to' => now()->toDateString(),
            ],
            'kpis' => [
                'total_tenants' => $totalTenants,
                'active_tenants' => $active,
                'trial_tenants' => $trial,
                'suspended_tenants' => $suspended,
                'closed_tenants' => $closed,
                'new_tenants_period' => $newInPeriod,
                'conversion_rate' => $conversionRate,
                'mrr' => $mrr,
                'currency' => $currency,
                'schools' => $schoolsCount,
                'users' => $usersCount,
                'active_subscriptions' => $activeSubs->count(),
                'paid_revenue_period' => $paidRevenuePeriod,
            ],
            'status_mix' => $statusMix,
            'plan_mix' => $planMix,
            'tenant_growth' => $tenantGrowth,
            'revenue_trend' => $revenueTrend,
            'invoice_summary' => $invoiceByStatus,
            'trials_ending_soon' => $trialsEnding,
            'recent_signups' => $recentSignups,
            'top_tenants' => $topTenants,
            'generated_at' => now()->toIso8601String(),
        ];
    }

    /**
     * Platform revenue dashboard for Super Admin / control operators.
     *
     * @return array<string, mixed>
     */
    public function revenueAnalytics(int $months = 6): array
    {
        $months = max(3, min(24, $months));
        $from = now()->startOfMonth()->subMonths($months - 1);
        $tenantBase = Tenant::query()->where('slug', '!=', 'platform');
        $tenantIds = (clone $tenantBase)->pluck('id');

        $activeSubs = TenantSubscription::query()
            ->where('status', 'active')
            ->whereIn('tenant_id', $tenantIds)
            ->with(['plan', 'tenant:id,name,slug,status'])
            ->get();

        $mrr = round((float) $activeSubs->sum(fn (TenantSubscription $s) => (float) ($s->plan?->price ?? 0)), 2);
        $arr = round($mrr * 12, 2);
        $currency = $activeSubs->first()?->plan?->currency
            ?? SubscriptionPlan::query()->where('is_active', true)->value('currency')
            ?? 'SAR';

        $monthKeys = [];
        for ($i = 0; $i < $months; $i++) {
            $cursor = $from->copy()->addMonths($i);
            $monthKeys[] = [
                'month' => $cursor->format('Y-m'),
                'label' => $cursor->format('M Y'),
            ];
        }

        $paidInvoices = Invoice::query()
            ->whereIn('tenant_id', $tenantIds)
            ->where('status', 'paid')
            ->where(function ($q) use ($from) {
                $q->where('paid_at', '>=', $from)
                    ->orWhere(function ($q2) use ($from) {
                        $q2->whereNull('paid_at')->where('issued_at', '>=', $from);
                    });
            })
            ->with('tenant:id,name,slug')
            ->get();

        $revenueByMonthMap = $paidInvoices->groupBy(function (Invoice $invoice) {
            $when = $invoice->paid_at ?? $invoice->issued_at;

            return $when ? $when->format('Y-m') : '';
        })->map(fn ($group) => round((float) $group->sum('total'), 2));

        $revenueTrend = collect($monthKeys)->map(fn (array $row) => [
            'month' => $row['month'],
            'label' => $row['label'],
            'revenue' => (float) ($revenueByMonthMap[$row['month']] ?? 0),
        ])->all();

        $payments = Payment::query()
            ->whereIn('tenant_id', $tenantIds)
            ->where('paid_at', '>=', $from)
            ->with(['tenant:id,name,slug', 'invoice:id,number,status'])
            ->orderByDesc('paid_at')
            ->get();

        $paymentsByMonthMap = $payments
            ->groupBy(fn (Payment $p) => $p->paid_at?->format('Y-m') ?? '')
            ->map(fn ($group) => round((float) $group->sum('amount'), 2));

        $paymentsTrend = collect($monthKeys)->map(fn (array $row) => [
            'month' => $row['month'],
            'label' => $row['label'],
            'amount' => (float) ($paymentsByMonthMap[$row['month']] ?? 0),
        ])->all();

        $outstandingInvoices = Invoice::query()
            ->whereIn('tenant_id', $tenantIds)
            ->whereIn('status', ['draft', 'sent', 'overdue'])
            ->with('tenant:id,name,slug')
            ->orderByDesc('due_at')
            ->limit(12)
            ->get();

        $outstandingAmount = round((float) Invoice::query()
            ->whereIn('tenant_id', $tenantIds)
            ->whereIn('status', ['draft', 'sent', 'overdue'])
            ->sum('total'), 2);

        $paidRevenuePeriod = round((float) $paidInvoices->sum('total'), 2);
        $paymentsCollected = round((float) $payments->sum('amount'), 2);
        $paidCount = $paidInvoices->count();
        $avgPaidInvoice = $paidCount > 0 ? round($paidRevenuePeriod / $paidCount, 2) : 0.0;
        $denominator = $paidRevenuePeriod + $outstandingAmount;
        $collectionRate = $denominator > 0
            ? round(($paidRevenuePeriod / $denominator) * 100, 1)
            : 0.0;

        $invoicePipeline = Invoice::query()
            ->whereIn('tenant_id', $tenantIds)
            ->selectRaw('status, COUNT(*) as total, COALESCE(SUM(total), 0) as amount')
            ->groupBy('status')
            ->get()
            ->map(fn ($row) => [
                'status' => (string) $row->status,
                'count' => (int) $row->total,
                'amount' => round((float) $row->amount, 2),
            ])
            ->all();

        $revenueByPlan = $activeSubs
            ->groupBy(fn (TenantSubscription $s) => $s->plan?->code ?? 'unknown')
            ->map(function ($group, $code) {
                $plan = $group->first()?->plan;
                $price = (float) ($plan?->price ?? 0);
                $count = $group->count();

                return [
                    'plan_code' => $code,
                    'plan_name' => $plan?->name_en ?? $code,
                    'subscriptions' => $count,
                    'unit_price' => $price,
                    'mrr' => round($price * $count, 2),
                    'arr' => round($price * $count * 12, 2),
                ];
            })
            ->sortByDesc('mrr')
            ->values()
            ->all();

        $topPaying = $paidInvoices
            ->groupBy('tenant_id')
            ->map(function ($group) {
                /** @var Invoice $first */
                $first = $group->first();

                return [
                    'tenant_id' => $first->tenant_id,
                    'name' => $first->tenant?->name ?? 'Unknown',
                    'slug' => $first->tenant?->slug ?? '',
                    'invoices_paid' => $group->count(),
                    'revenue' => round((float) $group->sum('total'), 2),
                ];
            })
            ->sortByDesc('revenue')
            ->take(8)
            ->values()
            ->all();

        $recentPayments = $payments->take(10)->map(fn (Payment $p) => [
            'id' => $p->id,
            'amount' => (float) $p->amount,
            'currency' => $p->currency ?? $currency,
            'method' => $p->method,
            'reference' => $p->reference,
            'paid_at' => optional($p->paid_at)?->toIso8601String(),
            'tenant' => $p->tenant ? [
                'id' => $p->tenant->id,
                'name' => $p->tenant->name,
                'slug' => $p->tenant->slug,
            ] : null,
            'invoice_number' => $p->invoice?->number,
        ])->all();

        $outstandingList = $outstandingInvoices->map(fn (Invoice $invoice) => [
            'id' => $invoice->id,
            'number' => $invoice->number,
            'status' => $invoice->status,
            'total' => (float) $invoice->total,
            'currency' => $invoice->currency ?? $currency,
            'due_at' => optional($invoice->due_at)?->toIso8601String(),
            'issued_at' => optional($invoice->issued_at)?->toIso8601String(),
            'tenant' => $invoice->tenant ? [
                'id' => $invoice->tenant->id,
                'name' => $invoice->tenant->name,
                'slug' => $invoice->tenant->slug,
            ] : null,
            'days_overdue' => $invoice->due_at && $invoice->due_at->isPast()
                ? (int) $invoice->due_at->copy()->startOfDay()->diffInDays(now()->startOfDay())
                : 0,
        ])->all();

        $payingTenants = $paidInvoices->pluck('tenant_id')->unique()->count();

        return [
            'period' => [
                'months' => $months,
                'from' => $from->toDateString(),
                'to' => now()->toDateString(),
            ],
            'kpis' => [
                'mrr' => $mrr,
                'arr' => $arr,
                'currency' => $currency,
                'paid_revenue_period' => $paidRevenuePeriod,
                'payments_collected' => $paymentsCollected,
                'outstanding_amount' => $outstandingAmount,
                'collection_rate' => $collectionRate,
                'avg_paid_invoice' => $avgPaidInvoice,
                'paid_invoices' => $paidCount,
                'active_subscriptions' => $activeSubs->count(),
                'paying_tenants' => $payingTenants,
            ],
            'revenue_trend' => $revenueTrend,
            'payments_trend' => $paymentsTrend,
            'revenue_by_plan' => $revenueByPlan,
            'invoice_pipeline' => $invoicePipeline,
            'top_paying_tenants' => $topPaying,
            'outstanding_invoices' => $outstandingList,
            'recent_payments' => $recentPayments,
            'generated_at' => now()->toIso8601String(),
        ];
    }
}
