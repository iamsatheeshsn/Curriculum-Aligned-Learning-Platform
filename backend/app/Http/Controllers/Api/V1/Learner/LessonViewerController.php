<?php

namespace App\Http\Controllers\Api\V1\Learner;

use App\Domain\Academics\Services\SchoolContextService;
use App\Domain\Identity\Services\RbacService;
use App\Domain\Learning\Models\InteractiveLesson;
use App\Domain\Learning\Models\LessonAssignment;
use App\Domain\Learning\Services\InteractiveLessonService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LessonViewerController extends Controller
{
    public function __construct(
        protected SchoolContextService $schoolContext,
        protected InteractiveLessonService $lessons,
        protected RbacService $rbac,
    ) {}

    public function assigned(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'learning.content.consume');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $userId = $request->user()->id;

        $lessonIds = LessonAssignment::query()
            ->where('school_id', $school->id)
            ->where(function ($q) use ($userId) {
                $q->where('student_user_id', $userId)
                    ->orWhereNotNull('class_section_id');
            })
            ->pluck('interactive_lesson_id');

        $items = InteractiveLesson::query()
            ->where('school_id', $school->id)
            ->where('status', 'published')
            ->whereIn('id', $lessonIds)
            ->with(['blocks.mediaAsset'])
            ->orderByDesc('id')
            ->get();

        return response()->json(['data' => $items]);
    }

    public function show(Request $request, int $lesson): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'learning.content.consume');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $model = InteractiveLesson::query()
            ->where('school_id', $school->id)
            ->where('status', 'published')
            ->with(['blocks.mediaAsset'])
            ->findOrFail($lesson);

        $progress = $this->lessons->startOrResumeProgress($model, $request->user()->id);

        return response()->json(['data' => ['lesson' => $model, 'progress' => $progress]]);
    }

    public function progress(Request $request, int $lesson): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'learning.content.consume');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = InteractiveLesson::query()
            ->where('school_id', $school->id)
            ->where('status', 'published')
            ->findOrFail($lesson);

        $data = $request->validate([
            'progress_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'status' => ['nullable', 'in:in_progress,completed'],
            'score' => ['nullable', 'numeric'],
            'last_position_json' => ['nullable', 'array'],
            'complete' => ['nullable', 'boolean'],
        ]);

        $progress = $this->lessons->updateProgress($model, $request->user()->id, $data);

        return response()->json(['message' => 'Progress saved.', 'data' => $progress]);
    }
}
