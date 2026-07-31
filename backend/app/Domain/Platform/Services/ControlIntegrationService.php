<?php



namespace App\Domain\Platform\Services;



use App\Domain\Platform\Models\PlatformIntegration;

use Illuminate\Support\Facades\DB;

use Illuminate\Validation\ValidationException;



class ControlIntegrationService

{

    /** @var list<string> */

    public const CATEGORIES = ['payment', 'email', 'sms', 'video', 'ai'];



    /** @var array<string, list<array{code: string, name_en: string, name_ar: ?string, provider: string}>> */

    protected const DEFAULTS = [

        'payment' => [

            ['code' => 'stripe', 'name_en' => 'Stripe', 'name_ar' => 'سترايب', 'provider' => 'stripe'],

            ['code' => 'paypal', 'name_en' => 'PayPal', 'name_ar' => 'باي بال', 'provider' => 'paypal'],

            ['code' => 'moyasar', 'name_en' => 'Moyasar', 'name_ar' => 'ميسر', 'provider' => 'moyasar'],

            ['code' => 'hyperpay', 'name_en' => 'HyperPay', 'name_ar' => 'هايبر باي', 'provider' => 'hyperpay'],

        ],

        'email' => [

            ['code' => 'smtp', 'name_en' => 'SMTP', 'name_ar' => 'SMTP', 'provider' => 'smtp'],

            ['code' => 'mailgun', 'name_en' => 'Mailgun', 'name_ar' => 'ميلgun', 'provider' => 'mailgun'],

            ['code' => 'sendgrid', 'name_en' => 'SendGrid', 'name_ar' => 'سند جريد', 'provider' => 'sendgrid'],

            ['code' => 'ses', 'name_en' => 'Amazon SES', 'name_ar' => 'أمازون SES', 'provider' => 'ses'],

        ],

        'sms' => [

            ['code' => 'twilio', 'name_en' => 'Twilio', 'name_ar' => 'توilio', 'provider' => 'twilio'],

            ['code' => 'unifonic', 'name_en' => 'Unifonic', 'name_ar' => 'يونيفونيك', 'provider' => 'unifonic'],

            ['code' => 'messagebird', 'name_en' => 'MessageBird', 'name_ar' => 'مessageBird', 'provider' => 'messagebird'],

        ],

        'video' => [

            ['code' => 'zoom', 'name_en' => 'Zoom', 'name_ar' => 'زوم', 'provider' => 'zoom'],

            ['code' => 'teams', 'name_en' => 'Microsoft Teams', 'name_ar' => 'مايكروسوفت Teams', 'provider' => 'teams'],

            ['code' => 'google_meet', 'name_en' => 'Google Meet', 'name_ar' => 'Google Meet', 'provider' => 'google_meet'],

            ['code' => 'jitsi', 'name_en' => 'Jitsi', 'name_ar' => 'Jitsi', 'provider' => 'jitsi'],

        ],

        'ai' => [

            ['code' => 'openai', 'name_en' => 'OpenAI', 'name_ar' => 'OpenAI', 'provider' => 'openai'],

            ['code' => 'azure_openai', 'name_en' => 'Azure OpenAI', 'name_ar' => 'Azure OpenAI', 'provider' => 'azure_openai'],

            ['code' => 'anthropic', 'name_en' => 'Anthropic', 'name_ar' => 'Anthropic', 'provider' => 'anthropic'],

            ['code' => 'google_gemini', 'name_en' => 'Google Gemini', 'name_ar' => 'Google Gemini', 'provider' => 'google_gemini'],

        ],

    ];



    /** @var list<string> */

    protected const SECRET_KEYS = [

        'api_key', 'secret', 'secret_key', 'password', 'token', 'access_token',

        'private_key', 'webhook_secret', 'client_secret', 'auth_token',

    ];



    /** @return list<array<string, mixed>> */

    public function list(string $category, array $filters = []): array

    {

        $this->assertCategory($category);

        $this->ensureDefaults($category);



        return PlatformIntegration::query()

            ->where('category', $category)

            ->when($filters['status'] ?? null, fn ($q, $status) => $q->where('status', $status))

            ->when(($filters['active'] ?? null) === 'true', fn ($q) => $q->where('is_active', true))

            ->when(($filters['active'] ?? null) === 'false', fn ($q) => $q->where('is_active', false))

            ->orderByDesc('is_default')

            ->orderBy('name_en')

            ->get()

            ->map(fn (PlatformIntegration $row) => $this->serialize($row))

            ->all();

    }



