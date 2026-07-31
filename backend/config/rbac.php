<?php

/**
 * Phase 7 — Canonical RBAC permission definitions and role matrix.
 * Seeded by RbacSeeder. Do not hard-code matrices elsewhere.
 *
 * Nav permissions (group `nav`) gate portal menus. Section codes match
 * top-level menu ids in @stemora/nav. Children inherit the parent section.
 */
return [

    'hierarchy' => [
        'super_admin' => ['level' => 100, 'portal' => 'control', 'parent' => null],
        'customer_support' => ['level' => 85, 'portal' => 'control', 'parent' => 'super_admin'],
        'auditor' => ['level' => 80, 'portal' => 'control', 'parent' => 'super_admin'],
        'school_owner' => ['level' => 90, 'portal' => 'control', 'parent' => null],
        'school_admin' => ['level' => 80, 'portal' => 'institution', 'parent' => 'school_owner'],
        'campus_admin' => ['level' => 72, 'portal' => 'institution', 'parent' => 'school_admin'],
        'principal' => ['level' => 78, 'portal' => 'institution', 'parent' => 'school_owner'],
        'academic_coordinator' => ['level' => 70, 'portal' => 'institution', 'parent' => 'principal'],
        'finance_manager' => ['level' => 65, 'portal' => 'institution', 'parent' => 'school_owner'],
        'teacher' => ['level' => 50, 'portal' => 'institution', 'parent' => 'academic_coordinator'],
        'tutor' => ['level' => 50, 'portal' => 'institution', 'parent' => 'academic_coordinator'],
        'parent' => ['level' => 20, 'portal' => 'learner', 'parent' => null],
        'student' => ['level' => 10, 'portal' => 'learner', 'parent' => null],
    ],

    'roles' => [
        'super_admin' => [
            'name_en' => 'Super Admin',
            'name_ar' => 'المشرف العام',
            'description_en' => 'Platform operator with full SaaS control',
            'description_ar' => 'مشغل المنصة بصلاحيات كاملة',
        ],
        'school_owner' => [
            'name_en' => 'School Owner',
            'name_ar' => 'مالك المدرسة',
            'description_en' => 'Tenant owner; manages schools, billing, branding',
            'description_ar' => 'مالك المستأجر؛ يدير المدارس والفوترة والعلامة',
        ],
        'school_admin' => [
            'name_en' => 'School Administrator',
            'name_ar' => 'مدير المدرسة',
            'description_en' => 'Operational school administration',
            'description_ar' => 'إدارة تشغيلية للمدرسة',
        ],
        'campus_admin' => [
            'name_en' => 'Campus Administrator',
            'name_ar' => 'مدير الحرم',
            'description_en' => 'Campus-scoped operations',
            'description_ar' => 'عمليات على مستوى الحرم',
        ],
        'principal' => [
            'name_en' => 'Principal',
            'name_ar' => 'مدير عام / ناظر',
            'description_en' => 'Academic leadership and school oversight',
            'description_ar' => 'قيادة أكاديمية وإشراف مدرسي',
        ],
        'academic_coordinator' => [
            'name_en' => 'Academic Coordinator',
            'name_ar' => 'منسق أكاديمي',
            'description_en' => 'Curriculum, pathways, and assessment policies',
            'description_ar' => 'المناهج والمسارات وسياسات التقييم',
        ],
        'teacher' => [
            'name_en' => 'Teacher',
            'name_ar' => 'معلم',
            'description_en' => 'Class instruction, assignments, grading',
            'description_ar' => 'التدريس والواجبات والتصحيح',
        ],
        'tutor' => [
            'name_en' => 'Tutor',
            'name_ar' => 'مدرس خصوصي',
            'description_en' => 'Live tutoring sessions and availability',
            'description_ar' => 'جلسات التدريس المباشر والتوفر',
        ],
        'student' => [
            'name_en' => 'Student',
            'name_ar' => 'طالب',
            'description_en' => 'Learning, assessments, tutoring attendance',
            'description_ar' => 'التعلم والتقييم وحضور التدريس',
        ],
        'parent' => [
            'name_en' => 'Parent',
            'name_ar' => 'ولي أمر',
            'description_en' => 'Child progress, homework, tutoring booking',
            'description_ar' => 'تقدم الأبناء والواجبات وحجز التدريس',
        ],
        'finance_manager' => [
            'name_en' => 'Finance Manager',
            'name_ar' => 'مدير مالي',
            'description_en' => 'Invoices, payments, subscription views',
            'description_ar' => 'الفواتير والمدفوعات والاشتراكات',
        ],
        'customer_support' => [
            'name_en' => 'Customer Support',
            'name_ar' => 'دعم العملاء',
            'description_en' => 'Platform support with audited limited access',
            'description_ar' => 'دعم المنصة بصلاحيات محدودة ومسجلة',
        ],
        'auditor' => [
            'name_en' => 'Auditor',
            'name_ar' => 'مدقق',
            'description_en' => 'Read-only audit and compliance reporting',
            'description_ar' => 'تقارير التدقيق والامتثال للقراءة فقط',
        ],
    ],

    'permissions' => array_merge(
        [
            // Platform / SaaS
            ['code' => 'platform.tenants.manage', 'group' => 'platform', 'name_en' => 'Manage tenants', 'name_ar' => 'إدارة المستأجرين'],
            ['code' => 'platform.plans.manage', 'group' => 'platform', 'name_en' => 'Manage subscription plans', 'name_ar' => 'إدارة خطط الاشتراك'],
            ['code' => 'platform.support.access', 'group' => 'platform', 'name_en' => 'Access support tools', 'name_ar' => 'الوصول لأدوات الدعم'],
            ['code' => 'platform.audit.view', 'group' => 'platform', 'name_en' => 'View platform audit logs', 'name_ar' => 'عرض سجلات تدقيق المنصة'],
            ['code' => 'platform.impersonate', 'group' => 'platform', 'name_en' => 'Impersonate users (audited)', 'name_ar' => 'انتحال هوية المستخدمين'],
            ['code' => 'platform.rbac.manage', 'group' => 'platform', 'name_en' => 'Manage roles & permissions', 'name_ar' => 'إدارة الأدوار والصلاحيات'],

            // Tenant / org
            ['code' => 'tenant.settings.manage', 'group' => 'tenant', 'name_en' => 'Manage tenant settings', 'name_ar' => 'إدارة إعدادات المستأجر'],
            ['code' => 'tenant.branding.manage', 'group' => 'tenant', 'name_en' => 'Manage branding', 'name_ar' => 'إدارة الهوية البصرية'],
            ['code' => 'tenant.billing.manage', 'group' => 'tenant', 'name_en' => 'Manage billing & subscription', 'name_ar' => 'إدارة الفوترة والاشتراك'],
            ['code' => 'tenant.billing.view', 'group' => 'tenant', 'name_en' => 'View billing', 'name_ar' => 'عرض الفوترة'],
            ['code' => 'tenant.schools.manage', 'group' => 'tenant', 'name_en' => 'Manage schools', 'name_ar' => 'إدارة المدارس'],

            // School ops
            ['code' => 'school.settings.manage', 'group' => 'school', 'name_en' => 'Manage school settings', 'name_ar' => 'إدارة إعدادات المدرسة'],
            ['code' => 'school.campuses.manage', 'group' => 'school', 'name_en' => 'Manage campuses', 'name_ar' => 'إدارة الفروع'],
            ['code' => 'school.users.manage', 'group' => 'school', 'name_en' => 'Manage school users', 'name_ar' => 'إدارة مستخدمي المدرسة'],
            ['code' => 'school.users.view', 'group' => 'school', 'name_en' => 'View school users', 'name_ar' => 'عرض مستخدمي المدرسة'],
            ['code' => 'school.academics.manage', 'group' => 'school', 'name_en' => 'Manage academic structure', 'name_ar' => 'إدارة الهيكل الأكاديمي'],
            ['code' => 'school.reports.view', 'group' => 'school', 'name_en' => 'View school reports', 'name_ar' => 'عرض تقارير المدرسة'],

            // Curriculum & learning
            ['code' => 'curriculum.manage', 'group' => 'curriculum', 'name_en' => 'Manage curriculum', 'name_ar' => 'إدارة المنهج'],
            ['code' => 'curriculum.view', 'group' => 'curriculum', 'name_en' => 'View curriculum', 'name_ar' => 'عرض المنهج'],
            ['code' => 'learning.content.manage', 'group' => 'learning', 'name_en' => 'Manage learning content', 'name_ar' => 'إدارة محتوى التعلم'],
            ['code' => 'learning.content.assign', 'group' => 'learning', 'name_en' => 'Assign learning content', 'name_ar' => 'تعيين محتوى التعلم'],
            ['code' => 'learning.content.consume', 'group' => 'learning', 'name_en' => 'Consume learning content', 'name_ar' => 'استهلاك محتوى التعلم'],

            // Assessment
            ['code' => 'assessments.manage', 'group' => 'assessment', 'name_en' => 'Manage assessments', 'name_ar' => 'إدارة التقييمات'],
            ['code' => 'assessments.grade', 'group' => 'assessment', 'name_en' => 'Grade assessments', 'name_ar' => 'تصحيح التقييمات'],
            ['code' => 'assessments.attempt', 'group' => 'assessment', 'name_en' => 'Attempt assessments', 'name_ar' => 'أداء التقييمات'],
            ['code' => 'assessments.results.view_own', 'group' => 'assessment', 'name_en' => 'View own results', 'name_ar' => 'عرض النتائج الخاصة'],
            ['code' => 'assessments.results.view_class', 'group' => 'assessment', 'name_en' => 'View class results', 'name_ar' => 'عرض نتائج الصف'],
            ['code' => 'assessments.results.view_child', 'group' => 'assessment', 'name_en' => 'View child results', 'name_ar' => 'عرض نتائج الابن'],

            // Tutoring
            ['code' => 'tutoring.manage', 'group' => 'tutoring', 'name_en' => 'Manage tutoring operations', 'name_ar' => 'إدارة عمليات التدريس'],
            ['code' => 'tutoring.availability.manage', 'group' => 'tutoring', 'name_en' => 'Manage tutor availability', 'name_ar' => 'إدارة توفر المدرس'],
            ['code' => 'tutoring.conduct', 'group' => 'tutoring', 'name_en' => 'Conduct tutoring sessions', 'name_ar' => 'إجراء جلسات التدريس'],
            ['code' => 'tutoring.book', 'group' => 'tutoring', 'name_en' => 'Book tutoring sessions', 'name_ar' => 'حجز جلسات التدريس'],
            ['code' => 'tutoring.join', 'group' => 'tutoring', 'name_en' => 'Join tutoring sessions', 'name_ar' => 'الانضمام لجلسات التدريس'],
            ['code' => 'tutoring.attendance.manage', 'group' => 'tutoring', 'name_en' => 'Manage tutoring attendance', 'name_ar' => 'إدارة حضور التدريس'],
            ['code' => 'tutoring.attendance.view_child', 'group' => 'tutoring', 'name_en' => 'View child tutoring attendance', 'name_ar' => 'عرض حضور الابن'],

            // Parent / student progress
            ['code' => 'progress.view_own', 'group' => 'progress', 'name_en' => 'View own progress', 'name_ar' => 'عرض التقدم الخاص'],
            ['code' => 'progress.view_class', 'group' => 'progress', 'name_en' => 'View class progress', 'name_ar' => 'عرض تقدم الصف'],
            ['code' => 'progress.view_child', 'group' => 'progress', 'name_en' => 'View child progress', 'name_ar' => 'عرض تقدم الابن'],
            ['code' => 'homework.view_child', 'group' => 'progress', 'name_en' => 'View child homework', 'name_ar' => 'عرض واجبات الابن'],

            // Reports / audit
            ['code' => 'reports.academic.view', 'group' => 'reports', 'name_en' => 'View academic reports', 'name_ar' => 'عرض التقارير الأكاديمية'],
            ['code' => 'reports.tutor.view', 'group' => 'reports', 'name_en' => 'View tutor reports', 'name_ar' => 'عرض تقارير المدرسين'],
            ['code' => 'reports.finance.view', 'group' => 'reports', 'name_en' => 'View finance reports', 'name_ar' => 'عرض التقارير المالية'],
            ['code' => 'reports.export', 'group' => 'reports', 'name_en' => 'Export reports', 'name_ar' => 'تصدير التقارير'],
            ['code' => 'audit.logs.view', 'group' => 'audit', 'name_en' => 'View audit logs', 'name_ar' => 'عرض سجلات التدقيق'],

            // Account
            ['code' => 'nav.account.password', 'group' => 'nav', 'name_en' => 'Change password menu', 'name_ar' => 'تغيير كلمة المرور'],
        ],
        // Control top-level menus
        array_map(fn ($id) => [
            'code' => "nav.control.$id",
            'group' => 'nav',
            'name_en' => 'Control menu: '.str_replace('-', ' ', $id),
            'name_ar' => "قائمة التحكم: $id",
        ], [
            'dashboard', 'tenant-management', 'curriculum-management', 'user-management', 'billing', 'integrations',
            'reports', 'audit', 'settings', 'school-management', 'curriculum', 'student-management', 'parent-management',
            'teacher-management', 'staff-management', 'learning-management', 'assessments', 'tutoring', 'finance',
            'notifications', 'audit-logs', 'schools', 'support-tickets', 'live-chat', 'knowledge-base', 'activity-logs',
            'login-logs', 'fee-audit', 'academic-audit', 'security-reports', 'platform-users', 'rbac',
        ]),
        // Institution top-level menus
        array_map(fn ($id) => [
            'code' => "nav.institution.$id",
            'group' => 'nav',
            'name_en' => 'Institution menu: '.str_replace('-', ' ', $id),
            'name_ar' => "قائمة المؤسسة: $id",
        ], [
            'dashboard', 'students', 'parents', 'teachers', 'classes', 'timetable', 'attendance', 'assignments', 'exams',
            'reports', 'school-performance', 'assessments', 'academic-reports', 'notifications', 'curriculum', 'subjects',
            'lesson-planning', 'homework', 'academic-calendar', 'my-classes', 'lesson-plans', 'course-content', 'quizzes',
            'student-progress', 'grade-book', 'resources', 'messages', 'profile', 'my-students', 'session-schedule',
            'availability', 'live-sessions', 'session-notes', 'earnings', 'student-fees', 'tutor-payments', 'expenses',
            'refunds', 'invoices', 'financial-reports', 'tutor-performance',
        ]),
        // Learner top-level menus
        array_map(fn ($id) => [
            'code' => "nav.learner.$id",
            'group' => 'nav',
            'name_en' => 'Learner menu: '.str_replace('-', ' ', $id),
            'name_ar' => "قائمة المتعلم: $id",
        ], [
            'dashboard', 'my-courses', 'subjects', 'lessons', 'stem-activities', 'virtual-labs', 'homework', 'assignments',
            'quizzes', 'exams', 'results', 'certificates', 'tutor-sessions', 'messages', 'notifications', 'profile',
            'my-children', 'attendance', 'progress-reports', 'school-notices', 'fee-payments',
        ]),
    ),

    'matrix' => [
        'super_admin' => ['*'],

        'school_owner' => array_merge([
            'tenant.settings.manage', 'tenant.branding.manage', 'tenant.billing.manage', 'tenant.billing.view',
            'tenant.schools.manage', 'school.settings.manage', 'school.campuses.manage', 'school.users.manage',
            'school.users.view', 'school.academics.manage', 'school.reports.view', 'curriculum.manage', 'curriculum.view',
            'learning.content.manage', 'learning.content.assign', 'assessments.manage', 'assessments.grade',
            'assessments.results.view_class', 'tutoring.manage', 'tutoring.attendance.manage', 'progress.view_class',
            'reports.academic.view', 'reports.tutor.view', 'reports.finance.view', 'reports.export', 'audit.logs.view',
            'nav.account.password',
        ], array_map(fn ($id) => "nav.control.$id", [
            'dashboard', 'school-management', 'curriculum', 'student-management', 'parent-management', 'teacher-management',
            'staff-management', 'learning-management', 'assessments', 'tutoring', 'finance', 'reports', 'notifications',
            'audit-logs', 'settings',
        ]), array_map(fn ($id) => "nav.institution.$id", [
            'dashboard', 'students', 'parents', 'teachers', 'classes', 'timetable', 'attendance', 'assignments', 'exams', 'reports',
        ])),

        'school_admin' => array_merge([
            'school.settings.manage', 'school.campuses.manage', 'school.users.manage', 'school.users.view',
            'school.academics.manage', 'school.reports.view', 'curriculum.view', 'learning.content.manage',
            'learning.content.assign', 'assessments.manage', 'assessments.grade', 'assessments.results.view_class',
            'tutoring.manage', 'tutoring.attendance.manage', 'progress.view_class', 'reports.academic.view',
            'reports.tutor.view', 'reports.export', 'nav.account.password',
        ], array_map(fn ($id) => "nav.institution.$id", [
            'dashboard', 'students', 'parents', 'teachers', 'classes', 'timetable', 'attendance', 'assignments', 'exams', 'reports',
        ])),

        'campus_admin' => array_merge([
            'school.users.manage', 'school.users.view', 'school.academics.manage', 'school.reports.view', 'curriculum.view',
            'learning.content.assign', 'assessments.manage', 'assessments.grade', 'assessments.results.view_class',
            'tutoring.manage', 'tutoring.attendance.manage', 'progress.view_class', 'reports.academic.view',
            'nav.account.password',
        ], array_map(fn ($id) => "nav.institution.$id", [
            'dashboard', 'students', 'parents', 'teachers', 'classes', 'timetable', 'attendance', 'assignments', 'exams', 'reports',
        ])),

        'principal' => array_merge([
            'school.users.view', 'school.academics.manage', 'school.reports.view', 'curriculum.manage', 'curriculum.view',
            'learning.content.manage', 'learning.content.assign', 'assessments.manage', 'assessments.grade',
            'assessments.results.view_class', 'tutoring.manage', 'progress.view_class', 'reports.academic.view',
            'reports.tutor.view', 'reports.export', 'nav.account.password',
        ], array_map(fn ($id) => "nav.institution.$id", [
            'dashboard', 'school-performance', 'teachers', 'students', 'attendance', 'assessments', 'academic-reports',
            'tutor-performance', 'notifications', 'reports',
        ])),

        'academic_coordinator' => array_merge([
            'school.users.view', 'school.academics.manage', 'curriculum.manage', 'curriculum.view', 'learning.content.manage',
            'learning.content.assign', 'assessments.manage', 'assessments.grade', 'assessments.results.view_class',
            'progress.view_class', 'reports.academic.view', 'reports.export', 'nav.account.password',
        ], array_map(fn ($id) => "nav.institution.$id", [
            'dashboard', 'curriculum', 'subjects', 'lesson-planning', 'homework', 'assessments', 'teachers',
            'academic-calendar', 'reports',
        ])),

        'finance_manager' => array_merge([
            'tenant.billing.view', 'tenant.billing.manage', 'school.users.view', 'school.reports.view',
            'reports.finance.view', 'reports.export', 'nav.account.password',
        ], array_map(fn ($id) => "nav.institution.$id", [
            'dashboard', 'student-fees', 'tutor-payments', 'expenses', 'refunds', 'invoices', 'financial-reports',
        ])),

        'teacher' => array_merge([
            'curriculum.view', 'learning.content.assign', 'learning.content.manage', 'assessments.manage', 'assessments.grade',
            'assessments.results.view_class', 'progress.view_class', 'tutoring.availability.manage', 'tutoring.conduct',
            'tutoring.attendance.manage', 'school.reports.view', 'reports.academic.view', 'reports.tutor.view',
            'reports.export', 'nav.account.password',
        ], array_map(fn ($id) => "nav.institution.$id", [
            'dashboard', 'my-classes', 'lesson-plans', 'course-content', 'homework', 'assignments', 'quizzes', 'exams',
            'attendance', 'student-progress', 'grade-book', 'resources', 'messages', 'profile',
        ])),

        'tutor' => array_merge([
            'curriculum.view', 'tutoring.availability.manage', 'tutoring.conduct', 'tutoring.attendance.manage',
            'school.reports.view', 'reports.academic.view', 'reports.tutor.view', 'reports.export', 'nav.account.password',
        ], array_map(fn ($id) => "nav.institution.$id", [
            'dashboard', 'my-students', 'session-schedule', 'availability', 'live-sessions', 'homework', 'assessments',
            'session-notes', 'student-progress', 'earnings', 'notifications', 'profile',
        ])),

        'student' => array_merge([
            'learning.content.consume', 'assessments.attempt', 'assessments.results.view_own', 'tutoring.join',
            'progress.view_own', 'nav.account.password',
        ], array_map(fn ($id) => "nav.learner.$id", [
            'dashboard', 'my-courses', 'subjects', 'lessons', 'stem-activities', 'virtual-labs', 'homework', 'assignments',
            'quizzes', 'exams', 'results', 'certificates', 'tutor-sessions', 'messages', 'notifications', 'profile',
        ])),

        'parent' => array_merge([
            'progress.view_child', 'homework.view_child', 'assessments.results.view_child', 'tutoring.book',
            'tutoring.attendance.view_child', 'nav.account.password',
        ], array_map(fn ($id) => "nav.learner.$id", [
            'dashboard', 'my-children', 'attendance', 'homework', 'assignments', 'results', 'progress-reports',
            'tutor-sessions', 'fee-payments', 'school-notices', 'notifications', 'profile',
        ])),

        'customer_support' => array_merge([
            'platform.support.access', 'platform.audit.view', 'platform.tenants.manage', 'school.users.view',
            'tenant.billing.view', 'reports.academic.view', 'nav.account.password',
        ], array_map(fn ($id) => "nav.control.$id", [
            'dashboard', 'schools', 'support-tickets', 'live-chat', 'knowledge-base', 'notifications',
        ])),

        'auditor' => array_merge([
            'platform.audit.view', 'audit.logs.view', 'tenant.billing.view', 'school.reports.view',
            'reports.academic.view', 'reports.tutor.view', 'reports.finance.view', 'reports.export', 'nav.account.password',
        ], array_map(fn ($id) => "nav.control.$id", [
            'dashboard', 'activity-logs', 'login-logs', 'fee-audit', 'academic-audit', 'security-reports',
        ])),
    ],

    'aliases' => [
        'tenant_owner' => 'school_owner',
    ],
];
