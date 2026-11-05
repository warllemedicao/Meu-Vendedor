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
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated,anon,service_role;`);
    for (const file of ['20261104000100_affiliate_base.sql', '20261104000200_marketplace_connections.sql', '20261105151156_video_generator.sql']) {
      await db.exec(await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8'));
    }
    await db.query('insert into auth.users(id) values($1),($2)', [alice, bob]);
    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [alice]);
    const insert = async (parent = null) => db.query(`insert into public.mv_video_projects(parent_id,product_data,presenter_id,voice_gender,voice_profile,emotional_tone,advertising_style,duration_seconds,aspect_ratio,generation_mode,target_audience,script,prompt,provider,status) values($1,$2::jsonb,'ana','feminina','natural','alegre','tradicional',15,'9:16','ai-video','','roteiro seguro com conteúdo suficiente','prompt seguro com conteúdo suficiente','mock','simulation_completed') returning id,user_id,parent_id`, [parent, product]);
    const first = (await insert()).rows[0];
    assert.equal(first.user_id, alice);
    const version = (await insert(first.id)).rows[0];
    assert.equal(version.parent_id, first.id);
    await assert.rejects(db.query("insert into public.mv_video_projects(product_data,presenter_id,voice_gender,voice_profile,emotional_tone,advertising_style,duration_seconds,aspect_ratio,generation_mode,target_audience,script,prompt,provider,status,result_url) values($1::jsonb,'ana','feminina','natural','alegre','tradicional',15,'9:16','ai-video','','roteiro seguro com conteúdo suficiente','prompt seguro com conteúdo suficiente','mock','completed','http://unsafe.test/video.mp4')", [product]), /check constraint/);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [bob]);
    assert.equal((await db.query('select * from public.mv_video_projects')).rows.length, 0);
    await assert.rejects(insert(first.id), /row-level security|violates foreign key/);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [alice]);
    await db.query('delete from public.mv_video_projects where id=$1', [first.id]);
    assert.equal((await db.query('select parent_id from public.mv_video_projects where id=$1', [version.id])).rows[0].parent_id, null);
  } finally {
    await db.close();
  }
});
