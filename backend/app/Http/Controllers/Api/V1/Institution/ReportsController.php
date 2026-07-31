<?php

namespace App\Http\Controllers\Api\V1\Institution;

use App\Domain\Academics\Models\Subject;
use App\Domain\Academics\Services\SchoolContextService;
use App\Domain\Curriculum\Models\Curriculum;
use App\Domain\Identity\Services\RbacService;
use App\Domain\Reporting\Services\AnalyticsReportService;
use App\Domain\Tutoring\Models\TutorProfile;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportsController extends Controller
{
    public function __construct(
        protected SchoolContextService $schoolContext,
        protected AnalyticsReportService $reports,
        protected RbacService $rbac,
    ) {}

    public function meta(Request $request): JsonResponse
    {
        $this->authorizeAnyReport($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $students = User::query()
            ->where('tenant_id', $school->tenant_id)
            ->whereHas('tenantRoles.role', fn ($q) => $q->where('code', 'student'))
            ->orderBy('first_name')
            ->orderBy('last_name')
            ->limit(250)
            ->get(['id', 'first_name', 'last_name', 'email'])
            ->map(fn (User $u) => [
                'id' => $u->id,
                'name' => trim(($u->first_name ?? '').' '.($u->last_name ?? '')),
                'email' => $u->email,
            ])
            ->values();

        $subjects = Subject::query()
            ->where('school_id', $school->id)
            ->orderBy('name_en')
            ->get(['id', 'code', 'name_en', 'status'])
            ->map(fn (Subject $s) => [
                'id' => $s->id,
                'code' => $s->code,
                'name' => $s->name_en,
                'status' => $s->status,
            ])
            ->values();

        $curricula = Curriculum::query()
            ->where('school_id', $school->id)
            ->orderByDesc('updated_at')
            ->get(['id', 'code', 'name_en', 'version', 'status'])
            ->map(fn (Curriculum $c) => [
                'id' => $c->id,
                'code' => $c->code,
                'name' => $c->name_en,
                'version' => $c->version,
                'status' => $c->status,
            ])
            ->values();

        $tutors = TutorProfile::query()
            ->where('school_id', $school->id)
            ->with('user:id,first_name,last_name,email')
            ->orderBy('id')
            ->get()
            ->map(function (TutorProfile $t) {
                $user = $t->user;

                return [
                    'id' => $t->id,
                    'name' => $user
                        ? trim(($user->first_name ?? '').' '.($user->last_name ?? ''))
                        : "Tutor #{$t->id}",
                    'email' => $user?->email,
                    'status' => $t->status,
                ];
            })
            ->values();

        return response()->json([
            'data' => [
                'school' => [
                    'id' => $school->id,
                    'name_en' => $school->name_en,
                    'code' => $school->code,
                ],
                'students' => $students,
                'subjects' => $subjects,
                'curricula' => $curricula,
                'tutors' => $tutors,
            ],
        ]);
    }

    public function student(Request $request): JsonResponse
    {
        $this->authorizeAcademic($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $data = $request->validate(['student_user_id' => ['required', 'integer']]);

        return response()->json([
            'data' => $this->reports->studentReport($school, $data['student_user_id']),
        ]);
    }

    public function teacher(Request $request): JsonResponse
    {
        $this->authorizeAcademic($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        return response()->json([
            'data' => $this->reports->teacherReport($school, $request->integer('subject_id') ?: null),
        ]);
    }

    public function tutorPerformance(Request $request): JsonResponse
    {
        $this->authorizeTutorOrAcademic($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        return response()->json([
            'data' => $this->reports->tutorPerformance($school, $request->integer('tutor_profile_id') ?: null),
        ]);
    }

    public function school(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! ($this->rbac->can($user, 'school.reports.view') || $this->rbac->can($user, 'reports.academic.view'))) {
            $this->rbac->authorize($user, 'school.reports.view');
        }
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        return response()->json(['data' => $this->reports->schoolAnalytics($school)]);
    }

    public function curriculumCompletion(Request $request): JsonResponse
    {
        $this->authorizeAcademic($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        return response()->json([
            'data' => $this->reports->curriculumCompletion($school, $request->integer('curriculum_id') ?: null),
        ]);
    }

    public function learningOutcomes(Request $request): JsonResponse
    {
        $this->authorizeAcademic($request);
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        return response()->json([
            'data' => $this->reports->learningOutcomeReport($school, $request->integer('curriculum_id') ?: null),
        ]);
    }

    private function authorizeAcademic(Request $request): void
    {
        $user = $request->user();
        if ($this->rbac->can($user, 'reports.academic.view') || $this->rbac->can($user, 'school.reports.view')) {
            return;
        }
        $this->rbac->authorize($user, 'reports.academic.view');
    }

    private function authorizeTutorOrAcademic(Request $request): void
    {
        $user = $request->user();
        if (
            $this->rbac->can($user, 'reports.tutor.view')
            || $this->rbac->can($user, 'reports.academic.view')
            || $this->rbac->can($user, 'school.reports.view')
        ) {
            return;
        }
        $this->rbac->authorize($user, 'reports.tutor.view');
    }

    private function authorizeAnyReport(Request $request): void
    {
        $user = $request->user();
        if (
            $this->rbac->can($user, 'school.reports.view')
            || $this->rbac->can($user, 'reports.academic.view')
            || $this->rbac->can($user, 'reports.tutor.view')
        ) {
            return;
        }
        $this->rbac->authorize($user, 'school.reports.view');
    }
}
