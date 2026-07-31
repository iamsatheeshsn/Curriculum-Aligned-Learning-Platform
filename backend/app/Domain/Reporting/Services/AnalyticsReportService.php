<?php

namespace App\Domain\Reporting\Services;

use App\Domain\Academics\Models\Subject;
use App\Domain\Assessment\Models\AssessmentAttempt;
use App\Domain\Curriculum\Models\Curriculum;
use App\Domain\Curriculum\Models\LearningOutcome;
use App\Domain\Learning\Models\LearningProgress;
use App\Domain\Organization\Models\School;
use App\Domain\Tutoring\Models\TutorProfile;
use App\Domain\Tutoring\Models\TutoringAttendance;
use App\Domain\Tutoring\Models\TutoringSession;
use App\Models\User;
use App\Services\BaseService;
use App\Support\TenantContext;
use Illuminate\Support\Facades\DB;

class AnalyticsReportService extends BaseService
{
    public function __construct(TenantContext $tenantContext)
    {
        parent::__construct($tenantContext);
    }

    public function studentReport(School $school, int $studentId): array
    {
        $student = User::query()->where('tenant_id', $school->tenant_id)->findOrFail($studentId);

        $progress = LearningProgress::query()
            ->where('school_id', $school->id)
            ->where('student_user_id', $studentId)
            ->with('lesson:id,title_en,title_ar')
            ->get();

        $attempts = AssessmentAttempt::query()
            ->where('student_user_id', $studentId)
            ->whereIn('status', ['graded', 'submitted'])
            ->with('assessment:id,title_en,type,subject_id,counts_toward_grade')
            ->orderByDesc('submitted_at')
            ->limit(100)
            ->get();

        $attendance = TutoringAttendance::query()
            ->where('student_user_id', $studentId)
            ->select('status', DB::raw('COUNT(*) as total'))
            ->groupBy('status')
            ->pluck('total', 'status');

        return [
            'student' => $student->only(['id', 'first_name', 'last_name', 'email']),
            'learning' => [
                'lessons_started' => $progress->count(),
                'lessons_completed' => $progress->where('status', 'completed')->count(),
                'avg_progress_percent' => round((float) $progress->avg('progress_percent'), 1),
                'records' => $progress,
            ],
            'assessments' => [
                'attempts' => $attempts->count(),
                'avg_score' => round((float) $attempts->where('status', 'graded')->avg('score'), 2),
                'records' => $attempts,
            ],
            'tutoring_attendance' => $attendance,
        ];
    }

    public function teacherReport(School $school, ?int $subjectId = null): array
    {
        $attempts = AssessmentAttempt::query()
            ->whereHas('assessment', function ($q) use ($school, $subjectId) {
                $q->where('school_id', $school->id)
                    ->when($subjectId, fn ($qq) => $qq->where('subject_id', $subjectId));
            })
            ->where('status', 'graded')
            ->with('assessment:id,title_en,type,subject_id,class_section_id')
            ->get();

        $byAssessment = $attempts->groupBy('assessment_id')->map(function ($rows) {
            $first = $rows->first()->assessment;

            return [
                'assessment_id' => $first?->id,
                'title_en' => $first?->title_en,
                'type' => $first?->type,
                'attempts' => $rows->count(),
                'avg_score' => round((float) $rows->avg('score'), 2),
                'max_score' => round((float) $rows->avg('max_score'), 2),
            ];
        })->values();

        $homeworkSubmissions = DB::table('assignment_submissions as s')
            ->join('assignments as a', 'a.id', '=', 's.assignment_id')
            ->where('a.school_id', $school->id)
            ->whereNull('a.deleted_at')
            ->when($subjectId, fn ($q) => $q->where('a.subject_id', $subjectId))
            ->selectRaw("s.status, COUNT(*) as total")
            ->groupBy('s.status')
            ->pluck('total', 'status');

        return [
            'graded_assessments' => $byAssessment,
            'homework_submissions' => $homeworkSubmissions,
            'class_avg_score' => round((float) $attempts->avg('score'), 2),
        ];
    }

    public function tutorPerformance(School $school, ?int $tutorProfileId = null): array
    {
        $sessions = TutoringSession::query()
            ->where('school_id', $school->id)
            ->when($tutorProfileId, fn ($q) => $q->where('tutor_profile_id', $tutorProfileId))
            ->get();

        $byTutor = $sessions->groupBy('tutor_profile_id')->map(function ($rows, $tutorId) {
            $completed = $rows->where('status', 'completed');
            $cancelled = $rows->where('status', 'cancelled');
            $hours = $completed->sum(fn ($s) => max(0, $s->starts_at->diffInMinutes($s->ends_at)) / 60);

            $attendancePresent = TutoringAttendance::query()
                ->whereIn('tutoring_session_id', $completed->pluck('id'))
                ->where('status', 'present')
                ->count();

            $avgRating = DB::table('tutoring_session_ratings')
                ->where('tutor_profile_id', $tutorId)
                ->whereNull('deleted_at')
                ->avg('rating');

            $profile = TutorProfile::query()->with('user:id,first_name,last_name')->find($tutorId);

            return [
                'tutor_profile_id' => (int) $tutorId,
                'tutor_name' => trim(($profile?->user?->first_name ?? '').' '.($profile?->user?->last_name ?? '')),
                'sessions_total' => $rows->count(),
                'sessions_completed' => $completed->count(),
                'sessions_cancelled' => $cancelled->count(),
                'hours_completed' => round($hours, 2),
                'attendance_present' => $attendancePresent,
                'avg_rating' => $avgRating !== null ? round((float) $avgRating, 2) : null,
            ];
        })->values();

        return ['tutors' => $byTutor];
    }

