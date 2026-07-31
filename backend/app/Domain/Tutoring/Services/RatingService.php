<?php

namespace App\Domain\Tutoring\Services;

use App\Domain\Tutoring\Models\TutoringSession;
use App\Domain\Tutoring\Models\TutoringSessionRating;
use App\Services\BaseService;
use App\Support\TenantContext;
use Illuminate\Validation\ValidationException;

class RatingService extends BaseService
{
    public function __construct(TenantContext $tenantContext)
    {
        parent::__construct($tenantContext);
    }

    public function rate(
        TutoringSession $session,
        int $studentId,
        int $rating,
        ?string $feedback = null,
        ?string $feedbackAr = null,
    ): TutoringSessionRating {
        if ($session->status !== 'completed') {
            throw ValidationException::withMessages(['session' => ['Only completed sessions can be rated.']]);
        }

        if ($rating < 1 || $rating > 5) {
            throw ValidationException::withMessages(['rating' => ['Rating must be 1–5.']]);
        }

        if (! $session->participants()->where('users.id', $studentId)->exists()) {
            throw ValidationException::withMessages(['student' => ['Only session participants can rate.']]);
        }

        return TutoringSessionRating::query()->updateOrCreate(
            [
                'tutoring_session_id' => $session->id,
                'student_user_id' => $studentId,
            ],
            [
                'tenant_id' => $session->tenant_id,
                'tutor_profile_id' => $session->tutor_profile_id,
                'rating' => $rating,
                'feedback' => $feedback,
                'feedback_ar' => $feedbackAr,
            ]
        );
    }
}
