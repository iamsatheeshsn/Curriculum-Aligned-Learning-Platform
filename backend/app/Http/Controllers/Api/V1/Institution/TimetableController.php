<?php

namespace App\Http\Controllers\Api\V1\Institution;

use App\Domain\Academics\Models\ClassSection;
use App\Domain\Academics\Models\Timetable;
use App\Domain\Academics\Models\TimetableSlot;
use App\Domain\Academics\Services\SchoolContextService;
use App\Domain\Identity\Services\RbacService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TimetableController extends Controller
{
    public function __construct(
        protected SchoolContextService $schoolContext,
        protected RbacService $rbac,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorizeManage($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $items = Timetable::query()
            ->where('school_id', $school->id)
            ->with(['classSection', 'academicYear', 'term'])
            ->when($request->class_section_id, fn ($q, $id) => $q->where('class_section_id', $id))
            ->when($request->academic_year_id, fn ($q, $id) => $q->where('academic_year_id', $id))
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->orderByDesc('id')
            ->paginate((int) $request->integer('per_page', 10));

        return response()->json($items);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeManage($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $data = $request->validate([
            'campus_id' => ['nullable', 'integer'],
            'academic_year_id' => ['required', 'integer'],
            'term_id' => ['nullable', 'integer'],
            'class_section_id' => ['required', 'integer'],
            'name_en' => ['required', 'string', 'max:191'],
            'name_ar' => ['required', 'string', 'max:191'],
            'status' => ['nullable', 'in:draft,published,archived'],
            'effective_from' => ['nullable', 'date'],
            'effective_to' => ['nullable', 'date', 'after_or_equal:effective_from'],
            'slots' => ['nullable', 'array'],
            'slots.*.weekday' => ['required_with:slots', 'integer', 'between:0,6'],
            'slots.*.period_no' => ['nullable', 'integer', 'min:1'],
            'slots.*.start_time' => ['required_with:slots', 'date_format:H:i'],
            'slots.*.end_time' => ['required_with:slots', 'date_format:H:i', 'after:slots.*.start_time'],
            'slots.*.subject_id' => ['required_with:slots', 'integer'],
            'slots.*.teacher_user_id' => ['nullable', 'integer'],
            'slots.*.room' => ['nullable', 'string', 'max:64'],
            'slots.*.notes' => ['nullable', 'string', 'max:255'],
        ]);

        $section = ClassSection::query()
            ->where('school_id', $school->id)
            ->findOrFail($data['class_section_id']);

        $timetable = DB::transaction(function () use ($data, $school, $section) {
            $timetable = Timetable::query()->create([
                'tenant_id' => $school->tenant_id,
                'school_id' => $school->id,
                'campus_id' => $data['campus_id'] ?? $section->campus_id,
                'academic_year_id' => $data['academic_year_id'],
                'term_id' => $data['term_id'] ?? null,
                'class_section_id' => $section->id,
                'name_en' => $data['name_en'],
                'name_ar' => $data['name_ar'],
                'status' => $data['status'] ?? 'draft',
                'effective_from' => $data['effective_from'] ?? null,
                'effective_to' => $data['effective_to'] ?? null,
            ]);

            foreach ($data['slots'] ?? [] as $slot) {
                $this->assertNoOverlap($timetable->id, $slot);
                TimetableSlot::query()->create([
                    ...$slot,
                    'tenant_id' => $school->tenant_id,
                    'timetable_id' => $timetable->id,
                ]);
            }

            return $timetable->load('slots.subject');
        });

        return response()->json(['message' => 'Timetable created.', 'data' => $timetable], 201);
    }

    public function show(Request $request, int $timetable): JsonResponse
    {
        $this->authorizeManage($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = Timetable::query()
            ->where('school_id', $school->id)
            ->with(['slots.subject', 'slots.teacher', 'classSection'])
            ->findOrFail($timetable);

        return response()->json(['data' => $model]);
    }

    public function addSlot(Request $request, int $timetable): JsonResponse
    {
        $this->authorizeManage($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = Timetable::query()->where('school_id', $school->id)->findOrFail($timetable);

        $slot = $request->validate([
            'weekday' => ['required', 'integer', 'between:0,6'],
            'period_no' => ['nullable', 'integer', 'min:1'],
            'start_time' => ['required', 'date_format:H:i'],
            'end_time' => ['required', 'date_format:H:i', 'after:start_time'],
            'subject_id' => ['required', 'integer'],
            'teacher_user_id' => ['nullable', 'integer'],
            'room' => ['nullable', 'string', 'max:64'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $this->assertNoOverlap($model->id, $slot);

        $created = TimetableSlot::query()->create([
            ...$slot,
            'tenant_id' => $school->tenant_id,
            'timetable_id' => $model->id,
        ]);

        return response()->json(['message' => 'Slot added.', 'data' => $created->load('subject')], 201);
    }

    public function destroySlot(Request $request, int $timetable, int $slot): JsonResponse
    {
        $this->authorizeManage($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = Timetable::query()->where('school_id', $school->id)->findOrFail($timetable);
        TimetableSlot::query()->where('timetable_id', $model->id)->findOrFail($slot)->delete();

        return response()->json(['message' => 'Slot deleted.']);
    }

    public function publish(Request $request, int $timetable): JsonResponse
    {
        $this->authorizeManage($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = Timetable::query()->where('school_id', $school->id)->findOrFail($timetable);
        $model->update(['status' => 'published']);

        return response()->json(['message' => 'Timetable published.', 'data' => $model->fresh()]);
    }

    public function destroy(Request $request, int $timetable): JsonResponse
    {
        $this->authorizeManage($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        Timetable::query()->where('school_id', $school->id)->findOrFail($timetable)->delete();

        return response()->json(['message' => 'Timetable deleted.']);
    }

    /** @param array<string, mixed> $slot */
    private function assertNoOverlap(int $timetableId, array $slot): void
    {
        $overlap = TimetableSlot::query()
            ->where('timetable_id', $timetableId)
            ->where('weekday', $slot['weekday'])
            ->where('start_time', '<', $slot['end_time'])
            ->where('end_time', '>', $slot['start_time'])
            ->exists();

        if ($overlap) {
            throw ValidationException::withMessages([
                'slots' => ['Timetable slot overlaps an existing period.'],
            ]);
        }
    }

    private function authorizeManage(Request $request): void
    {
        $this->rbac->authorize($request->user(), 'school.academics.manage');
    }
}
