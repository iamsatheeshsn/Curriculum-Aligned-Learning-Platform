<?php

namespace App\Domain\Academics\Services;

use App\Domain\Academics\Models\Subject;
use App\Domain\Curriculum\Models\Chapter;
use App\Domain\Curriculum\Models\Curriculum;
use App\Domain\Curriculum\Models\LearningOutcome;
use App\Domain\Organization\Models\School;
use App\Domain\Organization\Models\Tenant;
use Illuminate\Validation\ValidationException;

class ControlSubjectService
{
    /**
     * @param  array{
     *   search?: string|null,
     *   status?: string|null,
     *   tenant_id?: int|null,
     *   school_id?: int|null,
     *   curriculum_id?: int|null,
     *   stem_only?: bool|null
     * }  $filters
     * @return list<array<string, mixed>>
     */
    public function list(array $filters = []): array
    {
        $query = Subject::query()
            ->with([
                'school:id,tenant_id,code,name_en,name_ar,status',
                'tenant:id,slug,name,status',
                'curriculum:id,code,name_en,version,status',
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

        if (array_key_exists('curriculum_id', $filters) && $filters['curriculum_id'] !== null && $filters['curriculum_id'] !== '') {
            if ((int) $filters['curriculum_id'] === 0) {
                $query->whereNull('curriculum_id');
            } else {
                $query->where('curriculum_id', (int) $filters['curriculum_id']);
            }
        }

        if (! empty($filters['stem_only'])) {
            $query->where('is_stem', true);
        }

        if (! empty($filters['search'])) {
            $term = '%'.trim((string) $filters['search']).'%';
            $query->where(function ($q) use ($term) {
                $q->where('code', 'like', $term)
                    ->orWhere('name_en', 'like', $term)
                    ->orWhere('name_ar', 'like', $term)
                    ->orWhereHas('school', fn ($sq) => $sq->where('name_en', 'like', $term)->orWhere('code', 'like', $term))
                    ->orWhereHas('curriculum', fn ($cq) => $cq->where('code', 'like', $term)->orWhere('name_en', 'like', $term));
            });
        }

        return $query
            ->orderBy('school_id')
            ->orderBy('code')
            ->orderByDesc('id')
            ->get()
            ->map(fn (Subject $subject) => $this->serialize($subject))
            ->all();
    }

    /** @return array<string, mixed> */
    public function show(Subject $subject): array
    {
        $subject->load([
            'school:id,tenant_id,code,name_en,name_ar,status',
            'tenant:id,slug,name,status',
            'curriculum:id,code,name_en,version,status',
        ]);

        return $this->serialize($subject, true);
    }

    /**
     * @return array<string, int>
     */
    public function stats(): array
    {
        $base = Subject::query()
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'));

        return [
            'total' => (int) (clone $base)->count(),
            'active' => (int) (clone $base)->where('status', 'active')->count(),
            'archived' => (int) (clone $base)->where('status', 'archived')->count(),
            'stem' => (int) (clone $base)->where('is_stem', true)->count(),
            'with_curriculum' => (int) (clone $base)->whereNotNull('curriculum_id')->count(),
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
     * @return list<array{id: int, school_id: int|null, code: string, name_en: string, version: string, status: string}>
     */
    public function availableCurricula(?int $schoolId = null): array
    {
        return Curriculum::query()
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

        $code = strtoupper(trim((string) $data['code']));
        $curriculumId = ! empty($data['curriculum_id']) ? (int) $data['curriculum_id'] : null;
        $this->assertCurriculumBelongsToSchool($curriculumId, $school->id);

        $existing = $this->findByUniqueKey($school->id, $curriculumId, $code, true);
        if ($existing && ! $existing->trashed()) {
            throw ValidationException::withMessages([
                'code' => ['A subject with this code already exists for the selected school and curriculum.'],
            ]);
        }

        if ($existing?->trashed()) {
            $existing->restore();

            return $this->update($existing, [
                'name_en' => $data['name_en'],
                'name_ar' => $data['name_ar'] ?? $data['name_en'],
                'is_stem' => $data['is_stem'] ?? true,
                'tutoring_enabled' => $data['tutoring_enabled'] ?? true,
                'status' => $data['status'] ?? 'active',
            ], $actorId);
        }

        $subject = Subject::query()->create([
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'curriculum_id' => $curriculumId,
            'code' => $code,
            'name_en' => $data['name_en'],
            'name_ar' => $data['name_ar'] ?? $data['name_en'],
            'is_stem' => array_key_exists('is_stem', $data) ? (bool) $data['is_stem'] : true,
            'tutoring_enabled' => array_key_exists('tutoring_enabled', $data)
                ? (bool) $data['tutoring_enabled']
                : true,
            'status' => $data['status'] ?? 'active',
            'created_by' => $actorId,
            'updated_by' => $actorId,
        ]);

        return $this->show($subject->fresh());
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function update(Subject $subject, array $data, ?int $actorId = null): array
    {
        if (array_key_exists('school_id', $data) && (int) $data['school_id'] !== (int) $subject->school_id) {
            $school = School::query()
                ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'))
                ->findOrFail((int) $data['school_id']);
            $subject->school_id = $school->id;
            $subject->tenant_id = $school->tenant_id;
        }

        $curriculumId = $subject->curriculum_id;
        if (array_key_exists('curriculum_id', $data)) {
            $curriculumId = $data['curriculum_id'] !== null && $data['curriculum_id'] !== ''
                ? (int) $data['curriculum_id']
                : null;
            $this->assertCurriculumBelongsToSchool($curriculumId, (int) $subject->school_id);
            $subject->curriculum_id = $curriculumId;
        }

        if (array_key_exists('code', $data) && $data['code'] !== null) {
            $code = strtoupper(trim((string) $data['code']));
            if ($code !== $subject->code || $curriculumId !== $subject->getOriginal('curriculum_id')) {
                $conflict = $this->findByUniqueKey((int) $subject->school_id, $curriculumId, $code, true);
                if ($conflict && $conflict->id !== $subject->id && ! $conflict->trashed()) {
                    throw ValidationException::withMessages([
                        'code' => ['A subject with this code already exists for the selected school and curriculum.'],
                    ]);
                }
                $subject->code = $code;
            }
        }

        if (array_key_exists('name_en', $data)) {
            $subject->name_en = $data['name_en'];
        }
        if (array_key_exists('name_ar', $data)) {
            $subject->name_ar = $data['name_ar'] ?: $subject->name_en;
        }
        if (array_key_exists('is_stem', $data)) {
            $subject->is_stem = (bool) $data['is_stem'];
        }
        if (array_key_exists('tutoring_enabled', $data)) {
            $subject->tutoring_enabled = (bool) $data['tutoring_enabled'];
        }
        if (array_key_exists('status', $data) && in_array($data['status'], ['active', 'archived'], true)) {
            $subject->status = $data['status'];
        }

        $subject->updated_by = $actorId;
        $subject->save();

        return $this->show($subject->fresh());
    }

    public function delete(Subject $subject): void
    {
        $usage = $this->usage($subject);
        if ($usage['chapters'] > 0 || $usage['learning_outcomes'] > 0) {
            throw ValidationException::withMessages([
                'subject' => [
                    'This subject is in use by chapters or learning outcomes and cannot be deleted. Archive it instead.',
                ],
            ]);
        }

        $subject->delete();
    }

    /**
     * @return array{chapters: int, learning_outcomes: int}
     */
    public function usage(Subject $subject): array
    {
        return [
            'chapters' => (int) Chapter::query()->where('subject_id', $subject->id)->count(),
            'learning_outcomes' => (int) LearningOutcome::query()->where('subject_id', $subject->id)->count(),
        ];
    }

    /** @return array<string, mixed> */
    public function serialize(Subject $subject, bool $detailed = false): array
    {
        $usage = $this->usage($subject);

        $payload = [
            'id' => $subject->id,
            'code' => $subject->code,
            'name_en' => $subject->name_en,
            'name_ar' => $subject->name_ar,
            'is_stem' => (bool) $subject->is_stem,
            'tutoring_enabled' => (bool) $subject->tutoring_enabled,
            'status' => $subject->status,
            'curriculum_id' => $subject->curriculum_id,
            'tenant_id' => $subject->tenant_id,
            'school_id' => $subject->school_id,
            'tenant' => $subject->relationLoaded('tenant') && $subject->tenant
                ? [
                    'id' => $subject->tenant->id,
                    'name' => $subject->tenant->name,
                    'slug' => $subject->tenant->slug,
                    'status' => $subject->tenant->status,
                ]
                : null,
            'school' => $subject->relationLoaded('school') && $subject->school
                ? [
                    'id' => $subject->school->id,
                    'code' => $subject->school->code,
                    'name_en' => $subject->school->name_en,
                    'name_ar' => $subject->school->name_ar ?? null,
                    'status' => $subject->school->status,
                ]
                : null,
            'curriculum' => $subject->relationLoaded('curriculum') && $subject->curriculum
                ? [
                    'id' => $subject->curriculum->id,
                    'code' => $subject->curriculum->code,
                    'name_en' => $subject->curriculum->name_en,
                    'version' => $subject->curriculum->version,
                    'status' => $subject->curriculum->status,
                ]
                : null,
            'usage' => $usage,
            'created_at' => optional($subject->created_at)?->toIso8601String(),
            'updated_at' => optional($subject->updated_at)?->toIso8601String(),
        ];

        if ($detailed) {
            $payload['recent_chapters'] = Chapter::query()
                ->where('subject_id', $subject->id)
                ->orderBy('sequence')
                ->limit(8)
                ->get(['id', 'title_en', 'sequence', 'status', 'grade_id'])
                ->map(fn (Chapter $ch) => [
                    'id' => $ch->id,
                    'title_en' => $ch->title_en,
                    'sequence' => $ch->sequence,
                    'status' => $ch->status,
                    'grade_id' => $ch->grade_id,
                ])
                ->all();
        }

        return $payload;
    }

    protected function assertCurriculumBelongsToSchool(?int $curriculumId, int $schoolId): void
    {
        if ($curriculumId === null) {
            return;
        }

        $ok = Curriculum::query()
            ->where('id', $curriculumId)
            ->where(function ($q) use ($schoolId) {
                $q->where('school_id', $schoolId)->orWhereNull('school_id');
            })
            ->exists();

        if (! $ok) {
            throw ValidationException::withMessages([
                'curriculum_id' => ['Select a curriculum that belongs to this school (or a platform template).'],
            ]);
        }
    }

    protected function findByUniqueKey(
        int $schoolId,
        ?int $curriculumId,
        string $code,
        bool $withTrashed = false,
    ): ?Subject {
        $query = $withTrashed ? Subject::withTrashed() : Subject::query();

        return $query
            ->where('school_id', $schoolId)
            ->where('code', $code)
            ->when(
                $curriculumId === null,
                fn ($q) => $q->whereNull('curriculum_id'),
                fn ($q) => $q->where('curriculum_id', $curriculumId)
            )
            ->first();
    }
}
