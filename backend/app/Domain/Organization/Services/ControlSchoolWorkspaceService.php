<?php

namespace App\Domain\Organization\Services;

use App\Domain\Academics\Models\Enrollment;
use App\Domain\Academics\Models\Subject;
use App\Domain\Academics\Services\SchoolContextService;
use App\Domain\Assessment\Models\Assessment;
use App\Domain\Assessment\Models\AssessmentAttempt;
use App\Domain\Assessment\Models\SchoolQuestion;
use App\Domain\Audit\Models\AuditLog;
use App\Domain\Billing\Models\SchoolExpense;
use App\Domain\Billing\Models\StudentInvoice;
use App\Domain\Billing\Models\TutorPayment;
use App\Domain\Identity\Models\Role;
use App\Domain\Identity\Models\UserTenantRole;
use App\Domain\Learning\Models\HomeworkAssignment;
use App\Domain\Learning\Models\LearningResource;
use App\Domain\Learning\Models\SchoolCourse;
use App\Domain\Learning\Models\SchoolLesson;
use App\Domain\Organization\Models\School;
use App\Domain\Organization\Models\SchoolNotification;
use App\Domain\Organization\Models\StaffAttendance;
use App\Domain\Organization\Models\Tenant;
use App\Domain\Tutoring\Models\TutorProfile;
use App\Domain\Tutoring\Models\TutoringSession;
use App\Domain\Tutoring\Models\TutoringTimetableSlot;
use App\Models\User;
use App\Services\BaseService;
use App\Support\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class ControlSchoolWorkspaceService extends BaseService
{
    private const STAFF_ROLES = ['school_admin', 'campus_admin', 'principal', 'academic_coordinator', 'finance_manager'];

    private const DAYS = [0 => 'Sunday', 1 => 'Monday', 2 => 'Tuesday', 3 => 'Wednesday', 4 => 'Thursday', 5 => 'Friday', 6 => 'Saturday'];

    public function __construct(
        TenantContext $tenantContext,
        protected SchoolContextService $schoolContext,
    ) {
        parent::__construct($tenantContext);
    }

    public function resolveSchool(?int $schoolId = null): School
    {
        return $this->schoolContext->resolveSchool($schoolId);
    }

    public function listStaff(array $filters = [], ?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $rows = collect();
        foreach (self::STAFF_ROLES as $role) {
            foreach ($this->usersWithRole($school, $role) as $user) {
                $rows->push($this->staffRow($user, $role));
            }
        }
        $rows = $rows->unique('user_id')->values();
        if (! empty($filters['search'])) {
            $t = strtolower(trim((string) $filters['search']));
            $rows = $rows->filter(fn ($r) => str_contains(strtolower((string) $r['email']), $t)
                || str_contains(strtolower((string) ($r['first_name'] ?? '')), $t))->values();
        }

        return $rows->all();
    }

    public function staffStats(?int $schoolId = null): array
    {
        $rows = $this->listStaff([], $schoolId);

        return ['total' => count($rows), 'active' => count(array_filter($rows, fn ($r) => ($r['status'] ?? '') === 'active'))];
    }

    public function createStaff(array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $role = in_array($data['role'] ?? '', self::STAFF_ROLES, true) ? $data['role'] : 'school_admin';

        return DB::transaction(function () use ($school, $data, $actorId, $role) {
            $user = User::query()->create([
                'tenant_id' => $school->tenant_id,
                'email' => strtolower(trim((string) $data['email'])),
                'password' => Hash::make($data['password'] ?? Str::random(16)),
                'first_name' => $data['first_name'] ?? 'Staff',
                'last_name' => $data['last_name'] ?? '',
                'status' => 'active',
                'email_verified_at' => now(),
                'created_by' => $actorId,
                'updated_by' => $actorId,
            ]);
            $this->assignRole($user, $school, $role, $actorId);

            return $this->staffRow($user->fresh(), $role);
        });
    }

    public function updateStaff(int $userId, array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $user = User::query()->where('tenant_id', $school->tenant_id)->findOrFail($userId);
        if (isset($data['first_name'])) {
            $user->first_name = $data['first_name'];
        }
        if (array_key_exists('last_name', $data)) {
            $user->last_name = $data['last_name'];
        }
        if (! empty($data['status'])) {
            $user->status = $data['status'];
        }
        $user->updated_by = $actorId;
        $user->save();

        $role = $data['role'] ?? null;
        if ($role && in_array($role, self::STAFF_ROLES, true)) {
            $this->assignRole($user, $school, $role, $actorId);
        } else {
            $roleIds = UserTenantRole::query()
                ->where('user_id', $user->id)
                ->where('tenant_id', $school->tenant_id)
                ->pluck('role_id');
            $role = Role::query()->whereIn('id', $roleIds)->whereIn('code', self::STAFF_ROLES)->value('code')
                ?? 'school_admin';
        }

        return $this->staffRow($user->fresh(), $role);
    }

    public function listStaffAttendance(array $filters = [], ?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $q = StaffAttendance::query()->where('school_id', $school->id)->orderByDesc('attendance_date');
        if (! empty($filters['status'])) {
            $q->where('status', $filters['status']);
        }

        return $q->limit(200)->get()->map(fn ($r) => $this->attendanceRow($r))->all();
    }

    public function attendanceStats(?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $base = StaffAttendance::query()->where('school_id', $school->id);

        return [
            'present' => (int) (clone $base)->where('status', 'present')->count(),
            'absent' => (int) (clone $base)->where('status', 'absent')->count(),
            'late' => (int) (clone $base)->where('status', 'late')->count(),
            'leave' => (int) (clone $base)->where('status', 'leave')->count(),
        ];
    }

    public function createStaffAttendance(array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $row = StaffAttendance::query()->create([
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'user_id' => (int) $data['user_id'],
            'attendance_date' => $data['attendance_date'],
            'status' => $data['status'] ?? 'present',
            'notes' => $data['notes'] ?? null,
            'created_by' => $actorId,
            'updated_by' => $actorId,
        ]);

        return $this->attendanceRow($row);
    }

    public function updateStaffAttendance(int $id, array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $row = StaffAttendance::query()->where('school_id', $school->id)->findOrFail($id);
        $row->fill(collect($data)->only(['user_id', 'attendance_date', 'status', 'notes'])->all());
        $row->updated_by = $actorId;
        $row->save();

        return $this->attendanceRow($row);
    }

    public function listCourses(array $filters = [], ?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $q = SchoolCourse::query()->where('school_id', $school->id)->orderByDesc('id');
        if (! empty($filters['status'])) {
            $q->where('status', $filters['status']);
        }

        return $q->limit(200)->get()->map(fn ($c) => $this->courseRow($c))->all();
    }

    public function courseStats(?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $base = SchoolCourse::query()->where('school_id', $school->id);

        return ['total' => (int) (clone $base)->count(), 'active' => (int) (clone $base)->where('status', 'active')->count()];
    }

    public function createCourse(array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $row = SchoolCourse::query()->create([
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'code' => $data['code'],
            'title_en' => $data['title_en'],
            'title_ar' => $data['title_ar'] ?? $data['title_en'],
            'subject_id' => $data['subject_id'] ?? null,
            'description' => $data['description'] ?? null,
            'status' => $data['status'] ?? 'active',
            'created_by' => $actorId,
            'updated_by' => $actorId,
        ]);

        return $this->courseRow($row);
    }

    public function updateCourse(int $id, array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $row = SchoolCourse::query()->where('school_id', $school->id)->findOrFail($id);
        $row->fill(collect($data)->only(['code', 'title_en', 'title_ar', 'subject_id', 'description', 'status'])->all());
        $row->updated_by = $actorId;
        $row->save();

        return $this->courseRow($row);
    }

    public function deleteCourse(int $id, ?int $schoolId = null): void
    {
        $school = $this->resolveSchool($schoolId);
        SchoolCourse::query()->where('school_id', $school->id)->whereKey($id)->firstOrFail()->delete();
    }

    public function listLessons(array $filters = [], ?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $q = SchoolLesson::query()->where('school_id', $school->id)->orderBy('sort_order');
        if (! empty($filters['status'])) {
            $q->where('status', $filters['status']);
        }

        return $q->limit(200)->get()->map(function ($l) {
            $course = SchoolCourse::query()->find($l->course_id);

            return [
                'id' => $l->id,
                'course_id' => $l->course_id,
                'course' => $course ? ['title_en' => $course->title_en] : null,
                'title_en' => $l->title_en,
                'title_ar' => $l->title_ar,
                'sort_order' => $l->sort_order,
                'duration_minutes' => $l->duration_minutes,
                'status' => $l->status,
            ];
        })->all();
    }

    public function lessonStats(?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $base = SchoolLesson::query()->where('school_id', $school->id);

        return ['total' => (int) (clone $base)->count(), 'active' => (int) (clone $base)->where('status', 'active')->count()];
    }

    public function createLesson(array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $row = SchoolLesson::query()->create([
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'course_id' => (int) $data['course_id'],
            'title_en' => $data['title_en'],
            'title_ar' => $data['title_ar'] ?? $data['title_en'],
            'sort_order' => (int) ($data['sort_order'] ?? 0),
            'duration_minutes' => $data['duration_minutes'] ?? null,
            'status' => $data['status'] ?? 'active',
            'created_by' => $actorId,
            'updated_by' => $actorId,
        ]);

        return $this->listLessons([], $schoolId)[0] ?? ['id' => $row->id, 'title_en' => $row->title_en, 'status' => $row->status, 'course_id' => $row->course_id, 'sort_order' => $row->sort_order];
    }

    public function updateLesson(int $id, array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $row = SchoolLesson::query()->where('school_id', $school->id)->findOrFail($id);
        $row->fill(collect($data)->only(['course_id', 'title_en', 'title_ar', 'sort_order', 'duration_minutes', 'status'])->all());
        $row->updated_by = $actorId;
        $row->save();

        return ['id' => $row->id, 'course_id' => $row->course_id, 'title_en' => $row->title_en, 'title_ar' => $row->title_ar, 'sort_order' => $row->sort_order, 'duration_minutes' => $row->duration_minutes, 'status' => $row->status];
    }

    public function deleteLesson(int $id, ?int $schoolId = null): void
    {
        $school = $this->resolveSchool($schoolId);
        SchoolLesson::query()->where('school_id', $school->id)->whereKey($id)->firstOrFail()->delete();
    }

    public function listResources(array $filters = [], ?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $q = LearningResource::query()->where('school_id', $school->id)->orderByDesc('id');
        if (! empty($filters['status'])) {
            $q->where('status', $filters['status']);
        }

        return $q->limit(200)->get()->map(fn ($r) => [
            'id' => $r->id, 'title_en' => $r->title_en, 'title_ar' => $r->title_ar, 'resource_type' => $r->resource_type,
            'url' => $r->url, 'subject_id' => $r->subject_id, 'status' => $r->status,
        ])->all();
    }

    public function resourceStats(?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $base = LearningResource::query()->where('school_id', $school->id);

        return ['total' => (int) (clone $base)->count(), 'active' => (int) (clone $base)->where('status', 'active')->count()];
    }

    public function createResource(array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $row = LearningResource::query()->create([
            'tenant_id' => $school->tenant_id, 'school_id' => $school->id,
            'title_en' => $data['title_en'], 'title_ar' => $data['title_ar'] ?? $data['title_en'],
            'resource_type' => $data['resource_type'] ?? 'link', 'url' => $data['url'] ?? null,
            'subject_id' => $data['subject_id'] ?? null, 'status' => $data['status'] ?? 'active',
            'created_by' => $actorId, 'updated_by' => $actorId,
        ]);

        return ['id' => $row->id, 'title_en' => $row->title_en, 'title_ar' => $row->title_ar, 'resource_type' => $row->resource_type, 'url' => $row->url, 'subject_id' => $row->subject_id, 'status' => $row->status];
    }

    public function updateResource(int $id, array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $row = LearningResource::query()->where('school_id', $school->id)->findOrFail($id);
        $row->fill(collect($data)->only(['title_en', 'title_ar', 'resource_type', 'url', 'subject_id', 'status'])->all());
        $row->updated_by = $actorId;
        $row->save();

        return ['id' => $row->id, 'title_en' => $row->title_en, 'title_ar' => $row->title_ar, 'resource_type' => $row->resource_type, 'url' => $row->url, 'subject_id' => $row->subject_id, 'status' => $row->status];
    }

    public function deleteResource(int $id, ?int $schoolId = null): void
    {
        $school = $this->resolveSchool($schoolId);
        LearningResource::query()->where('school_id', $school->id)->whereKey($id)->firstOrFail()->delete();
    }

    // Assignments / homework / questions / assessments / tutoring / finance / reports / notifications / settings
    // continue in same class below for FE compatibility.

    protected function assignmentBase(School $school, string $kind)
    {
        $q = HomeworkAssignment::query()->where('school_id', $school->id);
        if (Schema::hasColumn('assignments', 'assignment_kind')) {
            $q->where('assignment_kind', $kind);
        } elseif ($kind === 'assignment') {
            $q->where('is_scored', true);
        }

        return $q;
    }

    public function listAssignments(array $filters = [], ?int $schoolId = null): array
    {
        return $this->mapAssignments($this->assignmentBase($this->resolveSchool($schoolId), 'assignment'), $filters);
    }

    public function assignmentStats(?int $schoolId = null): array
    {
        $base = $this->assignmentBase($this->resolveSchool($schoolId), 'assignment');

        return ['total' => (int) (clone $base)->count(), 'open' => (int) (clone $base)->whereIn('status', ['draft', 'published', 'open'])->count()];
    }

    public function createAssignment(array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        return $this->storeAssignment($data, 'assignment', true, $schoolId, $actorId);
    }

    public function updateAssignment(int $id, array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        return $this->patchAssignment($id, $data, 'assignment', $schoolId, $actorId);
    }

    public function deleteAssignment(int $id, ?int $schoolId = null): void
    {
        $this->assignmentBase($this->resolveSchool($schoolId), 'assignment')->whereKey($id)->firstOrFail()->delete();
    }

    public function listHomework(array $filters = [], ?int $schoolId = null): array
    {
        return $this->mapAssignments($this->assignmentBase($this->resolveSchool($schoolId), 'homework'), $filters);
    }

    public function homeworkStats(?int $schoolId = null): array
    {
        $base = $this->assignmentBase($this->resolveSchool($schoolId), 'homework');

        return ['total' => (int) (clone $base)->count(), 'open' => (int) (clone $base)->whereIn('status', ['draft', 'published', 'open'])->count()];
    }

    public function createHomework(array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        return $this->storeAssignment($data, 'homework', false, $schoolId, $actorId);
    }

    public function updateHomework(int $id, array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        return $this->patchAssignment($id, $data, 'homework', $schoolId, $actorId);
    }

    public function deleteHomework(int $id, ?int $schoolId = null): void
    {
        $this->assignmentBase($this->resolveSchool($schoolId), 'homework')->whereKey($id)->firstOrFail()->delete();
    }

    protected function mapAssignments($q, array $filters): array
    {
        if (! empty($filters['status'])) {
            $q->where('status', $filters['status']);
        }

        return $q->orderByDesc('id')->limit(200)->get()->map(fn ($r) => [
            'id' => $r->id, 'title_en' => $r->title_en, 'title_ar' => $r->title_ar,
            'due_at' => optional($r->due_at)->toDateString(), 'max_score' => $r->max_score,
            'status' => $r->status, 'subject_id' => $r->subject_id, 'class_section_id' => $r->class_section_id,
            'instructions_en' => $r->instructions_en,
        ])->all();
    }

    protected function storeAssignment(array $data, string $kind, bool $scored, ?int $schoolId, ?int $actorId): array
    {
        $school = $this->resolveSchool($schoolId);
        $payload = [
            'tenant_id' => $school->tenant_id, 'school_id' => $school->id,
            'subject_id' => $data['subject_id'] ?? Subject::query()->where('school_id', $school->id)->value('id') ?: Subject::query()->where('tenant_id', $school->tenant_id)->value('id'),
            'class_section_id' => $data['class_section_id'] ?? null,
            'title_en' => $data['title_en'], 'title_ar' => $data['title_ar'] ?? $data['title_en'],
            'instructions_en' => $data['instructions_en'] ?? null, 'due_at' => $data['due_at'] ?? null,
            'is_scored' => $scored, 'max_score' => $data['max_score'] ?? ($scored ? 100 : null),
            'status' => $data['status'] ?? 'draft', 'created_by' => $actorId, 'updated_by' => $actorId,
        ];
        if (Schema::hasColumn('assignments', 'assignment_kind')) {
            $payload['assignment_kind'] = $kind;
        }
        $row = HomeworkAssignment::query()->create($payload);

        return $this->mapAssignments(HomeworkAssignment::query()->whereKey($row->id), [])[0];
    }

    protected function patchAssignment(int $id, array $data, string $kind, ?int $schoolId, ?int $actorId): array
    {
        $row = $this->assignmentBase($this->resolveSchool($schoolId), $kind)->whereKey($id)->firstOrFail();
        $row->fill(collect($data)->only(['title_en', 'title_ar', 'instructions_en', 'subject_id', 'class_section_id', 'due_at', 'max_score', 'status'])->all());
        $row->updated_by = $actorId;
        $row->save();

        return $this->mapAssignments(HomeworkAssignment::query()->whereKey($row->id), [])[0];
    }

    public function listQuestions(array $filters = [], ?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $q = SchoolQuestion::query()->where('school_id', $school->id)->orderByDesc('id');
        if (! empty($filters['status'])) {
            $q->where('status', $filters['status']);
        }

        return $q->limit(200)->get()->map(fn ($r) => [
            'id' => $r->id, 'stem_en' => $r->stem_en, 'stem_ar' => $r->stem_ar, 'type' => $r->type,
            'difficulty' => $r->difficulty, 'subject_id' => $r->subject_id, 'status' => $r->status,
        ])->all();
    }

    public function questionStats(?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $base = SchoolQuestion::query()->where('school_id', $school->id);

        return ['total' => (int) (clone $base)->count(), 'active' => (int) (clone $base)->where('status', 'active')->count()];
    }

    public function createQuestion(array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $row = SchoolQuestion::query()->create([
            'tenant_id' => $school->tenant_id, 'school_id' => $school->id,
            'stem_en' => $data['stem_en'], 'stem_ar' => $data['stem_ar'] ?? null,
            'type' => $data['type'] ?? 'mcq', 'difficulty' => $data['difficulty'] ?? 'medium',
            'subject_id' => $data['subject_id'] ?? null, 'status' => $data['status'] ?? 'active',
            'created_by' => $actorId, 'updated_by' => $actorId,
        ]);

        return ['id' => $row->id, 'stem_en' => $row->stem_en, 'stem_ar' => $row->stem_ar, 'type' => $row->type, 'difficulty' => $row->difficulty, 'subject_id' => $row->subject_id, 'status' => $row->status];
    }

    public function updateQuestion(int $id, array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $row = SchoolQuestion::query()->where('school_id', $school->id)->findOrFail($id);
        $row->fill(collect($data)->only(['stem_en', 'stem_ar', 'type', 'difficulty', 'subject_id', 'status'])->all());
        $row->updated_by = $actorId;
        $row->save();

        return ['id' => $row->id, 'stem_en' => $row->stem_en, 'stem_ar' => $row->stem_ar, 'type' => $row->type, 'difficulty' => $row->difficulty, 'subject_id' => $row->subject_id, 'status' => $row->status];
    }

    public function deleteQuestion(int $id, ?int $schoolId = null): void
    {
        $school = $this->resolveSchool($schoolId);
        SchoolQuestion::query()->where('school_id', $school->id)->whereKey($id)->firstOrFail()->delete();
    }

    public function listAssessments(string $type, array $filters = [], ?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $q = Assessment::query()->where('school_id', $school->id)->where('type', $type)->orderByDesc('id');
        if (! empty($filters['status'])) {
            $q->where('status', $filters['status']);
        }

        return $q->limit(200)->get()->map(fn ($a) => $this->assessmentRow($a))->all();
    }

    public function assessmentStats(string $type, ?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $base = Assessment::query()->where('school_id', $school->id)->where('type', $type);

        return ['total' => (int) (clone $base)->count(), 'published' => (int) (clone $base)->where('status', 'published')->count()];
    }

    public function createAssessment(string $type, array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $row = Assessment::query()->create([
            'tenant_id' => $school->tenant_id, 'school_id' => $school->id, 'type' => $type,
            'title_en' => $data['title_en'], 'title_ar' => $data['title_ar'] ?? $data['title_en'],
            'subject_id' => $data['subject_id'] ?? Subject::query()->where('school_id', $school->id)->value('id'),
            'term_id' => $data['term_id'] ?? null,
            'time_limit_seconds' => $data['time_limit_seconds'] ?? null,
            'max_attempts' => $data['max_attempts'] ?? 1,
            'status' => $data['status'] ?? 'draft',
            'created_by' => $actorId, 'updated_by' => $actorId,
        ]);

        return $this->assessmentRow($row);
    }

    public function updateAssessment(int $id, array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $row = Assessment::query()->where('school_id', $school->id)->findOrFail($id);
        $row->fill(collect($data)->only(['title_en', 'title_ar', 'subject_id', 'term_id', 'time_limit_seconds', 'max_attempts', 'status'])->all());
        $row->updated_by = $actorId;
        $row->save();

        return $this->assessmentRow($row);
    }

    public function deleteAssessment(int $id, ?int $schoolId = null): void
    {
        $school = $this->resolveSchool($schoolId);
        Assessment::query()->where('school_id', $school->id)->whereKey($id)->firstOrFail()->delete();
    }

    public function listResults(?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $ids = Assessment::query()->where('school_id', $school->id)->pluck('id');
        if ($ids->isEmpty() || ! class_exists(AssessmentAttempt::class)) {
            return [];
        }

        return AssessmentAttempt::query()->whereIn('assessment_id', $ids)->orderByDesc('id')->limit(200)->get()->map(function ($a) {
            $assessment = Assessment::query()->find($a->assessment_id);
            $user = User::query()->find($a->student_user_id ?? $a->user_id ?? null);

            return [
                'id' => $a->id,
                'student_name' => $user ? trim($user->first_name.' '.$user->last_name) ?: $user->email : '—',
                'assessment_title' => $assessment?->title_en ?? 'Assessment',
                'score' => $a->score ?? $a->total_score ?? null,
                'status' => $a->status ?? 'submitted',
            ];
        })->all();
    }

    public function resultStats(?int $schoolId = null): array
    {
        $rows = $this->listResults($schoolId);
        $scores = array_values(array_filter(array_map(fn ($r) => is_numeric($r['score'] ?? null) ? (float) $r['score'] : null, $rows)));

        return [
            'attempts' => count($rows),
            'avg_score' => $scores ? round(array_sum($scores) / count($scores), 1) : 0,
            'passed' => count(array_filter($scores, fn ($s) => $s >= 50)),
        ];
    }

    public function listTutoringTutors(?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);

        return TutorProfile::query()->where('school_id', $school->id)->limit(200)->get()->map(function ($p) {
            $u = User::query()->find($p->user_id);

            return [
                'user_id' => $p->user_id, 'email' => $u?->email, 'first_name' => $u?->first_name, 'last_name' => $u?->last_name,
                'hourly_rate' => $p->hourly_rate ?? null, 'status' => $p->status ?? $u?->status ?? 'active',
            ];
        })->all();
    }

    public function tutoringTutorStats(?int $schoolId = null): array
    {
        $rows = $this->listTutoringTutors($schoolId);

        return ['total' => count($rows), 'active' => count(array_filter($rows, fn ($r) => ($r['status'] ?? '') === 'active'))];
    }

    public function createTutoringTutor(array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);

        return DB::transaction(function () use ($school, $data, $actorId) {
            $user = User::query()->create([
                'tenant_id' => $school->tenant_id, 'email' => strtolower(trim((string) $data['email'])),
                'password' => Hash::make($data['password'] ?? Str::random(16)), 'first_name' => $data['first_name'] ?? 'Tutor',
                'last_name' => $data['last_name'] ?? '', 'status' => 'active', 'email_verified_at' => now(),
                'created_by' => $actorId, 'updated_by' => $actorId,
            ]);
            $this->assignRole($user, $school, 'tutor', $actorId);
            $profile = TutorProfile::query()->create([
                'tenant_id' => $school->tenant_id, 'school_id' => $school->id, 'user_id' => $user->id,
                'hourly_rate' => $data['hourly_rate'] ?? null, 'status' => 'active',
                'created_by' => $actorId, 'updated_by' => $actorId,
            ]);

            return ['user_id' => $user->id, 'email' => $user->email, 'first_name' => $user->first_name, 'last_name' => $user->last_name, 'hourly_rate' => $profile->hourly_rate, 'status' => 'active'];
        });
    }

    public function updateTutoringTutor(int $userId, array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $profile = TutorProfile::query()->where('school_id', $school->id)->where('user_id', $userId)->firstOrFail();
        $user = User::query()->findOrFail($userId);
        if (isset($data['first_name'])) {
            $user->first_name = $data['first_name'];
        }
        if (array_key_exists('last_name', $data)) {
            $user->last_name = $data['last_name'];
        }
        if (! empty($data['status'])) {
            $user->status = $data['status'];
            $profile->status = $data['status'];
        }
        if (array_key_exists('hourly_rate', $data)) {
            $profile->hourly_rate = $data['hourly_rate'];
        }
        $user->updated_by = $actorId;
        $profile->updated_by = $actorId;
        $user->save();
        $profile->save();

        return [
            'user_id' => $user->id,
            'email' => $user->email,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'hourly_rate' => $profile->hourly_rate,
            'status' => $profile->status ?? $user->status,
        ];
    }

    public function listBookings(array $filters = [], ?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $q = TutoringSession::query()->where('school_id', $school->id)->orderByDesc('starts_at');
        if (! empty($filters['status'])) {
            $q->where('status', $filters['status']);
        }

        return $q->limit(200)->get()->map(fn ($s) => $this->bookingRow($s))->all();
    }

    public function bookingStats(?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $base = TutoringSession::query()->where('school_id', $school->id);

        return [
            'total' => (int) (clone $base)->count(),
            'scheduled' => (int) (clone $base)->whereIn('status', ['scheduled', 'confirmed', 'booked'])->count(),
            'completed' => (int) (clone $base)->where('status', 'completed')->count(),
        ];
    }

    public function createBooking(array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $profile = TutorProfile::query()->firstOrCreate(
            ['school_id' => $school->id, 'user_id' => (int) $data['tutor_user_id']],
            ['tenant_id' => $school->tenant_id, 'status' => 'active']
        );
        $session = TutoringSession::query()->create([
            'tenant_id' => $school->tenant_id, 'school_id' => $school->id, 'tutor_profile_id' => $profile->id,
            'subject_id' => $data['subject_id'] ?? null, 'starts_at' => $data['starts_at'],
            'ends_at' => $data['ends_at'] ?? $data['starts_at'], 'status' => $data['status'] ?? 'scheduled',
            'meeting_external_id' => 'student:'.((int) $data['student_user_id']),
            'created_by' => $actorId, 'updated_by' => $actorId,
        ]);

        return $this->bookingRow($session);
    }

    public function updateBooking(int $id, array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $session = TutoringSession::query()->where('school_id', $school->id)->findOrFail($id);
        foreach (['status', 'starts_at', 'ends_at', 'subject_id'] as $k) {
            if (array_key_exists($k, $data)) {
                $session->{$k} = $data[$k];
            }
        }
        if (isset($data['student_user_id'])) {
            $session->meeting_external_id = 'student:'.((int) $data['student_user_id']);
        }
        $session->updated_by = $actorId;
        $session->save();

        return $this->bookingRow($session);
    }

    public function listTimetable(?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);

        return TutoringTimetableSlot::query()->where('school_id', $school->id)->orderBy('day_of_week')->get()
            ->map(fn ($s) => $this->slotRow($s))->all();
    }

    public function timetableStats(?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $base = TutoringTimetableSlot::query()->where('school_id', $school->id);

        return ['total' => (int) (clone $base)->count(), 'active' => (int) (clone $base)->where('status', 'active')->count()];
    }

    public function createTimetableSlot(array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $row = TutoringTimetableSlot::query()->create([
            'tenant_id' => $school->tenant_id, 'school_id' => $school->id,
            'day_of_week' => (int) $data['day_of_week'], 'start_time' => $data['start_time'], 'end_time' => $data['end_time'],
            'tutor_user_id' => (int) $data['tutor_user_id'], 'subject_id' => $data['subject_id'] ?? null,
            'status' => $data['status'] ?? 'active', 'created_by' => $actorId, 'updated_by' => $actorId,
        ]);

        return $this->slotRow($row);
    }

    public function updateTimetableSlot(int $id, array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $row = TutoringTimetableSlot::query()->where('school_id', $school->id)->findOrFail($id);
        $row->fill(collect($data)->only(['day_of_week', 'start_time', 'end_time', 'tutor_user_id', 'subject_id', 'status'])->all());
        $row->updated_by = $actorId;
        $row->save();

        return $this->slotRow($row);
    }

    public function deleteTimetableSlot(int $id, ?int $schoolId = null): void
    {
        $school = $this->resolveSchool($schoolId);
        TutoringTimetableSlot::query()->where('school_id', $school->id)->whereKey($id)->firstOrFail()->delete();
    }

    public function listFees(array $filters = [], ?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $q = StudentInvoice::query()->where('school_id', $school->id)->orderByDesc('id');
        if (! empty($filters['status'])) {
            $q->where('status', $filters['status']);
        }

        return $q->limit(200)->get()->map(fn ($i) => $this->feeRow($i))->all();
    }

    public function feeStats(?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $base = StudentInvoice::query()->where('school_id', $school->id);

        return [
            'total' => (int) (clone $base)->count(),
            'paid' => (int) (clone $base)->where('status', 'paid')->count(),
            'outstanding' => (int) (clone $base)->whereIn('status', ['issued', 'overdue', 'draft'])->count(),
            'collected' => (float) (clone $base)->where('status', 'paid')->sum('total'),
        ];
    }

    public function createFee(array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $row = StudentInvoice::query()->create([
            'tenant_id' => $school->tenant_id, 'school_id' => $school->id,
            'student_user_id' => (int) $data['student_user_id'], 'number' => $data['number'],
            'currency' => $data['currency'] ?? 'SAR', 'subtotal' => (float) $data['total'], 'tax_total' => 0,
            'total' => (float) $data['total'], 'status' => $data['status'] ?? 'issued', 'issued_at' => now(),
            'due_at' => $data['due_at'] ?? null, 'notes' => $data['notes'] ?? null,
            'created_by' => $actorId, 'updated_by' => $actorId,
        ]);

        return $this->feeRow($row);
    }

    public function updateFee(int $id, array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $row = StudentInvoice::query()->where('school_id', $school->id)->findOrFail($id);
        if (isset($data['total'])) {
            $row->total = $row->subtotal = (float) $data['total'];
        }
        $row->fill(collect($data)->only(['number', 'currency', 'due_at', 'notes', 'status', 'student_user_id'])->all());
        if (($data['status'] ?? null) === 'paid' && ! $row->paid_at) {
            $row->paid_at = now();
        }
        $row->updated_by = $actorId;
        $row->save();

        return $this->feeRow($row);
    }

    public function listTutorPayments(array $filters = [], ?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $q = TutorPayment::query()->where('school_id', $school->id)->orderByDesc('id');
        if (! empty($filters['status'])) {
            $q->where('status', $filters['status']);
        }

        return $q->limit(200)->get()->map(fn ($p) => $this->paymentRow($p))->all();
    }

    public function tutorPaymentStats(?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $base = TutorPayment::query()->where('school_id', $school->id);

        return [
            'total' => (int) (clone $base)->count(),
            'paid' => (int) (clone $base)->where('status', 'paid')->count(),
            'pending' => (int) (clone $base)->where('status', 'pending')->count(),
            'amount_paid' => (float) (clone $base)->where('status', 'paid')->sum('amount'),
        ];
    }

    public function createTutorPayment(array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $profile = TutorProfile::query()->firstOrCreate(
            ['school_id' => $school->id, 'user_id' => (int) $data['tutor_user_id']],
            ['tenant_id' => $school->tenant_id, 'status' => 'active']
        );
        $row = TutorPayment::query()->create([
            'tenant_id' => $school->tenant_id, 'school_id' => $school->id, 'tutor_profile_id' => $profile->id,
            'amount' => (float) $data['amount'], 'currency' => $data['currency'] ?? 'SAR',
            'status' => $data['status'] ?? 'pending', 'paid_at' => $data['paid_at'] ?? null,
            'reference' => $data['reference'] ?? null, 'notes' => $data['notes'] ?? null,
            'created_by' => $actorId, 'updated_by' => $actorId,
        ]);

        return $this->paymentRow($row);
    }

    public function updateTutorPayment(int $id, array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $row = TutorPayment::query()->where('school_id', $school->id)->findOrFail($id);
        $row->fill(collect($data)->only(['amount', 'currency', 'status', 'paid_at', 'reference', 'notes'])->all());
        $row->updated_by = $actorId;
        $row->save();

        return $this->paymentRow($row);
    }

    public function listExpenses(array $filters = [], ?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $q = SchoolExpense::query()->where('school_id', $school->id)->orderByDesc('id');
        if (! empty($filters['status'])) {
            $q->where('status', $filters['status']);
        }

        return $q->limit(200)->get()->map(fn ($e) => [
            'id' => $e->id, 'title' => $e->title, 'category' => $e->category, 'amount' => (float) $e->amount,
            'currency' => $e->currency, 'spent_on' => optional($e->spent_on)->toDateString() ?? $e->spent_on,
            'status' => $e->status, 'notes' => $e->notes,
        ])->all();
    }

    public function expenseStats(?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $base = SchoolExpense::query()->where('school_id', $school->id);

        return ['total' => (int) (clone $base)->count(), 'paid' => (int) (clone $base)->where('status', 'paid')->count(), 'amount' => (float) (clone $base)->sum('amount')];
    }

    public function createExpense(array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $row = SchoolExpense::query()->create([
            'tenant_id' => $school->tenant_id, 'school_id' => $school->id, 'category' => $data['category'],
            'title' => $data['title'], 'amount' => (float) $data['amount'], 'currency' => $data['currency'] ?? 'SAR',
            'spent_on' => $data['spent_on'], 'status' => $data['status'] ?? 'pending', 'notes' => $data['notes'] ?? null,
            'created_by' => $actorId, 'updated_by' => $actorId,
        ]);

        return ['id' => $row->id, 'title' => $row->title, 'category' => $row->category, 'amount' => (float) $row->amount, 'currency' => $row->currency, 'spent_on' => $row->spent_on, 'status' => $row->status, 'notes' => $row->notes];
    }

    public function updateExpense(int $id, array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $row = SchoolExpense::query()->where('school_id', $school->id)->findOrFail($id);
        $row->fill(collect($data)->only(['category', 'title', 'amount', 'currency', 'spent_on', 'status', 'notes'])->all());
        $row->updated_by = $actorId;
        $row->save();

        return ['id' => $row->id, 'title' => $row->title, 'category' => $row->category, 'amount' => (float) $row->amount, 'currency' => $row->currency, 'spent_on' => $row->spent_on, 'status' => $row->status, 'notes' => $row->notes];
    }

    public function deleteExpense(int $id, ?int $schoolId = null): void
    {
        $school = $this->resolveSchool($schoolId);
        SchoolExpense::query()->where('school_id', $school->id)->whereKey($id)->firstOrFail()->delete();
    }

    public function financeReport(?int $schoolId = null): array
    {
        $fees = $this->feeStats($schoolId);
        $tutors = $this->tutorPaymentStats($schoolId);
        $expenses = $this->expenseStats($schoolId);
        $collected = (float) $fees['collected'];
        $paid = (float) $tutors['amount_paid'];
        $exp = (float) $expenses['amount'];

        return [
            'kpis' => ['fees_collected' => $collected, 'tutor_payments' => $paid, 'expenses' => $exp, 'net' => $collected - $paid - $exp],
            'rows' => [
                ['category' => 'Student fees collected', 'count' => $fees['paid'], 'amount' => $collected],
                ['category' => 'Tutor payments', 'count' => $tutors['paid'], 'amount' => $paid],
                ['category' => 'Expenses', 'count' => $expenses['total'], 'amount' => $exp],
            ],
            'currency' => 'SAR',
            'generated_at' => now()->toIso8601String(),
        ];
    }

    public function academicReport(?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $students = Enrollment::query()->where('school_id', $school->id)->where('status', 'active')->count();
        $subjects = Subject::query()->where('school_id', $school->id)->count();
        $assessments = Assessment::query()->where('school_id', $school->id)->count();
        $attempts = $this->resultStats($schoolId)['attempts'];

        return [
            'kpis' => ['students' => $students, 'subjects' => $subjects, 'assessments' => $assessments, 'attempts' => $attempts],
            'rows' => [
                ['metric' => 'Active students', 'value' => $students],
                ['metric' => 'Subjects', 'value' => $subjects],
                ['metric' => 'Assessments', 'value' => $assessments],
                ['metric' => 'Attempts', 'value' => $attempts],
            ],
            'currency' => 'SAR',
            'generated_at' => now()->toIso8601String(),
        ];
    }

    public function attendanceReport(?int $schoolId = null): array
    {
        return [
            'kpis' => $this->attendanceStats($schoolId),
            'rows' => [],
            'currency' => 'SAR',
            'generated_at' => now()->toIso8601String(),
        ];
    }

    public function revenueReport(?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $fees = $this->feeStats($schoolId);
        $rows = StudentInvoice::query()->where('school_id', $school->id)
            ->selectRaw('status, COUNT(*) as count, SUM(total) as amount')->groupBy('status')->get()
            ->map(fn ($r) => ['status' => $r->status, 'count' => (int) $r->count, 'amount' => (float) $r->amount])->all();

        return [
            'kpis' => [
                'collected' => $fees['collected'],
                'outstanding' => (float) StudentInvoice::query()->where('school_id', $school->id)->whereIn('status', ['issued', 'overdue'])->sum('total'),
                'invoices' => $fees['total'],
                'paid_invoices' => $fees['paid'],
            ],
            'rows' => $rows,
            'currency' => 'SAR',
            'generated_at' => now()->toIso8601String(),
        ];
    }

    public function performanceReport(?int $schoolId = null): array
    {
        $stats = $this->resultStats($schoolId);
        $school = $this->resolveSchool($schoolId);
        $count = Assessment::query()->where('school_id', $school->id)->count();

        return [
            'kpis' => [
                'attempts' => $stats['attempts'],
                'avg_score' => $stats['avg_score'],
                'pass_rate' => $stats['attempts'] ? round(100 * $stats['passed'] / max(1, $stats['attempts']), 1) : 0,
                'assessments' => $count,
            ],
            'rows' => [],
            'currency' => 'SAR',
            'generated_at' => now()->toIso8601String(),
        ];
    }

    public function listNotifications(?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);

        return SchoolNotification::query()->where('tenant_id', $school->tenant_id)->orderByDesc('id')->limit(200)->get()
            ->map(fn ($n) => [
                'id' => $n->id, 'title' => $n->title, 'body' => $n->body, 'channel' => $n->channel,
                'audience' => $n->audience, 'status' => $n->status, 'sent_at' => optional($n->sent_at)->toIso8601String(),
            ])->all();
    }

    public function notificationStats(?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $base = SchoolNotification::query()->where('tenant_id', $school->tenant_id);

        return ['total' => (int) (clone $base)->count(), 'draft' => (int) (clone $base)->where('status', 'draft')->count(), 'sent' => (int) (clone $base)->where('status', 'sent')->count()];
    }

    public function createNotification(array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $row = SchoolNotification::query()->create([
            'tenant_id' => $school->tenant_id, 'school_id' => $school->id, 'title' => $data['title'], 'body' => $data['body'],
            'channel' => $data['channel'] ?? 'in_app', 'audience' => $data['audience'] ?? 'all', 'status' => 'draft',
            'created_by' => $actorId, 'updated_by' => $actorId,
        ]);

        return ['id' => $row->id, 'title' => $row->title, 'body' => $row->body, 'channel' => $row->channel, 'audience' => $row->audience, 'status' => $row->status, 'sent_at' => null];
    }

    public function sendNotification(int $id, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $row = SchoolNotification::query()->where('tenant_id', $school->tenant_id)->findOrFail($id);
        $row->status = 'sent';
        $row->sent_at = now();
        $row->updated_by = $actorId;
        $row->save();

        return ['id' => $row->id, 'title' => $row->title, 'body' => $row->body, 'channel' => $row->channel, 'audience' => $row->audience, 'status' => $row->status, 'sent_at' => optional($row->sent_at)->toIso8601String()];
    }

    public function listAuditLogs(array $filters = [], ?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $q = AuditLog::query()->where('tenant_id', $school->tenant_id)->orderByDesc('id')->limit(200);
        if (! empty($filters['search'])) {
            $term = '%'.trim((string) $filters['search']).'%';
            $q->where(fn ($sq) => $sq->where('action', 'like', $term)->orWhere('description', 'like', $term));
        }

        return $q->get()->map(function ($log) {
            $actor = isset($log->actor_user_id) ? User::query()->find($log->actor_user_id) : null;

            return [
                'id' => $log->id,
                'action' => $log->action ?? $log->event ?? 'event',
                'actor_email' => $actor?->email,
                'subject_type' => $log->subject_type ?? $log->auditable_type ?? null,
                'created_at' => optional($log->created_at)->toIso8601String(),
                'description' => is_string($log->description ?? null) ? $log->description : null,
            ];
        })->all();
    }

    public function auditStats(?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $base = AuditLog::query()->where('tenant_id', $school->tenant_id);

        return ['total' => (int) (clone $base)->count(), 'today' => (int) (clone $base)->whereDate('created_at', today())->count()];
    }

    public function getOrganisation(?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $tenant = Tenant::query()->findOrFail($school->tenant_id);
        $settings = $this->tenantSettings($tenant);

        return [
            'name' => $tenant->name, 'slug' => $tenant->slug, 'timezone' => $tenant->default_timezone,
            'locale' => $tenant->default_locale, 'contact_email' => $settings['contact_email'] ?? null,
            'status' => $tenant->status, 'plan_code' => null,
        ];
    }

    public function updateOrganisation(array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $tenant = Tenant::query()->findOrFail($school->tenant_id);
        if (isset($data['name'])) {
            $tenant->name = $data['name'];
        }
        if (isset($data['timezone'])) {
            $tenant->default_timezone = $data['timezone'];
        }
        if (isset($data['locale'])) {
            $tenant->default_locale = $data['locale'];
        }
        if (Schema::hasColumn('tenants', 'settings') && array_key_exists('contact_email', $data)) {
            $settings = $this->tenantSettings($tenant);
            $settings['contact_email'] = $data['contact_email'];
            $tenant->settings = $settings;
        }
        $tenant->updated_by = $actorId;
        $tenant->save();

        return $this->getOrganisation($schoolId);
    }

    public function getBranding(?int $schoolId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $tenant = Tenant::query()->findOrFail($school->tenant_id);
        $branding = $this->tenantSettings($tenant)['branding'] ?? [];

        return [
            'primary_color' => $branding['primary_color'] ?? '#0c7c80',
            'secondary_color' => $branding['secondary_color'] ?? '#0a1f2b',
            'logo_url' => $branding['logo_url'] ?? '',
            'favicon_url' => $branding['favicon_url'] ?? '',
            'app_name' => $branding['app_name'] ?? $tenant->name,
        ];
    }

    public function updateBranding(array $data, ?int $schoolId = null, ?int $actorId = null): array
    {
        $school = $this->resolveSchool($schoolId);
        $tenant = Tenant::query()->findOrFail($school->tenant_id);
        $settings = $this->tenantSettings($tenant);
        $settings['branding'] = array_merge($settings['branding'] ?? [], collect($data)->only(['primary_color', 'secondary_color', 'logo_url', 'favicon_url', 'app_name'])->all());
        $tenant->settings = $settings;
        $tenant->updated_by = $actorId;
        $tenant->save();

        return $this->getBranding($schoolId);
    }

    protected function tenantSettings(Tenant $tenant): array
    {
        $raw = $tenant->settings ?? null;
        if (is_array($raw)) {
            return $raw;
        }
        if (is_string($raw) && $raw !== '') {
            return json_decode($raw, true) ?: [];
        }

        return [];
    }

    protected function usersWithRole(School $school, string $roleCode)
    {
        $roleId = Role::query()->where('code', $roleCode)->value('id');
        if (! $roleId) {
            return collect();
        }
        $ids = UserTenantRole::query()->where('tenant_id', $school->tenant_id)->where('role_id', $roleId)->pluck('user_id');

        return User::query()->where('tenant_id', $school->tenant_id)->whereIn('id', $ids)->get();
    }

    protected function assignRole(User $user, School $school, string $roleCode, ?int $actorId = null): void
    {
        $roleId = Role::query()->where('code', $roleCode)->value('id');
        if (! $roleId) {
            return;
        }
        UserTenantRole::query()->firstOrCreate(
            ['user_id' => $user->id, 'tenant_id' => $school->tenant_id, 'role_id' => $roleId],
            ['school_id' => $school->id, 'created_by' => $actorId, 'updated_by' => $actorId]
        );
    }

    protected function staffRow(User $user, string $role): array
    {
        return ['user_id' => $user->id, 'email' => $user->email, 'first_name' => $user->first_name, 'last_name' => $user->last_name, 'role' => $role, 'status' => $user->status];
    }

    protected function attendanceRow(StaffAttendance $row): array
    {
        $user = User::query()->find($row->user_id);

        return [
            'id' => $row->id, 'user_id' => $row->user_id,
            'user_name' => $user ? (trim($user->first_name.' '.$user->last_name) ?: $user->email) : '—',
            'attendance_date' => optional($row->attendance_date)->toDateString() ?? $row->attendance_date,
            'status' => $row->status, 'notes' => $row->notes,
        ];
    }

    protected function courseRow(SchoolCourse $c): array
    {
        $subject = $c->subject_id ? Subject::query()->find($c->subject_id) : null;

        return [
            'id' => $c->id, 'code' => $c->code, 'title_en' => $c->title_en, 'title_ar' => $c->title_ar,
            'subject_id' => $c->subject_id, 'subject' => $subject ? ['name_en' => $subject->name_en] : null,
            'description' => $c->description, 'status' => $c->status,
        ];
    }

    protected function assessmentRow(Assessment $a): array
    {
        return [
            'id' => $a->id, 'title_en' => $a->title_en, 'title_ar' => $a->title_ar, 'type' => $a->type,
            'available_from' => optional($a->available_from)->toDateString(), 'available_until' => optional($a->available_until)->toDateString(),
            'status' => $a->status, 'subject_id' => $a->subject_id, 'time_limit_seconds' => $a->time_limit_seconds, 'max_attempts' => $a->max_attempts,
        ];
    }

    protected function bookingRow(TutoringSession $s): array
    {
        $profile = TutorProfile::query()->find($s->tutor_profile_id);
        $tutor = $profile ? User::query()->find($profile->user_id) : null;
        $studentId = (is_string($s->meeting_external_id) && str_starts_with($s->meeting_external_id, 'student:'))
            ? (int) substr($s->meeting_external_id, 8) : null;
        $student = $studentId ? User::query()->find($studentId) : null;

        return [
            'id' => $s->id, 'tutor_user_id' => $profile?->user_id,
            'tutor_name' => $tutor ? (trim($tutor->first_name.' '.$tutor->last_name) ?: $tutor->email) : '—',
            'student_user_id' => $studentId,
            'student_name' => $student ? (trim($student->first_name.' '.$student->last_name) ?: $student->email) : '—',
            'starts_at' => optional($s->starts_at)->toDateString(), 'ends_at' => optional($s->ends_at)->toDateString(),
            'status' => $s->status, 'subject_id' => $s->subject_id,
        ];
    }

    protected function slotRow(TutoringTimetableSlot $s): array
    {
        $tutor = User::query()->find($s->tutor_user_id);

        return [
            'id' => $s->id, 'day_of_week' => $s->day_of_week, 'day_label' => self::DAYS[(int) $s->day_of_week] ?? 'Day',
            'start_time' => $s->start_time, 'end_time' => $s->end_time, 'tutor_user_id' => $s->tutor_user_id,
            'tutor_name' => $tutor ? (trim($tutor->first_name.' '.$tutor->last_name) ?: $tutor->email) : '—',
            'subject_id' => $s->subject_id, 'status' => $s->status,
        ];
    }

    protected function feeRow(StudentInvoice $i): array
    {
        $student = User::query()->find($i->student_user_id);

        return [
            'id' => $i->id, 'number' => $i->number, 'student_user_id' => $i->student_user_id,
            'student_name' => $student ? (trim($student->first_name.' '.$student->last_name) ?: $student->email) : '—',
            'total' => (float) $i->total, 'currency' => $i->currency,
            'due_at' => optional($i->due_at)->toDateString(), 'status' => $i->status, 'notes' => $i->notes,
        ];
    }

    protected function paymentRow(TutorPayment $p): array
    {
        $profile = TutorProfile::query()->find($p->tutor_profile_id);
        $tutor = $profile ? User::query()->find($profile->user_id) : null;

        return [
            'id' => $p->id, 'tutor_user_id' => $profile?->user_id,
            'tutor_name' => $tutor ? (trim($tutor->first_name.' '.$tutor->last_name) ?: $tutor->email) : '—',
            'amount' => (float) $p->amount, 'currency' => $p->currency,
            'paid_at' => optional($p->paid_at)->toDateString(), 'reference' => $p->reference, 'notes' => $p->notes, 'status' => $p->status,
        ];
    }
}
