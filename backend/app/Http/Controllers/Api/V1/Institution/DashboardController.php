<?php

namespace App\Http\Controllers\Api\V1\Institution;

use App\Domain\Academics\Models\SchoolClass;
use App\Domain\Curriculum\Models\Curriculum;
use App\Domain\Identity\Services\RbacService;
use App\Domain\Organization\Models\Campus;
use App\Domain\Organization\Models\School;
use App\Domain\Organization\Models\Tenant;
use App\Domain\Tutoring\Models\TutoringSession;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class DashboardController extends Controller
{
    public function __construct(
        protected TenantContext $tenantContext,
        protected RbacService $rbac,
    ) {}

    /**
     * Institution portal home summary — available to any authenticated tenant staff.
     */
    public function home(Request $request): JsonResponse
    {
        $user = $request->user();
        $tenantId = $this->tenantContext->tenantId() ?? $user->tenant_id;
        if (! $tenantId) {
            abort(403, 'Tenant context required.');
        }

        $tenant = Tenant::query()->findOrFail($tenantId);
        $today = Carbon::now($tenant->default_timezone ?: config('app.timezone'))->toDateString();

        $schools = School::query()
            ->where('tenant_id', $tenantId)
            ->orderBy('name_en')
            ->get(['id', 'code', 'name_en', 'name_ar', 'status', 'timezone']);

        $campuses = Campus::query()->where('tenant_id', $tenantId)->count();
        $activeClasses = SchoolClass::query()
            ->where('tenant_id', $tenantId)
            ->where('status', 'active')
            ->count();

        $staff = User::query()
            ->where('tenant_id', $tenantId)
            ->whereHas('tenantRoles.role', fn ($q) => $q->whereIn('portal', ['institution', 'control']))
            ->count();

        $students = User::query()
            ->where('tenant_id', $tenantId)
            ->whereHas('tenantRoles.role', fn ($q) => $q->where('code', 'student'))
            ->count();

        $sessionsToday = TutoringSession::query()
            ->where('tenant_id', $tenantId)
            ->whereDate('starts_at', $today)
            ->whereNotIn('status', ['cancelled'])
            ->count();

        $upcomingSessions = TutoringSession::query()
            ->where('tenant_id', $tenantId)
            ->where('starts_at', '>=', now())
            ->whereNotIn('status', ['cancelled', 'completed'])
            ->with(['subject:id,name_en', 'tutor.user:id,first_name,last_name'])
            ->orderBy('starts_at')
            ->limit(5)
            ->get()
            ->map(function (TutoringSession $session) {
                $tutorUser = $session->tutor?->user;

                return [
                    'id' => $session->id,
                    'starts_at' => $session->starts_at?->toIso8601String(),
                    'ends_at' => $session->ends_at?->toIso8601String(),
                    'status' => $session->status,
                    'language' => $session->language,
                    'subject' => $session->subject?->name_en,
                    'tutor' => $tutorUser
                        ? trim(($tutorUser->first_name ?? '').' '.($tutorUser->last_name ?? ''))
                        : null,
                ];
            });

        $curricula = Curriculum::query()
            ->where('tenant_id', $tenantId)
            ->orderByDesc('updated_at')
            ->limit(5)
            ->get(['id', 'name_en', 'status', 'version', 'updated_at']);

        $draftCurricula = Curriculum::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('status', ['draft', 'review'])
            ->count();

        $roles = $this->rbac->roleCodesFor($user, $tenantId);
        $permissions = $this->rbac->permissionsFor($user, $tenantId);

        return response()->json([
            'data' => [
                'tenant' => [
                    'id' => $tenant->id,
                    'slug' => $tenant->slug,
                    'name' => $tenant->name,
                    'status' => $tenant->status,
                    'default_locale' => $tenant->default_locale,
                    'default_timezone' => $tenant->default_timezone,
                ],
                'user' => [
                    'id' => $user->id,
                    'name' => trim(($user->first_name ?? '').' '.($user->last_name ?? '')) ?: $user->email,
                    'email' => $user->email,
                    'roles' => $roles,
                    'permissions' => $permissions,
                ],
                'stats' => [
                    'schools' => $schools->count(),
                    'campuses' => $campuses,
                    'active_classes' => $activeClasses,
                    'staff' => $staff,
                    'students' => $students,
                    'sessions_today' => $sessionsToday,
                    'curricula_pending' => $draftCurricula,
                ],
                'schools' => $schools,
                'upcoming_sessions' => $upcomingSessions,
                'curricula' => $curricula,
                'attention' => array_values(array_filter([
                    $draftCurricula > 0
                        ? [
                            'id' => 'curriculum-review',
                            'tone' => 'warn',
                            'title' => 'Curriculum awaiting publish',
                            'body' => "{$draftCurricula} curriculum version(s) are still in draft or review.",
                        ]
                        : null,
                    $sessionsToday > 0
                        ? [
                            'id' => 'sessions-today',
                            'tone' => 'info',
                            'title' => 'Live tutoring today',
                            'body' => "{$sessionsToday} tutoring session(s) scheduled for today.",
                        ]
                        : null,
                    $tenant->status === 'trial'
                        ? [
                            'id' => 'trial',
                            'tone' => 'info',
                            'title' => 'Organisation on trial',
                            'body' => 'Complete branding and invite staff before your trial ends.',
                        ]
                        : null,
                ])),
            ],
        ]);
    }
}