    /** @return array{total: int, active: int, connected: int, default_code: ?string} */

    public function stats(string $category): array

    {

        $this->assertCategory($category);

        $this->ensureDefaults($category);



        $base = PlatformIntegration::query()->where('category', $category);



        return [

            'total' => (int) (clone $base)->count(),

            'active' => (int) (clone $base)->where('is_active', true)->count(),

            'connected' => (int) (clone $base)->where('status', 'connected')->count(),

            'default_code' => (clone $base)->where('is_default', true)->value('code'),

        ];

    }



    /** @return array<string, mixed> */

    public function show(string $category, string $integration): array

    {

        return $this->serialize($this->resolve($category, $integration));

    }



    /** @param  array<string, mixed>  $data

     *  @return array<string, mixed>

     */

    public function create(string $category, array $data, int $actorId): array

    {

        $this->assertCategory($category);

        $code = strtolower(trim((string) ($data['code'] ?? '')));

        if ($code === '') {

            throw ValidationException::withMessages(['code' => ['Integration code is required.']]);

        }



        $exists = PlatformIntegration::withTrashed()

            ->where('category', $category)

            ->where('code', $code)

            ->first();



        if ($exists && ! $exists->trashed()) {

            throw ValidationException::withMessages(['code' => ['Integration code already exists in this category.']]);

        }



        $payload = $this->normalize($data, $code, $category);



        $model = DB::transaction(function () use ($exists, $payload, $category, $actorId) {

            if ($exists?->trashed()) {

                $exists->restore();

                $exists->fill($payload);

                $exists->updated_by = $actorId;

                $exists->save();



                return $exists;

            }



            return PlatformIntegration::query()->create([

                ...$payload,

                'category' => $category,

                'created_by' => $actorId,

                'updated_by' => $actorId,

            ]);

        });



        if (! empty($payload['is_default'])) {

            $this->clearDefaultExcept($category, $model->id);

        }



        return $this->show($category, $model->code);

    }



    /** @param  array<string, mixed>  $data

     *  @return array<string, mixed>

     */

    public function update(string $category, string $integration, array $data, int $actorId): array

    {

        $model = $this->resolve($category, $integration);

        $code = array_key_exists('code', $data)

            ? strtolower(trim((string) $data['code']))

            : $model->code;



        if ($code !== $model->code) {

            $exists = PlatformIntegration::withTrashed()

                ->where('category', $category)

                ->where('code', $code)

                ->where('id', '!=', $model->id)

                ->exists();

            if ($exists) {

                throw ValidationException::withMessages(['code' => ['Integration code already exists in this category.']]);

            }

        }



        $model->fill($this->normalize($data, $code, $category, $model));

        $model->updated_by = $actorId;

        $model->save();



        if ($model->is_default) {

            $this->clearDefaultExcept($category, $model->id);

        }



        return $this->show($category, $model->code);

    }



    public function delete(string $category, string $integration): void

    {

        $this->resolve($category, $integration)->delete();

    }



    /** @return array<string, mixed> */

    public function setDefault(string $category, string $integration, int $actorId): array

    {

        $model = $this->resolve($category, $integration);



        DB::transaction(function () use ($category, $model, $actorId) {

            $this->clearDefaultExcept($category, $model->id);

            $model->is_default = true;

            $model->updated_by = $actorId;

            $model->save();

        });



        return $this->show($category, $model->code);

    }



    /** @return array<string, mixed> */

    public function testConnection(string $category, string $integration, int $actorId): array

    {

        $model = $this->resolve($category, $integration);

        $config = $model->config_json ?? [];



        $hasCredentials = collect($config)->filter(function ($value, $key) {

            if (is_string($value) && trim($value) !== '') {

                return true;

            }

            if (is_array($value) && $value !== []) {

                return true;

            }



            return false;

        })->isNotEmpty();



        $model->status = $hasCredentials ? 'connected' : 'error';

        $model->last_tested_at = now();

        $model->updated_by = $actorId;

        $model->save();



        return [

            'success' => $hasCredentials,

            'status' => $model->status,

            'message' => $hasCredentials

                ? 'Connection test succeeded.'

                : 'Connection test failed: missing configuration.',

            'integration' => $this->serialize($model->fresh()),

            'tested_at' => optional($model->last_tested_at)?->toIso8601String(),

        ];

    }



    protected function ensureDefaults(string $category): void

