<?php

namespace App\Http\Controllers\Api\V1\Institution;

use App\Domain\Academics\Services\SchoolContextService;
use App\Domain\Identity\Services\RbacService;
use App\Domain\Notification\NotificationEvents;
use App\Domain\Notification\Services\NotificationDispatcher;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationEngineController extends Controller
{
    public function __construct(
        protected SchoolContextService $schoolContext,
        protected NotificationDispatcher $dispatcher,
        protected RbacService $rbac,
    ) {}

    public function events(): JsonResponse
    {
        return response()->json([
            'data' => [
                'events' => NotificationEvents::all(),
                'channels' => NotificationEvents::defaultChannels(),
                'channel_config' => config('notifications.channels'),
            ],
        ]);
    }

    public function dispatch(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'school.users.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $data = $request->validate([
            'event_type' => ['required', 'string', 'max:100'],
            'user_id' => ['required', 'integer'],
            'title_en' => ['nullable', 'string'],
            'title_ar' => ['nullable', 'string'],
            'body_en' => ['nullable', 'string'],
            'body_ar' => ['nullable', 'string'],
            'payload' => ['nullable', 'array'],
        ]);

        if (! in_array($data['event_type'], NotificationEvents::all(), true)) {
            return response()->json(['message' => 'Unknown event type.', 'code' => 'invalid_event'], 422);
        }

        $user = User::query()->where('tenant_id', $school->tenant_id)->findOrFail($data['user_id']);
        $payload = array_merge($data['payload'] ?? [], [
            'title_en' => $data['title_en'] ?? $data['event_type'],
            'title_ar' => $data['title_ar'] ?? $data['event_type'],
            'body_en' => $data['body_en'] ?? null,
            'body_ar' => $data['body_ar'] ?? null,
        ]);

        $results = $this->dispatcher->dispatch($user, $data['event_type'], $payload, $school->tenant_id);

        return response()->json(['message' => 'Notification dispatched.', 'data' => $results]);
    }

    public function myPreferences(Request $request): JsonResponse
    {
        $prefs = \App\Domain\Notification\Models\NotificationPreference::query()
            ->where('user_id', $request->user()->id)
            ->orderBy('event_type')
            ->get();

        return response()->json([
            'data' => [
                'events' => NotificationEvents::all(),
                'channels' => NotificationEvents::defaultChannels(),
                'preferences' => $prefs,
            ],
        ]);
    }

    public function updatePreference(Request $request): JsonResponse
    {
        $data = $request->validate([
            'event_type' => ['required', 'string'],
            'channel' => ['required', 'in:in_app,email,sms,whatsapp'],
            'is_enabled' => ['required', 'boolean'],
        ]);

        $pref = $this->dispatcher->setPreference(
            $request->user(),
            $data['event_type'],
            $data['channel'],
            $data['is_enabled'],
            $request->user()->tenant_id,
        );

        return response()->json(['message' => 'Preference saved.', 'data' => $pref]);
    }
}
