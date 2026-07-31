<?php

namespace App\Http\Controllers\Api\V1\Institution;

use App\Domain\Academics\Services\SchoolContextService;
use App\Domain\Identity\Services\RbacService;
use App\Domain\Tutoring\Models\TutorProfile;
use App\Domain\Tutoring\Services\AvailabilityService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class TutorAvailabilityController extends Controller
{
    public function __construct(
        protected SchoolContextService $schoolContext,
        protected AvailabilityService $availability,
        protected RbacService $rbac,
    ) {}

    public function index(Request $request, int $tutor): JsonResponse
    {
        $this->authorizeAvailability($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $profile = TutorProfile::query()->where('school_id', $school->id)->findOrFail($tutor);

        return response()->json([
            'data' => [
                'weekly' => $profile->availabilities()->orderBy('weekday')->orderBy('start_time')->get(),
                'exceptions' => \App\Domain\Tutoring\Models\TutorAvailabilityException::query()
                    ->where('tutor_profile_id', $profile->id)
                    ->orderBy('exception_date')
                    ->get(),
            ],
        ]);
    }

    public function storeWeekly(Request $request, int $tutor): JsonResponse
    {
        $this->authorizeAvailability($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $profile = TutorProfile::query()->where('school_id', $school->id)->findOrFail($tutor);

        $data = $request->validate([
            'weekday' => ['required', 'integer', 'min:0', 'max:6'],
            'start_time' => ['required', 'date_format:H:i'],
            'end_time' => ['required', 'date_format:H:i'],
            'slot_minutes' => ['nullable', 'integer', 'min:15', 'max:240'],
            'timezone' => ['nullable', 'string', 'max:64'],
            'campus_id' => ['nullable', 'integer'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $row = $this->availability->addWeekly($profile, $data);

        return response()->json(['message' => 'Availability added.', 'data' => $row], 201);
    }

    public function storeException(Request $request, int $tutor): JsonResponse
    {
        $this->authorizeAvailability($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $profile = TutorProfile::query()->where('school_id', $school->id)->findOrFail($tutor);

        $data = $request->validate([
            'exception_date' => ['required', 'date'],
            'is_available' => ['required', 'boolean'],
            'start_time' => ['nullable', 'date_format:H:i'],
            'end_time' => ['nullable', 'date_format:H:i'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $row = $this->availability->addException($profile, $data);

        return response()->json(['message' => 'Exception saved.', 'data' => $row], 201);
    }

    public function openSlots(Request $request, int $tutor): JsonResponse
    {
        $user = $request->user();
        if (! ($this->rbac->can($user, 'tutoring.book')
            || $this->rbac->can($user, 'tutoring.manage')
            || $this->rbac->can($user, 'tutoring.conduct'))) {
            $this->rbac->authorize($user, 'tutoring.book');
        }

        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $profile = TutorProfile::query()->where('school_id', $school->id)->findOrFail($tutor);

        $data = $request->validate(['date' => ['required', 'date']]);
        $slots = $this->availability->openSlots($profile, Carbon::parse($data['date']));

        return response()->json(['data' => $slots]);
    }

    private function authorizeAvailability(Request $request): void
    {
        $user = $request->user();
        if ($this->rbac->can($user, 'tutoring.availability.manage') || $this->rbac->can($user, 'tutoring.manage')) {
            return;
        }
        $this->rbac->authorize($user, 'tutoring.availability.manage');
    }
}
