<?php

use App\Http\Controllers\Api\V1\Control\AuditController;
use App\Http\Controllers\Api\V1\Control\BillingCouponController;
use App\Http\Controllers\Api\V1\Control\BillingInvoiceController;
use App\Http\Controllers\Api\V1\Control\BillingPaymentController;
use App\Http\Controllers\Api\V1\Control\BillingPlanController;
use App\Http\Controllers\Api\V1\Control\BillingTaxController;
use App\Http\Controllers\Api\V1\Control\CampusController;
use App\Http\Controllers\Api\V1\Control\IntegrationController;
use App\Http\Controllers\Api\V1\Control\PlatformSettingsController;
use App\Http\Controllers\Api\V1\Control\ReportController;
use App\Http\Controllers\Api\V1\Control\SchoolOpsController;
use App\Http\Controllers\Api\V1\Control\SchoolWorkspaceController;
use App\Http\Controllers\Api\V1\Control\ChapterController;
use App\Http\Controllers\Api\V1\Control\CountryController;
use App\Http\Controllers\Api\V1\Control\CurriculumController;
use App\Http\Controllers\Api\V1\Control\GradeController;
use App\Http\Controllers\Api\V1\Control\LessonController;
use App\Http\Controllers\Api\V1\Control\LearningOutcomeController;
use App\Http\Controllers\Api\V1\Control\PlatformUserController;
use App\Http\Controllers\Api\V1\Control\RbacController;
use App\Http\Controllers\Api\V1\Control\SubjectController;
use App\Http\Controllers\Api\V1\Control\SubscriptionController;
use App\Http\Controllers\Api\V1\Control\SystemHealthController;
use App\Http\Controllers\Api\V1\Control\TenantController;
use App\Http\Controllers\Api\V1\Control\TenantGroupController;
use App\Http\Controllers\Api\V1\Control\TenantTrialController;
use Illuminate\Support\Facades\Route;

Route::get('/subscription/plans', [SubscriptionController::class, 'plans']);

