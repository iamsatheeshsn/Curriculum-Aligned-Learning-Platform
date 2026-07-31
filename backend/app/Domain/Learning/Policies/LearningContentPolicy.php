<?php

namespace App\Domain\Learning\Policies;

use App\Models\User;
use App\Policies\RbacPolicy;

class LearningContentPolicy extends RbacPolicy
{
    public function manage(User $user): bool
    {
        return $this->allow($user, 'learning.content.manage');
    }

    public function assign(User $user): bool
    {
        return $this->allow($user, 'learning.content.assign')
            || $this->allow($user, 'learning.content.manage');
    }

    public function consume(User $user): bool
    {
        return $this->allow($user, 'learning.content.consume');
    }
}
