import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createGoogleTts, googleSpeechModel, presenterVoices } from '../supabase/functions/audio-generation/_shared/google-tts.ts';
import { createAudioHandler } from '../supabase/functions/audio-generation/_shared/handler.ts';

const project = 'meu-vendedor-1987';
async function credentials() {
  const pair = await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  return { pair, json: JSON.stringify({type:'service_account',project_id:project,client_email:`voice@${project}.iam.gserviceaccount.com`,
    private_key:`-----BEGIN PRIVATE KEY-----\n${Buffer.from(await crypto.subtle.exportKey('pkcs8',pair.privateKey)).toString('base64')}\n-----END PRIVATE KEY-----`,token_uri:'https://untrusted.example'}) };
}
const mp3 = Buffer.alloc(200); mp3.set([0x49,0x44,0x33]);
test('Google signs OAuth claims, fixes trusted destinations, caches token and emits validated pt-BR MP3',async()=>{
  const {pair,json}=await credentials(); let tokens=0, generations=0;
  const provider=createGoogleTts(json,project,async(url,options)=>{
    assert.equal(options.redirect,'error');
    if(url==='https://oauth2.googleapis.com/token') {
      tokens++; const assertion=new URLSearchParams(options.body).get('assertion'); const [header,claims,sig]=assertion.split('.');
      assert.equal(await crypto.subtle.verify('RSASSA-PKCS1-v1_5',pair.publicKey,Buffer.from(sig,'base64url'),Buffer.from(`${header}.${claims}`)),true);
      assert.equal(JSON.parse(Buffer.from(claims,'base64url')).aud,url);
      return Response.json({access_token:'private-oauth',expires_in:3600});
    }
    assert.equal(options.headers.Authorization,'Bearer private-oauth');
    assert.equal(options.headers['x-goog-user-project'],project);
    if(url.endsWith('voices?languageCode=pt-BR')) return Response.json({voices:[
      {name:presenterVoices.ana,languageCodes:['pt-BR'],ssmlGender:'FEMALE'},
      {name:'en-US-Chirp3-HD-Aoede',languageCodes:['en-US']},
      {name:'pt-BR-Standard-A',languageCodes:['pt-BR']},
    ]});
    assert.equal(url,'https://texttospeech.googleapis.com/v1/text:synthesize');generations++;
    const body=JSON.parse(options.body); assert.equal(body.voice.name,presenterVoices.ana); assert.equal(body.audioConfig.audioEncoding,'MP3');
    assert.equal(body.input.text,'Olá Brasil');
    return Response.json({audioContent:mp3.toString('base64')});
  });
  const [first,second]=await Promise.all([provider.voices(),provider.voices()]);
  assert.equal(first.length,1);assert.equal(second[0].language,'pt-BR');
  assert.equal((await provider.synthesize('Olá Brasil',presenterVoices.ana)).length,200);
  assert.equal(tokens,1);assert.equal(generations,1);
  await assert.rejects(provider.synthesize('Olá','en-US-Chirp3-HD-Aoede'),/voz brasileira/);
});
test('Google refuses malformed credentials/project mismatch and sanitizes permission failures',async()=>{
  const {json}=await credentials();let calls=0;
  const never=async()=>{calls++;throw new Error('private value')};
  await assert.rejects(createGoogleTts('{bad',project,never).voices(),/JSON/);
  await assert.rejects(createGoogleTts('null',project,never).voices(),e=>e.code==='google_tts_credentials_invalid');
  await assert.rejects(createGoogleTts(json,'other-project',never).voices(),/JSON/);
  assert.equal(calls,0);
  const provider=createGoogleTts(json,project,async url=>url.includes('oauth2')?Response.json({access_token:'secret',expires_in:3600}):
    Response.json({error:{message:'private-key-must-not-leak',details:[{reason:'SERVICE_DISABLED'}]}},{status:403}));
  await assert.rejects(provider.voices(),e=>e.code==='google_tts_api_disabled'&&!e.message.includes('private-key'));
});
test('Google validates MP3 content and never retries a synthesis with uncertain delivery',async()=>{
  const {json}=await credentials();let requests=0;
  const provider=createGoogleTts(json,project,async url=>{
    if(url.includes('oauth2')) return Response.json({access_token:'secret',expires_in:3600});
    requests++;return Response.json({audioContent:Buffer.from('not audio').toString('base64')});
  });
  await assert.rejects(provider.synthesize('Olá Brasil',presenterVoices.ana),e=>e.code==='audio_response_invalid');
  assert.equal(requests,1);
  const uncertain=createGoogleTts(json,project,async url=>{
    if(url.includes('oauth2')) return Response.json({access_token:'secret',expires_in:3600});
    throw new Error('network');
  });
  await assert.rejects(uncertain.synthesize('Olá Brasil',presenterVoices.ana),e=>e.code==='audio_submission_uncertain');
});
test('Google and ElevenLabs cannot collide in the idempotency cache',async()=>{
  const keys=[]; const user='11111111-1111-4111-8111-111111111111';
  const deps={authenticate:async()=>user,configured:()=>true,account:async()=>({tier:'paid',remaining:900000,commercial:true}),
    voices:async()=>[{id:presenterVoices.ana,name:'Ana',gender:'female',category:'google',language:'pt-BR'}],
    claim:async(_u,key,_t,_c,characters)=>{keys.push(key);assert.equal(characters,10);return{claimed:false,generation:{id:user,status:'completed',result_path:`${user}/audio/test.mp3`,commercial:true,tier:'paid'}}},
    sign:async()=> 'https://private.example',read:async()=>null,upload:async()=>{},complete:async()=>{},fail:async()=>{},synthesize:async()=>mp3};
  const request=()=>new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer session'},body:JSON.stringify({action:'generate',text:'Olá Brasil',voiceId:presenterVoices.ana,purpose:'commercial'})});
  assert.equal((await createAudioHandler({...deps,model:googleSpeechModel,providerId:'google-tts'})(request())).status,200);
  assert.equal((await createAudioHandler(deps)(request())).status,200);assert.notEqual(keys[0],keys[1]);
});
test('Google monthly reservation is shared, idempotent, persists after account deletion and denies clients',async()=>{
  const db=new PGlite();const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
      create table auth.users(id uuid primary key);create table storage.buckets(id text primary key,allowed_mime_types text[]);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
    await db.exec(await readFile(new URL('../supabase/migrations/20261106224146_elevenlabs_audio.sql',import.meta.url),'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/20261107233234_google_tts_budget.sql',import.meta.url),'utf8'));
    await db.query('insert into auth.users values($1),($2)',[a,b]);
    const claim=async(user,key,chars=10,limit=25)=>(await db.query('select public.mv_claim_google_audio($1,$2,$3,$4) as result',[user,key.repeat(64),chars,limit])).rows[0].result;
    assert.equal((await claim(a,'a')).claimed,true);assert.equal((await claim(a,'a')).claimed,false);
    assert.equal((await claim(b,'b')).claimed,true);await assert.rejects(claim(b,'c'),/audio_monthly_limit/);
    await assert.rejects(claim(b,'c',10,1000001),/invalid_audio_request/);
    await db.query('delete from auth.users where id=$1',[a]);
    assert.equal(Number((await db.query('select public.mv_google_audio_reserved_characters() as used')).rows[0].used),20);
    await assert.rejects(claim(b,'d'),/audio_monthly_limit/);
    await db.exec('set role authenticated');
    await assert.rejects(claim(b,'e'),/permission denied/);
    await assert.rejects(db.query('select * from public.mv_google_tts_usage'),/permission denied/);
    await assert.rejects(db.query('select public.mv_google_audio_reserved_characters()'),/permission denied/);
  } finally {await db.close();}
});
