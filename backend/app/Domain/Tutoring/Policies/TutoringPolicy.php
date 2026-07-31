<?php

namespace App\Domain\Tutoring\Policies;

use App\Models\User;
use App\Policies\RbacPolicy;

class TutoringPolicy extends RbacPolicy
{
    public function manage(User $user): bool
    {
        return $this->allow($user, 'tutoring.manage');
    }

    public function conduct(User $user): bool
    {
        return $this->allow($user, 'tutoring.conduct')
            || $this->allow($user, 'tutoring.manage');
    }

    public function book(User $user): bool
    {
        return $this->allow($user, 'tutoring.book');
    }

    public function join(User $user): bool
    {
        return $this->allow($user, 'tutoring.join')
            || $this->allow($user, 'tutoring.conduct');
    }
}
