<?php

namespace App\Domain\Assessment\Policies;

use App\Models\User;
use App\Policies\RbacPolicy;

class AssessmentPolicy extends RbacPolicy
{
    public function manage(User $user): bool
    {
        return $this->allow($user, 'assessments.manage');
    }

    public function grade(User $user): bool
    {
        return $this->allow($user, 'assessments.grade');
    }

    public function attempt(User $user): bool
    {
        return $this->allow($user, 'assessments.attempt');
    }

    public function viewClassResults(User $user): bool
    {
        return $this->allow($user, 'assessments.results.view_class');
    }

    public function viewChildResults(User $user): bool
    {
        return $this->allow($user, 'assessments.results.view_child');
    }
}
