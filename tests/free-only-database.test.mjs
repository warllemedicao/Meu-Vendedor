import test from 'node:test';
import assert from 'node:assert/strict';
import {createVideoDatabase} from './helpers/video-db.mjs';
const alice='11111111-1111-4111-8111-111111111111';
const data={templateId:'wearing-product',scenePresetId:'fashion-studio',durationSeconds:6,format:'9:16',product:{imageStoragePath:`${alice}/inputs/product.jpg`,aiReferenceStoragePath:`${alice}/inputs/ref.jpg`,aiReferenceWidth:512,aiReferenceHeight:384},presenterReferenceStoragePath:`${alice}/inputs/person.jpg`,presenterReferenceWidth:410,presenterReferenceHeight:512};

test('cotas gratuitas são atômicas, idempotentes e isoladas dos clientes',async()=>{
 const db=await createVideoDatabase();
 try{
  await db.query('insert into auth.users(id) values($1)',[alice]);await db.exec('set role service_role');
  const enqueue=async key=>(await db.query('select public.mv_enqueue_video_job($1,null,$2,$3::jsonb) as job',[alice,key,JSON.stringify(data)])).rows[0].job;
  await enqueue('free-request-00000001');const first=(await db.query('select public.mv_claim_video_job(180) as job')).rows[0].job;
  await enqueue('free-request-00000002');const second=(await db.query('select public.mv_claim_video_job(180) as job')).rows[0].job;
  const reserve=async(job,units)=>(await db.query("select public.mv_reserve_free_video_units($1,$2,'image','cloudflare-workers-ai','@cf/black-forest-labs/flux-2-dev',$3) as ok",[job.id,job.lease_token,units])).rows[0].ok;
  const settle=async(job,release)=>(await db.query("select public.mv_settle_free_video_units($1,'image','cloudflare-workers-ai','@cf/black-forest-labs/flux-2-dev',$2) as ok",[job.id,release])).rows[0].ok;
  const balance=async()=>(await db.query("select remaining_units::float8 as units from public.mv_ai_free_allowances where provider_id='cloudflare-workers-ai'")).rows[0].units;
  assert.equal(await reserve(first,60),false); // Chave presente não é prova de gratuidade.
  await db.exec("update public.mv_ai_free_allowances set enabled=true,billing_guard='free-plan-hard-stop',commercial_use_confirmed=true,evidence='Free account verified; billing is blocked',valid_until=now()+interval '1 day',remaining_units=100 where provider_id='cloudflare-workers-ai'");
  assert.equal(await reserve(first,60),true);assert.equal(await reserve(first,60),true);assert.equal(await balance(),40);
  assert.equal(await reserve(second,60),false);assert.equal(await reserve(second,40),true);assert.equal(await balance(),0);
  assert.equal(await settle(first,true),true);assert.equal(await settle(first,true),true);assert.equal(await balance(),60);
  assert.equal(await settle(second,false),true);assert.equal(await settle(second,true),false);assert.equal(await balance(),60);
  assert.equal(await reserve(first,10),true);
  await db.exec("update public.mv_ai_free_allowances set grant_revision=gen_random_uuid(),remaining_units=50 where provider_id='cloudflare-workers-ai'");
  assert.equal(await settle(first,true),true);assert.equal(await balance(),50); // Não infla outra franquia.
  await db.exec("update public.mv_ai_free_allowances set valid_until=now()-interval '1 second' where provider_id='cloudflare-workers-ai'");
  assert.equal(await reserve(first,1),false);
  await db.exec('reset role;set role authenticated');
  await assert.rejects(db.query('select * from public.mv_ai_free_allowances'),/permission denied/);
  await assert.rejects(db.query('select * from public.mv_ai_free_reservations'),/permission denied/);
  await assert.rejects(db.query("select public.mv_refresh_free_allowance('cloudflare-workers-ai','@cf/black-forest-labs/flux-2-dev')"),/permission denied/);
  await assert.rejects(reserve(first,1),/permission denied/);
 }finally{await db.close()}
});

test('renovação usa apenas franquia periódica verificada; bônus único não renova',async()=>{
 const db=await createVideoDatabase();
 try{
  await db.exec('set role service_role');
  const refresh=async()=>(await db.query("select public.mv_refresh_free_allowance('cloudflare-workers-ai','@cf/black-forest-labs/flux-2-dev') as grant")).rows[0].grant;
  await db.exec("update public.mv_ai_free_allowances set enabled=true,billing_guard='free-plan-hard-stop',commercial_use_confirmed=true,evidence='Documented provider recurring quota; Free account',valid_until=now()+interval '1 day',remaining_units=0,next_reset_at=now()-interval '30 seconds' where provider_id='cloudflare-workers-ai'");
  assert.equal(Number((await refresh()).remaining_units),0);
  await db.exec("update public.mv_ai_free_allowances set renewal_period_seconds=86400,renewal_units=10000 where provider_id='cloudflare-workers-ai'");
  const renewed=await refresh();assert.equal(Number(renewed.remaining_units),10000);
  await db.exec("update public.mv_ai_free_allowances set remaining_units=9000 where provider_id='cloudflare-workers-ai'");
  assert.equal(Number((await refresh()).remaining_units),9000);
  assert.equal((await refresh()).grant_revision,renewed.grant_revision);
 }finally{await db.close()}
});

test('sem teto diário: fila aceita mais de 100 pedidos e espera retoma sem perder imagem',async()=>{
 const db=await createVideoDatabase();
 try{
  await db.query('insert into auth.users(id) values($1)',[alice]);await db.exec('set role service_role');
  for(let i=0;i<105;i++)await db.query('select public.mv_enqueue_video_job($1,null,$2,$3::jsonb)',[alice,`free-unlimited-${String(i).padStart(8,'0')}`,JSON.stringify(data)]);
  assert.equal((await db.query('select count(*)::int as n from public.mv_video_jobs')).rows[0].n,105);
  const job=(await db.query('select public.mv_claim_video_job(180) as job')).rows[0].job;
  const path=`${alice}/intermediate/owned-reference.jpg`;
  const waiting=(await db.query("select public.mv_advance_video_job($1,$2,'awaiting_free_credits',35,null,null,$3,null,'waiting_for_free_resources',900) as job",[job.id,job.lease_token,path])).rows[0].job;
  assert.equal(waiting.status,'queued');assert.equal(waiting.completed_at,null);assert.equal(waiting.intermediate_image_path,path);
  assert.notEqual((await db.query('select public.mv_claim_video_job(180) as job')).rows[0].job.id,job.id); // Não bloqueia pedido novo.
  await db.query("update public.mv_video_jobs set next_attempt_at=now()-interval '1 day' where id=$1",[job.id]);
  const resumed=(await db.query('select public.mv_claim_video_job(180) as job')).rows[0].job;
  assert.equal(resumed.id,job.id);assert.equal(resumed.intermediate_image_path,path);
  await db.query("select public.mv_advance_video_job($1,$2,'awaiting_free_credits',35,null,null,null,null,'waiting_for_free_resources',900)",[resumed.id,resumed.lease_token]);
  await db.query('select public.mv_cancel_video_job($1,$2)',[alice,job.id]);
  assert.equal((await db.query('select stage from public.mv_video_jobs where id=$1',[job.id])).rows[0].stage,'cancelled');
 }finally{await db.close()}
});
