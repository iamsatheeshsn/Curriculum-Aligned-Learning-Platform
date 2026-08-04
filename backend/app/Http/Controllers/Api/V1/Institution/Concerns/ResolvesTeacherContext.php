<?php

namespace App\Http\Controllers\Api\V1\Institution\Concerns;

use App\Domain\Academics\Models\AcademicYear;
use App\Domain\Academics\Models\ClassSection;
use App\Domain\Academics\Models\Enrollment;
use App\Domain\Academics\Models\Subject;
use App\Domain\Academics\Models\TeachingAssignment;
use App\Domain\Organization\Models\School;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

trait ResolvesTeacherContext
{
    protected function guardTeacher(Request $request): void
    {
        $user = $request->user();
        abort_unless(
            $user?->hasRole('teacher')
                || $user?->hasRole('tutor')
                || $this->rbac->can($user, 'learning.content.assign')
                || $this->rbac->can($user, 'assessments.manage')
                || $this->rbac->can($user, 'progress.view_class')
                || $this->rbac->can($user, 'school.academics.manage'),
            403
        );
    }

    protected function teacherSchool(Request $request): School
    {
        return $this->schoolContext->resolveSchool($request->integer('school_id') ?: null);
    }

    protected function currentYear(School $school): ?AcademicYear
    {
        return AcademicYear::query()
            ->where('school_id', $school->id)
            ->orderByDesc('is_current')
            ->orderByDesc('starts_on')
            ->first();
    }

    /**
     * Class sections this teacher is assigned to. Falls back to every active section in the
     * school when no teaching assignment exists, so the portal is never a dead end.
     *
     * @return array{sections: Collection<int, ClassSection>, scope: string, subject_ids: list<int>}
     */
    protected function teacherSections(Request $request, School $school): array
    {
        $user = $request->user();

        $assignments = TeachingAssignment::query()
            ->where('school_id', $school->id)
            ->where('teacher_user_id', $user->id)
            ->where('status', 'active')
            ->get();

        $sectionIds = $assignments->pluck('class_section_id')->filter()->unique()->values()->all();
        $subjectIds = $assignments->pluck('subject_id')->filter()->unique()->values()->all();
        $scope = 'assigned';

        if ($sectionIds === []) {
            $scope = 'school';
            $sectionIds = ClassSection::query()
                ->where('school_id', $school->id)
                ->orderBy('name')
                ->pluck('id')
                ->all();
            $subjectIds = Subject::query()
                ->where('school_id', $school->id)
                ->pluck('id')
                ->all();
        }

        $sections = ClassSection::query()
            ->whereIn('id', $sectionIds ?: [0])
            ->with(['grade:id,name_en,code', 'schoolClass:id,code,name_en'])
            ->orderBy('name')
            ->get();

        return ['sections' => $sections, 'scope' => $scope, 'subject_ids' => array_map('intval', $subjectIds)];
    }

    /** @return list<int> */
    protected function teacherSectionIds(Request $request, School $school): array
    {
        return $this->teacherSections($request, $school)['sections']
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    /**
     * @param  Collection<int, ClassSection>  $sections
     * @return list<array<string, mixed>>
     */
    protected function presentSections(Collection $sections, School $school): array
    {
        $counts = Enrollment::query()
            ->where('school_id', $school->id)
            ->whereIn('class_section_id', $sections->pluck('id')->all() ?: [0])
            ->where('status', '!=', 'withdrawn')
            ->selectRaw('class_section_id, COUNT(*) as aggregate')
            ->groupBy('class_section_id')
            ->pluck('aggregate', 'class_section_id');

        return $sections->map(fn (ClassSection $section) => [
            'id' => (int) $section->id,
            'name' => $section->name,
            'section_code' => $section->section_code,
            'status' => $section->status,
            'grade' => $section->grade?->name_en,
            'class_name' => $section->schoolClass?->name_en,
            'class_code' => $section->schoolClass?->code,
            'label' => $this->sectionLabel($section),
            'students_count' => (int) ($counts[$section->id] ?? 0),
        ])->values()->all();
    }

    /**
     * Human label for a section, matching the option text used in the portal's class pickers
     * so list columns and filter dropdowns never disagree.
     */
    protected function sectionLabel(?ClassSection $section): ?string
    {
        if (! $section) {
            return null;
        }

        $prefix = $section->schoolClass?->name_en ?? $section->grade?->name_en ?? 'Class';

        return trim($prefix.' · '.$section->name);
    }

    /**
     * Enrolled students for a section, ordered by name.
     *
     * @return Collection<int, User>
     */
    protected function sectionRoster(int $sectionId, School $school): Collection
    {
        $studentIds = Enrollment::query()
            ->where('school_id', $school->id)
            ->where('class_section_id', $sectionId)
            ->where('status', '!=', 'withdrawn')
            ->pluck('student_user_id')
            ->unique()
            ->values()
            ->all();

        if ($studentIds === []) {
            return collect();
        }

        return User::query()
            ->whereIn('id', $studentIds)
            ->orderBy('first_name')
            ->orderBy('last_name')
            ->get(['id', 'first_name', 'last_name', 'email', 'status']);
    }

    protected function personName(?User $user): string
    {
        if (! $user) {
            return '—';
        }
        $name = trim(($user->first_name ?? '').' '.($user->last_name ?? ''));

        return $name !== '' ? $name : (string) $user->email;
    }

    /**
     * Subjects available to this teacher.
     *
     * @return list<array<string, mixed>>
     */
    protected function teacherSubjects(Request $request, School $school): array
    {
        $context = $this->teacherSections($request, $school);
        $query = Subject::query()->where('school_id', $school->id);

        if ($context['scope'] === 'assigned' && $context['subject_ids'] !== []) {
            $query->whereIn('id', $context['subject_ids']);
        }

        return $query->orderBy('name_en')
            ->get(['id', 'code', 'name_en', 'name_ar', 'status'])
            ->map(fn (Subject $s) => [
                'id' => (int) $s->id,
                'code' => $s->code,
                'name_en' => $s->name_en,
                'name_ar' => $s->name_ar,
                'status' => $s->status,
            ])->values()->all();
    }
}
