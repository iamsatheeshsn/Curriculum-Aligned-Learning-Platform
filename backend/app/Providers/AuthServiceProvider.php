<?php

namespace App\Providers;

use App\Domain\Assessment\Policies\AssessmentPolicy;
use App\Domain\Identity\Services\RbacService;
use App\Domain\Learning\Policies\LearningContentPolicy;
use App\Domain\Organization\Models\School;
use App\Domain\Organization\Models\Tenant;
use App\Domain\Organization\Policies\SchoolPolicy;
use App\Domain\Organization\Policies\TenantPolicy;
use App\Domain\Tutoring\Policies\TutoringPolicy;
use App\Models\User;
use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;
use Illuminate\Support\Facades\Gate;

class AuthServiceProvider extends ServiceProvider
{
    /** @var array<class-string, class-string> */
    protected $policies = [
        Tenant::class => TenantPolicy::class,
        School::class => SchoolPolicy::class,
    ];

    public function boot(): void
    {
        $this->registerPolicies();

        Gate::before(function (User $user, string $ability) {
            if (app(RbacService::class)->hasRole($user, 'super_admin')) {
                return true;
            }

            return null;
        });

        Gate::define('learning.manage', fn (User $u) => app(LearningContentPolicy::class)->manage($u));
        Gate::define('learning.assign', fn (User $u) => app(LearningContentPolicy::class)->assign($u));
        Gate::define('learning.consume', fn (User $u) => app(LearningContentPolicy::class)->consume($u));

        Gate::define('assessments.manage', fn (User $u) => app(AssessmentPolicy::class)->manage($u));
        Gate::define('assessments.grade', fn (User $u) => app(AssessmentPolicy::class)->grade($u));
        Gate::define('assessments.attempt', fn (User $u) => app(AssessmentPolicy::class)->attempt($u));

        Gate::define('tutoring.manage', fn (User $u) => app(TutoringPolicy::class)->manage($u));
        Gate::define('tutoring.conduct', fn (User $u) => app(TutoringPolicy::class)->conduct($u));
        Gate::define('tutoring.book', fn (User $u) => app(TutoringPolicy::class)->book($u));
        Gate::define('tutoring.join', fn (User $u) => app(TutoringPolicy::class)->join($u));

        Gate::define('permission', function (User $user, string $permission) {
            return app(RbacService::class)->can($user, $permission, $user->tenant_id);
        });
    }
}