    {

        foreach (self::DEFAULTS[$category] as $row) {

            PlatformIntegration::query()->firstOrCreate(

                ['category' => $category, 'code' => $row['code']],

                [

                    'name_en' => $row['name_en'],

                    'name_ar' => $row['name_ar'],

                    'provider' => $row['provider'],

                    'config_json' => [],

                    'is_active' => false,

                    'is_default' => false,

                    'status' => 'disconnected',

                ]

            );

        }

    }



    protected function resolve(string $category, string $integration): PlatformIntegration

    {

        $this->assertCategory($category);

        $this->ensureDefaults($category);



        $query = PlatformIntegration::query()->where('category', $category);



        if (ctype_digit($integration)) {

            return $query->where('id', (int) $integration)->firstOrFail();

        }



        return $query->where('code', strtolower($integration))->firstOrFail();

    }



    protected function clearDefaultExcept(string $category, int $keepId): void

    {

        PlatformIntegration::query()

            ->where('category', $category)

            ->where('id', '!=', $keepId)

            ->where('is_default', true)

            ->update(['is_default' => false]);

    }



    protected function assertCategory(string $category): void

    {

        if (! in_array($category, self::CATEGORIES, true)) {

            throw ValidationException::withMessages([

                'category' => ['Invalid integration category.'],

            ]);

        }

    }



    /**

     * @param  array<string, mixed>  $data

     * @return array<string, mixed>

     */

    protected function normalize(array $data, string $code, string $category, ?PlatformIntegration $existing = null): array

    {

        $config = $existing?->config_json ?? [];

        if (array_key_exists('config', $data) && is_array($data['config'])) {

            $config = $this->mergeConfig($config, $data['config']);

        }



        return [

            'code' => $code,

            'name_en' => trim((string) ($data['name_en'] ?? $existing?->name_en ?? ucfirst(str_replace('_', ' ', $code)))),

            'name_ar' => array_key_exists('name_ar', $data)

                ? (trim((string) $data['name_ar']) ?: null)

                : $existing?->name_ar,

            'provider' => trim((string) ($data['provider'] ?? $existing?->provider ?? $code)),

            'config_json' => $config,

            'is_active' => array_key_exists('is_active', $data)

                ? (bool) $data['is_active']

                : ($existing?->is_active ?? false),

            'is_default' => array_key_exists('is_default', $data)

                ? (bool) $data['is_default']

                : ($existing?->is_default ?? false),

            'status' => $data['status'] ?? $existing?->status ?? 'disconnected',

            'notes' => array_key_exists('notes', $data) ? $data['notes'] : $existing?->notes,

        ];

    }



    /** @param  array<string, mixed>  $existing

     *  @param  array<string, mixed>  $incoming

     *  @return array<string, mixed>

     */

    protected function mergeConfig(array $existing, array $incoming): array

    {

        foreach ($incoming as $key => $value) {

            if (is_string($value) && str_starts_with($value, '********')) {

                continue;

            }

            $existing[$key] = $value;

        }



        return $existing;

    }



    /** @return array<string, mixed> */

    protected function serialize(PlatformIntegration $integration): array

    {

        return [

            'id' => $integration->id,

            'category' => $integration->category,

            'code' => $integration->code,

            'name_en' => $integration->name_en,

            'name_ar' => $integration->name_ar,

            'provider' => $integration->provider,

            'config' => $this->maskSecrets($integration->config_json ?? []),

            'is_active' => (bool) $integration->is_active,

            'is_default' => (bool) $integration->is_default,

            'status' => $integration->status,

            'notes' => $integration->notes,

            'last_tested_at' => optional($integration->last_tested_at)?->toIso8601String(),

            'created_at' => optional($integration->created_at)?->toIso8601String(),

            'updated_at' => optional($integration->updated_at)?->toIso8601String(),

        ];

    }



    /** @param  array<string, mixed>  $config

     *  @return array<string, mixed>

     */

    protected function maskSecrets(array $config): array

    {

        $masked = [];

        foreach ($config as $key => $value) {

            if (is_array($value)) {

                $masked[$key] = $this->maskSecrets($value);



                continue;

            }

            if (is_string($value) && $this->isSecretKey((string) $key) && $value !== '') {

                $masked[$key] = str_repeat('*', min(8, max(4, strlen($value))));



                continue;

            }

            $masked[$key] = $value;

        }



        return $masked;

    }



    protected function isSecretKey(string $key): bool

    {

        $normalized = strtolower($key);

        foreach (self::SECRET_KEYS as $secret) {

            if ($normalized === $secret || str_contains($normalized, $secret)) {

                return true;

            }

        }



        return false;

    }

}


