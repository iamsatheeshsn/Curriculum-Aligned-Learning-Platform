<?php

namespace App\Http\Middleware;

use App\Domain\Identity\Services\RbacService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePortalRoles
{
    public function __construct(
        protected RbacService $rbac,
    ) {}

    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if ($this->rbac->hasAnyRole($user, $roles, $user->tenant_id)
            || $this->rbac->hasAnyRole($user, $roles, null)) {
            return $next($request);
        }

        return response()->json([
            'message' => 'Insufficient role.',
            'code' => 'forbidden_role',
            'required_roles' => $roles,
        ], 403);
    }
}
