# Software Requirements Specification (SRS)

## K-12 STEM & Tutoring Platform

| Field | Value |
| --- | --- |
| **Document Title** | Software Requirements Specification |
| **Product Name** | K-12 STEM & Tutoring Platform |
| **Version** | 1.0 (Approved) |
| **Status** | Approved — Implementation Authorized |
| **Date** | 29 July 2026 |
| **Approved On** | 29 July 2026 |
| **Classification** | Commercial / Confidential |
| **Primary Markets** | Kingdom of Saudi Arabia (KSA), United Arab Emirates (UAE) |

---

## Document Control

| Version | Date | Author | Description |
| --- | --- | --- | --- |
| 1.0 | 2026-07-29 | Product Engineering | Initial enterprise SRS draft for approval |
| 1.0 | 2026-07-29 | Product Engineering | Stakeholder approved; implementation authorized |

**Approval gate:** Cleared. Implementation and scaffolding may proceed per agreed next steps.

---

## 1. Executive Summary

The **K-12 STEM & Tutoring Platform** is a commercial, multi-tenant SaaS product designed for private schools, international schools, and tutoring centers across Saudi Arabia and the United Arab Emirates. It delivers interactive STEM learning aligned with GCC curricula, combined with bilingual (Arabic / English) live tutoring for students, parents, teachers, and institutional administrators.

The platform supports **multi-school**, **multi-campus**, **multi-country**, and **multi-language** operations under a single SaaS architecture. Version 1 ships as a responsive web application (React + Vite + Tailwind CSS) backed by Laravel 12, PHP 8.3+, MySQL, and Laravel Sanctum authentication, with local file storage. The API layer will be designed for future mobile clients; **no native mobile applications are in Version 1 scope**.

Business value centers on curriculum-aligned STEM delivery, measurable learning outcomes, live tutoring operations, parent engagement, and institutional operational control—positioning the product as a GCC-ready education SaaS rather than a generic LMS.

---

## 2. Product Vision

### 2.1 Vision Statement

To become the leading GCC-focused K–12 STEM and live tutoring platform that enables schools and tutoring centers to deliver bilingual, curriculum-aligned, interactive learning at scale—with clear progress visibility for parents, teachers, and institutional leaders.

### 2.2 Mission

Provide a secure, multi-tenant education operating system that unifies:

- Interactive STEM content and pathways
- Formative and summative assessment
- Live bilingual tutoring sessions
- Parent and student engagement
- School / campus / country administration

### 2.3 Product Principles (V1)

1. **Curriculum alignment first** — STEM experiences map to GCC-relevant frameworks and school-configured curricula.
2. **Bilingual by design** — Arabic and English are first-class; UI and tutoring flows support both.
3. **Institutional multi-tenancy** — Tenant isolation, school/campus hierarchy, and role-based access are foundational.
4. **Web-first, API-ready** — Responsive web UX in V1; stable, versioned APIs for future mobile.
5. **Measurable learning** — Progress, assessments, and tutoring outcomes are reportable.
6. **Trust and compliance** — Child safety, data protection, and regional compliance expectations are non-negotiable.

### 2.4 Out of Scope (Version 1)

- Native iOS / Android applications
- Public marketplace of third-party content sellers (unless later approved)
- Full ERP / payroll / HR for schools
- National ministry system integrations (unless explicitly prioritized later)
- AI auto-grading beyond simple objective question types (future candidate)
- Offline-first native experiences

---

## 3. Business Goals

| ID | Goal | Success Indicators (V1) |
| --- | --- | --- |
| BG-01 | Acquire private/international schools and tutoring centers in KSA and UAE | Signed tenants; campuses onboarded |
| BG-02 | Deliver GCC-aligned interactive STEM learning | Curriculum mapping coverage; content completion rates |
| BG-03 | Enable bilingual live tutoring as a revenue and retention driver | Sessions booked/completed; tutor utilization |
| BG-04 | Increase parent engagement and retention | Parent logins; progress views; session feedback |
| BG-05 | Provide operational control for multi-campus institutions | Admin adoption; campus-level reporting |
| BG-06 | Establish a scalable SaaS foundation for regional expansion | Tenant isolation verified; performance SLAs met |
| BG-07 | Prepare API surface for future mobile without delaying V1 web | Documented, authenticated API contracts |

