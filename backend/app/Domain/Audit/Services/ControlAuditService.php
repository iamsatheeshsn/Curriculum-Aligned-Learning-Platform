<?php



namespace App\Domain\Audit\Services;



use App\Domain\Audit\Models\AuditLog;

use App\Models\User;

use Illuminate\Database\Eloquent\Builder;



class ControlAuditService

{

    public const LOGIN_ACTION = 'auth.login';



    /** @param  array{search?: ?string, tenant_id?: ?int, actor_user_id?: ?int, from?: ?string, to?: ?string, limit?: ?int}  $filters

     *  @return list<array<string, mixed>>

     */

    public function activity(array $filters = []): array

    {

        return $this->listQuery($filters)

            ->where('action', '!=', self::LOGIN_ACTION)

            ->orderByDesc('created_at')

            ->limit((int) ($filters['limit'] ?? 100))

            ->get()

            ->map(fn (AuditLog $log) => $this->serialize($log))

            ->all();

    }



    /** @return array{total: int, today: int, unique_actors: int} */

    public function activityStats(): array

    {

        $base = AuditLog::query()->where('action', '!=', self::LOGIN_ACTION);



        return [

            'total' => (int) (clone $base)->count(),

            'today' => (int) (clone $base)->whereDate('created_at', today())->count(),

            'unique_actors' => (int) (clone $base)->whereNotNull('actor_user_id')->distinct('actor_user_id')->count('actor_user_id'),

        ];

    }



    /** @param  array{search?: ?string, tenant_id?: ?int, from?: ?string, to?: ?string, limit?: ?int}  $filters

     *  @return list<array<string, mixed>>

     */

    public function logins(array $filters = []): array

    {

        $rows = $this->listQuery($filters)

            ->where('action', self::LOGIN_ACTION)

            ->orderByDesc('created_at')

            ->limit((int) ($filters['limit'] ?? 100))

            ->get()

            ->map(fn (AuditLog $log) => $this->serialize($log))

            ->all();



        if ($rows !== []) {

            return $rows;

        }



        return $this->synthesizeLogins($filters);

    }



    /** @return array{total: int, today: int, unique_users: int} */

    public function loginStats(): array

    {

        $base = AuditLog::query()->where('action', self::LOGIN_ACTION);

        $total = (int) (clone $base)->count();



        if ($total === 0) {

            $users = User::query()->whereNotNull('last_login_at')->get(['id', 'last_login_at']);



            return [

                'total' => $users->count(),

                'today' => $users->filter(fn (User $u) => $u->last_login_at?->isToday())->count(),

                'unique_users' => $users->count(),

            ];

        }



        return [

            'total' => $total,

            'today' => (int) (clone $base)->whereDate('created_at', today())->count(),

            'unique_users' => (int) (clone $base)->whereNotNull('actor_user_id')->distinct('actor_user_id')->count('actor_user_id'),

        ];

    }



    /** @param  array{search?: ?string, action?: ?string, tenant_id?: ?int, actor_user_id?: ?int, from?: ?string, to?: ?string, limit?: ?int}  $filters

     *  @return list<array<string, mixed>>

     */

    public function logs(array $filters = []): array

    {

        return $this->listQuery($filters)

            ->when($filters['action'] ?? null, fn ($q, $action) => $q->where('action', $action))

            ->orderByDesc('created_at')

            ->limit((int) ($filters['limit'] ?? 100))

            ->get()

            ->map(fn (AuditLog $log) => $this->serialize($log))

            ->all();

    }



    /** @return array{total: int, today: int, actions: list<array{action: string, count: int}>} */

    public function logStats(): array

    {

        $base = AuditLog::query();



        $actions = (clone $base)

            ->selectRaw('action, COUNT(*) as total')

            ->groupBy('action')

            ->orderByDesc('total')

            ->limit(20)

            ->get()

            ->map(fn ($row) => ['action' => (string) $row->action, 'count' => (int) $row->total])

            ->all();



        return [

            'total' => (int) (clone $base)->count(),

            'today' => (int) (clone $base)->whereDate('created_at', today())->count(),

            'actions' => $actions,

        ];

    }



    /** @return array<string, mixed> */

    public function show(AuditLog $log): array

    {

        return $this->serialize($log->load(['actor:id,email,first_name,last_name', 'tenant:id,name,slug']));

    }



