<?php

namespace App\Domain\Organization\Services;

use App\Domain\Curriculum\Models\Curriculum;
use App\Domain\Organization\Models\Country;
use App\Domain\Organization\Models\School;
use App\Domain\Organization\Models\Tenant;
use Illuminate\Validation\ValidationException;

class CountryService
{
    /**
     * @param  array{search?: string|null, status?: string|null}  $filters
     * @return list<array<string, mixed>>
     */
    public function list(array $filters = []): array
    {
        $query = Country::query();

        if (($filters['status'] ?? null) === 'active') {
            $query->where('is_active', true);
        } elseif (($filters['status'] ?? null) === 'inactive') {
            $query->where('is_active', false);
        }

        if (! empty($filters['search'])) {
            $term = '%'.trim((string) $filters['search']).'%';
            $query->where(function ($q) use ($term) {
                $q->where('code', 'like', $term)
                    ->orWhere('name_en', 'like', $term)
                    ->orWhere('name_ar', 'like', $term)
                    ->orWhere('default_locale', 'like', $term)
                    ->orWhere('default_timezone', 'like', $term);
            });
        }

        return $query
            ->orderBy('name_en')
            ->get()
            ->map(fn (Country $country) => $this->serialize($country))
            ->all();
    }

    /** @return array<string, mixed> */
    public function show(Country $country): array
    {
        return $this->serialize($country, true);
    }

    /**
     * @return array<string, int>
     */
    public function stats(): array
    {
        $base = Country::query();

        return [
            'total' => (int) (clone $base)->count(),
            'active' => (int) (clone $base)->where('is_active', true)->count(),
            'inactive' => (int) (clone $base)->where('is_active', false)->count(),
            'with_curricula' => (int) Curriculum::query()
                ->whereNotNull('country_id')
                ->distinct('country_id')
                ->count('country_id'),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function create(array $data, ?int $actorId = null): array
    {
        $code = strtoupper(trim((string) $data['code']));
        if (! preg_match('/^[A-Z]{2}$/', $code)) {
            throw ValidationException::withMessages([
                'code' => ['Country code must be a 2-letter ISO code (e.g. SA, AE).'],
            ]);
        }

        $existing = Country::withTrashed()->where('code', $code)->first();
        if ($existing && ! $existing->trashed()) {
            throw ValidationException::withMessages([
                'code' => ['A country with this code already exists.'],
            ]);
        }

        if ($existing?->trashed()) {
            $existing->restore();
            return $this->update($existing, [
                'name_en' => $data['name_en'],
                'name_ar' => $data['name_ar'] ?? $data['name_en'],
                'default_locale' => $data['default_locale'] ?? 'en',
                'default_timezone' => $data['default_timezone'] ?? 'UTC',
                'is_active' => array_key_exists('is_active', $data)
                    ? (bool) $data['is_active']
                    : true,
            ], $actorId);
        }

        $country = Country::query()->create([
            'code' => $code,
            'name_en' => $data['name_en'],
            'name_ar' => $data['name_ar'] ?? $data['name_en'],
            'default_locale' => $data['default_locale'] ?? 'en',
            'default_timezone' => $data['default_timezone'] ?? 'UTC',
            'is_active' => array_key_exists('is_active', $data)
                ? (bool) $data['is_active']
                : true,
            'created_by' => $actorId,
            'updated_by' => $actorId,
        ]);

        return $this->show($country->fresh());
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function update(Country $country, array $data, ?int $actorId = null): array
    {
        if (array_key_exists('code', $data) && $data['code'] !== null) {
            $code = strtoupper(trim((string) $data['code']));
            if ($code !== $country->code) {
                $this->assertUniqueCode($code, $country->id);
                $country->code = $code;
            }
        }

        if (array_key_exists('name_en', $data)) {
            $country->name_en = $data['name_en'];
        }
        if (array_key_exists('name_ar', $data)) {
            $country->name_ar = $data['name_ar'] ?: $country->name_en;
        }
        if (array_key_exists('default_locale', $data)) {
            $country->default_locale = $data['default_locale'] ?: 'en';
        }
        if (array_key_exists('default_timezone', $data)) {
            $country->default_timezone = $data['default_timezone'] ?: 'UTC';
        }
        if (array_key_exists('is_active', $data)) {
            $country->is_active = (bool) $data['is_active'];
        }

        $country->updated_by = $actorId;
        $country->save();

        return $this->show($country->fresh());
    }

    public function delete(Country $country): void
    {
        $usage = $this->usage($country);
        if ($usage['curricula'] > 0 || $usage['schools'] > 0 || $usage['tenants'] > 0) {
            throw ValidationException::withMessages([
                'country' => [
                    'This country is in use by curricula, schools, or organisations and cannot be deleted. Deactivate it instead.',
                ],
            ]);
        }

        $country->delete();
    }

    /**
     * @return array{curricula: int, schools: int, tenants: int}
     */
    public function usage(Country $country): array
    {
        return [
            'curricula' => (int) Curriculum::query()->where('country_id', $country->id)->count(),
            'schools' => (int) School::query()->where('country_id', $country->id)->count(),
            'tenants' => (int) Tenant::query()->where('primary_country_id', $country->id)->count(),
        ];
    }

    /** @return array<string, mixed> */
    public function serialize(Country $country, bool $detailed = false): array
    {
        $usage = $this->usage($country);

        $payload = [
            'id' => $country->id,
            'code' => $country->code,
            'name_en' => $country->name_en,
            'name_ar' => $country->name_ar,
            'default_locale' => $country->default_locale,
            'default_timezone' => $country->default_timezone,
            'is_active' => (bool) $country->is_active,
            'status' => $country->is_active ? 'active' : 'inactive',
            'usage' => $usage,
            'created_at' => optional($country->created_at)?->toIso8601String(),
            'updated_at' => optional($country->updated_at)?->toIso8601String(),
        ];

        if ($detailed) {
            $payload['curricula'] = Curriculum::query()
                ->where('country_id', $country->id)
                ->orderBy('name_en')
                ->limit(12)
                ->get(['id', 'code', 'name_en', 'name_ar', 'status', 'version'])
                ->map(fn ($c) => [
                    'id' => $c->id,
                    'code' => $c->code,
                    'name_en' => $c->name_en,
                    'name_ar' => $c->name_ar,
                    'status' => $c->status,
                    'version' => $c->version,
                ])
                ->all();
        }

        return $payload;
    }

    protected function assertUniqueCode(string $code, ?int $ignoreId = null): void
    {
        if (! preg_match('/^[A-Z]{2}$/', $code)) {
            throw ValidationException::withMessages([
                'code' => ['Country code must be a 2-letter ISO code (e.g. SA, AE).'],
            ]);
        }

        $exists = Country::withTrashed()
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
            ->where('code', $code)
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages([
                'code' => ['A country with this code already exists.'],
            ]);
        }
    }
}
