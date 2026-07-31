<?php

namespace App\Domain\Platform\Services;

use App\Domain\Organization\Models\School;
use App\Domain\Organization\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\PersonalAccessToken;

class SystemHealthService
{
    /** @return array<string, mixed> */
    public function report(): array
    {
        $checks = [];
        $checks[] = $this->timed('database', 'Database', fn () => $this->checkDatabase());
        $checks[] = $this->timed('cache', 'Cache', fn () => $this->checkCache());
        $checks[] = $this->timed('storage', 'Storage', fn () => $this->checkStorage());
        $checks[] = $this->timed('queue', 'Queue', fn () => $this->checkQueue());
        $checks[] = $this->timed('sessions', 'Sessions', fn () => $this->checkSessions());
        $checks[] = $this->timed('mail', 'Mail', fn () => $this->checkMail());
        $checks[] = $this->timed('auth_tokens', 'API tokens', fn () => $this->checkTokens());
        $checks[] = $this->timed('app_config', 'App config', fn () => $this->checkAppConfig());

        $statuses = collect($checks)->pluck('status');
        $overall = 'ok';
        if ($statuses->contains('critical')) {
            $overall = 'critical';
        } elseif ($statuses->contains('degraded') || $statuses->contains('warn')) {
            $overall = 'degraded';
        }

        $okCount = $statuses->filter(fn ($s) => $s === 'ok')->count();
        $warnCount = $statuses->filter(fn ($s) => in_array($s, ['warn', 'degraded'], true))->count();
        $criticalCount = $statuses->filter(fn ($s) => $s === 'critical')->count();

        return [
            'overall' => $overall,
            'summary' => [
                'total_checks' => count($checks),
                'ok' => $okCount,
                'warn' => $warnCount,
                'critical' => $criticalCount,
                'avg_latency_ms' => round(collect($checks)->avg('latency_ms') ?? 0, 1),
            ],
            'checks' => $checks,
            'runtime' => [
                'app_name' => (string) config('app.name'),
                'env' => (string) config('app.env'),
                'debug' => (bool) config('app.debug'),
                'url' => (string) config('app.url'),
                'timezone' => (string) config('app.timezone'),
                'locale' => (string) config('app.locale'),
                'php_version' => PHP_VERSION,
                'laravel_version' => app()->version(),
                'api_version' => (string) config('mobile.api_version', '1.0.0'),
                'queue_connection' => (string) config('queue.default'),
                'cache_store' => (string) config('cache.default'),
                'session_driver' => (string) config('session.driver'),
                'mail_mailer' => (string) config('mail.default'),
                'filesystem_disk' => (string) config('filesystems.default'),
            ],
            'platform' => $this->platformSnapshot(),
            'failed_jobs' => $this->recentFailedJobs(),
            'queue_stats' => $this->queueStats(),
            'generated_at' => now()->toIso8601String(),
        ];
    }

    /**
     * @param  callable(): array{status: string, message: string, detail?: array<string, mixed>}  $callback
     * @return array<string, mixed>
     */
    protected function timed(string $id, string $label, callable $callback): array
    {
        $started = microtime(true);
        try {
            $result = $callback();
        } catch (\Throwable $e) {
            $result = [
                'status' => 'critical',
                'message' => $e->getMessage(),
                'detail' => [],
            ];
        }

        return [
            'id' => $id,
            'label' => $label,
            'status' => $result['status'] ?? 'critical',
            'message' => $result['message'] ?? 'Unknown',
            'detail' => $result['detail'] ?? [],
            'latency_ms' => round((microtime(true) - $started) * 1000, 1),
        ];
    }

    /** @return array{status: string, message: string, detail: array<string, mixed>} */
    protected function checkDatabase(): array
    {
        $pdo = DB::connection()->getPdo();
        $name = DB::connection()->getDatabaseName();
        $driver = DB::connection()->getDriverName();
        $tenantCount = Tenant::query()->where('slug', '!=', 'platform')->count();

        return [
            'status' => 'ok',
            'message' => "Connected via {$driver}",
            'detail' => [
                'driver' => $driver,
                'database' => $name,
                'server_version' => method_exists($pdo, 'getAttribute')
                    ? (string) $pdo->getAttribute(\PDO::ATTR_SERVER_VERSION)
                    : null,
                'tenants' => $tenantCount,
            ],
        ];
    }

