<?php

namespace App\Domain\Billing\Services;

use App\Domain\Billing\Models\BillingTax;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ControlTaxService
{
    /** @param  array{search?: ?string, status?: ?string}  $filters
     *  @return list<array<string, mixed>>
     */
    public function list(array $filters = []): array
    {
        return BillingTax::query()
            ->when($filters['search'] ?? null, function ($q, $search) {
                $like = '%'.$search.'%';
                $q->where(function ($inner) use ($like) {
                    $inner->where('code', 'like', $like)
                        ->orWhere('name_en', 'like', $like)
                        ->orWhere('name_ar', 'like', $like)
                        ->orWhere('country_code', 'like', $like);
                });
            })
            ->when(($filters['status'] ?? null) === 'active', fn ($q) => $q->where('is_active', true))
            ->when(($filters['status'] ?? null) === 'inactive', fn ($q) => $q->where('is_active', false))
            ->orderBy('code')
            ->get()
            ->map(fn (BillingTax $t) => $this->serialize($t))
            ->all();
    }

    /** @return array{total: int, active: int, inactive: int, average_rate: float} */
    public function stats(): array
    {
        $base = BillingTax::query();
        $active = (clone $base)->where('is_active', true);

        return [
            'total' => (int) (clone $base)->count(),
            'active' => (int) (clone $active)->count(),
            'inactive' => (int) (clone $base)->where('is_active', false)->count(),
            'average_rate' => round((float) (clone $active)->avg('rate_percent'), 4),
        ];
    }

    /** @return array<string, mixed> */
    public function show(BillingTax $tax): array
    {
        return $this->serialize($tax);
    }

    /** @param  array<string, mixed>  $data
     *  @return array<string, mixed>
     */
    public function create(array $data, int $actorId): array
    {
        $code = strtoupper(trim((string) $data['code']));
        $trashed = BillingTax::withTrashed()->where('code', $code)->first();
        if ($trashed && ! $trashed->trashed()) {
            throw ValidationException::withMessages(['code' => ['Tax code already exists.']]);
        }

        $payload = $this->normalize($data, $code);

        $tax = DB::transaction(function () use ($trashed, $payload, $actorId) {
            if ($trashed?->trashed()) {
                $trashed->restore();
                $trashed->fill($payload);
                $trashed->updated_by = $actorId;
                $trashed->save();

                return $trashed;
            }

            return BillingTax::query()->create([
                ...$payload,
                'created_by' => $actorId,
                'updated_by' => $actorId,
            ]);
        });

        return $this->show($tax->fresh());
    }

    /** @param  array<string, mixed>  $data
     *  @return array<string, mixed>
     */
    public function update(BillingTax $tax, array $data, int $actorId): array
    {
        $code = array_key_exists('code', $data)
            ? strtoupper(trim((string) $data['code']))
            : $tax->code;

        if ($code !== $tax->code) {
            $exists = BillingTax::withTrashed()->where('code', $code)->where('id', '!=', $tax->id)->exists();
            if ($exists) {
                throw ValidationException::withMessages(['code' => ['Tax code already exists.']]);
            }
        }

        $tax->fill($this->normalize($data, $code, $tax));
        $tax->updated_by = $actorId;
        $tax->save();

        return $this->show($tax->fresh());
    }

    public function delete(BillingTax $tax): void
    {
        $tax->delete();
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    protected function normalize(array $data, string $code, ?BillingTax $existing = null): array
    {
        $country = $data['country_code'] ?? $existing?->country_code;
        if (is_string($country) && $country !== '') {
            $country = strtoupper(substr($country, 0, 2));
        } else {
            $country = null;
        }

        return [
            'code' => $code,
            'name_en' => trim((string) ($data['name_en'] ?? $existing?->name_en ?? '')),
            'name_ar' => isset($data['name_ar'])
                ? (trim((string) $data['name_ar']) ?: null)
                : $existing?->name_ar,
            'rate_percent' => (float) ($data['rate_percent'] ?? $existing?->rate_percent ?? 0),
            'country_code' => $country,
            'is_inclusive' => array_key_exists('is_inclusive', $data)
                ? (bool) $data['is_inclusive']
                : ($existing?->is_inclusive ?? false),
            'is_active' => array_key_exists('is_active', $data)
                ? (bool) $data['is_active']
                : ($existing?->is_active ?? true),
            'notes' => array_key_exists('notes', $data) ? $data['notes'] : $existing?->notes,
        ];
    }

    /** @return array<string, mixed> */
    protected function serialize(BillingTax $tax): array
    {
        return [
            'id' => $tax->id,
            'code' => $tax->code,
            'name_en' => $tax->name_en,
            'name_ar' => $tax->name_ar,
            'rate_percent' => $tax->rate_percent,
            'country_code' => $tax->country_code,
            'is_inclusive' => (bool) $tax->is_inclusive,
            'is_active' => (bool) $tax->is_active,
            'status' => $tax->is_active ? 'active' : 'inactive',
            'notes' => $tax->notes,
            'created_at' => optional($tax->created_at)?->toIso8601String(),
            'updated_at' => optional($tax->updated_at)?->toIso8601String(),
        ];
    }
}
