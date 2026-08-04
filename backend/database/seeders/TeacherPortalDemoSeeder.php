<?php

namespace Database\Seeders;

use App\Domain\Academics\Models\AcademicYear;
use App\Domain\Academics\Models\ClassAttendance;
use App\Domain\Academics\Models\ClassSection;
use App\Domain\Academics\Models\Enrollment;
use App\Domain\Academics\Models\Subject;
use App\Domain\Academics\Models\TeachingAssignment;
use App\Domain\Assessment\Models\Assessment;
use App\Domain\Assessment\Models\AssessmentAttempt;
use App\Domain\Assessment\Models\AssessmentQuestion;
use App\Domain\Assessment\Models\Question;
use App\Domain\Identity\Models\Role;
use App\Domain\Identity\Models\UserTenantRole;
use App\Domain\Learning\Models\AssignmentSubmission;
use App\Domain\Learning\Models\HomeworkAssignment;
use App\Domain\Learning\Models\InteractiveLesson;
use App\Domain\Learning\Models\LearningProgress;
use App\Domain\Learning\Models\LessonBlock;
use App\Domain\Learning\Models\LessonPlan;
use App\Domain\Learning\Models\MediaAsset;
use App\Domain\Learning\Models\StaffMessage;
use App\Domain\Organization\Models\School;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * Additive demo content for the institution teacher portal. Safe to re-run:
 * every block is keyed with updateOrCreate or guarded by an existence check.
 */
class TeacherPortalDemoSeeder extends Seeder
{
    private School $school;

    private ?AcademicYear $year = null;

    /** @var list<User> */
    private array $teachers = [];

    /** @var list<ClassSection> */
    private array $sections = [];

    /** @var list<Subject> */
    private array $subjects = [];

    /** @var list<TeachingAssignment>|null */
    private ?array $demoAssignments = null;

    public function run(): void
    {
        $school = School::query()->orderBy('id')->first();
        if (! $school) {
            $this->command?->warn('No school found — run DemoDataSeeder first.');

            return;
        }

        $this->school = $school;
        $this->year = AcademicYear::query()
            ->where('school_id', $school->id)
            ->orderByDesc('is_current')
            ->first();

        $this->teachers = User::query()
            ->where('tenant_id', $school->tenant_id)
            ->where('email', 'like', 'teacher%@alnoor.test')
            ->orderBy('id')
            ->get()
            ->all();

        $tutor = User::query()
            ->where('tenant_id', $school->tenant_id)
            ->where('email', 'tutor@alnoor.test')
            ->first();
        if ($tutor) {
            $this->teachers[] = $tutor;
        }

        if ($this->teachers === []) {
            $this->command?->warn('No teacher users found — run DemoDataSeeder first.');

            return;
        }

        $this->sections = ClassSection::query()
            ->where('school_id', $school->id)
            ->orderBy('id')
            ->get()
            ->all();
        $this->subjects = Subject::query()
            ->where('school_id', $school->id)
            ->orderBy('id')
            ->get()
            ->all();

        $this->broadenTeachingAssignments();
        $this->fillClassRosters();
        $this->seedLessonPlans();
        $this->seedLessonBlocks();
        $this->seedHomework();
        $this->seedProjectAssignments();
        $this->seedQuizzesAndExams();
        $this->seedAssessmentQuestionsAndAttempts();
        $this->seedLearningProgress();
        $this->seedAttendance();
        $this->seedResources();
        $this->seedMessages();

        $this->command?->info('Teacher portal demo data seeded.');
    }

    /**
     * The base seeder gives each teacher a single section. Give the primary demo
     * teachers a realistic four-section, multi-subject load.
     */
    private function broadenTeachingAssignments(): void
    {
        if ($this->sections === [] || $this->subjects === [] || ! $this->year) {
            return;
        }

        foreach (array_slice($this->teachers, 0, 3) as $t => $teacher) {
            foreach (range(0, 3) as $offset) {
                $section = $this->sections[($t * 4 + $offset) % count($this->sections)];
                $subject = $this->subjects[($t * 2 + $offset) % count($this->subjects)];

                TeachingAssignment::query()->updateOrCreate(
                    [
                        'school_id' => $this->school->id,
                        'teacher_user_id' => $teacher->id,
                        'class_section_id' => $section->id,
                        'subject_id' => $subject->id,
                    ],
                    [
                        'tenant_id' => $this->school->tenant_id,
                        'academic_year_id' => $this->year->id,
                        'status' => 'active',
                    ]
                );
            }
        }
    }

