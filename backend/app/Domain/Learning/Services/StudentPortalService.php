<?php

namespace App\Domain\Learning\Services;

use App\Domain\Academics\Models\Subject;
use App\Domain\Assessment\Models\Assessment;
use App\Domain\Assessment\Models\AssessmentAttempt;
use App\Domain\Learning\Models\HomeworkAssignment;
use App\Domain\Learning\Models\AssignmentSubmission;
use App\Domain\Learning\Models\InteractiveLesson;
use App\Domain\Learning\Models\LearningProgress;
use App\Domain\Learning\Models\LessonAssignment;
use App\Domain\Notification\Services\PortalNotificationService;
use App\Domain\Reporting\Models\Certificate;
use App\Domain\Tutoring\Models\TutoringSession;
use App\Models\User;
use App\Services\BaseService;
use App\Support\TenantContext;

class StudentPortalService extends BaseService
{
    public function __construct(
        TenantContext $tenantContext,
        protected PortalNotificationService $notifications,
    ) {
        parent::__construct($tenantContext);
    }

    public function dashboard(User $student, int $schoolId): array
    {
        $lessonIds = $this->assignedLessonIds($student->id, $schoolId);

        $progress = LearningProgress::query()
            ->where('student_user_id', $student->id)
            ->where('school_id', $schoolId)
            ->get();

        $completedLessons = $progress->where('status', 'completed')->count();
        $inProgressLessons = $progress->where('status', 'in_progress')->count();

        $homeworkOpen = HomeworkAssignment::query()
            ->where('school_id', $schoolId)
            ->where('status', 'published')
            ->whereDoesntHave('submissions', fn ($q) => $q->where('student_user_id', $student->id)->whereIn('status', ['submitted', 'graded']))
            ->count();

        $assessmentsAvailable = Assessment::query()
            ->where('school_id', $schoolId)
            ->where('status', 'published')
            ->count();

        $upcomingSessions = TutoringSession::query()
            ->where('school_id', $schoolId)
            ->whereHas('participants', fn ($q) => $q->where('users.id', $student->id))
            ->whereIn('status', ['scheduled', 'in_progress'])
            ->where('starts_at', '>=', now()->subHour())
            ->orderBy('starts_at')
            ->limit(5)
            ->with(['tutor.user:id,first_name,last_name', 'subject:id,code,name_en,name_ar'])
            ->get();

        return [
            'student' => [
                'id' => $student->id,
                'first_name' => $student->first_name,
                'last_name' => $student->last_name,
                'email' => $student->email,
                'locale' => $student->locale,
            ],
            'stats' => [
                'assigned_lessons' => $lessonIds->count(),
                'lessons_completed' => $completedLessons,
                'lessons_in_progress' => $inProgressLessons,
                'homework_open' => $homeworkOpen,
                'assessments_available' => $assessmentsAvailable,
                'certificates' => Certificate::query()
                    ->where('student_user_id', $student->id)
                    ->whereNull('voided_at')
                    ->count(),
                'unread_notifications' => $this->notifications->unreadCount($student),
            ],
            'upcoming_tutoring' => $upcomingSessions,
            'recent_progress' => $progress->sortByDesc('updated_at')->take(5)->values(),
        ];
    }

    public function courses(User $student, int $schoolId): array
    {
        $subjects = Subject::query()
            ->where('school_id', $schoolId)
            ->where('status', 'active')
            ->orderBy('code')
            ->get();

        $progressByLesson = LearningProgress::query()
            ->where('student_user_id', $student->id)
            ->where('school_id', $schoolId)
            ->get()
            ->keyBy('interactive_lesson_id');

        $published = InteractiveLesson::query()
            ->where('school_id', $schoolId)
            ->where('status', 'published')
            ->with('curriculumLesson.chapter')
            ->get();

        return $subjects->map(function (Subject $subject) use ($published, $progressByLesson) {
            $lessons = $published->filter(function (InteractiveLesson $lesson) use ($subject) {
                $chapterSubjectId = $lesson->curriculumLesson?->chapter?->subject_id;
                if ($chapterSubjectId === null) {
                    return false;
                }

                return (int) $chapterSubjectId === (int) $subject->id;
            });

            $total = $lessons->count();
            $completed = $lessons->filter(
                fn ($l) => ($progressByLesson[$l->id]->status ?? null) === 'completed'
            )->count();

            return [
                'id' => $subject->id,
                'code' => $subject->code,
                'name_en' => $subject->name_en,
                'name_ar' => $subject->name_ar,
                'is_stem' => (bool) $subject->is_stem,
                'lessons_total' => $total,
                'lessons_completed' => $completed,
                'progress_percent' => $total > 0 ? round(($completed / $total) * 100, 1) : 0.0,
            ];
        })->values()->all();
    }

