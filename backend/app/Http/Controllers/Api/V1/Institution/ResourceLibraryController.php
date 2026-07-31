<?php

namespace App\Http\Controllers\Api\V1\Institution;

use App\Domain\Academics\Services\SchoolContextService;
use App\Domain\Identity\Services\RbacService;
use App\Domain\Learning\Models\MediaAsset;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ResourceLibraryController extends Controller
{
    public function __construct(
        protected SchoolContextService $schoolContext,
        protected RbacService $rbac,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'learning.content.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $items = MediaAsset::query()
            ->where(function ($q) use ($school) {
                $q->where('school_id', $school->id)->orWhereNull('school_id');
            })
            ->when($request->filled('type'), fn ($q) => $q->where('type', $request->string('type')))
            ->orderByDesc('id')
            ->paginate((int) $request->integer('per_page', 10));

        return response()->json($items);
    }

    public function store(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'learning.content.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $data = $request->validate([
            'type' => ['required', 'in:video,pdf,image,audio,other'],
            'title_en' => ['nullable', 'string', 'max:255'],
            'title_ar' => ['nullable', 'string', 'max:255'],
            'disk_path' => ['nullable', 'string', 'max:500'],
            'external_url' => ['nullable', 'string', 'max:1000'],
            'mime_type' => ['nullable', 'string', 'max:128'],
            'size_bytes' => ['nullable', 'integer', 'min:0'],
            'duration_seconds' => ['nullable', 'integer', 'min:0'],
        ]);

        if (empty($data['disk_path']) && empty($data['external_url'])) {
            return response()->json(['message' => 'disk_path or external_url required.', 'code' => 'source_required'], 422);
        }

        $asset = MediaAsset::query()->create([
            ...$data,
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
        ]);

        return response()->json(['message' => 'Resource created.', 'data' => $asset], 201);
    }

    public function update(Request $request, int $asset): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'learning.content.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = MediaAsset::query()->where('school_id', $school->id)->findOrFail($asset);

        $data = $request->validate([
            'title_en' => ['nullable', 'string', 'max:255'],
            'title_ar' => ['nullable', 'string', 'max:255'],
            'disk_path' => ['nullable', 'string', 'max:500'],
            'external_url' => ['nullable', 'string', 'max:1000'],
            'mime_type' => ['nullable', 'string', 'max:128'],
            'size_bytes' => ['nullable', 'integer', 'min:0'],
            'duration_seconds' => ['nullable', 'integer', 'min:0'],
            'type' => ['sometimes', 'in:video,pdf,image,audio,other'],
        ]);

        $model->update($data);

        return response()->json(['message' => 'Resource updated.', 'data' => $model->fresh()]);
    }

    public function destroy(Request $request, int $asset): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'learning.content.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        MediaAsset::query()->where('school_id', $school->id)->findOrFail($asset)->delete();

        return response()->json(['message' => 'Resource deleted.']);
    }

    public function storeSimulation(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'learning.content.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $data = $request->validate([
            'title_en' => ['required', 'string', 'max:255'],
            'title_ar' => ['required', 'string', 'max:255'],
            'launch_url' => ['required', 'url', 'max:1000'],
            'duration_seconds' => ['nullable', 'integer', 'min:0'],
        ]);

        $asset = MediaAsset::query()->create([
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'type' => 'other',
            'title_en' => $data['title_en'],
            'title_ar' => $data['title_ar'],
            'external_url' => $data['launch_url'],
            'mime_type' => 'application/x-simulation',
            'duration_seconds' => $data['duration_seconds'] ?? null,
        ]);

        return response()->json(['message' => 'STEM simulation registered.', 'data' => $asset], 201);
    }
}
