<?php

namespace Database\Seeders;

use App\Domain\Academics\Models\AcademicYear;
use App\Domain\Academics\Models\CalendarEvent;
use App\Domain\Academics\Models\ClassSection;
use App\Domain\Academics\Models\Enrollment;
use App\Domain\Academics\Models\Grade;
use App\Domain\Academics\Models\SchoolClass;
use App\Domain\Academics\Models\Subject;
use App\Domain\Academics\Models\TeachingAssignment;
use App\Domain\Academics\Models\Term;
use App\Domain\Assessment\Models\Assessment;
use App\Domain\Assessment\Models\AssessmentAttempt;
use App\Domain\Assessment\Models\AssessmentQuestion;
use App\Domain\Assessment\Models\Question;
use App\Domain\Assessment\Models\QuestionOption;
use App\Domain\Assessment\Models\QuestionTranslation;
use App\Domain\Billing\Models\BillingCoupon;
use App\Domain\Billing\Models\Invoice;
use App\Domain\Billing\Models\InvoiceItem;
use App\Domain\Billing\Models\Payment;
use App\Domain\Billing\Models\StudentInvoice;
use App\Domain\Billing\Models\StudentInvoiceItem;
use App\Domain\Billing\Models\SubscriptionPlan;
use App\Domain\Billing\Models\TenantSubscription;
use App\Domain\Curriculum\Models\Chapter;
use App\Domain\Curriculum\Models\Curriculum;
use App\Domain\Curriculum\Models\CurriculumLesson;
use App\Domain\Curriculum\Models\LearningOutcome;
use App\Domain\Identity\Models\ParentStudentLink;
use App\Domain\Identity\Models\Role;
use App\Domain\Identity\Models\UserTenantRole;
use App\Domain\Learning\Models\AssignmentSubmission;
use App\Domain\Learning\Models\HomeworkAssignment;
use App\Domain\Learning\Models\InteractiveLesson;
use App\Domain\Learning\Models\LearnerMessage;
use App\Domain\Learning\Models\LearningProgress;
use App\Domain\Learning\Models\SchoolCourse;
use App\Domain\Learning\Models\SchoolLesson;
use App\Domain\Organization\Models\Campus;
use App\Domain\Organization\Models\Country;
use App\Domain\Organization\Models\School;
use App\Domain\Organization\Models\SchoolNotification;
use App\Domain\Organization\Models\Tenant;
use App\Domain\Organization\Models\TenantBranding;
use App\Domain\Reporting\Models\Certificate;
use App\Domain\Tutoring\Models\SessionNote;
use App\Domain\Tutoring\Models\TutorAvailability;
use App\Domain\Tutoring\Models\TutorProfile;
use App\Domain\Tutoring\Models\TutoringAttendance;
use App\Domain\Tutoring\Models\TutoringSession;
use App\Domain\Tutoring\Models\TutoringSessionRating;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Flushes all application data except RBAC catalog tables, then seeds
 * realistic demo content (≥10 rows for major list screens).
 */
class DemoDataSeeder extends Seeder
{
    private const KEEP_TABLES = [
        'roles',
        'permissions',
        'permission_role',
        'migrations',
    ];

    private const PASSWORD_DEFAULT = 'Password!123';

    private const PASSWORD_OWNER = 'Password!456';

    private const PASSWORD_SUPER = 'ChangeMe!123';

    /** @var array<string, Role> */
    private array $roles = [];

    /** @var array<string, User> */
    private array $users = [];

    private Country $countrySa;

    private Tenant $platform;

    private Tenant $alNoor;

    private School $school;

    private Campus $campus;

    private AcademicYear $year;

    private Term $term;

    private Curriculum $curriculum;

    /** @var list<Grade> */
    private array $grades = [];

    /** @var list<Subject> */
    private array $subjects = [];

    /** @var list<ClassSection> */
    private array $sections = [];

    /** @var list<User> */
    private array $students = [];

    /** @var list<User> */
    private array $teachers = [];

    /** @var list<User> */
    private array $tutors = [];

    /** @var list<User> */
    private array $parents = [];

    /** @var list<TutorProfile> */
    private array $tutorProfiles = [];

    public function run(): void
    {
        $this->flushNonRbac();
        $this->loadRoles();
        $this->seedCountries();
        $this->seedPlansAndCoupons();
        $this->seedTenants();
        $this->seedPlatformUsers();
        $this->seedSchoolsAndCampuses();
        $this->seedTenantUsers();
        $this->seedAcademics();
        $this->seedCurriculum();
        $this->seedClassesEnrollments();
        $this->seedLearning();
        $this->seedHomework();
        $this->seedAssessments();
        $this->seedTutoring();
        $this->seedBilling();
        $this->seedCertificates();
        $this->seedCommunications();
        $this->seedCalendar();
        $this->seedMisc();

        $this->command?->info('Demo data seeded. RBAC catalog preserved.');
        $this->printCredentials();
    }

    private function flushNonRbac(): void
    {
        Schema::disableForeignKeyConstraints();

        $tables = collect(DB::select('SHOW TABLES'))
            ->map(fn ($row) => array_values((array) $row)[0])
            ->reject(fn (string $table) => in_array($table, self::KEEP_TABLES, true))
            ->values();

        foreach ($tables as $table) {
            DB::table($table)->truncate();
        }

        Schema::enableForeignKeyConstraints();
    }

    private function loadRoles(): void
    {
        $this->roles = Role::query()->get()->keyBy('code')->all();

        foreach ([
            'super_admin', 'customer_support', 'auditor', 'school_owner', 'school_admin',
            'campus_admin', 'principal', 'academic_coordinator', 'finance_manager',
            'teacher', 'tutor', 'student', 'parent',
        ] as $code) {
            if (! isset($this->roles[$code])) {
                throw new \RuntimeException("Missing RBAC role [{$code}]. Run RbacSeeder first.");
            }
        }
    }

