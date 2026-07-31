<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('staff_attendance')) {
            Schema::create('staff_attendance', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id')->index();
                $table->unsignedBigInteger('school_id')->index();
                $table->unsignedBigInteger('user_id')->index();
                $table->date('attendance_date');
                $table->string('status', 32)->default('present');
                $table->text('notes')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();
                $table->softDeletes();
                $table->index(['school_id', 'attendance_date']);
            });
        }

        if (! Schema::hasTable('school_courses')) {
            Schema::create('school_courses', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id')->index();
                $table->unsignedBigInteger('school_id')->index();
                $table->string('code', 64);
                $table->string('title_en');
                $table->string('title_ar')->nullable();
                $table->unsignedBigInteger('subject_id')->nullable()->index();
                $table->text('description')->nullable();
                $table->string('status', 32)->default('active');
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (! Schema::hasTable('school_lessons')) {
            Schema::create('school_lessons', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id')->index();
                $table->unsignedBigInteger('school_id')->index();
                $table->unsignedBigInteger('course_id')->index();
                $table->string('title_en');
                $table->string('title_ar')->nullable();
                $table->unsignedInteger('sort_order')->default(0);
                $table->unsignedInteger('duration_minutes')->nullable();
                $table->string('status', 32)->default('active');
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (! Schema::hasTable('learning_resources')) {
            Schema::create('learning_resources', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id')->index();
                $table->unsignedBigInteger('school_id')->index();
                $table->string('title_en');
                $table->string('title_ar')->nullable();
                $table->string('resource_type', 32)->default('link');
                $table->string('url', 500)->nullable();
                $table->unsignedBigInteger('subject_id')->nullable();
                $table->string('status', 32)->default('active');
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (! Schema::hasTable('school_expenses')) {
            Schema::create('school_expenses', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id')->index();
                $table->unsignedBigInteger('school_id')->index();
                $table->string('category', 64);
                $table->string('title');
                $table->decimal('amount', 12, 2);
                $table->char('currency', 3)->default('SAR');
                $table->date('spent_on');
                $table->string('status', 32)->default('pending');
                $table->text('notes')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (! Schema::hasTable('school_notifications')) {
            Schema::create('school_notifications', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id')->index();
                $table->unsignedBigInteger('school_id')->nullable()->index();
                $table->string('title');
                $table->text('body');
                $table->string('channel', 32)->default('in_app');
                $table->string('audience', 32)->default('all');
                $table->string('status', 32)->default('draft');
                $table->timestamp('sent_at')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (! Schema::hasTable('tutoring_timetable_slots')) {
            Schema::create('tutoring_timetable_slots', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id')->index();
                $table->unsignedBigInteger('school_id')->index();
                $table->unsignedTinyInteger('day_of_week');
                $table->string('start_time', 16);
                $table->string('end_time', 16);
                $table->unsignedBigInteger('tutor_user_id')->index();
                $table->unsignedBigInteger('subject_id')->nullable();
                $table->string('status', 32)->default('active');
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (! Schema::hasTable('school_questions')) {
            Schema::create('school_questions', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id')->index();
                $table->unsignedBigInteger('school_id')->index();
                $table->text('stem_en');
                $table->text('stem_ar')->nullable();
                $table->string('type', 32)->default('mcq');
                $table->string('difficulty', 32)->default('medium');
                $table->unsignedBigInteger('subject_id')->nullable();
                $table->string('status', 32)->default('active');
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (Schema::hasTable('assignments') && ! Schema::hasColumn('assignments', 'assignment_kind')) {
            Schema::table('assignments', function (Blueprint $table) {
                $table->string('assignment_kind', 32)->default('homework')->nullable()->after('status');
            });
        }

        if (Schema::hasTable('tenants') && ! Schema::hasColumn('tenants', 'settings')) {
            Schema::table('tenants', function (Blueprint $table) {
                $table->json('settings')->nullable()->after('status');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('school_questions');
        Schema::dropIfExists('tutoring_timetable_slots');
        Schema::dropIfExists('school_notifications');
        Schema::dropIfExists('school_expenses');
        Schema::dropIfExists('learning_resources');
        Schema::dropIfExists('school_lessons');
        Schema::dropIfExists('school_courses');
        Schema::dropIfExists('staff_attendance');
    }
};