    /** @return array{status: string, message: string, detail: array<string, mixed>} */
    protected function checkCache(): array
    {
        $key = 'stemora.health.'.uniqid('', true);
        $value = (string) random_int(1000, 9999);
        Cache::put($key, $value, 30);
        $read = Cache::get($key);
        Cache::forget($key);

        if ($read !== $value) {
            return [
                'status' => 'critical',
                'message' => 'Cache read/write mismatch',
                'detail' => ['store' => config('cache.default')],
            ];
        }

        return [
            'status' => 'ok',
            'message' => 'Read/write succeeded',
            'detail' => ['store' => (string) config('cache.default')],
        ];
    }

    /** @return array{status: string, message: string, detail: array<string, mixed>} */
    protected function checkStorage(): array
    {
        $disk = Storage::disk(config('filesystems.default', 'local'));
        $path = 'health/'.now()->format('YmdHis').'-'.uniqid().'.txt';
        $disk->put($path, 'ok');
        $exists = $disk->exists($path);
        $disk->delete($path);

        $root = storage_path('app');
        $free = @disk_free_space($root);
        $total = @disk_total_space($root);
        $freeGb = $free !== false ? round($free / 1024 / 1024 / 1024, 2) : null;
        $totalGb = $total !== false ? round($total / 1024 / 1024 / 1024, 2) : null;
        $usedPercent = ($free !== false && $total !== false && $total > 0)
            ? round((($total - $free) / $total) * 100, 1)
            : null;

        $status = 'ok';
        $message = 'Writable';
        if (! $exists) {
            $status = 'critical';
            $message = 'Could not write health probe file';
        } elseif ($freeGb !== null && $freeGb < 1) {
            $status = 'critical';
            $message = 'Less than 1 GB free';
        } elseif ($usedPercent !== null && $usedPercent >= 90) {
            $status = 'warn';
            $message = 'Disk usage elevated';
        } elseif ($freeGb !== null && $freeGb < 5) {
            $status = 'warn';
            $message = 'Low free disk space';
        }

        return [
            'status' => $status,
            'message' => $message,
            'detail' => [
                'disk' => (string) config('filesystems.default'),
                'writable' => $exists,
                'free_gb' => $freeGb,
                'total_gb' => $totalGb,
                'used_percent' => $usedPercent,
            ],
        ];
    }

    /** @return array{status: string, message: string, detail: array<string, mixed>} */
    protected function checkQueue(): array
    {
        $stats = $this->queueStats();
        $failed = (int) ($stats['failed'] ?? 0);
        $pending = (int) ($stats['pending'] ?? 0);

        $status = 'ok';
        $message = 'Queue healthy';
        if ($failed >= 25) {
            $status = 'critical';
            $message = 'High failed job count';
        } elseif ($failed > 0) {
            $status = 'warn';
            $message = 'Failed jobs present';
        } elseif ($pending >= 100) {
            $status = 'warn';
            $message = 'Large pending backlog';
        }

        return [
            'status' => $status,
            'message' => $message,
            'detail' => [
                'connection' => (string) config('queue.default'),
                'pending' => $pending,
                'failed' => $failed,
            ],
        ];
    }

    /** @return array{status: string, message: string, detail: array<string, mixed>} */
    protected function checkSessions(): array
    {
        if (! Schema::hasTable('sessions')) {
            return [
                'status' => 'warn',
                'message' => 'Sessions table not present',
                'detail' => ['driver' => (string) config('session.driver')],
            ];
        }

        $active = DB::table('sessions')
            ->where('last_activity', '>=', now()->subMinutes(30)->getTimestamp())
            ->count();

        return [
            'status' => 'ok',
            'message' => "{$active} active in last 30 minutes",
            'detail' => [
                'driver' => (string) config('session.driver'),
                'active_30m' => $active,
                'total' => DB::table('sessions')->count(),
            ],
        ];
    }

