<?php

namespace App\Http\Middleware;

use App\Domain\Identity\Services\RbacService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePermission
{
    public function __construct(
        protected RbacService $rbac,
    ) {}

    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.', 'code' => 'unauthenticated'], 401);
        }

        foreach ($permissions as $permission) {
            if ($this->rbac->can($user, $permission, $user->tenant_id)) {
                return $next($request);
            }
        }

        return response()->json([
            'message' => 'Missing required permission.',
            'code' => 'forbidden_permission',
            'required' => $permissions,
        ], 403);
    }
}