    private function seedCountries(): void
    {
        $rows = [
            ['SA', 'Saudi Arabia', 'المملكة العربية السعودية', 'ar', 'Asia/Riyadh'],
            ['AE', 'United Arab Emirates', 'الإمارات العربية المتحدة', 'ar', 'Asia/Dubai'],
            ['KW', 'Kuwait', 'الكويت', 'ar', 'Asia/Kuwait'],
            ['QA', 'Qatar', 'قطر', 'ar', 'Asia/Qatar'],
            ['BH', 'Bahrain', 'البحرين', 'ar', 'Asia/Bahrain'],
            ['OM', 'Oman', 'عُمان', 'ar', 'Asia/Muscat'],
            ['EG', 'Egypt', 'مصر', 'ar', 'Africa/Cairo'],
            ['JO', 'Jordan', 'الأردن', 'ar', 'Asia/Amman'],
            ['GB', 'United Kingdom', 'المملكة المتحدة', 'en', 'Europe/London'],
            ['US', 'United States', 'الولايات المتحدة', 'en', 'America/New_York'],
            ['IN', 'India', 'الهند', 'en', 'Asia/Kolkata'],
            ['MY', 'Malaysia', 'ماليزيا', 'en', 'Asia/Kuala_Lumpur'],
        ];

        foreach ($rows as [$code, $en, $ar, $locale, $tz]) {
            Country::query()->create([
                'code' => $code,
                'name_en' => $en,
                'name_ar' => $ar,
                'default_locale' => $locale,
                'default_timezone' => $tz,
                'is_active' => true,
            ]);
        }

        $this->countrySa = Country::query()->where('code', 'SA')->firstOrFail();
    }

    private function seedPlansAndCoupons(): void
    {
        $plans = [
            ['starter', 'Starter', 'الأساسية', 299, 1, 1, 200, 20],
            ['growth', 'Growth', 'النمو', 799, 3, 5, 1000, 80],
            ['scale', 'Scale', 'التوسع', 1499, 10, 20, 5000, 250],
            ['enterprise', 'Enterprise', 'المؤسسات', 2999, 50, 100, 25000, 1000],
            ['pilot', 'Pilot', 'تجريبي', 99, 1, 1, 50, 5],
            ['campus-plus', 'Campus Plus', 'حرم إضافي', 499, 2, 8, 800, 60],
            ['stem-lab', 'STEM Lab', 'مختبر ستيم', 1199, 5, 10, 2000, 120],
            ['tutoring', 'Tutoring Suite', 'التدريس الخاص', 899, 3, 6, 1500, 100],
            ['assessment', 'Assessment Pro', 'التقييم الاحترافي', 699, 2, 4, 1200, 90],
            ['parent-hub', 'Parent Hub', 'بوابة أولياء الأمور', 399, 1, 2, 600, 40],
            ['full-suite', 'Full Suite', 'الحزمة الكاملة', 1999, 20, 40, 10000, 500],
            ['nonprofit', 'Nonprofit', 'غير ربحي', 199, 2, 3, 500, 40],
        ];

        foreach ($plans as [$code, $en, $ar, $price, $schools, $campuses, $students, $teachers]) {
            SubscriptionPlan::query()->create([
                'code' => $code,
                'name_en' => $en,
                'name_ar' => $ar,
                'price' => $price,
                'currency' => 'SAR',
                'max_schools' => $schools,
                'max_campuses' => $campuses,
                'max_students' => $students,
                'max_teachers' => $teachers,
                'max_storage_mb' => 10240,
                'modules_json' => ['academics', 'curriculum', 'tutoring', 'billing', 'assessments'],
                'is_active' => true,
            ]);
        }

        for ($i = 1; $i <= 12; $i++) {
            BillingCoupon::query()->create([
                'code' => sprintf('SAVE%02d', $i),
                'name_en' => "Launch discount {$i}",
                'name_ar' => "خصم الإطلاق {$i}",
                'discount_type' => $i % 2 === 0 ? 'percent' : 'fixed',
                'discount_value' => $i % 2 === 0 ? 10 + $i : 50 * $i,
                'currency' => 'SAR',
                'max_redemptions' => 100,
                'redemptions_count' => $i,
                'starts_at' => now()->subMonths(1),
                'ends_at' => now()->addMonths(6),
                'is_active' => true,
                'notes' => 'Demo coupon',
            ]);
        }
    }

    private function seedTenants(): void
    {
        $this->platform = Tenant::query()->create([
            'slug' => 'platform',
            'name' => 'Platform',
            'legal_name' => 'K-12 STEM Platform Operator',
            'primary_country_id' => $this->countrySa->id,
            'default_locale' => 'en',
            'default_timezone' => 'Asia/Riyadh',
            'status' => 'active',
            'settings' => ['portal' => 'control'],
        ]);

        $this->alNoor = Tenant::query()->create([
            'slug' => 'al-noor',
            'name' => 'Al Noor Academy',
            'legal_name' => 'Al Noor International Academy LLC',
            'primary_country_id' => $this->countrySa->id,
            'default_locale' => 'en',
            'default_timezone' => 'Asia/Riyadh',
            'status' => 'active',
            'settings' => ['brand' => 'al-noor'],
            'trial_ends_at' => now()->addMonths(2),
        ]);

        TenantBranding::query()->create([
            'tenant_id' => $this->alNoor->id,
            'primary_color' => '#0B6E4F',
            'secondary_color' => '#F4A261',
            'email_footer_en' => 'Al Noor Academy — Empowering STEM learners',
            'email_footer_ar' => 'أكاديمية النور — تمكين متعلمي العلوم والتقنية',
        ]);

        $names = [
            ['riyadh-stem', 'Riyadh STEM School'],
            ['jeddah-horizon', 'Jeddah Horizon Academy'],
            ['dammam-spark', 'Dammam Spark Institute'],
            ['khobar-nexus', 'Khobar Nexus School'],
            ['madinah-beacon', 'Madinah Beacon Academy'],
            ['tabuk-orbit', 'Tabuk Orbit School'],
            ['abha-summit', 'Abha Summit Academy'],
            ['qassim-forge', 'Qassim Forge School'],
            ['yanbu-coast', 'Yanbu Coast Academy'],
            ['hail-pioneer', 'Hail Pioneer School'],
            ['najran-valley', 'Najran Valley Academy'],
            ['jubail-industrial', 'Jubail Industrial STEM'],
        ];

        $planIds = SubscriptionPlan::query()->pluck('id')->all();
        $countryIds = Country::query()->pluck('id')->all();

        foreach ($names as $i => [$slug, $name]) {
            $tenant = Tenant::query()->create([
                'slug' => $slug,
                'name' => $name,
                'legal_name' => "{$name} Co.",
                'primary_country_id' => $countryIds[$i % count($countryIds)],
                'default_locale' => 'en',
                'default_timezone' => 'Asia/Riyadh',
                'status' => $i % 5 === 0 ? 'trial' : 'active',
                'trial_ends_at' => now()->addDays(30 + $i),
            ]);

            TenantSubscription::query()->create([
                'tenant_id' => $tenant->id,
                'plan_id' => $planIds[$i % count($planIds)],
                'starts_at' => now()->subMonths(3),
                'ends_at' => now()->addYear(),
                'status' => 'active',
            ]);
        }

        TenantSubscription::query()->create([
            'tenant_id' => $this->alNoor->id,
            'plan_id' => SubscriptionPlan::query()->where('code', 'full-suite')->value('id'),
            'starts_at' => now()->subYear(),
            'ends_at' => now()->addYear(),
            'status' => 'active',
        ]);
    }

