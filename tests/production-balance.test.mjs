import test from 'node:test';
import assert from 'node:assert/strict';
import {productionServicesWithBalance} from '../supabase/functions/video-generation/_shared/provider-inventory.ts';
const env=name=>({MAGIC_HOUR_API_KEY:'private-key',RUNWAY_API_KEY:'private-key',OPENROUTER_API_KEY:'private-key'})[name];
const accountResponses=(credits, walletStatus=403)=>async(url,init)=>{
 assert.equal(init.method,'GET'); assert.equal(init.redirect,'error');
 assert.equal(init.headers.Authorization,'Bearer private-key');
 if(url.includes('runway')){assert.equal(init.headers['X-Runway-Version'],'2024-11-06');return Response.json({creditBalance:27,email:'private@example.com'});}
 if(url.endsWith('/credits'))return walletStatus===200?Response.json({data:{total_credits:10,total_usage:3}}):new Response('',{status:walletStatus});
 if(url.endsWith('/key'))return Response.json({data:{limit_remaining:2.5,is_free_tier:true}});
 return Response.json({credits,email:'private@example.com',token:'private-key'});
};
test('consulta saldos oficiais, aceita zero e diferencia limite da chave de saldo total',async()=>{
 for(const credits of [456,0]){
  const services=await productionServicesWithBalance(env,accountResponses(credits));
  const magic=services.find(x=>x.id==='magic-hour');
  assert.equal(magic.balanceCredits,credits);assert.ok(magic.balanceCheckedAt);
  const runway=services.find(x=>x.id==='runway');
  assert.equal(runway.balanceCredits,27);assert.equal(runway.integrated,false);
  const router=services.find(x=>x.id==='openrouter');
  assert.equal(router.balanceCredits,2.5);assert.equal(router.balanceUnit,'USD');assert.equal(router.balanceScope,'key-limit');
  assert.ok(!JSON.stringify(services).includes('private'));
 }
});
test('OpenRouter usa saldo real somente quando a chave consegue consultar a carteira',async()=>{
 const services=await productionServicesWithBalance(env,accountResponses(456,200));
 const router=services.find(x=>x.id==='openrouter');
 assert.equal(router.balanceCredits,7);assert.equal(router.balanceScope,'account');
});
test('falha, saldo inválido e resposta excessiva não inventam saldo nem vazam resposta',async()=>{
 for(const response of [new Response('',{status:401}),new Response('',{status:403}),Response.json({credits:-1}),Response.json({credits:'456'}),new Response('x'.repeat(262145))]){
  const services=await productionServicesWithBalance(name=>name==='MAGIC_HOUR_API_KEY'?'key':undefined,async()=>response);
  assert.equal(services.find(x=>x.id==='magic-hour').balanceCredits,null);
 }
});
test('provedores sem consulta de saldo ficam desconhecidos, sem confundir com zero',async()=>{
 const secrets={GEMINI_API_KEY:'key',GROQ_API_KEY:'key',REPLICATE_API_TOKEN:'key',HUGGINGFACE_API_KEY:'key',MODAL_TOKEN_ID:'key',MODAL_TOKEN_SECRET:'key',KAGGLE_API_TOKEN:'key'};
 const services=await productionServicesWithBalance(name=>secrets[name],async()=>Response.json({type:'user',isPro:false}));
 for(const id of ['google-gemini','groq','replicate','huggingface','modal','kaggle']){
  const service=services.find(x=>x.id===id);
  assert.equal(service.balanceCredits,null);assert.equal(service.balanceStatus,'unsupported');assert.ok(service.balanceUrl);
 }
});
