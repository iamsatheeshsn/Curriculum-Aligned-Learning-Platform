<?php

namespace Tests\Performance;

use Tests\TestCase;

class ApiPerformanceTest extends TestCase
{
    public function test_health_responds_under_500ms(): void
    {
        $start = hrtime(true);
        $this->api('GET', '/health')->assertOk();
        $ms = (hrtime(true) - $start) / 1e6;

        $this->assertLessThan(500, $ms, "Health took {$ms}ms");
    }

    public function test_meta_responds_under_500ms(): void
    {
        $start = hrtime(true);
        $this->api('GET', '/meta')->assertOk();
        $ms = (hrtime(true) - $start) / 1e6;

        $this->assertLessThan(500, $ms, "Meta took {$ms}ms");
    }

    public function test_admin_login_under_2000ms(): void
    {
        $start = hrtime(true);
        $this->api('POST', '/auth/admin/login', [
            'email' => 'owner@alnoor.test',
            'password' => 'Password!456',
        ])->assertOk();
        $ms = (hrtime(true) - $start) / 1e6;

        $this->assertLessThan(2000, $ms, "Admin login took {$ms}ms");
    }

    public function test_school_report_under_3000ms(): void
    {
        $auth = $this->loginAs('admin', 'owner@alnoor.test', 'Password!456');
        $headers = $auth['headers'] + ['X-Tenant-Slug' => 'al-noor', 'X-School-ID' => '1'];

        $start = hrtime(true);
        $this->api('GET', '/org/reports/school?school_id=1', [], $headers)->assertOk();
        $ms = (hrtime(true) - $start) / 1e6;

        $this->assertLessThan(3000, $ms, "School report took {$ms}ms");
    }
}
