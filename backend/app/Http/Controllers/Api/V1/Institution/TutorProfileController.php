<?php

namespace App\Http\Controllers\Api\V1\Institution;

use App\Domain\Academics\Services\SchoolContextService;
use App\Domain\Identity\Services\RbacService;
use App\Domain\Tutoring\Models\SessionNote;
use App\Domain\Tutoring\Models\TutorProfile;
use App\Domain\Tutoring\Models\TutoringSession;
use App\Domain\Tutoring\Models\TutoringSessionRating;
use App\Domain\Tutoring\Services\AttendanceService;
use App\Domain\Tutoring\Services\AvailabilityService;
use App\Domain\Tutoring\Services\BookingService;
use App\Domain\Tutoring\Services\TutorProfileService;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class TutorProfileController extends Controller
{
    public function __construct(
        protected SchoolContextService $schoolContext,
        protected TutorProfileService $profiles,
        protected RbacService $rbac,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'tutoring.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $items = TutorProfile::query()
            ->where('school_id', $school->id)
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->with(['user:id,email,first_name,last_name', 'subjects'])
            ->withAvg('ratings', 'rating')
            ->orderByDesc('id')
            ->paginate((int) $request->integer('per_page', 10));

        return response()->json($items);
    }

    public function store(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'tutoring.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $data = $request->validate([
            'user_id' => ['required', 'integer'],
            'bio_en' => ['nullable', 'string'],
            'bio_ar' => ['nullable', 'string'],
            'status' => ['nullable', 'in:active,inactive'],
            'subjects' => ['nullable', 'array'],
            'subjects.*.subject_id' => ['required_with:subjects', 'integer'],
            'subjects.*.languages' => ['nullable', 'array'],
            'subjects.*.languages.*' => ['string', 'max:10'],
        ]);

        $user = User::query()->where('tenant_id', $school->tenant_id)->findOrFail($data['user_id']);
        $profile = $this->profiles->create($school, $user, $data);

        return response()->json(['message' => 'Tutor profile created.', 'data' => $profile], 201);
    }

    public function show(Request $request, int $tutor): JsonResponse
    {
        $this->authorizeView($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $model = TutorProfile::query()
            ->where('school_id', $school->id)
            ->with(['user:id,email,first_name,last_name', 'subjects', 'availabilities'])
            ->withAvg('ratings', 'rating')
            ->findOrFail($tutor);

        return response()->json(['data' => $model]);
    }

    public function update(Request $request, int $tutor): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'tutoring.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = TutorProfile::query()->where('school_id', $school->id)->findOrFail($tutor);

        $data = $request->validate([
            'bio_en' => ['nullable', 'string'],
            'bio_ar' => ['nullable', 'string'],
            'status' => ['sometimes', 'in:active,inactive'],
            'subjects' => ['nullable', 'array'],
            'subjects.*.subject_id' => ['required_with:subjects', 'integer'],
            'subjects.*.languages' => ['nullable', 'array'],
        ]);

        $model->update(collect($data)->except('subjects')->all());
        if (array_key_exists('subjects', $data)) {
            $this->profiles->syncSubjects($model, $data['subjects'] ?? []);
        }

        return response()->json(['message' => 'Tutor profile updated.', 'data' => $model->fresh(['user', 'subjects'])]);
    }

    private function authorizeView(Request $request): void
    {
        $user = $request->user();
        if ($this->rbac->can($user, 'tutoring.manage')
            || $this->rbac->can($user, 'tutoring.book')
            || $this->rbac->can($user, 'tutoring.conduct')) {
            return;
        }
        $this->rbac->authorize($user, 'tutoring.manage');
    }
}
