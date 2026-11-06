import test from 'node:test';
import assert from 'node:assert/strict';
import { routeAdvertisingScript } from '../supabase/functions/video-generation/_shared/script-router.ts';
import { createVideoGenerationHandler } from '../supabase/functions/video-generation/_shared/service.ts';
const configuration = { templateId: 'presenting-product', scenePresetId: 'neutral-product-table', durationSeconds: 6, format: '9:16', targetAudience: '', product: { name: 'Blusa de linho', description: 'Blusa leve', price: '', features: '' } };

test('roteiro troca Gemini sem créditos por Groq automaticamente e informa provedor verdadeiro', async () => {
  const calls=[];
  const result=await routeAdvertisingScript(configuration, { geminiKey:'private-gemini', groqKey:'private-groq', isFreeProvider:async()=>true, fetcher:async(url,init)=>{
    calls.push(String(url));
    if(String(url).includes('googleapis')) return new Response('{}',{status:429});
    const body=JSON.parse(init.body);
    assert.equal(body.model,'openai/gpt-oss-20b');
    assert.equal(body.max_completion_tokens,512);
    assert.equal(body.include_reasoning,false);
    assert.equal(body.reasoning_effort,'low');
    assert.equal(body.reasoning_format,undefined);
    assert.equal(init.headers.Authorization,'Bearer private-groq');
    return Response.json({choices:[{message:{content:'Conheça a blusa de linho e confira os detalhes.'}}]});
  }});
  assert.equal(result.provider,'groq');
  assert.equal(calls.length,2);
  assert.ok(!JSON.stringify(result).includes('private-'));
});

test('roteiro usa OpenRouter gratuito e depois sugestão local se todos falharem', async () => {
  const opts={groqKey:'groq',openRouterKey:'router',isFreeProvider:async()=>true,fetcher:async(url,init)=>{
    if(String(url).includes('groq')) return new Response('{}',{status:402});
    assert.equal(JSON.parse(init.body).model,'openrouter/free');
    return Response.json({choices:[{message:{content:'Confira a blusa de linho e veja os detalhes.'}}]});
  }};
  assert.equal((await routeAdvertisingScript(configuration,opts)).provider,'openrouter');
  const local=await routeAdvertisingScript(configuration,{...opts,fetcher:async()=>{throw new Error('offline')}});
  assert.equal(local.provider,'local');
  assert.match(local.script,/Blusa de linho/);
});

test('handler permite fallback de roteiro com chave Groq e sem chave Gemini', async () => {
  const handler=createVideoGenerationHandler({authenticate:async()=> 'user',geminiApiKey:()=>undefined,geminiScriptEnabled:()=>true,scriptProvidersConfigured:()=>true,videoJobsEnabled:()=>false,videoProcessorAvailable:()=>false,generateScript:async()=>{throw new Error('must not use Gemini')},generateScriptWithFallback:async()=>({script:'Roteiro via Groq com fatos informados.',provider:'groq',model:'openai/gpt-oss-20b'})});
  const response=await handler(new Request('https://example.test/video-generation',{method:'POST',headers:{Authorization:'Bearer user-session','Content-Type':'application/json'},body:JSON.stringify({action:'generate-script',configuration})}));
  assert.equal(response.status,200);
  assert.equal((await response.json()).provider,'groq');
});


test('chaves cadastradas sem prova de plano gratuito nunca acionam Gemini/Groq', async () => {
 const calls=[];
 const result=await routeAdvertisingScript(configuration,{geminiKey:'could-be-paid',groqKey:'could-be-paid',openRouterKey:'router',fetcher:async(url,init)=>{
  calls.push(String(url));
  const body=JSON.parse(init.body);
  assert.equal(body.model,'openrouter/free');
  assert.deepEqual(body.provider.max_price,{prompt:0,completion:0,request:0,image:0});
  return new Response('{}',{status:429});
 }});
 assert.deepEqual(calls,['https://openrouter.ai/api/v1/chat/completions']);
 assert.equal(result.provider,'local');
});
