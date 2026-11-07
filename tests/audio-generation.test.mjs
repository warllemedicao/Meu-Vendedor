import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createElevenLabs, voicesForAccount } from '../supabase/functions/audio-generation/_shared/elevenlabs.ts';
import { createAudioHandler } from '../supabase/functions/audio-generation/_shared/handler.ts';
import { splitGenerationTools } from '../src/lib/video-capabilities.ts';

const user = '11111111-1111-4111-8111-111111111111';
const audioId = '22222222-2222-4222-8222-222222222222';
const voices = [{ id: 'voice123', name: 'Voz de teste', gender: 'female', language: 'pt', category: 'premade' }];
const req = body => new Request('https://example.test/audio-generation', { method: 'POST', headers: { Authorization: 'Bearer session', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const body = { action: 'generate', text: 'Olá, esta é uma prévia de voz.', voiceId: 'voice123', purpose: 'preview' };
const deps = overrides => ({
  authenticate: async token => token === 'session' ? user : null,
  configured: () => true, account: async () => ({ tier: 'free', remaining: 10000, commercial: false }), voices: async () => voices,
  synthesize: async () => new Uint8Array(200),
  claim: async () => ({ claimed: true, generation: { id: audioId, status: 'submitting', result_path: null, commercial: false, tier: 'free' } }),
  complete: async () => {}, fail: async () => {}, upload: async () => {}, sign: async path => `https://storage.example/${path}`, read: async () => null,
  ...overrides,
});

test('ElevenLabs uses the private key, stable multilingual model and validates actual MP3 bytes', async () => {
  const bytes = new Uint8Array(200); bytes.set([0x49, 0x44, 0x33]);
  const provider = createElevenLabs('private-test-key', async (url, options) => {
    assert.equal(url, 'https://api.elevenlabs.io/v1/text-to-speech/voice123?output_format=mp3_44100_128');
    assert.equal(options.headers['xi-api-key'], 'private-test-key');
    assert.equal(options.redirect, 'error');
    assert.equal(JSON.parse(options.body).model_id, 'eleven_multilingual_v2');
    return new Response(bytes, { headers: { 'Content-Type': 'audio/mpeg' } });
  });
  assert.equal((await provider.synthesize(body.text, 'voice123')).length, 200);
  await assert.rejects(createElevenLabs('key', async () => new Response('{}', { headers: { 'Content-Type': 'application/json' } })).synthesize(body.text, 'voice123'), /não retornou áudio/);
});

test('audio requires a real session and only reads an owned result', async () => {
  const handler = createAudioHandler(deps({ read: async (uid, id) => { assert.equal(uid,user); assert.equal(id,audioId); return null; } }));
  assert.equal((await handler(new Request('https://example.test', { method: 'POST', body: '{}' }))).status,401);
  assert.equal((await handler(req({ action:'result',id:audioId }))).status,404);
});

test('Free voice preview works while commercial synthesis requires the account license', async () => {
  let synthesis = 0, uploads = 0;
  const handler = createAudioHandler(deps({ synthesize: async () => { synthesis++; return new Uint8Array(200); }, upload: async path => { uploads++; assert.equal(path,`${user}/audio/${audioId}.mp3`); } }));
  const blocked = await handler(req({ ...body, purpose:'commercial' }));
  assert.equal(blocked.status,409); assert.equal(synthesis,0);
  const preview = await handler(req(body));
  assert.equal(preview.status,201); assert.equal((await preview.json()).commercial,false); assert.equal(synthesis,1); assert.equal(uploads,1);
});

test('Free API excludes paid library voices even when they appear in the account voice list',()=>{
  const professional={...voices[0],id:'library-voice',category:'professional'};
  assert.deepEqual(voicesForAccount([professional,...voices],'free'),voices);
  assert.equal(voicesForAccount([professional,...voices],'creator').length,2);
});

test('completed requests reuse audio, uncertain submissions never synthesize again', async () => {
  let calls=0;
  const row={ id:audioId,status:'completed',result_path:`${user}/audio/${audioId}.mp3`,commercial:false,tier:'free' };
  const handler=createAudioHandler(deps({ claim:async()=>({claimed:false,generation:row}), synthesize:async()=>{calls++;return new Uint8Array(200);} }));
  const cached=await handler(req(body)); assert.equal(cached.status,200); assert.equal((await cached.json()).cached,true);
  row.status='uncertain'; row.result_path=null;
  assert.equal((await handler(req(body))).status,409);assert.equal(calls,0);
});

test('unconfirmed delivery is recorded as uncertain and does not retry the provider', async () => {
  let calls=0, failed;
  const handler=createAudioHandler(deps({ synthesize:async()=>{calls++;return new Uint8Array(200);}, upload:async()=>{throw new Error('storage down');}, fail:async(...args)=>{failed=args;} }));
  const response=await handler(req(body));assert.equal(response.status,503);assert.equal(calls,1);assert.equal(failed[1],true);
});

test('pending Google tools do not disable Magic Hour, Replicate or automatic mode',()=>{
  const groups=splitGenerationTools([
    {id:'auto',available:true},{id:'magic-hour',available:true},{id:'replicate',available:true},
    {id:'google-flow',available:false},{id:'youtube-create',available:false},
  ]);
  assert.deepEqual(groups.available.map(t=>t.id),['auto','magic-hour','replicate']);
  assert.deepEqual(groups.pending.map(t=>t.id),['google-flow','youtube-create']);
});

test('Postgres audio claim is idempotent, limits concurrent requests and isolates customer rows',async()=>{
  const db=new PGlite();
  const bob='33333333-3333-4333-8333-333333333333';
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
      create table auth.users(id uuid primary key);create table storage.buckets(id text primary key,allowed_mime_types text[]);
      insert into storage.buckets values('mv-video-assets',array['video/mp4']);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
    await db.exec(await readFile(new URL('../supabase/migrations/20261106224146_elevenlabs_audio.sql',import.meta.url),'utf8'));
    await db.query('insert into auth.users values($1),($2)',[user,bob]);
    const claim=async key => (await db.query("select public.mv_claim_audio_generation($1,$2,'free',false) as result",[user,key.repeat(64)])).rows[0].result;
    assert.equal((await claim('a')).claimed,true);assert.equal((await claim('a')).claimed,false);
    for(const key of ['b','c','d']) assert.equal((await claim(key)).claimed,true);
    await assert.rejects(claim('e'),/audio_rate_limit/);
    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[bob]);
    assert.equal((await db.query('select * from public.mv_audio_generations')).rows.length,0);
    await assert.rejects(claim('f'),/permission denied/);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
    assert.equal((await db.query('select * from public.mv_audio_generations')).rows.length,4);
    await assert.rejects(db.query("update public.mv_audio_generations set status='completed'"),/permission denied/);
  }finally{await db.close();}
});
