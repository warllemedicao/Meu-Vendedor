import test from 'node:test';
import assert from 'node:assert/strict';
import {AIProviderRouter, AIProviderFailure, AIRoutingError, initialProviderCapabilities} from '../supabase/functions/video-generation/_shared/ai-provider-router.ts';
import {freeOnlyAdapter, verifiedFreeAllowance} from '../supabase/functions/video-generation/_shared/free-only.ts';
const requirements={task:'video',inputModes:['image-reference'],referenceImageCount:1,durationSeconds:6,aspectRatio:'9:16',commercialUse:true};
const policy={billingMode:'free-only',allowPaidGeneration:false,allowUnconfirmedCommercialUse:false,maxCostUsdPerTask:0,remainingDailyBudgetUsd:0,paidProviders:new Set()};
function harness(definitions){
 const calls={paid:0,free:[],generated:[],settled:[],released:[]};
 const store={record:async()=>{},reserve:async()=>{calls.paid++;return true},reserveFree:async(id,units)=>{calls.free.push({id,units});return true},settle:async(id,usd)=>calls.settled.push({id,usd}),release:async(id)=>calls.released.push(id),setCooldown:async()=>{}};
 const providers=definitions.map(({id,readiness={},generate})=>({capabilities:{...initialProviderCapabilities[2],id,commercialUse:'confirmed',freeTier:'confirmed'},readiness:async()=>({authenticated:true,available:true,funding:'free-confirmed',balanceUnits:100,noChargeGuaranteed:true,...readiness}),estimate:async()=>({units:6,usd:null}),generate:async()=>{calls.generated.push(id);if(generate)return generate();return {providerJobId:'remote',estimatedCostUsd:0}}}));
 return {calls,store,router:new AIProviderRouter(providers,store,policy)};
}
test('modo gratuito ignora orçamento em USD e reserva unidades antes de gerar',async()=>{
 const s=harness([{id:'free'}]);
 assert.equal((await s.router.generate(requirements,{},'key')).providerId,'free');
 assert.equal(s.calls.paid,0);assert.deepEqual(s.calls.free,[{id:'free',units:6}]);assert.deepEqual(s.calls.settled,[{id:'free',usd:0}]);
});
test('recusa saldo pago/desconhecido e tenta automaticamente a opção gratuita',async()=>{
 const s=harness([{id:'paid',readiness:{funding:'paid-authorized'}},{id:'unknown',readiness:{noChargeGuaranteed:false}},{id:'free'}]);
 assert.equal((await s.router.generate(requirements,{},'key')).providerId,'free');assert.deepEqual(s.calls.generated,['free']);
});
test('sem créditos mantém erro retomável e não faz nenhuma geração',async()=>{
 const s=harness([{id:'empty',readiness:{balanceUnits:0}}]);
 await assert.rejects(s.router.generate(requirements,{},'key'),e=>e instanceof AIRoutingError&&e.code==='free_resources_unavailable'&&e.retryAfterMs>0);
 assert.deepEqual(s.calls.generated,[]);assert.equal(s.calls.paid,0);
});
test('crédito esgotado muda de provedor e libera a reserva rejeitada',async()=>{
 const s=harness([{id:'first',generate:()=>{throw new AIProviderFailure('credits_exhausted','credits','rejected')}},{id:'second'}]);
 assert.equal((await s.router.generate(requirements,{},'key')).providerId,'second');assert.deepEqual(s.calls.released,['first']);
});
test('submissão incerta consome a reserva e não duplica a geração',async()=>{
 const s=harness([{id:'first',generate:()=>{throw new AIProviderFailure('timeout','uncertain','unknown')}},{id:'second'}]);
 await assert.rejects(s.router.generate(requirements,{},'key'),e=>e.code==='provider_submission_uncertain');
 assert.deepEqual(s.calls.generated,['first']);assert.deepEqual(s.calls.released,[]);
});
test('wrapper não chama a API nem a consulta de saldo sem gratuidade verificada',async()=>{
 let calls=0;
 const provider={capabilities:initialProviderCapabilities[2],readiness:async()=>{calls++;return{}},estimate:async()=>({units:6,usd:1}),generate:async()=>{calls++;return{}}};
 const guarded=freeOnlyAdapter(provider,async()=>null);
 assert.equal((await guarded.readiness()).noChargeGuaranteed,false);
 await assert.rejects(guarded.generate({},'key'),e=>e.code==='free_allowance_expired');assert.equal(calls,0);
});
test('prova deve corresponder ao provedor/modelo, estar válida e permitir uso comercial',()=>{
 const grant={provider_id:'replicate',model:'alibaba/happyhorse-1.0',enabled:true,billing_guard:'free-plan-hard-stop',remaining_units:6,valid_until:'2026-12-01T00:00:00Z',commercial_use_confirmed:true};
 assert.equal(verifiedFreeAllowance(grant,'replicate',grant.model,Date.parse('2026-11-06')),true);
 for(const changed of [{...grant,commercial_use_confirmed:false},{...grant,billing_guard:'unverified'},{...grant,model:'different'},{...grant,remaining_units:0},{...grant,valid_until:'invalid'}])assert.equal(verifiedFreeAllowance(changed,'replicate',grant.model,Date.parse('2026-11-06')),false);
});