    /**
     * The base seeder enrols one or two students per section, which leaves the
     * register and grade book almost empty. Top each section up to a full class.
     */
    private function fillClassRosters(): void
    {
        if ($this->sections === [] || ! $this->year) {
            return;
        }

        $studentRole = Role::query()->where('code', 'student')->first();
        if (! $studentRole) {
            return;
        }

        $targetPerSection = 18;
        $sections = array_slice($this->sections, 0, 8);
        $firstNames = ['Amir', 'Layla', 'Omar', 'Sara', 'Yusuf', 'Noor', 'Zaid', 'Hana', 'Karim', 'Maryam',
            'Tariq', 'Salma', 'Bilal', 'Rania', 'Idris', 'Dana', 'Faris', 'Lina', 'Nabil', 'Aisha'];
        $lastNames = ['Haddad', 'Nasser', 'Khalil', 'Farouk', 'Saleh', 'Mansour', 'Rashid', 'Aziz',
            'Jaber', 'Kamal', 'Sayed', 'Darwish'];

        $counter = User::query()
            ->where('tenant_id', $this->school->tenant_id)
            ->where('email', 'like', 'learner%@alnoor.test')
            ->count();

        foreach ($sections as $section) {
            $current = Enrollment::query()
                ->where('school_id', $this->school->id)
                ->where('class_section_id', $section->id)
                ->count();

            for ($i = $current; $i < $targetPerSection; $i++) {
                $counter++;
                $email = "learner{$counter}@alnoor.test";
                if (User::query()->where('email', $email)->exists()) {
                    continue;
                }

                $student = User::query()->create([
                    'tenant_id' => $this->school->tenant_id,
                    'email' => $email,
                    'password' => 'Password!123',
                    'first_name' => $firstNames[$counter % count($firstNames)],
                    'last_name' => $lastNames[$counter % count($lastNames)],
                    'first_name_ar' => $firstNames[$counter % count($firstNames)],
                    'last_name_ar' => $lastNames[$counter % count($lastNames)],
                    'locale' => 'en',
                    'timezone' => 'Asia/Riyadh',
                    'status' => 'active',
                    'email_verified_at' => now(),
                ]);

                UserTenantRole::query()->create([
                    'user_id' => $student->id,
                    'tenant_id' => $this->school->tenant_id,
                    'role_id' => $studentRole->id,
                    'school_id' => $this->school->id,
                ]);

                Enrollment::query()->create([
                    'tenant_id' => $this->school->tenant_id,
                    'school_id' => $this->school->id,
                    'academic_year_id' => $this->year->id,
                    'class_section_id' => $section->id,
                    'student_user_id' => $student->id,
                    'grade_id' => $section->grade_id,
                    'status' => 'active',
                    'enrolled_on' => Carbon::now()->subMonths(2)->toDateString(),
                ]);
            }
        }
    }

    private function seedLessonPlans(): void
    {
        if (LessonPlan::query()->where('school_id', $this->school->id)->exists()) {
            return;
        }

        $n = 0;

        foreach ($this->demoAssignments() as $assignment) {
            $bank = $this->lessonTopicsFor($assignment->subject?->code);

            foreach (array_slice($bank, 0, 2) as $slot => [$title, $objective]) {
                $status = match ($n % 5) {
                    2, 4 => 'draft',
                    default => 'published',
                };

                LessonPlan::query()->create([
                    'tenant_id' => $this->school->tenant_id,
                    'school_id' => $this->school->id,
                    'teacher_user_id' => $assignment->teacher_user_id,
                    'subject_id' => $assignment->subject_id,
                    'class_section_id' => $assignment->class_section_id,
                    'title_en' => $title,
                    'title_ar' => $title,
                    'planned_on' => Carbon::now()->startOfWeek()->addDays(($n % 10) - 3 + $slot)->toDateString(),
                    'duration_minutes' => [40, 45, 50, 60][$n % 4],
                    'objectives' => $objective,
                    'materials' => 'Whiteboard, printed worksheet, projector, and the class set of textbooks.',
                    'activities' => "Starter (5 min): recall quiz.\nMain (25 min): guided practice in pairs.\nPlenary (10 min): exit ticket and review.",
                    'assessment_notes' => 'Circulate during pair work; collect exit tickets to check understanding.',
                    'homework_notes' => 'Complete the practice set and bring questions to the next lesson.',
                    'status' => $status,
                ]);

                $n++;
            }
        }
    }

    /**
     * Active teaching assignments for the demo teachers, one per class+subject. Content is
     * seeded against these so every row a teacher sees sits in a class they actually teach,
     * and co-taught classes do not get duplicate tasks.
     *
     * @return list<TeachingAssignment>
     */
    private function demoAssignments(): array
    {
        if ($this->demoAssignments !== null) {
            return $this->demoAssignments;
        }

        $teacherIds = array_map(
            fn (User $t) => $t->id,
            array_slice($this->teachers, 0, 3)
        );

        return $this->demoAssignments = TeachingAssignment::query()
            ->where('school_id', $this->school->id)
            ->whereIn('teacher_user_id', $teacherIds ?: [0])
            ->where('status', 'active')
            ->with('subject')
            ->orderBy('teacher_user_id')
            ->orderBy('class_section_id')
            ->get()
            ->unique(fn (TeachingAssignment $a) => $a->class_section_id.':'.$a->subject_id)
            ->values()
            ->all();
    }