    public function lessons(User $student, int $schoolId): array
    {
        $lessonIds = $this->assignedLessonIds($student->id, $schoolId);

        $lessons = InteractiveLesson::query()
            ->where('school_id', $schoolId)
            ->where('status', 'published')
            ->when($lessonIds->isNotEmpty(), fn ($q) => $q->whereIn('id', $lessonIds))
            ->with(['blocks:id,interactive_lesson_id,block_type,sequence', 'curriculumLesson:id,title_en,title_ar,chapter_id'])
            ->orderByDesc('id')
            ->get();

        $progress = LearningProgress::query()
            ->where('student_user_id', $student->id)
            ->whereIn('interactive_lesson_id', $lessons->pluck('id'))
            ->get()
            ->keyBy('interactive_lesson_id');

        return $lessons->map(fn (InteractiveLesson $lesson) => [
            'lesson' => $lesson,
            'progress' => $progress[$lesson->id] ?? null,
        ])->values()->all();
    }

    public function homework(User $student, int $schoolId): array
    {
        $items = HomeworkAssignment::query()
            ->where('school_id', $schoolId)
            ->where('status', 'published')
            ->orderByDesc('due_at')
            ->get();

        $subs = AssignmentSubmission::query()
            ->where('student_user_id', $student->id)
            ->whereIn('assignment_id', $items->pluck('id'))
            ->get()
            ->keyBy('assignment_id');

        return $items->map(fn (HomeworkAssignment $hw) => [
            'homework' => $hw,
            'submission' => $subs[$hw->id] ?? null,
        ])->values()->all();
    }

    public function assessments(User $student, int $schoolId): array
    {
        $available = Assessment::query()
            ->where('school_id', $schoolId)
            ->where('status', 'published')
            ->orderByDesc('id')
            ->get(['id', 'type', 'title_en', 'title_ar', 'available_from', 'available_until', 'max_attempts', 'time_limit_seconds']);

        $attempts = AssessmentAttempt::query()
            ->where('student_user_id', $student->id)
            ->whereIn('assessment_id', $available->pluck('id'))
            ->orderByDesc('id')
            ->get()
            ->groupBy('assessment_id');

        return $available->map(fn (Assessment $a) => [
            'assessment' => $a,
            'attempts' => $attempts[$a->id] ?? collect(),
        ])->values()->all();
    }

    public function progressSummary(User $student, int $schoolId): array
    {
        $learning = LearningProgress::query()
            ->where('student_user_id', $student->id)
            ->where('school_id', $schoolId)
            ->with('lesson:id,title_en,title_ar')
            ->orderByDesc('updated_at')
            ->get();

        $attempts = AssessmentAttempt::query()
            ->where('student_user_id', $student->id)
            ->whereIn('status', ['graded', 'submitted'])
            ->with('assessment:id,title_en,title_ar,type,counts_toward_grade')
            ->orderByDesc('submitted_at')
            ->limit(50)
            ->get();

        return [
            'learning' => $learning,
            'assessments' => $attempts,
            'avg_lesson_progress' => round((float) $learning->avg('progress_percent'), 1),
        ];
    }

    /** @return \Illuminate\Support\Collection<int, int> */
    private function assignedLessonIds(int $studentId, int $schoolId)
    {
        return LessonAssignment::query()
            ->where('school_id', $schoolId)
            ->where(function ($q) use ($studentId) {
                $q->where('student_user_id', $studentId)->orWhereNotNull('class_section_id');
            })
            ->pluck('interactive_lesson_id')
            ->unique()
            ->values();
    }
}
