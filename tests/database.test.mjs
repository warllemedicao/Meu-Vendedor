import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('PostgreSQL: migração e RLS isolam links e perfis, bloqueiam anônimos e adulteração',async()=>{
 const db=new PGlite();
 const alice='11111111-1111-4111-8111-111111111111';const bob='22222222-2222-4222-8222-222222222222';
 try {
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
  await db.exec(await readFile(new URL('../supabase/migrations/20261104000100_affiliate_base.sql',import.meta.url),'utf8'));
  await db.query('insert into auth.users(id) values($1),($2)',[alice,bob]);
  assert.equal((await db.query('select count(*)::int as n from public.mv_profiles')).rows[0].n,2);
  await db.exec('set role anon');
  assert.equal((await db.query('select count(*)::int as n from public.mv_platforms')).rows[0].n,5);
  await assert.rejects(db.query('select * from public.mv_affiliate_links'),/permission denied/);
  await assert.rejects(db.query('select * from public.mv_profiles'),/permission denied/);
  await assert.rejects(db.query("insert into public.mv_platforms(id,name,portal_url) values('evil','evil','https://evil.test')"),/permission denied/);
  await db.exec('reset role;set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[alice]);
  const saved=await db.query("insert into public.mv_affiliate_links(platform_id,title,url) values('amazon','Meu link','https://amazon.com.br/example') returning id,user_id");
  const id=saved.rows[0].id;assert.equal(saved.rows[0].user_id,alice);
  await assert.rejects(db.query("insert into public.mv_affiliate_links(user_id,platform_id,title,url) values($1,'amazon','Spoof','https://example.com')",[bob]),/permission denied/);
  await assert.rejects(db.query("update public.mv_affiliate_links set user_id=$1 where id=$2",[bob,id]),/permission denied/);
  await assert.rejects(db.query("insert into public.mv_affiliate_links(platform_id,title,url) values('amazon','Unsafe','javascript:alert(1)')"),/check constraint/);
  await assert.rejects(db.query("insert into public.mv_affiliate_links(platform_id,title,url) values('amazon','Unsafe','https://user:pass@example.com')"),/check constraint/);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[bob]);
  assert.equal((await db.query('select * from public.mv_affiliate_links')).rows.length,0);
  assert.equal((await db.query('update public.mv_affiliate_links set title=$1 where id=$2 returning id',['Stolen',id])).rows.length,0);
  assert.equal((await db.query('delete from public.mv_affiliate_links where id=$1 returning id',[id])).rows.length,0);
  const profiles=await db.query('select * from public.mv_profiles');assert.equal(profiles.rows.length,1);assert.equal(profiles.rows[0].id,bob);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[alice]);
  assert.equal((await db.query('update public.mv_affiliate_links set title=$1 where id=$2 returning title',['Atualizado',id])).rows[0].title,'Atualizado');
  assert.equal((await db.query('delete from public.mv_affiliate_links where id=$1 returning id',[id])).rows.length,1);
 }finally{await db.close();}
});
