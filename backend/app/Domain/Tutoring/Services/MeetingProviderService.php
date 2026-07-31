<?php

namespace App\Domain\Tutoring\Services;

use App\Domain\Organization\Models\Tenant;
use App\Domain\Tutoring\Models\TutoringSession;
use App\Services\BaseService;
use App\Support\TenantContext;
use Illuminate\Support\Str;

class MeetingProviderService extends BaseService
{
    public function __construct(TenantContext $tenantContext)
    {
        parent::__construct($tenantContext);
    }

    /**
     * @return array{provider:string, external_id:string, join_url:string}
     */
    public function provision(TutoringSession $session): array
    {
        $externalId = 'lp-'.Str::lower((string) Str::ulid());

        return [
            'provider' => config('tutoring.meeting_provider', 'local'),
            'external_id' => $externalId,
            'join_url' => $this->localJoinUrl($session, $externalId, 'institution'),
        ];
    }

    /**
     * Resolve a browser-openable join URL for a session (rewrites legacy APP_URL/classroom stubs).
     *
     * @param  'institution'|'learner'  $portal
     */
    public function resolveJoinUrl(TutoringSession $session, string $portal = 'institution'): ?string
    {
        $portal = $portal === 'learner' ? 'learner' : 'institution';
        $url = $session->meeting_url;
        $externalId = $session->meeting_external_id;

        if (! $externalId && is_string($url) && preg_match('#/classroom/([^/?#]+)#', $url, $m)) {
            $externalId = $m[1];
        }

        if ($externalId) {
            return $this->localJoinUrl($session, $externalId, $portal);
        }

        return $url ?: null;
    }

    /**
     * @param  'institution'|'learner'  $portal
     */
    protected function localJoinUrl(TutoringSession $session, string $externalId, string $portal = 'institution'): string
    {
        $slug = $this->tenantSlugFor($session);

        if ($portal === 'learner') {
            $base = (string) config('tutoring.learner_url', 'http://localhost:5178');

            return $base.'/'.$slug.'/student/classroom/'.$externalId.'?session='.$session->id;
        }

        $base = (string) config('tutoring.institution_url', 'http://localhost:5175');

        return $base.'/'.$slug.'/classroom/'.$externalId.'?session='.$session->id;
    }

    protected function tenantSlugFor(TutoringSession $session): string
    {
        $slug = $this->tenantContext->tenantSlug();
        if (is_string($slug) && $slug !== '') {
            return $slug;
        }

        $tenantId = $session->tenant_id ?? null;
        if ($tenantId) {
            $fromDb = Tenant::query()->whereKey($tenantId)->value('slug');
            if (is_string($fromDb) && $fromDb !== '') {
                return $fromDb;
            }
        }

        return 'al-noor';
    }
}
