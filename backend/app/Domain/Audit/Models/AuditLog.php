<?php



namespace App\Domain\Audit\Models;



use App\Domain\Organization\Models\Tenant;

use App\Models\User;

use Illuminate\Database\Eloquent\Model;

use Illuminate\Database\Eloquent\Relations\BelongsTo;



class AuditLog extends Model

{

    public $timestamps = false;



    public const UPDATED_AT = null;



    protected $table = 'audit_logs';



    protected $fillable = [

        'tenant_id',

        'actor_user_id',

        'action',

        'auditable_type',

        'auditable_id',

        'properties',

        'ip_address',

        'user_agent',

        'created_at',

    ];



    protected function casts(): array

    {

        return [

            'properties' => 'array',

            'created_at' => 'datetime',

        ];

    }



    public function actor(): BelongsTo

    {

        return $this->belongsTo(User::class, 'actor_user_id');

    }



    public function tenant(): BelongsTo

    {

        return $this->belongsTo(Tenant::class);

    }

}


