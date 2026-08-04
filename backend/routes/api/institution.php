<?php

use App\Http\Controllers\Api\V1\Institution\AcademicCalendarController;
use App\Http\Controllers\Api\V1\Institution\AssessmentController;
use App\Http\Controllers\Api\V1\Institution\BillingController;
use App\Http\Controllers\Api\V1\Institution\CampusController;
use App\Http\Controllers\Api\V1\Institution\CertificateController;
use App\Http\Controllers\Api\V1\Institution\ClassSectionController;
use App\Http\Controllers\Api\V1\Institution\CurriculumController;
use App\Http\Controllers\Api\V1\Institution\DashboardController;
use App\Http\Controllers\Api\V1\Institution\GradingController;
use App\Http\Controllers\Api\V1\Institution\HomeworkController;
use App\Http\Controllers\Api\V1\Institution\InteractiveLessonController;
use App\Http\Controllers\Api\V1\Institution\NotificationEngineController;
use App\Http\Controllers\Api\V1\Institution\ParentLinkController;
use App\Http\Controllers\Api\V1\Institution\QuestionBankController;
use App\Http\Controllers\Api\V1\Institution\ReportsController;
use App\Http\Controllers\Api\V1\Institution\ResourceLibraryController;
use App\Http\Controllers\Api\V1\Institution\SchoolController;
use App\Http\Controllers\Api\V1\Institution\SubjectController;
use App\Http\Controllers\Api\V1\Institution\TeacherAcademicsController;
use App\Http\Controllers\Api\V1\Institution\TeacherPortalController;
use App\Http\Controllers\Api\V1\Institution\TeacherWorkspaceController;
use App\Http\Controllers\Api\V1\Institution\TimetableController;
use App\Http\Controllers\Api\V1\Institution\TutorAvailabilityController;
use App\Http\Controllers\Api\V1\Institution\TutorPortalController;
use App\Http\Controllers\Api\V1\Institution\TutorProfileController;
use App\Http\Controllers\Api\V1\Institution\TutoringSessionController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'tenant.isolation', 'subscription.active'])->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'home']);
    Route::get('/teacher/workspace', [TeacherWorkspaceController::class, 'home']);
    Route::post('/teacher/homework', [TeacherWorkspaceController::class, 'storeHomework']);
    Route::post('/teacher/availability', [TeacherWorkspaceController::class, 'storeAvailability']);

    Route::get('/teacher/students', [TutorPortalController::class, 'students']);
    Route::get('/teacher/session-notes', [TutorPortalController::class, 'sessionNotes']);
    Route::post('/teacher/session-notes', [TutorPortalController::class, 'storeSessionNote']);
    Route::get('/teacher/earnings', [TutorPortalController::class, 'earnings']);
    Route::get('/teacher/notifications', [TutorPortalController::class, 'notifications']);
    Route::post('/teacher/notifications/{id}/read', [TutorPortalController::class, 'markNotificationRead']);
    Route::post('/teacher/notifications/read-all', [TutorPortalController::class, 'markAllNotificationsRead']);
    Route::get('/teacher/profile', [TutorPortalController::class, 'profile']);
    Route::put('/teacher/profile', [TutorPortalController::class, 'updateProfile']);
    Route::get('/teacher/student-progress', [TutorPortalController::class, 'studentProgress']);

    // Teacher portal — shared context
    Route::get('/teacher/context', [TeacherPortalController::class, 'context']);

    // Teacher portal — lesson plans
    Route::get('/teacher/lesson-plans', [TeacherPortalController::class, 'lessonPlans']);
    Route::post('/teacher/lesson-plans', [TeacherPortalController::class, 'storeLessonPlan']);
    Route::put('/teacher/lesson-plans/{plan}', [TeacherPortalController::class, 'updateLessonPlan']);
    Route::delete('/teacher/lesson-plans/{plan}', [TeacherPortalController::class, 'destroyLessonPlan']);
    Route::post('/teacher/lesson-plans/{plan}/duplicate', [TeacherPortalController::class, 'duplicateLessonPlan']);

    // Teacher portal — course content
    Route::get('/teacher/course-content', [TeacherPortalController::class, 'courseContent']);

    // Teacher portal — resources
    Route::get('/teacher/resources', [TeacherPortalController::class, 'resources']);
    Route::post('/teacher/resources', [TeacherPortalController::class, 'storeResource']);
    Route::put('/teacher/resources/{asset}', [TeacherPortalController::class, 'updateResource']);
    Route::delete('/teacher/resources/{asset}', [TeacherPortalController::class, 'destroyResource']);

    // Teacher portal — messages
    Route::get('/teacher/messages', [TeacherPortalController::class, 'messages']);
    Route::get('/teacher/messages/recipients', [TeacherPortalController::class, 'messageRecipients']);
    Route::post('/teacher/messages', [TeacherPortalController::class, 'storeMessage']);
    Route::post('/teacher/messages/read-all', [TeacherPortalController::class, 'markAllMessagesRead']);
    Route::post('/teacher/messages/{message}/read', [TeacherPortalController::class, 'markMessageRead']);
    Route::delete('/teacher/messages/{message}', [TeacherPortalController::class, 'destroyMessage']);

    // Teacher portal — homework & assignments
    Route::get('/teacher/assignments', [TeacherAcademicsController::class, 'assignments']);
    Route::post('/teacher/assignments', [TeacherAcademicsController::class, 'storeAssignment']);
    Route::put('/teacher/assignments/{assignment}', [TeacherAcademicsController::class, 'updateAssignment']);
    Route::delete('/teacher/assignments/{assignment}', [TeacherAcademicsController::class, 'destroyAssignment']);
    Route::get('/teacher/assignments/{assignment}/submissions', [TeacherAcademicsController::class, 'assignmentSubmissions']);
    Route::post('/teacher/assignments/{assignment}/submissions/{submission}/grade', [TeacherAcademicsController::class, 'gradeSubmission']);

    // Teacher portal — quizzes & exams
    Route::get('/teacher/assessments', [TeacherAcademicsController::class, 'assessments']);
    Route::post('/teacher/assessments', [TeacherAcademicsController::class, 'storeAssessment']);
    Route::put('/teacher/assessments/{assessment}', [TeacherAcademicsController::class, 'updateAssessment']);
    Route::delete('/teacher/assessments/{assessment}', [TeacherAcademicsController::class, 'destroyAssessment']);
    Route::post('/teacher/assessments/{assessment}/publish', [TeacherAcademicsController::class, 'publishAssessment']);

    // Teacher portal — attendance, grade book, progress
    Route::get('/teacher/attendance', [TeacherAcademicsController::class, 'attendance']);
    Route::post('/teacher/attendance', [TeacherAcademicsController::class, 'storeAttendance']);
    Route::get('/teacher/grade-book', [TeacherAcademicsController::class, 'gradeBook']);
    Route::get('/teacher/class-progress', [TeacherAcademicsController::class, 'classProgress']);

    // Schools
    Route::get('/schools', [SchoolController::class, 'index']);
    Route::post('/schools', [SchoolController::class, 'store']);
    Route::get('/schools/{school}', [SchoolController::class, 'show']);
    Route::put('/schools/{school}', [SchoolController::class, 'update']);
    Route::delete('/schools/{school}', [SchoolController::class, 'destroy']);

    // Campuses
    Route::get('/campuses', [CampusController::class, 'index']);
    Route::post('/campuses', [CampusController::class, 'store']);
    Route::put('/campuses/{campus}', [CampusController::class, 'update']);
    Route::delete('/campuses/{campus}', [CampusController::class, 'destroy']);

    // Grades / Classes / Sections
    Route::get('/grades', [ClassSectionController::class, 'grades']);
    Route::post('/grades', [ClassSectionController::class, 'storeGrade']);
    Route::get('/classes', [ClassSectionController::class, 'classes']);
    Route::post('/classes', [ClassSectionController::class, 'storeClass']);
    Route::put('/classes/{class}', [ClassSectionController::class, 'updateClass']);
    Route::delete('/classes/{class}', [ClassSectionController::class, 'destroyClass']);
    Route::get('/sections', [ClassSectionController::class, 'sections']);
    Route::post('/sections', [ClassSectionController::class, 'storeSection']);
    Route::put('/sections/{section}', [ClassSectionController::class, 'updateSection']);
    Route::delete('/sections/{section}', [ClassSectionController::class, 'destroySection']);

    // Academic calendar (years, terms, events)
    Route::get('/academic-years', [AcademicCalendarController::class, 'years']);
    Route::post('/academic-years', [AcademicCalendarController::class, 'storeYear']);
    Route::post('/academic-years/{year}/set-current', [AcademicCalendarController::class, 'setCurrentYear']);
    Route::post('/academic-years/{year}/terms', [AcademicCalendarController::class, 'storeTerm']);
    Route::get('/calendar-events', [AcademicCalendarController::class, 'events']);
    Route::post('/calendar-events', [AcademicCalendarController::class, 'storeEvent']);
    Route::put('/calendar-events/{event}', [AcademicCalendarController::class, 'updateEvent']);
    Route::delete('/calendar-events/{event}', [AcademicCalendarController::class, 'destroyEvent']);

    // Subjects
    Route::get('/subjects', [SubjectController::class, 'index']);
    Route::post('/subjects', [SubjectController::class, 'store']);
    Route::put('/subjects/{subject}', [SubjectController::class, 'update']);
    Route::delete('/subjects/{subject}', [SubjectController::class, 'destroy']);

    // Curriculum (Phase 9)
    Route::get('/curricula', [CurriculumController::class, 'index']);
    Route::post('/curricula', [CurriculumController::class, 'store']);
    Route::get('/curriculum/grade-levels', [CurriculumController::class, 'gradeLevels']);
    Route::get('/curricula/{curriculum}', [CurriculumController::class, 'show']);
    Route::put('/curricula/{curriculum}', [CurriculumController::class, 'update']);
    Route::get('/curricula/{curriculum}/tree', [CurriculumController::class, 'tree']);
    Route::post('/curricula/{curriculum}/publish', [CurriculumController::class, 'publish']);
    Route::post('/curricula/{curriculum}/new-version', [CurriculumController::class, 'newVersion']);
    Route::get('/curricula/{curriculum}/versions', [CurriculumController::class, 'versionHistory']);
    Route::post('/curricula/{curriculum}/subjects', [CurriculumController::class, 'storeSubject']);
    Route::post('/curricula/{curriculum}/chapters', [CurriculumController::class, 'storeChapter']);
    Route::put('/curricula/{curriculum}/chapters/{chapter}', [CurriculumController::class, 'updateChapter']);
    Route::post('/curricula/{curriculum}/chapters/{chapter}/lessons', [CurriculumController::class, 'storeLesson']);
    Route::put('/curricula/{curriculum}/chapters/{chapter}/lessons/{lesson}', [CurriculumController::class, 'updateLesson']);
    Route::post('/curricula/{curriculum}/learning-outcomes', [CurriculumController::class, 'storeOutcome']);
    Route::put('/curricula/{curriculum}/learning-outcomes/{outcome}', [CurriculumController::class, 'updateOutcome']);

    // Timetable
    Route::get('/timetables', [TimetableController::class, 'index']);
    Route::post('/timetables', [TimetableController::class, 'store']);
    Route::get('/timetables/{timetable}', [TimetableController::class, 'show']);
    Route::post('/timetables/{timetable}/slots', [TimetableController::class, 'addSlot']);
    Route::delete('/timetables/{timetable}/slots/{slot}', [TimetableController::class, 'destroySlot']);
    Route::post('/timetables/{timetable}/publish', [TimetableController::class, 'publish']);
    Route::delete('/timetables/{timetable}', [TimetableController::class, 'destroy']);

    // Phase 10 — Interactive Learning
    Route::get('/resources', [ResourceLibraryController::class, 'index']);
    Route::post('/resources', [ResourceLibraryController::class, 'store']);
    Route::put('/resources/{asset}', [ResourceLibraryController::class, 'update']);
    Route::delete('/resources/{asset}', [ResourceLibraryController::class, 'destroy']);
    Route::post('/simulations', [ResourceLibraryController::class, 'storeSimulation']);
    Route::get('/simulations', [InteractiveLessonController::class, 'simulations']);
    Route::get('/activities', [InteractiveLessonController::class, 'activities']);

    Route::get('/interactive-lessons', [InteractiveLessonController::class, 'index']);
    Route::post('/interactive-lessons', [InteractiveLessonController::class, 'store']);
    Route::get('/interactive-lessons/{lesson}', [InteractiveLessonController::class, 'show']);
    Route::put('/interactive-lessons/{lesson}', [InteractiveLessonController::class, 'update']);
    Route::post('/interactive-lessons/{lesson}/blocks', [InteractiveLessonController::class, 'storeBlock']);
    Route::put('/interactive-lessons/{lesson}/blocks/{block}', [InteractiveLessonController::class, 'updateBlock']);
    Route::delete('/interactive-lessons/{lesson}/blocks/{block}', [InteractiveLessonController::class, 'destroyBlock']);
    Route::post('/interactive-lessons/{lesson}/publish', [InteractiveLessonController::class, 'publish']);
    Route::post('/interactive-lessons/{lesson}/assign', [InteractiveLessonController::class, 'assign']);

    Route::get('/homework', [HomeworkController::class, 'index']);
    Route::post('/homework', [HomeworkController::class, 'store']);
    Route::get('/homework/{homework}', [HomeworkController::class, 'show']);
    Route::post('/homework/{homework}/submissions/{submission}/review', [HomeworkController::class, 'reviewSubmission']);

    // Phase 11 — Assessment Engine
    Route::get('/question-bank', [QuestionBankController::class, 'index']);
    Route::post('/question-bank', [QuestionBankController::class, 'store']);
    Route::get('/question-bank/{question}', [QuestionBankController::class, 'show']);

    Route::get('/assessments', [AssessmentController::class, 'index']);
    Route::post('/assessments', [AssessmentController::class, 'store']);
    Route::get('/assessments/{assessment}', [AssessmentController::class, 'show']);
    Route::post('/assessments/{assessment}/questions', [AssessmentController::class, 'attachQuestion']);
    Route::post('/assessments/{assessment}/publish', [AssessmentController::class, 'publish']);

    Route::get('/grading/queue', [GradingController::class, 'reviewQueue']);
    Route::post('/grading/responses/{response}', [GradingController::class, 'gradeResponse']);
    Route::get('/progress', [GradingController::class, 'classProgress']);

    // Phase 12 — Live Tutoring
    Route::get('/tutors', [TutorProfileController::class, 'index']);
    Route::post('/tutors', [TutorProfileController::class, 'store']);
    Route::get('/tutors/{tutor}', [TutorProfileController::class, 'show']);
    Route::put('/tutors/{tutor}', [TutorProfileController::class, 'update']);
    Route::get('/tutors/{tutor}/ratings', [TutoringSessionController::class, 'ratings']);

    Route::get('/tutors/{tutor}/availability', [TutorAvailabilityController::class, 'index']);
    Route::post('/tutors/{tutor}/availability', [TutorAvailabilityController::class, 'storeWeekly']);
    Route::post('/tutors/{tutor}/availability/exceptions', [TutorAvailabilityController::class, 'storeException']);
    Route::get('/tutors/{tutor}/slots', [TutorAvailabilityController::class, 'openSlots']);

    Route::get('/tutoring-sessions', [TutoringSessionController::class, 'index']);
    Route::post('/tutoring-sessions', [TutoringSessionController::class, 'store']);
    Route::get('/tutoring-sessions/{session}', [TutoringSessionController::class, 'show']);
    Route::get('/tutoring-sessions/{session}/classroom', [TutoringSessionController::class, 'classroom']);
    Route::post('/tutoring-sessions/{session}/cancel', [TutoringSessionController::class, 'cancel']);
    Route::post('/tutoring-sessions/{session}/complete', [TutoringSessionController::class, 'complete']);
    Route::post('/tutoring-sessions/{session}/attendance', [TutoringSessionController::class, 'markAttendance']);
    Route::post('/tutoring-sessions/{session}/notes', [TutoringSessionController::class, 'storeNote']);

    // Phase 13/14 support — certificates & parent links
    Route::get('/certificates', [CertificateController::class, 'index']);
    Route::post('/certificates', [CertificateController::class, 'store']);
    Route::post('/certificates/{certificate}/void', [CertificateController::class, 'void']);
    Route::post('/parent-links', [ParentLinkController::class, 'store']);

    // Phase 15 — Reports & Analytics
    Route::get('/reports/meta', [ReportsController::class, 'meta']);
    Route::get('/reports/student', [ReportsController::class, 'student']);
    Route::get('/reports/teacher', [ReportsController::class, 'teacher']);
    Route::get('/reports/tutor-performance', [ReportsController::class, 'tutorPerformance']);
    Route::get('/reports/school', [ReportsController::class, 'school']);
    Route::get('/reports/curriculum-completion', [ReportsController::class, 'curriculumCompletion']);
    Route::get('/reports/learning-outcomes', [ReportsController::class, 'learningOutcomes']);

    // Phase 16 — Notification Engine
    Route::get('/notifications/events', [NotificationEngineController::class, 'events']);
    Route::post('/notifications/dispatch', [NotificationEngineController::class, 'dispatch']);
    Route::get('/notifications/preferences', [NotificationEngineController::class, 'myPreferences']);
    Route::put('/notifications/preferences', [NotificationEngineController::class, 'updatePreference']);

    // Phase 17 — Billing
    Route::get('/billing/plans', [BillingController::class, 'plans']);
    Route::get('/billing/invoices', [BillingController::class, 'schoolInvoices']);
    Route::post('/billing/invoices', [BillingController::class, 'createSchoolInvoice']);
    Route::post('/billing/invoices/{invoice}/send', [BillingController::class, 'sendSchoolInvoice']);
    Route::post('/billing/invoices/{invoice}/payments', [BillingController::class, 'paySchoolInvoice']);
    Route::get('/billing/student-invoices', [BillingController::class, 'studentInvoices']);
    Route::post('/billing/student-invoices', [BillingController::class, 'createStudentInvoice']);
    Route::get('/billing/tutor-payments', [BillingController::class, 'tutorPayments']);
    Route::post('/billing/tutor-payments', [BillingController::class, 'createTutorPayment']);
    Route::post('/billing/tutor-payments/{payment}/mark-paid', [BillingController::class, 'markTutorPaid']);
});