### 3.1 Commercial Model Assumptions (to be finalized)

- Tenant (institution) subscription tiers by seats / campuses / modules
- Optional tutoring package add-ons (hours, concurrent rooms, tutor seats)
- Per-school or per-group billing; multi-campus under one billing account supported
- Trial / pilot onboarding for sales-led enterprise deals

---

## 4. Target Market

### 4.1 Geographic Focus

| Country | Notes |
| --- | --- |
| **Saudi Arabia** | Private & international schools; tutoring centers; bilingual demand; Vision 2030 education modernization context |
| **United Arab Emirates** | Private & international schools; tutoring centers; multilingual families; high digital adoption |

### 4.2 Customer Segments

| Segment | Needs |
| --- | --- |
| **Private Schools** | Brand-controlled STEM program, campus ops, parent communications |
| **International Schools** | Multi-language, flexible curriculum mapping, reporting |
| **Tutoring Centers** | Session scheduling, tutor assignment, package tracking |
| **Parents** | Progress visibility, booking/approvals, bilingual communication |
| **Students** | Interactive STEM learning, assessments, live tutoring |
| **Teachers / Tutors** | Class/content delivery, assessment, session management |

### 4.3 Buyer Personas (Institutional)

- School Owner / Managing Director
- Academic Coordinator / Head of STEM
- IT / Digital Learning Lead
- Tutoring Center Operations Manager

### 4.4 End-User Personas

- Student (K–12 age bands; guardian-linked accounts for minors)
- Parent / Guardian
- Subject Teacher
- Live Tutor
- School Admin / Campus Admin
- Tenant Super Admin (institution)
- Platform Super Admin (SaaS operator)
- Tenant Owner (institution owner; shares Control Portal with Super Admin)

---

## 5. System Context & Architecture Requirements

### 5.1 Technology Stack (Approved Direction)

| Layer | Technology |
| --- | --- |
| Backend | Laravel 12, PHP 8.3+ |
| Frontend | React.js, Vite, Tailwind CSS |
| Database | MySQL |
| Authentication | Laravel Sanctum |
| Storage | Local storage (V1) |
| Delivery | Responsive web SPA + REST/JSON APIs |

### 5.2 Architecture Characteristics

- **Multi-tenant SaaS** with strict tenant data isolation
- **Multi-school** within a tenant (or tenant = school group)
- **Multi-campus** under a school
- **Multi-country** configuration (KSA, UAE at minimum)
- **Multi-language** (Arabic LTR/RTL, English)
- **Responsive design** (desktop, tablet, mobile web)
- **Future mobile API ready** (token auth, versioned endpoints, no web-only business logic trapped in UI)

### 5.3 Tenancy Model (Logical)

```
Platform Operator
 └── Tenant (Organization / School Group / Tutoring Brand)
      └── Country context (KSA / UAE / …)
           └── School
                └── Campus
                     └── Academic Year / Grade / Class / Section
                          └── Users (students, teachers, parents, staff)
```

Exact tenancy binding (tenant = one school vs. school group) shall be configurable during implementation design, but V1 must support multi-school and multi-campus hierarchies.

---

## 6. User Roles

| Role ID | Role | Primary Responsibilities |
| --- | --- | --- |
| R-01 | **Platform Super Admin** | Tenant lifecycle, global config, feature flags, platform monitoring |
| R-02 | **Tenant Owner** | Own-tenant administration (schools, branding, billing contact, institutional policies); uses **Control Portal** with Super Admin |
| R-03 | **School Admin** | School settings, users, academic structure, content assignment |
| R-04 | **Campus Admin** | Campus users, schedules, rooms/resources, local reporting |
| R-05 | **Academic Coordinator** | Curriculum mapping, pathways, assessment policies |
| R-06 | **Teacher** | Classes, content delivery, assignments, grading, messaging |
| R-07 | **Tutor** | Live tutoring sessions, availability, session notes, follow-ups |
| R-08 | **Student** | Learn, practice, assess, attend tutoring, view progress |
| R-09 | **Parent / Guardian** | Monitor progress, manage tutoring bookings, receive alerts |
| R-10 | **Support Agent** (optional V1) | Impersonation-limited support tickets within policy |

