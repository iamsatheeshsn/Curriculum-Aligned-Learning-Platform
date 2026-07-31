<?php

namespace App\Domain\Curriculum\Services;

use App\Domain\Curriculum\Models\Chapter;
use App\Domain\Curriculum\Models\Curriculum;
use App\Domain\Curriculum\Models\CurriculumLesson;
use App\Domain\Curriculum\Models\LearningOutcome;
use App\Domain\Learning\Models\InteractiveLesson;
use App\Domain\Organization\Models\School;
use App\Domain\Organization\Models\Tenant;
use Illuminate\Validation\ValidationException;

class ControlLessonService
{
    /**
     * @param  array{
     *   search?: string|null,
     *   status?: string|null,
     *   difficulty?: string|null,
     *   tenant_id?: int|null,
     *   school_id?: int|null,
     *   curriculum_id?: int|null,
     *   chapter_id?: int|null
     * }  $filters
     * @return list<array<string, mixed>>
     */
    public function list(array $filters = []): array
    {
        $query = CurriculumLesson::query()
            ->with([
                'school:id,tenant_id,code,name_en,name_ar,status',
                'tenant:id,slug,name,status',
                'curriculum:id,code,name_en,version,status',
                'chapter:id,title_en,title_ar,sequence,status,subject_id,grade_id,curriculum_id',
                'chapter.subject:id,code,name_en',
                'chapter.grade:id,code,name_en',
            ])
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'));

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (! empty($filters['difficulty'])) {
            $query->where('difficulty', $filters['difficulty']);
        }
        if (! empty($filters['tenant_id'])) {
            $query->where('tenant_id', (int) $filters['tenant_id']);
        }
        if (! empty($filters['school_id'])) {
            $query->where('school_id', (int) $filters['school_id']);
        }
        if (! empty($filters['curriculum_id'])) {
            $query->where('curriculum_id', (int) $filters['curriculum_id']);
        }
        if (! empty($filters['chapter_id'])) {
            $query->where('chapter_id', (int) $filters['chapter_id']);
        }

        if (! empty($filters['search'])) {
            $term = '%'.trim((string) $filters['search']).'%';
            $query->where(function ($q) use ($term) {
                $q->where('title_en', 'like', $term)
                    ->orWhere('title_ar', 'like', $term)
                    ->orWhere('code', 'like', $term)
                    ->orWhereHas('chapter', fn ($cq) => $cq->where('title_en', 'like', $term)->orWhere('title_ar', 'like', $term))
                    ->orWhereHas('curriculum', fn ($cq) => $cq->where('code', 'like', $term)->orWhere('name_en', 'like', $term));
            });
        }

        return $query
            ->orderBy('school_id')
            ->orderBy('curriculum_id')
            ->orderBy('chapter_id')
            ->orderBy('sequence')
            ->orderBy('title_en')
            ->get()
            ->map(fn (CurriculumLesson $lesson) => $this->serialize($lesson))
            ->all();
    }

    /** @return array<string, mixed> */
    public function show(CurriculumLesson $lesson): array
    {
        $lesson->load([
            'school:id,tenant_id,code,name_en,name_ar,status',
            'tenant:id,slug,name,status',
            'curriculum:id,code,name_en,version,status',
            'chapter:id,title_en,title_ar,sequence,status,subject_id,grade_id,curriculum_id',
            'chapter.subject:id,code,name_en',
            'chapter.grade:id,code,name_en',
            'learningOutcomes:id,code,statement_en,statement_ar,status,curriculum_id',
        ]);

        return $this->serialize($lesson, true);
    }

    /**
     * @return array<string, int>
     */
    public function stats(): array
    {
        $base = CurriculumLesson::query()
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'));

        return [
            'total' => (int) (clone $base)->count(),
            'draft' => (int) (clone $base)->where('status', 'draft')->count(),
            'published' => (int) (clone $base)->where('status', 'published')->count(),
            'archived' => (int) (clone $base)->where('status', 'archived')->count(),
            'with_outcomes' => (int) (clone $base)->whereHas('learningOutcomes')->count(),
            'schools' => (int) (clone $base)->distinct('school_id')->count('school_id'),
        ];
    }

    /**
     * @return list<array{id: int, name: string, slug: string, status: string, schools: list<array{id: int, code: string, name_en: string, status: string}>}>
     */
    public function availableSchools(): array
    {
        return Tenant::query()
            ->where('slug', '!=', 'platform')
            ->with(['schools' => fn ($q) => $q->orderBy('name_en')])
            ->orderBy('name')
            ->get()
            ->map(fn (Tenant $t) => [
                'id' => $t->id,
                'name' => $t->name,
                'slug' => $t->slug,
                'status' => $t->status,
                'schools' => $t->schools->map(fn (School $s) => [
                    'id' => $s->id,
                    'code' => $s->code,
                    'name_en' => $s->name_en,
                    'status' => $s->status,
                ])->values()->all(),
            ])
            ->all();
    }

