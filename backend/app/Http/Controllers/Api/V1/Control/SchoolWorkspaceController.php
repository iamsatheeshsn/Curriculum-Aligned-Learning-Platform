<?php

namespace App\Http\Controllers\Api\V1\Control;

use App\Domain\Identity\Services\RbacService;
use App\Domain\Organization\Services\ControlSchoolWorkspaceService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SchoolWorkspaceController extends Controller
{
    public function __construct(
        protected ControlSchoolWorkspaceService $workspace,
        protected RbacService $rbac,
    ) {}

    protected function guard(): void
    {
        $user = request()->user();
        abort_unless(
            $user?->hasRole('super_admin')
                || $user?->hasRole('school_owner')
                || $this->rbac->can($user, 'tenant.schools.manage')
                || $this->rbac->can($user, 'school.users.manage')
                || $this->rbac->can($user, 'school.settings.manage')
                || $this->rbac->can($user, 'platform.tenants.manage'),
            403
        );
    }

    protected function schoolId(Request $request): ?int
    {
        return $request->integer('school_id') ?: null;
    }

    public function listStaff(Request $request): JsonResponse
    {
        $this->guard();
        $id = $this->schoolId($request);

        return response()->json([
            'data' => $this->workspace->listStaff($request->only(['search', 'status']), $id),
            'meta' => ['stats' => $this->workspace->staffStats($id)],
        ]);
    }

    public function createStaff(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'min:8'],
            'first_name' => ['required', 'string', 'max:191'],
            'last_name' => ['nullable', 'string', 'max:191'],
            'role' => ['nullable', 'string'],
            'status' => ['nullable', 'string'],
        ]);

        return response()->json([
            'message' => 'Employee created.',
            'data' => $this->workspace->createStaff($data, $this->schoolId($request), (int) $request->user()->id),
        ], 201);
    }

    public function updateStaff(Request $request, int $id): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'first_name' => ['sometimes', 'string', 'max:191'],
            'last_name' => ['nullable', 'string', 'max:191'],
            'role' => ['nullable', 'string'],
            'status' => ['nullable', 'string'],
        ]);

        return response()->json([
            'message' => 'Employee updated.',
            'data' => $this->workspace->updateStaff($id, $data, $this->schoolId($request), (int) $request->user()->id),
        ]);
    }

    public function listStaffAttendance(Request $request): JsonResponse
    {
        $this->guard();
        $id = $this->schoolId($request);

        return response()->json([
            'data' => $this->workspace->listStaffAttendance($request->only(['search', 'status']), $id),
            'meta' => ['stats' => $this->workspace->attendanceStats($id)],
        ]);
    }

    public function createStaffAttendance(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'user_id' => ['required', 'integer'],
            'attendance_date' => ['required', 'date'],
            'status' => ['required', 'in:present,absent,late,leave'],
            'notes' => ['nullable', 'string'],
        ]);

        return response()->json([
            'message' => 'Attendance recorded.',
            'data' => $this->workspace->createStaffAttendance($data, $this->schoolId($request), (int) $request->user()->id),
        ], 201);
    }

    public function updateStaffAttendance(Request $request, int $id): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'user_id' => ['sometimes', 'integer'],
            'attendance_date' => ['sometimes', 'date'],
            'status' => ['sometimes', 'in:present,absent,late,leave'],
            'notes' => ['nullable', 'string'],
        ]);

        return response()->json([
            'message' => 'Attendance updated.',
            'data' => $this->workspace->updateStaffAttendance($id, $data, $this->schoolId($request), (int) $request->user()->id),
        ]);
    }

    public function listCourses(Request $request): JsonResponse
    {
        $this->guard();
        $id = $this->schoolId($request);

        return response()->json([
            'data' => $this->workspace->listCourses($request->only(['search', 'status']), $id),
            'meta' => ['stats' => $this->workspace->courseStats($id)],
        ]);
    }

    public function createCourse(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'code' => ['required', 'string', 'max:64'],
            'title_en' => ['required', 'string', 'max:191'],
            'title_ar' => ['nullable', 'string', 'max:191'],
            'subject_id' => ['nullable', 'integer'],
            'description' => ['nullable', 'string'],
            'status' => ['nullable', 'in:active,archived'],
        ]);

        return response()->json([
            'message' => 'Course created.',
            'data' => $this->workspace->createCourse($data, $this->schoolId($request), (int) $request->user()->id),
        ], 201);
    }

    public function updateCourse(Request $request, int $id): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'code' => ['sometimes', 'string', 'max:64'],
            'title_en' => ['sometimes', 'string', 'max:191'],
            'title_ar' => ['nullable', 'string', 'max:191'],
            'subject_id' => ['nullable', 'integer'],
            'description' => ['nullable', 'string'],
            'status' => ['nullable', 'in:active,archived'],
        ]);

        return response()->json([
            'message' => 'Course updated.',
            'data' => $this->workspace->updateCourse($id, $data, $this->schoolId($request), (int) $request->user()->id),
        ]);
    }

    public function deleteCourse(Request $request, int $id): JsonResponse
    {
        $this->guard();
        $this->workspace->deleteCourse($id, $this->schoolId($request));

        return response()->json(['message' => 'Course deleted.']);
    }

    public function listLessons(Request $request): JsonResponse
    {
        $this->guard();
        $id = $this->schoolId($request);

        return response()->json([
            'data' => $this->workspace->listLessons($request->only(['search', 'status']), $id),
            'meta' => ['stats' => $this->workspace->lessonStats($id)],
        ]);
    }

    public function createLesson(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'course_id' => ['required', 'integer'],
            'title_en' => ['required', 'string', 'max:191'],
            'title_ar' => ['nullable', 'string', 'max:191'],
            'sort_order' => ['nullable', 'integer'],
            'duration_minutes' => ['nullable', 'integer'],
            'status' => ['nullable', 'in:active,archived'],
        ]);

        return response()->json([
            'message' => 'Lesson created.',
            'data' => $this->workspace->createLesson($data, $this->schoolId($request), (int) $request->user()->id),
        ], 201);
    }

    public function updateLesson(Request $request, int $id): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'course_id' => ['sometimes', 'integer'],
            'title_en' => ['sometimes', 'string', 'max:191'],
            'title_ar' => ['nullable', 'string', 'max:191'],
            'sort_order' => ['nullable', 'integer'],
            'duration_minutes' => ['nullable', 'integer'],
            'status' => ['nullable', 'in:active,archived'],
        ]);

        return response()->json([
            'message' => 'Lesson updated.',
            'data' => $this->workspace->updateLesson($id, $data, $this->schoolId($request), (int) $request->user()->id),
        ]);
    }

    public function deleteLesson(Request $request, int $id): JsonResponse
    {
        $this->guard();
        $this->workspace->deleteLesson($id, $this->schoolId($request));

        return response()->json(['message' => 'Lesson deleted.']);
    }

    public function listResources(Request $request): JsonResponse
    {
        $this->guard();
        $id = $this->schoolId($request);

        return response()->json([
            'data' => $this->workspace->listResources($request->only(['search', 'status']), $id),
            'meta' => ['stats' => $this->workspace->resourceStats($id)],
        ]);
    }

    public function createResource(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'title_en' => ['required', 'string', 'max:191'],
            'title_ar' => ['nullable', 'string', 'max:191'],
            'resource_type' => ['required', 'in:file,link,video'],
            'url' => ['nullable', 'string', 'max:500'],
            'subject_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'in:active,archived'],
        ]);

        return response()->json([
            'message' => 'Resource created.',
            'data' => $this->workspace->createResource($data, $this->schoolId($request), (int) $request->user()->id),
        ], 201);
    }

    public function updateResource(Request $request, int $id): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'title_en' => ['sometimes', 'string', 'max:191'],
            'title_ar' => ['nullable', 'string', 'max:191'],
            'resource_type' => ['sometimes', 'in:file,link,video'],
            'url' => ['nullable', 'string', 'max:500'],
            'subject_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'in:active,archived'],
        ]);

        return response()->json([
            'message' => 'Resource updated.',
            'data' => $this->workspace->updateResource($id, $data, $this->schoolId($request), (int) $request->user()->id),
        ]);
    }

    public function deleteResource(Request $request, int $id): JsonResponse
    {
        $this->guard();
        $this->workspace->deleteResource($id, $this->schoolId($request));

        return response()->json(['message' => 'Resource deleted.']);
    }

    public function listAssignments(Request $request): JsonResponse
    {
        $this->guard();
        $id = $this->schoolId($request);

        return response()->json([
            'data' => $this->workspace->listAssignments($request->only(['search', 'status']), $id),
            'meta' => ['stats' => $this->workspace->assignmentStats($id)],
        ]);
    }

    public function createAssignment(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'title_en' => ['required', 'string', 'max:191'],
            'title_ar' => ['nullable', 'string', 'max:191'],
            'subject_id' => ['nullable', 'integer'],
            'class_section_id' => ['nullable', 'integer'],
            'due_at' => ['nullable', 'date'],
            'max_score' => ['nullable', 'numeric'],
            'status' => ['nullable', 'string'],
        ]);

        return response()->json([
            'message' => 'Assignment created.',
            'data' => $this->workspace->createAssignment($data, $this->schoolId($request), (int) $request->user()->id),
        ], 201);
    }

    public function updateAssignment(Request $request, int $id): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'title_en' => ['sometimes', 'string', 'max:191'],
            'title_ar' => ['nullable', 'string', 'max:191'],
            'subject_id' => ['nullable', 'integer'],
            'class_section_id' => ['nullable', 'integer'],
            'due_at' => ['nullable', 'date'],
            'max_score' => ['nullable', 'numeric'],
            'status' => ['nullable', 'string'],
        ]);

        return response()->json([
            'message' => 'Assignment updated.',
            'data' => $this->workspace->updateAssignment($id, $data, $this->schoolId($request), (int) $request->user()->id),
        ]);
    }

    public function deleteAssignment(Request $request, int $id): JsonResponse
    {
        $this->guard();
        $this->workspace->deleteAssignment($id, $this->schoolId($request));

        return response()->json(['message' => 'Assignment deleted.']);
    }

    public function listHomework(Request $request): JsonResponse
    {
        $this->guard();
        $id = $this->schoolId($request);

        return response()->json([
            'data' => $this->workspace->listHomework($request->only(['search', 'status']), $id),
            'meta' => ['stats' => $this->workspace->homeworkStats($id)],
        ]);
    }

    public function createHomework(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'title_en' => ['required', 'string', 'max:191'],
            'title_ar' => ['nullable', 'string', 'max:191'],
            'instructions_en' => ['nullable', 'string'],
            'subject_id' => ['nullable', 'integer'],
            'class_section_id' => ['nullable', 'integer'],
            'due_at' => ['nullable', 'date'],
            'status' => ['nullable', 'string'],
        ]);

        return response()->json([
            'message' => 'Homework created.',
            'data' => $this->workspace->createHomework($data, $this->schoolId($request), (int) $request->user()->id),
        ], 201);
    }

    public function updateHomework(Request $request, int $id): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'title_en' => ['sometimes', 'string', 'max:191'],
            'title_ar' => ['nullable', 'string', 'max:191'],
            'instructions_en' => ['nullable', 'string'],
            'subject_id' => ['nullable', 'integer'],
            'class_section_id' => ['nullable', 'integer'],
            'due_at' => ['nullable', 'date'],
            'status' => ['nullable', 'string'],
        ]);

        return response()->json([
            'message' => 'Homework updated.',
            'data' => $this->workspace->updateHomework($id, $data, $this->schoolId($request), (int) $request->user()->id),
        ]);
    }

    public function deleteHomework(Request $request, int $id): JsonResponse
    {
        $this->guard();
        $this->workspace->deleteHomework($id, $this->schoolId($request));

        return response()->json(['message' => 'Homework deleted.']);
    }

    public function listQuestions(Request $request): JsonResponse
    {
        $this->guard();
        $id = $this->schoolId($request);

        return response()->json([
            'data' => $this->workspace->listQuestions($request->only(['search', 'status']), $id),
            'meta' => ['stats' => $this->workspace->questionStats($id)],
        ]);
    }

    public function createQuestion(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'stem_en' => ['required', 'string'],
            'stem_ar' => ['nullable', 'string'],
            'type' => ['required', 'string'],
            'difficulty' => ['nullable', 'string'],
            'subject_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'string'],
        ]);

        return response()->json([
            'message' => 'Question created.',
            'data' => $this->workspace->createQuestion($data, $this->schoolId($request), (int) $request->user()->id),
        ], 201);
    }

    public function updateQuestion(Request $request, int $id): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'stem_en' => ['sometimes', 'string'],
            'stem_ar' => ['nullable', 'string'],
            'type' => ['sometimes', 'string'],
            'difficulty' => ['nullable', 'string'],
            'subject_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'string'],
        ]);

        return response()->json([
            'message' => 'Question updated.',
            'data' => $this->workspace->updateQuestion($id, $data, $this->schoolId($request), (int) $request->user()->id),
        ]);
    }

    public function deleteQuestion(Request $request, int $id): JsonResponse
    {
        $this->guard();
        $this->workspace->deleteQuestion($id, $this->schoolId($request));

        return response()->json(['message' => 'Question deleted.']);
    }

    public function listQuizzes(Request $request): JsonResponse
    {
        $this->guard();
        $id = $this->schoolId($request);

        return response()->json([
            'data' => $this->workspace->listAssessments('quiz', $request->only(['search', 'status']), $id),
            'meta' => ['stats' => $this->workspace->assessmentStats('quiz', $id)],
        ]);
    }

    public function createQuiz(Request $request): JsonResponse
    {
        return $this->storeAssessment($request, 'quiz');
    }

    public function updateQuiz(Request $request, int $id): JsonResponse
    {
        return $this->patchAssessment($request, $id);
    }

    public function deleteQuiz(Request $request, int $id): JsonResponse
    {
        $this->guard();
        $this->workspace->deleteAssessment($id, $this->schoolId($request));

        return response()->json(['message' => 'Quiz deleted.']);
    }

    public function listExams(Request $request): JsonResponse
    {
        $this->guard();
        $id = $this->schoolId($request);

        return response()->json([
            'data' => $this->workspace->listAssessments('exam', $request->only(['search', 'status']), $id),
            'meta' => ['stats' => $this->workspace->assessmentStats('exam', $id)],
        ]);
    }

    public function createExam(Request $request): JsonResponse
    {
        return $this->storeAssessment($request, 'exam');
    }

    public function updateExam(Request $request, int $id): JsonResponse
    {
        return $this->patchAssessment($request, $id);
    }

    public function deleteExam(Request $request, int $id): JsonResponse
    {
        $this->guard();
        $this->workspace->deleteAssessment($id, $this->schoolId($request));

        return response()->json(['message' => 'Exam deleted.']);
    }

    protected function storeAssessment(Request $request, string $type): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'title_en' => ['required', 'string', 'max:191'],
            'title_ar' => ['nullable', 'string', 'max:191'],
            'subject_id' => ['nullable', 'integer'],
            'term_id' => ['nullable', 'integer'],
            'time_limit_seconds' => ['nullable', 'integer'],
            'max_attempts' => ['nullable', 'integer'],
            'status' => ['nullable', 'string'],
        ]);

        return response()->json([
            'message' => ucfirst($type).' created.',
            'data' => $this->workspace->createAssessment($type, $data, $this->schoolId($request), (int) $request->user()->id),
        ], 201);
    }

    protected function patchAssessment(Request $request, int $id): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'title_en' => ['sometimes', 'string', 'max:191'],
            'title_ar' => ['nullable', 'string', 'max:191'],
            'subject_id' => ['nullable', 'integer'],
            'term_id' => ['nullable', 'integer'],
            'time_limit_seconds' => ['nullable', 'integer'],
            'max_attempts' => ['nullable', 'integer'],
            'status' => ['nullable', 'string'],
        ]);

        return response()->json([
            'message' => 'Assessment updated.',
            'data' => $this->workspace->updateAssessment($id, $data, $this->schoolId($request), (int) $request->user()->id),
        ]);
    }

    public function listResults(Request $request): JsonResponse
    {
        $this->guard();
        $id = $this->schoolId($request);

        return response()->json([
            'data' => $this->workspace->listResults($id),
            'meta' => ['stats' => $this->workspace->resultStats($id)],
        ]);
    }

    public function listTutoringTutors(Request $request): JsonResponse
    {
        $this->guard();
        $id = $this->schoolId($request);

        return response()->json([
            'data' => $this->workspace->listTutoringTutors($id),
            'meta' => ['stats' => $this->workspace->tutoringTutorStats($id)],
        ]);
    }

    public function createTutoringTutor(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'min:8'],
            'first_name' => ['required', 'string', 'max:191'],
            'last_name' => ['nullable', 'string', 'max:191'],
            'hourly_rate' => ['nullable', 'numeric'],
            'status' => ['nullable', 'string'],
        ]);

        return response()->json([
            'message' => 'Tutor created.',
            'data' => $this->workspace->createTutoringTutor($data, $this->schoolId($request), (int) $request->user()->id),
        ], 201);
    }

    public function updateTutoringTutor(Request $request, int $id): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'first_name' => ['sometimes', 'string', 'max:191'],
            'last_name' => ['nullable', 'string', 'max:191'],
            'hourly_rate' => ['nullable', 'numeric'],
            'status' => ['nullable', 'string'],
        ]);

        return response()->json([
            'message' => 'Tutor updated.',
            'data' => $this->workspace->updateTutoringTutor($id, $data, $this->schoolId($request), (int) $request->user()->id),
        ]);
    }

    public function listBookings(Request $request): JsonResponse
    {
        $this->guard();
        $id = $this->schoolId($request);

        return response()->json([
            'data' => $this->workspace->listBookings($request->only(['status']), $id),
            'meta' => ['stats' => $this->workspace->bookingStats($id)],
        ]);
    }

    public function createBooking(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'tutor_user_id' => ['required', 'integer'],
            'student_user_id' => ['required', 'integer'],
            'starts_at' => ['required', 'date'],
            'ends_at' => ['nullable', 'date'],
            'subject_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'string'],
        ]);

        return response()->json([
            'message' => 'Session booked.',
            'data' => $this->workspace->createBooking($data, $this->schoolId($request), (int) $request->user()->id),
        ], 201);
    }

    public function updateBooking(Request $request, int $id): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'tutor_user_id' => ['sometimes', 'integer'],
            'student_user_id' => ['sometimes', 'integer'],
            'starts_at' => ['sometimes', 'date'],
            'ends_at' => ['nullable', 'date'],
            'subject_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'string'],
        ]);

        return response()->json([
            'message' => 'Booking updated.',
            'data' => $this->workspace->updateBooking($id, $data, $this->schoolId($request), (int) $request->user()->id),
        ]);
    }

    public function listTimetable(Request $request): JsonResponse
    {
        $this->guard();
        $id = $this->schoolId($request);

        return response()->json([
            'data' => $this->workspace->listTimetable($id),
            'meta' => ['stats' => $this->workspace->timetableStats($id)],
        ]);
    }

    public function createTimetableSlot(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'day_of_week' => ['required'],
            'start_time' => ['required', 'string'],
            'end_time' => ['required', 'string'],
            'tutor_user_id' => ['required', 'integer'],
            'subject_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'string'],
        ]);

        return response()->json([
            'message' => 'Slot created.',
            'data' => $this->workspace->createTimetableSlot($data, $this->schoolId($request), (int) $request->user()->id),
        ], 201);
    }

    public function updateTimetableSlot(Request $request, int $id): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'day_of_week' => ['sometimes'],
            'start_time' => ['sometimes', 'string'],
            'end_time' => ['sometimes', 'string'],
            'tutor_user_id' => ['sometimes', 'integer'],
            'subject_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'string'],
        ]);

        return response()->json([
            'message' => 'Slot updated.',
            'data' => $this->workspace->updateTimetableSlot($id, $data, $this->schoolId($request), (int) $request->user()->id),
        ]);
    }

    public function deleteTimetableSlot(Request $request, int $id): JsonResponse
    {
        $this->guard();
        $this->workspace->deleteTimetableSlot($id, $this->schoolId($request));

        return response()->json(['message' => 'Slot deleted.']);
    }

    public function listFees(Request $request): JsonResponse
    {
        $this->guard();
        $id = $this->schoolId($request);

        return response()->json([
            'data' => $this->workspace->listFees($request->only(['status', 'search']), $id),
            'meta' => ['stats' => $this->workspace->feeStats($id)],
        ]);
    }

    public function createFee(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'student_user_id' => ['required', 'integer'],
            'number' => ['required', 'string', 'max:64'],
            'total' => ['required', 'numeric'],
            'currency' => ['nullable', 'string', 'max:3'],
            'due_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
            'status' => ['nullable', 'string'],
        ]);

        return response()->json([
            'message' => 'Invoice created.',
            'data' => $this->workspace->createFee($data, $this->schoolId($request), (int) $request->user()->id),
        ], 201);
    }

    public function updateFee(Request $request, int $id): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'student_user_id' => ['sometimes', 'integer'],
            'number' => ['sometimes', 'string', 'max:64'],
            'total' => ['sometimes', 'numeric'],
            'currency' => ['nullable', 'string', 'max:3'],
            'due_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
            'status' => ['nullable', 'string'],
        ]);

        return response()->json([
            'message' => 'Invoice updated.',
            'data' => $this->workspace->updateFee($id, $data, $this->schoolId($request), (int) $request->user()->id),
        ]);
    }

    public function listTutorPayments(Request $request): JsonResponse
    {
        $this->guard();
        $id = $this->schoolId($request);

        return response()->json([
            'data' => $this->workspace->listTutorPayments($request->only(['status']), $id),
            'meta' => ['stats' => $this->workspace->tutorPaymentStats($id)],
        ]);
    }

    public function createTutorPayment(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'tutor_user_id' => ['required', 'integer'],
            'amount' => ['required', 'numeric'],
            'currency' => ['nullable', 'string', 'max:3'],
            'paid_at' => ['nullable', 'date'],
            'reference' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'status' => ['nullable', 'string'],
        ]);

        return response()->json([
            'message' => 'Payment recorded.',
            'data' => $this->workspace->createTutorPayment($data, $this->schoolId($request), (int) $request->user()->id),
        ], 201);
    }

    public function updateTutorPayment(Request $request, int $id): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'amount' => ['sometimes', 'numeric'],
            'currency' => ['nullable', 'string', 'max:3'],
            'paid_at' => ['nullable', 'date'],
            'reference' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'status' => ['nullable', 'string'],
        ]);

        return response()->json([
            'message' => 'Payment updated.',
            'data' => $this->workspace->updateTutorPayment($id, $data, $this->schoolId($request), (int) $request->user()->id),
        ]);
    }

    public function listExpenses(Request $request): JsonResponse
    {
        $this->guard();
        $id = $this->schoolId($request);

        return response()->json([
            'data' => $this->workspace->listExpenses($request->only(['status', 'search']), $id),
            'meta' => ['stats' => $this->workspace->expenseStats($id)],
        ]);
    }

    public function createExpense(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'title' => ['required', 'string', 'max:191'],
            'category' => ['required', 'string', 'max:64'],
            'amount' => ['required', 'numeric'],
            'currency' => ['nullable', 'string', 'max:3'],
            'spent_on' => ['required', 'date'],
            'notes' => ['nullable', 'string'],
            'status' => ['nullable', 'string'],
        ]);

        return response()->json([
            'message' => 'Expense created.',
            'data' => $this->workspace->createExpense($data, $this->schoolId($request), (int) $request->user()->id),
        ], 201);
    }

    public function updateExpense(Request $request, int $id): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:191'],
            'category' => ['sometimes', 'string', 'max:64'],
            'amount' => ['sometimes', 'numeric'],
            'currency' => ['nullable', 'string', 'max:3'],
            'spent_on' => ['sometimes', 'date'],
            'notes' => ['nullable', 'string'],
            'status' => ['nullable', 'string'],
        ]);

        return response()->json([
            'message' => 'Expense updated.',
            'data' => $this->workspace->updateExpense($id, $data, $this->schoolId($request), (int) $request->user()->id),
        ]);
    }

    public function deleteExpense(Request $request, int $id): JsonResponse
    {
        $this->guard();
        $this->workspace->deleteExpense($id, $this->schoolId($request));

        return response()->json(['message' => 'Expense deleted.']);
    }

    public function financeReports(Request $request): JsonResponse
    {
        $this->guard();

        return response()->json(['data' => $this->workspace->financeReport($this->schoolId($request))]);
    }

    public function academicReport(Request $request): JsonResponse
    {
        $this->guard();

        return response()->json(['data' => $this->workspace->academicReport($this->schoolId($request))]);
    }

    public function attendanceReport(Request $request): JsonResponse
    {
        $this->guard();

        return response()->json(['data' => $this->workspace->attendanceReport($this->schoolId($request))]);
    }

    public function revenueReport(Request $request): JsonResponse
    {
        $this->guard();

        return response()->json(['data' => $this->workspace->revenueReport($this->schoolId($request))]);
    }

    public function performanceReport(Request $request): JsonResponse
    {
        $this->guard();

        return response()->json(['data' => $this->workspace->performanceReport($this->schoolId($request))]);
    }

    public function listNotifications(Request $request): JsonResponse
    {
        $this->guard();
        $id = $this->schoolId($request);

        return response()->json([
            'data' => $this->workspace->listNotifications($id),
            'meta' => ['stats' => $this->workspace->notificationStats($id)],
        ]);
    }

    public function createNotification(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'title' => ['required', 'string', 'max:191'],
            'body' => ['required', 'string'],
            'channel' => ['nullable', 'string'],
            'audience' => ['nullable', 'string'],
        ]);

        return response()->json([
            'message' => 'Notification created.',
            'data' => $this->workspace->createNotification($data, $this->schoolId($request), (int) $request->user()->id),
        ], 201);
    }

    public function sendNotification(Request $request, int $id): JsonResponse
    {
        $this->guard();

        return response()->json([
            'message' => 'Notification sent.',
            'data' => $this->workspace->sendNotification($id, $this->schoolId($request), (int) $request->user()->id),
        ]);
    }

    public function listAuditLogs(Request $request): JsonResponse
    {
        $this->guard();
        $id = $this->schoolId($request);

        return response()->json([
            'data' => $this->workspace->listAuditLogs($request->only(['search']), $id),
            'meta' => ['stats' => $this->workspace->auditStats($id)],
        ]);
    }

    public function getOrganisation(Request $request): JsonResponse
    {
        $this->guard();

        return response()->json(['data' => $this->workspace->getOrganisation($this->schoolId($request))]);
    }

    public function updateOrganisation(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:191'],
            'timezone' => ['nullable', 'string', 'max:64'],
            'locale' => ['nullable', 'string', 'max:16'],
            'contact_email' => ['nullable', 'email'],
        ]);

        return response()->json([
            'message' => 'Organisation updated.',
            'data' => $this->workspace->updateOrganisation($data, $this->schoolId($request), (int) $request->user()->id),
        ]);
    }

    public function getBranding(Request $request): JsonResponse
    {
        $this->guard();

        return response()->json(['data' => $this->workspace->getBranding($this->schoolId($request))]);
    }

    public function updateBranding(Request $request): JsonResponse
    {
        $this->guard();
        $data = $request->validate([
            'primary_color' => ['nullable', 'string', 'max:32'],
            'secondary_color' => ['nullable', 'string', 'max:32'],
            'logo_url' => ['nullable', 'string', 'max:500'],
            'favicon_url' => ['nullable', 'string', 'max:500'],
            'app_name' => ['nullable', 'string', 'max:191'],
        ]);

        return response()->json([
            'message' => 'Branding updated.',
            'data' => $this->workspace->updateBranding($data, $this->schoolId($request), (int) $request->user()->id),
        ]);
    }
}
