<?php

namespace App\Domain\Learning\Services;

use App\Domain\Learning\Models\InteractiveLesson;
use App\Domain\Learning\Models\LearningProgress;
use App\Domain\Learning\Models\LessonBlock;
use App\Domain\Organization\Models\School;
use App\Services\BaseService;
use App\Support\TenantContext;
use Illuminate\Validation\ValidationException;

class InteractiveLessonService extends BaseService
{
    public function __construct(TenantContext $tenantContext)
    {
        parent::__construct($tenantContext);
    }

    public function create(School $school, array $data): InteractiveLesson
    {
        return InteractiveLesson::query()->create([
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'curriculum_lesson_id' => $data['curriculum_lesson_id'] ?? null,
            'title_en' => $data['title_en'],
            'title_ar' => $data['title_ar'],
            'status' => 'draft',
            'completion_rule' => $data['completion_rule'] ?? 'view_all',
        ]);
    }

    public function upsertBlock(InteractiveLesson $lesson, array $data, ?LessonBlock $block = null): LessonBlock
    {
        $this->assertEditable($lesson);

        $allowed = ['text', 'video', 'pdf', 'simulation', 'virtual_lab', 'embed', 'check', 'activity'];
        if (! in_array($data['block_type'], $allowed, true)) {
            throw ValidationException::withMessages(['block_type' => ['Invalid block type.']]);
        }

        $payload = $data['payload_json'] ?? [];
        if ($block) {
            $block->update([
                'block_type' => $data['block_type'],
                'sequence' => $data['sequence'] ?? $block->sequence,
                'payload_json' => $payload,
                'media_asset_id' => $data['media_asset_id'] ?? $block->media_asset_id,
            ]);

            return $block->fresh('mediaAsset');
        }

        return LessonBlock::query()->create([
            'interactive_lesson_id' => $lesson->id,
            'block_type' => $data['block_type'],
            'sequence' => $data['sequence'] ?? (($lesson->blocks()->max('sequence') ?? 0) + 1),
            'payload_json' => $payload,
            'media_asset_id' => $data['media_asset_id'] ?? null,
        ])->load('mediaAsset');
    }

    public function publish(InteractiveLesson $lesson): InteractiveLesson
    {
        if ($lesson->blocks()->count() < 1) {
            throw ValidationException::withMessages(['blocks' => ['Add at least one block before publishing.']]);
        }

        $lesson->forceFill([
            'status' => 'published',
            'published_at' => now(),
        ])->save();

        return $lesson->fresh('blocks.mediaAsset');
    }

    public function assertEditable(InteractiveLesson $lesson): void
    {
        if ($lesson->status === 'archived') {
            throw ValidationException::withMessages(['lesson' => ['Archived lessons cannot be edited.']]);
        }
    }

    public function startOrResumeProgress(InteractiveLesson $lesson, int $studentId): LearningProgress
    {
        $progress = LearningProgress::query()->firstOrCreate(
            [
                'student_user_id' => $studentId,
                'interactive_lesson_id' => $lesson->id,
            ],
            [
                'tenant_id' => $lesson->tenant_id,
                'school_id' => $lesson->school_id,
                'status' => 'in_progress',
                'progress_percent' => 0,
                'started_at' => now(),
            ]
        );

        if ($progress->status === 'not_started') {
            $progress->forceFill([
                'status' => 'in_progress',
                'started_at' => $progress->started_at ?? now(),
            ])->save();
        }

        return $progress->fresh();
    }

    public function updateProgress(InteractiveLesson $lesson, int $studentId, array $data): LearningProgress
    {
        $progress = $this->startOrResumeProgress($lesson, $studentId);

        $percent = max(0, min(100, (float) ($data['progress_percent'] ?? $progress->progress_percent)));
        $status = $data['status'] ?? $progress->status;

        if ($percent >= 100 || ($data['complete'] ?? false)) {
            $percent = 100;
            $status = 'completed';
        }

        $progress->forceFill([
            'progress_percent' => $percent,
            'status' => $status,
            'score' => $data['score'] ?? $progress->score,
            'last_position_json' => $data['last_position_json'] ?? $progress->last_position_json,
            'completed_at' => $status === 'completed' ? ($progress->completed_at ?? now()) : null,
        ])->save();

        return $progress->fresh();
    }
}