    private function seedPlatformUsers(): void
    {
        $this->users['super_admin'] = $this->makeUser(
            email: 'superadmin@learning-platform.local',
            first: 'Super',
            last: 'Admin',
            password: self::PASSWORD_SUPER,
            tenantId: null,
        );
        $this->attachRole($this->users['super_admin'], 'super_admin', $this->platform);

        $this->users['customer_support'] = $this->makeUser(
            email: 'support@platform.test',
            first: 'Sara',
            last: 'Support',
            password: self::PASSWORD_DEFAULT,
            tenantId: null,
        );
        $this->attachRole($this->users['customer_support'], 'customer_support', $this->platform);

        $this->users['auditor'] = $this->makeUser(
            email: 'auditor@platform.test',
            first: 'Omar',
            last: 'Auditor',
            password: self::PASSWORD_DEFAULT,
            tenantId: null,
        );
        $this->attachRole($this->users['auditor'], 'auditor', $this->platform);
    }

    private function seedSchoolsAndCampuses(): void
    {
        $this->school = School::query()->create([
            'tenant_id' => $this->alNoor->id,
            'country_id' => $this->countrySa->id,
            'code' => 'AN-MAIN',
            'name_en' => 'Al Noor Main School',
            'name_ar' => 'مدرسة النور الرئيسية',
            'status' => 'active',
            'timezone' => 'Asia/Riyadh',
        ]);

        $this->campus = Campus::query()->create([
            'tenant_id' => $this->alNoor->id,
            'school_id' => $this->school->id,
            'code' => 'AN-C1',
            'name_en' => 'Olaya Campus',
            'name_ar' => 'حرم العليا',
            'timezone' => 'Asia/Riyadh',
            'address' => 'Olaya Street, Riyadh',
            'status' => 'active',
        ]);

        for ($i = 2; $i <= 12; $i++) {
            Campus::query()->create([
                'tenant_id' => $this->alNoor->id,
                'school_id' => $this->school->id,
                'code' => sprintf('AN-C%d', $i),
                'name_en' => "Campus {$i}",
                'name_ar' => "الحرم {$i}",
                'timezone' => 'Asia/Riyadh',
                'address' => "District {$i}, Riyadh",
                'status' => 'active',
            ]);
        }

        $otherTenants = Tenant::query()
            ->whereNotIn('slug', ['platform', 'al-noor'])
            ->orderBy('id')
            ->take(11)
            ->get();

        foreach ($otherTenants as $i => $tenant) {
            $school = School::query()->create([
                'tenant_id' => $tenant->id,
                'country_id' => $tenant->primary_country_id,
                'code' => sprintf('SCH-%02d', $i + 1),
                'name_en' => "{$tenant->name} Campus School",
                'name_ar' => "مدرسة {$tenant->name}",
                'status' => 'active',
                'timezone' => 'Asia/Riyadh',
            ]);

            Campus::query()->create([
                'tenant_id' => $tenant->id,
                'school_id' => $school->id,
                'code' => 'MAIN',
                'name_en' => 'Main Campus',
                'name_ar' => 'الحرم الرئيسي',
                'timezone' => 'Asia/Riyadh',
                'address' => 'Main Road',
                'status' => 'active',
            ]);
        }
    }

    private function seedTenantUsers(): void
    {
        $staff = [
            ['school_owner', 'owner@alnoor.test', 'Nadia', 'Owner', self::PASSWORD_OWNER],
            ['school_admin', 'admin@alnoor.test', 'Hassan', 'Admin', self::PASSWORD_DEFAULT],
            ['campus_admin', 'campus@alnoor.test', 'Layla', 'Campus', self::PASSWORD_DEFAULT],
            ['principal', 'principal@alnoor.test', 'Faisal', 'Principal', self::PASSWORD_DEFAULT],
            ['academic_coordinator', 'coordinator@alnoor.test', 'Maha', 'Coordinator', self::PASSWORD_DEFAULT],
            ['finance_manager', 'finance@alnoor.test', 'Yousef', 'Finance', self::PASSWORD_DEFAULT],
        ];

        foreach ($staff as [$role, $email, $first, $last, $password]) {
            $user = $this->makeUser($email, $first, $last, $password, $this->alNoor->id);
            $this->users[$role] = $user;
            $this->attachRole(
                $user,
                $role,
                $this->alNoor,
                $this->school->id,
                $role === 'campus_admin' ? $this->campus->id : null,
            );
        }

        for ($i = 1; $i <= 12; $i++) {
            $email = $i === 1 ? 'teacher@alnoor.test' : "teacher{$i}@alnoor.test";
            $user = $this->makeUser($email, "Teacher{$i}", 'AlNoor', self::PASSWORD_DEFAULT, $this->alNoor->id);
            $this->teachers[] = $user;
            $this->attachRole($user, 'teacher', $this->alNoor, $this->school->id);
            if ($i === 1) {
                $this->users['teacher'] = $user;
            }
        }

        for ($i = 1; $i <= 12; $i++) {
            $email = $i === 1 ? 'tutor@alnoor.test' : "tutor{$i}@alnoor.test";
            $user = $this->makeUser($email, "Tutor{$i}", 'AlNoor', self::PASSWORD_DEFAULT, $this->alNoor->id);
            $this->tutors[] = $user;
            $this->attachRole($user, 'tutor', $this->alNoor, $this->school->id);
            if ($i === 1) {
                $this->users['tutor'] = $user;
                $this->attachRole($user, 'teacher', $this->alNoor, $this->school->id);
            }
        }

        for ($i = 1; $i <= 14; $i++) {
            $email = $i === 1 ? 'student@alnoor.test' : "student{$i}@alnoor.test";
            $user = $this->makeUser($email, "Student{$i}", 'AlNoor', self::PASSWORD_DEFAULT, $this->alNoor->id);
            $this->students[] = $user;
            $this->attachRole($user, 'student', $this->alNoor, $this->school->id);
            if ($i === 1) {
                $this->users['student'] = $user;
            }
        }

        for ($i = 1; $i <= 12; $i++) {
            $email = $i === 1 ? 'parent@alnoor.test' : "parent{$i}@alnoor.test";
            $user = $this->makeUser($email, "Parent{$i}", 'AlNoor', self::PASSWORD_DEFAULT, $this->alNoor->id);
            $this->parents[] = $user;
            $this->attachRole($user, 'parent', $this->alNoor, $this->school->id);
            if ($i === 1) {
                $this->users['parent'] = $user;
            }

            $childA = $this->students[($i - 1) % count($this->students)];
            $childB = $this->students[$i % count($this->students)];

            ParentStudentLink::query()->create([
                'tenant_id' => $this->alNoor->id,
                'parent_user_id' => $user->id,
                'student_user_id' => $childA->id,
                'relationship' => 'parent',
                'is_primary' => true,
            ]);

            if ($childA->id !== $childB->id) {
                ParentStudentLink::query()->firstOrCreate(
                    [
                        'tenant_id' => $this->alNoor->id,
                        'parent_user_id' => $user->id,
                        'student_user_id' => $childB->id,
                    ],
                    [
                        'relationship' => 'guardian',
                        'is_primary' => false,
                    ]
                );
            }
        }
    }

