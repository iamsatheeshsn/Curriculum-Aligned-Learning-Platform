<?php

namespace App\Domain\Assessment\Services;

use App\Domain\Assessment\Models\Question;
use App\Domain\Assessment\Models\QuestionOption;
use App\Domain\Assessment\Models\QuestionTranslation;
use App\Domain\Organization\Models\School;
use App\Services\BaseService;
use App\Support\TenantContext;

class QuestionBankService extends BaseService
{
    public function __construct(TenantContext $tenantContext)
    {
        parent::__construct($tenantContext);
    }

    public function create(School $school, array $data): Question
    {
        return $this->transaction(function () use ($school, $data) {
            $question = Question::query()->create([
                'tenant_id' => $school->tenant_id,
                'school_id' => $school->id,
                'subject_id' => $data['subject_id'] ?? null,
                'type' => $data['type'],
                'difficulty' => $data['difficulty'] ?? null,
                'default_points' => $data['default_points'] ?? 1,
                'status' => $data['status'] ?? 'active',
            ]);

            foreach ($data['translations'] ?? [] as $tr) {
                QuestionTranslation::query()->create([
                    'question_id' => $question->id,
                    'locale' => $tr['locale'],
                    'stem' => $tr['stem'],
                    'explanation' => $tr['explanation'] ?? null,
                ]);
            }

            foreach ($data['options'] ?? [] as $opt) {
                QuestionOption::query()->create([
                    'question_id' => $question->id,
                    'locale' => $opt['locale'] ?? 'en',
                    'label' => $opt['label'],
                    'is_correct' => (bool) ($opt['is_correct'] ?? false),
                    'sequence' => $opt['sequence'] ?? 1,
                ]);
            }

            if (! empty($data['learning_outcome_ids'])) {
                $question->learningOutcomes()->sync($data['learning_outcome_ids']);
            }

            return $question->load(['translations', 'options', 'learningOutcomes']);
        });
    }
}
