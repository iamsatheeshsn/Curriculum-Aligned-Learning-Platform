<?php

namespace App\Domain\Identity\Services;

use App\Domain\Identity\Models\ParentStudentLink;
use App\Models\User;
use App\Services\BaseService;
use App\Support\TenantContext;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class ChildAccessService extends BaseService
{
    public function __construct(TenantContext $tenantContext)
    {
        parent::__construct($tenantContext);
    }

    /** @return Collection<int, User> */
    public function childrenFor(User $parent): Collection
    {
        $ids = ParentStudentLink::query()
            ->where('parent_user_id', $parent->id)
            ->pluck('student_user_id');

        return User::query()->whereIn('id', $ids)->orderBy('first_name')->get();
    }

    public function assertLinked(User $parent, int $studentId): User
    {
        $linked = ParentStudentLink::query()
            ->where('parent_user_id', $parent->id)
            ->where('student_user_id', $studentId)
            ->exists();

        if (! $linked) {
            throw ValidationException::withMessages([
                'student_user_id' => ['Student is not linked to this parent.'],
            ]);
        }

        return User::query()->findOrFail($studentId);
    }

    public function link(int $tenantId, int $parentId, int $studentId, ?string $relationship = null, bool $primary = false): ParentStudentLink
    {
        return ParentStudentLink::query()->updateOrCreate(
            [
                'parent_user_id' => $parentId,
                'student_user_id' => $studentId,
            ],
            [
                'tenant_id' => $tenantId,
                'relationship' => $relationship,
                'is_primary' => $primary,
            ]
        );
    }
}