Route::middleware(['auth:sanctum', 'tenant.isolation'])->group(function () {
    Route::get('/dashboard', [TenantController::class, 'dashboard']);
    Route::get('/analytics/saas', [TenantController::class, 'saasAnalytics'])
        ->middleware('permission:platform.tenants.manage');
    Route::get('/analytics/revenue', [TenantController::class, 'revenueAnalytics'])
        ->middleware('permission:platform.tenants.manage');
    Route::get('/analytics/system-health', SystemHealthController::class)
        ->middleware('permission:platform.tenants.manage');

    Route::get('/tenant-groups', [TenantGroupController::class, 'index'])
        ->middleware('permission:platform.tenants.manage');
    Route::post('/tenant-groups', [TenantGroupController::class, 'store'])
        ->middleware('permission:platform.tenants.manage');
    Route::get('/tenant-groups/{group}', [TenantGroupController::class, 'show'])
        ->middleware('permission:platform.tenants.manage');
    Route::put('/tenant-groups/{group}', [TenantGroupController::class, 'update'])
        ->middleware('permission:platform.tenants.manage');
    Route::delete('/tenant-groups/{group}', [TenantGroupController::class, 'destroy'])
        ->middleware('permission:platform.tenants.manage');
    Route::put('/tenant-groups/{group}/members', [TenantGroupController::class, 'syncMembers'])
        ->middleware('permission:platform.tenants.manage');

    Route::get('/campuses', [CampusController::class, 'index'])
        ->middleware('permission:platform.tenants.manage');
    Route::post('/campuses', [CampusController::class, 'store'])
        ->middleware('permission:platform.tenants.manage');
    Route::get('/campuses/{campus}', [CampusController::class, 'show'])
        ->middleware('permission:platform.tenants.manage');
    Route::put('/campuses/{campus}', [CampusController::class, 'update'])
        ->middleware('permission:platform.tenants.manage');
    Route::delete('/campuses/{campus}', [CampusController::class, 'destroy'])
        ->middleware('permission:platform.tenants.manage');

    Route::get('/countries', [CountryController::class, 'index']);
    Route::post('/countries', [CountryController::class, 'store'])
        ->middleware('permission:platform.tenants.manage,curriculum.manage');
    Route::get('/countries/{country}', [CountryController::class, 'show']);
    Route::put('/countries/{country}', [CountryController::class, 'update'])
        ->middleware('permission:platform.tenants.manage,curriculum.manage');
    Route::delete('/countries/{country}', [CountryController::class, 'destroy'])
        ->middleware('permission:platform.tenants.manage,curriculum.manage');

    Route::get('/curricula', [CurriculumController::class, 'index']);
    Route::post('/curricula', [CurriculumController::class, 'store'])
        ->middleware('permission:platform.tenants.manage,curriculum.manage');
    Route::get('/curricula/{curriculum}', [CurriculumController::class, 'show']);
    Route::put('/curricula/{curriculum}', [CurriculumController::class, 'update'])
        ->middleware('permission:platform.tenants.manage,curriculum.manage');
    Route::post('/curricula/{curriculum}/publish', [CurriculumController::class, 'publish'])
        ->middleware('permission:platform.tenants.manage,curriculum.manage');
    Route::post('/curricula/{curriculum}/versions', [CurriculumController::class, 'newVersion'])
        ->middleware('permission:platform.tenants.manage,curriculum.manage');
    Route::delete('/curricula/{curriculum}', [CurriculumController::class, 'destroy'])
        ->middleware('permission:platform.tenants.manage,curriculum.manage');

    Route::get('/grades', [GradeController::class, 'index']);
    Route::post('/grades', [GradeController::class, 'store'])
        ->middleware('permission:platform.tenants.manage,curriculum.manage');
    Route::get('/grades/{grade}', [GradeController::class, 'show']);
    Route::put('/grades/{grade}', [GradeController::class, 'update'])
        ->middleware('permission:platform.tenants.manage,curriculum.manage');
    Route::delete('/grades/{grade}', [GradeController::class, 'destroy'])
        ->middleware('permission:platform.tenants.manage,curriculum.manage');

    Route::get('/subjects', [SubjectController::class, 'index']);
    Route::post('/subjects', [SubjectController::class, 'store'])
        ->middleware('permission:platform.tenants.manage,curriculum.manage');
    Route::get('/subjects/{subject}', [SubjectController::class, 'show']);
    Route::put('/subjects/{subject}', [SubjectController::class, 'update'])
        ->middleware('permission:platform.tenants.manage,curriculum.manage');
    Route::delete('/subjects/{subject}', [SubjectController::class, 'destroy'])
        ->middleware('permission:platform.tenants.manage,curriculum.manage');

    Route::get('/chapters', [ChapterController::class, 'index']);
    Route::post('/chapters', [ChapterController::class, 'store'])
        ->middleware('permission:platform.tenants.manage,curriculum.manage');
    Route::get('/chapters/{chapter}', [ChapterController::class, 'show']);
    Route::put('/chapters/{chapter}', [ChapterController::class, 'update'])
        ->middleware('permission:platform.tenants.manage,curriculum.manage');
    Route::delete('/chapters/{chapter}', [ChapterController::class, 'destroy'])
        ->middleware('permission:platform.tenants.manage,curriculum.manage');

    Route::get('/lessons', [LessonController::class, 'index']);
    Route::post('/lessons', [LessonController::class, 'store'])
        ->middleware('permission:platform.tenants.manage,curriculum.manage');
    Route::get('/lessons/{lesson}', [LessonController::class, 'show']);
    Route::put('/lessons/{lesson}', [LessonController::class, 'update'])
        ->middleware('permission:platform.tenants.manage,curriculum.manage');
    Route::delete('/lessons/{lesson}', [LessonController::class, 'destroy'])
        ->middleware('permission:platform.tenants.manage,curriculum.manage');

    Route::get('/learning-outcomes', [LearningOutcomeController::class, 'index']);
    Route::post('/learning-outcomes', [LearningOutcomeController::class, 'store'])
        ->middleware('permission:platform.tenants.manage,curriculum.manage');
    Route::get('/learning-outcomes/{outcome}', [LearningOutcomeController::class, 'show']);
    Route::put('/learning-outcomes/{outcome}', [LearningOutcomeController::class, 'update'])
        ->middleware('permission:platform.tenants.manage,curriculum.manage');
    Route::delete('/learning-outcomes/{outcome}', [LearningOutcomeController::class, 'destroy'])
        ->middleware('permission:platform.tenants.manage,curriculum.manage');

    Route::get('/trials', [TenantTrialController::class, 'index'])
        ->middleware('permission:platform.tenants.manage');
    Route::get('/trials/{tenant}', [TenantTrialController::class, 'show'])
        ->middleware('permission:platform.tenants.manage');
    Route::post('/trials/{tenant}/extend', [TenantTrialController::class, 'extend'])
        ->middleware('permission:platform.tenants.manage');
    Route::post('/trials/{tenant}/convert', [TenantTrialController::class, 'convert'])
        ->middleware('permission:platform.tenants.manage');
    Route::post('/trials/{tenant}/start', [TenantTrialController::class, 'putOnTrial'])
        ->middleware('permission:platform.tenants.manage');

    Route::get('/tenants', [TenantController::class, 'index']);
    Route::post('/tenants', [TenantController::class, 'store'])
        ->middleware('role:super_admin');
    Route::get('/tenants/{tenant}', [TenantController::class, 'show']);
    Route::put('/tenants/{tenant}', [TenantController::class, 'update']);
    Route::patch('/tenants/{tenant}/status', [TenantController::class, 'updateStatus'])
        ->middleware('role:super_admin');
    Route::delete('/tenants/{tenant}', [TenantController::class, 'destroy'])
        ->middleware('role:super_admin');

    Route::get('/tenants/{tenant}/branding', [TenantController::class, 'branding']);
    Route::put('/tenants/{tenant}/branding', [TenantController::class, 'updateBranding']);
    Route::get('/tenants/{tenant}/billing-contact', [TenantController::class, 'billingContact']);
    Route::put('/tenants/{tenant}/billing-contact', [TenantController::class, 'updateBillingContact']);
    Route::get('/tenants/{tenant}/schools', [TenantController::class, 'schools']);
    Route::get('/tenants/{tenant}/invoices', [TenantController::class, 'invoices']);
    Route::get('/tenants/{tenant}/invoices/{invoice}', [TenantController::class, 'showInvoice']);
    Route::post('/tenants/{tenant}/invoices', [TenantController::class, 'generateInvoice']);

    Route::get('/subscription/current', [SubscriptionController::class, 'current']);
    Route::post('/subscription/change-plan', [SubscriptionController::class, 'changePlan'])
        ->middleware('role:super_admin,school_owner');
    Route::get('/subscriptions', [SubscriptionController::class, 'index'])
        ->middleware('permission:platform.tenants.manage,platform.plans.manage');
    Route::get('/subscriptions/{subscription}', [SubscriptionController::class, 'show'])
        ->middleware('permission:platform.tenants.manage,platform.plans.manage');
    Route::post('/subscriptions/{subscription}/cancel', [SubscriptionController::class, 'cancel'])
        ->middleware('permission:platform.tenants.manage,platform.plans.manage');

    Route::get('/billing/plans', [BillingPlanController::class, 'index'])
        ->middleware('permission:platform.plans.manage,platform.tenants.manage');
    Route::post('/billing/plans', [BillingPlanController::class, 'store'])
        ->middleware('permission:platform.plans.manage,platform.tenants.manage');
    Route::get('/billing/plans/{plan}', [BillingPlanController::class, 'show'])
        ->middleware('permission:platform.plans.manage,platform.tenants.manage');
    Route::put('/billing/plans/{plan}', [BillingPlanController::class, 'update'])
        ->middleware('permission:platform.plans.manage,platform.tenants.manage');
    Route::delete('/billing/plans/{plan}', [BillingPlanController::class, 'destroy'])
        ->middleware('permission:platform.plans.manage,platform.tenants.manage');

    Route::get('/billing/invoices', [BillingInvoiceController::class, 'index'])
        ->middleware('permission:platform.plans.manage,platform.tenants.manage');
    Route::post('/billing/invoices/generate', [BillingInvoiceController::class, 'generate'])
        ->middleware('permission:platform.plans.manage,platform.tenants.manage');
    Route::get('/billing/invoices/{invoice}', [BillingInvoiceController::class, 'show'])
        ->middleware('permission:platform.plans.manage,platform.tenants.manage');
    Route::post('/billing/invoices/{invoice}/send', [BillingInvoiceController::class, 'send'])
        ->middleware('permission:platform.plans.manage,platform.tenants.manage');
    Route::post('/billing/invoices/{invoice}/pay', [BillingInvoiceController::class, 'pay'])
        ->middleware('permission:platform.plans.manage,platform.tenants.manage');

    Route::get('/billing/payments', [BillingPaymentController::class, 'index'])
        ->middleware('permission:platform.plans.manage,platform.tenants.manage');
    Route::get('/billing/payments/{payment}', [BillingPaymentController::class, 'show'])
        ->middleware('permission:platform.plans.manage,platform.tenants.manage');

    Route::get('/billing/coupons', [BillingCouponController::class, 'index'])
        ->middleware('permission:platform.plans.manage,platform.tenants.manage');
    Route::post('/billing/coupons', [BillingCouponController::class, 'store'])
        ->middleware('permission:platform.plans.manage,platform.tenants.manage');
    Route::get('/billing/coupons/{coupon}', [BillingCouponController::class, 'show'])
        ->middleware('permission:platform.plans.manage,platform.tenants.manage');
    Route::put('/billing/coupons/{coupon}', [BillingCouponController::class, 'update'])
        ->middleware('permission:platform.plans.manage,platform.tenants.manage');
    Route::delete('/billing/coupons/{coupon}', [BillingCouponController::class, 'destroy'])
        ->middleware('permission:platform.plans.manage,platform.tenants.manage');

    Route::get('/billing/taxes', [BillingTaxController::class, 'index'])
        ->middleware('permission:platform.plans.manage,platform.tenants.manage');
    Route::post('/billing/taxes', [BillingTaxController::class, 'store'])
        ->middleware('permission:platform.plans.manage,platform.tenants.manage');
    Route::get('/billing/taxes/{tax}', [BillingTaxController::class, 'show'])
        ->middleware('permission:platform.plans.manage,platform.tenants.manage');
    Route::put('/billing/taxes/{tax}', [BillingTaxController::class, 'update'])
        ->middleware('permission:platform.plans.manage,platform.tenants.manage');
    Route::delete('/billing/taxes/{tax}', [BillingTaxController::class, 'destroy'])
        ->middleware('permission:platform.plans.manage,platform.tenants.manage');

    Route::get('/platform-users', [PlatformUserController::class, 'index'])
        ->middleware('permission:platform.rbac.manage,platform.tenants.manage');
    Route::post('/platform-users', [PlatformUserController::class, 'store'])
        ->middleware('permission:platform.rbac.manage,platform.tenants.manage');
    Route::get('/platform-users/{user}', [PlatformUserController::class, 'show'])
        ->middleware('permission:platform.rbac.manage,platform.tenants.manage');
    Route::put('/platform-users/{user}', [PlatformUserController::class, 'update'])
        ->middleware('permission:platform.rbac.manage,platform.tenants.manage');
    Route::delete('/platform-users/{user}', [PlatformUserController::class, 'destroy'])
        ->middleware('permission:platform.rbac.manage,platform.tenants.manage');

    Route::get('/rbac/me', [RbacController::class, 'me']);
    Route::get('/rbac/roles', [RbacController::class, 'roles'])
        ->middleware('permission:platform.rbac.manage,platform.tenants.manage,tenant.settings.manage,audit.logs.view');
    Route::get('/rbac/permissions', [RbacController::class, 'permissions'])
        ->middleware('permission:platform.rbac.manage,platform.tenants.manage,tenant.settings.manage,audit.logs.view');
    Route::get('/rbac/matrix', [RbacController::class, 'matrix'])
        ->middleware('permission:platform.rbac.manage,platform.tenants.manage,audit.logs.view');
    Route::put('/rbac/roles/{role}/permissions', [RbacController::class, 'syncRolePermissions'])
        ->middleware('permission:platform.rbac.manage');
    Route::get('/rbac/assignments', [RbacController::class, 'assignments'])
        ->middleware('permission:platform.rbac.manage,school.users.manage,tenant.settings.manage');
    Route::post('/rbac/assignments', [RbacController::class, 'assign'])
        ->middleware('permission:platform.rbac.manage,school.users.manage,tenant.settings.manage');
    Route::delete('/rbac/assignments/{assignment}', [RbacController::class, 'revoke'])
        ->middleware('permission:platform.rbac.manage,school.users.manage,tenant.settings.manage');
    Route::get('/rbac/tenants', [RbacController::class, 'tenantsForFilter'])
        ->middleware('permission:platform.rbac.manage');

    Route::get('/integrations/{category}', [IntegrationController::class, 'index'])
        ->middleware('permission:platform.tenants.manage');
    Route::post('/integrations/{category}', [IntegrationController::class, 'store'])
        ->middleware('permission:platform.tenants.manage');
    Route::get('/integrations/{category}/{integration}', [IntegrationController::class, 'show'])
        ->middleware('permission:platform.tenants.manage');
    Route::put('/integrations/{category}/{integration}', [IntegrationController::class, 'update'])
        ->middleware('permission:platform.tenants.manage');
    Route::delete('/integrations/{category}/{integration}', [IntegrationController::class, 'destroy'])
        ->middleware('permission:platform.tenants.manage');
    Route::post('/integrations/{category}/{integration}/default', [IntegrationController::class, 'setDefault'])
        ->middleware('permission:platform.tenants.manage');
    Route::post('/integrations/{category}/{integration}/test', [IntegrationController::class, 'test'])
        ->middleware('permission:platform.tenants.manage');

    Route::get('/reports/revenue', [ReportController::class, 'revenue'])
        ->middleware('permission:platform.tenants.manage');
    Route::get('/reports/schools', [ReportController::class, 'schools'])
        ->middleware('permission:platform.tenants.manage');
    Route::get('/reports/students', [ReportController::class, 'students'])
        ->middleware('permission:platform.tenants.manage');
    Route::get('/reports/usage', [ReportController::class, 'usage'])
        ->middleware('permission:platform.tenants.manage');

    Route::get('/audit/activity', [AuditController::class, 'activity'])
        ->middleware('permission:platform.tenants.manage,platform.audit.view,audit.logs.view');
    Route::get('/audit/logins', [AuditController::class, 'logins'])
        ->middleware('permission:platform.tenants.manage,platform.audit.view,audit.logs.view');
    Route::get('/audit/logs', [AuditController::class, 'logs'])
        ->middleware('permission:platform.tenants.manage,platform.audit.view,audit.logs.view');
    Route::get('/audit/logs/{log}', [AuditController::class, 'show'])
        ->middleware('permission:platform.tenants.manage,platform.audit.view,audit.logs.view');

    Route::get('/settings/{group}', [PlatformSettingsController::class, 'show'])
        ->middleware('permission:platform.tenants.manage');
    Route::put('/settings/{group}', [PlatformSettingsController::class, 'update'])
        ->middleware('permission:platform.tenants.manage');
    Route::post('/settings/backup/run', [PlatformSettingsController::class, 'runBackup'])
        ->middleware('permission:platform.tenants.manage');

    Route::prefix('school-ops')->group(function () {
        Route::get('/school', [SchoolOpsController::class, 'getSchool']);
        Route::put('/school', [SchoolOpsController::class, 'updateSchool']);

        Route::get('/campuses', [SchoolOpsController::class, 'listCampuses']);
        Route::post('/campuses', [SchoolOpsController::class, 'createCampus']);
        Route::put('/campuses/{campus}', [SchoolOpsController::class, 'updateCampus']);
        Route::delete('/campuses/{campus}', [SchoolOpsController::class, 'deleteCampus']);

        Route::get('/academic-years', [SchoolOpsController::class, 'listAcademicYears']);
        Route::post('/academic-years', [SchoolOpsController::class, 'createAcademicYear']);
        Route::post('/academic-years/{year}/current', [SchoolOpsController::class, 'setCurrentAcademicYear']);

        Route::get('/terms', [SchoolOpsController::class, 'listTerms']);
        Route::post('/terms', [SchoolOpsController::class, 'createTerm']);
        Route::put('/terms/{term}', [SchoolOpsController::class, 'updateTerm']);

        Route::get('/subjects', [SchoolOpsController::class, 'listSubjects']);
        Route::post('/subjects', [SchoolOpsController::class, 'createSubject']);
        Route::put('/subjects/{subject}', [SchoolOpsController::class, 'updateSubject']);
        Route::delete('/subjects/{subject}', [SchoolOpsController::class, 'deleteSubject']);

        Route::get('/grades', [SchoolOpsController::class, 'listGrades']);
        Route::post('/grades', [SchoolOpsController::class, 'createGrade']);
        Route::put('/grades/{grade}', [SchoolOpsController::class, 'updateGrade']);
        Route::delete('/grades/{grade}', [SchoolOpsController::class, 'deleteGrade']);

        Route::get('/classes', [SchoolOpsController::class, 'listClasses']);
        Route::post('/classes', [SchoolOpsController::class, 'createClass']);
        Route::put('/classes/{class}', [SchoolOpsController::class, 'updateClass']);
        Route::delete('/classes/{class}', [SchoolOpsController::class, 'deleteClass']);

        Route::get('/sections', [SchoolOpsController::class, 'listSections']);
        Route::post('/sections', [SchoolOpsController::class, 'createSection']);
        Route::put('/sections/{section}', [SchoolOpsController::class, 'updateSection']);
        Route::delete('/sections/{section}', [SchoolOpsController::class, 'deleteSection']);

        Route::get('/students', [SchoolOpsController::class, 'listStudents']);
        Route::post('/students', [SchoolOpsController::class, 'createStudent']);
        Route::get('/students/{student}', [SchoolOpsController::class, 'showStudent']);
        Route::put('/students/{student}', [SchoolOpsController::class, 'updateStudent']);

        Route::get('/admissions', [SchoolOpsController::class, 'listAdmissions']);
        Route::post('/admissions/{admission}/accept', [SchoolOpsController::class, 'acceptAdmission']);
        Route::post('/admissions/{admission}/reject', [SchoolOpsController::class, 'rejectAdmission']);

        Route::get('/transfers', [SchoolOpsController::class, 'listTransfers']);
        Route::post('/transfers', [SchoolOpsController::class, 'createTransfer']);

        Route::get('/alumni', [SchoolOpsController::class, 'listAlumni']);

        Route::get('/parents', [SchoolOpsController::class, 'listParents']);
        Route::post('/parents', [SchoolOpsController::class, 'createParent']);
        Route::get('/guardians', [SchoolOpsController::class, 'listGuardians']);

        Route::get('/teachers', [SchoolOpsController::class, 'listTeachers']);
        Route::post('/teachers', [SchoolOpsController::class, 'createTeacher']);

        Route::get('/tutors', [SchoolOpsController::class, 'listTutors']);
        Route::post('/tutors', [SchoolOpsController::class, 'createTutor']);
        Route::put('/tutors/{tutor}', [SchoolOpsController::class, 'updateTutor']);

        Route::get('/teaching-assignments', [SchoolOpsController::class, 'listTeachingAssignments']);
        Route::post('/teaching-assignments', [SchoolOpsController::class, 'createTeachingAssignment']);
        Route::put('/teaching-assignments/{assignment}', [SchoolOpsController::class, 'updateTeachingAssignment']);
        Route::delete('/teaching-assignments/{assignment}', [SchoolOpsController::class, 'deleteTeachingAssignment']);
    });

    Route::prefix('school-workspace')->group(function () {
        $c = SchoolWorkspaceController::class;

        Route::get('/staff', [$c, 'listStaff']);
        Route::post('/staff', [$c, 'createStaff']);
        Route::put('/staff/{id}', [$c, 'updateStaff']);

        Route::get('/staff-attendance', [$c, 'listStaffAttendance']);
        Route::post('/staff-attendance', [$c, 'createStaffAttendance']);
        Route::put('/staff-attendance/{id}', [$c, 'updateStaffAttendance']);

        Route::get('/courses', [$c, 'listCourses']);
        Route::post('/courses', [$c, 'createCourse']);
        Route::put('/courses/{id}', [$c, 'updateCourse']);
        Route::delete('/courses/{id}', [$c, 'deleteCourse']);

        Route::get('/lessons', [$c, 'listLessons']);
        Route::post('/lessons', [$c, 'createLesson']);
        Route::put('/lessons/{id}', [$c, 'updateLesson']);
        Route::delete('/lessons/{id}', [$c, 'deleteLesson']);

        Route::get('/resources', [$c, 'listResources']);
        Route::post('/resources', [$c, 'createResource']);
        Route::put('/resources/{id}', [$c, 'updateResource']);
        Route::delete('/resources/{id}', [$c, 'deleteResource']);

        Route::get('/assignments', [$c, 'listAssignments']);
        Route::post('/assignments', [$c, 'createAssignment']);
        Route::put('/assignments/{id}', [$c, 'updateAssignment']);
        Route::delete('/assignments/{id}', [$c, 'deleteAssignment']);

        Route::get('/homework', [$c, 'listHomework']);
        Route::post('/homework', [$c, 'createHomework']);
        Route::put('/homework/{id}', [$c, 'updateHomework']);
        Route::delete('/homework/{id}', [$c, 'deleteHomework']);

        Route::get('/questions', [$c, 'listQuestions']);
        Route::post('/questions', [$c, 'createQuestion']);
        Route::put('/questions/{id}', [$c, 'updateQuestion']);
        Route::delete('/questions/{id}', [$c, 'deleteQuestion']);

        Route::get('/quizzes', [$c, 'listQuizzes']);
        Route::post('/quizzes', [$c, 'createQuiz']);
        Route::put('/quizzes/{id}', [$c, 'updateQuiz']);
        Route::delete('/quizzes/{id}', [$c, 'deleteQuiz']);

        Route::get('/exams', [$c, 'listExams']);
        Route::post('/exams', [$c, 'createExam']);
        Route::put('/exams/{id}', [$c, 'updateExam']);
        Route::delete('/exams/{id}', [$c, 'deleteExam']);

        Route::get('/results', [$c, 'listResults']);

        Route::get('/tutoring/tutors', [$c, 'listTutoringTutors']);
        Route::post('/tutoring/tutors', [$c, 'createTutoringTutor']);
        Route::put('/tutoring/tutors/{id}', [$c, 'updateTutoringTutor']);

        Route::get('/tutoring/bookings', [$c, 'listBookings']);
        Route::post('/tutoring/bookings', [$c, 'createBooking']);
        Route::put('/tutoring/bookings/{id}', [$c, 'updateBooking']);

        Route::get('/tutoring/timetable', [$c, 'listTimetable']);
        Route::post('/tutoring/timetable', [$c, 'createTimetableSlot']);
        Route::put('/tutoring/timetable/{id}', [$c, 'updateTimetableSlot']);
        Route::delete('/tutoring/timetable/{id}', [$c, 'deleteTimetableSlot']);

        Route::get('/finance/fees', [$c, 'listFees']);
        Route::post('/finance/fees', [$c, 'createFee']);
        Route::put('/finance/fees/{id}', [$c, 'updateFee']);

        Route::get('/finance/tutor-payments', [$c, 'listTutorPayments']);
        Route::post('/finance/tutor-payments', [$c, 'createTutorPayment']);
        Route::put('/finance/tutor-payments/{id}', [$c, 'updateTutorPayment']);

        Route::get('/finance/expenses', [$c, 'listExpenses']);
        Route::post('/finance/expenses', [$c, 'createExpense']);
        Route::put('/finance/expenses/{id}', [$c, 'updateExpense']);
        Route::delete('/finance/expenses/{id}', [$c, 'deleteExpense']);

        Route::get('/finance/reports', [$c, 'financeReports']);

        Route::get('/reports/academic', [$c, 'academicReport']);
        Route::get('/reports/attendance', [$c, 'attendanceReport']);
        Route::get('/reports/revenue', [$c, 'revenueReport']);
        Route::get('/reports/performance', [$c, 'performanceReport']);

        Route::get('/notifications', [$c, 'listNotifications']);
        Route::post('/notifications', [$c, 'createNotification']);
        Route::post('/notifications/{id}/send', [$c, 'sendNotification']);

        Route::get('/audit-logs', [$c, 'listAuditLogs']);

        Route::get('/settings/organisation', [$c, 'getOrganisation']);
        Route::put('/settings/organisation', [$c, 'updateOrganisation']);
        Route::get('/settings/branding', [$c, 'getBranding']);
        Route::put('/settings/branding', [$c, 'updateBranding']);
    });
});
