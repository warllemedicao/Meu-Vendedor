import test from 'node:test';
import assert from 'node:assert/strict';
import {handleGoogleFlow,safeLiveView,flowConnectionState,flowFailure,flowBrowserAlive} from '../worker/google-flow.ts';

const user={id:'verified-owner',email:'owner@example.com',email_confirmed_at:'2026-11-06T00:00:00Z'};
function request(action='start',extras={}){return new Request(`https://app.example/api/google-flow/${action}`,{method:'POST',headers:{Origin:'https://app.example','Content-Type':'application/json',Authorization:'Bearer '+'a'.repeat(40),...extras},body:'{}'});}
test('Flow autentica no servidor e deriva a sessão do usuário, sem aceitar ID do navegador',async()=>{
 const calls=[];
 const env={MV_SUPABASE_PUBLISHABLE_KEY:'public-key',GOOGLE_FLOW_SESSIONS:{getByName(id){calls.push(id);return {act:async(action,email)=>({state:'login_required',email,credits:null,checkedAt:'now',action})};}}};
 const response=await handleGoogleFlow(request(),env,async(url,init)=>{assert.equal(url,'https://jzchlrvxdaffnrgbvabv.supabase.co/auth/v1/user');assert.equal(init.redirect,'manual');return Response.json(user);});
 assert.equal(response.status,200);assert.deepEqual(calls,['verified-owner']);assert.equal((await response.json()).email,user.email);
 assert.equal(response.headers.get('Cache-Control'),'no-store');
 const rejected=await handleGoogleFlow(request(),env,async()=>new Response('',{status:401}));assert.equal(rejected.status,401);assert.equal(calls.length,1);
 const unconfirmed=await handleGoogleFlow(request(),env,async()=>Response.json({...user,email_confirmed_at:null}));assert.equal(unconfirmed.status,403);assert.equal(calls.length,1);
});

test('Flow distingue cota diária, rate limit e falha de sessão sem expor erro bruto',async()=>{
 const env={MV_SUPABASE_PUBLISHABLE_KEY:'key',GOOGLE_FLOW_SESSIONS:{getByName(){return {act:async()=>{throw Error('Unable to create new browser: code: 429: message: Browser time limit exceeded for today private-secret');}};}}};
 const response=await handleGoogleFlow(request(),env,async()=>Response.json(user));
 assert.equal(response.status,429);const body=await response.json();assert.equal(body.error,'flow_daily_limit');assert.ok(!JSON.stringify(body).includes('private-secret'));
 const temporary=flowFailure({status:429,message:'Rate limit exceeded'});assert.equal(temporary.error,'flow_browser_rate_limited');assert.equal(temporary.retryAfter,60);
 assert.equal(flowFailure(Error('flow_session_busy')).status,409);
 assert.equal(flowFailure(Error('404 Session not found')).status,410);
 assert.equal(flowFailure(Error('network error token=private')).error,'flow_browser_unavailable');
});
test('Flow não reutiliza navegador encerrado e não apaga referência por falha temporária',async()=>{
 assert.equal(await flowBrowserAlive('session',async()=>null),false);
 assert.equal(await flowBrowserAlive('session',async()=>({endTime:123})),false);
 assert.equal(await flowBrowserAlive('session',async()=>({})),true);
 assert.equal(await flowBrowserAlive('session',async()=>{throw Error('404 Session not found');}),false);
 await assert.rejects(flowBrowserAlive('session',async()=>{throw Error('network failure');}),/network failure/);
});

test('Flow distingue página aberta, login necessário e conta confirmada sem inferir conexão',()=>{
 assert.equal(flowConnectionState(undefined,'owner@example.com'),'account_unverified');
 assert.equal(flowConnectionState({editor:true},'owner@example.com'),'account_unverified');
 assert.equal(flowConnectionState({loginRequired:true},'owner@example.com'),'login_required');
 assert.equal(flowConnectionState({email:'other@example.com',editor:true},'owner@example.com'),'account_mismatch');
 assert.equal(flowConnectionState({email:'OWNER@example.com',editor:true},'owner@example.com'),'connected');
});
test('Flow recusa origem externa, métodos e comandos arbitrários antes de abrir navegador',async()=>{
 const env={MV_SUPABASE_PUBLISHABLE_KEY:'key',GOOGLE_FLOW_SESSIONS:{getByName(){throw Error('must not execute');}}};
 assert.equal((await handleGoogleFlow(request('start',{Origin:'https://attacker.example'}),env)).status,403);
 assert.equal((await handleGoogleFlow(new Request('https://app.example/api/google-flow/start'),env)).status,405);
 assert.equal((await handleGoogleFlow(request('evaluate'),env,async()=>Response.json(user))).status,404);
 assert.equal((await handleGoogleFlow(request('start',{Authorization:''}),env)).status,401);
 assert.throws(()=>safeLiveView('https://attacker.example/'));
 assert.throws(()=>safeLiveView('https://live.browser.run.attacker.example/'));
 assert.equal(new URL(safeLiveView('https://live.browser.run/ui/view?mode=tab')).hostname,'live.browser.run');
});

test('executor Modal usa sessão própria por usuário, separada do estado legado Browser Run',async()=>{
 const owners=[];
 const env={MV_FLOW_EXECUTOR_URL:'https://owner--flow.modal.run/control',MV_SUPABASE_PUBLISHABLE_KEY:'key',GOOGLE_FLOW_SESSIONS:{getByName(name){owners.push(name);return{act:async()=>({state:'disconnected',email:null,credits:null,checkedAt:'now'})};}}};
 const response=await handleGoogleFlow(request(),env,async()=>Response.json(user));
 assert.equal(response.status,200);assert.deepEqual(owners,['modal-v1:'+user.id]);
});