    private function seedAcademics(): void
    {
        $this->year = AcademicYear::query()->create([
            'tenant_id' => $this->alNoor->id,
            'school_id' => $this->school->id,
            'name' => '2025-2026',
            'starts_on' => '2025-09-01',
            'ends_on' => '2026-06-30',
            'is_current' => true,
            'status' => 'active',
        ]);

        for ($i = 1; $i <= 3; $i++) {
            $term = Term::query()->create([
                'tenant_id' => $this->alNoor->id,
                'academic_year_id' => $this->year->id,
                'name_en' => "Term {$i}",
                'name_ar' => "الفصل {$i}",
                'sequence' => $i,
                'starts_on' => now()->startOfYear()->addMonths(($i - 1) * 3)->toDateString(),
                'ends_on' => now()->startOfYear()->addMonths(($i - 1) * 3 + 2)->endOfMonth()->toDateString(),
                'status' => $i === 1 ? 'active' : 'upcoming',
            ]);
            if ($i === 1) {
                $this->term = $term;
            }
        }

        for ($i = 1; $i <= 12; $i++) {
            $this->grades[] = Grade::query()->create([
                'tenant_id' => $this->alNoor->id,
                'school_id' => $this->school->id,
                'code' => sprintf('G%02d', $i),
                'name_en' => "Grade {$i}",
                'name_ar' => "الصف {$i}",
                'sequence' => $i,
            ]);
        }
    }

    private function seedCurriculum(): void
    {
        $this->curriculum = Curriculum::query()->create([
            'tenant_id' => $this->alNoor->id,
            'school_id' => $this->school->id,
            'country_id' => $this->countrySa->id,
            'code' => 'STEM-K12',
            'name_en' => 'Al Noor STEM Curriculum',
            'name_ar' => 'منهج النور للعلوم والتقنية',
            'version' => '2026.1',
            'status' => 'published',
            'published_at' => now()->subMonths(2),
            'is_latest' => true,
            'change_summary_en' => 'Initial published STEM track',
            'change_summary_ar' => 'النسخة الأولى من مسار ستيم',
        ]);

        $subjectDefs = [
            ['MATH', 'Mathematics', 'الرياضيات', true],
            ['SCI', 'Science', 'العلوم', true],
            ['PHY', 'Physics', 'الفيزياء', true],
            ['CHE', 'Chemistry', 'الكيمياء', true],
            ['BIO', 'Biology', 'الأحياء', true],
            ['CS', 'Computer Science', 'علوم الحاسب', true],
            ['ROB', 'Robotics', 'الروبوتات', true],
            ['ENG', 'English', 'اللغة الإنجليزية', false],
            ['ARB', 'Arabic', 'اللغة العربية', false],
            ['ISL', 'Islamic Studies', 'الدراسات الإسلامية', false],
            ['GEO', 'Geography', 'الجغرافيا', false],
            ['ART', 'Art & Design', 'الفن والتصميم', false],
        ];

        foreach ($subjectDefs as [$code, $en, $ar, $stem]) {
            $this->subjects[] = Subject::query()->create([
                'tenant_id' => $this->alNoor->id,
                'school_id' => $this->school->id,
                'curriculum_id' => $this->curriculum->id,
                'code' => $code,
                'name_en' => $en,
                'name_ar' => $ar,
                'is_stem' => $stem,
                'tutoring_enabled' => $stem,
                'status' => 'active',
            ]);
        }

        foreach ($this->subjects as $si => $subject) {
            for ($c = 1; $c <= 2; $c++) {
                $chapter = Chapter::query()->create([
                    'tenant_id' => $this->alNoor->id,
                    'school_id' => $this->school->id,
                    'curriculum_id' => $this->curriculum->id,
                    'subject_id' => $subject->id,
                    'grade_id' => $this->grades[min($si, count($this->grades) - 1)]->id,
                    'title_en' => "{$subject->name_en} Chapter {$c}",
                    'title_ar' => "{$subject->name_ar} الفصل {$c}",
                    'sequence' => $c,
                    'status' => 'published',
                ]);

                for ($l = 1; $l <= 2; $l++) {
                    CurriculumLesson::query()->create([
                        'tenant_id' => $this->alNoor->id,
                        'school_id' => $this->school->id,
                        'curriculum_id' => $this->curriculum->id,
                        'chapter_id' => $chapter->id,
                        'code' => sprintf('%s-C%d-L%d', $subject->code, $c, $l),
                        'title_en' => "{$subject->name_en} Lesson {$c}.{$l}",
                        'title_ar' => "{$subject->name_ar} الدرس {$c}.{$l}",
                        'summary_en' => "Core concepts for {$subject->name_en}",
                        'summary_ar' => "المفاهيم الأساسية لـ {$subject->name_ar}",
                        'sequence' => $l,
                        'estimated_minutes' => 40 + ($l * 5),
                        'difficulty' => ['easy', 'medium', 'hard'][($c + $l) % 3],
                        'status' => 'published',
                    ]);
                }
            }

            LearningOutcome::query()->create([
                'tenant_id' => $this->alNoor->id,
                'school_id' => $this->school->id,
                'curriculum_id' => $this->curriculum->id,
                'subject_id' => $subject->id,
                'code' => "LO-{$subject->code}",
                'statement_en' => "Students can apply {$subject->name_en} fundamentals",
                'statement_ar' => "يتمكن الطلاب من تطبيق أساسيات {$subject->name_ar}",
                'status' => 'active',
            ]);
        }
    }

