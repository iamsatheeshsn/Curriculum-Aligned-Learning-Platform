<?php

namespace Tests\Feature\Api;

use Tests\TestCase;

class InstitutionDashboardTest extends TestCase
{
    public function test_institution_staff_can_load_school_home_dashboard(): void
    {
        $auth = $this->loginAs('teacher', 'tutor@alnoor.test', 'Password!123', 'al-noor');

        $this->api('GET', '/org/dashboard', [], $auth['headers'])
            ->assertOk()
            ->assertJsonPath('data.tenant.slug', 'al-noor')
            ->assertJsonStructure([
                'data' => [
                    'tenant' => ['id', 'slug', 'name', 'status'],
                    'user' => ['id', 'name', 'email', 'roles', 'permissions'],
                    'stats' => [
                        'schools',
                        'campuses',
                        'active_classes',
                        'staff',
                        'students',
                        'sessions_today',
                        'curricula_pending',
                    ],
                    'schools',
                    'upcoming_sessions',
                    'curricula',
                    'attention',
                ],
            ]);
    }
}
