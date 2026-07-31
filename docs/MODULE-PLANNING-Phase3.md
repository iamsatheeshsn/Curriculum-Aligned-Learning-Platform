# Phase 3 — Module Planning

## K-12 STEM & Tutoring Platform

| Field | Value |
| --- | --- |
| **Document Title** | Module Planning |
| **Product Name** | K-12 STEM & Tutoring Platform |
| **Version** | 1.0 (Approved) |
| **Status** | Approved — Implementation Authorized |
| **Date** | 29 July 2026 |
| **Approved On** | 29 July 2026 |
| **Depends On** | SRS v1.0 (Approved) · Architecture v1.1 (Approved) |
| **Constraint** | No code in this phase |

---

## Document Control

| Version | Date | Author | Description |
| --- | --- | --- | --- |
| 1.0 | 2026-07-29 | Product Architecture | Phase 3 module planning draft |
| 1.0 | 2026-07-29 | Product Architecture | Stakeholder approved; implementation authorized |

**Approval gate:** Cleared. Backlog, ERD, UX, and scaffolding may proceed from these modules.

**Portal context (locked):**

| Portal | Roles | Tenant in URL |
| --- | --- | --- |
| Control | Super Admin, Tenant Owner | No |
| Institution | School staff, Teachers, Tutors | `/{tenantSlug}/…` |
| Learner | Students, Parents | `/{tenantSlug}/…` |

---

## 1. Module Map Overview

```
SaaS                School              Curriculum
├─ Tenants          ├─ Schools          ├─ Country
├─ Subscription     ├─ Campuses         ├─ Curriculum
├─ Billing          ├─ Academic Years   ├─ Grade
└─ Branding         └─ Terms            ├─ Subject
                                        ├─ Chapter
Learning            Assessment          ├─ Lesson
├─ Interactive      ├─ Quiz             └─ Learning Outcomes
├─ Videos           ├─ Exam
├─ PDFs             ├─ Homework
├─ Simulations      └─ Practice Tests
├─ Virtual Labs
└─ Assignments      Tutoring
                    ├─ Tutors
Student             ├─ Live Classes
├─ Enrollment       ├─ Session Booking
├─ Progress         ├─ Availability
├─ Certificates     ├─ Attendance
└─ Achievements     └─ Recordings (future)

Parent              Reports
├─ Progress         ├─ Academic
├─ Attendance       ├─ Tutor
├─ Homework         ├─ School
└─ Notifications    └─ Student Analytics
```

**Legend — V1 priority**

| Tag | Meaning |
| --- | --- |
| **Must** | Required for V1 launch |
| **Should** | Strongly desired in V1 if capacity allows |
| **Could** | Nice-to-have / thin slice |
| **Future** | Explicitly post-V1 |

---

## 2. SaaS Modules

### 2.1 Tenants

| | |
| --- | --- |
| **ID** | MOD-SAAS-TEN |
| **Portal** | Control |
| **Priority** | Must |

**Objectives**

- Represent each paying institution (school group / tutoring brand) as an isolated SaaS tenant.
- Provide a unique public `slug` for Institution and Learner portal URLs.
- Enable Super Admin to lifecycle-manage tenants; Tenant Owner to administer their own tenant.

**Features**

- Create / update / suspend / reactivate tenant
- Unique `slug`, legal name, display name, countries served (KSA/UAE)
- Default locale, timezone, status
- Tenant Owner assignment and ownership transfer (controlled)
- Entitlement / module flags linkage
- Soft-delete with retention rules
- Tenant bootstrap endpoint by slug (for portal load)

**Business Rules**

1. `slug` is immutable after first publish unless Super Admin override with redirect plan.
2. Suspended tenants cannot authenticate into Institution/Learner portals (Control Tenant Owner may see limited read-only status).
3. Super Admin can see all tenants; Tenant Owner only their tenant.
4. Every tenant-owned record must carry `tenant_id`.
5. Slug must be URL-safe, unique globally, lowercase.

**Dependencies**

- Country reference data
- Subscription Plans / entitlements
- Branding
- Identity (users, roles)

---

### 2.2 Subscription Plans

| | |
| --- | --- |
| **ID** | MOD-SAAS-PLAN |
| **Portal** | Control |
| **Priority** | Must (catalog) · Should (self-serve changes) |

**Objectives**

- Define commercial packages (seats, campuses, modules, tutoring hours).
- Gate features by plan entitlements.

**Features**

- Plan catalog (name, description AR/EN, price display fields)
- Limits: max schools, campuses, students, teachers, storage
- Module toggles (tutoring, virtual labs, advanced reports, etc.)
- Assign plan to tenant (start/end, trial flag)
- View current entitlements in Control (Tenant Owner read)

**Business Rules**

