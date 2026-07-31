<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('billing_coupons', function (Blueprint $table) {
            $table->id();
            $table->string('code', 64);
            $table->string('name_en', 191);
            $table->string('name_ar', 191)->nullable();
            $table->string('discount_type', 32)->default('percent'); // percent | fixed
            $table->decimal('discount_value', 12, 2);
            $table->char('currency', 3)->nullable();
            $table->unsignedInteger('max_redemptions')->nullable();
            $table->unsignedInteger('redemptions_count')->default(0);
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();

            $table->unique('code');
            $table->index('is_active');
        });

        Schema::create('billing_taxes', function (Blueprint $table) {
            $table->id();
            $table->string('code', 64);
            $table->string('name_en', 191);
            $table->string('name_ar', 191)->nullable();
            $table->decimal('rate_percent', 8, 4);
            $table->string('country_code', 2)->nullable();
            $table->boolean('is_inclusive')->default(false);
            $table->boolean('is_active')->default(true);
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();

            $table->unique('code');
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('billing_taxes');
        Schema::dropIfExists('billing_coupons');
    }
};