    /**
     * Lesson titles that actually belong to the subject being taught, so demo rows
     * do not pair "Electricity Basics" with Mathematics.
     *
     * @return list<array{0: string, 1: string}>
     */
    private function lessonTopicsFor(?string $subjectCode): array
    {
        $bank = [
            'MATH' => [
                ['Fractions in Context', 'Compare and order fractions with unlike denominators.'],
                ['Linear Equations', 'Solve two-step linear equations and check solutions.'],
                ['Geometry: Angles', 'Measure and classify acute, obtuse, and reflex angles.'],
            ],
            'SCI' => [
                ['The Water Cycle', 'Describe evaporation, condensation, and precipitation.'],
                ['Ecosystems and Food Webs', 'Trace energy flow through a food chain and food web.'],
                ['States of Matter', 'Explain melting, freezing, and evaporation as particle behaviour.'],
            ],
            'PHY' => [
                ['Forces and Motion', 'Identify balanced and unbalanced forces in everyday situations.'],
                ['Electricity Basics', 'Build a simple series circuit and predict current flow.'],
                ['Light and Reflection', 'Predict the path of light reflecting from a plane mirror.'],
            ],
            'CHE' => [
                ['Chemical Reactions', 'Recognise the signs that a chemical change has occurred.'],
                ['Acids and Bases', 'Use indicators to place substances on the pH scale.'],
                ['The Periodic Table', 'Locate groups and periods and describe their trends.'],
            ],
            'BIO' => [
                ['Cell Structure', 'Label the major organelles of plant and animal cells.'],
                ['Photosynthesis', 'Explain how plants convert light energy into glucose.'],
                ['The Human Digestive System', 'Sequence the organs food passes through and their roles.'],
            ],
            'CS' => [
                ['Algorithms and Flowcharts', 'Express an everyday process as an ordered algorithm.'],
                ['Introduction to Loops', 'Use a counted loop to repeat instructions efficiently.'],
                ['Data and Variables', 'Choose appropriate data types for simple programs.'],
            ],
            'ROB' => [
                ['Sensors and Actuators', 'Match common sensors to the measurements they take.'],
                ['Programming a Line Follower', 'Tune a robot to follow a line using sensor feedback.'],
                ['Gears and Motion', 'Predict how gear ratios change speed and torque.'],
            ],
            'ENG' => [
                ['Persuasive Writing', 'Structure an argument with a claim and supporting evidence.'],
                ['Narrative Structure', 'Map exposition, rising action, climax, and resolution.'],
                ['Poetry and Imagery', 'Identify simile, metaphor, and imagery in a short poem.'],
            ],
            'ARB' => [
                ['Arabic Reading Fluency', 'Read a short passage aloud with accurate vowelling.'],
                ['Sentence Construction', 'Build nominal and verbal sentences correctly.'],
                ['Descriptive Vocabulary', 'Use adjectives to describe people and places.'],
            ],
            'ISL' => [
                ['Pillars of Islam', 'Describe the five pillars and their significance.'],
                ['Stories of the Prophets', 'Retell a prophetic story and the lesson it teaches.'],
                ['Manners and Character', 'Apply principles of honesty and kindness to daily life.'],
            ],
            'GEO' => [
                ['Map Skills', 'Use grid references and scale to read a map.'],
                ['Rivers and Landforms', 'Describe how rivers shape the landscape over time.'],
                ['Climate Zones', 'Compare the climate of tropical and temperate regions.'],
            ],
            'ART' => [
                ['Colour Theory', 'Mix secondary colours and describe warm and cool palettes.'],
                ['Perspective Drawing', 'Use a single vanishing point to create depth.'],
                ['Pattern and Texture', 'Create repeating patterns inspired by Islamic geometry.'],
            ],
        ];

        return $bank[$subjectCode] ?? [
            ['Unit Review and Consolidation', 'Revisit the key ideas of the unit and close gaps.'],
            ['Applied Practice Workshop', 'Apply this unit to a structured real-world task.'],
        ];
    }

    /**
     * Interactive lessons ship with no blocks, so every card in the portal reads
     * "0 blocks". Give each one a short, readable block sequence.
     */
    private function seedLessonBlocks(): void
    {
        if (LessonBlock::query()->exists()) {
            return;
        }

        $lessons = InteractiveLesson::query()
            ->where('school_id', $this->school->id)
            ->with('curriculumLesson')
            ->get();

        foreach ($lessons as $lesson) {
            $topic = $lesson->curriculumLesson?->title_en ?? $lesson->title_en;

            $blocks = [
                ['text', [
                    'heading' => 'Introduction',
                    'body' => "A short overview of {$topic} and why it matters.",
                ]],
                ['video', [
                    'title' => "{$topic} — walkthrough",
                    'duration_seconds' => 240,
                    'provider' => 'internal',
                ]],
                ['text', [
                    'heading' => 'Worked example',
                    'body' => 'Step through one example together before independent practice.',
                ]],
                ['quiz', [
                    'question' => "Which statement about {$topic} is correct?",
                    'options' => ['Statement A', 'Statement B', 'Statement C', 'Statement D'],
                    'answer_index' => 1,
                ]],
                ['reflection', [
                    'prompt' => 'In one sentence, explain what you found hardest about this lesson.',
                ]],
            ];

            foreach ($blocks as $sequence => [$type, $payload]) {
                LessonBlock::query()->create([
                    'interactive_lesson_id' => $lesson->id,
                    'block_type' => $type,
                    'sequence' => $sequence + 1,
                    'payload_json' => $payload,
                ]);
            }
        }
    }

