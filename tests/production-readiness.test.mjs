import test from 'node:test';
import assert from 'node:assert/strict';
import {productionReadiness} from '../supabase/functions/video-generation/_shared/production-readiness.ts';
import {createVideoGenerationHandler} from '../supabase/functions/video-generation/_shared/service.ts';

const grant=(provider,model,units)=>({provider_id:provider,model,remaining_units:units,enabled:true,billing_guard:'free-plan-hard-stop',commercial_use_confirmed:true,valid_until:new Date(Date.now()+60000).toISOString(),evidence:'private administrative information'});
test('saldo não comprovado não aparece como geração pronta e nenhum detalhe privado é retornado',async()=>{
 const status=await productionReadiness(()=>true,async(provider,model)=>({...grant(provider,model,5000),billing_guard:'unverified'}));
 assert.equal(status.ready,false);assert.equal(status.imageReady,false);assert.equal(status.videoReady,false);
 assert.match(status.message,/não começará a gerar agora/);
 assert.ok(!JSON.stringify(status).includes('administrative'));
 assert.ok(!JSON.stringify(status).includes('remaining_units'));
});
test('cota insuficiente no primeiro vídeo permite opção alternativa verificada',async()=>{
 const status=await productionReadiness(()=>true,async(provider,model)=>grant(provider,model,provider==='magic-hour'?143:provider==='replicate'?6:2819));
 assert.equal(status.ready,true);assert.equal(status.videoReady,true);
});
test('falha no banco fecha disponibilidade e credencial ausente impede consulta',async()=>{
 const calls=[];
 const status=await productionReadiness(provider=>provider!=='cloudflare-workers-ai',async(provider)=>{calls.push(provider);throw new Error('database failure');});
 assert.equal(status.ready,false);assert.deepEqual(calls,['magic-hour','replicate']);
});
test('diagnóstico no endpoint exige sessão antes de consultar cotas',async()=>{
 let checks=0;
 const readiness={ready:false,imageReady:false,videoReady:false,checkedAt:new Date().toISOString(),message:'Aguardando liberação'};
 const handler=createVideoGenerationHandler({authenticate:async token=>token==='valid'?'owner':null,productionReadiness:async()=>{checks++;return readiness;},geminiApiKey:()=>undefined,geminiScriptEnabled:()=>false,videoJobsEnabled:()=>true,videoProcessorAvailable:()=>true,generateScript:async()=>'',enqueueJob:async()=>null,getJob:async()=>null,cancelJob:async()=>null,saveDemoResult:async()=>null});
 const req=token=>new Request('https://example.test',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action:'capabilities'})});
 assert.equal((await handler(req('invalid'))).status,401);assert.equal(checks,0);
 const response=await handler(req('valid'));
 assert.equal(response.status,200);assert.deepEqual((await response.json()).video.readiness,readiness);assert.equal(checks,1);
});
