<?php

namespace App\Http\Controllers\Api\V1\Institution;

use App\Domain\Academics\Models\ClassSection;
use App\Domain\Academics\Models\Grade;
use App\Domain\Academics\Models\SchoolClass;
use App\Domain\Academics\Services\SchoolContextService;
use App\Domain\Identity\Services\RbacService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClassSectionController extends Controller
{
    public function __construct(
        protected SchoolContextService $schoolContext,
        protected RbacService $rbac,
    ) {}

    public function grades(Request $request): JsonResponse
    {
        $this->authorizeManage($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        return response()->json(
            Grade::query()->where('school_id', $school->id)->orderBy('sequence')->get()
        );
    }

    public function storeGrade(Request $request): JsonResponse
    {
        $this->authorizeManage($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $data = $request->validate([
            'code' => ['required', 'string', 'max:32'],
            'name_en' => ['required', 'string', 'max:100'],
            'name_ar' => ['required', 'string', 'max:100'],
            'sequence' => ['required', 'integer', 'min:0'],
        ]);

        $grade = Grade::query()->create([
            ...$data,
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
        ]);

        return response()->json(['message' => 'Grade created.', 'data' => $grade], 201);
    }

    public function classes(Request $request): JsonResponse
    {
        $this->authorizeManage($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $items = SchoolClass::query()
            ->where('school_id', $school->id)
            ->with(['grade', 'campus', 'academicYear', 'sections'])
            ->when($request->academic_year_id, fn ($q, $id) => $q->where('academic_year_id', $id))
            ->when($request->grade_id, fn ($q, $id) => $q->where('grade_id', $id))
            ->orderBy('code')
            ->paginate((int) $request->integer('per_page', 10));

        return response()->json($items);
    }

    public function storeClass(Request $request): JsonResponse
    {
        $this->authorizeManage($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $data = $request->validate([
            'campus_id' => ['nullable', 'integer'],
            'academic_year_id' => ['required', 'integer'],
            'grade_id' => ['required', 'integer'],
            'code' => ['required', 'string', 'max:32'],
            'name_en' => ['required', 'string', 'max:100'],
            'name_ar' => ['required', 'string', 'max:100'],
            'status' => ['nullable', 'in:active,inactive'],
        ]);

        $class = SchoolClass::query()->create([
            ...$data,
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'status' => $data['status'] ?? 'active',
        ]);

        return response()->json(['message' => 'Class created.', 'data' => $class], 201);
    }

    public function updateClass(Request $request, int $class): JsonResponse
    {
        $this->authorizeManage($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = SchoolClass::query()->where('school_id', $school->id)->findOrFail($class);

        $data = $request->validate([
            'campus_id' => ['nullable', 'integer'],
            'code' => ['sometimes', 'string', 'max:32'],
            'name_en' => ['sometimes', 'string', 'max:100'],
            'name_ar' => ['sometimes', 'string', 'max:100'],
            'status' => ['sometimes', 'in:active,inactive'],
        ]);

        $model->update($data);

        return response()->json(['message' => 'Class updated.', 'data' => $model->fresh()]);
    }

    public function destroyClass(Request $request, int $class): JsonResponse
    {
        $this->authorizeManage($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        SchoolClass::query()->where('school_id', $school->id)->findOrFail($class)->delete();

        return response()->json(['message' => 'Class deleted.']);
    }

    public function sections(Request $request): JsonResponse
    {
        $this->authorizeManage($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $items = ClassSection::query()
            ->where('school_id', $school->id)
            ->with(['grade', 'campus', 'academicYear', 'schoolClass'])
            ->when($request->academic_year_id, fn ($q, $id) => $q->where('academic_year_id', $id))
            ->when($request->school_class_id, fn ($q, $id) => $q->where('school_class_id', $id))
            ->when($request->grade_id, fn ($q, $id) => $q->where('grade_id', $id))
            ->orderBy('name')
            ->paginate((int) $request->integer('per_page', 10));

        return response()->json($items);
    }

    public function storeSection(Request $request): JsonResponse
    {
        $this->authorizeManage($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $data = $request->validate([
            'campus_id' => ['nullable', 'integer'],
            'academic_year_id' => ['required', 'integer'],
            'grade_id' => ['required', 'integer'],
            'school_class_id' => ['nullable', 'integer'],
            'name' => ['required', 'string', 'max:64'],
            'section_code' => ['nullable', 'string', 'max:32'],
            'status' => ['nullable', 'in:active,inactive'],
        ]);

        if (! empty($data['school_class_id'])) {
            $class = SchoolClass::query()
                ->where('school_id', $school->id)
                ->findOrFail($data['school_class_id']);
            $data['academic_year_id'] = $class->academic_year_id;
            $data['grade_id'] = $class->grade_id;
            $data['campus_id'] = $data['campus_id'] ?? $class->campus_id;
        }

        $section = ClassSection::query()->create([
            ...$data,
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'status' => $data['status'] ?? 'active',
        ]);

        return response()->json(['message' => 'Section created.', 'data' => $section], 201);
    }

    public function updateSection(Request $request, int $section): JsonResponse
    {
        $this->authorizeManage($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = ClassSection::query()->where('school_id', $school->id)->findOrFail($section);

        $data = $request->validate([
            'campus_id' => ['nullable', 'integer'],
            'school_class_id' => ['nullable', 'integer'],
            'name' => ['sometimes', 'string', 'max:64'],
            'section_code' => ['nullable', 'string', 'max:32'],
            'status' => ['sometimes', 'in:active,inactive'],
        ]);

        $model->update($data);

        return response()->json(['message' => 'Section updated.', 'data' => $model->fresh()]);
    }

    public function destroySection(Request $request, int $section): JsonResponse
    {
        $this->authorizeManage($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        ClassSection::query()->where('school_id', $school->id)->findOrFail($section)->delete();

        return response()->json(['message' => 'Section deleted.']);
    }

    private function authorizeManage(Request $request): void
    {
        $this->rbac->authorize($request->user(), 'school.academics.manage');
    }
}
