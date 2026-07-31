<?php

namespace App\Domain\Billing\Services;

use App\Domain\Billing\Models\BillingCoupon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ControlCouponService
{
    /** @param  array{search?: ?string, status?: ?string}  $filters
     *  @return list<array<string, mixed>>
     */
    public function list(array $filters = []): array
    {
        return BillingCoupon::query()
            ->when($filters['search'] ?? null, function ($q, $search) {
                $like = '%'.$search.'%';
                $q->where(function ($inner) use ($like) {
                    $inner->where('code', 'like', $like)
                        ->orWhere('name_en', 'like', $like)
                        ->orWhere('name_ar', 'like', $like);
                });
            })
            ->when(($filters['status'] ?? null) === 'active', fn ($q) => $q->where('is_active', true))
            ->when(($filters['status'] ?? null) === 'inactive', fn ($q) => $q->where('is_active', false))
            ->orderBy('code')
            ->get()
            ->map(fn (BillingCoupon $c) => $this->serialize($c))
            ->all();
    }

    /** @return array{total: int, active: int, inactive: int, percent: int, fixed: int} */
    public function stats(): array
    {
        $base = BillingCoupon::query();

        return [
            'total' => (int) (clone $base)->count(),
            'active' => (int) (clone $base)->where('is_active', true)->count(),
            'inactive' => (int) (clone $base)->where('is_active', false)->count(),
            'percent' => (int) (clone $base)->where('discount_type', 'percent')->count(),
            'fixed' => (int) (clone $base)->where('discount_type', 'fixed')->count(),
        ];
    }

    /** @return array<string, mixed> */
    public function show(BillingCoupon $coupon): array
    {
        return $this->serialize($coupon);
    }

    /** @param  array<string, mixed>  $data
     *  @return array<string, mixed>
     */
    public function create(array $data, int $actorId): array
    {
        $code = strtoupper(trim((string) $data['code']));
        $trashed = BillingCoupon::withTrashed()->where('code', $code)->first();
        if ($trashed && ! $trashed->trashed()) {
            throw ValidationException::withMessages(['code' => ['Coupon code already exists.']]);
        }

        $payload = $this->normalize($data, $code);

        $coupon = DB::transaction(function () use ($trashed, $payload, $actorId) {
            if ($trashed?->trashed()) {
                $trashed->restore();
                $trashed->fill($payload);
                $trashed->redemptions_count = 0;
                $trashed->updated_by = $actorId;
                $trashed->save();

                return $trashed;
            }

            return BillingCoupon::query()->create([
                ...$payload,
                'redemptions_count' => 0,
                'created_by' => $actorId,
                'updated_by' => $actorId,
            ]);
        });

        return $this->show($coupon->fresh());
    }

    /** @param  array<string, mixed>  $data
     *  @return array<string, mixed>
     */
    public function update(BillingCoupon $coupon, array $data, int $actorId): array
    {
        $code = array_key_exists('code', $data)
            ? strtoupper(trim((string) $data['code']))
            : $coupon->code;

        if ($code !== $coupon->code) {
            $exists = BillingCoupon::withTrashed()->where('code', $code)->where('id', '!=', $coupon->id)->exists();
            if ($exists) {
                throw ValidationException::withMessages(['code' => ['Coupon code already exists.']]);
            }
        }

        $coupon->fill($this->normalize($data, $code, $coupon));
        $coupon->updated_by = $actorId;
        $coupon->save();

        return $this->show($coupon->fresh());
    }

    public function delete(BillingCoupon $coupon): void
    {
        $coupon->delete();
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    protected function normalize(array $data, string $code, ?BillingCoupon $existing = null): array
    {
        $type = $data['discount_type'] ?? $existing?->discount_type ?? 'percent';
        if (! in_array($type, ['percent', 'fixed'], true)) {
            throw ValidationException::withMessages(['discount_type' => ['Discount type must be percent or fixed.']]);
        }

        return [
            'code' => $code,
            'name_en' => trim((string) ($data['name_en'] ?? $existing?->name_en ?? '')),
            'name_ar' => isset($data['name_ar'])
                ? (trim((string) $data['name_ar']) ?: null)
                : $existing?->name_ar,
            'discount_type' => $type,
            'discount_value' => (float) ($data['discount_value'] ?? $existing?->discount_value ?? 0),
            'currency' => $type === 'fixed'
                ? strtoupper((string) ($data['currency'] ?? $existing?->currency ?? 'SAR'))
                : null,
            'max_redemptions' => array_key_exists('max_redemptions', $data)
                ? ($data['max_redemptions'] !== null ? (int) $data['max_redemptions'] : null)
                : $existing?->max_redemptions,
            'starts_at' => array_key_exists('starts_at', $data) ? $data['starts_at'] : $existing?->starts_at,
            'ends_at' => array_key_exists('ends_at', $data) ? $data['ends_at'] : $existing?->ends_at,
            'is_active' => array_key_exists('is_active', $data)
                ? (bool) $data['is_active']
                : ($existing?->is_active ?? true),
            'notes' => array_key_exists('notes', $data) ? $data['notes'] : $existing?->notes,
        ];
    }

    /** @return array<string, mixed> */
    protected function serialize(BillingCoupon $coupon): array
    {
        return [
            'id' => $coupon->id,
            'code' => $coupon->code,
            'name_en' => $coupon->name_en,
            'name_ar' => $coupon->name_ar,
            'discount_type' => $coupon->discount_type,
            'discount_value' => $coupon->discount_value,
            'currency' => $coupon->currency,
            'max_redemptions' => $coupon->max_redemptions,
            'redemptions_count' => $coupon->redemptions_count,
            'starts_at' => optional($coupon->starts_at)?->toIso8601String(),
            'ends_at' => optional($coupon->ends_at)?->toIso8601String(),
            'is_active' => (bool) $coupon->is_active,
            'status' => $coupon->is_active ? 'active' : 'inactive',
            'notes' => $coupon->notes,
            'created_at' => optional($coupon->created_at)?->toIso8601String(),
            'updated_at' => optional($coupon->updated_at)?->toIso8601String(),
        ];
    }
}
