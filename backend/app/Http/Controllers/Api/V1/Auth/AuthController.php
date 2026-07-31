<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Domain\Identity\Services\AuthService;
use App\Domain\Organization\Services\SchoolRegistrationService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\AdminLoginRequest;
use App\Http\Requests\Auth\ChangePasswordRequest;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\ParentLoginRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Http\Requests\Auth\SchoolRegistrationRequest;
use App\Http\Requests\Auth\StudentLoginRequest;
use App\Http\Requests\Auth\TeacherLoginRequest;
use App\Http\Resources\Api\V1\TenantResource;
use App\Http\Resources\Api\V1\UserResource;
use App\Models\User;
use App\Support\Enums\Portal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;

class AuthController extends Controller
{
    public function __construct(
        protected AuthService $auth,
        protected SchoolRegistrationService $registration,
    ) {}

    public function registerSchool(SchoolRegistrationRequest $request): JsonResponse
    {
        $result = $this->registration->register($request->validated());

        return response()->json([
            'message' => 'School organization registered. Please verify your email.',
            'data' => [
                'token' => $result['token']->plainTextToken,
                'token_type' => 'Bearer',
                'roles' => $result['roles'],
                'user' => new UserResource($result['user']),
                'tenant' => new TenantResource($result['tenant']),
                'school' => [
                    'id' => $result['school']->id,
                    'code' => $result['school']->code,
                    'name_en' => $result['school']->name_en,
                    'name_ar' => $result['school']->name_ar,
                ],
                'subscription' => $result['subscription'] ? [
                    'id' => $result['subscription']->id,
                    'status' => $result['subscription']->status,
                    'starts_at' => $result['subscription']->starts_at,
                    'ends_at' => $result['subscription']->ends_at,
                    'plan' => [
                        'code' => $result['subscription']->plan?->code,
                        'name_en' => $result['subscription']->plan?->name_en,
                        'name_ar' => $result['subscription']->plan?->name_ar,
                    ],
                ] : null,
            ],
        ], 201);
    }

    public function adminLogin(AdminLoginRequest $request): JsonResponse
    {
        return $this->respondLogin($this->auth->login(
            email: $request->string('email')->toString(),
            password: $request->string('password')->toString(),
            portal: Portal::Control,
            allowedRoleCodes: [
                'super_admin',
                'school_owner',
                'tenant_owner',
                'customer_support',
                'auditor',
            ],
        ));
    }

    public function teacherLogin(TeacherLoginRequest $request): JsonResponse
    {
        return $this->respondLogin($this->auth->login(
            email: $request->string('email')->toString(),
            password: $request->string('password')->toString(),
            portal: Portal::Institution,
            allowedRoleCodes: [
                'school_owner',
                'school_admin',
                'principal',
                'campus_admin',
                'academic_coordinator',
                'finance_manager',
                'teacher',
                'tutor',
            ],
            tenantSlug: $request->string('tenant_slug')->toString(),
        ));
    }

    public function studentLogin(StudentLoginRequest $request): JsonResponse
    {
        return $this->respondLogin($this->auth->login(
            email: $request->string('email')->toString(),
            password: $request->string('password')->toString(),
            portal: Portal::Learner,
            allowedRoleCodes: ['student'],
            tenantSlug: $request->string('tenant_slug')->toString(),
        ));
    }

    public function parentLogin(ParentLoginRequest $request): JsonResponse
    {
        return $this->respondLogin($this->auth->login(
            email: $request->string('email')->toString(),
            password: $request->string('password')->toString(),
            portal: Portal::Learner,
            allowedRoleCodes: ['parent'],
            tenantSlug: $request->string('tenant_slug')->toString(),
        ));
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        $roles = $this->auth->roleCodesForUser($user);
        $permissions = app(\App\Domain\Identity\Services\RbacService::class)
            ->permissionsFor($user, $user->tenant_id);

        return response()->json([
            'data' => [
                'user' => new UserResource($user),
                'roles' => $roles,
                'permissions' => $permissions,
                'tenant' => $user->tenant ? new TenantResource($user->tenant) : null,
                'email_verified' => $user->hasVerifiedEmail(),
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $this->auth->logout($request->user());

        return response()->json(['message' => 'Logged out.']);
    }

    public function changePassword(ChangePasswordRequest $request): JsonResponse
    {
        $this->auth->changePassword(
            $request->user(),
            $request->string('current_password')->toString(),
            $request->string('password')->toString(),
        );

        return response()->json(['message' => 'Password changed successfully.']);
    }

    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        $status = $this->auth->sendPasswordResetLink(
            $request->string('email')->toString(),
            $request->input('tenant_slug'),
        );

        if ($status !== Password::RESET_LINK_SENT) {
            return response()->json([
                'message' => __($status),
                'code' => 'reset_link_failed',
            ], 422);
        }

        return response()->json(['message' => __($status)]);
    }

    public function resetPassword(ResetPasswordRequest $request): JsonResponse
    {
        $status = $this->auth->resetPassword($request->only(
            'email',
            'password',
            'password_confirmation',
            'token',
        ));

        if ($status !== Password::PASSWORD_RESET) {
            return response()->json([
                'message' => __($status),
                'code' => 'reset_failed',
            ], 422);
        }

        return response()->json(['message' => __($status)]);
    }

    public function sendVerification(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user->hasVerifiedEmail()) {
            return response()->json(['message' => 'Email already verified.']);
        }

        $this->auth->sendEmailVerification($user);

        return response()->json(['message' => 'Verification link sent.']);
    }

    public function verifyEmail(Request $request, int $id, string $hash): JsonResponse
    {
        $user = User::query()->findOrFail($id);
        $this->auth->verifyEmail($user, $hash);

        return response()->json(['message' => 'Email verified successfully.']);
    }

    /** @param array{user: User, token: \Laravel\Sanctum\NewAccessToken, tenant: mixed, roles: list<string>, permissions: list<string>} $result */
    private function respondLogin(array $result): JsonResponse
    {
        return response()->json([
            'message' => 'Authenticated.',
            'data' => [
                'token' => $result['token']->plainTextToken,
                'token_type' => 'Bearer',
                'roles' => $result['roles'],
                'permissions' => $result['permissions'] ?? [],
                'user' => new UserResource($result['user']),
                'tenant' => $result['tenant'] ? new TenantResource($result['tenant']) : null,
                'email_verified' => $result['user']->hasVerifiedEmail(),
            ],
        ]);
    }
}
