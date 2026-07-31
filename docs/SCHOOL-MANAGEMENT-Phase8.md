# Phase 8 — School Management

## K-12 STEM & Tutoring Platform

| Field | Value |
| --- | --- |
| **Status** | Implemented |
| **Date** | 29 July 2026 |
| **Base path** | `/api/v1/org/*` |
| **SQL** | `docs/sql/learning_platform_school_mgmt_phase8.sql` |

---

## 1. Modules Delivered

| Module | Storage | Notes |
| --- | --- | --- |
| Schools | `schools` | Tenant-scoped CRUD |
| Campuses | `campuses` | Per school |
| Classes | `school_classes` | Grade + academic year |
| Sections | `class_sections` | Optional link to class |
| Academic Calendar | `academic_years`, `terms`, `calendar_events` | Years/terms + events |
| Subjects | `subjects` | STEM flags |
| Timetable | `timetables`, `timetable_slots` | Weekly slots + overlap check |

---

## 2. API Map

All require `auth:sanctum` + `tenant.isolation` + `subscription.active`.  
Pass `school_id` query/body or header `X-School-ID` when multiple schools exist.

### Schools
| Method | Path | Permission |
| --- | --- | --- |
| GET/POST | `/org/schools` | view / `tenant.schools.manage` |
| GET/PUT/DELETE | `/org/schools/{id}` | view / settings / manage |

### Campuses
| Method | Path | Permission |
| --- | --- | --- |
| GET/POST | `/org/campuses` | `school.campuses.manage` |
| PUT/DELETE | `/org/campuses/{id}` | `school.campuses.manage` |

### Grades / Classes / Sections
| Method | Path |
| --- | --- |
| GET/POST | `/org/grades` |
| GET/POST | `/org/classes` |
| PUT/DELETE | `/org/classes/{id}` |
| GET/POST | `/org/sections` |
| PUT/DELETE | `/org/sections/{id}` |

Permission: `school.academics.manage`

### Academic Calendar
| Method | Path |
| --- | --- |
| GET/POST | `/org/academic-years` |
| POST | `/org/academic-years/{id}/set-current` |
| POST | `/org/academic-years/{id}/terms` |
| GET/POST | `/org/calendar-events` |
| PUT/DELETE | `/org/calendar-events/{id}` |

Event types: `general`, `holiday`, `exam`, `break`, `pd`, `other`

### Subjects
| Method | Path | Permission |
| --- | --- | --- |
| GET | `/org/subjects` | `curriculum.view` |
| POST/PUT/DELETE | `/org/subjects`… | `curriculum.manage` |

### Timetable
| Method | Path |
| --- | --- |
| GET/POST | `/org/timetables` |
| GET | `/org/timetables/{id}` |
| POST | `/org/timetables/{id}/slots` |
| DELETE | `/org/timetables/{id}/slots/{slot}` |
| POST | `/org/timetables/{id}/publish` |
| DELETE | `/org/timetables/{id}` |

Weekday: `0=Sunday` … `6=Saturday`. Slot overlap rejected.

---

## 3. Sample bootstrap sequence

1. Create/select school  
2. Create campus  
3. Create academic year (+ terms) → set current  
4. Create grades  
5. Create class → create section(s)  
6. Create subjects  
7. Create timetable + slots → publish  
8. Add calendar events (holidays/exams)

---

## 4. Key classes

- Models under `app/Domain/Academics` + `Campus`/`School`
- `SchoolContextService` — resolve active school
- Controllers in `Http/Controllers/Api/V1/Institution/`

---

**End of Phase 8**
