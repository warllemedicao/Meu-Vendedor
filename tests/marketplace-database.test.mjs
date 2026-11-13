import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
test('conexões: somente backend escreve, credenciais nunca são lidas por usuários e catálogo/links são isolados',async()=>{
 const db=new PGlite();const alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222',lock='33333333-3333-4333-8333-333333333333';
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated,anon,service_role;`);
  for(const file of ['20261104000100_affiliate_base.sql','20261104000200_marketplace_connections.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  await db.query('insert into auth.users(id) values($1),($2)',[alice,bob]);await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[alice]);
  for(const table of ['mv_connection_secrets','mv_connector_locks'])await assert.rejects(db.query('select * from public.'+table),/permission denied/);
  await assert.rejects(db.query('select public.mv_acquire_connector_lock($1,$2)',[alice,lock]),/permission denied/);
  await assert.rejects(db.query("insert into public.mv_connections(user_id,platform_id,status) values($1,'shopee','connected')",[alice]),/permission denied/);
  await db.exec('reset role;set role service_role');
  assert.equal((await db.query('select public.mv_acquire_connector_lock($1,$2) as ok',[alice,lock])).rows[0].ok,true);
  assert.equal((await db.query('select public.mv_acquire_connector_lock($1,$2) as ok',[alice,crypto.randomUUID()])).rows[0].ok,false);
  const products=[{external_id:'1:2',shop_id:'1',item_id:'2',title:'Produto',product_url:'https://shopee.com.br/product/1/2',sales:'10',price_min:5,price_max:5}];
  const cid=(await db.query('select public.mv_publish_shopee_sync($1,$2,$3::jsonb,$4) as id',[alice,lock,JSON.stringify(products),'v1.encrypted-fixture'])).rows[0].id;
  const storedSecret=(await db.query('select encrypted_value from public.mv_connection_secrets where connection_id=$1',[cid])).rows[0].encrypted_value;
  await db.query('select public.mv_publish_shopee_sync($1,$2,$3::jsonb,null)',[alice,lock,JSON.stringify(products)]);
  assert.equal((await db.query('select encrypted_value from public.mv_connection_secrets where connection_id=$1',[cid])).rows[0].encrypted_value,storedSecret);
  await assert.rejects(db.query('select public.mv_publish_shopee_sync($1,$2,$3::jsonb,$4)',[bob,lock,'[]','encrypted']),/connector_lock_expired/);
  const pid=(await db.query('select id from public.mv_products where connection_id=$1',[cid])).rows[0].id;
  const link=(await db.query('select public.mv_save_generated_link($1,$2,$3,$4) as link',[alice,lock,pid,'https://s.shopee.com.br/example'])).rows[0].link;
  assert.ok(link.savedLinkId);
  await db.exec('reset role;set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[alice]);
  assert.equal((await db.query('select * from public.mv_products')).rows.length,1);assert.equal((await db.query('select * from public.mv_generated_links')).rows.length,1);
  await assert.rejects(db.query("update public.mv_connections set status='connected'"),/permission denied/);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[bob]);
  for(const table of ['mv_connections','mv_products','mv_sync_runs','mv_generated_links'])assert.equal((await db.query('select * from public.'+table)).rows.length,0);
  await db.exec('reset role;set role service_role');await db.query('delete from public.mv_connections where id=$1',[cid]);
  assert.equal((await db.query('select * from public.mv_connection_secrets')).rows.length,0);assert.equal((await db.query('select * from public.mv_products')).rows.length,0);
  assert.equal((await db.query('select * from public.mv_affiliate_links where id=$1',[link.savedLinkId])).rows.length,1);
 }finally{await db.close();}
});