    /**
     * The base seeder spreads homework across every section in the school, which leaves
     * an individual teacher's page thin. Give each taught class its own set.
     */
    private function seedHomework(): void
    {
        $teaching = $this->demoAssignments();
        $sectionIds = array_map(fn ($a) => $a->class_section_id, $teaching);

        $existing = HomeworkAssignment::query()
            ->where('school_id', $this->school->id)
            ->where('assignment_kind', 'homework')
            ->whereIn('class_section_id', $sectionIds ?: [0])
            ->count();
        if ($existing >= count($teaching) * 2) {
            return;
        }

        $i = 0;

        foreach ($teaching as $teaching_) {
            $subject = $teaching_->subject;
            $students = $this->sectionStudents($teaching_->class_section_id);

            foreach ($this->homeworkTasksFor($subject?->code) as $slot => $task) {
                // The second task in each class is still open, so teachers have work to mark.
                $isOpen = $slot === 1;

                $homework = HomeworkAssignment::query()->create([
                    'tenant_id' => $this->school->tenant_id,
                    'school_id' => $this->school->id,
                    'subject_id' => $teaching_->subject_id,
                    'class_section_id' => $teaching_->class_section_id,
                    'title_en' => $task,
                    'title_ar' => $task,
                    'instructions_en' => 'Complete the task in your exercise book and bring any questions to the next lesson.',
                    'due_at' => $isOpen
                        ? Carbon::now()->addDays(2 + ($i % 5))
                        : Carbon::now()->subDays(3 + ($i % 6)),
                    'allow_late' => true,
                    'is_scored' => true,
                    'max_score' => 20,
                    'include_in_reports' => true,
                    'status' => 'published',
                    'assignment_kind' => 'homework',
                    'created_by' => $teaching_->teacher_user_id,
                ]);

                foreach ($students as $s => $student) {
                    // A few learners have not handed in; most marked work is complete.
                    if (($i + $s) % 9 === 8) {
                        continue;
                    }
                    $graded = ! $isOpen && ($i + $s) % 7 !== 0;

                    AssignmentSubmission::query()->create([
                        'assignment_id' => $homework->id,
                        'student_user_id' => $student->id,
                        'tenant_id' => $this->school->tenant_id,
                        'body_text' => "Homework submission for {$task}.",
                        'submitted_at' => Carbon::now()->subDays(max(1, 6 - $s)),
                        'is_late' => ($i + $s) % 9 === 0,
                        'score' => $graded ? 11 + (($i * 3 + $s * 5) % 10) : null,
                        'feedback' => $graded ? 'Good effort — check your working on the last question.' : null,
                        'status' => $graded ? 'graded' : 'submitted',
                    ]);
                }

                $i++;
            }
        }
    }

    /** @return list<string> */
    private function homeworkTasksFor(?string $subjectCode): array
    {
        $bank = [
            'MATH' => ['Practice Set: Equations', 'Worksheet: Word Problems'],
            'SCI' => ['Reading: The Water Cycle', 'Worksheet: Label the Diagram'],
            'PHY' => ['Problem Set: Forces', 'Circuit Diagrams Practice'],
            'CHE' => ['Balancing Equations Practice', 'Reading: Acids and Bases'],
            'BIO' => ['Diagram: Plant Cell', 'Reading: Digestion'],
            'CS' => ['Trace the Algorithm', 'Write Your First Loop'],
            'ROB' => ['Sensor Reading Log', 'Sketch: Gear Train'],
            'ENG' => ['Reading Response Journal', 'Paragraph: Persuasive Opening'],
            'ARB' => ['Reading Practice Passage', 'Vocabulary Worksheet'],
            'ISL' => ['Reading: The Five Pillars', 'Reflection: Good Character'],
            'GEO' => ['Map Skills Worksheet', 'Reading: Rivers'],
            'ART' => ['Sketchbook: Colour Wheel', 'Observation Drawing'],
        ];

        return $bank[$subjectCode] ?? ['Practice Set', 'Reading and Review'];
    }

