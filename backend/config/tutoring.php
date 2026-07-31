<?php

return [
    'meeting_provider' => env('TUTORING_MEETING_PROVIDER', 'local'),
    /** Institution SPA base used for tutor/staff classroom join links (no trailing slash). */
    'institution_url' => rtrim((string) env('INSTITUTION_URL', env('VITE_INSTITUTION_URL', 'http://localhost:5175')), '/'),
    /** Learner SPA base used for student classroom join links (no trailing slash). */
    'learner_url' => rtrim((string) env('LEARNER_URL', env('VITE_LEARNER_URL', 'http://localhost:5178')), '/'),
];