1. Feature checks enforce entitlements server-side.
2. Exceeding soft limits warns; hard limits block create actions.
3. Plan downgrade that violates current usage requires Super Admin acknowledgment.
4. Trial tenants expire to restricted or suspended state per policy.

**Dependencies**

- Tenants
- Billing
- Feature flags / module registry

---

### 2.3 Billing

| | |
| --- | --- |
| **ID** | MOD-SAAS-BILL |
| **Portal** | Control |
| **Priority** | Should (V1 can be invoice-led) |

**Objectives**

- Track what tenants owe and payment status without blocking academic ops in early pilots.
- Support manual/invoice-first billing with hooks for later gateways.

**Features**

- Billing account per tenant (currency display SAR/AED)
- Invoices (manual create, status: draft/sent/paid/overdue/void)
- Payment records (manual)
- Billing contact on tenant
- Basic dunning notices (email) for overdue — Could
- Payment gateway automation — Future

**Business Rules**

1. Academic access policy on non-payment is configurable (grace period).
2. Currency is informational in V1 unless gateway is enabled.
3. Only Super Admin (and optionally finance role) mutates invoices; Tenant Owner views.
4. Invoice PDFs stored under tenant-scoped storage.

**Dependencies**

- Tenants, Subscription Plans
- Notifications (invoice emails)
- Local storage

---

### 2.4 Branding

| | |
| --- | --- |
| **ID** | MOD-SAAS-BRAND |
| **Portal** | Control (Tenant Owner) · reflected on Institution/Learner |
| **Priority** | Should |

**Objectives**

- Let each tenant present Institution/Learner portals with their identity.

**Features**

- Logo upload, favicon, primary/secondary colors
- Display name overrides
- Email header/footer branding
- Preview in Control
- Fallback to platform defaults

**Business Rules**

1. Branding applies only to Institution/Learner for that slug; Control stays platform-branded.
2. Asset size/type limits enforced.
3. Invalid CSS/color values rejected.
4. Suspended tenant branding still resolves for maintenance pages if needed.

**Dependencies**

- Tenants
- Media / local storage
- Notification email templates

---

## 3. School Modules

### 3.1 Schools

| | |
| --- | --- |
| **ID** | MOD-SCH-SCHOOL |
| **Portal** | Control (Tenant Owner create) · Institution (operate) |
| **Priority** | Must |

**Objectives**

- Model one or more schools under a tenant with isolation boundaries.

**Features**

- CRUD school (name AR/EN, code, country, status)
- Assign school admins
- School-level settings (locale default, calendar)
- Activate/deactivate school

**Business Rules**

1. School belongs to exactly one tenant.
2. Count of schools constrained by subscription.
3. Deactivated school blocks new enrollments; historical data retained.
4. Institution portal users only see schools they are members of (Tenant Owner via Control sees all in tenant).

**Dependencies**

- Tenants, Country, Subscription limits
- Users / roles

---

### 3.2 Campuses

| | |
| --- | --- |
| **ID** | MOD-SCH-CAMPUS |
| **Portal** | Institution |
| **Priority** | Must |

**Objectives**

- Support multi-campus schools with local operational scope.

**Features**

- CRUD campus under school
- Address, timezone override, contact
- Campus admin assignment
- Campus status

**Business Rules**

1. Campus belongs to one school.
2. Campus-scoped roles cannot access other campuses’ operational data by default.
3. Campus limit may be plan-enforced.
4. Academic structures may be school-wide or campus-specific (configurable; default campus-linked classes).

**Dependencies**

- Schools
- Users / roles

---

### 3.3 Academic Years

| | |
| --- | --- |
| **ID** | MOD-SCH-YEAR |
| **Portal** | Institution |
| **Priority** | Must |

**Objectives**

- Anchor enrollments, terms, and reporting to a defined academic year.

**Features**

- Create academic year (label, start/end dates, school scope)
- Mark current / archive
- Clone structure from previous year (Should)

**Business Rules**

1. Only one “current” academic year per school at a time.
2. Archived years are read-only for teaching mutations.
3. Enrollments and assessments must reference an academic year.
4. Date ranges cannot overlap for current+planned years on same school (warn/block).

**Dependencies**

- Schools
- Terms, Enrollment

---

### 3.4 Terms

| | |
| --- | --- |
| **ID** | MOD-SCH-TERM |
| **Portal** | Institution |
| **Priority** | Must |

**Objectives**

- Subdivide academic years (semesters/trimesters/terms) for scheduling and reporting.

**Features**

- CRUD terms within academic year
- Order index, start/end dates
- Term status (upcoming/active/closed)

**Business Rules**

1. Term dates must fall within parent academic year.
2. Closed terms lock new submissions where policy says so.
3. Reports can filter by term.
4. Tutoring may be term-bound or continuous (school setting).

