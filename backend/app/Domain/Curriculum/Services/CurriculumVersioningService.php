<?php

namespace App\Domain\Curriculum\Services;

use App\Domain\Academics\Models\Subject;
use App\Domain\Curriculum\Models\Chapter;
use App\Domain\Curriculum\Models\Curriculum;
use App\Domain\Curriculum\Models\CurriculumLesson;
use App\Domain\Curriculum\Models\CurriculumVersionLog;
use App\Domain\Curriculum\Models\LearningOutcome;
use App\Services\BaseService;
use App\Support\TenantContext;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CurriculumVersioningService extends BaseService
{
    public function __construct(TenantContext $tenantContext)
    {
        parent::__construct($tenantContext);
    }

    public function publish(Curriculum $curriculum, ?string $summaryEn = null, ?string $summaryAr = null): Curriculum
    {
        if ($curriculum->status === 'published' && $curriculum->is_latest) {
            throw ValidationException::withMessages([
                'status' => ['Curriculum is already published.'],
            ]);
        }

        return $this->transaction(function () use ($curriculum, $summaryEn, $summaryAr) {
            $curriculum->forceFill([
                'status' => 'published',
                'published_at' => now(),
                'is_latest' => true,
                'change_summary_en' => $summaryEn ?? $curriculum->change_summary_en,
                'change_summary_ar' => $summaryAr ?? $curriculum->change_summary_ar,
            ])->save();

            $this->log($curriculum, $curriculum->source_curriculum_id, $curriculum->version, $curriculum->version, 'publish', $summaryEn, $summaryAr);

            return $curriculum->fresh();
        });
    }

    /**
     * Create a new draft version by deep-cloning the curriculum tree.
     */
    public function createNewVersion(
        Curriculum $source,
        string $newVersion,
        ?string $summaryEn = null,
        ?string $summaryAr = null,
    ): Curriculum {
        if (! $source->is_latest && $source->status !== 'published') {
            // allow cloning any published/latest; prefer published
        }

        if (Curriculum::query()
            ->where('school_id', $source->school_id)
            ->where('code', $source->code)
            ->where('version', $newVersion)
            ->exists()) {
            throw ValidationException::withMessages([
                'version' => ['This version already exists for the curriculum code.'],
            ]);
        }

        return $this->transaction(function () use ($source, $newVersion, $summaryEn, $summaryAr) {
            // Mark prior versions of same code+school as not latest
            Curriculum::query()
                ->where('school_id', $source->school_id)
                ->where('code', $source->code)
                ->update(['is_latest' => false]);

            if ($source->status === 'published') {
                $source->forceFill(['status' => 'superseded'])->save();
            } else {
                $source->forceFill(['is_latest' => false])->save();
            }

            $clone = Curriculum::query()->create([
                'tenant_id' => $source->tenant_id,
                'school_id' => $source->school_id,
                'country_id' => $source->country_id,
                'code' => $source->code,
                'name_en' => $source->name_en,
                'name_ar' => $source->name_ar,
                'version' => $newVersion,
                'status' => 'draft',
                'published_at' => null,
                'is_latest' => true,
                'change_summary_en' => $summaryEn,
                'change_summary_ar' => $summaryAr,
                'source_curriculum_id' => $source->id,
            ]);

            $subjectMap = [];
            foreach ($source->subjects()->get() as $subject) {
                $newSubject = Subject::query()->create([
                    'tenant_id' => $subject->tenant_id,
                    'school_id' => $subject->school_id,
                    'curriculum_id' => $clone->id,
                    'code' => $subject->code,
                    'name_en' => $subject->name_en,
                    'name_ar' => $subject->name_ar,
                    'is_stem' => $subject->is_stem,
                    'tutoring_enabled' => $subject->tutoring_enabled,
                    'status' => $subject->status,
                ]);
                $subjectMap[$subject->id] = $newSubject->id;
            }

            $outcomeMap = [];
            foreach ($source->learningOutcomes()->get() as $outcome) {
                $newOutcome = LearningOutcome::query()->create([
                    'tenant_id' => $outcome->tenant_id,
                    'school_id' => $outcome->school_id,
                    'curriculum_id' => $clone->id,
                    'subject_id' => $outcome->subject_id ? ($subjectMap[$outcome->subject_id] ?? null) : null,
                    'code' => $outcome->code,
                    'statement_en' => $outcome->statement_en,
                    'statement_ar' => $outcome->statement_ar,
                    'status' => $outcome->status,
                ]);
                $outcomeMap[$outcome->id] = $newOutcome->id;
            }

            $chapterMap = [];
            foreach ($source->chapters()->with('lessons.learningOutcomes')->orderBy('sequence')->get() as $chapter) {
                $newChapter = Chapter::query()->create([
                    'tenant_id' => $chapter->tenant_id,
                    'school_id' => $chapter->school_id,
                    'curriculum_id' => $clone->id,
                    'subject_id' => $subjectMap[$chapter->subject_id] ?? $chapter->subject_id,
                    'grade_id' => $chapter->grade_id,
                    'title_en' => $chapter->title_en,
                    'title_ar' => $chapter->title_ar,
                    'sequence' => $chapter->sequence,
                    'status' => $chapter->status === 'published' ? 'draft' : $chapter->status,
                ]);
                $chapterMap[$chapter->id] = $newChapter->id;

                foreach ($chapter->lessons as $lesson) {
                    $newLesson = CurriculumLesson::query()->create([
                        'tenant_id' => $lesson->tenant_id,
                        'school_id' => $lesson->school_id,
                        'curriculum_id' => $clone->id,
                        'chapter_id' => $newChapter->id,
                        'code' => $lesson->code,
                        'title_en' => $lesson->title_en,
                        'title_ar' => $lesson->title_ar,
                        'summary_en' => $lesson->summary_en,
                        'summary_ar' => $lesson->summary_ar,
                        'sequence' => $lesson->sequence,
                        'estimated_minutes' => $lesson->estimated_minutes,
                        'difficulty' => $lesson->difficulty,
                        'status' => $lesson->status === 'published' ? 'draft' : $lesson->status,
                    ]);

                    $newOutcomeIds = [];
                    foreach ($lesson->learningOutcomes as $lo) {
                        if (isset($outcomeMap[$lo->id])) {
                            $newOutcomeIds[] = $outcomeMap[$lo->id];
                        }
                    }
                    if ($newOutcomeIds !== []) {
                        $attach = [];
                        foreach ($newOutcomeIds as $id) {
                            $attach[$id] = ['created_at' => now()];
                        }
                        $newLesson->learningOutcomes()->attach($attach);
                    }
                }
            }

            $this->log($clone, $source->id, $source->version, $newVersion, 'version', $summaryEn, $summaryAr);

            return $clone->fresh(['subjects', 'chapters.lessons', 'learningOutcomes']);
        });
    }

    public function assertEditable(Curriculum $curriculum): void
    {
        if (! $curriculum->isEditable()) {
            throw ValidationException::withMessages([
                'curriculum' => ['Published/superseded curricula are read-only. Create a new version to edit.'],
            ]);
        }
    }

    private function log(
        Curriculum $curriculum,
        ?int $sourceId,
        ?string $from,
        string $to,
        string $action,
        ?string $summaryEn,
        ?string $summaryAr,
    ): void {
        CurriculumVersionLog::query()->create([
            'tenant_id' => $curriculum->tenant_id,
            'school_id' => $curriculum->school_id,
            'curriculum_id' => $curriculum->id,
            'source_curriculum_id' => $sourceId,
            'from_version' => $from,
            'to_version' => $to,
            'action' => $action,
            'summary_en' => $summaryEn,
            'summary_ar' => $summaryAr,
            'created_by' => Auth::id(),
            'created_at' => now(),
        ]);
    }
}