### 6.1 Access Control Requirements

- Role-Based Access Control (RBAC) with tenant scope
- Optional fine-grained permissions for admin roles
- Parent–student linkage with consent/guardianship rules
- Teachers/tutors scoped to assigned classes, subjects, or campuses
- Soft-delete / deactivate users without destroying audit history

---

## 7. Module List

| Module ID | Module | V1 Priority |
| --- | --- | --- |
| M-01 | Tenant & Organization Management | Must |
| M-02 | School & Campus Management | Must |
| M-03 | User & Role Management | Must |
| M-04 | Academic Structure (Year, Grade, Class, Section, Subject) | Must |
| M-05 | Curriculum & Standards Mapping (GCC-aligned STEM) | Must |
| M-06 | Learning Content Management (lessons, activities, media) | Must |
| M-07 | Learning Pathways / Courses | Must |
| M-08 | Assignments & Homework | Must |
| M-09 | Assessments & Question Bank | Must |
| M-10 | Progress & Analytics (student/class/campus) | Must |
| M-11 | Live Tutoring (scheduling, rooms, attendance) | Must |
| M-12 | Tutor Availability & Assignment | Must |
| M-13 | Parent Portal | Must |
| M-14 | Notifications & Alerts | Must |
| M-15 | Messaging / Announcements | Should |
| M-16 | Localization (AR/EN, RTL) | Must |
| M-17 | Country & Regional Settings | Must |
| M-18 | Media / File Storage (local) | Must |
| M-19 | Audit Logs | Must |
| M-20 | Billing & Subscription Hooks (basic) | Should |
| M-21 | Reports & Exports | Should |
| M-22 | API Gateway Surface for Future Mobile | Must (foundation) |
| M-23 | Help / Onboarding Guides | Could |

---

## 8. Functional Requirements

Requirements use priority: **Must** / **Should** / **Could**.

### 8.1 Authentication & Session (Laravel Sanctum)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-AUTH-01 | Users shall authenticate via secure login (email/username + password) | Must |
| FR-AUTH-02 | System shall issue Sanctum tokens/sessions for SPA and API clients | Must |
| FR-AUTH-03 | System shall support logout, session invalidation, and password reset | Must |
| FR-AUTH-04 | System shall enforce password policy configurable per tenant/platform | Must |
| FR-AUTH-05 | System shall support optional MFA for admin roles (V1 Should) | Should |
| FR-AUTH-06 | Minors’ accounts shall be linkable to parent/guardian accounts | Must |
| FR-AUTH-07 | Failed login throttling and lockout policies shall be enforced | Must |

### 8.2 Tenant, School, Campus, Country

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-ORG-01 | Platform shall create/manage tenants with isolation boundaries | Must |
| FR-ORG-02 | Tenant shall manage multiple schools | Must |
| FR-ORG-03 | School shall manage multiple campuses | Must |
| FR-ORG-04 | Entities shall be associated with country (KSA/UAE) and locale defaults | Must |
| FR-ORG-05 | Tenant branding (logo, colors, display name) shall be configurable | Should |
| FR-ORG-06 | Academic calendar and timezone shall be configurable per school/campus | Must |

### 8.3 Users & Enrollment

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-USR-01 | Admins shall invite/create users and assign roles | Must |
| FR-USR-02 | Bulk import (CSV) for students/teachers shall be supported | Should |
| FR-USR-03 | Students shall be enrolled into grade/class/section/subjects | Must |
| FR-USR-04 | Parents shall be linked to one or more students | Must |
| FR-USR-05 | Teachers/tutors shall be assigned to subjects/classes/campuses | Must |
| FR-USR-06 | User profiles shall store language preference and contact channels | Must |