**Dependencies**

- Academic Years
- Assessments, Reports

---

## 4. Curriculum Modules

### 4.1 Country

| | |
| --- | --- |
| **ID** | MOD-CUR-COUNTRY |
| **Portal** | Control (manage) · all portals (consume) |
| **Priority** | Must |

**Objectives**

- Provide country context for curriculum packs, timezone defaults, and compliance flags (KSA, UAE first).

**Features**

- Country master (code, name AR/EN, default timezone, default locale)
- Enable/disable for platform
- Link curricula and tenants to countries

**Business Rules**

1. V1 enabled countries: SA, AE at minimum.
2. School must have a primary country.
3. Country changes on a live school require confirmation (affects defaults only, not historical records).

**Dependencies**

- Platform reference data
- Curriculum, Tenants, Schools

---

### 4.2 Curriculum

| | |
| --- | --- |
| **ID** | MOD-CUR-FRAMEWORK |
| **Portal** | Control (templates) · Institution (adopt/customize) |
| **Priority** | Must |

**Objectives**

- Align STEM delivery to GCC-relevant curriculum frameworks configurable per school.

**Features**

- Curriculum framework definition (name, country, version, STEM focus)
- Adopt framework into school
- Map grades/subjects under framework
- Publish/archive framework versions

**Business Rules**

1. Platform templates are read-only to schools; adoption creates school-owned copy or mapping.
2. Content and outcomes should reference a curriculum node where required by school policy.
3. Multiple curricula per school allowed (e.g., national + international) — Should.

**Dependencies**

- Country
- Grade, Subject, Learning Outcomes
- Learning content

---

### 4.3 Grade

| | |
| --- | --- |
| **ID** | MOD-CUR-GRADE |
| **Portal** | Institution |
| **Priority** | Must |

**Objectives**

- Represent K–12 grade levels for enrollment and content targeting.

**Features**

- Grade list per school/curriculum (KG–12 configurable)
- Order, code, bilingual labels
- Link to classes/sections (academics)

**Business Rules**

1. Student enrollment requires a grade for the academic year.
2. Content visibility can be grade-filtered.
3. Grade codes unique within school curriculum scope.

**Dependencies**

- Curriculum, Schools
- Enrollment, Learning

---

### 4.4 Subject

| | |
| --- | --- |
| **ID** | MOD-CUR-SUBJECT |
| **Portal** | Institution |
| **Priority** | Must |

**Objectives**

- Define STEM and related subjects taught and tutored.

**Features**

- Subject CRUD (Science, Math, Technology, Engineering, Coding, etc.)
- Bilingual names, color/icon metadata
- Link to grades and teachers
- Tutoring-enabled flag

**Business Rules**

1. Assessments and lessons belong to a subject (or interdisciplinary with primary subject).
2. Tutor subjects must be subset of tutoring-enabled subjects.
3. Subject archive hides from new assignments but keeps history.

**Dependencies**

- Curriculum, Grade
- Teachers, Tutoring, Learning, Assessment

---

### 4.5 Chapter

| | |
| --- | --- |
| **ID** | MOD-CUR-CHAPTER |
| **Portal** | Institution |
| **Priority** | Must |

**Objectives**

- Structure subject content into sequenced chapters within a grade.

**Features**

- Chapter CRUD under subject+grade (+curriculum)
- Sequence order, bilingual title/summary
- Publish status

**Business Rules**

1. Lessons belong to a chapter (or unbound draft until placed).
2. Reordering does not delete learner progress; progress keys by lesson ID.
3. Unpublished chapters invisible to learners.

**Dependencies**

- Subject, Grade
- Lesson, Learning Outcomes

---

### 4.6 Lesson (Curriculum Node)

| | |
| --- | --- |
| **ID** | MOD-CUR-LESSON |
| **Portal** | Institution |
| **Priority** | Must |

**Objectives**

- Curriculum-level lesson definition that learning experiences attach to.

**Features**

- Lesson metadata (title AR/EN, duration estimate, difficulty)
- Link learning outcomes
- Sequence within chapter
- Map to standards nodes

**Business Rules**

1. Distinct from “Interactive Lesson” delivery package — curriculum lesson is the academic anchor; learning module supplies experiences.
2. Must reference subject/grade/chapter when published to students.
3. Versioning of lesson metadata Should; V1 can use updated_at + publish flag.

**Dependencies**

- Chapter, Learning Outcomes
- Learning module experiences
- Assessment items (optional link)

---

### 4.7 Learning Outcomes

| | |
| --- | --- |
| **ID** | MOD-CUR-LO |
| **Portal** | Institution |
| **Priority** | Must |

**Objectives**