    private function seedProjectAssignments(): void
    {
        $teachingSectionIds = array_map(fn ($a) => $a->class_section_id, $this->demoAssignments());

        $existing = HomeworkAssignment::query()
            ->where('school_id', $this->school->id)
            ->where('assignment_kind', 'assignment')
            ->whereIn('class_section_id', $teachingSectionIds ?: [0])
            ->count();
        if ($existing > 0) {
            return;
        }

        $i = 0;

        foreach ($this->demoAssignments() as $teaching) {
            $subject = $teaching->subject;
            $title = $this->projectTitleFor($subject?->code, $i);
            $students = $this->sectionStudents($teaching->class_section_id);

            // Leave the newest project ungraded so the grading queue is not always empty.
            $isOpen = $i % 4 === 3;
            $maxScore = [50, 100, 20][$i % 3];

            $assignment = HomeworkAssignment::query()->create([
                'tenant_id' => $this->school->tenant_id,
                'school_id' => $this->school->id,
                'subject_id' => $teaching->subject_id,
                'class_section_id' => $teaching->class_section_id,
                'title_en' => $title,
                'title_ar' => $title,
                'instructions_en' => 'Work independently unless told otherwise. Submit a single PDF with your name and class on the cover page.',
                'due_at' => $isOpen
                    ? Carbon::now()->addDays(4 + $i)
                    : Carbon::now()->subDays(2 + $i),
                'allow_late' => $i % 3 !== 0,
                'is_scored' => true,
                'max_score' => $maxScore,
                'include_in_reports' => true,
                'status' => $i % 5 === 0 ? 'draft' : 'published',
                'assignment_kind' => 'assignment',
                'created_by' => $teaching->teacher_user_id,
            ]);

            foreach ($students as $s => $student) {
                // Not everyone hands work in, and not everything is marked yet.
                if (($i + $s) % 11 === 10) {
                    continue;
                }
                $graded = ! $isOpen && ($i + $s) % 8 !== 0;

                AssignmentSubmission::query()->create([
                    'assignment_id' => $assignment->id,
                    'student_user_id' => $student->id,
                    'tenant_id' => $this->school->tenant_id,
                    'body_text' => "Project submission for {$title}.",
                    'submitted_at' => Carbon::now()->subDays(max(1, 9 - $s)),
                    'is_late' => ($i + $s) % 7 === 0,
                    'score' => $graded ? round($maxScore * (0.55 + ((($i * 3 + $s * 7) % 40) / 100)), 2) : null,
                    'feedback' => $graded ? 'Solid work. Strengthen your conclusion with more evidence.' : null,
                    'status' => $graded ? 'graded' : 'submitted',
                ]);
            }

            $i++;
        }
    }

    private function projectTitleFor(?string $subjectCode, int $index): string
    {
        $bank = [
            'MATH' => ['Data Investigation: Local Weather', 'Design Challenge: Scale Model Floor Plan'],
            'SCI' => ['Case Study: Water Conservation', 'Poster: The Solar System'],
            'PHY' => ['Lab Report: Measuring Density', 'Design Challenge: Bridge Build'],
            'CHE' => ['Lab Report: Rates of Reaction', 'Research Project: Everyday Polymers'],
            'BIO' => ['Model Build: Human Skeleton', 'Field Study: Local Biodiversity'],
            'CS' => ['Coding Task: Simple Calculator', 'App Concept: Solve a School Problem'],
            'ROB' => ['Build Log: Obstacle-Avoiding Robot', 'Design Brief: Warehouse Gripper'],
            'ENG' => ['Book Review and Presentation', 'Essay: A Turning Point in History'],
            'ARB' => ['Short Story in Arabic', 'Presentation: A Place I Love'],
            'ISL' => ['Portfolio: Term Reflection', 'Research: Contributions of Muslim Scholars'],
            'GEO' => ['Case Study: A River Journey', 'Map Project: Our Neighbourhood'],
            'ART' => ['Portfolio: Term Reflection', 'Studio Project: Pattern and Symmetry'],
        ];

        $options = $bank[$subjectCode] ?? ['Research Project: Renewable Energy', 'Group Task: Market Survey'];

        return $options[$index % count($options)];
    }

