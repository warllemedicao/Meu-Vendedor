import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('biblioteca de vídeos usa RLS, valida estados e isola versões por usuário', async () => {
  const db = new PGlite();
  const alice = '11111111-1111-4111-8111-111111111111';
  const bob = '22222222-2222-4222-8222-222222222222';
  const product = JSON.stringify({ name: 'Blusa feminina', description: '', price: '', features: '', affiliateLink: '', imageUrl: '', imageName: '' });
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated,anon,service_role;create table storage.buckets(id text primary key,name text not null,public boolean not null,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text not null,name text not null);alter table storage.objects enable row level security;create function storage.foldername(name text) returns text[] language sql immutable as $$select coalesce((string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1],array[]::text[])$$;grant usage on schema storage to authenticated,service_role;grant select,insert,update,delete on storage.objects to authenticated,service_role;`);
    for (const file of ['20261104000100_affiliate_base.sql', '20261104000200_marketplace_connections.sql', '20261105151156_video_generator.sql', '20261105172000_video_workflow.sql', '20261105225000_video_ai_processor.sql']) {
      await db.exec(await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8'));
    }
    const indexMigration = await readFile(new URL('../supabase/migrations/20261106020118_foreign_key_indexes.sql', import.meta.url), 'utf8');
    await db.exec(indexMigration);
    await db.exec(await readFile(new URL('../supabase/migrations/20261106022136_video_production_cache.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/20261106024913_free_only_video_routing.sql', import.meta.url), 'utf8'));
    await db.exec(indexMigration); // Reaplicação não duplica índices nem altera dados.
    const uncovered = await db.query(`select c.conname from pg_constraint c
      where c.contype = 'f' and c.connamespace = 'public'::regnamespace
      and not exists (select 1 from pg_index i where i.indrelid = c.conrelid
        and i.indisvalid and i.indisready
        and (i.indpred is null or pg_get_expr(i.indpred,i.indrelid) like '%IS NOT NULL%')
        and (i.indkey::smallint[])[0:cardinality(c.conkey)-1] @> c.conkey)`);
    assert.deepEqual(uncovered.rows, [], 'Toda chave estrangeira deve ter um índice cobridor');
    const bucketRows = await db.query("select id,public,file_size_limit from storage.buckets order by id");
    assert.deepEqual(bucketRows.rows, [
      { id: 'mv-video-assets', public: false, file_size_limit: 104857600 },
      { id: 'mv-video-scenes', public: false, file_size_limit: 104857600 },
    ]);
    await db.query('insert into auth.users(id) values($1),($2)', [alice, bob]);
    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [alice]);
    const insert = async (parent = null) => db.query(`insert into public.mv_video_projects(parent_id,product_data,presenter_id,voice_gender,voice_profile,emotional_tone,advertising_style,duration_seconds,aspect_ratio,generation_mode,target_audience,script,prompt,provider,status) values($1,$2::jsonb,'ana','feminina','natural','alegre','tradicional',15,'9:16','ai-video','','roteiro seguro com conteúdo suficiente','prompt seguro com conteúdo suficiente','mock','simulation_completed') returning id,user_id,parent_id`, [parent, product]);
    const first = (await insert()).rows[0];
    assert.equal(first.user_id, alice);
    const version = (await insert(first.id)).rows[0];
    assert.equal(version.parent_id, first.id);
    await assert.rejects(db.query("update public.mv_video_projects set status='completed' where id=$1", [first.id]), /permission denied/);
    await db.query("insert into storage.objects(bucket_id,name) values('mv-video-assets',$1)", [`${alice}/inputs/owned.webp`]);
    await db.query("insert into storage.objects(bucket_id,name) values('mv-video-assets',$1)", [`${alice}/outputs/demo.mp4`]);
    await assert.rejects(db.query("insert into public.mv_video_projects(product_data,presenter_id,voice_gender,voice_profile,emotional_tone,advertising_style,duration_seconds,aspect_ratio,generation_mode,target_audience,script,prompt,provider,status,result_url) values($1::jsonb,'ana','feminina','natural','alegre','tradicional',15,'9:16','ai-video','','roteiro seguro com conteúdo suficiente','prompt seguro com conteúdo suficiente','mock','completed','http://unsafe.test/video.mp4')", [product]), /check constraint|row-level security/);

    await db.query("insert into storage.objects(bucket_id,name) values('mv-video-assets',$1)", [`${alice}/inputs/photo.jpg`]);
    assert.equal((await db.query("select id from public.mv_video_scenes where template_id='wearing-product'")).rows.length, 2);

    const requestData = {
      templateId: 'wearing-product',
      scenePresetId: 'fashion-studio',
      durationSeconds: 8,
      format: '9:16',
      product: {
        imageStoragePath: `${alice}/inputs/photo.jpg`,
        aiReferenceStoragePath: `${alice}/inputs/product-reference.jpg`,
        aiReferenceWidth: 512,
        aiReferenceHeight: 384,
      },
      presenterReferenceStoragePath: `${alice}/inputs/presenter-reference.jpg`,
      presenterReferenceWidth: 410,
      presenterReferenceHeight: 512,
    };
    await db.exec('set role service_role');
    const enqueue = async (key, data = requestData, projectId = first.id) => db.query(
      'select public.mv_enqueue_video_job($1,$2,$3,$4::jsonb) as result',
      [alice, projectId, key, JSON.stringify(data)],
    );
    const job = (await enqueue('request-key-00000001')).rows[0].result;
    const duplicate = (await enqueue('request-key-00000001')).rows[0].result;
    assert.equal(duplicate.id, job.id);
    await assert.rejects(enqueue('request-key-00000001', { ...requestData, durationSeconds: 7 }), /idempotency_key_conflict/);
    await assert.rejects(enqueue('request-key-00000004', {
      ...requestData,
      presenterReferenceStoragePath: `${bob}/inputs/presenter-reference.jpg`,
    }, null), /invalid_video_ai_reference/);
    const secondJob = (await enqueue('request-key-00000002', requestData, version.id)).rows[0].result;
    const extraJobs = [];
    for (let i = 0; i < 3; i++) extraJobs.push((await enqueue(`request-extra-${String(i).padStart(6,'0')}`, requestData, null)).rows[0].result);
    extraJobs.push((await enqueue('request-limit-00000001', requestData, null)).rows[0].result); // Sem limite de admissão por tarefas em espera.
    for (const extra of extraJobs) await db.query('select public.mv_cancel_video_job($1,$2)', [alice, extra.id]);
    // A meta de 15 entregas/dia não pode ser bloqueada por tentativas que falharam.
    for (let i = 0; i < 16; i++) {
      const extra = (await enqueue(`request-daily-${String(i).padStart(6,'0')}`, requestData, null)).rows[0].result;
      await db.query("update public.mv_video_jobs set status='failed',stage='failed' where id=$1", [extra.id]);
    }
    await db.query("insert into public.mv_video_image_cache(user_id,cache_key,object_path,expires_at) values($1,$2,$3,now()+interval '30 days')", [alice, 'a'.repeat(64), `${alice}/intermediate/frame-reference.jpg`]);
    await assert.rejects(db.query("insert into public.mv_video_image_cache(user_id,cache_key,object_path,expires_at) values($1,$2,$3,now())", [alice, 'b'.repeat(64), `${bob}/intermediate/private.jpg`]), /check constraint/);

    await db.query(
      "select public.mv_transition_video_job($1,'processing',25,'modal','provider-job-1',null,null)",
      [job.id],
    );
    await assert.rejects(
      db.query("select public.mv_transition_video_job($1,'completed',100,'modal','provider-job-1',null,null)", [job.id]),
      /video_result_required/,
    );
    await db.query(
      "select public.mv_transition_video_job($1,'completed',100,'modal','provider-job-1',$2,null)",
      [job.id, `${alice}/outputs/generated.mp4`],
    );
    const completedProject = await db.query(
      'select status,provider,result_storage_path from public.mv_video_projects where id=$1',
      [first.id],
    );
    assert.deepEqual(completedProject.rows[0], {
      status: 'completed',
      provider: 'modal',
      result_storage_path: `${alice}/outputs/generated.mp4`,
    });
    const thirdProject = (await insert(first.id)).rows[0];
    const thirdJob = (await enqueue('request-key-00000003', requestData, thirdProject.id)).rows[0].result;
    await db.query('select public.mv_cancel_video_job($1,$2)', [alice, secondJob.id]);
    assert.equal((await db.query('select status from public.mv_video_projects where id=$1', [version.id])).rows[0].status, 'cancelled');
    await assert.rejects(
      db.query("select public.mv_transition_video_job($1,'completed',100,'modal',null,null,null)", [thirdJob.id]),
      /invalid_video_job_transition|video_result_required/,
    );
    const claimed = (await db.query('select public.mv_claim_video_job(90) as job')).rows[0].job;
    assert.equal(claimed.id, thirdJob.id);
    assert.equal(claimed.status, 'processing');
    await assert.rejects(
      db.query('select public.mv_advance_video_job($1,$2,$3,30)', [thirdJob.id, '00000000-0000-4000-8000-000000000000', 'image_ready']),
      /video_job_lease_lost/,
    );
    assert.equal((await db.query(
      'select public.mv_reserve_video_ai_budget($1,$2,$3,$4,$5,$6) as reserved',
      [thirdJob.id, 'image', 'cloudflare-workers-ai', 0.1, 1, 1],
    )).rows[0].reserved, true);
    assert.equal((await db.query(
      'select public.mv_reserve_video_ai_budget($1,$2,$3,$4,$5,$6) as reserved',
      [thirdJob.id, 'video', 'replicate', 0.95, 1, 1],
    )).rows[0].reserved, false);
    await db.query(
      'select public.mv_settle_video_ai_budget($1,$2,$3,$4,false)',
      [thirdJob.id, 'image', 'cloudflare-workers-ai', 0.08],
    );
    assert.equal((await db.query(
      'select public.mv_reserve_video_ai_budget($1,$2,$3,$4,$5,$6) as reserved',
      [thirdJob.id, 'video', 'replicate', 0.5, 1, 1],
    )).rows[0].reserved, true);
    assert.equal((await db.query(
      'select public.mv_settle_video_ai_budget($1,$2,$3,$4,false) as settled',
      [thirdJob.id, 'video', 'replicate', 0.6],
    )).rows[0].settled, false);
    assert.equal((await db.query(
      'select public.mv_reserve_video_ai_budget($1,$2,$3,$4,$5,$6) as reserved',
      [thirdJob.id, 'video', 'magic-hour', 0.4, 1, 1],
    )).rows[0].reserved, false);
    await db.query(
      "select public.mv_record_video_ai_attempt($1,'image','cloudflare-workers-ai','@cf/black-forest-labs/flux-2-dev','succeeded',null,0.1)",
      [thirdJob.id],
    );
    await db.query(
      "update public.mv_video_jobs set stage='video_submitting',lease_expires_at=now()-interval '1 second' where id=$1",
      [thirdJob.id],
    );
    assert.equal((await db.query('select public.mv_claim_video_job(90) as job')).rows[0].job, null);
    const interrupted = await db.query('select status,stage,error_code from public.mv_video_jobs where id=$1', [thirdJob.id]);
    assert.deepEqual(interrupted.rows[0], {
      status: 'failed',
      stage: 'uncertain',
      error_code: 'provider_submission_uncertain',
    });

    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [bob]);
    assert.equal((await db.query('select * from public.mv_video_projects')).rows.length, 0);
    assert.equal((await db.query('select * from public.mv_video_jobs')).rows.length, 0);
    assert.equal((await db.query('select * from storage.objects where bucket_id=$1', ['mv-video-assets'])).rows.length, 0);
    await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('mv-video-assets',$1)", [`${alice}/inputs/other.jpg`]), /row-level security/);
    await assert.rejects(db.query('select * from public.mv_video_image_cache'), /permission denied/);
    await assert.rejects(db.query(
      "select public.mv_enqueue_video_job($1,null,'request-key-00000004',$2::jsonb)",
      [bob, JSON.stringify({ ...requestData, product: { imageStoragePath: `${alice}/inputs/photo.jpg` } })],
    ), /permission denied/);

    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [bob]);
    await assert.rejects(insert(first.id), /row-level security|violates foreign key/);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [alice]);
    await db.query('delete from public.mv_video_projects where id=$1', [first.id]);
    assert.equal((await db.query('select parent_id from public.mv_video_projects where id=$1', [version.id])).rows[0].parent_id, null);
    await db.exec('reset role;set role service_role');
    for (let i = 0; i < 16; i++) {
      const entry = (await enqueue(`request-delivery-${String(i).padStart(6,'0')}`, requestData, null)).rows[0].result;
      await db.query("update public.mv_video_jobs set status='completed',stage='completed',result_object_path=$2 where id=$1", [entry.id, `${alice}/outputs/${entry.id}.mp4`]);
    }
    assert.ok((await db.query("select count(*)::int as count from public.mv_video_jobs where user_id=$1 and status='completed'", [alice])).rows[0].count >= 16);
  } finally {
    await db.close();
  }
});