- Make mastery measurable and reportable against stated outcomes.

**Features**

- Outcome statements AR/EN
- Code (e.g., MATH-G7-LO03)
- Link to lessons, assessments, activities
- Bloom/level tag (Could)

**Business Rules**

1. Progress and reports can aggregate by outcome.
2. Assessment questions may tag one or more outcomes.
3. Deleting an outcome in use is blocked; archive instead.

**Dependencies**

- Curriculum hierarchy
- Assessment, Learning Progress, Reports

---

## 5. Learning Modules

### 5.1 Interactive Lessons

| | |
| --- | --- |
| **ID** | MOD-LRN-INTERACTIVE |
| **Portal** | Institution (author) · Learner (consume) |
| **Priority** | Must |

**Objectives**

- Deliver sequenced, bilingual STEM lesson experiences with progress tracking.

**Features**

- Lesson builder (blocks: text, embed, quiz-check, media)
- Bind to curriculum lesson
- Preview, publish, assign to class/students
- Student player with resume
- Completion rules (view all / pass checks)

**Business Rules**

1. Only published + assigned lessons appear for students.
2. Progress events persisted (start, complete, score if any).
3. Locale variant fallback per Architecture i18n rules.
4. Teachers see class completion; parents see high-level completion.

**Dependencies**

- Curriculum Lesson, Enrollment
- Videos/PDFs/etc. as block types
- Notifications (assignment events)
- Learning Progress

---

### 5.2 Videos

| | |
| --- | --- |
| **ID** | MOD-LRN-VIDEO |
| **Portal** | Institution · Learner |
| **Priority** | Must |

**Objectives**

- Support instructional video as first-class learning media.

**Features**

- Upload or link video (V1: upload to local storage and/or URL)
- Metadata AR/EN, duration
- Embed in interactive lessons
- Basic watch progress (Should)

**Business Rules**

1. File type/size limits per plan.
2. Authorized streaming/download only for entitled roles.
3. Videos scoped to tenant/school storage paths.

**Dependencies**

- Media storage, Branding limits
- Interactive Lessons
- Subscription storage quotas

---

### 5.3 PDFs

| | |
| --- | --- |
| **ID** | MOD-LRN-PDF |
| **Portal** | Institution · Learner |
| **Priority** | Must |

**Objectives**

- Distribute worksheets, readings, and bilingual PDF materials.

**Features**

- Upload PDF, title AR/EN
- Attach to lessons/assignments
- Inline viewer or secure download
- Version replace (Should)

**Business Rules**

1. Students access only assigned materials.
2. Watermarking — Future.
3. Virus/MIME validation on upload.

**Dependencies**

- Media storage
- Interactive Lessons, Assignments

---

### 5.4 Simulations

| | |
| --- | --- |
| **ID** | MOD-LRN-SIM |
| **Portal** | Institution · Learner |
| **Priority** | Should |

**Objectives**

- Provide interactive STEM simulations (embed or packaged activity) for conceptual learning.

**Features**

- Register simulation package/URL
- Launch parameters, completion callback (basic)
- Embed in interactive lessons
- Track launch/complete events

**Business Rules**

1. External embeds allow-listed by domain.
2. Completion may be “launched” only if no callback — documented limitation.
3. Module can be plan-gated.

**Dependencies**

- Interactive Lessons
- Subscription entitlements
- CSP / security allow-list

---

### 5.5 Virtual Labs

| | |
| --- | --- |
| **ID** | MOD-LRN-VLAB |
| **Portal** | Institution · Learner |
| **Priority** | Should |

**Objectives**

- Offer lab-style STEM experiments in a guided virtual environment (lighter than full LMS labs).

**Features**

- Lab activity definition (objectives, steps, safety notes AR/EN)
- Media + simulation hooks
- Lab report submission (Could)
- Completion tracking

**Business Rules**

1. Treated as a learning activity type under Interactive Lessons or standalone assignment.
2. May require tutoring-enabled subject linkage for advanced labs.
3. Plan-gated if resource-heavy.

**Dependencies**

- Simulations, PDFs, Videos
- Assignments, Learning Outcomes
- Entitlements

---

### 5.6 Assignments

| | |
| --- | --- |
| **ID** | MOD-LRN-ASSIGN |
| **Portal** | Institution (teacher) · Learner (student/parent view) |
| **Priority** | Must |

**Objectives**

- Assign learning work with due dates and submission tracking.

**Features**

- Create assignment (instructions AR/EN, attachments, due date, class/students)
- Submission types: file, text, link, “mark complete”
- Teacher review / score / feedback
- Late submission policy
- Parent visibility of homework status

**Business Rules**

1. Due dates respect school timezone.
2. Closed after due if “block late” enabled.
3. One submission thread per student per assignment (resubmit policy configurable).
4. Notifications on assign/due soon/graded.

