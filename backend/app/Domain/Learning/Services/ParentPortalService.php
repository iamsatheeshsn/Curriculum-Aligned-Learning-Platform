<?php

namespace App\Domain\Learning\Services;

use App\Domain\Assessment\Models\AssessmentAttempt;
use App\Domain\Identity\Services\ChildAccessService;
use App\Domain\Learning\Models\HomeworkAssignment;
use App\Domain\Learning\Models\LearningProgress;
use App\Domain\Notification\Services\PortalNotificationService;
use App\Domain\Reporting\Models\Certificate;
use App\Domain\Tutoring\Models\TutoringAttendance;
use App\Domain\Tutoring\Models\TutoringSession;
use App\Models\User;
use App\Services\BaseService;
use App\Support\TenantContext;

class ParentPortalService extends BaseService
{
    public function __construct(
        TenantContext $tenantContext,
        protected ChildAccessService $children,
        protected PortalNotificationService $notifications,
        protected StudentPortalService $studentPortal,
    ) {
        parent::__construct($tenantContext);
    }

    public function dashboard(User $parent, int $schoolId): array
    {
        $kids = $this->children->childrenFor($parent);

        $summaries = $kids->map(function (User $child) use ($schoolId) {
            $progress = LearningProgress::query()
                ->where('student_user_id', $child->id)
                ->where('school_id', $schoolId)
                ->get();

            return [
                'student' => [
                    'id' => $child->id,
                    'first_name' => $child->first_name,
                    'last_name' => $child->last_name,
                    'email' => $child->email,
                ],
                'stats' => [
                    'lessons_completed' => $progress->where('status', 'completed')->count(),
                    'avg_progress_percent' => round((float) $progress->avg('progress_percent'), 1),
                    'homework_pending' => HomeworkAssignment::query()
                        ->where('school_id', $schoolId)
                        ->where('status', 'published')
                        ->whereDoesntHave('submissions', fn ($q) => $q->where('student_user_id', $child->id)->whereIn('status', ['submitted', 'graded']))
                        ->count(),
                    'recent_assessment_score' => AssessmentAttempt::query()
                        ->where('student_user_id', $child->id)
                        ->where('status', 'graded')
                        ->orderByDesc('graded_at')
                        ->value('score'),
                    'upcoming_sessions' => TutoringSession::query()
                        ->where('school_id', $schoolId)
                        ->whereHas('participants', fn ($q) => $q->where('users.id', $child->id))
                        ->whereIn('status', ['scheduled'])
                        ->where('starts_at', '>=', now())
                        ->count(),
                ],
            ];
        })->values()->all();

        return [
            'parent' => [
                'id' => $parent->id,
                'first_name' => $parent->first_name,
                'last_name' => $parent->last_name,
                'email' => $parent->email,
            ],
            'children' => $summaries,
            'unread_notifications' => $this->notifications->unreadCount($parent),
        ];
    }

    public function childProgress(User $parent, int $studentId, int $schoolId): array
    {
        $child = $this->children->assertLinked($parent, $studentId);

        return [
            'student' => $child->only(['id', 'first_name', 'last_name', 'email']),
            'progress' => $this->studentPortal->progressSummary($child, $schoolId),
            'certificates' => Certificate::query()
                ->where('student_user_id', $child->id)
                ->whereNull('voided_at')
                ->orderByDesc('issued_at')
                ->get(),
        ];
    }

    public function childAttendance(User $parent, int $studentId): array
    {
        $this->children->assertLinked($parent, $studentId);

        return TutoringAttendance::query()
            ->where('student_user_id', $studentId)
            ->with(['session:id,starts_at,ends_at,status,subject_id,tutor_profile_id'])
            ->orderByDesc('marked_at')
            ->limit(100)
            ->get()
            ->all();
    }

    public function childHomework(User $parent, int $studentId, int $schoolId): array
    {
        $child = $this->children->assertLinked($parent, $studentId);

        return $this->studentPortal->homework($child, $schoolId);
    }

    public function childAssessmentResults(User $parent, int $studentId): array
    {
        $this->children->assertLinked($parent, $studentId);

        return AssessmentAttempt::query()
            ->where('student_user_id', $studentId)
            ->whereIn('status', ['graded', 'submitted'])
            ->with(['assessment:id,title_en,title_ar,type,show_results', 'responses'])
            ->orderByDesc('submitted_at')
            ->limit(50)
            ->get()
            ->all();
    }

    public function childTutorSessions(User $parent, int $studentId, int $schoolId): array
    {
        $this->children->assertLinked($parent, $studentId);

        return TutoringSession::query()
            ->where('school_id', $schoolId)
            ->whereHas('participants', fn ($q) => $q->where('users.id', $studentId))
            ->with(['tutor.user:id,first_name,last_name', 'subject:id,code,name_en,name_ar', 'attendanceRecords'])
            ->orderByDesc('starts_at')
            ->limit(50)
            ->get()
            ->all();
    }
}
