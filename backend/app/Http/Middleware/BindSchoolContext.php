<?php

namespace App\Http\Middleware;

use App\Domain\Academics\Services\SchoolContextService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class BindSchoolContext
{
    public function __construct(
        protected SchoolContextService $schools,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $schoolId = $request->header('X-School-ID')
            ?? $request->route('school')
            ?? $request->input('school_id');

        try {
            $this->schools->resolveSchool($schoolId ? (int) $schoolId : null);
        } catch (\Illuminate\Validation\ValidationException $e) {
            // Allow school CRUD listing without active school bound
            if (! $request->isMethod('GET') || ! str_contains($request->path(), '/schools')) {
                return response()->json([
                    'message' => 'School context required.',
                    'errors' => $e->errors(),
                    'code' => 'school_context_required',
                ], 422);
            }
        }

        return $next($request);
    }
}
