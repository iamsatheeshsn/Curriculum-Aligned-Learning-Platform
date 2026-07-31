<?php

namespace App\Domain\Assessment\Services;

use App\Domain\Assessment\Models\Assessment;
use App\Domain\Assessment\Models\AssessmentQuestion;
use App\Domain\Assessment\Models\Question;
use App\Domain\Organization\Models\School;
use App\Services\BaseService;
use App\Support\TenantContext;
use Illuminate\Validation\ValidationException;

class AssessmentBuilderService extends BaseService
{
    public function __construct(TenantContext $tenantContext)
    {
        parent::__construct($tenantContext);
    }

    public function create(School $school, array $data): Assessment
    {
        return Assessment::query()->create([
            'tenant_id' => $school->tenant_id,
            'school_id' => $school->id,
            'subject_id' => $data['subject_id'] ?? null,
            'term_id' => $data['term_id'] ?? null,
            'class_section_id' => $data['class_section_id'] ?? null,
            'type' => $data['type'],
            'title_en' => $data['title_en'],
            'title_ar' => $data['title_ar'],
            'instructions_en' => $data['instructions_en'] ?? null,
            'instructions_ar' => $data['instructions_ar'] ?? null,
            'time_limit_seconds' => $data['time_limit_seconds'] ?? null,
            'max_attempts' => $data['max_attempts'] ?? ($data['type'] === 'exam' ? 1 : 3),
            'available_from' => $data['available_from'] ?? null,
            'available_until' => $data['available_until'] ?? null,
            'shuffle_questions' => $data['shuffle_questions'] ?? false,
            'show_results' => $data['show_results'] ?? 'after_submit',
            'counts_toward_grade' => $data['counts_toward_grade'] ?? ($data['type'] !== 'practice'),
            'status' => 'draft',
        ]);
    }

    public function attachQuestion(Assessment $assessment, int $questionId, ?float $points = null, ?int $sequence = null): AssessmentQuestion
    {
        if (! $assessment->isEditable()) {
            throw ValidationException::withMessages(['assessment' => ['Only draft/scheduled assessments can be edited.']]);
        }

        $question = Question::query()->where('school_id', $assessment->school_id)->findOrFail($questionId);

        return AssessmentQuestion::query()->updateOrCreate(
            ['assessment_id' => $assessment->id, 'question_id' => $question->id],
            [
                'sequence' => $sequence ?? (($assessment->assessmentQuestions()->max('sequence') ?? 0) + 1),
                'points' => $points ?? $question->default_points,
            ]
        );
    }

    public function publish(Assessment $assessment): Assessment
    {
        if ($assessment->assessmentQuestions()->count() < 1) {
            throw ValidationException::withMessages(['questions' => ['Add at least one question before publishing.']]);
        }

        $assessment->forceFill(['status' => 'published'])->save();

        return $assessment->fresh(['assessmentQuestions.question.translations', 'assessmentQuestions.question.options']);
    }
}
