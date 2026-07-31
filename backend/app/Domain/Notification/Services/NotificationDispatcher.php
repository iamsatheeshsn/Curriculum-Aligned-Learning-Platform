<?php

namespace App\Domain\Notification\Services;

use App\Domain\Notification\Models\MailLog;
use App\Domain\Notification\Models\NotificationDispatchLog;
use App\Domain\Notification\Models\NotificationPreference;
use App\Domain\Notification\NotificationEvents;
use App\Models\User;
use App\Services\BaseService;
use App\Support\TenantContext;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class NotificationDispatcher extends BaseService
{
    public function __construct(
        TenantContext $tenantContext,
        protected PortalNotificationService $inApp,
    ) {
        parent::__construct($tenantContext);
    }

    /**
     * Dispatch an event to one user across enabled channels.
     *
     * @param  array{title_en?:string,title_ar?:string,body_en?:string,body_ar?:string}  $payload
     * @return array<string, array{status:string, id?:string|null}>
     */
    public function dispatch(User $user, string $eventType, array $payload = [], ?int $tenantId = null): array
    {
        $tenantId = $tenantId ?? $user->tenant_id ?? $this->tenantId();
        $results = [];

        foreach (NotificationEvents::defaultChannels() as $channel) {
            if (! $this->channelEnabled($user, $eventType, $channel)) {
                $results[$channel] = ['status' => 'skipped_preference'];
                continue;
            }

            try {
                $results[$channel] = match ($channel) {
                    'in_app' => $this->sendInApp($user, $eventType, $payload, $tenantId),
                    'email' => $this->sendEmail($user, $eventType, $payload, $tenantId),
                    'sms' => $this->sendSms($user, $eventType, $payload, $tenantId),
                    'whatsapp' => $this->sendWhatsApp($user, $eventType, $payload, $tenantId),
                    default => ['status' => 'unsupported'],
                };
            } catch (\Throwable $e) {
                $results[$channel] = ['status' => 'failed', 'error' => $e->getMessage()];
                $this->logDispatch($tenantId, $eventType, $channel, $user->id, 'failed', null, $payload, $e->getMessage());
            }
        }

        return $results;
    }

    /**
     * @param  iterable<User>  $users
     */
    public function dispatchMany(iterable $users, string $eventType, array $payload = [], ?int $tenantId = null): array
    {
        $out = [];
        foreach ($users as $user) {
            $out[$user->id] = $this->dispatch($user, $eventType, $payload, $tenantId);
        }

        return $out;
    }

    public function channelEnabled(User $user, string $eventType, string $channel): bool
    {
        // Optional integrations off unless explicitly enabled in config or preference
        if ($channel === 'sms' && ! config('notifications.channels.sms.enabled', false)) {
            $pref = $this->preference($user, $eventType, $channel);
            if (! $pref || ! $pref->is_enabled) {
                return false;
            }
        }
        if ($channel === 'whatsapp' && ! config('notifications.channels.whatsapp.enabled', false)) {
            $pref = $this->preference($user, $eventType, $channel);
            if (! $pref || ! $pref->is_enabled) {
                return false;
            }
        }

        $pref = $this->preference($user, $eventType, $channel);
        if ($pref === null) {
            // Defaults: in_app + email on; sms/whatsapp off
            return in_array($channel, ['in_app', 'email'], true);
        }

        if (! $pref->is_enabled && NotificationEvents::isCritical($eventType) && $channel === 'in_app') {
            return true;
        }

        return (bool) $pref->is_enabled;
    }

    public function setPreference(User $user, string $eventType, string $channel, bool $enabled, ?int $tenantId = null): NotificationPreference
    {
        return NotificationPreference::query()->updateOrCreate(
            [
                'user_id' => $user->id,
                'event_type' => $eventType,
                'channel' => $channel,
            ],
            [
                'tenant_id' => $tenantId ?? $user->tenant_id ?? $this->tenantId(),
                'is_enabled' => $enabled,
            ]
        );
    }

    private function preference(User $user, string $eventType, string $channel): ?NotificationPreference
    {
        return NotificationPreference::query()
            ->where('user_id', $user->id)
            ->where('event_type', $eventType)
            ->where('channel', $channel)
            ->first();
    }

    private function sendInApp(User $user, string $eventType, array $payload, ?int $tenantId): array
    {
        $n = $this->inApp->notify($user, $eventType, $payload, $tenantId);
        $this->logDispatch($tenantId, $eventType, 'in_app', $user->id, 'sent', $n->id, $payload);

        return ['status' => 'sent', 'id' => $n->id];
    }

    private function sendEmail(User $user, string $eventType, array $payload, ?int $tenantId): array
    {
        $locale = $user->locale ?: 'en';
        $subject = $locale === 'ar'
            ? ($payload['title_ar'] ?? $payload['title_en'] ?? $eventType)
            : ($payload['title_en'] ?? $eventType);
        $body = $locale === 'ar'
            ? ($payload['body_ar'] ?? $payload['body_en'] ?? $subject)
            : ($payload['body_en'] ?? $subject);

        $messageId = null;
        $status = 'sent';

        try {
            if (config('notifications.channels.email.driver', 'log') === 'mail') {
                Mail::raw($body, function ($message) use ($user, $subject) {
                    $message->to($user->email)->subject($subject);
                });
            } else {
                Log::info('Notification email (log driver)', [
                    'to' => $user->email,
                    'subject' => $subject,
                    'event' => $eventType,
                ]);
                $messageId = 'log-'.Str::uuid();
            }
        } catch (\Throwable $e) {
            $status = 'failed';
            MailLog::query()->create([
                'tenant_id' => $tenantId,
                'to_email' => $user->email,
                'subject' => $subject,
                'status' => 'failed',
                'provider_message_id' => null,
                'created_at' => now(),
            ]);
            throw $e;
        }

        MailLog::query()->create([
            'tenant_id' => $tenantId,
            'to_email' => $user->email,
            'subject' => $subject,
            'status' => $status,
            'provider_message_id' => $messageId,
            'created_at' => now(),
        ]);

        $this->logDispatch($tenantId, $eventType, 'email', $user->id, $status, $messageId, $payload);

        return ['status' => $status, 'id' => $messageId];
    }

    private function sendSms(User $user, string $eventType, array $payload, ?int $tenantId): array
    {
        // Optional provider stub — logs only until SMS gateway configured
        $id = 'sms-stub-'.Str::uuid();
        Log::info('SMS notification stub', [
            'user_id' => $user->id,
            'phone' => $user->phone,
            'event' => $eventType,
            'payload' => $payload,
        ]);
        $this->logDispatch($tenantId, $eventType, 'sms', $user->id, 'stubbed', $id, $payload);

        return ['status' => 'stubbed', 'id' => $id];
    }

    private function sendWhatsApp(User $user, string $eventType, array $payload, ?int $tenantId): array
    {
        $id = 'wa-stub-'.Str::uuid();
        Log::info('WhatsApp notification stub', [
            'user_id' => $user->id,
            'phone' => $user->phone,
            'event' => $eventType,
        ]);
        $this->logDispatch($tenantId, $eventType, 'whatsapp', $user->id, 'stubbed', $id, $payload);

        return ['status' => 'stubbed', 'id' => $id];
    }

    private function logDispatch(
        ?int $tenantId,
        string $eventType,
        string $channel,
        ?int $userId,
        string $status,
        ?string $providerId,
        array $payload,
        ?string $error = null,
    ): void {
        NotificationDispatchLog::query()->create([
            'tenant_id' => $tenantId,
            'event_type' => $eventType,
            'channel' => $channel,
            'user_id' => $userId,
            'status' => $status,
            'provider_message_id' => $providerId,
            'payload_json' => $payload,
            'error_message' => $error,
            'created_at' => now(),
        ]);
    }
}
