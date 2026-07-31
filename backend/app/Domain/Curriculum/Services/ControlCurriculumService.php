<?php

namespace App\Domain\Curriculum\Services;

use App\Domain\Curriculum\Models\Curriculum;
use App\Domain\Curriculum\Models\CurriculumVersionLog;
use App\Domain\Organization\Models\Country;
use Illuminate\Validation\ValidationException;

class ControlCurriculumService
{
    public function __construct(
        protected CurriculumVersioningService $versioning,
    ) {}

    /**
     * @param  array{
     *   search?: string|null,
     *   status?: string|null,
     *   country_id?: int|null,
     *   scope?: string|null,
     *   latest_only?: bool|null
     * }  $filters
     * @return list<array<string, mixed>>
     */
    public function list(array $filters = []): array
    {
        $query = Curriculum::query()->with(['country:id,code,name_en,name_ar']);

        if (($filters['status'] ?? null) !== null && $filters['status'] !== '') {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['country_id'])) {
            $query->where('country_id', (int) $filters['country_id']);
        }

        $scope = $filters['scope'] ?? 'all';
        if ($scope === 'platform') {
            $query->whereNull('school_id');
        } elseif ($scope === 'school') {
            $query->whereNotNull('school_id');
        }

        if (! empty($filters['latest_only'])) {
            $query->where('is_latest', true);
        }

        if (! empty($filters['search'])) {
            $term = '%'.trim((string) $filters['search']).'%';
            $query->where(function ($q) use ($term) {
                $q->where('code', 'like', $term)
                    ->orWhere('name_en', 'like', $term)
                    ->orWhere('name_ar', 'like', $term)
                    ->orWhere('version', 'like', $term);
            });
        }