    private function seedQuizzesAndExams(): void
    {
        foreach (['quiz', 'exam'] as $type) {
            $teaching = $this->demoAssignments();
            $existing = Assessment::query()
                ->where('school_id', $this->school->id)
                ->where('type', $type)
                ->whereIn('class_section_id', array_map(fn ($a) => $a->class_section_id, $teaching) ?: [0])
                ->count();
            if ($existing >= count($teaching)) {
                continue;
            }

            $label = $type === 'quiz' ? 'Quiz' : 'Exam';
            // Offset the draft slot per type so a class never has every assessment unpublished.
            $draftSlot = $type === 'quiz' ? 0 : 2;

            foreach ($teaching as $i => $assignment) {
                $subject = $assignment->subject;
                $unit = $type === 'quiz' ? 'Unit '.(($i % 4) + 1).' Check' : 'End of Term Paper';

                Assessment::query()->create([
                    'tenant_id' => $this->school->tenant_id,
                    'school_id' => $this->school->id,
                    'subject_id' => $assignment->subject_id,
                    'class_section_id' => $assignment->class_section_id,
                    'type' => $type,
                    'title_en' => sprintf('%s %s: %s', $subject?->name_en ?? 'General', $label, $unit),
                    'title_ar' => sprintf('%s %d', $label, $i + 1),
                    'instructions_en' => $type === 'quiz'
                        ? 'Answer all questions. You may attempt this quiz more than once.'
                        : 'Closed book. Answer every section. Calculators are permitted.',
                    'time_limit_seconds' => $type === 'quiz' ? 900 : 5400,
                    'max_attempts' => $type === 'quiz' ? 3 : 1,
                    'available_from' => Carbon::now()->subDays(5),
                    'available_until' => Carbon::now()->addDays(7 + $i * 2),
                    'shuffle_questions' => $type === 'quiz',
                    'show_results' => $type === 'quiz' ? 'after_submit' : 'after_due',
                    'counts_toward_grade' => true,
                    'status' => $i % 4 === $draftSlot ? 'draft' : 'published',
                ]);
            }
        }
    }

    /**
     * A quiz with no questions and no attempts reads as broken in the portal. Stock the
     * question bank per subject, attach questions, and record student attempts.
     */
    private function seedAssessmentQuestionsAndAttempts(): void
    {
        $sectionIds = array_map(fn ($a) => $a->class_section_id, $this->demoAssignments());

        $assessments = Assessment::query()
            ->where('school_id', $this->school->id)
            ->whereIn('class_section_id', $sectionIds ?: [0])
            ->get();

        foreach ($assessments as $index => $assessment) {
            $wanted = $assessment->type === 'quiz' ? 6 : 12;
            $questionIds = $this->questionBankFor($assessment->subject_id, $wanted);

            if (AssessmentQuestion::query()->where('assessment_id', $assessment->id)->doesntExist()) {
                foreach ($questionIds as $sequence => $questionId) {
                    AssessmentQuestion::query()->create([
                        'assessment_id' => $assessment->id,
                        'question_id' => $questionId,
                        'sequence' => $sequence + 1,
                        'points' => 5,
                    ]);
                }
            }

            if ($assessment->status !== 'published') {
                continue;
            }

            if (AssessmentAttempt::query()->where('assessment_id', $assessment->id)->exists()) {
                continue;
            }

            $maxScore = count($questionIds) * 5;
            $students = $this->sectionStudents($assessment->class_section_id);

            foreach ($students as $s => $student) {
                // Not everyone has sat it yet, and a few are still waiting on marks.
                if (($index + $s) % 9 === 8) {
                    continue;
                }
                $awaitingMarks = ($index + $s) % 11 === 1;
                $score = round($maxScore * (0.55 + ((($index * 5 + $s * 11) % 40) / 100)), 2);

                AssessmentAttempt::query()->create([
                    'tenant_id' => $this->school->tenant_id,
                    'assessment_id' => $assessment->id,
                    'student_user_id' => $student->id,
                    'attempt_no' => 1,
                    'locale' => 'en',
                    'status' => $awaitingMarks ? 'submitted' : 'graded',
                    'score' => $awaitingMarks ? null : $score,
                    'max_score' => $maxScore,
                    'started_at' => Carbon::now()->subDays(4 + ($s % 3))->setTime(9, 0),
                    'submitted_at' => Carbon::now()->subDays(4 + ($s % 3))->setTime(9, 25),
                    'graded_at' => $awaitingMarks ? null : Carbon::now()->subDays(3 + ($s % 3)),
                ]);
            }
        }
    }

    /**
     * Question ids for a subject, topping the bank up when it is too thin.
     *
     * @return list<int>
     */
    private function questionBankFor(?int $subjectId, int $wanted): array
    {
        $ids = Question::query()
            ->where('school_id', $this->school->id)
            ->where('subject_id', $subjectId)
            ->where('status', 'active')
            ->orderBy('id')
            ->pluck('id')
            ->all();

        $difficulties = ['easy', 'medium', 'hard'];

        while (count($ids) < $wanted) {
            $question = Question::query()->create([
                'tenant_id' => $this->school->tenant_id,
                'school_id' => $this->school->id,
                'subject_id' => $subjectId,
                'type' => 'mcq',
                'difficulty' => $difficulties[count($ids) % 3],
                'default_points' => 5,
                'status' => 'active',
            ]);
            $ids[] = (int) $question->id;
        }

        return array_slice(array_map('intval', $ids), 0, $wanted);
    }

