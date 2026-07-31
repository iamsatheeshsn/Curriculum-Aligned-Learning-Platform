<?php

namespace App\Domain\Tutoring\Services;

use App\Domain\Academics\Models\Subject;
use App\Domain\Organization\Models\School;
use App\Domain\Tutoring\Models\TutorProfile;
use App\Models\User;
use App\Services\BaseService;
use App\Support\TenantContext;
use Illuminate\Validation\ValidationException;

class TutorProfileService extends BaseService
{
    public function __construct(TenantContext $tenantContext)
    {
        parent::__construct($tenantContext);
    }

    public function create(School $school, User $user, array $data): TutorProfile
    {
        $profile = TutorProfile::query()->updateOrCreate(
            ['tenant_id' => $school->tenant_id, 'user_id' => $user->id],
            [
                'school_id' => $school->id,
                'bio_en' => $data['bio_en'] ?? null,
                'bio_ar' => $data['bio_ar'] ?? null,
                'status' => $data['status'] ?? 'active',
            ]
        );

        if (! empty($data['subjects'])) {
            $this->syncSubjects($profile, $data['subjects']);
        }

        return $profile->load(['user', 'subjects']);
    }

    /**
     * @param  list<array{subject_id:int, languages?:list<string>}>  $subjects
     */
    public function syncSubjects(TutorProfile $profile, array $subjects): void
    {
        $sync = [];
        foreach ($subjects as $row) {
            $subject = Subject::query()->where('school_id', $profile->school_id)->findOrFail($row['subject_id']);
            if (! $subject->tutoring_enabled) {
                throw ValidationException::withMessages([
                    'subjects' => ["Subject {$subject->code} is not tutoring-enabled."],
                ]);
            }
            $sync[$subject->id] = [
                'languages_json' => json_encode($row['languages'] ?? ['en', 'ar']),
            ];
        }
        $profile->subjects()->sync($sync);
    }
}
