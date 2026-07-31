<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tenant_groups', function (Blueprint $table) {
            $table->id();
            $table->string('name', 191);
            $table->string('slug', 80)->unique();
            $table->string('description', 500)->nullable();
            $table->string('status', 32)->default('active'); // active|inactive
            $table->string('country_code', 2)->nullable();
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::table('tenants', function (Blueprint $table) {
            $table->foreignId('tenant_group_id')
                ->nullable()
                ->after('id')
                ->constrained('tenant_groups')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropConstrainedForeignId('tenant_group_id');
        });
        Schema::dropIfExists('tenant_groups');
    }
};
