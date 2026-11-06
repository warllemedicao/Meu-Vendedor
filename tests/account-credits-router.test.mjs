import test from 'node:test';
import assert from 'node:assert/strict';
import {AIProviderRouter,AIProviderFailure,initialProviderCapabilities} from '../supabase/functions/video-generation/_shared/ai-provider-router.ts';
import {accountCreditReadiness} from '../supabase/functions/video-generation/_shared/production-readiness.ts';
import {routeAdvertisingScript} from '../supabase/functions/video-generation/_shared/script-router.ts';
import {createMagicHourVideoProvider} from '../supabase/functions/video-generation/_shared/providers/magic-hour.ts';

const policy={billingMode:'account-credits',allowPaidGeneration:true,allowUnconfirmedCommercialUse:true,maxCostUsdPerTask:0,remainingDailyBudgetUsd:0,paidProviders:new Set()};
const requirements={task:'video',inputModes:['image-reference'],referenceImageCount:1,durationSeconds:6,aspectRatio:'9:16',commercialUse:true};
const provider=(id,generate,overrides={})=>({capabilities:{...initialProviderCapabilities[2],id},readiness:async()=>({authenticated:true,available:true,funding:'unknown',balanceUnits:null,...overrides}),estimate:async()=>({units:6,usd:null}),generate});
function router(providers){
 const records=[];
 const forbidden=async()=>{throw new Error('must not use local financial gates')};
 return {records,value:new AIProviderRouter(providers,{record:async row=>records.push(row),reserve:forbidden,reserveFree:forbidden,settle:forbidden,release:forbidden,setCooldown:async()=>{}},policy)};
}
test('créditos da conta permitem API com saldo/custo desconhecido sem atestar gratuidade',async()=>{
 const state=router([provider('replicate',async()=>({providerJobId:'remote',estimatedCostUsd:null}))]);
 assert.equal((await state.value.generate(requirements,{},'one')).providerId,'replicate');
 assert.equal(state.records[0].estimatedCostUsd,null);
 assert.equal(state.records.at(-1).status,'succeeded');
});
test('402 troca automaticamente para outra conta; falta de saldo consultado também avança',async()=>{
 let skipped=0;
 const state=router([
  provider('empty',async()=>{skipped++;},{balanceUnits:0}),
  provider('magic-hour',async()=>{throw new AIProviderFailure('credits_exhausted','credits','rejected')}),
  provider('replicate',async()=>({providerJobId:'ok',estimatedCostUsd:0.84})),
 ]);
 assert.equal((await state.value.generate(requirements,{},'one')).providerId,'replicate');assert.equal(skipped,0);
 assert.ok(state.records.some(x=>x.reason==='credits_exhausted'));
});
test('sem saldo em todas as contas produz espera retomável; envio incerto não duplica',async()=>{
 const empty=router([provider('empty',async()=>{}, {balanceUnits:0})]);
 await assert.rejects(empty.value.generate(requirements,{},'one'),e=>e.code==='account_resources_unavailable');
 let fallback=0;
 const state=router([provider('first',async()=>{throw new AIProviderFailure('network_timeout','uncertain','unknown')}),provider('second',async()=>{fallback++;})]);
 await assert.rejects(state.value.generate(requirements,{},'one'),e=>e.code==='provider_submission_uncertain');assert.equal(fallback,0);
});
test('autenticação e cooldown continuam respeitados após remoção dos bloqueios de custo',async()=>{
 const state=router([provider('invalid',async()=>{throw new Error('must not run')},{authenticated:false}),provider('cooldown',async()=>{throw new Error('must not run')},{cooldownUntil:Date.now()+60000})]);
 await assert.rejects(state.value.generate(requirements,{},'one'),e=>e.code==='account_resources_unavailable');
 assert.ok(state.records.every(x=>x.status==='skipped'));
});
test('disponibilidade depende de credenciais e não da concessão administrativa de cotas',()=>{
 assert.equal(accountCreditReadiness(id=>id!=='magic-hour').ready,true);
 assert.equal(accountCreditReadiness(id=>id!=='cloudflare-workers-ai').ready,false);
});
test('roteiro tenta OpenRouter grátis antes de Groq e habilita a conta sem prova local de gratuidade',async()=>{
 const calls=[];
 const result=await routeAdvertisingScript({durationSeconds:6,product:{name:'Blusa'},targetAudience:''},{useAccountCredits:true,openRouterKey:'router',groqKey:'groq',geminiKey:'gemini',fetcher:async(url,init)=>{
  calls.push(String(url));
  const body=JSON.parse(init.body);
  if(String(url).includes('openrouter')) {assert.deepEqual(body.provider.max_price,{prompt:0,completion:0,request:0,image:0});return new Response('{}',{status:429});}
  return Response.json({choices:[{message:{content:'Confira os detalhes desta blusa.'}}]});
 }});
 assert.equal(result.provider,'groq');assert.equal(calls.length,2);assert.ok(calls[0].includes('openrouter'));
});

test('Magic Hour aceita submissão com custo em USD desconhecido sem marcá-la como incerta',async()=>{
 const adapter=createMagicHourVideoProvider({apiKey:'test',creditUsd:null,freeOnly:false,commercialUseConfirmed:false,freeCreditsConfirmed:false,paidSpendAuthorized:true,fetcher:async(url,init)=>{
  if(String(url).endsWith('/account'))return Response.json({tier:'free',credits:500});
  if(String(url).endsWith('/upload-urls'))return Response.json({items:[{upload_url:'https://videos.magichour.ai/api-assets/input.webp',file_path:'api-assets/input.webp'}]});
  if(String(url).startsWith('https://videos.magichour.ai'))return new Response('',{status:200});
  const body=JSON.parse(init.body);
  assert.equal(body.audio,true);assert.equal(body.resolution,'480p');assert.equal(body.model,'ltx-2.5');assert.equal(body.end_seconds,6);
  return Response.json({id:'accepted',credits_charged:144});
 }});
 const state=router([adapter]);
 const result=await state.value.generate(requirements,{image:new Uint8Array([1]),imageMimeType:'image/webp',prompt:'Animate',durationSeconds:6,aspectRatio:'9:16'},'one');
 assert.equal(result.result.providerJobId,'accepted');assert.equal(result.result.estimatedCostUsd,null);
 assert.equal(state.records.at(-1).status,'succeeded');
});
