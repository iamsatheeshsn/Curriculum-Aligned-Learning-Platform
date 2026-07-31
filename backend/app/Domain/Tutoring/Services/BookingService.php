<?php

namespace App\Domain\Tutoring\Services;

use App\Domain\Organization\Models\School;
use App\Domain\Tutoring\Events\TutoringSessionBooked;
use App\Domain\Tutoring\Models\TutorProfile;
use App\Domain\Tutoring\Models\TutoringSession;
use App\Services\BaseService;
use App\Support\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class BookingService extends BaseService
{
    public function __construct(
        TenantContext $tenantContext,
        protected MeetingProviderService $meetings,
    ) {
        parent::__construct($tenantContext);
    }

    public function book(School $school, TutorProfile $tutor, array $data, int $bookedBy): TutoringSession
    {
        if ($tutor->status !== 'active') {
            throw ValidationException::withMessages(['tutor' => ['Tutor is not active.']]);
        }

        if (! $tutor->subjects()->where('subjects.id', $data['subject_id'])->exists()) {
            throw ValidationException::withMessages(['subject_id' => ['Tutor does not teach this subject.']]);
        }

        $starts = Carbon::parse($data['starts_at'])->utc();
        $ends = isset($data['ends_at'])
            ? Carbon::parse($data['ends_at'])->utc()
            : $starts->copy()->addMinutes((int) ($data['duration_minutes'] ?? 60));

        if ($ends->lte($starts)) {
            throw ValidationException::withMessages(['ends_at' => ['Session end must be after start.']]);
        }

        $overlap = TutoringSession::query()
            ->where('tutor_profile_id', $tutor->id)
            ->whereNotIn('status', ['cancelled', 'no_show'])
            ->where('starts_at', '<', $ends)
            ->where('ends_at', '>', $starts)
            ->exists();

        if ($overlap) {
            throw ValidationException::withMessages(['starts_at' => ['Tutor already has a session in this window.']]);
        }

        return $this->transaction(function () use ($school, $tutor, $data, $bookedBy, $starts, $ends) {
            $meeting = $this->meetings->provision(new TutoringSession);

            $session = TutoringSession::query()->create([
                'tenant_id' => $school->tenant_id,
                'school_id' => $school->id,
                'campus_id' => $data['campus_id'] ?? null,
                'tutor_profile_id' => $tutor->id,
                'subject_id' => $data['subject_id'],
                'language' => $data['language'],
                'session_type' => $data['session_type'] ?? 'one_to_one',
                'starts_at' => $starts,
                'ends_at' => $ends,
                'status' => 'scheduled',
                'meeting_provider' => $meeting['provider'],
                'meeting_url' => $meeting['join_url'],
                'meeting_external_id' => $meeting['external_id'],
                'booked_by' => $bookedBy,
            ]);

            $studentIds = $data['student_user_ids'] ?? [];
            if (! empty($data['student_user_id'])) {
                $studentIds[] = $data['student_user_id'];
            }
            $studentIds = array_values(array_unique(array_map('intval', $studentIds)));
            if ($studentIds === []) {
                throw ValidationException::withMessages(['student_user_id' => ['At least one student is required.']]);
            }

            $attach = [];
            foreach ($studentIds as $sid) {
                $attach[$sid] = ['role' => 'learner'];
            }
            $session->participants()->attach($attach);

            event(new TutoringSessionBooked(
                $session->id,
                (int) $school->tenant_id,
                (int) $school->id,
                $bookedBy,
            ));

            return $session->load(['tutor.user', 'subject', 'participants']);
        });
    }

    public function cancel(TutoringSession $session, ?string $reason = null): TutoringSession
    {
        if (in_array($session->status, ['completed', 'cancelled'], true)) {
            throw ValidationException::withMessages(['status' => ['Session cannot be cancelled.']]);
        }

        $session->forceFill([
            'status' => 'cancelled',
            'cancelled_at' => now(),
            'cancel_reason' => $reason,
        ])->save();

        return $session->fresh();
    }

    public function complete(TutoringSession $session): TutoringSession
    {
        $minutes = max(1, (int) $session->starts_at->diffInMinutes($session->ends_at));
        $session->forceFill([
            'status' => 'completed',
            'minutes_consumed' => $minutes,
        ])->save();

        return $session->fresh();
    }
}
