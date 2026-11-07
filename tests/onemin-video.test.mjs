import test from 'node:test';
import assert from 'node:assert/strict';
import {createOneminVideoProvider,oneminVideoModel} from '../supabase/functions/video-generation/_shared/providers/onemin.ts';
import {createVideoDatabase} from './helpers/video-db.mjs';
import {generationTools,allowsVideoProvider} from '../supabase/functions/video-generation/_shared/generation-tools.ts';
import {accountCreditReadiness} from '../supabase/functions/video-generation/_shared/production-readiness.ts';

const id='11111111-1111-4111-8111-111111111111';
const input={image:new Uint8Array([1,2,3]),imageMimeType:'image/jpeg',imageUrl:'not-used',prompt:'Apresente o produto com fala em português.',durationSeconds:6,aspectRatio:'9:16'};
const mp4=new Uint8Array([0,0,0,16,102,116,121,112,105,115,111,109,0,0,0,0]);
test('1min envia asset privado, referência, áudio nativo e acompanha resultado sem vazar chave no download',async()=>{
 const calls=[];
 const adapter=createOneminVideoProvider({apiKey:'private-key',fetcher:async(url,init)=>{
  calls.push({url,init});assert.equal(init.redirect,'error');
  if(url.startsWith('https://storage.1min.ai/')){assert.equal(init.headers,undefined);return new Response(mp4);}
  assert.equal(init.headers['API-KEY'],'private-key');
  if(url.endsWith('/assets')){assert.ok(init.body instanceof FormData);assert.ok(init.body.get('asset') instanceof Blob);return Response.json({asset:{key:'images/reference.jpg'}});}
  if(url.endsWith('/features')){const body=JSON.parse(init.body);assert.equal(body.model,oneminVideoModel);assert.equal(body.async,true);assert.equal(body.type,'TEXT_TO_VIDEO');assert.deepEqual(body.promptObject.imageUrls,['images/reference.jpg']);assert.equal(body.promptObject.duration,6);assert.equal(body.promptObject.generateAudio,true);assert.equal(body.promptObject.ratio,'9:16');return Response.json({aiRecord:{uuid:id,status:'PROCESSING'}});}
  return Response.json({aiRecord:{uuid:id,status:'SUCCESS',temporaryUrl:'https://storage.1min.ai/videos/out.mp4?signature=test'}});
 }});
 const job=await adapter.generate(input,'idempotency-key');assert.equal(job.providerJobId,id);
 const status=await adapter.status(id);assert.equal(status.status,'completed');
 assert.deepEqual(await adapter.download(status.downloadUrl),mp4);
 assert.equal(calls.filter(c=>c.url.endsWith('/features')).length,1);
 assert.doesNotMatch(JSON.stringify(job),/private-key/);
});
test('1min mantém envio incerto sem reenvio e distingue saldo/rejeição',async()=>{
 for(const [http,category,submission] of [[402,'credits','rejected'],[401,'auth','rejected'],[429,'rate-limit','rejected'],[500,'uncertain','unknown']]){
  let count=0;const adapter=createOneminVideoProvider({apiKey:'key',fetcher:async(url)=>url.endsWith('/assets')?Response.json({asset:{key:'images/ref.jpg'}}):(count++,new Response('',{status:http}))});
  await assert.rejects(adapter.generate(input,'key'),e=>e.category===category&&e.submission===submission);assert.equal(count,1);
 }
 const adapter=createOneminVideoProvider({apiKey:'key',fetcher:async(url)=>url.endsWith('/assets')?Response.json({asset:{key:'images/ref.jpg'}}):Response.json({})});
 await assert.rejects(adapter.generate(input,'key'),e=>e.submission==='accepted');
});
test('1min rejeita resultado externo, IDs inválidos, resultado ausente e status de falha',async()=>{
 const calls=[];let response={aiRecord:{status:'SUCCESS',temporaryUrl:'https://127.0.0.1/private'}};
 const adapter=createOneminVideoProvider({apiKey:'key',fetcher:async url=>{calls.push(url);return Response.json(response);}});
 await assert.rejects(adapter.status('../private'),/id_invalid/);assert.equal(calls.length,0);
 await assert.rejects(adapter.status(id),/output_url_invalid/);
 await assert.rejects(adapter.download('https://storage.1min.ai/out.mp4'),/reference_invalid/);
 response={aiRecord:null};await assert.rejects(adapter.status(id),/status_invalid/);
 response={aiRecord:{status:'FAILURE',aiRecordDetail:{resultObject:{message:'private-detail'}}}};
 assert.deepEqual(await adapter.status(id),{status:'failed',progress:0,errorCode:'onemin_generation_failed'});
 response={aiRecord:{status:'FAILURE',aiRecordDetail:{resultObject:{code:'INSUFFICIENT_CREDITS',message:'private account balance'}}}};
 assert.equal((await adapter.status(id)).errorCode,'onemin_insufficient_credits');
 response={aiRecord:{status:'PROCESSING'}};assert.equal((await adapter.status(id)).status,'processing');
});
test('somente 1min configurado permite vídeo e escolha explícita continua isolada',()=>{
 assert.equal(accountCreditReadiness(p=>['cloudflare-workers-ai','onemin'].includes(p)).ready,true);
 assert.equal(generationTools([{id:'onemin',configured:true}]).find(t=>t.id==='onemin').available,true);
 assert.equal(allowsVideoProvider('onemin','magic-hour'),false);assert.equal(allowsVideoProvider('auto','onemin'),true);
});
test('banco aceita 1min nas tentativas, cooldown e projeto sem ampliar acesso de cliente',async()=>{
 const db=await createVideoDatabase();
 try{
  await db.query('insert into auth.users(id) values($1)',[id]);await db.exec('set role service_role');
  const data={templateId:'wearing-product',scenePresetId:'fashion-studio',durationSeconds:6,format:'9:16',product:{imageStoragePath:`${id}/inputs/product.jpg`,aiReferenceStoragePath:`${id}/inputs/ref.jpg`,aiReferenceWidth:512,aiReferenceHeight:384},presenterReferenceStoragePath:`${id}/inputs/person.jpg`,presenterReferenceWidth:410,presenterReferenceHeight:512};
  await db.query('select public.mv_enqueue_video_job($1,null,$2,$3::jsonb)',[id,'onemin-request-0000001',JSON.stringify(data)]);
  const job=(await db.query('select public.mv_claim_video_job(180) as job')).rows[0].job;
  await db.query("select public.mv_record_video_ai_attempt($1,'video','onemin',$2,'started',null,null)",[job.id,oneminVideoModel]);
  await db.query("select public.mv_set_video_ai_cooldown('onemin',now()+interval '15 minutes','credits')");
  const changed=(await db.query("select public.mv_advance_video_job($1,$2,'video_processing',55,'onemin',$3) as job",[job.id,job.lease_token,id])).rows[0].job;
  assert.equal(changed.provider,'onemin');
  assert.equal((await db.query('select remote_job_id from public.mv_video_ai_attempts where job_id=$1',[job.id])).rows[0].remote_job_id,id);
  const f=(await db.query("select pg_get_functiondef('public.mv_advance_video_job(uuid,uuid,text,integer,text,text,text,text,text,integer)'::regprocedure) as definition")).rows[0].definition;
  assert.match(f,/when 'onemin' then 'onemin'/);
  await db.exec('set role authenticated');await assert.rejects(db.query("select public.mv_set_video_ai_cooldown('onemin',now()+interval '1 minute','credits')"),/permission denied/);
 }finally{await db.close();}
});
