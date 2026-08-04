<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('lesson_plans')) {
            Schema::create('lesson_plans', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->unsignedBigInteger('school_id');
                $table->unsignedBigInteger('teacher_user_id');
                $table->unsignedBigInteger('subject_id')->nullable();
                $table->unsignedBigInteger('class_section_id')->nullable();
                $table->unsignedBigInteger('curriculum_lesson_id')->nullable();
                $table->string('title_en');
                $table->string('title_ar')->nullable();
                $table->date('planned_on')->nullable();
                $table->unsignedSmallInteger('duration_minutes')->nullable();
                $table->text('objectives')->nullable();
                $table->text('materials')->nullable();
                $table->text('activities')->nullable();
                $table->text('assessment_notes')->nullable();
                $table->text('homework_notes')->nullable();
                $table->string('status', 32)->default('draft');
                $table->timestamps();
                $table->softDeletes();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();

                $table->index(['tenant_id', 'school_id', 'status']);
                $table->index(['teacher_user_id', 'planned_on']);
            });
        }

        if (! Schema::hasTable('class_attendance')) {
            Schema::create('class_attendance', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->unsignedBigInteger('school_id');
                $table->unsignedBigInteger('class_section_id');
                $table->unsignedBigInteger('student_user_id');
                $table->unsignedBigInteger('subject_id')->nullable();
                $table->date('attendance_date');
                $table->string('status', 32)->default('present');
                $table->string('notes', 500)->nullable();
                $table->unsignedBigInteger('marked_by')->nullable();
                $table->timestamps();
                $table->softDeletes();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();

                $table->unique(
                    ['class_section_id', 'student_user_id', 'attendance_date'],
                    'class_attendance_unique_day'
                );
                $table->index(['tenant_id', 'school_id', 'attendance_date']);
            });
        }

        if (! Schema::hasTable('staff_messages')) {
            Schema::create('staff_messages', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->unsignedBigInteger('school_id');
                $table->unsignedBigInteger('sender_user_id');
                $table->unsignedBigInteger('recipient_user_id');
                $table->string('subject');
                $table->text('body');
                $table->string('category', 32)->default('general');
                $table->timestamp('read_at')->nullable();
                $table->timestamps();
                $table->softDeletes();

                $table->index(['tenant_id', 'recipient_user_id', 'read_at']);
                $table->index(['tenant_id', 'sender_user_id']);
            });
        }

        // Distinguishes daily homework from graded project work on the shared table.
        if (Schema::hasTable('assignments') && ! Schema::hasColumn('assignments', 'assignment_kind')) {
            Schema::table('assignments', function (Blueprint $table) {
                $table->string('assignment_kind', 32)->default('homework')->after('status');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('staff_messages');
        Schema::dropIfExists('class_attendance');
        Schema::dropIfExists('lesson_plans');
    }
};
