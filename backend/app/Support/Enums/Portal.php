<?php

namespace App\Support\Enums;

enum Portal: string
{
    case Control = 'control';
    case Institution = 'institution';
    case Learner = 'learner';
}
