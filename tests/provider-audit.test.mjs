import test from 'node:test';
import assert from 'node:assert/strict';
import {auditProviders} from '../supabase/functions/video-generation/_shared/provider-audit.ts';
import {productionServiceInventory} from '../supabase/functions/video-generation/_shared/provider-inventory.ts';
import {createVideoDatabase} from './helpers/video-db.mjs';

test('auditoria usa apenas GET e não persiste credenciais nem presume gratuidade de saldo', async()=>{
 const secrets={CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),CLOUDFLARE_BILLING_READ_TOKEN:'private-token',MAGIC_HOUR_API_KEY:'private-token',OPENROUTER_API_KEY:'private-token'};
 const calls=[];
 const reports=await auditProviders(name=>secrets[name],async(url,options)=>{
  calls.push({url,options});
  assert.equal(options.method,'GET'); assert.equal(options.redirect,'error');
  return Response.json(url.includes('cloudflare')?{success:true,result:[{state:'active',rate_plan:{id:'workers_free',public_name:'Workers Free'},secret:'private-token'}]}:url.includes('magichour')?{tier:'free',credits:123,subscription:null,email:'private@example.com'}:{data:{is_free_tier:true,limit_remaining:0,secret:'private-token'}});
 });
 assert.equal(calls.length,3);
 assert.equal(reports.find(x=>x.provider_id==='magic-hour').report.total_credits,123);
 assert.ok(reports.every(x=>x.report.quota_verified===false));
 assert.ok(!JSON.stringify(reports).includes('private-token'));
 assert.ok(!JSON.stringify(reports).includes('private@example.com'));
});
test('auditoria distingue token inválido, permissão ausente e resposta excessiva',async()=>{
 const reports=await auditProviders(name=>name==='CLOUDFLARE_ACCOUNT_ID'?'a'.repeat(32):'secret',async(url)=>{
  if(url.includes('cloudflare')) return new Response('',{status:403});
  if(url.includes('replicate')) return new Response('',{status:401});
  return new Response('x'.repeat(262145));
 });
 assert.equal(reports.find(x=>x.provider_id==='cloudflare-workers-ai').status,'permission_missing');
 assert.equal(reports.find(x=>x.provider_id==='replicate').status,'invalid_credentials');
 assert.equal(reports.find(x=>x.provider_id==='magic-hour').status,'unavailable');
});
test('inventário exige as duas credenciais Modal e a conta Cloudflare',()=>{
 const inventory=productionServiceInventory(name=>['MODAL_TOKEN_ID','CLOUDFLARE_AI_API_TOKEN'].includes(name));
 assert.equal(inventory.find(x=>x.id==='modal').configured,false);
 assert.equal(inventory.find(x=>x.id==='cloudflare-workers-ai').configured,false);
});
test('auditoria tem claim atômico e relatórios privados',async()=>{
 const db=await createVideoDatabase();
 try{
  await db.exec('set role service_role');
  assert.equal((await db.query('select public.mv_claim_provider_audit() as claimed')).rows[0].claimed,true);
  assert.equal((await db.query('select public.mv_claim_provider_audit() as claimed')).rows[0].claimed,false);
  await db.exec(`insert into public.mv_ai_provider_audits(provider_id,status,report) values ('test','checked','{}');set role authenticated;`);
  await assert.rejects(db.query('select * from public.mv_ai_provider_audits'),/permission denied/);
  await assert.rejects(db.query('select public.mv_claim_provider_audit()'),/permission denied/);
 }finally{await db.close();}
});