    private function seedClassesEnrollments(): void
    {
        foreach (range(1, 12) as $i) {
            $grade = $this->grades[$i - 1];
            $class = SchoolClass::query()->create([
                'tenant_id' => $this->alNoor->id,
                'school_id' => $this->school->id,
                'campus_id' => $this->campus->id,
                'academic_year_id' => $this->year->id,
                'grade_id' => $grade->id,
                'code' => sprintf('CLS-%02d', $i),
                'name_en' => "Class {$i}",
                'name_ar' => "الفصل {$i}",
                'status' => 'active',
            ]);

            $section = ClassSection::query()->create([
                'tenant_id' => $this->alNoor->id,
                'school_id' => $this->school->id,
                'campus_id' => $this->campus->id,
                'academic_year_id' => $this->year->id,
                'grade_id' => $grade->id,
                'school_class_id' => $class->id,
                'name' => 'A',
                'section_code' => sprintf('%02dA', $i),
                'status' => 'active',
            ]);
            $this->sections[] = $section;

            $teacher = $this->teachers[($i - 1) % count($this->teachers)];
            $subject = $this->subjects[($i - 1) % count($this->subjects)];

            TeachingAssignment::query()->create([
                'tenant_id' => $this->alNoor->id,
                'school_id' => $this->school->id,
                'teacher_user_id' => $teacher->id,
                'subject_id' => $subject->id,
                'class_section_id' => $section->id,
                'academic_year_id' => $this->year->id,
                'status' => 'active',
            ]);
        }

        foreach ($this->students as $i => $student) {
            $section = $this->sections[$i % count($this->sections)];
            Enrollment::query()->create([
                'tenant_id' => $this->alNoor->id,
                'school_id' => $this->school->id,
                'academic_year_id' => $this->year->id,
                'class_section_id' => $section->id,
                'student_user_id' => $student->id,
                'grade_id' => $section->grade_id,
                'status' => 'active',
                'enrolled_on' => now()->subMonths(2)->toDateString(),
            ]);
        }
    }

    private function seedLearning(): void
    {
        $courses = [];
        foreach ($this->subjects as $i => $subject) {
            $course = SchoolCourse::query()->create([
                'tenant_id' => $this->alNoor->id,
                'school_id' => $this->school->id,
                'code' => "CRS-{$subject->code}",
                'title_en' => "{$subject->name_en} Course",
                'title_ar' => "مقرر {$subject->name_ar}",
                'subject_id' => $subject->id,
                'description' => "Full-year {$subject->name_en} pathway",
                'status' => 'active',
            ]);
            $courses[] = $course;

            for ($l = 1; $l <= 2; $l++) {
                SchoolLesson::query()->create([
                    'tenant_id' => $this->alNoor->id,
                    'school_id' => $this->school->id,
                    'course_id' => $course->id,
                    'title_en' => "{$subject->name_en} Unit {$l}",
                    'title_ar' => "{$subject->name_ar} الوحدة {$l}",
                    'sort_order' => $l,
                    'duration_minutes' => 45,
                    'status' => 'published',
                ]);
            }
        }

        $curriculumLessons = CurriculumLesson::query()->orderBy('id')->take(24)->get();
        $interactive = [];
        foreach ($curriculumLessons as $i => $lesson) {
            $il = InteractiveLesson::query()->create([
                'tenant_id' => $this->alNoor->id,
                'school_id' => $this->school->id,
                'curriculum_lesson_id' => $lesson->id,
                'title_en' => $lesson->title_en.' (Interactive)',
                'title_ar' => $lesson->title_ar.' (تفاعلي)',
                'status' => 'published',
                'completion_rule' => 'view_all',
                'published_at' => now()->subDays(10 + $i),
            ]);
            $interactive[] = $il;
        }

        foreach ($this->students as $si => $student) {
            foreach (array_slice($interactive, 0, 12) as $ii => $il) {
                LearningProgress::query()->create([
                    'tenant_id' => $this->alNoor->id,
                    'school_id' => $this->school->id,
                    'student_user_id' => $student->id,
                    'interactive_lesson_id' => $il->id,
                    'status' => ($si + $ii) % 3 === 0 ? 'completed' : 'in_progress',
                    'progress_percent' => ($si + $ii) % 3 === 0 ? 100 : 35 + (($si + $ii) % 50),
                    'score' => ($si + $ii) % 3 === 0 ? 85 + ($ii % 10) : null,
                    'started_at' => now()->subDays(20 - $ii),
                    'completed_at' => ($si + $ii) % 3 === 0 ? now()->subDays(5) : null,
                    'last_position_json' => ['block' => $ii + 1],
                ]);
            }
        }
    }

    private function seedHomework(): void
    {
        $assignments = [];
        for ($i = 1; $i <= 14; $i++) {
            $subject = $this->subjects[($i - 1) % count($this->subjects)];
            $section = $this->sections[($i - 1) % count($this->sections)];
            $assignments[] = HomeworkAssignment::query()->create([
                'tenant_id' => $this->alNoor->id,
                'school_id' => $this->school->id,
                'subject_id' => $subject->id,
                'class_section_id' => $section->id,
                'title_en' => "Homework {$i}: {$subject->name_en}",
                'title_ar' => "واجب {$i}: {$subject->name_ar}",
                'instructions_en' => "Complete practice set {$i} and upload your work.",
                'instructions_ar' => "أكمل مجموعة التمارين {$i} وارفع عملك.",
                'due_at' => now()->addDays($i),
                'allow_late' => $i % 2 === 0,
                'is_scored' => true,
                'max_score' => 100,
                'include_in_reports' => true,
                'status' => 'published',
                'assignment_kind' => 'homework',
                'created_by' => $this->users['teacher']->id,
            ]);
        }

        foreach ($assignments as $ai => $assignment) {
            foreach (array_slice($this->students, 0, 10) as $si => $student) {
                AssignmentSubmission::query()->create([
                    'assignment_id' => $assignment->id,
                    'student_user_id' => $student->id,
                    'tenant_id' => $this->alNoor->id,
                    'body_text' => "Submission from {$student->first_name} for {$assignment->title_en}",
                    'submitted_at' => now()->subDays(max(1, 10 - $si)),
                    'is_late' => false,
                    'score' => 70 + (($ai + $si) % 30),
                    'feedback' => 'Good effort — keep practicing.',
                    'status' => 'graded',
                ]);
            }
        }
    }

