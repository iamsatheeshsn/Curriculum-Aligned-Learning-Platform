<?php



namespace App\Domain\Platform\Services;



use App\Domain\Identity\Models\UserTenantRole;

use App\Domain\Organization\Models\School;

use App\Domain\Organization\Models\Tenant;

use App\Domain\Organization\Services\TenantService;



class ControlReportService

{

    public function __construct(

        protected TenantService $tenants,

    ) {}



    /** @return array<string, mixed> */

    public function revenue(int $months = 6): array

    {

        return $this->tenants->revenueAnalytics($months);

    }



    /** @return array<string, mixed> */

    public function schools(array $filters = []): array

    {

        $tenantBase = Tenant::query()->where('slug', '!=', 'platform');

        $tenantIds = (clone $tenantBase)->pluck('id');



        $query = School::query()

            ->with(['tenant:id,name,slug,status'])

            ->whereIn('tenant_id', $tenantIds)

            ->when($filters['tenant_id'] ?? null, fn ($q, $id) => $q->where('tenant_id', (int) $id))

            ->when($filters['status'] ?? null, fn ($q, $status) => $q->where('status', $status))

            ->when($filters['search'] ?? null, function ($q, $search) {

                $like = '%'.$search.'%';

                $q->where(function ($inner) use ($like) {

                    $inner->where('name_en', 'like', $like)

                        ->orWhere('name_ar', 'like', $like)

                        ->orWhere('code', 'like', $like);

                });

            });



        $schools = (clone $query)

            ->orderBy('name_en')

            ->limit((int) ($filters['limit'] ?? 200))

            ->get()

            ->map(fn (School $school) => [

                'id' => $school->id,

                'code' => $school->code,

                'name_en' => $school->name_en,

                'name_ar' => $school->name_ar,

                'status' => $school->status,

                'timezone' => $school->timezone,

                'tenant' => $school->tenant ? [

                    'id' => $school->tenant->id,

                    'name' => $school->tenant->name,

                    'slug' => $school->tenant->slug,

                    'status' => $school->tenant->status,

                ] : null,

            ])

            ->all();



        $byStatus = (clone $query)

            ->selectRaw('status, COUNT(*) as total')

            ->groupBy('status')

            ->pluck('total', 'status');



        return [

            'summary' => [

                'total_schools' => (int) (clone $query)->count(),

                'active' => (int) ($byStatus['active'] ?? 0),

                'inactive' => (int) ($byStatus['inactive'] ?? 0),

                'tenants_with_schools' => (int) School::query()

                    ->whereIn('tenant_id', $tenantIds)

                    ->distinct('tenant_id')

                    ->count('tenant_id'),

            ],

            'schools' => $schools,

            'generated_at' => now()->toIso8601String(),

        ];

    }



    /** @return array<string, mixed> */

    public function students(array $filters = []): array

    {

        $tenantBase = Tenant::query()->where('slug', '!=', 'platform');

        $tenantIds = (clone $tenantBase)->pluck('id');



        $roleQuery = UserTenantRole::query()

            ->whereIn('tenant_id', $tenantIds)

            ->whereHas('role', fn ($q) => $q->where('code', 'student'))

            ->when($filters['tenant_id'] ?? null, fn ($q, $id) => $q->where('tenant_id', (int) $id))

            ->when($filters['school_id'] ?? null, fn ($q, $id) => $q->where('school_id', (int) $id));



        $totalStudents = (int) (clone $roleQuery)->count();



        $tenantCounts = (clone $roleQuery)

            ->selectRaw('tenant_id, COUNT(*) as total')

            ->groupBy('tenant_id')

            ->pluck('total', 'tenant_id');



        $tenantsById = Tenant::query()

            ->whereIn('id', $tenantCounts->keys())

            ->get(['id', 'name', 'slug'])

            ->keyBy('id');



        $byTenant = $tenantCounts

            ->map(function ($count, $tenantId) use ($tenantsById) {

                $tenant = $tenantsById->get((int) $tenantId);



                return [

                    'tenant_id' => (int) $tenantId,

                    'tenant_name' => $tenant?->name,

                    'tenant_slug' => $tenant?->slug,

                    'students' => (int) $count,

                ];

            })

            ->sortByDesc('students')

            ->values()

            ->all();



        $recentRows = (clone $roleQuery)

            ->with(['user:id,email,first_name,last_name,status,last_login_at'])

            ->latest('id')

            ->limit((int) ($filters['limit'] ?? 50))

            ->get();



        $recentTenants = Tenant::query()

            ->whereIn('id', $recentRows->pluck('tenant_id')->filter()->unique())

            ->get(['id', 'name', 'slug'])

            ->keyBy('id');



        $recent = $recentRows

            ->map(function (UserTenantRole $row) use ($recentTenants) {

                $user = $row->user;

                $tenant = $recentTenants->get((int) $row->tenant_id);



                return [

                    'user_id' => $row->user_id,

                    'email' => $user?->email,

                    'name' => trim(($user?->first_name ?? '').' '.($user?->last_name ?? '')),

                    'status' => $user?->status,

                    'tenant' => $tenant ? [

                        'id' => $tenant->id,

                        'name' => $tenant->name,

                        'slug' => $tenant->slug,

                    ] : null,

                    'school_id' => $row->school_id,

                    'last_login_at' => optional($user?->last_login_at)?->toIso8601String(),

                ];

            })

            ->all();



        return [

            'summary' => [

                'total_students' => $totalStudents,

                'tenants' => count($byTenant),

            ],

            'by_tenant' => $byTenant,

            'recent' => $recent,

            'generated_at' => now()->toIso8601String(),

        ];

    }



    /** @return array<string, mixed> */

    public function usage(int $months = 6): array

    {

        return $this->tenants->saasAnalytics($months);

    }

}


