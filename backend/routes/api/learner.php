<?php

use App\Http\Controllers\Api\V1\Learner\LearnerAssessmentController;
use App\Http\Controllers\Api\V1\Learner\LearnerHomeworkController;
use App\Http\Controllers\Api\V1\Learner\LearnerTutoringController;
use App\Http\Controllers\Api\V1\Learner\LessonViewerController;
use App\Http\Controllers\Api\V1\Learner\ParentPortalController;
use App\Http\Controllers\Api\V1\Learner\StudentPortalController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'tenant.isolation', 'subscription.active'])->group(function () {
    // Phase 10 — Lesson viewer / homework / progress
    Route::get('/lessons', [LessonViewerController::class, 'assigned']);
    Route::get('/lessons/{lesson}', [LessonViewerController::class, 'show']);
    Route::post('/lessons/{lesson}/progress', [LessonViewerController::class, 'progress']);

    Route::get('/homework', [LearnerHomeworkController::class, 'index']);
    Route::post('/homework/{homework}/submit', [LearnerHomeworkController::class, 'submit']);

    Route::get('/progress', [LearnerAssessmentController::class, 'myProgress']);

    // Phase 11 — Assessments
    Route::get('/assessments', [LearnerAssessmentController::class, 'available']);
    Route::post('/assessments/{assessment}/start', [LearnerAssessmentController::class, 'start']);
    Route::post('/attempts/{attempt}/submit', [LearnerAssessmentController::class, 'submit']);
    Route::get('/results', [LearnerAssessmentController::class, 'myResults']);

    // Phase 12 — Live Tutoring
    Route::get('/tutors', [LearnerTutoringController::class, 'tutors']);
    Route::get('/tutors/{tutor}/slots', [LearnerTutoringController::class, 'slots']);
    Route::post('/tutoring/book', [LearnerTutoringController::class, 'book']);
    Route::get('/tutoring/sessions', [LearnerTutoringController::class, 'mySessions']);
    Route::get('/tutoring/sessions/{session}/join', [LearnerTutoringController::class, 'join']);
    Route::post('/tutoring/sessions/{session}/rate', [LearnerTutoringController::class, 'rate']);
    Route::get('/tutoring/attendance', [LearnerTutoringController::class, 'myAttendance']);

    // Phase 13 — Student Portal
    Route::prefix('student')->group(function () {
        Route::get('/dashboard', [StudentPortalController::class, 'dashboard']);
        Route::get('/courses', [StudentPortalController::class, 'courses']);
        Route::get('/lessons', [StudentPortalController::class, 'lessons']);
        Route::get('/homework', [StudentPortalController::class, 'homework']);
        Route::get('/assessments', [StudentPortalController::class, 'assessments']);
        Route::get('/progress', [StudentPortalController::class, 'progress']);
        Route::get('/certificates', [StudentPortalController::class, 'certificates']);
        Route::get('/notifications', [StudentPortalController::class, 'notifications']);
        Route::post('/notifications/read-all', [StudentPortalController::class, 'markAllNotificationsRead']);
        Route::post('/notifications/{notification}/read', [StudentPortalController::class, 'markNotificationRead']);
        Route::put('/profile', [StudentPortalController::class, 'updateProfile']);
        Route::get('/messages', [StudentPortalController::class, 'messages']);
        Route::post('/messages', [StudentPortalController::class, 'storeMessage']);
        Route::post('/messages/{id}/read', [StudentPortalController::class, 'markMessageRead']);
    });

    // Phase 14 — Parent Portal
    Route::prefix('parent')->group(function () {
        Route::get('/dashboard', [ParentPortalController::class, 'dashboard']);
        Route::get('/children', [ParentPortalController::class, 'children']);
        Route::get('/children/{student}/progress', [ParentPortalController::class, 'progress']);
        Route::get('/children/{student}/attendance', [ParentPortalController::class, 'attendance']);
        Route::get('/children/{student}/homework', [ParentPortalController::class, 'homework']);
        Route::get('/children/{student}/assessments', [ParentPortalController::class, 'assessmentResults']);
        Route::get('/children/{student}/tutoring', [ParentPortalController::class, 'tutorSessions']);
        Route::get('/notifications', [ParentPortalController::class, 'notifications']);
        Route::post('/notifications/read-all', [ParentPortalController::class, 'markAllNotificationsRead']);
        Route::post('/notifications/{notification}/read', [ParentPortalController::class, 'markNotificationRead']);
        Route::put('/profile', [ParentPortalController::class, 'updateProfile']);
        Route::get('/fees', [ParentPortalController::class, 'fees']);
        Route::get('/notices', [ParentPortalController::class, 'notices']);
        Route::get('/messages', [ParentPortalController::class, 'messages']);
        Route::post('/messages', [ParentPortalController::class, 'storeMessage']);
        Route::post('/messages/{id}/read', [ParentPortalController::class, 'markMessageRead']);
    });
});
