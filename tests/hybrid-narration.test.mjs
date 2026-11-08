import test from 'node:test';
import assert from 'node:assert/strict';
import {buildHybridNarration} from '../src/lib/hybrid-video.ts';
test('short avatar suggestion contains product facts without speaking direction or inventing claims',()=>{
 const speech=buildHybridNarration({name:'Camisa de linho',features:'Linho natural\nManga curta',description:'',price:'R$ 89,90'});
 assert.match(speech,/Camisa de linho/);assert.match(speech,/Linho natural/);assert.match(speech,/R\$ 89,90/);
 assert.doesNotMatch(speech,/ABERTURA|DIREÇÃO|ENCERRAMENTO|desconto|garantia/);
 assert.ok(speech.length<=180);
 const long=buildHybridNarration({name:'x'.repeat(160),features:'y'.repeat(1000),description:'',price:'R$ 10'});
 assert.ok(long.length<=180);assert.doesNotMatch(long,/\.\.\./);assert.match(long,/R\$ 10/);
});
test('hybrid handoff accepts actual fresh and cached audio handler replies without a status field',async()=>{
 const {createAudioHandler}=await import('../supabase/functions/audio-generation/_shared/handler.ts');
 const {completedNarrationId}=await import('../src/lib/hybrid-video.ts');
 const id='22222222-2222-4222-8222-222222222222',user='11111111-1111-4111-8111-111111111111';let cached=false;
 const row={id,status:'completed',result_path:`${user}/audio/${id}.mp3`,commercial:true,tier:'google-chirp3-hd'};
 const handler=createAudioHandler({providerId:'google-tts',model:'google-chirp3-hd',authenticate:async()=>user,configured:()=>true,
  account:async()=>({tier:'google-chirp3-hd',remaining:1000,commercial:true}),
  voices:async()=>[{id:'pt-BR-Chirp3-HD-Kore',name:'Kore',gender:'female',language:'pt-BR',category:'premade'}],
  claim:async()=>({claimed:!cached,generation:row}),synthesize:async()=>new Uint8Array(200),
  upload:async()=>{},complete:async()=>{},fail:async()=>{},read:async()=>row,sign:async()=>`https://storage.example/${row.result_path}`});
 for(const expected of [201,200]){
  const response=await handler(new Request('https://example.test/audio',{method:'POST',headers:{authorization:'Bearer session','content-type':'application/json'},body:JSON.stringify({action:'generate',text:'Conheça este produto.',voiceId:'pt-BR-Chirp3-HD-Kore',purpose:'commercial'})}));
  assert.equal(response.status,expected);const payload=await response.json();assert.equal(payload.status,undefined);assert.equal(completedNarrationId(payload),id);cached=true;
 }
 assert.throws(()=>completedNarrationId({id,status:'submitting'}),/não foi confirmada/);
});
