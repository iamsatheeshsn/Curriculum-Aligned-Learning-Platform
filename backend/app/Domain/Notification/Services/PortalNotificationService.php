<?php

namespace App\Domain\Notification\Services;

use App\Domain\Notification\Models\TenantDatabaseNotification;
use App\Models\User;
use App\Services\BaseService;
use App\Support\TenantContext;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Str;

class PortalNotificationService extends BaseService
{
    public function __construct(TenantContext $tenantContext)
    {
        parent::__construct($tenantContext);
    }

    public function notify(User $user, string $type, array $data, ?int $tenantId = null): TenantDatabaseNotification
    {
        return TenantDatabaseNotification::query()->create([
            'id' => (string) Str::uuid(),
            'tenant_id' => $tenantId ?? $user->tenant_id ?? $this->tenantId(),
            'type' => $type,
            'notifiable_type' => $user->getMorphClass(),
            'notifiable_id' => $user->id,
            'data' => $data,
            'read_at' => null,
        ]);
    }

    public function listFor(User $user, int $perPage = 10): LengthAwarePaginator
    {
        return TenantDatabaseNotification::query()
            ->where('notifiable_type', $user->getMorphClass())
            ->where('notifiable_id', $user->id)
            ->orderByDesc('created_at')
            ->paginate($perPage);
    }

    public function markRead(User $user, string $notificationId): TenantDatabaseNotification
    {
        $row = TenantDatabaseNotification::query()
            ->where('notifiable_type', $user->getMorphClass())
            ->where('notifiable_id', $user->id)
            ->findOrFail($notificationId);

        if ($row->read_at === null) {
            $row->forceFill(['read_at' => now()])->save();
        }

        return $row->fresh();
    }

    public function markAllRead(User $user): int
    {
        return TenantDatabaseNotification::query()
            ->where('notifiable_type', $user->getMorphClass())
            ->where('notifiable_id', $user->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);
    }

    public function unreadCount(User $user): int
    {
        return TenantDatabaseNotification::query()
            ->where('notifiable_type', $user->getMorphClass())
            ->where('notifiable_id', $user->id)
            ->whereNull('read_at')
            ->count();
    }
}
