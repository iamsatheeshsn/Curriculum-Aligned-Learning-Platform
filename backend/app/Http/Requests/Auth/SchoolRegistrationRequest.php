<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class SchoolRegistrationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'organization_name' => ['required', 'string', 'max:191'],
            'slug' => ['nullable', 'string', 'max:80', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'],
            'legal_name' => ['nullable', 'string', 'max:191'],
            'country_code' => ['required', 'string', 'size:2'],
            'school_name' => ['nullable', 'string', 'max:191'],
            'school_name_ar' => ['nullable', 'string', 'max:191'],
            'school_code' => ['nullable', 'string', 'max:64'],
            'plan_code' => ['nullable', 'string', 'max:64'],
            'email' => ['required', 'email', 'max:191'],
            'password' => ['required', 'confirmed', Password::defaults()],
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:32'],
            'locale' => ['nullable', 'in:en,ar'],
            'trial_days' => ['nullable', 'integer', 'min:1', 'max:90'],
        ];
    }
}
