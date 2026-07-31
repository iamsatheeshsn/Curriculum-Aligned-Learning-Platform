<?php

namespace App\Http\Controllers\Api\V1\Control;

use App\Domain\Academics\Services\ControlSchoolOpsService;
use App\Domain\Identity\Services\RbacService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SchoolOpsController extends Controller
{
    public function __construct(
        protected ControlSchoolOpsService $ops,
        protected RbacService $rbac,
    ) {}

    public function getSchool(Request $request): JsonResponse
    {
        $this->guard();

        return response()->json([
            'data' => $this->ops->getSchoolProfile($request->integer('school_id') ?: null),
        ]);
    }

    public function updateSchool(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'school_id' => ['nullable', 'integer'],
            'code' => ['sometimes', 'string', 'max:64'],
            'name_en' => ['sometimes', 'string', 'max:191'],
            'name_ar' => ['sometimes', 'string', 'max:191'],
            'timezone' => ['nullable', 'string', 'max:64'],
            'status' => ['sometimes', 'in:active,inactive'],
        ]);

        return response()->json([
            'message' => 'School profile updated.',
            'data' => $this->ops->updateSchoolProfile(
                collect($data)->except('school_id')->all(),
                $request->integer('school_id') ?: null,
                (int) $request->user()->id,
            ),
        ]);
    }

    public function listCampuses(Request $request): JsonResponse
    {
        $this->guard();
        $schoolId = $request->integer('school_id') ?: null;

        return response()->json([
            'data' => $this->ops->listCampuses($request->only(['search', 'status']), $schoolId),
            'meta' => ['stats' => $this->ops->campusStats($schoolId)],
        ]);
    }

    public function createCampus(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'school_id' => ['nullable', 'integer'],
            'code' => ['nullable', 'string', 'max:64'],
            'name_en' => ['required', 'string', 'max:191'],
            'name_ar' => ['nullable', 'string', 'max:191'],
            'timezone' => ['nullable', 'string', 'max:64'],
            'address' => ['nullable', 'string', 'max:500'],
            'status' => ['nullable', 'in:active,inactive'],
        ]);

        return response()->json([
            'message' => 'Campus created.',
            'data' => $this->ops->createCampus($data, $request->integer('school_id') ?: null),
        ], 201);
    }

    public function updateCampus(Request $request, int $campus): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'school_id' => ['nullable', 'integer'],
            'code' => ['nullable', 'string', 'max:64'],
            'name_en' => ['sometimes', 'required', 'string', 'max:191'],
            'name_ar' => ['nullable', 'string', 'max:191'],
            'timezone' => ['nullable', 'string', 'max:64'],
            'address' => ['nullable', 'string', 'max:500'],
            'status' => ['nullable', 'in:active,inactive'],
        ]);

        return response()->json([
            'message' => 'Campus updated.',
            'data' => $this->ops->updateCampus($campus, $data, $request->integer('school_id') ?: null),
        ]);
    }

    public function deleteCampus(Request $request, int $campus): JsonResponse
    {
        $this->guard();
        $this->ops->deleteCampus($campus, $request->integer('school_id') ?: null);

        return response()->json(['message' => 'Campus deleted.']);
    }

    public function listAcademicYears(Request $request): JsonResponse
    {
        $this->guard();
        $schoolId = $request->integer('school_id') ?: null;

        return response()->json([
            'data' => $this->ops->listAcademicYears($request->only(['status']), $schoolId),
            'meta' => ['stats' => $this->ops->academicYearStats($schoolId)],
        ]);
    }

    public function createAcademicYear(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'school_id' => ['nullable', 'integer'],
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
            'terms.*.ends_on' => ['required_with:terms', 'date'],
        ]);

        return response()->json([
            'message' => 'Academic year created.',
            'data' => $this->ops->createAcademicYear(
                collect($data)->except('school_id')->all(),
                $request->integer('school_id') ?: null,
                (int) $request->user()->id,
            ),
        ], 201);
    }

    public function setCurrentAcademicYear(Request $request, int $year): JsonResponse
    {
        $this->guard();

        return response()->json([
            'message' => 'Current academic year updated.',
            'data' => $this->ops->setCurrentAcademicYear($year, $request->integer('school_id') ?: null),
        ]);
    }

    public function listTerms(Request $request): JsonResponse
    {
        $this->guard();
        $schoolId = $request->integer('school_id') ?: null;

        return response()->json([
            'data' => $this->ops->listTerms($request->only(['academic_year_id', 'status']), $schoolId),
            'meta' => ['stats' => $this->ops->termStats($schoolId)],
        ]);
    }

    public function createTerm(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'school_id' => ['nullable', 'integer'],
            'academic_year_id' => ['required', 'integer'],
            'name_en' => ['required', 'string', 'max:100'],
            'name_ar' => ['required', 'string', 'max:100'],
            'sequence' => ['nullable', 'integer', 'min:1'],
            'starts_on' => ['required', 'date'],
            'ends_on' => ['required', 'date', 'after:starts_on'],
            'status' => ['nullable', 'in:upcoming,active,closed'],
        ]);

        return response()->json([
            'message' => 'Term created.',
            'data' => $this->ops->createTerm(
                collect($data)->except('school_id')->all(),
                $request->integer('school_id') ?: null,
                (int) $request->user()->id,
            ),
        ], 201);
    }

    public function updateTerm(Request $request, int $term): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'school_id' => ['nullable', 'integer'],
            'name_en' => ['sometimes', 'string', 'max:100'],
            'name_ar' => ['sometimes', 'string', 'max:100'],
            'sequence' => ['nullable', 'integer', 'min:1'],
            'starts_on' => ['sometimes', 'date'],
            'ends_on' => ['sometimes', 'date'],
            'status' => ['sometimes', 'in:upcoming,active,closed'],
        ]);

        return response()->json([
            'message' => 'Term updated.',
            'data' => $this->ops->updateTerm(
                $term,
                collect($data)->except('school_id')->all(),
                $request->integer('school_id') ?: null,
                (int) $request->user()->id,
            ),
        ]);
    }

    public function listSubjects(Request $request): JsonResponse
    {
        $this->guard();
        $schoolId = $request->integer('school_id') ?: null;

        return response()->json([
            'data' => $this->ops->listSubjects($request->only(['status', 'search']), $schoolId),
            'meta' => ['stats' => $this->ops->subjectStats($schoolId)],
        ]);
    }

    public function createSubject(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'school_id' => ['nullable', 'integer'],
            'code' => ['required', 'string', 'max:64'],
            'name_en' => ['required', 'string', 'max:191'],
            'name_ar' => ['required', 'string', 'max:191'],
            'is_stem' => ['nullable', 'boolean'],
            'tutoring_enabled' => ['nullable', 'boolean'],
            'status' => ['nullable', 'in:active,archived'],
            'curriculum_id' => ['nullable', 'integer'],
        ]);

        return response()->json([
            'message' => 'Subject created.',
            'data' => $this->ops->createSubject(
                collect($data)->except('school_id')->all(),
                $request->integer('school_id') ?: null,
                (int) $request->user()->id,
            ),
        ], 201);
    }

    public function updateSubject(Request $request, int $subject): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'school_id' => ['nullable', 'integer'],
            'code' => ['sometimes', 'string', 'max:64'],
            'name_en' => ['sometimes', 'string', 'max:191'],
            'name_ar' => ['sometimes', 'string', 'max:191'],
            'is_stem' => ['nullable', 'boolean'],
            'tutoring_enabled' => ['nullable', 'boolean'],
            'status' => ['sometimes', 'in:active,archived'],
        ]);

        return response()->json([
            'message' => 'Subject updated.',
            'data' => $this->ops->updateSubject(
                $subject,
                collect($data)->except('school_id')->all(),
                $request->integer('school_id') ?: null,
                (int) $request->user()->id,
            ),
        ]);
    }

    public function deleteSubject(Request $request, int $subject): JsonResponse
    {
        $this->guard();
        $this->ops->deleteSubject($subject, $request->integer('school_id') ?: null);

        return response()->json(['message' => 'Subject deleted.']);
    }

    public function listGrades(Request $request): JsonResponse
    {
        $this->guard();
        $schoolId = $request->integer('school_id') ?: null;

        return response()->json([
            'data' => $this->ops->listGrades([], $schoolId),
            'meta' => ['stats' => $this->ops->gradeStats($schoolId)],
        ]);
    }

    public function createGrade(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'school_id' => ['nullable', 'integer'],
            'code' => ['required', 'string', 'max:32'],
            'name_en' => ['required', 'string', 'max:100'],
            'name_ar' => ['required', 'string', 'max:100'],
            'sequence' => ['required', 'integer', 'min:0'],
        ]);

        return response()->json([
            'message' => 'Grade created.',
            'data' => $this->ops->createGrade(
                collect($data)->except('school_id')->all(),
                $request->integer('school_id') ?: null,
                (int) $request->user()->id,
            ),
        ], 201);
    }

    public function updateGrade(Request $request, int $grade): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'school_id' => ['nullable', 'integer'],
            'code' => ['sometimes', 'string', 'max:32'],
            'name_en' => ['sometimes', 'string', 'max:100'],
            'name_ar' => ['sometimes', 'string', 'max:100'],
            'sequence' => ['sometimes', 'integer', 'min:0'],
        ]);

        return response()->json([
            'message' => 'Grade updated.',
            'data' => $this->ops->updateGrade(
                $grade,
                collect($data)->except('school_id')->all(),
                $request->integer('school_id') ?: null,
                (int) $request->user()->id,
            ),
        ]);
    }

    public function deleteGrade(Request $request, int $grade): JsonResponse
    {
        $this->guard();
        $this->ops->deleteGrade($grade, $request->integer('school_id') ?: null);

        return response()->json(['message' => 'Grade deleted.']);
    }

    public function listClasses(Request $request): JsonResponse
    {
        $this->guard();
        $schoolId = $request->integer('school_id') ?: null;

        return response()->json([
            'data' => $this->ops->listClasses($request->only(['academic_year_id', 'grade_id']), $schoolId),
            'meta' => ['stats' => $this->ops->classStats($schoolId)],
        ]);
    }

    public function createClass(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'school_id' => ['nullable', 'integer'],
            'campus_id' => ['nullable', 'integer'],
            'academic_year_id' => ['required', 'integer'],
            'grade_id' => ['required', 'integer'],
            'code' => ['required', 'string', 'max:32'],
            'name_en' => ['required', 'string', 'max:100'],
            'name_ar' => ['required', 'string', 'max:100'],
            'status' => ['nullable', 'in:active,inactive'],
        ]);

        return response()->json([
            'message' => 'Class created.',
            'data' => $this->ops->createClass(
                collect($data)->except('school_id')->all(),
                $request->integer('school_id') ?: null,
                (int) $request->user()->id,
            ),
        ], 201);
    }

    public function updateClass(Request $request, int $class): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'school_id' => ['nullable', 'integer'],
            'campus_id' => ['nullable', 'integer'],
            'code' => ['sometimes', 'string', 'max:32'],
            'name_en' => ['sometimes', 'string', 'max:100'],
            'name_ar' => ['sometimes', 'string', 'max:100'],
            'status' => ['sometimes', 'in:active,inactive'],
        ]);

        return response()->json([
            'message' => 'Class updated.',
            'data' => $this->ops->updateClass(
                $class,
                collect($data)->except('school_id')->all(),
                $request->integer('school_id') ?: null,
                (int) $request->user()->id,
            ),
        ]);
    }

    public function deleteClass(Request $request, int $class): JsonResponse
    {
        $this->guard();
        $this->ops->deleteClass($class, $request->integer('school_id') ?: null);

        return response()->json(['message' => 'Class deleted.']);
    }

    public function listSections(Request $request): JsonResponse
    {
        $this->guard();
        $schoolId = $request->integer('school_id') ?: null;

        return response()->json([
            'data' => $this->ops->listSections($request->only(['academic_year_id', 'school_class_id']), $schoolId),
            'meta' => ['stats' => $this->ops->sectionStats($schoolId)],
        ]);
    }

    public function createSection(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'school_id' => ['nullable', 'integer'],
            'campus_id' => ['nullable', 'integer'],
            'academic_year_id' => ['required', 'integer'],
            'grade_id' => ['required', 'integer'],
            'school_class_id' => ['nullable', 'integer'],
            'name' => ['required', 'string', 'max:64'],
            'section_code' => ['nullable', 'string', 'max:32'],
            'status' => ['nullable', 'in:active,inactive'],
        ]);

        return response()->json([
            'message' => 'Section created.',
            'data' => $this->ops->createSection(
                collect($data)->except('school_id')->all(),
                $request->integer('school_id') ?: null,
                (int) $request->user()->id,
            ),
        ], 201);
    }

    public function updateSection(Request $request, int $section): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'school_id' => ['nullable', 'integer'],
            'campus_id' => ['nullable', 'integer'],
            'school_class_id' => ['nullable', 'integer'],
            'name' => ['sometimes', 'string', 'max:64'],
            'section_code' => ['nullable', 'string', 'max:32'],
            'status' => ['sometimes', 'in:active,inactive'],
        ]);

        return response()->json([
            'message' => 'Section updated.',
            'data' => $this->ops->updateSection(
                $section,
                collect($data)->except('school_id')->all(),
                $request->integer('school_id') ?: null,
                (int) $request->user()->id,
            ),
        ]);
    }

    public function deleteSection(Request $request, int $section): JsonResponse
    {
        $this->guard();
        $this->ops->deleteSection($section, $request->integer('school_id') ?: null);

        return response()->json(['message' => 'Section deleted.']);
    }

    public function listStudents(Request $request): JsonResponse
    {
        $this->guard();
        $schoolId = $request->integer('school_id') ?: null;

        return response()->json([
            'data' => $this->ops->listStudents($request->only(['status', 'include_role_only']), $schoolId),
            'meta' => ['stats' => $this->ops->studentStats($schoolId)],
        ]);
    }

    public function showStudent(Request $request, int $student): JsonResponse
    {
        $this->guard();

        return response()->json([
            'data' => $this->ops->showStudent($student, $request->integer('school_id') ?: null),
        ]);
    }

    public function createStudent(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'school_id' => ['nullable', 'integer'],
            'student_user_id' => ['nullable', 'integer'],
            'email' => ['nullable', 'email', 'max:191'],
            'password' => ['required_without:student_user_id', 'nullable', 'string', 'min:8'],
            'first_name' => ['nullable', 'string', 'max:100'],
            'last_name' => ['nullable', 'string', 'max:100'],
            'academic_year_id' => ['required', 'integer'],
            'class_section_id' => ['required', 'integer'],
            'grade_id' => ['required', 'integer'],
            'status' => ['nullable', 'in:active,pending'],
            'enrolled_on' => ['nullable', 'date'],
        ]);

        return response()->json([
            'message' => 'Student enrollment created.',
            'data' => $this->ops->createStudent(
                collect($data)->except('school_id')->all(),
                $request->integer('school_id') ?: null,
                (int) $request->user()->id,
            ),
        ], 201);
    }

    public function updateStudent(Request $request, int $student): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'school_id' => ['nullable', 'integer'],
            'first_name' => ['sometimes', 'string', 'max:100'],
            'last_name' => ['sometimes', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:32'],
            'status' => ['sometimes', 'in:active,inactive,suspended'],
            'enrollment' => ['nullable', 'array'],
            'enrollment.class_section_id' => ['nullable', 'integer'],
            'enrollment.grade_id' => ['nullable', 'integer'],
            'enrollment.academic_year_id' => ['nullable', 'integer'],
            'enrollment.status' => ['nullable', 'string', 'max:32'],
            'enrollment.enrolled_on' => ['nullable', 'date'],
        ]);

        return response()->json([
            'message' => 'Student updated.',
            'data' => $this->ops->updateStudent(
                $student,
                collect($data)->except('school_id')->all(),
                $request->integer('school_id') ?: null,
                (int) $request->user()->id,
            ),
        ]);
    }

    public function listAdmissions(Request $request): JsonResponse
    {
        $this->guard();
        $schoolId = $request->integer('school_id') ?: null;

        return response()->json([
            'data' => $this->ops->listAdmissions($schoolId),
            'meta' => ['stats' => $this->ops->studentStats($schoolId)],
        ]);
    }

    public function acceptAdmission(Request $request, int $admission): JsonResponse
    {
        $this->guard();

        return response()->json([
            'message' => 'Admission accepted.',
            'data' => $this->ops->acceptAdmission(
                $admission,
                $request->integer('school_id') ?: null,
                (int) $request->user()->id,
            ),
        ]);
    }

    public function rejectAdmission(Request $request, int $admission): JsonResponse
    {
        $this->guard();

        return response()->json([
            'message' => 'Admission rejected.',
            'data' => $this->ops->rejectAdmission(
                $admission,
                $request->integer('school_id') ?: null,
                (int) $request->user()->id,
            ),
        ]);
    }

    public function listTransfers(Request $request): JsonResponse
    {
        $this->guard();
        $schoolId = $request->integer('school_id') ?: null;

        return response()->json([
            'data' => $this->ops->listTransfers($schoolId),
            'meta' => ['stats' => $this->ops->studentStats($schoolId)],
        ]);
    }

    public function createTransfer(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'school_id' => ['nullable', 'integer'],
            'student_user_id' => ['required', 'integer'],
            'class_section_id' => ['nullable', 'integer'],
            'grade_id' => ['nullable', 'integer'],
            'academic_year_id' => ['nullable', 'integer'],
        ]);

        return response()->json([
            'message' => 'Transfer recorded.',
            'data' => $this->ops->createTransfer(
                collect($data)->except('school_id')->all(),
                $request->integer('school_id') ?: null,
                (int) $request->user()->id,
            ),
        ], 201);
    }

    public function listAlumni(Request $request): JsonResponse
    {
        $this->guard();
        $schoolId = $request->integer('school_id') ?: null;

        return response()->json([
            'data' => $this->ops->listAlumni($schoolId),
            'meta' => ['stats' => $this->ops->studentStats($schoolId)],
        ]);
    }

    public function listParents(Request $request): JsonResponse
    {
        $this->guard();
        $schoolId = $request->integer('school_id') ?: null;

        return response()->json([
            'data' => $this->ops->listParents($request->only(['relationship']), $schoolId),
            'meta' => ['stats' => $this->ops->parentStats($schoolId)],
        ]);
    }

    public function createParent(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'school_id' => ['nullable', 'integer'],
            'parent_user_id' => ['nullable', 'integer'],
            'email' => ['nullable', 'email', 'max:191'],
            'password' => ['required_without:parent_user_id', 'nullable', 'string', 'min:8'],
            'first_name' => ['nullable', 'string', 'max:100'],
            'last_name' => ['nullable', 'string', 'max:100'],
            'student_user_id' => ['nullable', 'integer'],
            'relationship' => ['nullable', 'string', 'max:32'],
            'is_primary' => ['nullable', 'boolean'],
        ]);

        return response()->json([
            'message' => 'Parent created.',
            'data' => $this->ops->createParent(
                collect($data)->except('school_id')->all(),
                $request->integer('school_id') ?: null,
                (int) $request->user()->id,
            ),
        ], 201);
    }

    public function listGuardians(Request $request): JsonResponse
    {
        $this->guard();
        $schoolId = $request->integer('school_id') ?: null;
        $filters = $request->only(['relationship']);
        if (empty($filters['relationship'])) {
            $filters['relationship'] = 'guardian';
        }

        return response()->json([
            'data' => $this->ops->listGuardians($filters, $schoolId),
            'meta' => ['stats' => $this->ops->parentStats($schoolId)],
        ]);
    }

    public function listTeachers(Request $request): JsonResponse
    {
        $this->guard();
        $schoolId = $request->integer('school_id') ?: null;

        return response()->json([
            'data' => $this->ops->listTeachers($request->only(['search']), $schoolId),
            'meta' => ['stats' => $this->ops->teacherStats($schoolId)],
        ]);
    }

    public function createTeacher(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'school_id' => ['nullable', 'integer'],
            'teacher_user_id' => ['nullable', 'integer'],
            'email' => ['nullable', 'email', 'max:191'],
            'password' => ['required_without:teacher_user_id', 'nullable', 'string', 'min:8'],
            'first_name' => ['nullable', 'string', 'max:100'],
            'last_name' => ['nullable', 'string', 'max:100'],
        ]);

        return response()->json([
            'message' => 'Teacher created.',
            'data' => $this->ops->createTeacher(
                collect($data)->except('school_id')->all(),
                $request->integer('school_id') ?: null,
                (int) $request->user()->id,
            ),
        ], 201);
    }

    public function listTutors(Request $request): JsonResponse
    {
        $this->guard();
        $schoolId = $request->integer('school_id') ?: null;

        return response()->json([
            'data' => $this->ops->listTutors($request->only(['status']), $schoolId),
            'meta' => ['stats' => $this->ops->tutorStats($schoolId)],
        ]);
    }

    public function createTutor(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'school_id' => ['nullable', 'integer'],
            'user_id' => ['required', 'integer'],
            'bio_en' => ['nullable', 'string'],
            'bio_ar' => ['nullable', 'string'],
            'status' => ['nullable', 'in:active,inactive'],
            'subjects' => ['nullable', 'array'],
            'subjects.*.subject_id' => ['required_with:subjects', 'integer'],
            'subjects.*.languages' => ['nullable', 'array'],
        ]);

        return response()->json([
            'message' => 'Tutor profile created.',
            'data' => $this->ops->createTutor(
                collect($data)->except('school_id')->all(),
                $request->integer('school_id') ?: null,
                (int) $request->user()->id,
            ),
        ], 201);
    }

    public function updateTutor(Request $request, int $tutor): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'school_id' => ['nullable', 'integer'],
            'bio_en' => ['nullable', 'string'],
            'bio_ar' => ['nullable', 'string'],
            'status' => ['sometimes', 'in:active,inactive'],
            'subjects' => ['nullable', 'array'],
            'subjects.*.subject_id' => ['required_with:subjects', 'integer'],
            'subjects.*.languages' => ['nullable', 'array'],
        ]);

        return response()->json([
            'message' => 'Tutor profile updated.',
            'data' => $this->ops->updateTutor(
                $tutor,
                collect($data)->except('school_id')->all(),
                $request->integer('school_id') ?: null,
                (int) $request->user()->id,
            ),
        ]);
    }

    public function listTeachingAssignments(Request $request): JsonResponse
    {
        $this->guard();
        $schoolId = $request->integer('school_id') ?: null;

        return response()->json([
            'data' => $this->ops->listTeachingAssignments(
                $request->only(['teacher_user_id', 'academic_year_id', 'status']),
                $schoolId,
            ),
            'meta' => ['stats' => $this->ops->teachingAssignmentStats($schoolId)],
        ]);
    }

    public function createTeachingAssignment(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'school_id' => ['nullable', 'integer'],
            'teacher_user_id' => ['required', 'integer'],
            'subject_id' => ['required', 'integer'],
            'class_section_id' => ['required', 'integer'],
            'academic_year_id' => ['required', 'integer'],
            'status' => ['nullable', 'in:active,inactive'],
            'notes' => ['nullable', 'string'],
        ]);

        return response()->json([
            'message' => 'Teaching assignment created.',
            'data' => $this->ops->createTeachingAssignment(
                collect($data)->except('school_id')->all(),
                $request->integer('school_id') ?: null,
                (int) $request->user()->id,
            ),
        ], 201);
    }

    public function updateTeachingAssignment(Request $request, int $assignment): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'school_id' => ['nullable', 'integer'],
            'teacher_user_id' => ['sometimes', 'integer'],
            'subject_id' => ['sometimes', 'integer'],
            'class_section_id' => ['sometimes', 'integer'],
            'academic_year_id' => ['sometimes', 'integer'],
            'status' => ['sometimes', 'in:active,inactive'],
            'notes' => ['nullable', 'string'],
        ]);

        return response()->json([
            'message' => 'Teaching assignment updated.',
            'data' => $this->ops->updateTeachingAssignment(
                $assignment,
                collect($data)->except('school_id')->all(),
                $request->integer('school_id') ?: null,
                (int) $request->user()->id,
            ),
        ]);
    }

    public function deleteTeachingAssignment(Request $request, int $assignment): JsonResponse
    {
        $this->guard();
        $this->ops->deleteTeachingAssignment($assignment, $request->integer('school_id') ?: null);

        return response()->json(['message' => 'Teaching assignment deleted.']);
    }

    protected function guard(): void
    {
        $user = request()->user();
        abort_unless(
            $user?->hasRole('super_admin')
                || $user?->hasRole('school_owner')
                || $this->rbac->can($user, 'tenant.schools.manage')
                || $this->rbac->can($user, 'school.users.manage')
                || $this->rbac->can($user, 'school.settings.manage')
                || $this->rbac->can($user, 'platform.tenants.manage'),
            403
        );
    }
}
