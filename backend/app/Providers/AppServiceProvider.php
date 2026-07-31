<?php

namespace App\Providers;

use App\Domain\Assessment\Events\AssessmentSubmitted;
use App\Domain\Notification\Listeners\SendTutoringSessionBookedNotifications;
use App\Domain\Organization\Events\TenantCreated;
use App\Domain\Organization\Models\Tenant;
use App\Domain\Organization\Observers\TenantObserver;
use App\Domain\Tutoring\Events\TutoringSessionBooked;
use App\Jobs\Default\SendDomainNotificationJob;
use App\Support\TenantContext;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(TenantContext::class, fn () => new TenantContext);
    }

    public function boot(): void
    {
        Tenant::observe(TenantObserver::class);

        Event::listen(TutoringSessionBooked::class, SendTutoringSessionBookedNotifications::class);

        Event::listen(TenantCreated::class, function (TenantCreated $event): void {
            SendDomainNotificationJob::dispatch(
                tenantId: $event->tenantId,
                actorId: $event->actorId,
                eventType: 'tenant.created',
                payload: ['tenant_id' => $event->tenant->id, 'slug' => $event->tenant->slug],
            );
        });

        Event::listen(AssessmentSubmitted::class, function (AssessmentSubmitted $event): void {
            SendDomainNotificationJob::dispatch(
                tenantId: $event->tenantId,
                schoolId: $event->schoolId,
                actorId: $event->actorId,
                eventType: 'assessment.submitted',
                payload: ['attempt_id' => $event->attemptId],
            );
        });
    }
}
