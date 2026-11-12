import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
const publication = '33333333-3333-4333-8333-333333333333';

test('migração isola publicações, avança vencidas uma vez e registra ações manuais idempotentes', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
      create schema auth;create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated,anon,service_role;
      grant execute on function auth.uid() to authenticated,anon,service_role;`);
    const migration = await readFile(new URL('../supabase/migrations/20261112180000_publication_scheduling.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    await db.query('insert into auth.users(id) values($1),($2)', [alice, bob]);
    await db.query(`insert into public.mv_publications
      (id,user_id,idempotency_key,product_title,source_marketplace,affiliate_url,publication_title,
       caption,hashtags,destination,media_path,media_type,media_filename,status,scheduled_at,timezone)
      values($1,$2,$3,'Produto','Shopee','https://shopee.com.br/item','Publicação',
       'Descrição','#Publicidade','pinterest',$4,'video/mp4','produto.mp4','scheduled','2000-01-01T00:00:00Z','America/Sao_Paulo'),
       ('77777777-7777-4777-8777-777777777777',$5,'88888888-8888-4888-8888-888888888888',
        'Produto','Amazon','https://amazon.com.br/item','Rascunho futuro',
        'Descrição','#Publicidade','pinterest','22222222-2222-4222-8222-222222222222/publications/99999999-9999-4999-8999-999999999999.mp4',
        'video/mp4','produto.mp4','scheduled','2099-01-01T00:00:00Z','UTC')`,
    [publication, alice, '44444444-4444-4444-8444-444444444444',
      `${alice}/publications/55555555-5555-4555-8555-555555555555.mp4`, bob]);

    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [bob]);
    assert.equal((await db.query('select id from public.mv_publications')).rows.length, 1);
    assert.equal((await db.query('select id from public.mv_publications')).rows[0].id, '77777777-7777-4777-8777-777777777777');
    assert.equal((await db.query('select id from public.mv_publication_attempts')).rows.length, 0);
    await assert.rejects(db.query('insert into public.mv_publications(user_id) values($1)', [alice]), /permission denied/);

    await db.exec('reset role;set role service_role');
    assert.equal((await db.query('select public.mv_process_due_publications() as count')).rows[0].count, 1);
    assert.equal((await db.query('select public.mv_process_due_publications() as count')).rows[0].count, 0);
    assert.equal((await db.query('select status from public.mv_publications where id=$1', [publication])).rows[0].status, 'awaiting_manual_action');
    assert.equal((await db.query('select count(*)::int as count from public.mv_publication_attempts where publication_id=$1', [publication])).rows[0].count, 1);
    assert.equal((await db.query("select status from public.mv_publications where id='77777777-7777-4777-8777-777777777777'")).rows[0].status, 'scheduled');

    const handoffKey = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const confirmKey = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const apply = (action, requestKey) => db.query(
      'select public.mv_apply_publication_action($1,$2,$3,$4) as item',
      [alice, publication, action, requestKey],
    );
    assert.equal((await apply('share_handoff', handoffKey)).rows[0].item.status, 'awaiting_manual_action');
    assert.equal((await apply('share_handoff', handoffKey)).rows[0].item.status, 'awaiting_manual_action');
    assert.equal((await db.query('select count(*)::int as count from public.mv_publication_attempts where publication_id=$1', [publication])).rows[0].count, 2);
    assert.equal((await apply('manual_published', confirmKey)).rows[0].item.status, 'published');
    assert.equal((await apply('manual_published', confirmKey)).rows[0].item.status, 'published');
    assert.equal((await db.query('select count(*)::int as count from public.mv_publication_attempts where publication_id=$1', [publication])).rows[0].count, 3);
    await assert.rejects(apply('manual_failed', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'), /publication_action_not_available/);
  } finally { await db.close(); }
});

test('migração agenda uma varredura por minuto sem duplicar o trabalho pg_cron', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
      create schema auth;create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated,anon,service_role;
      grant execute on function auth.uid() to authenticated,anon,service_role;`);
    const core = await readFile(new URL('../supabase/migrations/20261112180000_publication_scheduling.sql', import.meta.url), 'utf8');
    await db.exec(core);
    await db.exec(`create schema cron;
      create table cron.job(jobid serial primary key, jobname text not null, schedule text not null, command text not null);
      create function cron.unschedule(integer) returns boolean language plpgsql as
        $$begin delete from cron.job where jobid=$1; return found; end$$;
      create function cron.schedule(text,text,text) returns bigint language plpgsql as
        $$declare created bigint; begin insert into cron.job(jobname,schedule,command) values($1,$2,$3) returning jobid into created; return created; end$$;`);
    const scheduleMigration = await readFile(new URL('../supabase/migrations/20261112180100_publication_scheduler_cron.sql', import.meta.url), 'utf8');
    await db.exec(scheduleMigration.replace('create extension if not exists pg_cron with schema pg_catalog;', ''));
    await db.exec(scheduleMigration.replace('create extension if not exists pg_cron with schema pg_catalog;', ''));
    const jobs = await db.query('select jobname,schedule,command from cron.job');
    assert.deepEqual(jobs.rows, [{
      jobname: 'mv-publication-scheduler',
      schedule: '* * * * *',
      command: 'select public.mv_process_due_publications();',
    }]);
  } finally { await db.close(); }
});