**Dependencies**

- Enrollment, Subjects
- PDFs/Videos attachments
- Notifications, Parent module
- Assessment (if scored like homework — see §6.3)

---

## 6. Assessment Modules

> **Note:** Homework appears under both Learning (workflow/submission) and Assessment (scored academic work). V1 may implement Homework once with dual presentation.

### 6.1 Quiz

| | |
| --- | --- |
| **ID** | MOD-ASM-QUIZ |
| **Portal** | Institution · Learner |
| **Priority** | Must |

**Objectives**

- Provide low-stakes formative checks aligned to lessons/outcomes.

**Features**

- Question bank items (MCQ, multi-select, T/F, numeric, short text)
- Quiz builder, shuffle, time optional
- Auto-score objective items
- Multiple attempts policy
- Immediate or delayed result release

**Business Rules**

1. Attempts counted; excess blocked.
2. Questions bilingual; attempt locale stored.
3. Results visibility: student always (if released); parent per school policy.
4. Linked learning outcomes update mastery signals (basic).

**Dependencies**

- Subject, Lesson, Learning Outcomes
- Question bank
- Learning Progress, Notifications

---

### 6.2 Exam

| | |
| --- | --- |
| **ID** | MOD-ASM-EXAM |
| **Portal** | Institution · Learner |
| **Priority** | Must |

**Objectives**

- Support higher-stakes summative exams within availability windows.

**Features**

- Exam scheduling (window start/end)
- Attempt limits (typically 1)
- Mixing sections / question sets
- Manual grading queue for subjective items
- Grade release controls
- Gradebook integration

**Business Rules**

1. Cannot start outside window.
2. In-progress attempt auto-finalizes at window end or timer expiry.
3. Teacher overrides require audit log.
4. Academic integrity extras (lockdown, proctoring) — Future.

**Dependencies**

- Terms, Academic Years
- Question bank, Gradebook/Reports
- Audit log, Notifications

---

### 6.3 Homework (Assessed)

| | |
| --- | --- |
| **ID** | MOD-ASM-HW |
| **Portal** | Institution · Learner · Parent visibility |
| **Priority** | Must |

**Objectives**

- Combine assignment workflow with optional scoring for homework.

**Features**

- Scored or completion-only modes
- Rubric-lite score + feedback
- Parent homework list (due/completed/missing)
- Link to lesson/chapter

**Business Rules**

1. Missing homework defined as no submission after due (policy).
2. Scores optional; completion still tracks progress.
3. Counts toward academic reports when marked “include in reports”.

**Dependencies**

- Assignments (Learning)
- Parent module
- Reports

---

### 6.4 Practice Tests

| | |
| --- | --- |
| **ID** | MOD-ASM-PRACTICE |
| **Portal** | Institution · Learner |
| **Priority** | Should |

**Objectives**

- Allow unlimited or high-attempt practice without harming official gradebook.

**Features**

- Practice test from question bank / chapter
- Instant feedback mode
- Exclude from official averages (default)
- Recommend weak outcomes (Could)

**Business Rules**

1. Practice scores do not alter exam grades unless school opts in.
2. Still writes progress/analytics events (tagged `practice`).
3. May consume same questions as quizzes with separate attempt pools.

**Dependencies**

- Quiz engine / question bank
- Learning Progress, Student Analytics

---

## 7. Tutoring Modules

### 7.1 Tutors

| | |
| --- | --- |
| **ID** | MOD-TUT-TUTOR |
| **Portal** | Institution |
| **Priority** | Must |

**Objectives**

- Manage tutor profiles, subjects, languages, and campus affiliation.

**Features**

- Tutor profile (bio AR/EN, subjects, languages AR/EN, campuses)
- Activate/deactivate
- Link user account with Tutor role
- Rating — Could / Future

**Business Rules**

1. Tutor must be tenant member; school/campus scoped as assigned.
2. Can only be booked for enabled subjects/languages.
3. Teachers may also be tutors (dual role) on Institution portal.

**Dependencies**

- Users/roles, Subjects, Campuses
- Availability, Live Classes

---

### 7.2 Live Classes

| | |
| --- | --- |
| **ID** | MOD-TUT-LIVE |
| **Portal** | Institution · Learner |
| **Priority** | Must |

**Objectives**

- Run scheduled live tutoring sessions (1:1 or small group) via meeting provider abstraction.

**Features**

- Session entity (subject, language, tutor, learners, start, duration)
- Join link issuance
- Status lifecycle: scheduled → in-progress → completed / cancelled / no-show
- Session notes & follow-ups
- Group size limits

**Business Rules**