    /** @param  array<string, mixed>  $data

     *  @return array<string, mixed>

     */

    public function record(array $data): array

    {

        $log = AuditLog::query()->create([

            'tenant_id' => $data['tenant_id'] ?? null,

            'actor_user_id' => $data['actor_user_id'] ?? null,

            'action' => (string) ($data['action'] ?? 'unknown'),

            'auditable_type' => $data['auditable_type'] ?? null,

            'auditable_id' => $data['auditable_id'] ?? null,

            'properties' => $data['properties'] ?? [],

            'ip_address' => $data['ip_address'] ?? null,

            'user_agent' => $data['user_agent'] ?? null,

            'created_at' => $data['created_at'] ?? now(),

        ]);



        return $this->serialize($log);

    }



    /** @param  array{search?: ?string, tenant_id?: ?int, from?: ?string, to?: ?string, limit?: ?int}  $filters

     *  @return list<array<string, mixed>>

     */

    protected function synthesizeLogins(array $filters): array

    {

        $query = User::query()

            ->whereNotNull('last_login_at')

            ->when($filters['search'] ?? null, function ($q, $search) {

                $like = '%'.$search.'%';

                $q->where(function ($inner) use ($like) {

                    $inner->where('email', 'like', $like)

                        ->orWhere('first_name', 'like', $like)

                        ->orWhere('last_name', 'like', $like);

                });

            })

            ->when($filters['from'] ?? null, fn ($q, $from) => $q->where('last_login_at', '>=', $from))

            ->when($filters['to'] ?? null, fn ($q, $to) => $q->where('last_login_at', '<=', $to))

            ->orderByDesc('last_login_at')

            ->limit((int) ($filters['limit'] ?? 100));



        return $query->get(['id', 'email', 'first_name', 'last_name', 'tenant_id', 'last_login_at'])

            ->map(fn (User $user) => [

                'id' => null,

                'synthesized' => true,

                'action' => self::LOGIN_ACTION,

                'actor' => [

                    'id' => $user->id,

                    'email' => $user->email,

                    'name' => trim($user->first_name.' '.$user->last_name),

                ],

                'tenant_id' => $user->tenant_id,

                'properties' => ['source' => 'users.last_login_at'],

                'ip_address' => null,

                'user_agent' => null,

                'created_at' => optional($user->last_login_at)?->toIso8601String(),

            ])

            ->all();

    }



    /** @param  array<string, mixed>  $filters

     *  @return Builder<AuditLog>

     */

    protected function listQuery(array $filters): Builder

    {

        return AuditLog::query()

            ->with(['actor:id,email,first_name,last_name', 'tenant:id,name,slug'])

            ->when($filters['tenant_id'] ?? null, fn ($q, $id) => $q->where('tenant_id', (int) $id))

            ->when($filters['actor_user_id'] ?? null, fn ($q, $id) => $q->where('actor_user_id', (int) $id))

            ->when($filters['from'] ?? null, fn ($q, $from) => $q->where('created_at', '>=', $from))

            ->when($filters['to'] ?? null, fn ($q, $to) => $q->where('created_at', '<=', $to))

            ->when($filters['search'] ?? null, function ($q, $search) {

                $like = '%'.$search.'%';

                $q->where(function ($inner) use ($like) {

                    $inner->where('action', 'like', $like)

                        ->orWhereHas('actor', fn ($aq) => $aq->where('email', 'like', $like));

                });

            });

    }



    /** @return array<string, mixed> */

    protected function serialize(AuditLog $log): array

    {

        return [

            'id' => $log->id,

            'tenant_id' => $log->tenant_id,

            'tenant' => $log->tenant ? [

                'id' => $log->tenant->id,

                'name' => $log->tenant->name,

                'slug' => $log->tenant->slug,

            ] : null,

            'actor_user_id' => $log->actor_user_id,

            'actor' => $log->actor ? [

                'id' => $log->actor->id,

                'email' => $log->actor->email,

                'name' => trim($log->actor->first_name.' '.$log->actor->last_name),

            ] : null,

            'action' => $log->action,

            'auditable_type' => $log->auditable_type,

            'auditable_id' => $log->auditable_id,

            'properties' => $log->properties ?? [],

            'ip_address' => $log->ip_address,

            'user_agent' => $log->user_agent,

            'created_at' => optional($log->created_at)?->toIso8601String(),

        ];

    }

}


