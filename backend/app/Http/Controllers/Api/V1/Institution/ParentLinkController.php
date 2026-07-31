<?php

namespace App\Http\Controllers\Api\V1\Institution;

use App\Domain\Academics\Services\SchoolContextService;
use App\Domain\Identity\Services\ChildAccessService;
use App\Domain\Identity\Services\RbacService;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ParentLinkController extends Controller
{
    public function __construct(
        protected SchoolContextService $schoolContext,
        protected ChildAccessService $children,
        protected RbacService $rbac,
    ) {}

    public function store(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'school.users.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $data = $request->validate([
            'parent_user_id' => ['required', 'integer'],
            'student_user_id' => ['required', 'integer'],
            'relationship' => ['nullable', 'string', 'max:32'],
            'is_primary' => ['nullable', 'boolean'],
        ]);

        User::query()->where('tenant_id', $school->tenant_id)->findOrFail($data['parent_user_id']);
        User::query()->where('tenant_id', $school->tenant_id)->findOrFail($data['student_user_id']);

        $link = $this->children->link(
            (int) $school->tenant_id,
            $data['parent_user_id'],
            $data['student_user_id'],
            $data['relationship'] ?? 'parent',
            (bool) ($data['is_primary'] ?? true),
        );

        return response()->json(['message' => 'Parent-student link created.', 'data' => $link], 201);
    }
}