### 8.4 Curriculum & STEM Learning

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-LRN-01 | System shall support STEM subjects (Science, Technology, Engineering, Math) and extensions (e.g., coding, robotics) as configurable subjects | Must |
| FR-LRN-02 | Content shall be mappable to curriculum standards/frameworks used by tenant schools (GCC-aligned mapping model) | Must |
| FR-LRN-03 | Lessons may include text, images, video, attachments, and interactive activities | Must |
| FR-LRN-04 | Students shall follow assigned pathways/courses with sequenced lessons | Must |
| FR-LRN-05 | System shall track lesson start, completion, time-on-task (basic), and scores where applicable | Must |
| FR-LRN-06 | Content shall support Arabic and English versions or bilingual fields | Must |
| FR-LRN-07 | Teachers/coordinators shall publish/unpublish content and control visibility by school/campus/class | Must |

### 8.5 Assessment

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-ASM-01 | Question bank shall support MCQ, multi-select, true/false, short text, numeric | Must |
| FR-ASM-02 | Assessments may be formative quizzes or summative tests | Must |
| FR-ASM-03 | Assessments shall support time limits, attempts, shuffle, and availability windows | Must |
| FR-ASM-04 | Auto-scoring for objective questions; manual scoring for subjective | Must |
| FR-ASM-05 | Results shall be visible per role policy (student/parent/teacher) | Must |
| FR-ASM-06 | Assessment items shall support bilingual stems/options | Must |
| FR-ASM-07 | Gradebook view for class/subject shall be available to teachers | Should |

### 8.6 Tutoring

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-TUT-01 | Tutors shall publish availability by campus/timezone | Must |
| FR-TUT-02 | Parents/students/admins shall book tutoring sessions (per policy) | Must |
| FR-TUT-03 | Sessions shall support 1:1 and small-group configurations | Must |
| FR-TUT-04 | Sessions shall record subject, language (AR/EN), scheduled time, duration, participants | Must |
| FR-TUT-05 | System shall support session status: scheduled, in-progress, completed, cancelled, no-show | Must |
| FR-TUT-06 | Live session join shall be supported via integrated meeting link/provider abstraction (provider TBD) | Must |
| FR-TUT-07 | Tutors shall add session notes and recommended next steps | Must |
| FR-TUT-08 | Attendance and package/hour consumption shall be tracked | Should |
| FR-TUT-09 | Cancellation/reschedule rules shall be configurable | Should |

### 8.7 Parent Portal

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-PAR-01 | Parents shall view linked students’ progress summaries | Must |
| FR-PAR-02 | Parents shall view upcoming assessments and tutoring sessions | Must |
| FR-PAR-03 | Parents shall receive notifications for key events | Must |
| FR-PAR-04 | Parents shall book/request tutoring per school policy | Must |
| FR-PAR-05 | Parents shall switch UI language AR/EN | Must |

### 8.8 Notifications

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-NTF-01 | In-app notifications for assignments, assessments, tutoring, announcements | Must |
| FR-NTF-02 | Email notifications for critical events | Must |
| FR-NTF-03 | Notification preferences by user (where allowed) | Should |
| FR-NTF-04 | Notifications shall be localized to user language | Must |

### 8.9 Localization & Regionalization

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-I18N-01 | Full UI support for English and Arabic including RTL layout | Must |
| FR-I18N-02 | Dates, times, calendars, and number formats respect locale/timezone | Must |
| FR-I18N-03 | Country-level defaults (timezone, currency display, week start) for KSA and UAE | Must |

### 8.10 Reporting

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-RPT-01 | Student progress report | Must |
| FR-RPT-02 | Class/subject performance report | Must |
| FR-RPT-03 | Tutoring utilization report | Should |
| FR-RPT-04 | Campus/school summary dashboards for admins | Must |
| FR-RPT-05 | Export to CSV/PDF for key reports | Should |

### 8.11 Platform Operations

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-OPS-01 | Audit log for admin/security-sensitive actions | Must |
| FR-OPS-02 | Feature flags / module enablement per tenant | Should |
| FR-OPS-03 | Health/status endpoints for operations | Could |