    /**
     * @return array{
     *   curricula: list<array<string, mixed>>,
     *   chapters: list<array<string, mixed>>,
     *   learning_outcomes: list<array<string, mixed>>
     * }
     */
    public function lookupOptions(?int $schoolId = null, ?int $curriculumId = null): array
    {
        $curricula = Curriculum::query()
            ->when(
                $schoolId,
                fn ($q) => $q->where(function ($inner) use ($schoolId) {
                    $inner->where('school_id', $schoolId)->orWhereNull('school_id');
                }),
                fn ($q) => $q->where(function ($inner) {
                    $inner->whereNull('school_id')
                        ->orWhereHas('school.tenant', fn ($tq) => $tq->where('slug', '!=', 'platform'));
                })
            )
            ->orderBy('name_en')
            ->orderByDesc('is_latest')
            ->get(['id', 'school_id', 'code', 'name_en', 'version', 'status', 'is_latest'])
            ->map(fn (Curriculum $c) => [
                'id' => $c->id,
                'school_id' => $c->school_id,
                'code' => $c->code,
                'name_en' => $c->name_en,
                'version' => $c->version,
                'status' => $c->status,
                'is_latest' => (bool) $c->is_latest,
            ])
            ->all();

        $chapters = Chapter::query()
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'))
            ->when($schoolId, fn ($q) => $q->where('school_id', $schoolId))
            ->when($curriculumId, fn ($q) => $q->where('curriculum_id', $curriculumId))
            ->with(['subject:id,code', 'grade:id,code'])
            ->orderBy('sequence')
            ->orderBy('title_en')
            ->get(['id', 'school_id', 'curriculum_id', 'subject_id', 'grade_id', 'title_en', 'sequence', 'status'])
            ->map(fn (Chapter $ch) => [
                'id' => $ch->id,
                'school_id' => $ch->school_id,
                'curriculum_id' => $ch->curriculum_id,
                'title_en' => $ch->title_en,
                'sequence' => (int) $ch->sequence,
                'status' => $ch->status,
                'subject_code' => $ch->subject?->code,
                'grade_code' => $ch->grade?->code,
            ])
            ->all();

        $learningOutcomes = LearningOutcome::query()
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'))
            ->when($schoolId, fn ($q) => $q->where('school_id', $schoolId))
            ->when($curriculumId, fn ($q) => $q->where('curriculum_id', $curriculumId))
            ->where('status', 'active')
            ->orderBy('code')
            ->get(['id', 'school_id', 'curriculum_id', 'code', 'statement_en', 'status'])
            ->map(fn (LearningOutcome $lo) => [
                'id' => $lo->id,
                'school_id' => $lo->school_id,
                'curriculum_id' => $lo->curriculum_id,
                'code' => $lo->code,
                'statement_en' => $lo->statement_en,
                'status' => $lo->status,
            ])
            ->all();

        return [
            'curricula' => $curricula,
            'chapters' => $chapters,
            'learning_outcomes' => $learningOutcomes,
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function create(array $data, ?int $actorId = null): array
    {
        $school = School::query()
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'))
            ->findOrFail((int) $data['school_id']);

        $chapter = $this->resolveChapter((int) $data['chapter_id'], $school->id);
        $curriculumId = (int) ($data['curriculum_id'] ?? $chapter->curriculum_id);
        $curriculum = $this->resolveCurriculum($curriculumId, $school->id);

        if ((int) $chapter->curriculum_id !== (int) $curriculum->id) {
            throw ValidationException::withMessages([
                'chapter_id' => ['Select a chapter that belongs to the chosen curriculum.'],
            ]);
        }

        $lesson = CurriculumLesson::query()->create([
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'curriculum_id' => $curriculum->id,
            'chapter_id' => $chapter->id,
            'code' => $data['code'] ?? null,
            'title_en' => $data['title_en'],
            'title_ar' => $data['title_ar'] ?? $data['title_en'],
            'summary_en' => $data['summary_en'] ?? null,
            'summary_ar' => $data['summary_ar'] ?? null,
            'sequence' => (int) ($data['sequence'] ?? 1),
            'estimated_minutes' => isset($data['estimated_minutes']) ? (int) $data['estimated_minutes'] : null,
            'difficulty' => $data['difficulty'] ?? null,
            'status' => $data['status'] ?? 'draft',
            'created_by' => $actorId,
            'updated_by' => $actorId,
        ]);

        if (array_key_exists('learning_outcome_ids', $data)) {
            $this->syncLearningOutcomes($lesson, $curriculum->id, $data['learning_outcome_ids'] ?? []);
        }

        return $this->show($lesson->fresh());
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function update(CurriculumLesson $lesson, array $data, ?int $actorId = null): array
    {
        $schoolId = (int) $lesson->school_id;
        $curriculumId = (int) $lesson->curriculum_id;

        if (array_key_exists('school_id', $data) && (int) $data['school_id'] !== $schoolId) {
            $school = School::query()
                ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'))
                ->findOrFail((int) $data['school_id']);
            $lesson->school_id = $school->id;
            $lesson->tenant_id = $school->tenant_id;
            $schoolId = $school->id;
        }

        if (array_key_exists('curriculum_id', $data) && $data['curriculum_id'] !== null) {
            $curriculum = $this->resolveCurriculum((int) $data['curriculum_id'], $schoolId);
            $lesson->curriculum_id = $curriculum->id;
            $curriculumId = $curriculum->id;
        }

        if (array_key_exists('chapter_id', $data) && $data['chapter_id'] !== null) {
            $chapter = $this->resolveChapter((int) $data['chapter_id'], $schoolId);
            if ((int) $chapter->curriculum_id !== $curriculumId) {
                throw ValidationException::withMessages([
                    'chapter_id' => ['Select a chapter that belongs to the chosen curriculum.'],
                ]);
            }
            $lesson->chapter_id = $chapter->id;
            $lesson->curriculum_id = $chapter->curriculum_id;
            $curriculumId = (int) $chapter->curriculum_id;
        }

        foreach (['code', 'title_en', 'summary_en', 'summary_ar', 'difficulty'] as $field) {
            if (array_key_exists($field, $data)) {
                $lesson->{$field} = $data[$field];
            }
        }

        if (array_key_exists('title_ar', $data)) {
            $lesson->title_ar = $data['title_ar'] ?: $lesson->title_en;
        }
        if (array_key_exists('sequence', $data)) {
            $lesson->sequence = (int) $data['sequence'];
        }
        if (array_key_exists('estimated_minutes', $data)) {
            $lesson->estimated_minutes = $data['estimated_minutes'] !== null && $data['estimated_minutes'] !== ''
                ? (int) $data['estimated_minutes']
                : null;
        }
        if (array_key_exists('status', $data) && in_array($data['status'], ['draft', 'published', 'archived'], true)) {
            $lesson->status = $data['status'];
        }
        if (array_key_exists('difficulty', $data) && $data['difficulty'] !== null && $data['difficulty'] !== '') {
            if (! in_array($data['difficulty'], ['easy', 'medium', 'hard'], true)) {
                throw ValidationException::withMessages([
                    'difficulty' => ['Difficulty must be easy, medium, or hard.'],
                ]);
            }
        }

        $lesson->updated_by = $actorId;
        $lesson->save();

        if (array_key_exists('learning_outcome_ids', $data)) {
            $this->syncLearningOutcomes($lesson, $curriculumId, $data['learning_outcome_ids'] ?? []);
        }

        return $this->show($lesson->fresh());
    }

    public function delete(CurriculumLesson $lesson): void
    {
        $usage = $this->usage($lesson);
        if ($usage['interactive_lessons'] > 0) {
            throw ValidationException::withMessages([
                'lesson' => ['This lesson is linked to interactive content and cannot be deleted. Archive it instead.'],
            ]);
        }

        $lesson->learningOutcomes()->detach();
        $lesson->delete();
    }

    /**
     * @return array{interactive_lessons: int, learning_outcomes: int}
     */
    public function usage(CurriculumLesson $lesson): array
    {
        return [
            'interactive_lessons' => (int) InteractiveLesson::query()
                ->where('curriculum_lesson_id', $lesson->id)
                ->count(),
            'learning_outcomes' => (int) $lesson->learningOutcomes()->count(),
        ];
    }

    /** @return array<string, mixed> */
    public function serialize(CurriculumLesson $lesson, bool $detailed = false): array
    {
        $usage = $this->usage($lesson);

        $payload = [
            'id' => $lesson->id,
            'code' => $lesson->code,
            'title_en' => $lesson->title_en,
            'title_ar' => $lesson->title_ar,
            'summary_en' => $lesson->summary_en,
            'summary_ar' => $lesson->summary_ar,
            'sequence' => (int) $lesson->sequence,
            'estimated_minutes' => $lesson->estimated_minutes,
            'difficulty' => $lesson->difficulty,
            'status' => $lesson->status,
            'curriculum_id' => $lesson->curriculum_id,
            'chapter_id' => $lesson->chapter_id,
            'tenant_id' => $lesson->tenant_id,
            'school_id' => $lesson->school_id,
            'tenant' => $lesson->relationLoaded('tenant') && $lesson->tenant
                ? [
                    'id' => $lesson->tenant->id,
                    'name' => $lesson->tenant->name,
                    'slug' => $lesson->tenant->slug,
                    'status' => $lesson->tenant->status,
                ]
                : null,
            'school' => $lesson->relationLoaded('school') && $lesson->school
                ? [
                    'id' => $lesson->school->id,
                    'code' => $lesson->school->code,
                    'name_en' => $lesson->school->name_en,
                    'status' => $lesson->school->status,
                ]
                : null,
            'curriculum' => $lesson->relationLoaded('curriculum') && $lesson->curriculum
                ? [
                    'id' => $lesson->curriculum->id,
                    'code' => $lesson->curriculum->code,
                    'name_en' => $lesson->curriculum->name_en,
                    'version' => $lesson->curriculum->version,
                    'status' => $lesson->curriculum->status,
                ]
                : null,
            'chapter' => $lesson->relationLoaded('chapter') && $lesson->chapter
                ? [
                    'id' => $lesson->chapter->id,
                    'title_en' => $lesson->chapter->title_en,
                    'title_ar' => $lesson->chapter->title_ar,
                    'sequence' => (int) $lesson->chapter->sequence,
                    'status' => $lesson->chapter->status,
                    'subject' => $lesson->chapter->relationLoaded('subject') && $lesson->chapter->subject
                        ? [
                            'id' => $lesson->chapter->subject->id,
                            'code' => $lesson->chapter->subject->code,
                            'name_en' => $lesson->chapter->subject->name_en,
                        ]
                        : null,
                    'grade' => $lesson->chapter->relationLoaded('grade') && $lesson->chapter->grade
                        ? [
                            'id' => $lesson->chapter->grade->id,
                            'code' => $lesson->chapter->grade->code,
                            'name_en' => $lesson->chapter->grade->name_en,
                        ]
                        : null,
                ]
                : null,
            'usage' => $usage,
            'created_at' => optional($lesson->created_at)?->toIso8601String(),
            'updated_at' => optional($lesson->updated_at)?->toIso8601String(),
        ];

        if ($detailed) {
            $outcomes = $lesson->relationLoaded('learningOutcomes')
                ? $lesson->learningOutcomes
                : $lesson->learningOutcomes()->orderBy('code')->get();

            $payload['learning_outcomes'] = $outcomes->map(fn (LearningOutcome $lo) => [
                'id' => $lo->id,
                'code' => $lo->code,
                'statement_en' => $lo->statement_en,
                'statement_ar' => $lo->statement_ar,
                'status' => $lo->status,
            ])->all();
            $payload['learning_outcome_ids'] = $outcomes->pluck('id')->map(fn ($id) => (int) $id)->all();
        }

        return $payload;
    }

    /**
     * @param  list<int|string>  $ids
     */
    protected function syncLearningOutcomes(CurriculumLesson $lesson, int $curriculumId, array $ids): void
    {
        $validIds = LearningOutcome::query()
            ->where('curriculum_id', $curriculumId)
            ->whereIn('id', array_map('intval', $ids))
            ->pluck('id')
            ->all();

        $sync = [];
        foreach ($validIds as $id) {
            $sync[$id] = ['created_at' => now()];
        }

        $lesson->learningOutcomes()->sync($sync);
    }

    protected function resolveCurriculum(int $curriculumId, int $schoolId): Curriculum
    {
        $curriculum = Curriculum::query()
            ->where('id', $curriculumId)
            ->where(function ($q) use ($schoolId) {
                $q->where('school_id', $schoolId)->orWhereNull('school_id');
            })
            ->first();

        if (! $curriculum) {
            throw ValidationException::withMessages([
                'curriculum_id' => ['Select a curriculum that belongs to this school (or a platform template).'],
            ]);
        }

        return $curriculum;
    }

    protected function resolveChapter(int $chapterId, int $schoolId): Chapter
    {
        $chapter = Chapter::query()
            ->where('id', $chapterId)
            ->where('school_id', $schoolId)
            ->first();

        if (! $chapter) {
            throw ValidationException::withMessages([
                'chapter_id' => ['Select a chapter that belongs to this school.'],
            ]);
        }

        return $chapter;
    }
}