    private function seedAssessments(): void
    {
        $questions = [];
        for ($i = 1; $i <= 16; $i++) {
            $subject = $this->subjects[($i - 1) % count($this->subjects)];
            $q = Question::query()->create([
                'tenant_id' => $this->alNoor->id,
                'school_id' => $this->school->id,
                'subject_id' => $subject->id,
                'type' => 'mcq',
                'difficulty' => ['easy', 'medium', 'hard'][$i % 3],
                'default_points' => 5,
                'status' => 'active',
            ]);
            QuestionTranslation::query()->create([
                'question_id' => $q->id,
                'locale' => 'en',
                'stem' => "Sample {$subject->name_en} question #{$i}",
                'explanation' => 'Review the related lesson notes.',
            ]);
            QuestionTranslation::query()->create([
                'question_id' => $q->id,
                'locale' => 'ar',
                'stem' => "سؤال تجريبي في {$subject->name_ar} رقم {$i}",
                'explanation' => 'راجع ملاحظات الدرس.',
            ]);
            foreach (['A', 'B', 'C', 'D'] as $oi => $label) {
                QuestionOption::query()->create([
                    'question_id' => $q->id,
                    'locale' => 'en',
                    'label' => "Option {$label}",
                    'is_correct' => $oi === 0,
                    'sequence' => $oi + 1,
                ]);
            }
            $questions[] = $q;
        }

        $assessments = [];
        for ($i = 1; $i <= 12; $i++) {
            $subject = $this->subjects[($i - 1) % count($this->subjects)];
            $section = $this->sections[($i - 1) % count($this->sections)];
            $assessment = Assessment::query()->create([
                'tenant_id' => $this->alNoor->id,
                'school_id' => $this->school->id,
                'subject_id' => $subject->id,
                'term_id' => $this->term->id,
                'class_section_id' => $section->id,
                'type' => $i % 2 === 0 ? 'quiz' : 'exam',
                'title_en' => "Assessment {$i}: {$subject->name_en}",
                'title_ar' => "تقييم {$i}: {$subject->name_ar}",
                'instructions_en' => 'Answer all questions. Calculators allowed where noted.',
                'instructions_ar' => 'أجب عن جميع الأسئلة.',
                'time_limit_seconds' => 1800,
                'max_attempts' => 2,
                'available_from' => now()->subDays(7),
                'available_until' => now()->addDays(21),
                'shuffle_questions' => false,
                'show_results' => 'after_submit',
                'counts_toward_grade' => true,
                'status' => 'published',
                'created_by' => $this->users['teacher']->id,
            ]);

            foreach (array_slice($questions, 0, 5) as $qi => $question) {
                AssessmentQuestion::query()->create([
                    'assessment_id' => $assessment->id,
                    'question_id' => $question->id,
                    'sequence' => $qi + 1,
                    'points' => 5,
                ]);
            }
            $assessments[] = $assessment;
        }

        foreach ($assessments as $ai => $assessment) {
            foreach (array_slice($this->students, 0, 10) as $si => $student) {
                AssessmentAttempt::query()->create([
                    'tenant_id' => $this->alNoor->id,
                    'assessment_id' => $assessment->id,
                    'student_user_id' => $student->id,
                    'attempt_no' => 1,
                    'locale' => 'en',
                    'status' => 'graded',
                    'score' => 15 + (($ai + $si) % 10),
                    'max_score' => 25,
                    'started_at' => now()->subDays(3),
                    'submitted_at' => now()->subDays(2),
                    'graded_at' => now()->subDay(),
                ]);
            }
        }
    }