---

## 9. Non-Functional Requirements

| ID | Category | Requirement |
| --- | --- | --- |
| NFR-01 | **Performance** | Standard page/API responses P95 < 2s under expected V1 load; learning media streaming acceptable with progressive load |
| NFR-02 | **Availability** | Target 99.5% monthly uptime for production (excluding planned maintenance) |
| NFR-03 | **Scalability** | Horizontal-friendly app tier; DB indexing and tenant-aware queries; design for growth in tenants/schools/users |
| NFR-04 | **Security** | OWASP ASVS-aligned practices; encryption in transit (TLS); secrets management; least privilege |
| NFR-05 | **Privacy** | Data minimization; purpose limitation; parent/guardian controls for minors |
| NFR-06 | **Usability** | Responsive web usable on common desktop/tablet/mobile browsers; AR/EN parity |
| NFR-07 | **Accessibility** | Target WCAG 2.1 AA for core flows where feasible in V1 |
| NFR-08 | **Reliability** | Graceful error handling; retry-safe APIs for critical writes; backups for MySQL and local storage |
| NFR-09 | **Maintainability** | Modular Laravel domain structure; clear React feature modules; documented APIs |
| NFR-10 | **Observability** | Application logs, audit trails, basic metrics/error tracking |
| NFR-11 | **Localization quality** | No hard-coded user-facing strings in core modules |
| NFR-12 | **API readiness** | Versioned REST APIs; Sanctum auth; consistent error envelopes for future mobile |
| NFR-13 | **Storage** | Local storage with organized tenant-scoped paths; backup/restore procedures documented |
| NFR-14 | **Browser support** | Latest 2 versions of Chrome, Safari, Edge, Firefox; iOS Safari / Android Chrome for mobile web |

---

## 10. Learning Workflow

### 10.1 Purpose

Enable students to consume curriculum-aligned STEM content in a guided pathway with teacher oversight and parent visibility.

### 10.2 Actors

Student, Teacher, Academic Coordinator, Parent (view), School/Campus Admin

### 10.3 Primary Flow

1. **Setup:** Coordinator/Teacher maps STEM content to curriculum nodes and publishes a pathway for grade/class.
2. **Assignment:** Teacher assigns pathway/lessons to class or individual students with due dates.
3. **Discover:** Student opens Learning Home (localized) and sees assigned pathways and progress.
4. **Engage:** Student launches lesson → consumes content/activities → completes checks for understanding.
5. **Track:** System records progress events (started, completed, score, timestamps).
6. **Intervene:** Teacher reviews class progress; reassigns or sends remediation content.
7. **Inform:** Parent receives progress notifications / views dashboard.
8. **Report:** Admins view campus/school STEM completion and mastery summaries.

### 10.4 Alternate / Exception Flows

- Content unpublished mid-flight → students retain completed history; incomplete items hidden/locked per policy
- Student transfers class/campus → enrollment and assignments recalculated
- Bilingual switch mid-lesson → prefer content locale variant if available

### 10.5 V1 Acceptance Criteria (Learning)

- Student can complete an assigned bilingual STEM lesson end-to-end
- Teacher can see completion status per student
- Parent can see high-level completion for linked students
- Progress persists across sessions

---

## 11. Assessment Workflow

### 11.1 Purpose

Measure learning via quizzes/tests with transparent results and gradebook visibility.

### 11.2 Actors

Teacher/Coordinator, Student, Parent (policy-based), Admin

### 11.3 Primary Flow

1. **Author:** Teacher creates questions in bank (AR/EN) and composes assessment.
2. **Configure:** Set schedule window, attempts, time limit, grading method, visibility.
3. **Assign:** Publish to class/section/students.
4. **Notify:** Students (and parents if enabled) receive assessment available alert.
5. **Attempt:** Student takes assessment within rules; autosave where feasible.
6. **Score:** Auto-score objective items; queue subjective for manual grading.
7. **Release:** Results released per policy (immediate / after due / manual).
8. **Review:** Teacher analyzes item performance; student reviews allowed solutions per policy.
9. **Report:** Scores flow into progress/grade views.

