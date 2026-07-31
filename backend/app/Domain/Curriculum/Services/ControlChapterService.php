<?php

namespace App\Domain\Curriculum\Services;

use App\Domain\Academics\Models\Grade;
use App\Domain\Academics\Models\Subject;
use App\Domain\Curriculum\Models\Chapter;
use App\Domain\Curriculum\Models\Curriculum;
use App\Domain\Curriculum\Models\CurriculumLesson;
use App\Domain\Organization\Models\School;
use App\Domain\Organization\Models\Tenant;
use Illuminate\Validation\ValidationException;

class ControlChapterService
{
    /**
     * @param  array{
     *   search?: string|null,
     *   status?: string|null,
     *   tenant_id?: int|null,
     *   school_id?: int|null,
     *   curriculum_id?: int|null,
     *   subject_id?: int|null,
     *   grade_id?: int|null
     * }  $filters
     * @return list<array<string, mixed>>
     */
    public function list(array $filters = []): array
    {
        $query = Chapter::query()
            ->with([
                'school:id,tenant_id,code,name_en,name_ar,status',
                'tenant:id,slug,name,status',
                'curriculum:id,code,name_en,version,status',
                'subject:id,code,name_en,curriculum_id',
                'grade:id,code,name_en,sequence',
            ])
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'));

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
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
        if (! empty($filters['subject_id'])) {
            $query->where('subject_id', (int) $filters['subject_id']);
        }
        if (! empty($filters['grade_id'])) {
            $query->where('grade_id', (int) $filters['grade_id']);
        }

        if (! empty($filters['search'])) {
            $term = '%'.trim((string) $filters['search']).'%';
            $query->where(function ($q) use ($term) {
                $q->where('title_en', 'like', $term)
                    ->orWhere('title_ar', 'like', $term)
                    ->orWhereHas('subject', fn ($sq) => $sq->where('code', 'like', $term)->orWhere('name_en', 'like', $term))
                    ->orWhereHas('curriculum', fn ($cq) => $cq->where('code', 'like', $term)->orWhere('name_en', 'like', $term))
                    ->orWhereHas('grade', fn ($gq) => $gq->where('code', 'like', $term)->orWhere('name_en', 'like', $term));
            });
        }

        return $query
            ->orderBy('school_id')
            ->orderBy('curriculum_id')
            ->orderBy('sequence')
            ->orderBy('title_en')
            ->get()
            ->map(fn (Chapter $chapter) => $this->serialize($chapter))
            ->all();
    }

    /** @return array<string, mixed> */
    public function show(Chapter $chapter): array
    {
        $chapter->load([
            'school:id,tenant_id,code,name_en,name_ar,status',
            'tenant:id,slug,name,status',
            'curriculum:id,code,name_en,version,status',
            'subject:id,code,name_en,curriculum_id',
            'grade:id,code,name_en,sequence',
            'lessons' => fn ($q) => $q->orderBy('sequence')->limit(12),
        ]);

        return $this->serialize($chapter, true);
    }

