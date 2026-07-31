<?php

namespace Tests\Unit;

use App\Domain\Notification\NotificationEvents;
use Tests\TestCase;

class NotificationEventsTest extends TestCase
{
    public function test_all_events_include_phase16_catalog(): void
    {
        $events = NotificationEvents::all();

        $this->assertContains(NotificationEvents::NEW_ASSIGNMENT, $events);
        $this->assertContains(NotificationEvents::HOMEWORK_DUE, $events);
        $this->assertContains(NotificationEvents::FEE_REMINDER, $events);
        $this->assertCount(9, $events);
    }

    public function test_critical_events(): void
    {
        $this->assertTrue(NotificationEvents::isCritical(NotificationEvents::SESSION_CANCELLATION));
        $this->assertTrue(NotificationEvents::isCritical(NotificationEvents::FEE_REMINDER));
        $this->assertFalse(NotificationEvents::isCritical(NotificationEvents::NEW_ASSIGNMENT));
    }

    public function test_default_channels(): void
    {
        $this->assertSame(['in_app', 'email', 'sms', 'whatsapp'], NotificationEvents::defaultChannels());
    }
}