### 11.4 Exception Flows

- Attempt interrupted → resume if within time/attempt policy
- Late submission → block or mark late per settings
- Academic integrity flags (basic): multiple simultaneous sessions optional Should

### 11.5 V1 Acceptance Criteria (Assessment)

- MCQ assessment can be created, assigned, taken, auto-scored, and reported
- Manual grading path exists for short text
- Role-based result visibility enforced

---

## 12. Tutoring Workflow

### 12.1 Purpose

Deliver bilingual live tutoring with scheduling, attendance, and session outcomes.

### 12.2 Actors

Tutor, Student, Parent, Campus/School Admin, Teacher (optional referral)

### 12.3 Primary Flow

1. **Capacity:** Tutor sets availability; admin defines tutoring subjects/languages/packages.
2. **Request/Book:** Parent or authorized student books session (subject, language AR/EN, time).
3. **Confirm:** Tutor/system confirms; calendar holds created; notifications sent.
4. **Prepare:** Participants receive reminder notifications; join link issued.
5. **Conduct:** Session marked in-progress; live meeting via configured provider.
6. **Close:** Tutor marks completed, records attendance, notes, follow-up recommendations.
7. **Consume:** Package minutes/sessions decremented if packages enabled.
8. **Follow-up:** Parent/student see notes; optional next booking suggested.

### 12.4 Exception Flows

- Cancellation by parent/tutor within policy → notify parties; restore package credit if applicable
- No-show → status recorded; policy-based fee/credit rules
- Tutor conflict → reassignment workflow for admin

### 12.5 V1 Acceptance Criteria (Tutoring)

- End-to-end booking → reminder → complete → notes visible to parent/student
- Language preference captured and displayed
- Multi-campus scheduling respects timezone settings

---

## 13. Parent Workflow

### 13.1 Purpose

Give guardians actionable visibility and tutoring control without exposing unnecessary institutional admin functions.

### 13.2 Primary Flow

1. Parent logs in (AR/EN).
2. Selects linked child (if multiple).
3. Views dashboard: learning progress, upcoming assessments, tutoring schedule, alerts.
4. Opens detailed progress / assessment results (per policy).
5. Books or requests tutoring; manages cancellations per rules.
6. Receives notifications (in-app/email).
7. Updates profile, language, and notification preferences.

### 13.3 Acceptance Criteria

- Parent sees only linked students’ data
- Booking and monitoring flows usable on mobile web
- Bilingual UI complete for parent-critical screens

---

## 14. Teacher Workflow

### 14.1 Purpose

Enable teachers to deliver STEM instruction, assess learners, and monitor class health.

### 14.2 Primary Flow

1. Teacher logs in and lands on class dashboard.
2. Reviews assigned classes/subjects/campuses.
3. Publishes or assigns learning content/pathways.
4. Creates and schedules assessments.
5. Monitors completion and scores; intervenes with assignments/messages.
6. Grades subjective submissions.
7. Optionally refers students to tutoring.
8. Communicates announcements to class.
9. Exports/prints class reports as needed.

### 14.3 Acceptance Criteria

- Teacher scoped only to assigned entities
- Can complete assign → assess → review loop without admin help
- Class analytics visible within acceptable performance targets

---

## 15. Notification Workflow

### 15.1 Event Catalog (V1 Core)

| Event | Typical Recipients | Channels |
| --- | --- | --- |
| Account invited / password reset | User | Email |
| Learning content assigned | Student, Parent (optional) | In-app, Email |
| Assessment available / due soon / graded | Student, Parent (optional), Teacher | In-app, Email |
| Tutoring booked / reminder / cancelled / completed | Student, Parent, Tutor | In-app, Email |
| Announcement published | Targeted roles | In-app, Email |
| Progress milestone (optional) | Student, Parent | In-app |

### 15.2 Processing Flow

1. Domain event emitted by application service.
2. Notification service resolves recipients by role, linkage, and preferences.
3. Message rendered in recipient language (AR/EN).
4. Delivered to in-app store and/or email queue.
5. Delivery status logged; failures retried with backoff.
6. User marks in-app notifications read.

