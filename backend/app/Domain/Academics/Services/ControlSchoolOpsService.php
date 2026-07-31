<?php

namespace App\Domain\Academics\Services;

use App\Domain\Academics\Models\AcademicYear;
use App\Domain\Academics\Models\ClassSection;
use App\Domain\Academics\Models\Enrollment;
use App\Domain\Academics\Models\Grade;
use App\Domain\Academics\Models\SchoolClass;
use App\Domain\Academics\Models\Subject;
use App\Domain\Academics\Models\TeachingAssignment;
use App\Domain\Academics\Models\Term;
use App\Domain\Identity\Models\ParentStudentLink;
use App\Domain\Identity\Models\Role;
use App\Domain\Identity\Models\UserTenantRole;
use App\Domain\Identity\Services\ChildAccessService;
use App\Domain\Organization\Models\Campus;
use App\Domain\Organization\Models\School;
use App\Domain\Organization\Services\CampusService;
use App\Domain\Tutoring\Models\TutorProfile;
use App\Domain\Tutoring\Services\TutorProfileService;
use App\Models\User;
use App\Services\BaseService;
use App\Support\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ControlSchoolOpsService extends BaseService
{
    /** @var list<string> */
    private const ALUMNI_STATUSES = ['alumni', 'completed', 'withdrawn'];

    public function __construct(
        TenantContext $tenantContext,
        protected SchoolContextService $schoolContext,
        protected CampusService $campusService,
        protected TutorProfileService $tutorProfiles,
        protected ChildAccessService $childAccess,
    ) {
        parent::__construct($tenantContext);
    }

    public function resolveSchool(?int $schoolId = null): School
    {
        return $this->schoolContext->resolveSchool($schoolId);
    }

    /** @return array<string, mixed> */
    public function getSchoolProfile(?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);

        return $this->serializeSchool($school->load(['campuses', 'country']));
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function updateSchoolProfile(array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $school->fill(collect($data)->only([
            'code', 'name_en', 'name_ar', 'timezone', 'status',
        ])->all());
        $school->updated_by = $actorId;
        $school->save();

        return $this->serializeSchool($school->fresh(['campuses', 'country']));
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return list<array<string, mixed>>
     */
    public function listCampuses(array $filters = [], ?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);

        return Campus::query()
            ->where('school_id', $school->id)
            ->when(! empty($filters['status']), fn ($q) => $q->where('status', $filters['status']))
            ->when(! empty($filters['search']), function ($q) use ($filters) {
                $term = '%'.trim((string) $filters['search']).'%';
                $q->where(fn ($sq) => $sq
                    ->where('name_en', 'like', $term)
                    ->orWhere('name_ar', 'like', $term)
                    ->orWhere('code', 'like', $term));
            })
            ->orderBy('name_en')
            ->get()
            ->map(fn (Campus $c) => $this->campusService->serialize($c))
            ->all();
    }

    /** @return array<string, int> */
    public function campusStats(?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $base = Campus::query()->where('school_id', $school->id);

        return [
            'total' => (int) (clone $base)->count(),
            'active' => (int) (clone $base)->where('status', 'active')->count(),
            'inactive' => (int) (clone $base)->where('status', 'inactive')->count(),
        ];
    }

    /** @return array<string, mixed> */
    public function createCampus(array $data, ?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $data['school_id'] = $school->id;

        return $this->campusService->create($data);
    }

    /** @return array<string, mixed> */
    public function updateCampus(int $campusId, array $data, ?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $campus = Campus::query()->where('school_id', $school->id)->findOrFail($campusId);

        return $this->campusService->update($campus, $data);
    }

    public function deleteCampus(int $campusId, ?int $schoolId = null): void
    {
        $school = $this->resolveSchool($schoolId);
        $campus = Campus::query()->where('school_id', $school->id)->findOrFail($campusId);
        $this->campusService->delete($campus);
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return list<array<string, mixed>>
     */
    public function listAcademicYears(array $filters = [], ?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);

        return AcademicYear::query()
            ->where('school_id', $school->id)
            ->with('terms')
            ->when(! empty($filters['status']), fn ($q) => $q->where('status', $filters['status']))
            ->orderByDesc('starts_on')
            ->get()
            ->map(fn (AcademicYear $y) => $this->serializeAcademicYear($y))
            ->all();
    }

    /** @return array<string, int> */
    public function academicYearStats(?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $base = AcademicYear::query()->where('school_id', $school->id);

        return [
            'total' => (int) (clone $base)->count(),
            'current' => (int) (clone $base)->where('is_current', true)->count(),
            'active' => (int) (clone $base)->where('status', 'active')->count(),
        ];
    }

    /** @return array<string, mixed> */
    public function createAcademicYear(array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);

        $year = AcademicYear::query()->create([
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'name' => $data['name'],
            'starts_on' => $data['starts_on'],
            'ends_on' => $data['ends_on'],
            'status' => $data['status'] ?? 'planned',
            'is_current' => false,
            'created_by' => $actorId,
            'updated_by' => $actorId,
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
                'status' => $term['status'] ?? 'upcoming',
                'created_by' => $actorId,
                'updated_by' => $actorId,
            ]);
        }

        if (! empty($data['is_current'])) {
            $this->schoolContext->setCurrentYear($school, $year);
        }

        return $this->serializeAcademicYear($year->fresh('terms'));
    }

    /** @return array<string, mixed> */
    public function setCurrentAcademicYear(int $yearId, ?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $year = AcademicYear::query()->where('school_id', $school->id)->findOrFail($yearId);
        $this->schoolContext->setCurrentYear($school, $year);

        return $this->serializeAcademicYear($year->fresh('terms'));
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return list<array<string, mixed>>
     */
    public function listTerms(array $filters = [], ?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);

        return Term::query()
            ->whereHas('academicYear', fn ($q) => $q->where('school_id', $school->id))
            ->with('academicYear:id,name,school_id')
            ->when(! empty($filters['academic_year_id']), fn ($q) => $q->where('academic_year_id', (int) $filters['academic_year_id']))
            ->when(! empty($filters['status']), fn ($q) => $q->where('status', $filters['status']))
            ->orderBy('academic_year_id')
            ->orderBy('sequence')
            ->get()
            ->map(fn (Term $t) => $this->serializeTerm($t))
            ->all();
    }

    /** @return array<string, int> */
    public function termStats(?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);

        $base = Term::query()
            ->whereHas('academicYear', fn ($q) => $q->where('school_id', $school->id));

        return [
            'total' => (int) (clone $base)->count(),
            'active' => (int) (clone $base)->where('status', 'active')->count(),
            'upcoming' => (int) (clone $base)->where('status', 'upcoming')->count(),
        ];
    }

    /** @return array<string, mixed> */
    public function createTerm(array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $year = AcademicYear::query()->where('school_id', $school->id)->findOrFail((int) $data['academic_year_id']);

        if ($data['starts_on'] < $year->starts_on->toDateString()
            || $data['ends_on'] > $year->ends_on->toDateString()) {
            throw ValidationException::withMessages([
                'starts_on' => ['Term dates must fall within the academic year.'],
            ]);
        }

        $term = Term::query()->create([
            'tenant_id' => $school->tenant_id,
            'academic_year_id' => $year->id,
            'name_en' => $data['name_en'],
            'name_ar' => $data['name_ar'],
            'sequence' => $data['sequence'] ?? 1,
            'starts_on' => $data['starts_on'],
            'ends_on' => $data['ends_on'],
            'status' => $data['status'] ?? 'upcoming',
            'created_by' => $actorId,
            'updated_by' => $actorId,
        ]);

        return $this->serializeTerm($term->load('academicYear'));
    }

    /** @return array<string, mixed> */
    public function updateTerm(int $termId, array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $term = Term::query()
            ->whereHas('academicYear', fn ($q) => $q->where('school_id', $school->id))
            ->findOrFail($termId);

        $term->fill(collect($data)->only([
            'name_en', 'name_ar', 'sequence', 'starts_on', 'ends_on', 'status',
        ])->all());
        $term->updated_by = $actorId;
        $term->save();

        return $this->serializeTerm($term->fresh('academicYear'));
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return list<array<string, mixed>>
     */
    public function listSubjects(array $filters = [], ?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);

        return Subject::query()
            ->where('school_id', $school->id)
            ->when(! empty($filters['status']), fn ($q) => $q->where('status', $filters['status']))
            ->when(! empty($filters['search']), function ($q) use ($filters) {
                $term = '%'.trim((string) $filters['search']).'%';
                $q->where(fn ($sq) => $sq->where('code', 'like', $term)->orWhere('name_en', 'like', $term));
            })
            ->orderBy('code')
            ->get()
            ->map(fn (Subject $s) => $this->serializeSubject($s))
            ->all();
    }

    /** @return array<string, int> */
    public function subjectStats(?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $base = Subject::query()->where('school_id', $school->id);

        return [
            'total' => (int) (clone $base)->count(),
            'active' => (int) (clone $base)->where('status', 'active')->count(),
            'stem' => (int) (clone $base)->where('is_stem', true)->count(),
        ];
    }

    /** @return array<string, mixed> */
    public function createSubject(array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $subject = Subject::query()->create([
            ...collect($data)->only(['code', 'name_en', 'name_ar', 'curriculum_id', 'is_stem', 'tutoring_enabled', 'status'])->all(),
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'is_stem' => $data['is_stem'] ?? true,
            'tutoring_enabled' => $data['tutoring_enabled'] ?? true,
            'status' => $data['status'] ?? 'active',
            'created_by' => $actorId,
            'updated_by' => $actorId,
        ]);

        return $this->serializeSubject($subject);
    }

    /** @return array<string, mixed> */
    public function updateSubject(int $subjectId, array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $subject = Subject::query()->where('school_id', $school->id)->findOrFail($subjectId);
        $subject->fill(collect($data)->only([
            'code', 'name_en', 'name_ar', 'is_stem', 'tutoring_enabled', 'status',
        ])->all());
        $subject->updated_by = $actorId;
        $subject->save();

        return $this->serializeSubject($subject->fresh());
    }

    public function deleteSubject(int $subjectId, ?int $schoolId = null): void
    {
        $school = $this->resolveSchool($schoolId);
        Subject::query()->where('school_id', $school->id)->findOrFail($subjectId)->delete();
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return list<array<string, mixed>>
     */
    public function listGrades(array $filters = [], ?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);

        return Grade::query()
            ->where('school_id', $school->id)
            ->orderBy('sequence')
            ->get()
            ->map(fn (Grade $g) => $this->serializeGrade($g))
            ->all();
    }

    /** @return array<string, int> */
    public function gradeStats(?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);

        return ['total' => (int) Grade::query()->where('school_id', $school->id)->count()];
    }

    /** @return array<string, mixed> */
    public function createGrade(array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $grade = Grade::query()->create([
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'code' => strtoupper(trim((string) $data['code'])),
            'name_en' => $data['name_en'],
            'name_ar' => $data['name_ar'] ?? $data['name_en'],
            'sequence' => (int) ($data['sequence'] ?? 0),
            'created_by' => $actorId,
            'updated_by' => $actorId,
        ]);

        return $this->serializeGrade($grade);
    }

    /** @return array<string, mixed> */
    public function updateGrade(int $gradeId, array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $grade = Grade::query()->where('school_id', $school->id)->findOrFail($gradeId);
        $grade->fill(collect($data)->only(['code', 'name_en', 'name_ar', 'sequence'])->all());
        if (isset($data['code'])) {
            $grade->code = strtoupper(trim((string) $data['code']));
        }
        $grade->updated_by = $actorId;
        $grade->save();

        return $this->serializeGrade($grade->fresh());
    }

    public function deleteGrade(int $gradeId, ?int $schoolId = null): void
    {
        $school = $this->resolveSchool($schoolId);
        Grade::query()->where('school_id', $school->id)->findOrFail($gradeId)->delete();
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return list<array<string, mixed>>
     */
    public function listClasses(array $filters = [], ?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);

        return SchoolClass::query()
            ->where('school_id', $school->id)
            ->with(['grade', 'campus', 'academicYear'])
            ->when(! empty($filters['academic_year_id']), fn ($q) => $q->where('academic_year_id', (int) $filters['academic_year_id']))
            ->when(! empty($filters['grade_id']), fn ($q) => $q->where('grade_id', (int) $filters['grade_id']))
            ->orderBy('code')
            ->get()
            ->map(fn (SchoolClass $c) => $this->serializeClass($c))
            ->all();
    }

    /** @return array<string, int> */
    public function classStats(?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $base = SchoolClass::query()->where('school_id', $school->id);

        return [
            'total' => (int) (clone $base)->count(),
            'active' => (int) (clone $base)->where('status', 'active')->count(),
        ];
    }

    /** @return array<string, mixed> */
    public function createClass(array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $class = SchoolClass::query()->create([
            ...collect($data)->only(['campus_id', 'academic_year_id', 'grade_id', 'code', 'name_en', 'name_ar', 'status'])->all(),
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'status' => $data['status'] ?? 'active',
            'created_by' => $actorId,
            'updated_by' => $actorId,
        ]);

        return $this->serializeClass($class->load(['grade', 'campus', 'academicYear']));
    }

    /** @return array<string, mixed> */
    public function updateClass(int $classId, array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $class = SchoolClass::query()->where('school_id', $school->id)->findOrFail($classId);
        $class->fill(collect($data)->only(['campus_id', 'code', 'name_en', 'name_ar', 'status'])->all());
        $class->updated_by = $actorId;
        $class->save();

        return $this->serializeClass($class->fresh(['grade', 'campus', 'academicYear']));
    }

    public function deleteClass(int $classId, ?int $schoolId = null): void
    {
        $school = $this->resolveSchool($schoolId);
        SchoolClass::query()->where('school_id', $school->id)->findOrFail($classId)->delete();
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return list<array<string, mixed>>
     */
    public function listSections(array $filters = [], ?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);

        return ClassSection::query()
            ->where('school_id', $school->id)
            ->with(['grade', 'campus', 'academicYear', 'schoolClass'])
            ->when(! empty($filters['academic_year_id']), fn ($q) => $q->where('academic_year_id', (int) $filters['academic_year_id']))
            ->when(! empty($filters['school_class_id']), fn ($q) => $q->where('school_class_id', (int) $filters['school_class_id']))
            ->orderBy('name')
            ->get()
            ->map(fn (ClassSection $s) => $this->serializeSection($s))
            ->all();
    }

    /** @return array<string, int> */
    public function sectionStats(?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $base = ClassSection::query()->where('school_id', $school->id);

        return [
            'total' => (int) (clone $base)->count(),
            'active' => (int) (clone $base)->where('status', 'active')->count(),
        ];
    }

    /** @return array<string, mixed> */
    public function createSection(array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);

        if (! empty($data['school_class_id'])) {
            $class = SchoolClass::query()->where('school_id', $school->id)->findOrFail($data['school_class_id']);
            $data['academic_year_id'] = $class->academic_year_id;
            $data['grade_id'] = $class->grade_id;
            $data['campus_id'] = $data['campus_id'] ?? $class->campus_id;
        }

        $section = ClassSection::query()->create([
            ...collect($data)->only(['campus_id', 'academic_year_id', 'grade_id', 'school_class_id', 'name', 'section_code', 'status'])->all(),
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'status' => $data['status'] ?? 'active',
            'created_by' => $actorId,
            'updated_by' => $actorId,
        ]);

        return $this->serializeSection($section->load(['grade', 'campus', 'academicYear', 'schoolClass']));
    }

    /** @return array<string, mixed> */
    public function updateSection(int $sectionId, array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $section = ClassSection::query()->where('school_id', $school->id)->findOrFail($sectionId);
        $section->fill(collect($data)->only(['campus_id', 'school_class_id', 'name', 'section_code', 'status'])->all());
        $section->updated_by = $actorId;
        $section->save();

        return $this->serializeSection($section->fresh(['grade', 'campus', 'academicYear', 'schoolClass']));
    }

    public function deleteSection(int $sectionId, ?int $schoolId = null): void
    {
        $school = $this->resolveSchool($schoolId);
        ClassSection::query()->where('school_id', $school->id)->findOrFail($sectionId)->delete();
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return list<array<string, mixed>>
     */
    public function listStudents(array $filters = [], ?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $statusFilter = $filters['status'] ?? 'active';

        $enrollmentQuery = Enrollment::query()
            ->where('school_id', $school->id)
            ->with(['student', 'grade', 'classSection', 'academicYear']);

        $this->applyEnrollmentStatusFilter($enrollmentQuery, $statusFilter);

        $fromEnrollments = $enrollmentQuery->get()
            ->map(fn (Enrollment $e) => $this->serializeStudentFromEnrollment($e))
            ->keyBy('user_id');

        if ($fromEnrollments->isEmpty() && in_array($statusFilter, ['active', 'all'], true)) {
            $roleStudents = $this->usersWithRole($school, 'student')
                ->map(fn (User $u) => $this->serializeStudentFromUser($u))
                ->keyBy('user_id');

            return $roleStudents->values()->all();
        }

        if (($filters['include_role_only'] ?? false) && in_array($statusFilter, ['active', 'all'], true)) {
            $roleStudents = $this->usersWithRole($school, 'student')
                ->filter(fn (User $u) => ! $fromEnrollments->has($u->id))
                ->map(fn (User $u) => $this->serializeStudentFromUser($u));

            return $fromEnrollments->merge($roleStudents)->values()->all();
        }

        return $fromEnrollments->values()->all();
    }

    /** @return array<string, mixed> */
    public function showStudent(int $userId, ?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $enrollment = Enrollment::query()
            ->where('school_id', $school->id)
            ->where('student_user_id', $userId)
            ->with(['student', 'grade', 'classSection', 'academicYear'])
            ->latest('id')
            ->first();

        if ($enrollment) {
            return $this->serializeStudentFromEnrollment($enrollment, true);
        }

        $user = User::query()
            ->where('tenant_id', $school->tenant_id)
            ->whereHas('tenantRoles.role', fn ($q) => $q->where('code', 'student'))
            ->findOrFail($userId);

        return $this->serializeStudentFromUser($user, true);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function createStudent(array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);

        return DB::transaction(function () use ($school, $data, $actorId) {
            $studentUserId = $data['student_user_id'] ?? null;

            if (! $studentUserId && ! empty($data['email'])) {
                $student = User::query()->create([
                    'tenant_id' => $school->tenant_id,
                    'email' => strtolower(trim((string) $data['email'])),
                    'password' => Hash::make($data['password'] ?? Str::random(16)),
                    'first_name' => $data['first_name'] ?? 'Student',
                    'last_name' => $data['last_name'] ?? '',
                    'status' => 'active',
                    'email_verified_at' => now(),
                    'created_by' => $actorId,
                    'updated_by' => $actorId,
                ]);
                $this->assignRole($student, $school, 'student', $actorId);
                $studentUserId = $student->id;
            } elseif ($studentUserId) {
                User::query()->where('tenant_id', $school->tenant_id)->findOrFail($studentUserId);
            } else {
                throw ValidationException::withMessages([
                    'student_user_id' => ['Provide student_user_id or email to create a student.'],
                ]);
            }

            $enrollment = Enrollment::query()->create([
                'tenant_id' => $school->tenant_id,
                'school_id' => $school->id,
                'student_user_id' => $studentUserId,
                'academic_year_id' => $data['academic_year_id'],
                'class_section_id' => $data['class_section_id'],
                'grade_id' => $data['grade_id'],
                'status' => $data['status'] ?? 'active',
                'enrolled_on' => $data['enrolled_on'] ?? now()->toDateString(),
                'created_by' => $actorId,
                'updated_by' => $actorId,
            ]);

            return $this->serializeStudentFromEnrollment($enrollment->load(['student', 'grade', 'classSection', 'academicYear']), true);
        });
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function updateStudent(int $userId, array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $user = User::query()->where('tenant_id', $school->tenant_id)->findOrFail($userId);

        $user->fill(collect($data)->only(['first_name', 'last_name', 'phone', 'status'])->all());
        $user->updated_by = $actorId;
        $user->save();

        $enrollment = Enrollment::query()
            ->where('school_id', $school->id)
            ->where('student_user_id', $userId)
            ->latest('id')
            ->first();

        if ($enrollment && isset($data['enrollment'])) {
            $enrollment->fill(collect($data['enrollment'])->only([
                'class_section_id', 'grade_id', 'academic_year_id', 'status', 'enrolled_on',
            ])->all());
            $enrollment->updated_by = $actorId;
            $enrollment->save();
        }

        if ($enrollment) {
            return $this->serializeStudentFromEnrollment($enrollment->fresh(['student', 'grade', 'classSection', 'academicYear']), true);
        }

        return $this->serializeStudentFromUser($user->fresh(), true);
    }

    /** @return array<string, int> */
    public function studentStats(?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $base = Enrollment::query()->where('school_id', $school->id);

        $roleCount = $this->usersWithRole($school, 'student')->count();
        $enrollmentCount = (int) (clone $base)->count();

        return [
            'total_enrollments' => $enrollmentCount,
            'active' => (int) (clone $base)->where('status', 'active')->count(),
            'pending' => (int) (clone $base)->where('status', 'pending')->count(),
            'alumni' => (int) (clone $base)->whereIn('status', self::ALUMNI_STATUSES)->count(),
            'transfer' => (int) (clone $base)->where('status', 'transfer')->count(),
            'role_students' => $roleCount,
        ];
    }

    /** @return list<array<string, mixed>> */
    public function listAdmissions(?int $schoolId = null): array
    {
        return $this->listStudents(['status' => 'pending'], $schoolId);
    }

    /** @return array<string, mixed> */
    public function acceptAdmission(int $enrollmentId, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $enrollment = Enrollment::query()
            ->where('school_id', $school->id)
            ->where('status', 'pending')
            ->findOrFail($enrollmentId);

        $enrollment->update([
            'status' => 'active',
            'enrolled_on' => now()->toDateString(),
            'updated_by' => $actorId,
        ]);

        return $this->serializeStudentFromEnrollment($enrollment->fresh(['student', 'grade', 'classSection', 'academicYear']), true);
    }

    /** @return array<string, mixed> */
    public function rejectAdmission(int $enrollmentId, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $enrollment = Enrollment::query()
            ->where('school_id', $school->id)
            ->where('status', 'pending')
            ->findOrFail($enrollmentId);

        $enrollment->update(['status' => 'rejected', 'updated_by' => $actorId]);

        return $this->serializeStudentFromEnrollment($enrollment->fresh(['student', 'grade', 'classSection', 'academicYear']), true);
    }

    /** @return list<array<string, mixed>> */
    public function listTransfers(?int $schoolId = null): array
    {
        return $this->listStudents(['status' => 'transfer'], $schoolId);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function createTransfer(array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $enrollment = Enrollment::query()
            ->where('school_id', $school->id)
            ->where('student_user_id', $data['student_user_id'])
            ->where('status', 'active')
            ->latest('id')
            ->firstOrFail();

        $enrollment->update([
            'status' => 'transfer',
            'class_section_id' => $data['class_section_id'] ?? $enrollment->class_section_id,
            'grade_id' => $data['grade_id'] ?? $enrollment->grade_id,
            'academic_year_id' => $data['academic_year_id'] ?? $enrollment->academic_year_id,
            'updated_by' => $actorId,
        ]);

        return $this->serializeStudentFromEnrollment($enrollment->fresh(['student', 'grade', 'classSection', 'academicYear']), true);
    }

    /** @return list<array<string, mixed>> */
    public function listAlumni(?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);

        return Enrollment::query()
            ->where('school_id', $school->id)
            ->whereIn('status', self::ALUMNI_STATUSES)
            ->with(['student', 'grade', 'classSection', 'academicYear'])
            ->get()
            ->map(fn (Enrollment $e) => $this->serializeStudentFromEnrollment($e))
            ->all();
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return list<array<string, mixed>>
     */
    public function listParents(array $filters = [], ?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);

        return $this->listGuardianUsers($school, $filters, ['parent']);
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return list<array<string, mixed>>
     */
    public function listGuardians(array $filters = [], ?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);

        return $this->listGuardianUsers($school, $filters);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function createParent(array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);

        return DB::transaction(function () use ($school, $data, $actorId) {
            $parentId = $data['parent_user_id'] ?? null;

            if (! $parentId && ! empty($data['email'])) {
                $parent = User::query()->create([
                    'tenant_id' => $school->tenant_id,
                    'email' => strtolower(trim((string) $data['email'])),
                    'password' => Hash::make($data['password'] ?? Str::random(16)),
                    'first_name' => $data['first_name'] ?? 'Parent',
                    'last_name' => $data['last_name'] ?? '',
                    'status' => 'active',
                    'email_verified_at' => now(),
                    'created_by' => $actorId,
                    'updated_by' => $actorId,
                ]);
                $this->assignRole($parent, $school, 'parent', $actorId);
                $parentId = $parent->id;
            } else {
                $parent = User::query()->where('tenant_id', $school->tenant_id)->findOrFail($parentId);
            }

            if (! empty($data['student_user_id'])) {
                $this->childAccess->link(
                    (int) $school->tenant_id,
                    (int) $parentId,
                    (int) $data['student_user_id'],
                    $data['relationship'] ?? 'parent',
                    (bool) ($data['is_primary'] ?? true),
                );
            }

            return $this->serializeParent($parent->fresh(), true);
        });
    }

    /** @return array<string, int> */
    public function parentStats(?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);

        return [
            'parents' => $this->usersWithRole($school, 'parent')->count(),
            'links' => (int) ParentStudentLink::query()->where('tenant_id', $school->tenant_id)->count(),
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return list<array<string, mixed>>
     */
    public function listTeachers(array $filters = [], ?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);

        return $this->usersWithRole($school, 'teacher')
            ->when(! empty($filters['search']), function ($users) use ($filters) {
                $term = strtolower(trim((string) $filters['search']));

                return $users->filter(fn (User $u) => str_contains(strtolower($u->email), $term)
                    || str_contains(strtolower($u->first_name ?? ''), $term)
                    || str_contains(strtolower($u->last_name ?? ''), $term));
            })
            ->map(fn (User $u) => $this->serializeStaffUser($u))
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function createTeacher(array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);

        return DB::transaction(function () use ($school, $data, $actorId) {
            $teacherId = $data['teacher_user_id'] ?? null;

            if (! $teacherId && ! empty($data['email'])) {
                $teacher = User::query()->create([
                    'tenant_id' => $school->tenant_id,
                    'email' => strtolower(trim((string) $data['email'])),
                    'password' => Hash::make($data['password'] ?? Str::random(16)),
                    'first_name' => $data['first_name'] ?? 'Teacher',
                    'last_name' => $data['last_name'] ?? '',
                    'status' => 'active',
                    'email_verified_at' => now(),
                    'created_by' => $actorId,
                    'updated_by' => $actorId,
                ]);
                $this->assignRole($teacher, $school, 'teacher', $actorId);
            } else {
                $teacher = User::query()->where('tenant_id', $school->tenant_id)->findOrFail($teacherId);
                $this->assignRole($teacher, $school, 'teacher', $actorId);
            }

            return $this->serializeStaffUser($teacher->fresh());
        });
    }

    /** @return array<string, int> */
    public function teacherStats(?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);

        return ['total' => $this->usersWithRole($school, 'teacher')->count()];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return list<array<string, mixed>>
     */
    public function listTutors(array $filters = [], ?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);

        return TutorProfile::query()
            ->where('school_id', $school->id)
            ->when(! empty($filters['status']), fn ($q) => $q->where('status', $filters['status']))
            ->with(['user:id,email,first_name,last_name', 'subjects'])
            ->withAvg('ratings', 'rating')
            ->orderByDesc('id')
            ->get()
            ->map(fn (TutorProfile $p) => $this->serializeTutor($p))
            ->all();
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function createTutor(array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $user = User::query()->where('tenant_id', $school->tenant_id)->findOrFail($data['user_id']);
        $this->assignRole($user, $school, 'tutor', $actorId);
        $profile = $this->tutorProfiles->create($school, $user, $data);

        return $this->serializeTutor($profile);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function updateTutor(int $tutorId, array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $profile = TutorProfile::query()->where('school_id', $school->id)->findOrFail($tutorId);
        $profile->update(collect($data)->except('subjects')->all());
        if (array_key_exists('subjects', $data)) {
            $this->tutorProfiles->syncSubjects($profile, $data['subjects'] ?? []);
        }
        $profile->updated_by = $actorId;
        $profile->save();

        return $this->serializeTutor($profile->fresh(['user', 'subjects']));
    }

    /** @return array<string, int> */
    public function tutorStats(?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $base = TutorProfile::query()->where('school_id', $school->id);

        return [
            'total' => (int) (clone $base)->count(),
            'active' => (int) (clone $base)->where('status', 'active')->count(),
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return list<array<string, mixed>>
     */
    public function listTeachingAssignments(array $filters = [], ?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);

        return TeachingAssignment::query()
            ->where('school_id', $school->id)
            ->with(['teacher:id,email,first_name,last_name', 'subject', 'classSection', 'academicYear'])
            ->when(! empty($filters['teacher_user_id']), fn ($q) => $q->where('teacher_user_id', (int) $filters['teacher_user_id']))
            ->when(! empty($filters['academic_year_id']), fn ($q) => $q->where('academic_year_id', (int) $filters['academic_year_id']))
            ->when(! empty($filters['status']), fn ($q) => $q->where('status', $filters['status']))
            ->orderByDesc('id')
            ->get()
            ->map(fn (TeachingAssignment $a) => $this->serializeTeachingAssignment($a))
            ->all();
    }

    /** @return array<string, int> */
    public function teachingAssignmentStats(?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $base = TeachingAssignment::query()->where('school_id', $school->id);

        return [
            'total' => (int) (clone $base)->count(),
            'active' => (int) (clone $base)->where('status', 'active')->count(),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function createTeachingAssignment(array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        User::query()->where('tenant_id', $school->tenant_id)->findOrFail($data['teacher_user_id']);
        ClassSection::query()->where('school_id', $school->id)->findOrFail($data['class_section_id']);
        Subject::query()->where('school_id', $school->id)->findOrFail($data['subject_id']);

        $assignment = TeachingAssignment::query()->create([
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'teacher_user_id' => $data['teacher_user_id'],
            'subject_id' => $data['subject_id'],
            'class_section_id' => $data['class_section_id'],
            'academic_year_id' => $data['academic_year_id'],
            'status' => $data['status'] ?? 'active',
            'notes' => $data['notes'] ?? null,
            'created_by' => $actorId,
            'updated_by' => $actorId,
        ]);

        return $this->serializeTeachingAssignment($assignment->load(['teacher', 'subject', 'classSection', 'academicYear']));
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function updateTeachingAssignment(int $assignmentId, array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $assignment = TeachingAssignment::query()->where('school_id', $school->id)->findOrFail($assignmentId);
        $assignment->fill(collect($data)->only(['teacher_user_id', 'subject_id', 'class_section_id', 'academic_year_id', 'status', 'notes'])->all());
        $assignment->updated_by = $actorId;
        $assignment->save();

        return $this->serializeTeachingAssignment($assignment->fresh(['teacher', 'subject', 'classSection', 'academicYear']));
    }

    public function deleteTeachingAssignment(int $assignmentId, ?int $schoolId = null): void
    {
        $school = $this->resolveSchool($schoolId);
        TeachingAssignment::query()->where('school_id', $school->id)->findOrFail($assignmentId)->delete();
    }

    /** @param  list<string>|null  $relationships */
    protected function listGuardianUsers(School $school, array $filters, ?array $relationships = null): array
    {
        $query = User::query()
            ->where('tenant_id', $school->tenant_id)
            ->whereHas('tenantRoles.role', fn ($q) => $q->where('code', 'parent'));

        if ($relationships !== null) {
            $query->whereHas('tenantRoles'); // parent role already filtered
        }

        $users = $query->orderBy('first_name')->get();

        $links = ParentStudentLink::query()
            ->where('tenant_id', $school->tenant_id)
            ->when(! empty($filters['relationship']), fn ($q) => $q->where('relationship', $filters['relationship']))
            ->when($relationships !== null, fn ($q) => $q->whereIn('relationship', $relationships))
            ->with('student:id,email,first_name,last_name')
            ->get()
            ->groupBy('parent_user_id');

        if (! empty($filters['relationship']) || ($relationships !== null && $relationships !== ['parent'])) {
            $parentIds = $links->keys();
            $users = $users->whereIn('id', $parentIds);
        }

        return $users->map(function (User $u) use ($links) {
            $payload = $this->serializeParent($u);
            $payload['links'] = ($links[$u->id] ?? collect())->map(fn (ParentStudentLink $l) => [
                'id' => $l->id,
                'student_user_id' => $l->student_user_id,
                'relationship' => $l->relationship,
                'is_primary' => $l->is_primary,
                'student' => $l->student ? [
                    'id' => $l->student->id,
                    'email' => $l->student->email,
                    'first_name' => $l->student->first_name,
                    'last_name' => $l->student->last_name,
                ] : null,
            ])->values()->all();

            return $payload;
        })->values()->all();
    }

    /** @return \Illuminate\Support\Collection<int, User> */
    protected function usersWithRole(School $school, string $roleCode): \Illuminate\Support\Collection
    {
        return User::query()
            ->where('tenant_id', $school->tenant_id)
            ->whereHas('tenantRoles', fn ($q) => $q
                ->where('tenant_id', $school->tenant_id)
                ->whereHas('role', fn ($r) => $r->where('code', $roleCode)))
            ->orderBy('first_name')
            ->get();
    }

    protected function assignRole(User $user, School $school, string $roleCode, ?int $actorId = null): void
    {
        $role = Role::query()->where('code', $roleCode)->firstOrFail();
        UserTenantRole::query()->updateOrCreate(
            [
                'user_id' => $user->id,
                'tenant_id' => $school->tenant_id,
                'role_id' => $role->id,
            ],
            [
                'school_id' => $school->id,
                'created_by' => $actorId,
                'updated_by' => $actorId,
            ]
        );
    }

    protected function applyEnrollmentStatusFilter($query, string $status): void
    {
        match ($status) {
            'active' => $query->where('status', 'active'),
            'pending' => $query->where('status', 'pending'),
            'transfer' => $query->where('status', 'transfer'),
            'alumni' => $query->whereIn('status', self::ALUMNI_STATUSES),
            default => null,
        };
    }

    /** @return array<string, mixed> */
    protected function serializeSchool(School $school): array
    {
        return [
            'id' => $school->id,
            'tenant_id' => $school->tenant_id,
            'code' => $school->code,
            'name_en' => $school->name_en,
            'name_ar' => $school->name_ar,
            'timezone' => $school->timezone,
            'status' => $school->status,
            'country' => $school->relationLoaded('country') && $school->country
                ? ['id' => $school->country->id, 'code' => $school->country->code, 'name_en' => $school->country->name_en]
                : null,
            'campuses' => $school->relationLoaded('campuses')
                ? $school->campuses->map(fn (Campus $c) => [
                    'id' => $c->id,
                    'code' => $c->code,
                    'name_en' => $c->name_en,
                    'status' => $c->status,
                ])->all()
                : [],
        ];
    }

    /** @return array<string, mixed> */
    protected function serializeAcademicYear(AcademicYear $year): array
    {
        return [
            'id' => $year->id,
            'name' => $year->name,
            'starts_on' => $year->starts_on?->toDateString(),
            'ends_on' => $year->ends_on?->toDateString(),
            'is_current' => (bool) $year->is_current,
            'status' => $year->status,
            'terms' => $year->relationLoaded('terms')
                ? $year->terms->map(fn (Term $t) => $this->serializeTerm($t))->all()
                : [],
        ];
    }

    /** @return array<string, mixed> */
    protected function serializeTerm(Term $term): array
    {
        return [
            'id' => $term->id,
            'academic_year_id' => $term->academic_year_id,
            'name_en' => $term->name_en,
            'name_ar' => $term->name_ar,
            'sequence' => (int) $term->sequence,
            'starts_on' => $term->starts_on?->toDateString(),
            'ends_on' => $term->ends_on?->toDateString(),
            'status' => $term->status,
            'academic_year' => $term->relationLoaded('academicYear') && $term->academicYear
                ? ['id' => $term->academicYear->id, 'name' => $term->academicYear->name]
                : null,
        ];
    }

    /** @return array<string, mixed> */
    protected function serializeSubject(Subject $subject): array
    {
        return [
            'id' => $subject->id,
            'code' => $subject->code,
            'name_en' => $subject->name_en,
            'name_ar' => $subject->name_ar,
            'is_stem' => (bool) $subject->is_stem,
            'tutoring_enabled' => (bool) $subject->tutoring_enabled,
            'status' => $subject->status,
        ];
    }

    /** @return array<string, mixed> */
    protected function serializeGrade(Grade $grade): array
    {
        return [
            'id' => $grade->id,
            'code' => $grade->code,
            'name_en' => $grade->name_en,
            'name_ar' => $grade->name_ar,
            'sequence' => (int) $grade->sequence,
        ];
    }

    /** @return array<string, mixed> */
    protected function serializeClass(SchoolClass $class): array
    {
        return [
            'id' => $class->id,
            'code' => $class->code,
            'name_en' => $class->name_en,
            'name_ar' => $class->name_ar,
            'status' => $class->status,
            'grade_id' => $class->grade_id,
            'campus_id' => $class->campus_id,
            'academic_year_id' => $class->academic_year_id,
            'grade' => $class->relationLoaded('grade') && $class->grade
                ? ['id' => $class->grade->id, 'code' => $class->grade->code, 'name_en' => $class->grade->name_en]
                : null,
        ];
    }

    /** @return array<string, mixed> */
    protected function serializeSection(ClassSection $section): array
    {
        return [
            'id' => $section->id,
            'name' => $section->name,
            'section_code' => $section->section_code,
            'status' => $section->status,
            'grade_id' => $section->grade_id,
            'campus_id' => $section->campus_id,
            'academic_year_id' => $section->academic_year_id,
            'school_class_id' => $section->school_class_id,
        ];
    }

    /** @return array<string, mixed> */
    protected function serializeStudentFromEnrollment(Enrollment $enrollment, bool $detailed = false): array
    {
        $user = $enrollment->student;

        $payload = [
            'user_id' => $enrollment->student_user_id,
            'enrollment_id' => $enrollment->id,
            'status' => $enrollment->status,
            'enrolled_on' => $enrollment->enrolled_on?->toDateString(),
            'email' => $user?->email,
            'first_name' => $user?->first_name,
            'last_name' => $user?->last_name,
            'grade' => $enrollment->relationLoaded('grade') && $enrollment->grade
                ? ['id' => $enrollment->grade->id, 'code' => $enrollment->grade->code, 'name_en' => $enrollment->grade->name_en]
                : null,
            'class_section' => $enrollment->relationLoaded('classSection') && $enrollment->classSection
                ? ['id' => $enrollment->classSection->id, 'name' => $enrollment->classSection->name]
                : null,
            'academic_year' => $enrollment->relationLoaded('academicYear') && $enrollment->academicYear
                ? ['id' => $enrollment->academicYear->id, 'name' => $enrollment->academicYear->name]
                : null,
        ];

        if ($detailed && $user) {
            $payload['phone'] = $user->phone;
            $payload['user_status'] = $user->status;
        }

        return $payload;
    }

    /** @return array<string, mixed> */
    protected function serializeStudentFromUser(User $user, bool $detailed = false): array
    {
        $payload = [
            'user_id' => $user->id,
            'enrollment_id' => null,
            'status' => 'active',
            'email' => $user->email,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'source' => 'role',
        ];

        if ($detailed) {
            $payload['phone'] = $user->phone;
            $payload['user_status'] = $user->status;
        }

        return $payload;
    }

    /** @return array<string, mixed> */
    protected function serializeParent(User $user, bool $detailed = false): array
    {
        $payload = [
            'user_id' => $user->id,
            'email' => $user->email,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'status' => $user->status,
        ];

        if ($detailed) {
            $payload['phone'] = $user->phone;
        }

        return $payload;
    }

    /** @return array<string, mixed> */
    protected function serializeStaffUser(User $user): array
    {
        return [
            'user_id' => $user->id,
            'email' => $user->email,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'status' => $user->status,
        ];
    }

    /** @return array<string, mixed> */
    protected function serializeTutor(TutorProfile $profile): array
    {
        return [
            'id' => $profile->id,
            'user_id' => $profile->user_id,
            'status' => $profile->status,
            'bio_en' => $profile->bio_en,
            'bio_ar' => $profile->bio_ar,
            'ratings_avg_rating' => $profile->ratings_avg_rating,
            'user' => $profile->relationLoaded('user') && $profile->user
                ? [
                    'id' => $profile->user->id,
                    'email' => $profile->user->email,
                    'first_name' => $profile->user->first_name,
                    'last_name' => $profile->user->last_name,
                ]
                : null,
            'subjects' => $profile->relationLoaded('subjects')
                ? $profile->subjects->map(fn (Subject $s) => ['id' => $s->id, 'code' => $s->code, 'name_en' => $s->name_en])->all()
                : [],
        ];
    }

    /** @return array<string, mixed> */
    protected function serializeTeachingAssignment(TeachingAssignment $assignment): array
    {
        return [
            'id' => $assignment->id,
            'teacher_user_id' => $assignment->teacher_user_id,
            'subject_id' => $assignment->subject_id,
            'class_section_id' => $assignment->class_section_id,
            'academic_year_id' => $assignment->academic_year_id,
            'status' => $assignment->status,
            'notes' => $assignment->notes,
            'teacher' => $assignment->relationLoaded('teacher') && $assignment->teacher
                ? ['id' => $assignment->teacher->id, 'email' => $assignment->teacher->email, 'first_name' => $assignment->teacher->first_name, 'last_name' => $assignment->teacher->last_name]
                : null,
            'subject' => $assignment->relationLoaded('subject') && $assignment->subject
                ? ['id' => $assignment->subject->id, 'code' => $assignment->subject->code, 'name_en' => $assignment->subject->name_en]
                : null,
            'class_section' => $assignment->relationLoaded('classSection') && $assignment->classSection
                ? ['id' => $assignment->classSection->id, 'name' => $assignment->classSection->name]
                : null,
        ];
    }
}
