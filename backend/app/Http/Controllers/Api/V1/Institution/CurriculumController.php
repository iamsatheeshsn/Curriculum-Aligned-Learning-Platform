<?php

namespace App\Http\Controllers\Api\V1\Institution;

use App\Domain\Academics\Models\Grade;
use App\Domain\Academics\Models\Subject;
use App\Domain\Academics\Services\SchoolContextService;
use App\Domain\Curriculum\Models\Chapter;
use App\Domain\Curriculum\Models\Curriculum;
use App\Domain\Curriculum\Models\CurriculumLesson;
use App\Domain\Curriculum\Models\CurriculumVersionLog;
use App\Domain\Curriculum\Models\LearningOutcome;
use App\Domain\Curriculum\Services\CurriculumVersioningService;
use App\Domain\Identity\Services\RbacService;
use App\Domain\Organization\Models\Country;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
class CurriculumController extends Controller
{
    public function __construct(
        protected SchoolContextService $schoolContext,
        protected CurriculumVersioningService $versioning,
        protected RbacService $rbac,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'curriculum.view');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $items = Curriculum::query()
            ->where('school_id', $school->id)
            ->when($request->filled('code'), fn ($q) => $q->where('code', $request->string('code')))
            ->when($request->boolean('latest_only'), fn ($q) => $q->where('is_latest', true))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->orderByDesc('is_latest')
            ->orderByDesc('id')
            ->paginate((int) $request->integer('per_page', 10));