### 15.3 Acceptance Criteria

- Critical tutoring and assessment events deliver in-app + email
- Locale-correct templates
- Tenant branding supported in email where feasible

---

## 16. Security

### 16.1 Security Objectives

- Confidentiality of student/parent/institution data
- Integrity of grades, assessments, and attendance records
- Availability of learning and tutoring services
- Accountability via audit trails

### 16.2 Security Requirements

| ID | Requirement |
| --- | --- |
| SEC-01 | TLS for all production traffic |
| SEC-02 | Password hashing with modern algorithms (framework defaults / Argon2|bcrypt) |
| SEC-03 | Sanctum-based auth for SPA/API; CSRF protections for cookie-based SPA auth |
| SEC-04 | RBAC enforced server-side on every sensitive operation |
| SEC-05 | Strict tenant isolation on all queries and file paths |
| SEC-06 | Input validation / output encoding to prevent injection/XSS |
| SEC-07 | Rate limiting on auth and sensitive endpoints |
| SEC-08 | Secure file upload validation (type/size/malware policy as operationally feasible) |
| SEC-09 | Audit logs for login anomalies, permission changes, grade overrides, exports |
| SEC-10 | Principle of least privilege for admin impersonation/support tools |
| SEC-11 | Secrets never stored in source control |
| SEC-12 | Session timeout and concurrent session policies for privileged roles |

### 16.3 Child Safety Considerations

- Guardian linkage for minor accounts
- Minimize public profiles and PII exposure
- Control student-to-student communication features (default restrictive in V1)
- Report/escalation path for safeguarding concerns (process + basic in-app reporting Could)

---

## 17. Compliance

### 17.1 Regional & Regulatory Posture (V1 Design Intent)

The product shall be designed to support compliance expectations relevant to KSA and UAE private education SaaS operations, including:

- Personal data protection principles (lawful basis, purpose limitation, retention, access/deletion requests)
- Cross-border data transfer controls as required by deployment model
- Education-sector expectations for student data confidentiality
- Record retention for grades/attendance/audit as configured by tenant policy and law

> **Note:** Formal legal review is required before production launch. This SRS defines product capabilities and controls; it is not legal advice.

### 17.2 Compliance-Enabling Features

| ID | Capability |
| --- | --- |
| CMP-01 | Data subject access / export support for user profiles and learning records |
| CMP-02 | Account deactivation and controlled deletion workflows |
| CMP-03 | Configurable retention policies (platform default + tenant overrides where allowed) |
| CMP-04 | Consent/guardian acknowledgment records for minor onboarding |
| CMP-05 | Auditability of admin access to student records |
| CMP-06 | Privacy policy / terms acceptance tracking at registration |
| CMP-07 | Country-aware data residency planning (architecture supports future region pinning) |

### 17.3 Accessibility & Inclusive Design

- Bilingual UX
- Keyboard-accessible core flows target
- Sufficient color contrast in default theme

---

## 18. Scalability

### 18.1 Scale Dimensions

- Tenants (schools / centers)
- Schools and campuses per tenant
- Concurrent learners during peak periods
- Concurrent tutoring sessions
- Media/file storage growth
- Notification throughput

### 18.2 V1 Scalability Requirements

| ID | Requirement |
| --- | --- |
| SCL-01 | Tenant-aware data model and indexes from day one |
| SCL-02 | Avoid noisy-neighbor failure via per-tenant rate limits / quotas (basic) |
| SCL-03 | Background queues for email, notifications, imports, scoring jobs |
| SCL-04 | Pagination and filtered queries on all list endpoints |
| SCL-05 | Local storage organization by tenant/school with backup strategy |
| SCL-06 | Stateless application design to allow multiple PHP-FPM / container nodes |
| SCL-07 | Capacity planning documentation for MySQL and storage growth |
| SCL-08 | API design that does not require breaking changes for initial mobile clients |

### 18.3 Performance Test Targets (pre-launch)

