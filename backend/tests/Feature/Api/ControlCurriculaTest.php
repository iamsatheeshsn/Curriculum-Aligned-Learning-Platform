<?php

namespace Tests\Feature\Api;

use App\Domain\Curriculum\Models\Curriculum;
use App\Domain\Organization\Models\Country;
use Tests\TestCase;

class ControlCurriculaTest extends TestCase
{
    public function test_super_admin_can_manage_platform_curricula(): void
    {
        $auth = $this->loginAs('admin', 'superadmin@learning-platform.local', 'ChangeMe!123');
        $country = Country::query()->where('code', 'SA')->firstOrFail();

        $this->api('GET', '/control/curricula', [], $auth['headers'])
            ->assertOk()
            ->assertJsonStructure([
                'data',
                'meta' => ['stats'],
            ]);

        $create = $this->api('POST', '/control/curricula', [
            'country_id' => $country->id,
            'code' => 'STEM-PLATFORM-QA',
            'name_en' => 'Platform QA Framework',
            'name_ar' => 'إطار ضمان الجودة',
            'version' => '1.0',
            'change_summary_en' => 'Initial catalogue entry',
        ], $auth['headers'])
            ->assertCreated()
            ->assertJsonPath('data.code', 'STEM-PLATFORM-QA')
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.is_platform', true);

        $id = (int) $create->json('data.id');

        $this->api('PUT', '/control/curricula/'.$id, [
            'name_en' => 'Platform QA Core',
            'status' => 'in_review',
        ], $auth['headers'])
            ->assertOk()
            ->assertJsonPath('data.name_en', 'Platform QA Core')
            ->assertJsonPath('data.status', 'in_review');

        $this->api('POST', '/control/curricula/'.$id.'/publish', [
            'summary_en' => 'Ready for schools',
        ], $auth['headers'])
            ->assertOk()
            ->assertJsonPath('data.status', 'published');

        $version = $this->api('POST', '/control/curricula/'.$id.'/versions', [
            'version' => '1.1',
            'summary_en' => 'Next draft',
        ], $auth['headers'])
            ->assertCreated()
            ->assertJsonPath('data.version', '1.1')
            ->assertJsonPath('data.status', 'draft');

        $draftId = (int) $version->json('data.id');

        $this->api('DELETE', '/control/curricula/'.$draftId, [], $auth['headers'])
            ->assertOk();

        $this->assertSoftDeleted('curricula', ['id' => $draftId]);

        $ids = Curriculum::withTrashed()->where('code', 'STEM-PLATFORM-QA')->pluck('id');
        \App\Domain\Curriculum\Models\CurriculumVersionLog::query()
            ->where(function ($q) use ($ids) {
                $q->whereIn('curriculum_id', $ids)->orWhereIn('source_curriculum_id', $ids);
            })
            ->delete();
        Curriculum::withTrashed()->whereIn('id', $ids)->update(['source_curriculum_id' => null]);
        Curriculum::withTrashed()->whereIn('id', $ids)->forceDelete();
    }
}
