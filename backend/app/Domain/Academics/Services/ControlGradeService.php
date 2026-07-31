<?php

namespace App\Domain\Academics\Services;

use App\Domain\Academics\Models\ClassSection;
use App\Domain\Academics\Models\Grade;
use App\Domain\Academics\Models\SchoolClass;
use App\Domain\Curriculum\Models\Chapter;
use App\Domain\Organization\Models\School;
use App\Domain\Organization\Models\Tenant;
use Illuminate\Validation\ValidationException;

class ControlGradeService
{
    /**
     * @param  array{
     *   search?: string|null,
     *   tenant_id?: int|null,
     *   school_id?: int|null
     * }  $filters
     * @return list<array<string, mixed>>
     */
    public function list(array $filters = []): array
    {
        $query = Grade::query()
            ->with([
                'school:id,tenant_id,code,name_en,name_ar,status',
                'tenant:id,slug,name,status',
            ])
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'));

        if (! empty($filters['tenant_id'])) {
            $query->where('tenant_id', (int) $filters['tenant_id']);
        }

        if (! empty($filters['school_id'])) {
            $query->where('school_id', (int) $filters['school_id']);
        }

        if (! empty($filters['search'])) {
            $term = '%'.trim((string) $filters['search']).'%';
            $query->where(function ($q) use ($term) {
                $q->where('code', 'like', $term)
                    ->orWhere('name_en', 'like', $term)
                    ->orWhere('name_ar', 'like', $term)
                    ->orWhereHas('school', fn ($sq) => $sq->where('name_en', 'like', $term)->orWhere('code', 'like', $term))
                    ->orWhereHas('tenant', fn ($tq) => $tq->where('name', 'like', $term)->orWhere('slug', 'like', $term));
            });
        }

        return $query
            ->orderBy('school_id')
            ->orderBy('sequence')
            ->orderBy('name_en')
            ->get()
            ->map(fn (Grade $grade) => $this->serialize($grade))
            ->all();
    }

    /** @return array<string, mixed> */
    public function show(Grade $grade): array
    {
        $grade->load([
            'school:id,tenant_id,code,name_en,name_ar,status',
            'tenant:id,slug,name,status',
        ]);

        return $this->serialize($grade, true);
    }