    public function schoolAnalytics(School $school): array
    {
        $tenantId = $school->tenant_id;

        return [
            'enrollment_students' => DB::table('user_tenant_roles as utr')
                ->join('roles as r', 'r.id', '=', 'utr.role_id')
                ->where('utr.tenant_id', $tenantId)
                ->where('r.code', 'student')
                ->distinct('utr.user_id')
                ->count('utr.user_id'),
            'subjects_active' => Subject::query()->where('school_id', $school->id)->where('status', 'active')->count(),
            'lessons_completed' => LearningProgress::query()->where('school_id', $school->id)->where('status', 'completed')->count(),
            'avg_lesson_progress' => round((float) LearningProgress::query()->where('school_id', $school->id)->avg('progress_percent'), 1),
            'assessments_graded' => AssessmentAttempt::query()
                ->whereHas('assessment', fn ($q) => $q->where('school_id', $school->id))
                ->where('status', 'graded')
                ->count(),
            'tutoring_sessions_completed' => TutoringSession::query()->where('school_id', $school->id)->where('status', 'completed')->count(),
            'tutoring_hours' => round((float) TutoringSession::query()
                ->where('school_id', $school->id)
                ->where('status', 'completed')
                ->get()
                ->sum(fn ($s) => max(0, $s->starts_at->diffInMinutes($s->ends_at)) / 60), 2),
            'curricula_published' => Curriculum::query()->where('school_id', $school->id)->where('status', 'published')->count(),
        ];
    }

    public function curriculumCompletion(School $school, ?int $curriculumId = null): array
    {
        $curricula = Curriculum::query()
            ->where('school_id', $school->id)
            ->when($curriculumId, fn ($q) => $q->where('id', $curriculumId))
            ->whereIn('status', ['published', 'superseded', 'draft'])
            ->withCount(['chapters', 'lessons', 'subjects'])
            ->get();

        return $curricula->map(function (Curriculum $c) use ($school) {
            $interactiveLinked = DB::table('interactive_lessons as il')
                ->join('curriculum_lessons as cl', 'cl.id', '=', 'il.curriculum_lesson_id')
                ->where('il.school_id', $school->id)
                ->where('cl.curriculum_id', $c->id)
                ->where('il.status', 'published')
                ->whereNull('il.deleted_at')
                ->count();

            $completed = DB::table('learning_progress as lp')
                ->join('interactive_lessons as il', 'il.id', '=', 'lp.interactive_lesson_id')
                ->join('curriculum_lessons as cl', 'cl.id', '=', 'il.curriculum_lesson_id')
                ->where('lp.school_id', $school->id)
                ->where('cl.curriculum_id', $c->id)
                ->where('lp.status', 'completed')
                ->whereNull('lp.deleted_at')
                ->distinct('lp.interactive_lesson_id')
                ->count('lp.interactive_lesson_id');

            $lessonCount = max(1, (int) $c->lessons_count);

            return [
                'curriculum_id' => $c->id,
                'code' => $c->code,
                'version' => $c->version,
                'status' => $c->status,
                'subjects' => $c->subjects_count,
                'chapters' => $c->chapters_count,
                'curriculum_lessons' => $c->lessons_count,
                'interactive_published' => $interactiveLinked,
                'lessons_with_completions' => $completed,
                'completion_rate_percent' => round(($completed / $lessonCount) * 100, 1),
            ];
        })->values()->all();
    }

    public function learningOutcomeReport(School $school, ?int $curriculumId = null): array
    {
        $outcomes = LearningOutcome::query()
            ->where('school_id', $school->id)
            ->when($curriculumId, fn ($q) => $q->where('curriculum_id', $curriculumId))
            ->withCount('lessons')
            ->get();

        // Approximate mastery: share of graded attempt responses linked via question_outcomes that are correct
        $mastery = DB::table('question_outcomes as qo')
            ->join('assessment_responses as ar', 'ar.question_id', '=', 'qo.question_id')
            ->join('assessment_attempts as aa', 'aa.id', '=', 'ar.attempt_id')
            ->join('assessments as a', 'a.id', '=', 'aa.assessment_id')
            ->where('a.school_id', $school->id)
            ->where('aa.status', 'graded')
            ->whereNull('aa.deleted_at')
            ->selectRaw('qo.learning_outcome_id, COUNT(*) as responses, SUM(CASE WHEN ar.is_correct = 1 THEN 1 ELSE 0 END) as correct')
            ->groupBy('qo.learning_outcome_id')
            ->get()
            ->keyBy('learning_outcome_id');

        return $outcomes->map(function (LearningOutcome $lo) use ($mastery) {
            $row = $mastery[$lo->id] ?? null;
            $responses = (int) ($row->responses ?? 0);
            $correct = (int) ($row->correct ?? 0);

            return [
                'id' => $lo->id,
                'code' => $lo->code,
                'statement_en' => $lo->statement_en,
                'statement_ar' => $lo->statement_ar,
                'curriculum_id' => $lo->curriculum_id,
                'linked_lessons' => $lo->lessons_count,
                'assessment_responses' => $responses,
                'correct_responses' => $correct,
                'mastery_percent' => $responses > 0 ? round(($correct / $responses) * 100, 1) : null,
            ];
        })->values()->all();
    }
}
