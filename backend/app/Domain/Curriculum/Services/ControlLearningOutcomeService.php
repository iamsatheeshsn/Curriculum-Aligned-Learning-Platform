<?php

namespace App\Domain\Curriculum\Services;

use App\Domain\Academics\Models\Subject;
use App\Domain\Curriculum\Models\Curriculum;
use App\Domain\Curriculum\Models\CurriculumLesson;
use App\Domain\Curriculum\Models\LearningOutcome;
use App\Domain\Organization\Models\School;
use App\Domain\Organization\Models\Tenant;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ControlLearningOutcomeService
{
    /**
     * @param  array{
     *   search?: string|null,
     *   status?: string|null,
     *   tenant_id?: int|null,
     *   school_id?: int|null,
     *   curriculum_id?: int|null,
     *   subject_id?: int|null
     * }  $filters
     * @return list<array<string, mixed>>
     */
    public function list(array $filters = []): array
    {
        $query = LearningOutcome::query()
            ->with([
                'school:id,tenant_id,code,name_en,name_ar,status',
                'tenant:id,slug,name,status',
                'curriculum:id,code,name_en,version,status',
                'subject:id,code,name_en,curriculum_id',
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

        if (! empty($filters['search'])) {
            $term = '%'.trim((string) $filters['search']).'%';
            $query->where(function ($q) use ($term) {
                $q->where('code', 'like', $term)
                    ->orWhere('statement_en', 'like', $term)
                    ->orWhere('statement_ar', 'like', $term)
                    ->orWhereHas('subject', fn ($sq) => $sq->where('code', 'like', $term)->orWhere('name_en', 'like', $term))
                    ->orWhereHas('curriculum', fn ($cq) => $cq->where('code', 'like', $term)->orWhere('name_en', 'like', $term));
            });
        }

        return $query
            ->orderBy('school_id')
            ->orderBy('curriculum_id')
            ->orderBy('code')
            ->get()
            ->map(fn (LearningOutcome $outcome) => $this->serialize($outcome))
            ->all();
    }

    /** @return array<string, mixed> */
    public function show(LearningOutcome $outcome): array
    {
        $outcome->load([
            'school:id,tenant_id,code,name_en,name_ar,status',
            'tenant:id,slug,name,status',
            'curriculum:id,code,name_en,version,status',
            'subject:id,code,name_en,curriculum_id',
            'lessons' => fn ($q) => $q->orderBy('sequence')->limit(12),
        ]);

        return $this->serialize($outcome, true);
    }

    /**
     * @return array<string, int>
     */
    public function stats(): array
    {
        $base = LearningOutcome::query()
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'));

        return [
            'total' => (int) (clone $base)->count(),
            'active' => (int) (clone $base)->where('status', 'active')->count(),
            'archived' => (int) (clone $base)->where('status', 'archived')->count(),
            'with_lessons' => (int) (clone $base)->whereHas('lessons')->count(),
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
     *   subjects: list<array<string, mixed>>
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

        return compact('curricula', 'subjects');
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
        $subjectId = null;
        if (! empty($data['subject_id'])) {
            $subject = $this->resolveSubject((int) $data['subject_id'], $school->id, $curriculum->id);
            $subjectId = $subject->id;
        }

        $code = trim((string) $data['code']);
        $existing = LearningOutcome::withTrashed()
            ->where('school_id', $school->id)
            ->where('curriculum_id', $curriculum->id)
            ->where('code', $code)
            ->first();

        if ($existing && ! $existing->trashed()) {
            throw ValidationException::withMessages([
                'code' => ['A learning outcome with this code already exists for this curriculum.'],
            ]);
        }

        if ($existing && $existing->trashed()) {
            $existing->restore();
            $existing->fill([
                'tenant_id' => $school->tenant_id,
                'school_id' => $school->id,
                'curriculum_id' => $curriculum->id,
                'subject_id' => $subjectId,
                'code' => $code,
                'statement_en' => $data['statement_en'],
                'statement_ar' => $data['statement_ar'] ?? $data['statement_en'],
                'status' => $data['status'] ?? 'active',
                'updated_by' => $actorId,
            ]);
            $existing->save();

            return $this->show($existing->fresh());
        }

        $outcome = LearningOutcome::query()->create([
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'curriculum_id' => $curriculum->id,
            'subject_id' => $subjectId,
            'code' => $code,
            'statement_en' => $data['statement_en'],
            'statement_ar' => $data['statement_ar'] ?? $data['statement_en'],
            'status' => $data['status'] ?? 'active',
            'created_by' => $actorId,
            'updated_by' => $actorId,
        ]);

        return $this->show($outcome->fresh());
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function update(LearningOutcome $outcome, array $data, ?int $actorId = null): array
    {
        $schoolId = (int) $outcome->school_id;
        $curriculumId = (int) $outcome->curriculum_id;

        if (array_key_exists('school_id', $data) && (int) $data['school_id'] !== $schoolId) {
            $school = School::query()
                ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'))
                ->findOrFail((int) $data['school_id']);
            $outcome->school_id = $school->id;
            $outcome->tenant_id = $school->tenant_id;
            $schoolId = $school->id;
        }

        if (array_key_exists('curriculum_id', $data) && $data['curriculum_id'] !== null) {
            $curriculum = $this->resolveCurriculum((int) $data['curriculum_id'], $schoolId);
            $outcome->curriculum_id = $curriculum->id;
            $curriculumId = $curriculum->id;
        }

        if (array_key_exists('subject_id', $data)) {
            if ($data['subject_id'] === null || $data['subject_id'] === '') {
                $outcome->subject_id = null;
            } else {
                $subject = $this->resolveSubject((int) $data['subject_id'], $schoolId, $curriculumId);
                $outcome->subject_id = $subject->id;
            }
        }

        if (array_key_exists('code', $data) && $data['code'] !== null) {
            $code = trim((string) $data['code']);
            $dup = LearningOutcome::withTrashed()
                ->where('school_id', $schoolId)
                ->where('curriculum_id', $curriculumId)
                ->where('code', $code)
                ->where('id', '!=', $outcome->id)
                ->whereNull('deleted_at')
                ->exists();
            if ($dup) {
                throw ValidationException::withMessages([
                    'code' => ['A learning outcome with this code already exists for this curriculum.'],
                ]);
            }
            $outcome->code = $code;
        }

        if (array_key_exists('statement_en', $data)) {
            $outcome->statement_en = $data['statement_en'];
        }
        if (array_key_exists('statement_ar', $data)) {
            $outcome->statement_ar = $data['statement_ar'] ?: $outcome->statement_en;
        }
        if (array_key_exists('status', $data) && in_array($data['status'], ['active', 'archived'], true)) {
            $outcome->status = $data['status'];
        }

        $outcome->updated_by = $actorId;
        $outcome->save();

        return $this->show($outcome->fresh());
    }

    public function delete(LearningOutcome $outcome): void
    {
        $usage = $this->usage($outcome);
        if ($usage['lessons'] > 0 || $usage['questions'] > 0) {
            throw ValidationException::withMessages([
                'outcome' => ['This learning outcome is still linked to lessons or questions and cannot be deleted. Archive it instead.'],
            ]);
        }

        $outcome->delete();
    }

    /**
     * @return array{lessons: int, questions: int}
     */
    public function usage(LearningOutcome $outcome): array
    {
        return [
            'lessons' => (int) $outcome->lessons()->count(),
            'questions' => (int) DB::table('question_outcomes')
                ->where('learning_outcome_id', $outcome->id)
                ->count(),
        ];
    }

    /** @return array<string, mixed> */
    public function serialize(LearningOutcome $outcome, bool $detailed = false): array
    {
        $usage = $this->usage($outcome);

        $payload = [
            'id' => $outcome->id,
            'code' => $outcome->code,
            'statement_en' => $outcome->statement_en,
            'statement_ar' => $outcome->statement_ar,
            'status' => $outcome->status,
            'curriculum_id' => $outcome->curriculum_id,
            'subject_id' => $outcome->subject_id,
            'tenant_id' => $outcome->tenant_id,
            'school_id' => $outcome->school_id,
            'tenant' => $outcome->relationLoaded('tenant') && $outcome->tenant
                ? [
                    'id' => $outcome->tenant->id,
                    'name' => $outcome->tenant->name,
                    'slug' => $outcome->tenant->slug,
                    'status' => $outcome->tenant->status,
                ]
                : null,
            'school' => $outcome->relationLoaded('school') && $outcome->school
                ? [
                    'id' => $outcome->school->id,
                    'code' => $outcome->school->code,
                    'name_en' => $outcome->school->name_en,
                    'status' => $outcome->school->status,
                ]
                : null,
            'curriculum' => $outcome->relationLoaded('curriculum') && $outcome->curriculum
                ? [
                    'id' => $outcome->curriculum->id,
                    'code' => $outcome->curriculum->code,
                    'name_en' => $outcome->curriculum->name_en,
                    'version' => $outcome->curriculum->version,
                    'status' => $outcome->curriculum->status,
                ]
                : null,
            'subject' => $outcome->relationLoaded('subject') && $outcome->subject
                ? [
                    'id' => $outcome->subject->id,
                    'code' => $outcome->subject->code,
                    'name_en' => $outcome->subject->name_en,
                    'curriculum_id' => $outcome->subject->curriculum_id,
                ]
                : null,
            'usage' => $usage,
            'created_at' => optional($outcome->created_at)?->toIso8601String(),
            'updated_at' => optional($outcome->updated_at)?->toIso8601String(),
        ];

        if ($detailed) {
            $lessons = $outcome->relationLoaded('lessons')
                ? $outcome->lessons
                : $outcome->lessons()->orderBy('sequence')->limit(12)->get();

            $payload['lessons'] = $lessons->map(fn (CurriculumLesson $lesson) => [
                'id' => $lesson->id,
                'code' => $lesson->code,
                'title_en' => $lesson->title_en,
                'sequence' => $lesson->sequence,
                'status' => $lesson->status,
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
}
