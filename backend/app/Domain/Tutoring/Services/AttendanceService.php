<?php

namespace App\Domain\Tutoring\Services;

use App\Domain\Tutoring\Models\TutoringAttendance;
use App\Domain\Tutoring\Models\TutoringSession;
use App\Services\BaseService;
use App\Support\TenantContext;
use Illuminate\Validation\ValidationException;

class AttendanceService extends BaseService
{
    public function __construct(TenantContext $tenantContext)
    {
        parent::__construct($tenantContext);
    }

    public function mark(
        TutoringSession $session,
        int $studentId,
        string $status,
        int $markedBy,
        ?string $notes = null,
    ): TutoringAttendance {
        $allowed = ['present', 'absent', 'late', 'excused'];
        if (! in_array($status, $allowed, true)) {
            throw ValidationException::withMessages(['status' => ['Invalid attendance status.']]);
        }

        if (! $session->participants()->where('users.id', $studentId)->exists()) {
            throw ValidationException::withMessages(['student_user_id' => ['Student is not a participant.']]);
        }

        return TutoringAttendance::query()->updateOrCreate(
            [
                'tutoring_session_id' => $session->id,
                'student_user_id' => $studentId,
            ],
            [
                'tenant_id' => $session->tenant_id,
                'status' => $status,
                'marked_by' => $markedBy,
                'marked_at' => now(),
                'notes' => $notes,
            ]
        );
    }
}