    private function seedTutoring(): void
    {
        foreach ($this->tutors as $i => $tutor) {
            $profile = TutorProfile::query()->create([
                'tenant_id' => $this->alNoor->id,
                'user_id' => $tutor->id,
                'school_id' => $this->school->id,
                'bio_en' => "Experienced STEM tutor specializing in track ".($i + 1),
                'bio_ar' => 'معلم خصوصي متمرس في العلوم والتقنية',
                'hourly_rate' => 120 + ($i * 10),
                'status' => 'active',
            ]);
            $this->tutorProfiles[] = $profile;

            $subject = $this->subjects[$i % count($this->subjects)];
            DB::table('tutor_subjects')->insert([
                'tutor_profile_id' => $profile->id,
                'subject_id' => $subject->id,
                'languages_json' => json_encode(['en', 'ar']),
            ]);

            TutorAvailability::query()->create([
                'tenant_id' => $this->alNoor->id,
                'tutor_profile_id' => $profile->id,
                'campus_id' => $this->campus->id,
                'weekday' => ($i % 5) + 1,
                'start_time' => '16:00:00',
                'end_time' => '20:00:00',
                'slot_minutes' => 60,
                'timezone' => 'Asia/Riyadh',
                'is_active' => true,
            ]);
        }

        if (Schema::hasTable('tutoring_packages')) {
            for ($i = 1; $i <= 12; $i++) {
                DB::table('tutoring_packages')->insert([
                    'tenant_id' => $this->alNoor->id,
                    'school_id' => $this->school->id,
                    'name_en' => "Tutoring Pack {$i}",
                    'name_ar' => "باقة التدريس {$i}",
                    'total_minutes' => 300 + ($i * 60),
                    'status' => 'active',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        $sessions = [];
        for ($i = 1; $i <= 14; $i++) {
            $profile = $this->tutorProfiles[($i - 1) % count($this->tutorProfiles)];
            $subject = $this->subjects[($i - 1) % count($this->subjects)];
            $status = match ($i % 5) {
                0 => 'completed',
                1 => 'confirmed',
                2 => 'scheduled',
                3 => 'booked',
                default => 'completed',
            };
            $starts = now()->addDays($i - 7)->setTime(17, 0);
            $session = TutoringSession::query()->create([
                'tenant_id' => $this->alNoor->id,
                'school_id' => $this->school->id,
                'campus_id' => $this->campus->id,
                'tutor_profile_id' => $profile->id,
                'subject_id' => $subject->id,
                'language' => $i % 2 === 0 ? 'ar' : 'en',
                'session_type' => $i % 3 === 0 ? 'small_group' : 'one_to_one',
                'starts_at' => $starts,
                'ends_at' => (clone $starts)->addHour(),
                'status' => $status,
                'meeting_provider' => 'internal',
                'meeting_url' => 'http://localhost/classroom/demo-'.Str::slug("session-{$i}"),
                'meeting_external_id' => "demo-session-{$i}",
                'minutes_consumed' => $status === 'completed' ? 60 : 0,
                'booked_by' => $this->users['parent']->id,
                'created_by' => $this->users['tutor']->id,
            ]);
            $sessions[] = $session;

            $student = $this->students[($i - 1) % count($this->students)];
            DB::table('tutoring_session_participants')->insert([
                'tutoring_session_id' => $session->id,
                'student_user_id' => $student->id,
                'role' => 'learner',
            ]);

            if ($status === 'completed') {
                TutoringAttendance::query()->create([
                    'tenant_id' => $this->alNoor->id,
                    'tutoring_session_id' => $session->id,
                    'student_user_id' => $student->id,
                    'status' => 'present',
                    'marked_by' => $profile->user_id,
                    'marked_at' => $starts->copy()->addMinutes(5),
                    'notes' => 'On time and engaged',
                ]);

                SessionNote::query()->create([
                    'tutoring_session_id' => $session->id,
                    'tutor_profile_id' => $profile->id,
                    'notes' => "Covered {$subject->name_en} practice problems. Next: review worksheet.",
                    'follow_up' => 'Complete worksheet before next session',
                    'visible_to_parent' => true,
                    'created_by' => $profile->user_id,
                ]);

                TutoringSessionRating::query()->create([
                    'tenant_id' => $this->alNoor->id,
                    'tutoring_session_id' => $session->id,
                    'student_user_id' => $student->id,
                    'tutor_profile_id' => $profile->id,
                    'rating' => 4 + ($i % 2),
                    'feedback' => 'Clear explanations and helpful examples.',
                    'feedback_ar' => 'شرح واضح وأمثلة مفيدة.',
                ]);
            }
        }
    }

    private function seedBilling(): void
    {
        for ($i = 1; $i <= 12; $i++) {
            $invoice = Invoice::query()->create([
                'tenant_id' => $this->alNoor->id,
                'number' => sprintf('INV-AN-%04d', $i),
                'currency' => 'SAR',
                'subtotal' => 1000 + ($i * 50),
                'tax_total' => 150 + ($i * 7.5),
                'total' => 1150 + ($i * 57.5),
                'status' => $i <= 10 ? 'paid' : 'sent',
                'issued_at' => now()->subDays(40 - $i),
                'due_at' => now()->subDays(10 - $i),
                'paid_at' => $i <= 10 ? now()->subDays(8) : null,
                'notes' => 'Subscription / services invoice',
            ]);

            InvoiceItem::query()->create([
                'invoice_id' => $invoice->id,
                'description' => "Platform subscription period {$i}",
                'quantity' => 1,
                'unit_price' => 1000 + ($i * 50),
                'line_total' => 1000 + ($i * 50),
            ]);

            Payment::query()->create([
                'tenant_id' => $this->alNoor->id,
                'invoice_id' => $invoice->id,
                'amount' => $i <= 10 ? $invoice->total : round($invoice->total * 0.5, 2),
                'currency' => 'SAR',
                'method' => ['card', 'bank', 'manual'][$i % 3],
                'reference' => "PAY-AN-{$i}",
                'paid_at' => now()->subDays(max(1, 12 - $i)),
            ]);
        }

        foreach (array_slice($this->students, 0, 12) as $i => $student) {
            $subtotal = 500 + ($i * 25);
            $tax = round($subtotal * 0.15, 2);
            $invoice = StudentInvoice::query()->create([
                'tenant_id' => $this->alNoor->id,
                'school_id' => $this->school->id,
                'student_user_id' => $student->id,
                'number' => sprintf('SINV-%04d', $i + 1),
                'currency' => 'SAR',
                'subtotal' => $subtotal,
                'tax_total' => $tax,
                'total' => $subtotal + $tax,
                'status' => $i < 8 ? 'paid' : 'sent',
                'issued_at' => now()->subDays(20 - $i),
                'due_at' => now()->addDays($i),
                'paid_at' => $i < 8 ? now()->subDays(5) : null,
                'notes' => 'Tuition / tutoring fees',
            ]);

            if (class_exists(StudentInvoiceItem::class)) {
                StudentInvoiceItem::query()->create([
                    'student_invoice_id' => $invoice->id,
                    'description' => 'Monthly learning package',
                    'quantity' => 1,
                    'unit_price' => $subtotal,
                    'line_total' => $subtotal,
                ]);
            }
        }
    }

    private function seedCertificates(): void
    {
        foreach (array_slice($this->students, 0, 12) as $i => $student) {
            Certificate::query()->create([
                'tenant_id' => $this->alNoor->id,
                'school_id' => $this->school->id,
                'student_user_id' => $student->id,
                'title_en' => 'STEM Excellence Certificate',
                'title_ar' => 'شهادة التميز في العلوم والتقنية',
                'issued_at' => now()->subDays(30 - $i),
                'verification_code' => strtoupper(Str::random(10)),
                'snapshot_json' => [
                    'student' => $student->first_name.' '.$student->last_name,
                    'school' => $this->school->name_en,
                ],
            ]);
        }

        if (Schema::hasTable('achievements')) {
            for ($i = 1; $i <= 12; $i++) {
                DB::table('achievements')->insert([
                    'tenant_id' => $this->alNoor->id,
                    'code' => sprintf('ACH-%02d', $i),
                    'name_en' => "Achievement {$i}",
                    'name_ar' => "إنجاز {$i}",
                    'description_en' => "Unlocked for milestone {$i}",
                    'description_ar' => "تم فتحه عند الوصول إلى المعلم {$i}",
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    private function seedCommunications(): void
    {
        for ($i = 1; $i <= 12; $i++) {
            SchoolNotification::query()->create([
                'tenant_id' => $this->alNoor->id,
                'school_id' => $this->school->id,
                'title' => "School notice #{$i}",
                'body' => "Important update {$i} for families and students about upcoming STEM activities.",
                'channel' => ['in_app', 'email', 'sms'][$i % 3],
                'audience' => ['all', 'students', 'parents'][$i % 3],
                'status' => 'sent',
                'sent_at' => now()->subDays($i),
                'created_by' => $this->users['school_admin']->id,
            ]);
        }

        foreach (array_merge(
            array_slice($this->students, 0, 8),
            array_slice($this->parents, 0, 4),
        ) as $i => $user) {
            LearnerMessage::query()->create([
                'tenant_id' => $this->alNoor->id,
                'school_id' => $this->school->id,
                'user_id' => $user->id,
                'direction' => $i % 2 === 0 ? 'inbound' : 'outbound',
                'subject' => "Message subject ".($i + 1),
                'body' => 'Hello — this is a demo message about learning progress and upcoming sessions.',
                'read_at' => $i % 3 === 0 ? now() : null,
            ]);
        }

        foreach (array_slice($this->students, 0, 12) as $i => $student) {
            DB::table('notifications')->insert([
                'id' => (string) Str::uuid(),
                'tenant_id' => $this->alNoor->id,
                'type' => 'App\\Notifications\\GenericDemoNotification',
                'notifiable_type' => User::class,
                'notifiable_id' => $student->id,
                'data' => json_encode([
                    'title' => "Learning reminder {$i}",
                    'body' => 'You have upcoming homework and tutoring sessions.',
                ]),
                'read_at' => $i % 2 === 0 ? now() : null,
                'created_at' => now()->subDays($i),
                'updated_at' => now()->subDays($i),
            ]);
        }
    }

    private function seedCalendar(): void
    {
        $types = ['holiday', 'exam', 'meeting', 'activity', 'deadline'];
        for ($i = 1; $i <= 12; $i++) {
            CalendarEvent::query()->create([
                'tenant_id' => $this->alNoor->id,
                'school_id' => $this->school->id,
                'campus_id' => $this->campus->id,
                'academic_year_id' => $this->year->id,
                'term_id' => $this->term->id,
                'title_en' => "Calendar event {$i}",
                'title_ar' => "حدث تقويمي {$i}",
                'event_type' => $types[($i - 1) % count($types)],
                'starts_on' => now()->addDays($i)->toDateString(),
                'ends_on' => now()->addDays($i)->toDateString(),
                'is_all_day' => true,
                'description_en' => "School calendar item {$i}",
                'description_ar' => "عنصر تقويم مدرسي {$i}",
                'status' => 'published',
            ]);
        }
    }

    private function seedMisc(): void
    {
        if (Schema::hasTable('platform_settings')) {
            $settings = [
                ['global', 'support_email', 'support@stemora.test'],
                ['global', 'default_currency', 'SAR'],
                ['branding', 'product_name', 'Stemora'],
                ['localization', 'default_locale', 'en'],
                ['security', 'session_timeout_minutes', 120],
                ['backup', 'retention_days', 30],
                ['global', 'maintenance_mode', false],
                ['branding', 'tagline', 'STEM learning for every campus'],
                ['localization', 'supported_locales', ['en', 'ar']],
                ['security', 'mfa_required_for_admins', false],
                ['global', 'timezone', 'Asia/Riyadh'],
                ['branding', 'primary_color', '#0B6E4F'],
            ];
            foreach ($settings as [$group, $key, $value]) {
                DB::table('platform_settings')->insert([
                    'group_key' => $group,
                    'setting_key' => $key,
                    'value_json' => json_encode($value),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        if (Schema::hasTable('audit_logs')) {
            for ($i = 1; $i <= 12; $i++) {
                DB::table('audit_logs')->insert([
                    'tenant_id' => $this->alNoor->id,
                    'actor_user_id' => $this->users['school_admin']->id,
                    'action' => 'demo.seed',
                    'auditable_type' => School::class,
                    'auditable_id' => $this->school->id,
                    'properties' => json_encode(['note' => "Seed audit entry {$i}"]),
                    'ip_address' => '127.0.0.1',
                    'user_agent' => 'DemoDataSeeder',
                    'created_at' => now()->subMinutes($i),
                ]);
            }
        }
    }

    private function makeUser(
        string $email,
        string $first,
        string $last,
        string $password,
        ?int $tenantId,
    ): User {
        return User::query()->create([
            'tenant_id' => $tenantId,
            'email' => $email,
            'password' => $password,
            'first_name' => $first,
            'last_name' => $last,
            'first_name_ar' => $first,
            'last_name_ar' => $last,
            'phone' => '+9665'.str_pad((string) random_int(10000000, 99999999), 8, '0', STR_PAD_LEFT),
            'locale' => 'en',
            'timezone' => 'Asia/Riyadh',
            'status' => 'active',
            'email_verified_at' => now(),
        ]);
    }

    private function attachRole(
        User $user,
        string $roleCode,
        Tenant $tenant,
        ?int $schoolId = null,
        ?int $campusId = null,
    ): void {
        UserTenantRole::query()->create([
            'user_id' => $user->id,
            'tenant_id' => $tenant->id,
            'role_id' => $this->roles[$roleCode]->id,
            'school_id' => $schoolId,
            'campus_id' => $campusId,
        ]);
    }

    private function printCredentials(): void
    {
        $rows = [
            ['super_admin', 'superadmin@learning-platform.local', self::PASSWORD_SUPER, 'platform'],
            ['customer_support', 'support@platform.test', self::PASSWORD_DEFAULT, 'platform'],
            ['auditor', 'auditor@platform.test', self::PASSWORD_DEFAULT, 'platform'],
            ['school_owner', 'owner@alnoor.test', self::PASSWORD_OWNER, 'al-noor'],
            ['school_admin', 'admin@alnoor.test', self::PASSWORD_DEFAULT, 'al-noor'],
            ['campus_admin', 'campus@alnoor.test', self::PASSWORD_DEFAULT, 'al-noor'],
            ['principal', 'principal@alnoor.test', self::PASSWORD_DEFAULT, 'al-noor'],
            ['academic_coordinator', 'coordinator@alnoor.test', self::PASSWORD_DEFAULT, 'al-noor'],
            ['finance_manager', 'finance@alnoor.test', self::PASSWORD_DEFAULT, 'al-noor'],
            ['teacher', 'teacher@alnoor.test', self::PASSWORD_DEFAULT, 'al-noor'],
            ['tutor', 'tutor@alnoor.test', self::PASSWORD_DEFAULT, 'al-noor'],
            ['student', 'student@alnoor.test', self::PASSWORD_DEFAULT, 'al-noor'],
            ['parent', 'parent@alnoor.test', self::PASSWORD_DEFAULT, 'al-noor'],
        ];

        $this->command?->newLine();
        $this->command?->table(['Role', 'Email', 'Password', 'Tenant'], $rows);
        $this->command?->info('Additional numbered users share Password!123 (teacher2…, student2…, tutor2…, parent2…).');
    }
}
