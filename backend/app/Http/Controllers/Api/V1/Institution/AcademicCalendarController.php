<?php

namespace App\Http\Controllers\Api\V1\Institution;

use App\Domain\Academics\Models\AcademicYear;
use App\Domain\Academics\Models\CalendarEvent;
use App\Domain\Academics\Models\Term;
use App\Domain\Academics\Services\SchoolContextService;
use App\Domain\Identity\Services\RbacService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class AcademicCalendarController extends Controller
{
    public function __construct(
        protected SchoolContextService $schoolContext,
        protected RbacService $rbac,
    ) {}

    public function years(Request $request): JsonResponse
    {
        $this->authorizeAcademics($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        return response()->json(
            AcademicYear::query()
                ->where('school_id', $school->id)
                ->with('terms')
                ->orderByDesc('starts_on')
                ->paginate((int) $request->integer('per_page', 10))
        );
    }

    public function storeYear(Request $request): JsonResponse
    {
        $this->authorizeAcademics($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'starts_on' => ['required', 'date'],
            'ends_on' => ['required', 'date', 'after:starts_on'],
            'status' => ['nullable', 'in:planned,active,archived'],
            'is_current' => ['nullable', 'boolean'],
            'terms' => ['nullable', 'array'],
            'terms.*.name_en' => ['required_with:terms', 'string', 'max:100'],
            'terms.*.name_ar' => ['required_with:terms', 'string', 'max:100'],
            'terms.*.sequence' => ['nullable', 'integer', 'min:1'],
            'terms.*.starts_on' => ['required_with:terms', 'date'],
            'terms.*.ends_on' => ['required_with:terms', 'date', 'after:terms.*.starts_on'],
        ]);

        $year = AcademicYear::query()->create([
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'name' => $data['name'],
            'starts_on' => $data['starts_on'],
            'ends_on' => $data['ends_on'],
            'status' => $data['status'] ?? 'planned',
            'is_current' => false,
        ]);

        foreach ($data['terms'] ?? [] as $term) {
            if ($term['starts_on'] < $data['starts_on'] || $term['ends_on'] > $data['ends_on']) {
                throw ValidationException::withMessages([
                    'terms' => ['Term dates must fall within the academic year.'],
                ]);
            }
            Term::query()->create([
                'tenant_id' => $school->tenant_id,
                'academic_year_id' => $year->id,
                'name_en' => $term['name_en'],
                'name_ar' => $term['name_ar'],
                'sequence' => $term['sequence'] ?? 1,
                'starts_on' => $term['starts_on'],
                'ends_on' => $term['ends_on'],
                'status' => 'upcoming',
            ]);
        }

        if (! empty($data['is_current'])) {
            $this->schoolContext->setCurrentYear($school, $year);
        }

        return response()->json(['message' => 'Academic year created.', 'data' => $year->fresh('terms')], 201);
    }

    public function setCurrentYear(Request $request, int $year): JsonResponse
    {
        $this->authorizeAcademics($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = AcademicYear::query()->where('school_id', $school->id)->findOrFail($year);
        $this->schoolContext->setCurrentYear($school, $model);

        return response()->json(['message' => 'Current academic year updated.', 'data' => $model->fresh()]);
    }

    public function storeTerm(Request $request, int $year): JsonResponse
    {
        $this->authorizeAcademics($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $academicYear = AcademicYear::query()->where('school_id', $school->id)->findOrFail($year);

        $data = $request->validate([
            'name_en' => ['required', 'string', 'max:100'],
            'name_ar' => ['required', 'string', 'max:100'],
            'sequence' => ['nullable', 'integer', 'min:1'],
            'starts_on' => ['required', 'date'],
            'ends_on' => ['required', 'date', 'after:starts_on'],
            'status' => ['nullable', 'in:upcoming,active,closed'],
        ]);

        if ($data['starts_on'] < $academicYear->starts_on->toDateString()
            || $data['ends_on'] > $academicYear->ends_on->toDateString()) {
            throw ValidationException::withMessages([
                'starts_on' => ['Term dates must fall within the academic year.'],
            ]);
        }

        $term = Term::query()->create([
            ...$data,
            'tenant_id' => $school->tenant_id,
            'academic_year_id' => $academicYear->id,
            'sequence' => $data['sequence'] ?? 1,
            'status' => $data['status'] ?? 'upcoming',
        ]);

        return response()->json(['message' => 'Term created.', 'data' => $term], 201);
    }

    public function events(Request $request): JsonResponse
    {
        $this->authorizeAcademics($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $query = CalendarEvent::query()
            ->where('school_id', $school->id)
            ->when($request->academic_year_id, fn ($q, $id) => $q->where('academic_year_id', $id))
            ->when($request->event_type, fn ($q, $t) => $q->where('event_type', $t))
            ->when($request->from, fn ($q, $d) => $q->where('ends_on', '>=', $d))
            ->when($request->to, fn ($q, $d) => $q->where('starts_on', '<=', $d))
            ->orderBy('starts_on');

        return response()->json($query->paginate((int) $request->integer('per_page', 10)));
    }

    public function storeEvent(Request $request): JsonResponse
    {
        $this->authorizeAcademics($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $data = $request->validate([
            'campus_id' => ['nullable', 'integer'],
            'academic_year_id' => ['nullable', 'integer'],
            'term_id' => ['nullable', 'integer'],
            'title_en' => ['required', 'string', 'max:255'],
            'title_ar' => ['required', 'string', 'max:255'],
            'event_type' => ['nullable', 'in:general,holiday,exam,break,pd,other'],
            'starts_on' => ['required', 'date'],
            'ends_on' => ['required', 'date', 'after_or_equal:starts_on'],
            'is_all_day' => ['nullable', 'boolean'],
            'description_en' => ['nullable', 'string'],
            'description_ar' => ['nullable', 'string'],
            'status' => ['nullable', 'in:draft,published,cancelled'],
        ]);

        $event = CalendarEvent::query()->create([
            ...$data,
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'event_type' => $data['event_type'] ?? 'general',
            'is_all_day' => $data['is_all_day'] ?? true,
            'status' => $data['status'] ?? 'published',
        ]);

        return response()->json(['message' => 'Calendar event created.', 'data' => $event], 201);
    }

    public function updateEvent(Request $request, int $event): JsonResponse
    {
        $this->authorizeAcademics($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = CalendarEvent::query()->where('school_id', $school->id)->findOrFail($event);

        $data = $request->validate([
            'title_en' => ['sometimes', 'string', 'max:255'],
            'title_ar' => ['sometimes', 'string', 'max:255'],
            'event_type' => ['sometimes', 'in:general,holiday,exam,break,pd,other'],
            'starts_on' => ['sometimes', 'date'],
            'ends_on' => ['sometimes', 'date'],
            'is_all_day' => ['nullable', 'boolean'],
            'description_en' => ['nullable', 'string'],
            'description_ar' => ['nullable', 'string'],
            'status' => ['sometimes', 'in:draft,published,cancelled'],
            'campus_id' => ['nullable', 'integer'],
            'term_id' => ['nullable', 'integer'],
        ]);

        $model->update($data);

        return response()->json(['message' => 'Calendar event updated.', 'data' => $model->fresh()]);
    }

    public function destroyEvent(Request $request, int $event): JsonResponse
    {
        $this->authorizeAcademics($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        CalendarEvent::query()->where('school_id', $school->id)->findOrFail($event)->delete();

        return response()->json(['message' => 'Calendar event deleted.']);
    }

    private function authorizeAcademics(Request $request): void
    {
        $this->rbac->authorize($request->user(), 'school.academics.manage');
    }
}