1. Meeting provider selected at platform/tenant config (adapter).
2. Only participants + authorized staff can join.
3. Language (AR/EN) mandatory on session.
4. Package minutes consumed on complete (if packages enabled).

**Dependencies**

- Tutors, Session Booking, Attendance
- Notifications
- Meeting provider adapter
- Subscription tutoring entitlements

---

### 7.3 Session Booking

| | |
| --- | --- |
| **ID** | MOD-TUT-BOOK |
| **Portal** | Learner (parent/student per policy) · Institution (admin/teacher) |
| **Priority** | Must |

**Objectives**

- Book tutoring against availability with clear confirmation rules.

**Features**

- Search tutors by subject/language/campus
- Offer available slots
- Book / request / confirm flows
- Reschedule / cancel per policy
- Idempotent booking API

**Business Rules**

1. Who may book (parent only / student / both) is school policy.
2. No double-booking tutor slot.
3. Cancellation windows restore package credit when configured.
4. Booking must match tenant slug context.

**Dependencies**

- Availability, Tutors, Live Classes
- Parent policies
- Notifications
- Tutoring packages (Should)

---

### 7.4 Availability

| | |
| --- | --- |
| **ID** | MOD-TUT-AVAIL |
| **Portal** | Institution (tutor) |
| **Priority** | Must |

**Objectives**

- Publish tutor free/busy windows in campus timezone.

**Features**

- Weekly recurring availability
- Date exceptions (block/extra)
- Slot granularity (e.g., 30/60 min)
- Visibility by campus/subject

**Business Rules**

1. Bookings only on open slots without conflicts.
2. Timezone = campus or tutor setting; displayed in viewer locale.
3. Past slots not bookable.

**Dependencies**

- Tutors, Campuses
- Session Booking

---

### 7.5 Attendance

| | |
| --- | --- |
| **ID** | MOD-TUT-ATT |
| **Portal** | Institution · Parent (view) |
| **Priority** | Must |

**Objectives**

- Record who attended live sessions for ops and parent visibility.

**Features**

- Mark present / absent / late / excused
- Bulk mark
- Attendance history per student
- Feed Parent Attendance view and Tutor Reports

**Business Rules**

1. Completed sessions require attendance before package close-out (configurable).
2. No-show statuses trigger policy actions.
3. Parent sees only linked students.

**Dependencies**

- Live Classes
- Parent module, Reports
- Packages (Should)

---

### 7.6 Recordings (Future)

| | |
| --- | --- |
| **ID** | MOD-TUT-REC |
| **Portal** | — |
| **Priority** | Future |

**Objectives**

- Store and authorize playback of tutoring session recordings.

**Features (future)**

- Provider webhook ingest, retention policy, parental consent flags, authorized playback

**Business Rules (future)**

1. Consent and retention mandatory before enablement in KSA/UAE context.
2. Not in V1 scope; schema may reserve `recording_url` nullable without UI.

**Dependencies**

- Live Classes, Media storage, Compliance

---

## 8. Student Modules

### 8.1 Enrollment

| | |
| --- | --- |
| **ID** | MOD-STU-ENROLL |
| **Portal** | Institution · reflected on Learner |
| **Priority** | Must |

**Objectives**

- Place students into school, campus, academic year, grade, class/section, subjects.

**Features**

- Enroll / transfer / withdraw
- Bulk CSV import (Should)
- Parent linkage at enrollment
- Enrollment status history

**Business Rules**

1. Active enrollment required for Learner access to school content.
2. Transfer preserves historical attempts under prior class IDs.
3. Seat limits enforced by plan.
4. Student belongs to tenant; school isolation enforced.

**Dependencies**

- Schools, Campuses, Academic Years, Grade
- Users, Parent links
- Subscription limits

---

### 8.2 Learning Progress

| | |
| --- | --- |
| **ID** | MOD-STU-PROGRESS |
| **Portal** | Learner · Institution · Parent |
| **Priority** | Must |

**Objectives**

- Track lesson completion, assessment performance, and outcome mastery signals.

**Features**

- Progress dashboard per student
- Per-lesson / pathway % complete
- Recent activity feed
- Outcome mastery summary (basic)
- Teacher class heatmaps (Should)

**Business Rules**

1. Progress events are append-safe / idempotent where possible.
2. Practice vs graded distinction preserved.
3. Parent sees aggregated view; detailed item review per policy.
4. Recalculation jobs may run async via queues.

**Dependencies**

- Interactive Lessons, Assessments
- Learning Outcomes
- Queues, Reports

---

### 8.3 Certificates

| | |
| --- | --- |
| **ID** | MOD-STU-CERT |
| **Portal** | Institution (issue) · Learner/Parent (view) |
| **Priority** | Should |

**Objectives**

- Issue completion certificates for pathways/courses/programs.

