import test from 'node:test';
import assert from 'node:assert/strict';
import {createGoogleVideoProvider,googleVideoModel} from '../supabase/functions/video-generation/_shared/providers/google-video.ts';
import {createVideoDatabase} from './helpers/video-db.mjs';
import {readFile} from 'node:fs/promises';

const request={image:new Uint8Array([1,2,3]),imageMimeType:'image/jpeg',imageUrl:'unused',prompt:'Anúncio em português com fala clara',durationSeconds:6,aspectRatio:'9:16'};
const mp4=new Uint8Array([0,0,0,16,102,116,121,112,105,115,111,109,0,0,0,0]);
const output={id:'v1_test',status:'completed',steps:[{type:'model_output',content:[{type:'video',mime_type:'video/mp4',data:Buffer.from(mp4).toString('base64')}]}]};
test('Google vídeo usa contrato REST, polling e MP4 sem transferir assinatura Flow ou credenciais',async()=>{
 const calls=[];
 const adapter=createGoogleVideoProvider({apiKey:'private-key',fetcher:async(url,init)=>{
  calls.push({url,init});assert.equal(init.headers['x-goog-api-key'],'private-key');assert.equal(init.redirect,'error');
  return Response.json(init.method==='POST'?{id:'v1_test',status:'in_progress'}:output);
 }});
 const job=await adapter.generate(request,'app-idempotency-key');
 assert.equal(job.providerJobId,'v1_test');assert.equal(job.estimatedCostUsd,null);
 const submitted=JSON.parse(calls[0].init.body);
 assert.equal(submitted.model,googleVideoModel);assert.equal(submitted.background,true);
 assert.deepEqual(submitted.response_format,{type:'video',aspect_ratio:'9:16',duration:'6s',resolution:'720p',delivery:'uri'});
 assert.equal(submitted.input[0].data,'AQID');assert.ok(!JSON.stringify(job).includes('private-key'));
 const status=await adapter.status(job.providerJobId);assert.equal(status.status,'completed');
 assert.deepEqual(await adapter.download(status.downloadUrl),mp4);
 assert.ok(calls.every(c=>!c.url.includes('private-key')));
 await assert.rejects(adapter.status('../other-resource'),/id_invalid/);
 await assert.rejects(adapter.download('https://attacker.example/video'),/reference_invalid/);
});
test('Google vídeo preserva submissão incerta e distingue rejeição antes de tentar outro serviço',async()=>{
 for(const [status,submission] of [[402,'rejected'],[429,'rejected'],[500,'unknown']]){
  const adapter=createGoogleVideoProvider({apiKey:'key',fetcher:async()=>new Response('',{status})});
  await assert.rejects(adapter.generate(request,'key'),e=>e.submission===submission);
 }
 const adapter=createGoogleVideoProvider({apiKey:'key',fetcher:async()=>{throw Error('network');}});
 await assert.rejects(adapter.generate(request,'key'),e=>e.submission==='unknown');
 const malformed=createGoogleVideoProvider({apiKey:'key',fetcher:async()=>Response.json({status:'completed'})});
 await assert.rejects(malformed.generate(request,'key'),e=>e.submission==='accepted');
});
test('migração Google permite tentativas/cooldown e mantém RPCs privadas',async()=>{
 const db=await createVideoDatabase();
 try{
  const sql=await readFile(new URL('../supabase/migrations/20261106151423_google_video_provider.sql',import.meta.url),'utf8');
  await db.exec(sql); // reaplicação preserva o contrato
  const owner='11111111-1111-4111-8111-111111111111';
  await db.query('insert into auth.users(id) values($1)',[owner]);
  await db.exec('set role service_role');
  const data={templateId:'wearing-product',scenePresetId:'fashion-studio',durationSeconds:6,format:'9:16',product:{imageStoragePath:`${owner}/inputs/product.jpg`,aiReferenceStoragePath:`${owner}/inputs/ref.jpg`,aiReferenceWidth:512,aiReferenceHeight:384},presenterReferenceStoragePath:`${owner}/inputs/person.jpg`,presenterReferenceWidth:410,presenterReferenceHeight:512};
  await db.query('select public.mv_enqueue_video_job($1,null,$2,$3::jsonb)',[owner,'google-video-request-0001',JSON.stringify(data)]);
  const job=(await db.query('select public.mv_claim_video_job(180) as job')).rows[0].job;
  await db.query("select public.mv_record_video_ai_attempt($1,'video','google-gemini',$2,'started',null,null)",[job.id,googleVideoModel]);
  const submitted=(await db.query("select public.mv_advance_video_job($1,$2,'video_processing',55,'google-gemini','v1_test') as job",[job.id,job.lease_token])).rows[0].job;
  assert.equal(submitted.provider,'google-gemini');assert.equal(submitted.provider_job_id,'v1_test');
  assert.equal((await db.query('select remote_job_id from public.mv_video_ai_attempts where job_id=$1',[job.id])).rows[0].remote_job_id,'v1_test');
  await db.query("select public.mv_set_video_ai_cooldown('google-gemini',now()+interval '1 minute','rate_limit')");
  assert.equal((await db.query("select provider_id from public.mv_video_ai_provider_cooldowns where provider_id='google-gemini'")).rows.length,1);
  const f=await db.query("select pg_get_functiondef('public.mv_advance_video_job(uuid,uuid,text,integer,text,text,text,text,text,integer)'::regprocedure) as definition");
  assert.match(f.rows[0].definition,/when 'google-gemini' then 'google-gemini'/);
  await db.exec('set role authenticated');
  await assert.rejects(db.query("select public.mv_set_video_ai_cooldown('google-gemini',now()+interval '1 minute','rate_limit')"),/permission denied/);
 }finally{await db.close();}
});

test('Google preserva o motivo seguro de uma interação que falhou sem vazar a resposta', async()=>{
 const adapter=createGoogleVideoProvider({apiKey:'key',fetcher:async()=>Response.json({status:'failed',errors:[{code:'RESOURCE_EXHAUSTED',message:'private provider detail'}]})});
 assert.deepEqual(await adapter.status('v1_test'),{status:'failed',progress:0,errorCode:'google_video_resource_exhausted'});
});