    /** @return array{status: string, message: string, detail: array<string, mixed>} */
    protected function checkMail(): array
    {
        $mailer = (string) config('mail.default');
        $from = (string) config('mail.from.address');
        $status = 'ok';
        $message = "Mailer {$mailer}";

        if ($mailer === '' || $from === '') {
            $status = 'warn';
            $message = 'Mailer or from-address not configured';
        } elseif ($mailer === 'log' && config('app.env') === 'production') {
            $status = 'warn';
            $message = 'Production is using log mailer';
        }

        return [
            'status' => $status,
            'message' => $message,
            'detail' => [
                'mailer' => $mailer,
                'from' => $from,
            ],
        ];
    }

    /** @return array{status: string, message: string, detail: array<string, mixed>} */
    protected function checkTokens(): array
    {
        if (! Schema::hasTable('personal_access_tokens')) {
            return [
                'status' => 'warn',
                'message' => 'API token table missing',
                'detail' => [],
            ];
        }

        $total = PersonalAccessToken::query()->count();
        $recent = PersonalAccessToken::query()
            ->where('last_used_at', '>=', now()->subDay())
            ->count();

        return [
            'status' => 'ok',
            'message' => "{$recent} used in last 24h",
            'detail' => [
                'total_tokens' => $total,
                'used_24h' => $recent,
            ],
        ];
    }

    /** @return array{status: string, message: string, detail: array<string, mixed>} */
    protected function checkAppConfig(): array
    {
        $env = (string) config('app.env');
        $debug = (bool) config('app.debug');
        $key = (string) config('app.key');

        $status = 'ok';
        $message = 'Configuration looks sound';
        $issues = [];

        if ($key === '') {
            $status = 'critical';
            $issues[] = 'APP_KEY missing';
        }
        if ($debug && $env === 'production') {
            $status = $status === 'critical' ? 'critical' : 'warn';
            $issues[] = 'APP_DEBUG enabled in production';
        }
        if ($env === 'local') {
            $issues[] = 'Running in local environment';
            if ($status === 'ok') {
                $status = 'ok';
            }
        }

        if ($issues !== []) {
            $message = implode('; ', $issues);
        }

        return [
            'status' => $status,
            'message' => $message,
            'detail' => [
                'env' => $env,
                'debug' => $debug,
                'has_app_key' => $key !== '',
            ],
        ];
    }

    /** @return array<string, mixed> */
    protected function platformSnapshot(): array
    {
        $tenants = Tenant::query()->where('slug', '!=', 'platform');

        return [
            'tenants' => (clone $tenants)->count(),
            'tenants_active' => (clone $tenants)->where('status', 'active')->count(),
            'tenants_trial' => (clone $tenants)->where('status', 'trial')->count(),
            'tenants_suspended' => (clone $tenants)->where('status', 'suspended')->count(),
            'schools' => School::query()->count(),
            'users' => User::query()->count(),
        ];
    }

    /** @return array{pending: int, failed: int, batches: int} */
    protected function queueStats(): array
    {
        $pending = Schema::hasTable('jobs') ? (int) DB::table('jobs')->count() : 0;
        $failed = Schema::hasTable('failed_jobs') ? (int) DB::table('failed_jobs')->count() : 0;
        $batches = Schema::hasTable('job_batches') ? (int) DB::table('job_batches')->count() : 0;

        return [
            'pending' => $pending,
            'failed' => $failed,
            'batches' => $batches,
        ];
    }

    /** @return list<array<string, mixed>> */
    protected function recentFailedJobs(): array
    {
        if (! Schema::hasTable('failed_jobs')) {
            return [];
        }

        return DB::table('failed_jobs')
            ->orderByDesc('failed_at')
            ->limit(8)
            ->get(['id', 'uuid', 'queue', 'payload', 'exception', 'failed_at'])
            ->map(function ($row) {
                $payload = json_decode((string) $row->payload, true);
                $displayName = $payload['displayName']
                    ?? $payload['data']['commandName']
                    ?? 'Job';

                $exception = (string) $row->exception;
                $firstLine = strtok($exception, "\n") ?: 'Failed job';

                return [
                    'id' => $row->id,
                    'uuid' => $row->uuid,
                    'queue' => $row->queue,
                    'job' => $displayName,
                    'error' => mb_substr($firstLine, 0, 180),
                    'failed_at' => $row->failed_at,
                ];
            })
            ->all();
    }
}