    /**
     * Without progress rows the student progress page shows "0 / 0 lessons" for the whole
     * class. Walk each taught class through the interactive lessons for its subject.
     */
    private function seedLearningProgress(): void
    {
        foreach ($this->demoAssignments() as $index => $teaching) {
            $lessons = InteractiveLesson::query()
                ->where('school_id', $this->school->id)
                ->whereHas(
                    'curriculumLesson.chapter',
                    fn ($q) => $q->where('subject_id', $teaching->subject_id)
                )
                ->orderBy('id')
                ->get();

            if ($lessons->isEmpty()) {
                continue;
            }

            foreach ($this->sectionStudents($teaching->class_section_id) as $s => $student) {
                foreach ($lessons as $l => $lesson) {
                    $seed = $index + $s + $l;

                    // Learners are part way through the unit: earlier lessons are done,
                    // the current one is in progress, later ones are untouched.
                    $state = match (true) {
                        $l < ($s % 3) + 1 => 'completed',
                        $l === ($s % 3) + 1 => 'in_progress',
                        default => null,
                    };

                    if ($state === null) {
                        continue;
                    }

                    $percent = $state === 'completed' ? 100 : 20 + (($seed * 13) % 60);

                    LearningProgress::query()->updateOrCreate(
                        [
                            'student_user_id' => $student->id,
                            'interactive_lesson_id' => $lesson->id,
                        ],
                        [
                            'tenant_id' => $this->school->tenant_id,
                            'school_id' => $this->school->id,
                            'status' => $state,
                            'progress_percent' => $percent,
                            'score' => $state === 'completed' ? 60 + (($seed * 7) % 40) : null,
                            'started_at' => Carbon::now()->subDays(12 - ($l * 2)),
                            'completed_at' => $state === 'completed'
                                ? Carbon::now()->subDays(10 - ($l * 2))
                                : null,
                        ]
                    );
                }
            }
        }
    }

    private function seedAttendance(): void
    {
        if (ClassAttendance::query()->where('school_id', $this->school->id)->exists()) {
            return;
        }

        $sections = array_slice($this->sections, 0, 6);

        foreach ($sections as $section) {
            $studentIds = Enrollment::query()
                ->where('school_id', $this->school->id)
                ->where('class_section_id', $section->id)
                ->pluck('student_user_id')
                ->all();

            if ($studentIds === []) {
                continue;
            }

            $date = Carbon::now();
            $days = 0;
            while ($days < 20) {
                if ($date->isFriday() || $date->isSaturday()) {
                    $date = $date->copy()->subDay();

                    continue;
                }

                foreach ($studentIds as $s => $studentId) {
                    $seed = ($s * 13 + $days * 7 + $section->id) % 20;
                    $status = match (true) {
                        $seed === 0 => 'absent',
                        $seed === 1 => 'excused',
                        $seed < 4 => 'late',
                        default => 'present',
                    };

                    ClassAttendance::query()->create([
                        'tenant_id' => $this->school->tenant_id,
                        'school_id' => $this->school->id,
                        'class_section_id' => $section->id,
                        'student_user_id' => $studentId,
                        'attendance_date' => $date->toDateString(),
                        'status' => $status,
                        'notes' => $status === 'excused' ? 'Medical note received.' : null,
                        'marked_by' => $this->teachers[0]->id,
                    ]);
                }

                $date = $date->copy()->subDay();
                $days++;
            }
        }
    }

    private function seedResources(): void
    {
        if (MediaAsset::query()->where('school_id', $this->school->id)->exists()) {
            return;
        }

        $items = [
            ['video', 'Introduction to Photosynthesis', 'مقدمة في التمثيل الضوئي', 'https://www.youtube.com/watch?v=sQK3Yr4Sc_k', 'video/mp4', 640, null],
            ['video', 'Newton\'s Laws Explained', 'شرح قوانين نيوتن', 'https://www.youtube.com/watch?v=kKKM8Y-u7ds', 'video/mp4', 725, null],
            ['pdf', 'Fractions Practice Workbook', 'كتاب تدريبات الكسور', 'https://example.org/resources/fractions-workbook.pdf', 'application/pdf', null, 1_840_000],
            ['pdf', 'Periodic Table Reference Sheet', 'ورقة الجدول الدوري', 'https://example.org/resources/periodic-table.pdf', 'application/pdf', null, 320_000],
            ['pdf', 'Lab Safety Guidelines', 'إرشادات السلامة في المختبر', 'https://example.org/resources/lab-safety.pdf', 'application/pdf', null, 96_000],
            ['image', 'Human Cell Diagram', 'مخطط الخلية البشرية', 'https://example.org/resources/cell-diagram.png', 'image/png', null, 640_000],
            ['image', 'World Map — Political', 'خريطة العالم السياسية', 'https://example.org/resources/world-map.png', 'image/png', null, 2_400_000],
            ['audio', 'Arabic Pronunciation Drill 1', 'تدريب النطق العربي ١', 'https://example.org/resources/arabic-drill-1.mp3', 'audio/mpeg', 420, null],
            ['audio', 'English Listening: Daily Routines', 'الاستماع بالإنجليزية: الروتين اليومي', 'https://example.org/resources/listening-1.mp3', 'audio/mpeg', 380, null],
            ['other', 'Virtual Circuit Lab', 'مختبر الدوائر الافتراضي', 'https://phet.colorado.edu/en/simulations/circuit-construction-kit-dc', 'application/x-simulation', null, null],
            ['other', 'Geometry Sketch Tool', 'أداة رسم الهندسة', 'https://www.geogebra.org/geometry', 'application/x-simulation', null, null],
            ['pdf', 'Essay Writing Rubric', 'معيار تقييم كتابة المقال', 'https://example.org/resources/essay-rubric.pdf', 'application/pdf', null, 48_000],
        ];

        foreach ($items as [$type, $title, $titleAr, $url, $mime, $duration, $size]) {
            MediaAsset::query()->create([
                'tenant_id' => $this->school->tenant_id,
                'school_id' => $this->school->id,
                'type' => $type,
                'title_en' => $title,
                'title_ar' => $titleAr,
                'external_url' => $url,
                'mime_type' => $mime,
                'duration_seconds' => $duration,
                'size_bytes' => $size ?? ($duration ? $duration * 12000 : null),
            ]);
        }
    }

