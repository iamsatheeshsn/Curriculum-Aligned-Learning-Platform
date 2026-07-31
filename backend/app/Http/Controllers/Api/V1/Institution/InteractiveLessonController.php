<?php

namespace App\Http\Controllers\Api\V1\Institution;

use App\Domain\Academics\Services\SchoolContextService;
use App\Domain\Identity\Services\RbacService;
use App\Domain\Learning\Models\InteractiveLesson;
use App\Domain\Learning\Models\LessonAssignment;
use App\Domain\Learning\Models\LessonBlock;
use App\Domain\Learning\Models\MediaAsset;
use App\Domain\Learning\Services\InteractiveLessonService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InteractiveLessonController extends Controller
{
    public function __construct(
        protected SchoolContextService $schoolContext,
        protected InteractiveLessonService $lessons,
        protected RbacService $rbac,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'learning.content.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $items = InteractiveLesson::query()
            ->where('school_id', $school->id)
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->withCount('blocks')
            ->orderByDesc('id')
            ->paginate((int) $request->integer('per_page', 10));

        return response()->json($items);
    }

    public function store(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'learning.content.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $data = $request->validate([
            'curriculum_lesson_id' => ['nullable', 'integer'],
            'title_en' => ['required', 'string', 'max:255'],
            'title_ar' => ['required', 'string', 'max:255'],
            'completion_rule' => ['nullable', 'in:view_all,pass_checks'],
        ]);

        $lesson = $this->lessons->create($school, $data);

        return response()->json(['message' => 'Interactive lesson created.', 'data' => $lesson], 201);
    }

    public function show(Request $request, int $lesson): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'learning.content.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $model = InteractiveLesson::query()
            ->where('school_id', $school->id)
            ->with(['blocks.mediaAsset', 'curriculumLesson'])
            ->findOrFail($lesson);

        return response()->json(['data' => $model]);
    }

    public function update(Request $request, int $lesson): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'learning.content.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = InteractiveLesson::query()->where('school_id', $school->id)->findOrFail($lesson);
        $this->lessons->assertEditable($model);

        $data = $request->validate([
            'title_en' => ['sometimes', 'string', 'max:255'],
            'title_ar' => ['sometimes', 'string', 'max:255'],
            'completion_rule' => ['sometimes', 'in:view_all,pass_checks'],
            'curriculum_lesson_id' => ['nullable', 'integer'],
            'status' => ['sometimes', 'in:draft,published,archived'],
        ]);

        $model->update($data);

        return response()->json(['message' => 'Lesson updated.', 'data' => $model->fresh()]);
    }

    public function storeBlock(Request $request, int $lesson): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'learning.content.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = InteractiveLesson::query()->where('school_id', $school->id)->findOrFail($lesson);

        $data = $request->validate([
            'block_type' => ['required', 'in:text,video,pdf,simulation,virtual_lab,embed,check,activity'],
            'sequence' => ['nullable', 'integer', 'min:1'],
            'payload_json' => ['nullable', 'array'],
            'media_asset_id' => ['nullable', 'integer'],
        ]);

        $block = $this->lessons->upsertBlock($model, $data);

        return response()->json(['message' => 'Block added.', 'data' => $block], 201);
    }

    public function updateBlock(Request $request, int $lesson, int $block): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'learning.content.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = InteractiveLesson::query()->where('school_id', $school->id)->findOrFail($lesson);
        $row = LessonBlock::query()->where('interactive_lesson_id', $model->id)->findOrFail($block);

        $data = $request->validate([
            'block_type' => ['required', 'in:text,video,pdf,simulation,virtual_lab,embed,check,activity'],
            'sequence' => ['nullable', 'integer', 'min:1'],
            'payload_json' => ['nullable', 'array'],
            'media_asset_id' => ['nullable', 'integer'],
        ]);

        $updated = $this->lessons->upsertBlock($model, $data, $row);

        return response()->json(['message' => 'Block updated.', 'data' => $updated]);
    }

    public function destroyBlock(Request $request, int $lesson, int $block): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'learning.content.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = InteractiveLesson::query()->where('school_id', $school->id)->findOrFail($lesson);
        $this->lessons->assertEditable($model);
        LessonBlock::query()->where('interactive_lesson_id', $model->id)->findOrFail($block)->delete();

        return response()->json(['message' => 'Block deleted.']);
    }

    public function publish(Request $request, int $lesson): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'learning.content.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = InteractiveLesson::query()->where('school_id', $school->id)->findOrFail($lesson);

        return response()->json([
            'message' => 'Lesson published.',
            'data' => $this->lessons->publish($model),
        ]);
    }

    public function assign(Request $request, int $lesson): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'learning.content.assign');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = InteractiveLesson::query()->where('school_id', $school->id)->findOrFail($lesson);

        $data = $request->validate([
            'class_section_id' => ['nullable', 'integer'],
            'student_user_id' => ['nullable', 'integer'],
            'due_at' => ['nullable', 'date'],
        ]);

        if (empty($data['class_section_id']) && empty($data['student_user_id'])) {
            return response()->json(['message' => 'class_section_id or student_user_id required.', 'code' => 'target_required'], 422);
        }

        $assignment = LessonAssignment::query()->create([
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'interactive_lesson_id' => $model->id,
            'class_section_id' => $data['class_section_id'] ?? null,
            'student_user_id' => $data['student_user_id'] ?? null,
            'assigned_by' => $request->user()->id,
            'due_at' => $data['due_at'] ?? null,
            'status' => 'assigned',
        ]);

        return response()->json(['message' => 'Lesson assigned.', 'data' => $assignment], 201);
    }

    /** Interactive activities = activity/check/virtual_lab blocks across lessons */
    public function activities(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'learning.content.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $items = LessonBlock::query()
            ->whereHas('lesson', fn ($q) => $q->where('school_id', $school->id))
            ->whereIn('block_type', ['activity', 'check', 'virtual_lab'])
            ->with('lesson:id,title_en,title_ar,status')
            ->orderByDesc('id')
            ->paginate((int) $request->integer('per_page', 10));

        return response()->json($items);
    }

    /** STEM simulations registry (blocks + media launch URLs) */
    public function simulations(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'learning.content.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $blocks = LessonBlock::query()
            ->whereHas('lesson', fn ($q) => $q->where('school_id', $school->id))
            ->where('block_type', 'simulation')
            ->with(['lesson:id,title_en,title_ar', 'mediaAsset'])
            ->orderByDesc('id')
            ->get();

        $packages = MediaAsset::query()
            ->where('school_id', $school->id)
            ->where('mime_type', 'application/x-simulation')
            ->orderByDesc('id')
            ->get();

        return response()->json(['data' => ['blocks' => $blocks, 'packages' => $packages]]);
    }
}
