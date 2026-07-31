<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_integrations', function (Blueprint $table) {
            $table->id();
            $table->string('category', 32); // payment, email, sms, video, ai
            $table->string('code', 64);
            $table->string('name_en', 191);
            $table->string('name_ar', 191)->nullable();
            $table->string('provider', 64)->nullable();
            $table->json('config_json')->nullable();
            $table->boolean('is_active')->default(false);
            $table->boolean('is_default')->default(false);
            $table->string('status', 32)->default('disconnected'); // connected, disconnected, error, testing
            $table->text('notes')->nullable();
            $table->timestamp('last_tested_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();

            $table->unique(['category', 'code']);
            $table->index(['category', 'is_active']);
        });

        Schema::create('platform_settings', function (Blueprint $table) {
            $table->id();
            $table->string('group_key', 64); // global, branding, localization, security, backup
            $table->string('setting_key', 96);
            $table->json('value_json')->nullable();
            $table->timestamps();
            $table->unsignedBigInteger('updated_by')->nullable();

            $table->unique(['group_key', 'setting_key']);
            $table->index('group_key');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_settings');
        Schema::dropIfExists('platform_integrations');
    }
};