    private function seedMessages(): void
    {
        if (StaffMessage::query()->where('school_id', $this->school->id)->exists()) {
            return;
        }

        $teacher = $this->teachers[0];
        $others = User::query()
            ->where('tenant_id', $this->school->tenant_id)
            ->where('id', '!=', $teacher->id)
            ->where('status', 'active')
            ->orderBy('id')
            ->limit(10)
            ->get()
            ->all();

        if ($others === []) {
            return;
        }

        $inbox = [
            ['academic', 'Question about the fractions homework', 'My child is stuck on question 4 of the fractions worksheet. Could you clarify what method you would like them to use?'],
            ['attendance', 'Absence on Thursday', 'Sara will be absent on Thursday for a medical appointment. We will catch up on any missed work over the weekend.'],
            ['general', 'Parent evening scheduling', 'Are there any slots left for the parent evening on the 14th? Afternoon would suit us best.'],
            ['behaviour', 'Follow-up on classroom incident', 'Thank you for the call yesterday. We have spoken with Omar at home and he understands what is expected.'],
            ['academic', 'Extra practice materials', 'Could you recommend any extra reading for the upcoming science exam? He would like to prepare properly.'],
            ['general', 'Field trip permission form', 'I have signed and returned the permission form for the museum trip. Please confirm you received it.'],
            ['academic', 'Progress report clarification', 'The report mentions "developing" for problem solving. What would move that to "secure"?'],
            ['attendance', 'Late arrival tomorrow', 'We will be about 20 minutes late tomorrow morning due to a dentist appointment.'],
        ];

        foreach ($inbox as $i => [$category, $subject, $body]) {
            $sender = $others[$i % count($others)];
            StaffMessage::query()->create([
                'tenant_id' => $this->school->tenant_id,
                'school_id' => $this->school->id,
                'sender_user_id' => $sender->id,
                'recipient_user_id' => $teacher->id,
                'subject' => $subject,
                'body' => $body,
                'category' => $category,
                'read_at' => $i > 4 ? Carbon::now()->subDays($i) : null,
                'created_at' => Carbon::now()->subDays($i)->subHours(3),
                'updated_at' => Carbon::now()->subDays($i)->subHours(3),
            ]);
        }

        $sent = [
            ['academic', 'Weekly homework summary', 'This week we covered linear equations. Homework is due Thursday and should take about 30 minutes.'],
            ['general', 'Reminder: bring lab coats', 'A reminder that students need their lab coats for the practical session on Wednesday.'],
            ['behaviour', 'Positive note — great progress', 'I wanted to share that Layla has made excellent progress in class discussions this term. Well done to her.'],
            ['attendance', 'Attendance check-in', 'I noticed a few recent absences. Please let me know if there is anything the school can do to help.'],
        ];

        foreach ($sent as $i => [$category, $subject, $body]) {
            $recipient = $others[($i + 3) % count($others)];
            StaffMessage::query()->create([
                'tenant_id' => $this->school->tenant_id,
                'school_id' => $this->school->id,
                'sender_user_id' => $teacher->id,
                'recipient_user_id' => $recipient->id,
                'subject' => $subject,
                'body' => $body,
                'category' => $category,
                'created_at' => Carbon::now()->subDays($i * 2)->subHours(6),
                'updated_at' => Carbon::now()->subDays($i * 2)->subHours(6),
            ]);
        }
    }

    /** @return list<User> */
    private function sectionStudents(int $sectionId): array
    {
        $ids = Enrollment::query()
            ->where('school_id', $this->school->id)
            ->where('class_section_id', $sectionId)
            ->pluck('student_user_id')
            ->unique()
            ->all();

        return User::query()->whereIn('id', $ids ?: [0])->orderBy('id')->get()->all();
    }
}