    /**
     * @return array<string, int>
     */
    public function stats(): array
    {
        $base = Grade::query()
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'));

        return [
            'total' => (int) (clone $base)->count(),
            'schools' => (int) (clone $base)->distinct('school_id')->count('school_id'),
            'tenants' => (int) (clone $base)->distinct('tenant_id')->count('tenant_id'),
            'with_classes' => (int) SchoolClass::query()
                ->whereNotNull('grade_id')
                ->distinct('grade_id')
                ->count('grade_id'),
            'with_chapters' => (int) Chapter::query()
                ->whereNotNull('grade_id')
                ->distinct('grade_id')
                ->count('grade_id'),
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
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function create(array $data, ?int $actorId = null): array
    {
        $school = School::query()
            ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'))
            ->findOrFail((int) $data['school_id']);

        $code = strtoupper(trim((string) $data['code']));
        $existing = Grade::withTrashed()
            ->where('school_id', $school->id)
            ->where('code', $code)
            ->first();

        if ($existing && ! $existing->trashed()) {
            throw ValidationException::withMessages([
                'code' => ['A grade with this code already exists for the selected school.'],
            ]);
        }

        if ($existing?->trashed()) {
            $existing->restore();

            return $this->update($existing, [
                'name_en' => $data['name_en'],
                'name_ar' => $data['name_ar'] ?? $data['name_en'],
                'sequence' => (int) ($data['sequence'] ?? 0),
            ], $actorId);
        }

        $grade = Grade::query()->create([
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'code' => $code,
            'name_en' => $data['name_en'],
            'name_ar' => $data['name_ar'] ?? $data['name_en'],
            'sequence' => (int) ($data['sequence'] ?? 0),
            'created_by' => $actorId,
            'updated_by' => $actorId,
        ]);

        return $this->show($grade->fresh());
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function update(Grade $grade, array $data, ?int $actorId = null): array
    {
        if (array_key_exists('school_id', $data) && (int) $data['school_id'] !== (int) $grade->school_id) {
            $school = School::query()
                ->whereHas('tenant', fn ($q) => $q->where('slug', '!=', 'platform'))
                ->findOrFail((int) $data['school_id']);
            $grade->school_id = $school->id;
            $grade->tenant_id = $school->tenant_id;
        }

        if (array_key_exists('code', $data) && $data['code'] !== null) {
            $code = strtoupper(trim((string) $data['code']));
            if ($code !== $grade->code) {
                $this->assertUniqueCode((int) $grade->school_id, $code, $grade->id);
                $grade->code = $code;
            }
        }

        if (array_key_exists('name_en', $data)) {
            $grade->name_en = $data['name_en'];
        }
        if (array_key_exists('name_ar', $data)) {
            $grade->name_ar = $data['name_ar'] ?: $grade->name_en;
        }
        if (array_key_exists('sequence', $data)) {
            $grade->sequence = (int) $data['sequence'];
        }

        $grade->updated_by = $actorId;
        $grade->save();

        return $this->show($grade->fresh());
    }

    public function delete(Grade $grade): void
    {
        $usage = $this->usage($grade);
        if ($usage['classes'] > 0 || $usage['sections'] > 0 || $usage['chapters'] > 0) {
            throw ValidationException::withMessages([
                'grade' => [
                    'This grade is in use by classes, sections, or curriculum chapters and cannot be deleted.',
                ],
            ]);
        }

        $grade->delete();
    }

    /**
     * @return array{classes: int, sections: int, chapters: int}
     */
    public function usage(Grade $grade): array
    {
        return [
            'classes' => (int) SchoolClass::query()->where('grade_id', $grade->id)->count(),
            'sections' => (int) ClassSection::query()->where('grade_id', $grade->id)->count(),
            'chapters' => (int) Chapter::query()->where('grade_id', $grade->id)->count(),
        ];
    }

    /** @return array<string, mixed> */
    public function serialize(Grade $grade, bool $detailed = false): array
    {
        $usage = $this->usage($grade);

        $payload = [
            'id' => $grade->id,
            'code' => $grade->code,
            'name_en' => $grade->name_en,
            'name_ar' => $grade->name_ar,
            'sequence' => (int) $grade->sequence,
            'tenant_id' => $grade->tenant_id,
            'school_id' => $grade->school_id,
            'tenant' => $grade->relationLoaded('tenant') && $grade->tenant
                ? [
                    'id' => $grade->tenant->id,
                    'name' => $grade->tenant->name,
                    'slug' => $grade->tenant->slug,
                    'status' => $grade->tenant->status,
                ]
                : null,
            'school' => $grade->relationLoaded('school') && $grade->school
                ? [
                    'id' => $grade->school->id,
                    'code' => $grade->school->code,
                    'name_en' => $grade->school->name_en,
                    'name_ar' => $grade->school->name_ar ?? null,
                    'status' => $grade->school->status,
                ]
                : null,
            'usage' => $usage,
            'created_at' => optional($grade->created_at)?->toIso8601String(),
            'updated_at' => optional($grade->updated_at)?->toIso8601String(),
        ];

        if ($detailed) {
            $payload['sibling_grades'] = Grade::query()
                ->where('school_id', $grade->school_id)
                ->orderBy('sequence')
                ->get(['id', 'code', 'name_en', 'sequence'])
                ->map(fn (Grade $row) => [
                    'id' => $row->id,
                    'code' => $row->code,
                    'name_en' => $row->name_en,
                    'sequence' => (int) $row->sequence,
                ])
                ->all();
        }

        return $payload;
    }

    protected function assertUniqueCode(int $schoolId, string $code, ?int $ignoreId = null): void
    {
        $exists = Grade::withTrashed()
            ->where('school_id', $schoolId)
            ->where('code', $code)
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages([
                'code' => ['A grade with this code already exists for the selected school.'],
            ]);
        }
    }
}
