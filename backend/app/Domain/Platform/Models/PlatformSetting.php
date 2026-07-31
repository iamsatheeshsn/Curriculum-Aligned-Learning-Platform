<?php



namespace App\Domain\Platform\Models;



use Illuminate\Database\Eloquent\Model;



class PlatformSetting extends Model

{

    protected $table = 'platform_settings';



    protected $fillable = [

        'group_key',

        'setting_key',

        'value_json',

        'updated_by',

    ];



    protected function casts(): array

    {

        return [

            'value_json' => 'array',

        ];

    }

}


