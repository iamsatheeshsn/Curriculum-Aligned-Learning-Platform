<?php

use App\Http\Controllers\Api\V1\Auth\AuthController;
use Illuminate\Support\Facades\Route;

Route::post('/register/school', [AuthController::class, 'registerSchool']);

Route::post('/admin/login', [AuthController::class, 'adminLogin']);
Route::post('/teacher/login', [AuthController::class, 'teacherLogin']);
Route::post('/student/login', [AuthController::class, 'studentLogin']);
Route::post('/parent/login', [AuthController::class, 'parentLogin']);

Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/reset-password', [AuthController::class, 'resetPassword']);

Route::get('/email/verify/{id}/{hash}', [AuthController::class, 'verifyEmail'])
    ->middleware('signed')
    ->name('api.v1.auth.email.verify');

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/change-password', [AuthController::class, 'changePassword']);
    Route::post('/email/verification-notification', [AuthController::class, 'sendVerification']);
});