        return response()->json($items);
    }

    public function store(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'curriculum.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $data = $request->validate([
            'country_code' => ['required', 'string', 'size:2'],
            'code' => ['required', 'string', 'max:64'],
            'name_en' => ['required', 'string', 'max:191'],
            'name_ar' => ['required', 'string', 'max:191'],
            'version' => ['nullable', 'string', 'max:32'],
            'change_summary_en' => ['nullable', 'string'],
            'change_summary_ar' => ['nullable', 'string'],
        ]);

        $country = Country::query()->where('code', strtoupper($data['country_code']))->firstOrFail();
        $version = $data['version'] ?? '1.0';

        if (Curriculum::query()->where('school_id', $school->id)->where('code', $data['code'])->where('version', $version)->exists()) {
            return response()->json(['message' => 'Curriculum version already exists.', 'code' => 'duplicate_version'], 422);
        }

        Curriculum::query()
            ->where('school_id', $school->id)
            ->where('code', $data['code'])
            ->update(['is_latest' => false]);

        $curriculum = Curriculum::query()->create([
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'country_id' => $country->id,
            'code' => $data['code'],
            'name_en' => $data['name_en'],
            'name_ar' => $data['name_ar'],
            'version' => $version,
            'status' => 'draft',
            'is_latest' => true,
            'change_summary_en' => $data['change_summary_en'] ?? 'Initial version',
            'change_summary_ar' => $data['change_summary_ar'] ?? null,
        ]);

        CurriculumVersionLog::query()->create([
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'curriculum_id' => $curriculum->id,
            'from_version' => null,
            'to_version' => $version,
            'action' => 'create',
            'summary_en' => $curriculum->change_summary_en,
            'summary_ar' => $curriculum->change_summary_ar,
            'created_by' => $request->user()->id,
            'created_at' => now(),
        ]);

        return response()->json(['message' => 'Curriculum created.', 'data' => $curriculum], 201);
    }

    public function show(Request $request, int $curriculum): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'curriculum.view');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $model = Curriculum::query()
            ->where('school_id', $school->id)
            ->with([
                'country',
                'subjects',
                'learningOutcomes',
                'chapters.lessons.learningOutcomes',
                'versionLogs' => fn ($q) => $q->orderByDesc('id'),
            ])
            ->findOrFail($curriculum);

        return response()->json(['data' => $model]);
    }

    public function update(Request $request, int $curriculum): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'curriculum.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = Curriculum::query()->where('school_id', $school->id)->findOrFail($curriculum);
        $this->versioning->assertEditable($model);

        $data = $request->validate([
            'name_en' => ['sometimes', 'string', 'max:191'],
            'name_ar' => ['sometimes', 'string', 'max:191'],
            'change_summary_en' => ['nullable', 'string'],
            'change_summary_ar' => ['nullable', 'string'],
            'status' => ['sometimes', 'in:draft,in_review'],
        ]);

        $model->update($data);

        return response()->json(['message' => 'Curriculum updated.', 'data' => $model->fresh()]);
    }

    public function publish(Request $request, int $curriculum): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'curriculum.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = Curriculum::query()->where('school_id', $school->id)->findOrFail($curriculum);

        $data = $request->validate([
            'summary_en' => ['nullable', 'string'],
            'summary_ar' => ['nullable', 'string'],
        ]);

        $published = $this->versioning->publish($model, $data['summary_en'] ?? null, $data['summary_ar'] ?? null);

        return response()->json(['message' => 'Curriculum published.', 'data' => $published]);
    }

    public function newVersion(Request $request, int $curriculum): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'curriculum.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $source = Curriculum::query()->where('school_id', $school->id)->findOrFail($curriculum);

        $data = $request->validate([
            'version' => ['required', 'string', 'max:32'],
            'summary_en' => ['nullable', 'string'],
            'summary_ar' => ['nullable', 'string'],
        ]);

        $clone = $this->versioning->createNewVersion(
            $source,
            $data['version'],
            $data['summary_en'] ?? null,
            $data['summary_ar'] ?? null,
        );

        return response()->json(['message' => 'New curriculum version created as draft.', 'data' => $clone], 201);
    }

    public function versionHistory(Request $request, int $curriculum): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'curriculum.view');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = Curriculum::query()->where('school_id', $school->id)->findOrFail($curriculum);

        $versions = Curriculum::query()
            ->where('school_id', $school->id)
            ->where('code', $model->code)
            ->orderByDesc('id')
            ->get(['id', 'code', 'version', 'status', 'is_latest', 'published_at', 'source_curriculum_id', 'change_summary_en', 'change_summary_ar']);

        $logs = CurriculumVersionLog::query()
            ->where('school_id', $school->id)
            ->whereIn('curriculum_id', $versions->pluck('id'))
            ->orderByDesc('id')
            ->get();

        return response()->json(['data' => ['versions' => $versions, 'logs' => $logs]]);
    }

    public function gradeLevels(Request $request): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'curriculum.view');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        return response()->json([
            'data' => Grade::query()->where('school_id', $school->id)->orderBy('sequence')->get(),
        ]);
    }

    public function storeSubject(Request $request, int $curriculum): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'curriculum.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = Curriculum::query()->where('school_id', $school->id)->findOrFail($curriculum);
        $this->versioning->assertEditable($model);

        $data = $request->validate([
            'code' => ['required', 'string', 'max:64'],
            'name_en' => ['required', 'string', 'max:191'],
            'name_ar' => ['required', 'string', 'max:191'],
            'is_stem' => ['nullable', 'boolean'],
            'tutoring_enabled' => ['nullable', 'boolean'],
            'status' => ['nullable', 'in:active,archived'],
        ]);

        $subject = Subject::query()->create([
            ...$data,
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'curriculum_id' => $model->id,
            'is_stem' => $data['is_stem'] ?? true,
            'tutoring_enabled' => $data['tutoring_enabled'] ?? true,
            'status' => $data['status'] ?? 'active',
        ]);

        return response()->json(['message' => 'Subject added to curriculum.', 'data' => $subject], 201);
    }

    public function storeChapter(Request $request, int $curriculum): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'curriculum.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = Curriculum::query()->where('school_id', $school->id)->findOrFail($curriculum);
        $this->versioning->assertEditable($model);

        $data = $request->validate([
            'subject_id' => ['required', 'integer'],
            'grade_id' => ['required', 'integer'],
            'title_en' => ['required', 'string', 'max:255'],
            'title_ar' => ['required', 'string', 'max:255'],
            'sequence' => ['nullable', 'integer', 'min:1'],
            'status' => ['nullable', 'in:draft,published,archived'],
        ]);

        Subject::query()->where('school_id', $school->id)->where('curriculum_id', $model->id)->findOrFail($data['subject_id']);
        Grade::query()->where('school_id', $school->id)->findOrFail($data['grade_id']);

        $chapter = Chapter::query()->create([
            ...$data,
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'curriculum_id' => $model->id,
            'sequence' => $data['sequence'] ?? 1,
            'status' => $data['status'] ?? 'draft',
        ]);

        return response()->json(['message' => 'Chapter created.', 'data' => $chapter], 201);
    }

    public function updateChapter(Request $request, int $curriculum, int $chapter): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'curriculum.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = Curriculum::query()->where('school_id', $school->id)->findOrFail($curriculum);
        $this->versioning->assertEditable($model);

        $row = Chapter::query()->where('curriculum_id', $model->id)->findOrFail($chapter);
        $data = $request->validate([
            'title_en' => ['sometimes', 'string', 'max:255'],
            'title_ar' => ['sometimes', 'string', 'max:255'],
            'sequence' => ['sometimes', 'integer', 'min:1'],
            'status' => ['sometimes', 'in:draft,published,archived'],
            'grade_id' => ['sometimes', 'integer'],
        ]);
        $row->update($data);

        return response()->json(['message' => 'Chapter updated.', 'data' => $row->fresh()]);
    }

    public function storeLesson(Request $request, int $curriculum, int $chapter): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'curriculum.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = Curriculum::query()->where('school_id', $school->id)->findOrFail($curriculum);
        $this->versioning->assertEditable($model);
        $chapterModel = Chapter::query()->where('curriculum_id', $model->id)->findOrFail($chapter);

        $data = $request->validate([
            'code' => ['nullable', 'string', 'max:64'],
            'title_en' => ['required', 'string', 'max:255'],
            'title_ar' => ['required', 'string', 'max:255'],
            'summary_en' => ['nullable', 'string'],
            'summary_ar' => ['nullable', 'string'],
            'sequence' => ['nullable', 'integer', 'min:1'],
            'estimated_minutes' => ['nullable', 'integer', 'min:1'],
            'difficulty' => ['nullable', 'in:easy,medium,hard'],
            'status' => ['nullable', 'in:draft,published,archived'],
            'learning_outcome_ids' => ['nullable', 'array'],
            'learning_outcome_ids.*' => ['integer'],
        ]);

        $lesson = CurriculumLesson::query()->create([
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'curriculum_id' => $model->id,
            'chapter_id' => $chapterModel->id,
            'code' => $data['code'] ?? null,
            'title_en' => $data['title_en'],
            'title_ar' => $data['title_ar'],
            'summary_en' => $data['summary_en'] ?? null,
            'summary_ar' => $data['summary_ar'] ?? null,
            'sequence' => $data['sequence'] ?? 1,
            'estimated_minutes' => $data['estimated_minutes'] ?? null,
            'difficulty' => $data['difficulty'] ?? null,
            'status' => $data['status'] ?? 'draft',
        ]);

        if (! empty($data['learning_outcome_ids'])) {
            $validIds = LearningOutcome::query()
                ->where('curriculum_id', $model->id)
                ->whereIn('id', $data['learning_outcome_ids'])
                ->pluck('id')
                ->all();
            $attach = [];
            foreach ($validIds as $id) {
                $attach[$id] = ['created_at' => now()];
            }
            $lesson->learningOutcomes()->attach($attach);
        }

        return response()->json(['message' => 'Lesson created.', 'data' => $lesson->load('learningOutcomes')], 201);
    }

    public function updateLesson(Request $request, int $curriculum, int $chapter, int $lesson): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'curriculum.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = Curriculum::query()->where('school_id', $school->id)->findOrFail($curriculum);
        $this->versioning->assertEditable($model);
        Chapter::query()->where('curriculum_id', $model->id)->findOrFail($chapter);
        $row = CurriculumLesson::query()->where('curriculum_id', $model->id)->where('chapter_id', $chapter)->findOrFail($lesson);

        $data = $request->validate([
            'code' => ['nullable', 'string', 'max:64'],
            'title_en' => ['sometimes', 'string', 'max:255'],
            'title_ar' => ['sometimes', 'string', 'max:255'],
            'summary_en' => ['nullable', 'string'],
            'summary_ar' => ['nullable', 'string'],
            'sequence' => ['sometimes', 'integer', 'min:1'],
            'estimated_minutes' => ['nullable', 'integer', 'min:1'],
            'difficulty' => ['nullable', 'in:easy,medium,hard'],
            'status' => ['sometimes', 'in:draft,published,archived'],
            'learning_outcome_ids' => ['nullable', 'array'],
            'learning_outcome_ids.*' => ['integer'],
        ]);

        $row->update(collect($data)->except('learning_outcome_ids')->all());

        if (array_key_exists('learning_outcome_ids', $data)) {
            $validIds = LearningOutcome::query()
                ->where('curriculum_id', $model->id)
                ->whereIn('id', $data['learning_outcome_ids'] ?? [])
                ->pluck('id')
                ->all();
            $sync = [];
            foreach ($validIds as $id) {
                $sync[$id] = ['created_at' => now()];
            }
            $row->learningOutcomes()->sync($sync);
        }

        return response()->json(['message' => 'Lesson updated.', 'data' => $row->fresh('learningOutcomes')]);
    }

    public function storeOutcome(Request $request, int $curriculum): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'curriculum.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = Curriculum::query()->where('school_id', $school->id)->findOrFail($curriculum);
        $this->versioning->assertEditable($model);

        $data = $request->validate([
            'subject_id' => ['nullable', 'integer'],
            'code' => ['required', 'string', 'max:64'],
            'statement_en' => ['required', 'string'],
            'statement_ar' => ['required', 'string'],
            'status' => ['nullable', 'in:active,archived'],
        ]);

        if (! empty($data['subject_id'])) {
            Subject::query()->where('curriculum_id', $model->id)->findOrFail($data['subject_id']);
        }

        $outcome = LearningOutcome::query()->create([
            ...$data,
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'curriculum_id' => $model->id,
            'status' => $data['status'] ?? 'active',
        ]);

        return response()->json(['message' => 'Learning outcome created.', 'data' => $outcome], 201);
    }

    public function updateOutcome(Request $request, int $curriculum, int $outcome): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'curriculum.manage');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
        $model = Curriculum::query()->where('school_id', $school->id)->findOrFail($curriculum);
        $this->versioning->assertEditable($model);
        $row = LearningOutcome::query()->where('curriculum_id', $model->id)->findOrFail($outcome);

        $data = $request->validate([
            'subject_id' => ['nullable', 'integer'],
            'code' => ['sometimes', 'string', 'max:64'],
            'statement_en' => ['sometimes', 'string'],
            'statement_ar' => ['sometimes', 'string'],
            'status' => ['sometimes', 'in:active,archived'],
        ]);

        $row->update($data);

        return response()->json(['message' => 'Learning outcome updated.', 'data' => $row->fresh()]);
    }

    public function tree(Request $request, int $curriculum): JsonResponse
    {
        $this->rbac->authorize($request->user(), 'curriculum.view');
        $school = $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);

        $model = Curriculum::query()
            ->where('school_id', $school->id)
            ->with([
                'subjects' => fn ($q) => $q->orderBy('code'),
                'chapters' => fn ($q) => $q->orderBy('sequence')->with([
                    'grade:id,code,name_en,name_ar',
                    'subject:id,code,name_en,name_ar',
                    'lessons' => fn ($lq) => $lq->orderBy('sequence')->with('learningOutcomes:id,code,statement_en,statement_ar'),
                ]),
                'learningOutcomes',
            ])
            ->findOrFail($curriculum);

        return response()->json(['data' => $model]);
    }
}