        return $query
            ->orderByDesc('is_latest')
            ->orderBy('name_en')
            ->orderByDesc('id')
            ->get()
            ->map(fn (Curriculum $row) => $this->serialize($row))
            ->all();
    }

    /** @return array<string, mixed> */
    public function show(Curriculum $curriculum): array
    {
        $curriculum->load([
            'country:id,code,name_en,name_ar',
            'versionLogs' => fn ($q) => $q->orderByDesc('id')->limit(12),
        ]);

        return $this->serialize($curriculum, true);
    }

    /**
     * @return array<string, int>
     */
    public function stats(): array
    {
        $base = Curriculum::query();

        return [
            'total' => (int) (clone $base)->count(),
            'draft' => (int) (clone $base)->where('status', 'draft')->count(),
            'in_review' => (int) (clone $base)->where('status', 'in_review')->count(),
            'published' => (int) (clone $base)->where('status', 'published')->count(),
            'superseded' => (int) (clone $base)->where('status', 'superseded')->count(),
            'platform' => (int) (clone $base)->whereNull('school_id')->count(),
            'latest' => (int) (clone $base)->where('is_latest', true)->count(),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function create(array $data, ?int $actorId = null): array
    {
        $country = $this->resolveCountry($data);
        $code = trim((string) $data['code']);
        $version = trim((string) ($data['version'] ?? '1.0'));

        $this->assertUniqueVersion(null, $code, $version);

        Curriculum::query()
            ->whereNull('school_id')
            ->where('code', $code)
            ->update(['is_latest' => false]);

        $curriculum = Curriculum::query()->create([
            'tenant_id' => null,
            'school_id' => null,
            'country_id' => $country->id,
            'code' => $code,
            'name_en' => $data['name_en'],
            'name_ar' => $data['name_ar'] ?? $data['name_en'],
            'version' => $version,
            'status' => 'draft',
            'published_at' => null,
            'is_latest' => true,
            'change_summary_en' => $data['change_summary_en'] ?? 'Initial platform version',
            'change_summary_ar' => $data['change_summary_ar'] ?? null,
            'source_curriculum_id' => null,
            'created_by' => $actorId,
            'updated_by' => $actorId,
        ]);

        CurriculumVersionLog::query()->create([
            'tenant_id' => null,
            'school_id' => null,
            'curriculum_id' => $curriculum->id,
            'from_version' => null,
            'to_version' => $version,
            'action' => 'create',
            'summary_en' => $curriculum->change_summary_en,
            'summary_ar' => $curriculum->change_summary_ar,
            'created_by' => $actorId,
            'created_at' => now(),
        ]);

        return $this->show($curriculum->fresh());
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function update(Curriculum $curriculum, array $data, ?int $actorId = null): array
    {
        $this->versioning->assertEditable($curriculum);

        if (array_key_exists('name_en', $data)) {
            $curriculum->name_en = $data['name_en'];
        }
        if (array_key_exists('name_ar', $data)) {
            $curriculum->name_ar = $data['name_ar'] ?: $curriculum->name_en;
        }
        if (array_key_exists('change_summary_en', $data)) {
            $curriculum->change_summary_en = $data['change_summary_en'];
        }
        if (array_key_exists('change_summary_ar', $data)) {
            $curriculum->change_summary_ar = $data['change_summary_ar'];
        }
        if (array_key_exists('status', $data) && in_array($data['status'], ['draft', 'in_review'], true)) {
            $curriculum->status = $data['status'];
        }
        if (array_key_exists('country_id', $data) || array_key_exists('country_code', $data)) {
            $country = $this->resolveCountry($data);
            $curriculum->country_id = $country->id;
        }

        $curriculum->updated_by = $actorId;
        $curriculum->save();

        return $this->show($curriculum->fresh());
    }

    /** @return array<string, mixed> */
    public function publish(Curriculum $curriculum, ?string $summaryEn = null, ?string $summaryAr = null): array
    {
        $published = $this->versioning->publish($curriculum, $summaryEn, $summaryAr);

        return $this->show($published);
    }

    /** @return array<string, mixed> */
    public function newVersion(
        Curriculum $source,
        string $version,
        ?string $summaryEn = null,
        ?string $summaryAr = null,
    ): array {
        $clone = $this->versioning->createNewVersion($source, $version, $summaryEn, $summaryAr);

        return $this->show($clone);
    }

    public function delete(Curriculum $curriculum): void
    {
        if ($curriculum->status === 'published') {
            throw ValidationException::withMessages([
                'curriculum' => ['Published curricula cannot be deleted. Supersede them with a new version instead.'],
            ]);
        }

        $usage = $this->usage($curriculum);
        if ($usage['subjects'] > 0 || $usage['chapters'] > 0 || $usage['lessons'] > 0 || $usage['learning_outcomes'] > 0) {
            throw ValidationException::withMessages([
                'curriculum' => ['This curriculum still has subjects, chapters, lessons, or outcomes and cannot be deleted.'],
            ]);
        }

        $curriculum->delete();
    }

    /**
     * @return array{subjects: int, chapters: int, lessons: int, learning_outcomes: int, versions: int}
     */
    public function usage(Curriculum $curriculum): array
    {
        return [
            'subjects' => (int) $curriculum->subjects()->count(),
            'chapters' => (int) $curriculum->chapters()->count(),
            'lessons' => (int) $curriculum->lessons()->count(),
            'learning_outcomes' => (int) $curriculum->learningOutcomes()->count(),
            'versions' => (int) Curriculum::query()
                ->where(function ($q) use ($curriculum) {
                    if ($curriculum->school_id === null) {
                        $q->whereNull('school_id');
                    } else {
                        $q->where('school_id', $curriculum->school_id);
                    }
                })
                ->where('code', $curriculum->code)
                ->count(),
        ];
    }

    /** @return array<string, mixed> */
    public function serialize(Curriculum $curriculum, bool $detailed = false): array
    {
        $usage = $this->usage($curriculum);
        $country = $curriculum->relationLoaded('country') ? $curriculum->country : $curriculum->country()->first();

        $payload = [
            'id' => $curriculum->id,
            'code' => $curriculum->code,
            'name_en' => $curriculum->name_en,
            'name_ar' => $curriculum->name_ar,
            'version' => $curriculum->version,
            'status' => $curriculum->status,
            'is_latest' => (bool) $curriculum->is_latest,
            'is_platform' => $curriculum->school_id === null,
            'is_editable' => $curriculum->isEditable(),
            'country_id' => $curriculum->country_id,
            'country' => $country ? [
                'id' => $country->id,
                'code' => $country->code,
                'name_en' => $country->name_en,
                'name_ar' => $country->name_ar,
            ] : null,
            'school_id' => $curriculum->school_id,
            'tenant_id' => $curriculum->tenant_id,
            'published_at' => optional($curriculum->published_at)?->toIso8601String(),
            'change_summary_en' => $curriculum->change_summary_en,
            'change_summary_ar' => $curriculum->change_summary_ar,
            'source_curriculum_id' => $curriculum->source_curriculum_id,
            'usage' => $usage,
            'created_at' => optional($curriculum->created_at)?->toIso8601String(),
            'updated_at' => optional($curriculum->updated_at)?->toIso8601String(),
        ];

        if ($detailed) {
            $payload['version_family'] = Curriculum::query()
                ->where(function ($q) use ($curriculum) {
                    if ($curriculum->school_id === null) {
                        $q->whereNull('school_id');
                    } else {
                        $q->where('school_id', $curriculum->school_id);
                    }
                })
                ->where('code', $curriculum->code)
                ->orderByDesc('id')
                ->get(['id', 'code', 'version', 'status', 'is_latest', 'published_at', 'source_curriculum_id'])
                ->map(fn (Curriculum $row) => [
                    'id' => $row->id,
                    'code' => $row->code,
                    'version' => $row->version,
                    'status' => $row->status,
                    'is_latest' => (bool) $row->is_latest,
                    'published_at' => optional($row->published_at)?->toIso8601String(),
                    'source_curriculum_id' => $row->source_curriculum_id,
                ])
                ->all();

            $payload['version_logs'] = ($curriculum->relationLoaded('versionLogs')
                ? $curriculum->versionLogs
                : $curriculum->versionLogs()->orderByDesc('id')->limit(12)->get()
            )->map(fn (CurriculumVersionLog $log) => [
                'id' => $log->id,
                'action' => $log->action,
                'from_version' => $log->from_version,
                'to_version' => $log->to_version,
                'summary_en' => $log->summary_en,
                'summary_ar' => $log->summary_ar,
                'created_at' => optional($log->created_at)?->toIso8601String(),
            ])->all();
        }

        return $payload;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    protected function resolveCountry(array $data): Country
    {
        if (! empty($data['country_id'])) {
            return Country::query()->findOrFail((int) $data['country_id']);
        }

        if (! empty($data['country_code'])) {
            return Country::query()
                ->where('code', strtoupper(trim((string) $data['country_code'])))
                ->firstOrFail();
        }

        throw ValidationException::withMessages([
            'country_id' => ['Select a country for this curriculum.'],
        ]);
    }

    protected function assertUniqueVersion(?int $schoolId, string $code, string $version, ?int $ignoreId = null): void
    {
        $exists = Curriculum::query()
            ->when($schoolId === null, fn ($q) => $q->whereNull('school_id'), fn ($q) => $q->where('school_id', $schoolId))
            ->where('code', $code)
            ->where('version', $version)
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages([
                'version' => ['This curriculum code and version already exist in the catalogue.'],
            ]);
        }
    }
}
