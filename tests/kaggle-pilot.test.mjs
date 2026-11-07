import test from 'node:test';
import assert from 'node:assert/strict';
import {createKagglePilotClient,gpuPilotCode,pilotSlug} from '../supabase/functions/kaggle-pilot/_shared/client.ts';

test('piloto Kaggle consulta cota real sem inventar 30 horas e não expõe token',async()=>{
 const client=createKagglePilotClient('private-token',async(url,init)=>{
  assert.equal(init.headers.Authorization,'Bearer private-token');assert.equal(init.redirect,'error');
  if(url.endsWith('/IntrospectToken'))return Response.json({active:true,username:'owner',token:'private-token'});
  assert.ok(url.endsWith('/GetAcceleratorQuotaStatistics'));
  return Response.json({gpuQuota:{totalTimeAllowed:'108000s',timeUsed:'120s',timeReserved:'300s'},quotaRefreshTime:'2026-11-14T00:00:00Z'});
 });
 assert.deepEqual(await client.check(),{tokenValid:true,gpuTotalSeconds:108000,gpuUsedSeconds:120,gpuReservedSeconds:300,quotaRefreshTime:'2026-11-14T00:00:00Z'});
 const unknown=createKagglePilotClient('key',async url=>Response.json(url.endsWith('IntrospectToken')?{active:true,username:'owner'}:{}));
 assert.equal((await unknown.check()).gpuTotalSeconds,null);
});
test('notebook Kaggle é privado, limitado e recebe somente código fixo sem chaves',async()=>{
 const client=createKagglePilotClient('private-token',async(url,init)=>{
  if(url.endsWith('/IntrospectToken'))return Response.json({active:true,username:'owner'});
  const body=JSON.parse(init.body);assert.equal(body.isPrivate,true);assert.equal(body.enableInternet,false);
  assert.equal(body.sessionTimeoutSeconds,300);assert.equal(body.machineShape,'NvidiaTeslaT4');assert.equal(body.text,gpuPilotCode);
  assert.doesNotMatch(body.text,/private-token|SUPABASE_SERVICE_ROLE_KEY|KAGGLE_API_TOKEN/);
  return Response.json({ref:`owner/${pilotSlug}`,versionNumber:1});
 });
 assert.equal((await client.start()).submitted,true);
});
test('Kaggle recusa token inválido, erro remoto e resposta malformada sem revelar mensagens',async()=>{
 const invalid=createKagglePilotClient('key',async()=>Response.json({active:false,username:'owner'}));
 await assert.rejects(invalid.check(),/kaggle_token_invalid/);
 const rejected=createKagglePilotClient('key',async()=>new Response('private-details',{status:403}));
 await assert.rejects(rejected.check(),/kaggle_http_403/);
 const malformed=createKagglePilotClient('key',async()=>new Response('not-json'));
 await assert.rejects(malformed.check(),/kaggle_response_invalid/);
});

test('Kaggle recupera somente relatório estruturado e nomes dos arquivos, sem logs e URLs privadas',async()=>{
 const client=createKagglePilotClient('key',async url=>{
  if(url.endsWith('IntrospectToken'))return Response.json({active:true,username:'owner'});
  if(url.endsWith('GetKernelSessionStatus'))return Response.json({status:'COMPLETE'});
  return Response.json({files:[{fileName:'gpu-report.json',url:'https://private-download.example/token'}],log:JSON.stringify([{data:JSON.stringify({cuda_available:true,devices:[{name:'Tesla T4',vram_bytes:16000000000}],secret:'private-info'})}])});
 });
 const result=await client.status();assert.equal(result.gpuReport.cudaAvailable,true);assert.equal(result.gpuReport.devices[0].name,'Tesla T4');
 assert.deepEqual(result.outputFiles,['gpu-report.json']);assert.doesNotMatch(JSON.stringify(result),/private-info|private-download/);
});
