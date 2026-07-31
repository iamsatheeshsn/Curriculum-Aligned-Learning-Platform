<?php



namespace App\Domain\Platform\Models;



use App\Support\Traits\HasAuditColumns;

use Illuminate\Database\Eloquent\Model;

use Illuminate\Database\Eloquent\SoftDeletes;



class PlatformIntegration extends Model

{

    use HasAuditColumns;

    use SoftDeletes;



    protected $table = 'platform_integrations';



    protected $fillable = [

        'category',

        'code',

        'name_en',

        'name_ar',

        'provider',

        'config_json',

        'is_active',

        'is_default',

        'status',

        'notes',

        'last_tested_at',

        'created_by',

        'updated_by',

    ];



    protected function casts(): array

    {

        return [

            'config_json' => 'array',

            'is_active' => 'boolean',

            'is_default' => 'boolean',

            'last_tested_at' => 'datetime',

        ];

    }

}


