<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class TeacherLoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'tenant_slug' => ['required', 'string', 'max:80'],
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ];
    }
}
