<?php

namespace App\Http\Resources\Api\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Domain\Organization\Models\Tenant */
class TenantResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'name' => $this->name,
            'legal_name' => $this->legal_name,
            'status' => $this->status,
            'default_locale' => $this->default_locale,
            'default_timezone' => $this->default_timezone,
            'trial_ends_at' => $this->trial_ends_at,
        ];
    }
}