- Concurrent authenticated users: define per pilot size (e.g., 500 / 2,000) during test plan phase
- Tutoring peak: N concurrent session joins without booking deadlock
- Bulk CSV import of students within agreed time window

---

## 19. Future Enhancements (Post–Version 1)

| ID | Enhancement | Rationale |
| --- | --- | --- |
| FE-01 | Native iOS / Android apps using existing APIs | Mobile-first parent/student usage |
| FE-02 | Advanced AI tutoring assistant / content recommendations | Personalization at scale |
| FE-03 | Deeper GCC ministry/curriculum framework packs | Faster school onboarding |
| FE-04 | Marketplace for verified STEM content partners | Ecosystem growth |
| FE-05 | Object storage (S3-compatible) & CDN | Scale media beyond local disk |
| FE-06 | Real-time classroom engagement analytics | Teacher actionability |
| FE-07 | Proctoring / integrity tooling | High-stakes assessments |
| FE-08 | WhatsApp / SMS notification channels | Regional parent reach |
| FE-09 | Multi-currency billing & payment gateway automation | Self-serve SaaS expansion |
| FE-10 | Additional countries / languages | Regional expansion beyond KSA/UAE |
| FE-11 | Robotics / lab inventory & equipment booking | STEM lab operations |
| FE-12 | SSO (SAML/OIDC) for enterprise schools | IT procurement requirements |

---

## 20. Data Entities (Conceptual)

Core entities for V1 design (logical, not schema):

- Tenant, Country, School, Campus
- User, Role, Permission, ParentStudentLink
- AcademicYear, Grade, Class, Section, Subject
- CurriculumFramework, StandardNode, ContentItem, Lesson, Pathway, Assignment
- Question, Assessment, Attempt, Response, Score
- TutorProfile, AvailabilitySlot, TutoringPackage, TutoringSession, SessionAttendance, SessionNote
- Notification, Announcement, AuditLog, MediaAsset
- Subscription / Entitlement (basic)

---

## 21. Assumptions & Dependencies

1. Live meeting provider (Zoom, Teams, Meet, or WebRTC) will be selected during detailed design.
2. GCC curriculum alignment will start with a configurable mapping model plus an initial content pack strategy (licensed or in-house)—exact standards packs TBD with academic SMEs.
3. Local storage is acceptable for V1 pilots; production HA may still use networked disk / backup regimens.
4. Payments may be manual/invoice-led initially; automated billing is Should/Could.
5. Schools will provide authoritative student rosters and guardian contacts.
6. No native mobile apps in V1; mobile web is required.

---

## 22. Risks & Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Curriculum misalignment | Low adoption | SME review; configurable mapping; pilot schools |
| Tutoring no-shows | Revenue/trust loss | Reminders, policies, attendance tracking |
| Tenant data leakage | Severe | Automated isolation tests; code review gates |
| Arabic/RTL UI gaps | Market rejection | I18n/RTL acceptance tests on every module |
| Local storage limits | Ops incidents | Quotas, monitoring, backup, FE-05 path |
| Scope creep into full LMS/ERP | Delay | Strict V1 module boundaries |

---

## 23. Acceptance & Approval

### 23.1 Definition of Ready for Implementation

- This SRS approved by business owner
- Meeting provider decision recorded
- Initial curriculum pack approach confirmed
- Non-functional targets accepted for pilot scale

### 23.2 Approval Sign-Off

| Role | Name | Signature | Date |
| --- | --- | --- | --- |
| Business Owner | | | |
| Product Owner | | | |
| Engineering Lead | | | |
| Academic / Curriculum Lead | | | |
| Security / Compliance Reviewer | | | |

---

## 24. Next Steps (After Approval Only)

1. Produce Solution Architecture Document (tenancy, ERD, API style guide).
2. Produce UX sitemap & key wireflows (Learning, Assessment, Tutoring, Parent).
3. Produce Sprint-0 backlog and MVP cut line inside V1 Must requirements.
4. Begin Laravel + React project scaffolding **only after written approval**.

---

**End of Document — Status: APPROVED — IMPLEMENTATION AUTHORIZED**
