import test from 'node:test';
import assert from 'node:assert/strict';
import {callFlowExecutor} from '../worker/flow-executor.ts';
import {safeLiveView,flowFailure} from '../worker/google-flow.ts';
const env={MV_FLOW_EXECUTOR_URL:'https://owner--flow.modal.run/control',MV_FLOW_EXECUTOR_SECRET:'s'.repeat(48)};
test('executor privado recebe identidade derivada e não encaminha segredos para a resposta',async()=>{
 const result=await callFlowExecutor(env,'a'.repeat(64),'verify',undefined,async(url,options)=>{
  assert.equal(url,env.MV_FLOW_EXECUTOR_URL);assert.equal(options.headers.Authorization,'Bearer '+env.MV_FLOW_EXECUTOR_SECRET);
  assert.equal(options.redirect,'manual');assert.deepEqual(JSON.parse(options.body),{userKey:'a'.repeat(64),action:'verify'});
  return Response.json({active:true,expires:Date.now()+600000,observed:{loginRequired:true}});
 });
 assert.equal(result.observed.loginRequired,true);
});
test('executor recusa host inseguro e limita tamanho/erros sem vazar respostas',async()=>{
 await assert.rejects(callFlowExecutor({...env,MV_FLOW_EXECUTOR_URL:'https://attacker.example'},'a','start'),/not_configured/);
 await assert.rejects(callFlowExecutor(env,'a','start',undefined,async()=>new Response(null,{status:302,headers:{Location:'https://attacker.example'}})),/redirect_denied/);
 await assert.rejects(callFlowExecutor(env,'a','start',undefined,async()=>new Response('private-secret',{status:503})),/flow_executor_unavailable/);
 await assert.rejects(callFlowExecutor(env,'a','start',undefined,async()=>new Response('x'.repeat(140001))),/response_limit/);
 await assert.rejects(callFlowExecutor(env,'a','start',undefined,async()=>Response.json({})),/invalid_response/);
 assert.equal(flowFailure(Error('flow_executor_rate_limited')).error,'flow_executor_rate_limited');
});
test('visualização Modal usa HTTPS, caminho fixo e credencial em fragmento',()=>{
 const url='https://session.r5.modal.host/view#'+'a'.repeat(43);
 assert.equal(safeLiveView(url),url);
 for(const bad of ['https://attacker.example/view#'+'a'.repeat(43),'https://session.modal.host/other#'+'a'.repeat(43),'https://session.modal.host/view','https://session.modal.host.attacker.example/view#'+'a'.repeat(43)]) assert.throws(()=>safeLiveView(bad));
});
