<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tutor_profiles', function (Blueprint $table) {
            if (! Schema::hasColumn('tutor_profiles', 'hourly_rate')) {
                $table->decimal('hourly_rate', 12, 2)->nullable()->after('bio_ar');
            }
        });
    }

    public function down(): void
    {
        Schema::table('tutor_profiles', function (Blueprint $table) {
            if (Schema::hasColumn('tutor_profiles', 'hourly_rate')) {
                $table->dropColumn('hourly_rate');
            }
        });
    }
};
