<?php



namespace App\Domain\Platform\Services;



use App\Domain\Platform\Models\PlatformSetting;

use Illuminate\Support\Facades\DB;

use Illuminate\Support\Str;

use Illuminate\Validation\ValidationException;



class ControlPlatformSettingsService

{

    /** @var list<string> */

    public const GROUPS = ['global', 'branding', 'localization', 'security', 'backup'];



    /** @var array<string, array<string, mixed>> */

    protected const DEFAULTS = [

        'global' => [

            'platform_name' => 'Learning Platform',

            'support_email' => 'support@learning-platform.local',

            'default_currency' => 'SAR',

            'maintenance_mode' => false,

            'registration_enabled' => true,

        ],

        'branding' => [

            'logo_url' => null,

            'favicon_url' => null,

            'primary_color' => '#2563eb',

            'secondary_color' => '#0f172a',

            'control_portal_title' => 'Control Portal',

        ],

        'localization' => [

            'default_locale' => 'en',

            'supported_locales' => ['en', 'ar'],

            'default_timezone' => 'Asia/Riyadh',

            'date_format' => 'Y-m-d',

            'time_format' => 'H:i',

        ],

        'security' => [

            'session_lifetime_minutes' => 120,

            'password_min_length' => 8,

            'require_email_verification' => true,

            'max_login_attempts' => 5,

            'two_factor_enabled' => false,

        ],

        'backup' => [

            'auto_backup_enabled' => false,

            'backup_frequency' => 'daily',

            'retention_days' => 30,

            'last_backup_at' => null,

            'last_backup_status' => null,

        ],

    ];



    /** @return array<string, mixed> */

    public function getGroup(string $group): array

    {

        $this->assertGroup($group);



        $stored = PlatformSetting::query()

            ->where('group_key', $group)

            ->pluck('value_json', 'setting_key')

            ->map(fn ($value) => is_array($value) && array_key_exists('value', $value) ? $value['value'] : $value)

            ->all();



        $settings = array_merge(self::DEFAULTS[$group], $stored);



        return [

            'group' => $group,

            'settings' => $settings,

            'updated_at' => PlatformSetting::query()

                ->where('group_key', $group)

                ->max('updated_at'),

        ];

    }



    /** @param  array<string, mixed>  $settings

     *  @return array<string, mixed>

     */

    public function updateGroup(string $group, array $settings, int $actorId): array

    {

        $this->assertGroup($group);



        DB::transaction(function () use ($group, $settings, $actorId) {

            foreach ($settings as $key => $value) {

                PlatformSetting::query()->updateOrCreate(

                    ['group_key' => $group, 'setting_key' => (string) $key],

                    [

                        'value_json' => ['value' => $value],

                        'updated_by' => $actorId,

                    ]

                );

            }

        });



        return $this->getGroup($group);

    }



    /** @return array<string, mixed> */

    public function runBackup(int $actorId): array

    {

        $jobId = (string) Str::uuid();

        $startedAt = now();



        PlatformSetting::query()->updateOrCreate(

            ['group_key' => 'backup', 'setting_key' => 'last_backup_at'],

            ['value_json' => ['value' => $startedAt->toIso8601String()], 'updated_by' => $actorId]

        );

        PlatformSetting::query()->updateOrCreate(

            ['group_key' => 'backup', 'setting_key' => 'last_backup_status'],

            ['value_json' => ['value' => 'completed'], 'updated_by' => $actorId]

        );



        return [

            'job_id' => $jobId,

            'status' => 'completed',

            'message' => 'Backup completed successfully (simulated).',

            'started_at' => $startedAt->toIso8601String(),

            'completed_at' => now()->toIso8601String(),

            'artifacts' => [

                ['type' => 'database', 'size_bytes' => random_int(500_000, 2_000_000)],

                ['type' => 'storage', 'size_bytes' => random_int(1_000_000, 5_000_000)],

            ],

        ];

    }



    protected function assertGroup(string $group): void

    {

        if (! in_array($group, self::GROUPS, true)) {

            throw ValidationException::withMessages([

                'group' => ['Invalid settings group.'],

            ]);

        }

    }

}