    /**
     * @return array<string, int>
     */
    public function stats(): array
    {
        $base = Chapter::query()
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'));

        return [
            'total' => (int) (clone $base)->count(),
            'draft' => (int) (clone $base)->where('status', 'draft')->count(),
            'published' => (int) (clone $base)->where('status', 'published')->count(),
            'archived' => (int) (clone $base)->where('status', 'archived')->count(),
            'with_lessons' => (int) CurriculumLesson::query()
                ->whereNotNull('chapter_id')
                ->distinct('chapter_id')
                ->count('chapter_id'),
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
     *   subjects: list<array<string, mixed>>,
     *   grades: list<array<string, mixed>>
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

        $subjects = Subject::query()
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'))
            ->when($schoolId, fn ($q) => $q->where('school_id', $schoolId))
            ->when($curriculumId, fn ($q) => $q->where(function ($inner) use ($curriculumId) {
                $inner->where('curriculum_id', $curriculumId)->orWhereNull('curriculum_id');
            }))
            ->orderBy('code')
            ->get(['id', 'school_id', 'curriculum_id', 'code', 'name_en', 'status'])
            ->map(fn (Subject $s) => [
                'id' => $s->id,
                'school_id' => $s->school_id,
                'curriculum_id' => $s->curriculum_id,
                'code' => $s->code,
                'name_en' => $s->name_en,
                'status' => $s->status,
            ])
            ->all();

        $grades = Grade::query()
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'))
            ->when($schoolId, fn ($q) => $q->where('school_id', $schoolId))
            ->orderBy('sequence')
            ->get(['id', 'school_id', 'code', 'name_en', 'sequence'])
            ->map(fn (Grade $g) => [
                'id' => $g->id,
                'school_id' => $g->school_id,
                'code' => $g->code,
                'name_en' => $g->name_en,
                'sequence' => (int) $g->sequence,
            ])
            ->all();

        return compact('curricula', 'subjects', 'grades');
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

        $curriculum = $this->resolveCurriculum((int) $data['curriculum_id'], $school->id);
        $subject = $this->resolveSubject((int) $data['subject_id'], $school->id, $curriculum->id);
        $grade = $this->resolveGrade((int) $data['grade_id'], $school->id);

        $chapter = Chapter::query()->create([
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'curriculum_id' => $curriculum->id,
            'subject_id' => $subject->id,
            'grade_id' => $grade->id,
            'title_en' => $data['title_en'],
            'title_ar' => $data['title_ar'] ?? $data['title_en'],
            'sequence' => (int) ($data['sequence'] ?? 1),
            'status' => $data['status'] ?? 'draft',
            'created_by' => $actorId,
            'updated_by' => $actorId,
        ]);

        return $this->show($chapter->fresh());
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function update(Chapter $chapter, array $data, ?int $actorId = null): array
    {
        $schoolId = (int) $chapter->school_id;
        $curriculumId = (int) $chapter->curriculum_id;

        if (array_key_exists('school_id', $data) && (int) $data['school_id'] !== $schoolId) {
            $school = School::query()
                ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'))
                ->findOrFail((int) $data['school_id']);
            $chapter->school_id = $school->id;
            $chapter->tenant_id = $school->tenant_id;
            $schoolId = $school->id;
        }

        if (array_key_exists('curriculum_id', $data) && $data['curriculum_id'] !== null) {
            $curriculum = $this->resolveCurriculum((int) $data['curriculum_id'], $schoolId);
            $chapter->curriculum_id = $curriculum->id;
            $curriculumId = $curriculum->id;
        }

        if (array_key_exists('subject_id', $data) && $data['subject_id'] !== null) {
            $subject = $this->resolveSubject((int) $data['subject_id'], $schoolId, $curriculumId);
            $chapter->subject_id = $subject->id;
        }

        if (array_key_exists('grade_id', $data) && $data['grade_id'] !== null) {
            $grade = $this->resolveGrade((int) $data['grade_id'], $schoolId);
            $chapter->grade_id = $grade->id;
        }

        if (array_key_exists('title_en', $data)) {
            $chapter->title_en = $data['title_en'];
        }
        if (array_key_exists('title_ar', $data)) {
            $chapter->title_ar = $data['title_ar'] ?: $chapter->title_en;
        }
        if (array_key_exists('sequence', $data)) {
            $chapter->sequence = (int) $data['sequence'];
        }
        if (array_key_exists('status', $data) && in_array($data['status'], ['draft', 'published', 'archived'], true)) {
            $chapter->status = $data['status'];
        }

        $chapter->updated_by = $actorId;
        $chapter->save();

        return $this->show($chapter->fresh());
    }

    public function delete(Chapter $chapter): void
    {
        $usage = $this->usage($chapter);
        if ($usage['lessons'] > 0) {
            throw ValidationException::withMessages([
                'chapter' => ['This chapter still has lessons and cannot be deleted. Archive it instead.'],
            ]);
        }

        $chapter->delete();
    }

    /**
     * @return array{lessons: int}
     */
    public function usage(Chapter $chapter): array
    {
        return [
            'lessons' => (int) CurriculumLesson::query()->where('chapter_id', $chapter->id)->count(),
        ];
    }

    /** @return array<string, mixed> */
    public function serialize(Chapter $chapter, bool $detailed = false): array
    {
        $usage = $this->usage($chapter);

        $payload = [
            'id' => $chapter->id,
            'title_en' => $chapter->title_en,
            'title_ar' => $chapter->title_ar,
            'sequence' => (int) $chapter->sequence,
            'status' => $chapter->status,
            'curriculum_id' => $chapter->curriculum_id,
            'subject_id' => $chapter->subject_id,
            'grade_id' => $chapter->grade_id,
            'tenant_id' => $chapter->tenant_id,
            'school_id' => $chapter->school_id,
            'tenant' => $chapter->relationLoaded('tenant') && $chapter->tenant
                ? [
                    'id' => $chapter->tenant->id,
                    'name' => $chapter->tenant->name,
                    'slug' => $chapter->tenant->slug,
                    'status' => $chapter->tenant->status,
                ]
                : null,
            'school' => $chapter->relationLoaded('school') && $chapter->school
                ? [
                    'id' => $chapter->school->id,
                    'code' => $chapter->school->code,
                    'name_en' => $chapter->school->name_en,
                    'status' => $chapter->school->status,
                ]
                : null,
            'curriculum' => $chapter->relationLoaded('curriculum') && $chapter->curriculum
                ? [
                    'id' => $chapter->curriculum->id,
                    'code' => $chapter->curriculum->code,
                    'name_en' => $chapter->curriculum->name_en,
                    'version' => $chapter->curriculum->version,
                    'status' => $chapter->curriculum->status,
                ]
                : null,
            'subject' => $chapter->relationLoaded('subject') && $chapter->subject
                ? [
                    'id' => $chapter->subject->id,
                    'code' => $chapter->subject->code,
                    'name_en' => $chapter->subject->name_en,
                    'curriculum_id' => $chapter->subject->curriculum_id,
                ]
                : null,
            'grade' => $chapter->relationLoaded('grade') && $chapter->grade
                ? [
                    'id' => $chapter->grade->id,
                    'code' => $chapter->grade->code,
                    'name_en' => $chapter->grade->name_en,
                    'sequence' => (int) $chapter->grade->sequence,
                ]
                : null,
            'usage' => $usage,
            'created_at' => optional($chapter->created_at)?->toIso8601String(),
            'updated_at' => optional($chapter->updated_at)?->toIso8601String(),
        ];

        if ($detailed) {
            $lessons = $chapter->relationLoaded('lessons')
                ? $chapter->lessons
                : $chapter->lessons()->orderBy('sequence')->limit(12)->get();

            $payload['lessons'] = $lessons->map(fn (CurriculumLesson $lesson) => [
                'id' => $lesson->id,
                'code' => $lesson->code,
                'title_en' => $lesson->title_en,
                'sequence' => $lesson->sequence,
                'status' => $lesson->status,
                'estimated_minutes' => $lesson->estimated_minutes,
            ])->all();
        }

        return $payload;
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

    protected function resolveSubject(int $subjectId, int $schoolId, int $curriculumId): Subject
    {
        $subject = Subject::query()
            ->where('id', $subjectId)
            ->where('school_id', $schoolId)
            ->where(function ($q) use ($curriculumId) {
                $q->where('curriculum_id', $curriculumId)->orWhereNull('curriculum_id');
            })
            ->first();

        if (! $subject) {
            throw ValidationException::withMessages([
                'subject_id' => ['Select a subject that belongs to this school and curriculum.'],
            ]);
        }

        return $subject;
    }

    protected function resolveGrade(int $gradeId, int $schoolId): Grade
    {
        $grade = Grade::query()
            ->where('id', $gradeId)
            ->where('school_id', $schoolId)
            ->first();

        if (! $grade) {
            throw ValidationException::withMessages([
                'grade_id' => ['Select a grade that belongs to this school.'],
            ]);
        }

        return $grade;
    }
}
