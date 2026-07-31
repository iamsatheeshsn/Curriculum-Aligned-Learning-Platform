<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('teaching_assignments')) {
            return;
        }

        Schema::create('teaching_assignments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('school_id');
            $table->unsignedBigInteger('teacher_user_id');
            $table->unsignedBigInteger('subject_id');
            $table->unsignedBigInteger('class_section_id');
            $table->unsignedBigInteger('academic_year_id');
            $table->string('status', 32)->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();

            $table->index(['tenant_id', 'school_id', 'status']);
            $table->index(['teacher_user_id', 'academic_year_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('teaching_assignments');
    }
};
