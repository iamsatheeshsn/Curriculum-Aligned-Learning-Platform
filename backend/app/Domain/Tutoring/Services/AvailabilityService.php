<?php

namespace App\Domain\Tutoring\Services;

use App\Domain\Tutoring\Models\TutorAvailability;
use App\Domain\Tutoring\Models\TutorAvailabilityException;
use App\Domain\Tutoring\Models\TutorProfile;
use App\Services\BaseService;
use App\Support\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class AvailabilityService extends BaseService
{
    public function __construct(TenantContext $tenantContext)
    {
        parent::__construct($tenantContext);
    }

    public function addWeekly(TutorProfile $profile, array $data): TutorAvailability
    {
        if ((int) $data['weekday'] < 0 || (int) $data['weekday'] > 6) {
            throw ValidationException::withMessages(['weekday' => ['Weekday must be 0 (Sun) to 6 (Sat).']]);
        }

        if ($data['start_time'] >= $data['end_time']) {
            throw ValidationException::withMessages(['end_time' => ['end_time must be after start_time.']]);
        }

        return TutorAvailability::query()->create([
            'tenant_id' => $profile->tenant_id,
            'tutor_profile_id' => $profile->id,
            'campus_id' => $data['campus_id'] ?? null,
            'weekday' => $data['weekday'],
            'start_time' => $data['start_time'],
            'end_time' => $data['end_time'],
            'slot_minutes' => $data['slot_minutes'] ?? 60,
            'timezone' => $data['timezone'] ?? 'Asia/Riyadh',
            'is_active' => $data['is_active'] ?? true,
        ]);
    }

    public function addException(TutorProfile $profile, array $data): TutorAvailabilityException
    {
        return TutorAvailabilityException::query()->create([
            'tutor_profile_id' => $profile->id,
            'exception_date' => $data['exception_date'],
            'is_available' => $data['is_available'],
            'start_time' => $data['start_time'] ?? null,
            'end_time' => $data['end_time'] ?? null,
            'reason' => $data['reason'] ?? null,
        ]);
    }

    /**
     * @return list<array{starts_at:string, ends_at:string}>
     */
    public function openSlots(TutorProfile $profile, Carbon $date): array
    {
        $exception = TutorAvailabilityException::query()
            ->where('tutor_profile_id', $profile->id)
            ->whereDate('exception_date', $date->toDateString())
            ->first();

        if ($exception && ! $exception->is_available) {
            return [];
        }

        $weekday = (int) $date->dayOfWeek;
        $rules = TutorAvailability::query()
            ->where('tutor_profile_id', $profile->id)
            ->where('weekday', $weekday)
            ->where('is_active', true)
            ->get();

        if ($exception && $exception->is_available && $exception->start_time && $exception->end_time) {
            $rules = collect([(object) [
                'start_time' => $exception->start_time,
                'end_time' => $exception->end_time,
                'slot_minutes' => $rules->first()->slot_minutes ?? 60,
                'timezone' => $rules->first()->timezone ?? 'Asia/Riyadh',
            ]]);
        }

        $slots = [];
        foreach ($rules as $rule) {
            $tz = $rule->timezone ?? 'Asia/Riyadh';
            $cursor = Carbon::parse($date->toDateString().' '.$rule->start_time, $tz);
            $end = Carbon::parse($date->toDateString().' '.$rule->end_time, $tz);
            $minutes = (int) ($rule->slot_minutes ?? 60);

            while ($cursor->copy()->addMinutes($minutes)->lte($end)) {
                $slotEnd = $cursor->copy()->addMinutes($minutes);
                $overlap = $profile->sessions()
                    ->whereNotIn('status', ['cancelled', 'no_show'])
                    ->where('starts_at', '<', $slotEnd->clone()->utc())
                    ->where('ends_at', '>', $cursor->clone()->utc())
                    ->exists();

                if (! $overlap) {
                    $slots[] = [
                        'starts_at' => $cursor->clone()->utc()->toIso8601String(),
                        'ends_at' => $slotEnd->clone()->utc()->toIso8601String(),
                    ];
                }
                $cursor->addMinutes($minutes);
            }
        }

        return $slots;
    }
}