**Features**

- Certificate templates (AR/EN), tenant branding
- Auto-issue on pathway completion rules
- Manual issue/revoke
- PDF generation stored per tenant
- Verification code (Could)

**Business Rules**

1. Issued only if completion criteria met (or admin override audited).
2. Revoke retains record with void status.
3. Names pulled from official student profile at issue time (snapshot).

**Dependencies**

- Branding, Learning Progress
- Local storage, PDF generation job
- Notifications

---

### 8.4 Achievements

| | |
| --- | --- |
| **ID** | MOD-STU-ACH |
| **Portal** | Learner · Parent (view) |
| **Priority** | Could |

**Objectives**

- Gamify engagement with badges/milestones without replacing grades.

**Features**

- Achievement definitions (streaks, completions, tutoring attendance)
- Award events, student showcase
- Enable/disable per tenant

**Business Rules**

1. Achievements never alter official grades.
2. Can be disabled for schools that reject gamification.
3. Awards idempotent per rule key.

**Dependencies**

- Learning Progress, Tutoring Attendance
- Notifications (optional)

---

## 9. Parent Modules

### 9.1 Student Progress (Parent View)

| | |
| --- | --- |
| **ID** | MOD-PAR-PROGRESS |
| **Portal** | Learner (Parent experience) |
| **Priority** | Must |

**Objectives**

- Give guardians clear visibility into linked children’s academic progress.

**Features**

- Child switcher
- Progress summary cards
- Subject breakdown
- Recent assessments
- Deep links into allowed detail screens

**Business Rules**

1. Access only via verified parent–student links.
2. Visibility of exact scores configurable by school.
3. Multi-child parents see only linked students in that tenant slug.

**Dependencies**

- Enrollment, Learning Progress, Assessments
- Auth linkage

---

### 9.2 Attendance (Parent View)

| | |
| --- | --- |
| **ID** | MOD-PAR-ATT |
| **Portal** | Learner (Parent) |
| **Priority** | Must |

**Objectives**

- Show tutoring (and optionally class) attendance to parents.

**Features**

- Attendance timeline per child
- Filters by subject/tutor/date
- No-show highlights

**Business Rules**

1. V1 focuses on tutoring attendance; classroom daily attendance is Could/Future unless already in scope.
2. Data delayed until tutor/admin marks attendance.

**Dependencies**

- Tutoring Attendance
- Parent Progress shell

---

### 9.3 Homework (Parent View)

| | |
| --- | --- |
| **ID** | MOD-PAR-HW |
| **Portal** | Learner (Parent) |
| **Priority** | Must |

**Objectives**

- Help parents track homework due, submitted, and missing items.

**Features**

- Homework list by child
- Status filters
- Due soon grouping
- Optional open instructions (read-only)

**Business Rules**

1. Parents cannot submit on behalf of students unless school enables proxy (default off).
2. Missing calculation uses school timezone.

**Dependencies**

- Assignments / Homework assessment
- Notifications

---

### 9.4 Notifications (Parent)

| | |
| --- | --- |
| **ID** | MOD-PAR-NTF |
| **Portal** | Learner (Parent) |
| **Priority** | Must |

**Objectives**

- Keep parents informed of critical academic and tutoring events in AR/EN.

**Features**

- In-app inbox
- Email for critical events
- Preference center (non-mandatory channels)
- Mark read / filters

**Business Rules**

1. Security and booking confirmations cannot be fully disabled.
2. Locale = parent preference.
3. Tenant branding on email.

**Dependencies**

- Notification architecture
- All event-producing modules

---

## 10. Reports Modules

### 10.1 Academic Reports

| | |
| --- | --- |
| **ID** | MOD-RPT-ACAD |
| **Portal** | Institution · Control (tenant rollup limited) |
| **Priority** | Must |

**Objectives**

- Report formative/summative performance by class, subject, term, grade.

**Features**

- Class gradebook export
- Subject averages, distribution
- Outcome mastery summaries
- Filter by academic year/term/campus
- CSV/PDF export (Should)

**Business Rules**

1. Scoped to school/campus membership.
2. Practice tests excluded from official averages by default.
3. Heavy exports run via queue.

**Dependencies**

- Assessment, Learning Outcomes, Terms
- Queues, storage

---

### 10.2 Tutor Reports

| | |
| --- | --- |
| **ID** | MOD-RPT-TUTOR |
| **Portal** | Institution |
| **Priority** | Should |

**Objectives**

- Measure tutoring utilization, completion, no-shows, and tutor load.

**Features**

- Sessions completed vs cancelled
- Attendance rates
- Hours by tutor/subject/language
- Package consumption (if enabled)

**Business Rules**

1. Respect campus scope for campus admins.
2. PII minimized in exports.

