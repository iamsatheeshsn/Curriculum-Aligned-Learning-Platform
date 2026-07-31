<?php

namespace Tests\Unit;

use Tests\TestCase;

class MobileConfigUnitTest extends TestCase
{
    public function test_mobile_config_exposes_capability_flags(): void
    {
        $this->assertSame('1.0.0', config('mobile.api_version'));
        $this->assertFalse(config('mobile.capability_flags.push_notifications'));
        $this->assertTrue(config('mobile.capability_flags.live_tutoring'));
        $this->assertArrayHasKey('POST /api/v1/mobile/devices', config('mobile.future_endpoints'));
    }
}
