<?php

namespace App\Domain\Assessment\Services;

use App\Domain\Assessment\Models\Assessment;
use App\Domain\Assessment\Models\AssessmentAttempt;
use App\Domain\Assessment\Models\AssessmentResponse;
use App\Domain\Assessment\Models\Question;
use App\Services\BaseService;
use App\Support\TenantContext;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class GradingService extends BaseService
{
    public function __construct(TenantContext $tenantContext)
    {
        parent::__construct($tenantContext);
    }

    public function startAttempt(Assessment $assessment, int $studentId, string $locale = 'en'): AssessmentAttempt
    {
        if ($assessment->status !== 'published') {
            throw ValidationException::withMessages(['assessment' => ['Assessment is not available.']]);
        }

        $now = now();
        if ($assessment->available_from && $now->lt($assessment->available_from)) {
            throw ValidationException::withMessages(['assessment' => ['Assessment is not yet available.']]);
        }
        if ($assessment->available_until && $now->gt($assessment->available_until)) {
            throw ValidationException::withMessages(['assessment' => ['Assessment window has closed.']]);
        }

        $count = AssessmentAttempt::query()
            ->where('assessment_id', $assessment->id)
            ->where('student_user_id', $studentId)
            ->where('status', '!=', 'void')
            ->count();

        if ($count >= $assessment->max_attempts) {
            throw ValidationException::withMessages(['attempts' => ['Maximum attempts reached.']]);
        }

        $open = AssessmentAttempt::query()
            ->where('assessment_id', $assessment->id)
            ->where('student_user_id', $studentId)
            ->where('status', 'in_progress')
            ->first();

        if ($open) {
            return $open->load([
                'assessment.assessmentQuestions.question.translations',
                'assessment.assessmentQuestions.question.options',
            ]);
        }

        $maxScore = (float) $assessment->assessmentQuestions()->sum('points');

        return AssessmentAttempt::query()->create([
            'tenant_id' => $assessment->tenant_id,
            'assessment_id' => $assessment->id,
            'student_user_id' => $studentId,
            'attempt_no' => $count + 1,
            'locale' => $locale,
            'status' => 'in_progress',
            'max_score' => $maxScore,
            'started_at' => now(),
        ])->load([
            'assessment.assessmentQuestions.question.translations',
            'assessment.assessmentQuestions.question.options',
        ]);
    }

    /**
     * @param  array<int, array{question_id:int, response:?array}>  $answers
     */
    public function submitAttempt(AssessmentAttempt $attempt, array $answers): AssessmentAttempt
    {
        if ($attempt->status !== 'in_progress') {
            throw ValidationException::withMessages(['attempt' => ['Attempt is not in progress.']]);
        }

        return $this->transaction(function () use ($attempt, $answers) {
            $assessment = $attempt->assessment()->with([
                'assessmentQuestions.question.options',
                'assessmentQuestions.question.translations',
            ])->firstOrFail();
            $needsManual = false;
            $score = 0.0;

            foreach ($assessment->assessmentQuestions as $aq) {
                $question = $aq->question;
                $answer = collect($answers)->firstWhere('question_id', $question->id);
                $responsePayload = $answer['response'] ?? null;

                [$isCorrect, $points, $manual] = $this->autoGrade($question, $responsePayload, (float) $aq->points);
                if ($manual) {
                    $needsManual = true;
                } else {
                    $score += $points ?? 0;
                }

                AssessmentResponse::query()->updateOrCreate(
                    ['attempt_id' => $attempt->id, 'question_id' => $question->id],
                    [
                        'response_json' => $responsePayload,
                        'is_correct' => $isCorrect,
                        'points_awarded' => $manual ? null : $points,
                        'graded_by' => $manual ? null : Auth::id(),
                    ]
                );
            }

            $attempt->forceFill([
                'status' => $needsManual ? 'submitted' : 'graded',
                'score' => $needsManual ? null : $score,
                'submitted_at' => now(),
                'graded_at' => $needsManual ? null : now(),
            ])->save();

            return $attempt->fresh(['responses', 'assessment']);
        });
    }

    public function manualGrade(AssessmentResponse $response, float $points, ?bool $isCorrect, int $graderId): AssessmentResponse
    {
        $response->forceFill([
            'points_awarded' => $points,
            'is_correct' => $isCorrect,
            'graded_by' => $graderId,
        ])->save();

        $attempt = $response->attempt()->with('responses')->firstOrFail();
        $ungraded = $attempt->responses->contains(fn (AssessmentResponse $r) => $r->points_awarded === null);

        if (! $ungraded) {
            $attempt->forceFill([
                'score' => (float) $attempt->responses->sum('points_awarded'),
                'status' => 'graded',
                'graded_at' => now(),
            ])->save();
        }

        return $response->fresh('attempt');
    }

    /**
     * @return array{0:?bool,1:?float,2:bool}
     */
    private function autoGrade(Question $question, ?array $response, float $maxPoints): array
    {
        if ($question->type === 'short_text') {
            return [null, null, true];
        }

        if ($response === null) {
            return [false, 0.0, false];
        }

        return match ($question->type) {
            'mcq', 'boolean' => $this->gradeSingleChoice($question, $response, $maxPoints),
            'multi' => $this->gradeMulti($question, $response, $maxPoints),
            'numeric' => $this->gradeNumeric($question, $response, $maxPoints),
            default => [null, null, true],
        };
    }

    private function gradeSingleChoice(Question $question, array $response, float $maxPoints): array
    {
        $optionId = $response['option_id'] ?? null;
        $correct = $question->options->first(fn ($o) => $o->is_correct);
        $ok = $correct && (int) $optionId === (int) $correct->id;

        return [$ok, $ok ? $maxPoints : 0.0, false];
    }

    private function gradeMulti(Question $question, array $response, float $maxPoints): array
    {
        $selected = collect($response['option_ids'] ?? [])->map(fn ($id) => (int) $id)->sort()->values()->all();
        $correct = $question->options->where('is_correct', true)->pluck('id')->map(fn ($id) => (int) $id)->sort()->values()->all();
        $ok = $selected === $correct;

        return [$ok, $ok ? $maxPoints : 0.0, false];
    }

    private function gradeNumeric(Question $question, array $response, float $maxPoints): array
    {
        $expected = $question->options->firstWhere('is_correct', true)?->label;
        $given = $response['value'] ?? null;
        if ($expected === null || $given === null) {
            return [null, null, true];
        }
        $ok = abs((float) $given - (float) $expected) < 0.0001;

        return [$ok, $ok ? $maxPoints : 0.0, false];
    }
}