**Dependencies**

- Tutoring modules
- Queues

---

### 10.3 School Reports

| | |
| --- | --- |
| **ID** | MOD-RPT-SCHOOL |
| **Portal** | Institution · Control (Tenant Owner summary) |
| **Priority** | Must |

**Objectives**

- Give leadership KPIs: enrollment, engagement, STEM completion, tutoring usage.

**Features**

- Dashboard widgets
- Campus comparison (multi-campus)
- Trend by term
- Export summary

**Business Rules**

1. Tenant Owner sees all schools in tenant; School Admin only own school.
2. Super Admin may see anonymized platform aggregates (separate).

**Dependencies**

- Enrollment, Progress, Tutoring
- Subscription (for limit vs usage)

---

### 10.4 Student Analytics

| | |
| --- | --- |
| **ID** | MOD-RPT-STUDENT |
| **Portal** | Institution · Learner (own) · Parent (linked) |
| **Priority** | Must (basic) · Should (advanced) |

**Objectives**

- Provide per-student analytics for intervention and parent conversations.

**Features**

- Time-on-task (basic)
- Strength/weakness by subject/outcome
- Assessment timeline
- Tutoring history correlation (Should)
- At-risk flags (Could)

**Business Rules**

1. Students see own analytics only.
2. Teachers see assigned students only.
3. Advanced predictive analytics — Future.

**Dependencies**

- Learning Progress, Assessments, Tutoring
- Parent Progress views

---

## 11. Cross-Module Dependency Matrix (Summary)

| Module | Depends on |
| --- | --- |
| Branding | Tenants, Media |
| Billing | Plans, Tenants |
| Campuses | Schools |
| Terms | Academic Years |
| Chapter/Lesson/LO | Curriculum, Grade, Subject |
| Interactive Lessons | Curriculum Lesson, Media types |
| Assessments | Subject, LO, Enrollment, Terms |
| Tutoring Booking | Tutors, Availability, Live Classes |
| Parent views | Enrollment links + source modules |
| Reports | Academic + Tutoring data + Queues |
| Certificates | Progress + Branding |
| Recordings | Live Classes + Compliance (**Future**) |

### Suggested build order (implementation sequencing)

1. **SaaS foundation:** Tenants (slug), Plans, Branding (basic), Identity/RBAC  
2. **School structure:** Schools, Campuses, Years, Terms  
3. **Curriculum tree:** Country → Curriculum → Grade → Subject → Chapter → Lesson → LO  
4. **Learning + Progress:** Media, Interactive Lessons, Assignments, Enrollment  
5. **Assessment:** Quiz → Homework → Exam → Practice  
6. **Tutoring:** Tutors → Availability → Booking → Live → Attendance  
7. **Parent surfaces** on Learner portal  
8. **Reports + Certificates**  
9. **Billing hardening** · Achievements · Recordings (later)

---

## 12. Portal Ownership by Module

| Module Group | Control | Institution | Learner |
| --- | --- | --- | --- |
| Tenants / Plans / Billing | Full | — | — |
| Branding | Configure | Consume | Consume |
| Schools (create) | Tenant Owner | Operate | — |
| Campuses / Years / Terms | — | Full | — |
| Curriculum & content authoring | Templates (SA) | Full | Consume |
| Assessment authoring | — | Full | Attempt |
| Tutoring ops | — | Full | Book/Join |
| Enrollment | — | Full | Read self |
| Parent views | — | — | Parent |
| Reports | Tenant summaries | Full | Limited self |

---

## 13. Open Product Decisions

| ID | Topic | Notes |
| --- | --- | --- |
| MP-01 | Homework dual-module | Single implementation shared by Learning + Assessment recommended |
| MP-02 | Classroom daily attendance | Parent “Attendance” in V1 = tutoring unless expanded |
| MP-03 | Simulation/Lab providers | Embed allow-list vs first-party packs |
| MP-04 | Certificate criteria | Pathway complete vs manual only |
| MP-05 | Billing enforcement | Grace period length on overdue |
| MP-06 | Practice tests in V1 | Should — confirm cut line |

---

## 14. Approval Sign-Off

| Role | Name | Signature | Date |
| --- | --- | --- | --- |
| Business Owner | | | |
| Product Owner | | | |
| Engineering Lead | | | |
| Academic Lead | | | |

---

## 15. Next Steps (After Approval)

1. Convert Must modules into Sprint-0 / MVP backlog stories  
2. Logical ERD covering entities implied by these modules  
3. UX sitemaps for Control / Institution / Learner  
4. Scaffold application per Architecture v1.1  

---

**End of Document — Status: APPROVED — IMPLEMENTATION AUTHORIZED — NO CODE IN THIS DOCUMENT**
