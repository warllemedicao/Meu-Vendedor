import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { encryptionKey } from '../supabase/functions/marketplace/_shared/credentials.ts';
import { authorizationUrl, createGoogleYouTube, decryptGoogleValue, encryptGoogleValue, YouTubeError, youtubeScopes } from '../supabase/functions/youtube-connection/_shared/google.ts';
import { createYouTubeHandler } from '../supabase/functions/youtube-connection/_shared/handler.ts';

const uid='11111111-1111-4111-8111-111111111111';
const user={id:uid,email:'owner@example.test',confirmed:true};
const channel={id:'UCabcdefghijklmnopqrstuv',title:'Canal de teste'};
const callback='https://jzchlrvxdaffnrgbvabv.supabase.co/functions/v1/youtube-connection';
const origin='https://meu-vendedor.httpsgithubcomwarllemedicaosunshine-budget-guidegit.workers.dev';
const secretKey=()=>encryptionKey(btoa('k'.repeat(32)));
const token=()=>({access_token:'private-access',refresh_token:'private-refresh',scope:youtubeScopes.join(' '),expires_at:Date.now()+3600000});
const post=body=>new Request(callback,{method:'POST',headers:{Authorization:'Bearer session','Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});

async function setup(overrides={}){
 const key=await secretKey();let pending=null,opened=false,consumed=false,saved=null,exchanges=0,refreshes=0;
 const deps={clientId:'531516167196-test.apps.googleusercontent.com',callback,ready:()=>true,key:async()=>key,
  authenticate:async t=>t==='session'?user:null,user:async()=>user,
  begin:async row=>{pending=row;opened=false;consumed=false;},
  open:async hash=>{if(!pending||pending.state_hash!==hash||opened)return null;opened=true;return pending;},
  consume:async hash=>{if(!pending||pending.state_hash!==hash||!opened||consumed)return null;consumed=true;return pending;},
  finish:async(hash,row)=>{assert.equal(hash,pending.state_hash);saved={...row,status:'connected',verified_at:new Date().toISOString()};pending=null;},
  get:async id=>id===uid?saved:null,
  update:async(id,previous,tokens,selected)=>{if(!saved||saved.encrypted_tokens!==previous)return false;saved={...saved,encrypted_tokens:tokens,channel_id:selected.id,channel_title:selected.title};return true;},
  expire:async()=>{},disconnect:async()=>{saved=null;pending=null;},
  exchange:async()=>{exchanges++;return token();},refresh:async()=>{refreshes++;return token();},
  identity:async()=>({subject:'google-subject',email:user.email}),channels:async()=>[channel],...overrides};
 const handler=createYouTubeHandler(deps);
 async function start(){const r=await handler(post({action:'start'}));assert.equal(r.status,200);const begin=(await r.json()).url;
  const b=await handler(new Request(begin));assert.equal(b.status,302);return{state:new URL(begin).searchParams.get('begin'),cookie:b.headers.get('set-cookie').split(';')[0],authorization:new URL(b.headers.get('location'))};}
 return{handler,start,get saved(){return saved;},get pending(){return pending;},get exchanges(){return exchanges;},get refreshes(){return refreshes;}};
}

test('YouTube authorization uses fixed endpoints, offline access, state and S256 PKCE',async()=>{
 const url=new URL(await authorizationUrl('client-id',callback,'state','verifier',user.email));
 assert.equal(url.origin,'https://accounts.google.com');assert.equal(url.searchParams.get('redirect_uri'),callback);
 assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(url.searchParams.get('access_type'),'offline');
 assert.equal(url.searchParams.get('state'),'state');assert.equal(url.searchParams.get('scope'),youtubeScopes.join(' '));
 assert(!url.href.includes('client_secret'));assert(!url.href.includes('code_verifier'));
});

test('Google token encryption is bound to the owner and rejects tampering',async()=>{
 const key=await secretKey();const encrypted=await encryptGoogleValue(token(),key,uid);
 assert(!encrypted.includes('private-access'));assert.equal((await decryptGoogleValue(encrypted,key,uid)).refresh_token,'private-refresh');
 await assert.rejects(decryptGoogleValue(encrypted,key,'another-user'));
 await assert.rejects(decryptGoogleValue(encrypted.slice(0,-8)+'AAAAAAAA',key,uid));
});

test('YouTube rejects anonymous users and external origins without exposing secrets',async()=>{
 const{handler}=await setup();
 assert.equal((await handler(new Request(callback,{method:'POST',body:'{"action":"start"}'}))).status,401);
 assert.equal((await handler(new Request(callback,{method:'POST',headers:{Origin:'https://evil.test'},body:'{}'}))).status,403);
 assert.equal((await handler(post({action:'start',extra:'x'.repeat(5000)}))).status,413);
 const status=await handler(post({action:'status'}));assert.equal(status.status,200);assert.doesNotMatch(await status.text(),/private-|encrypted_tokens|client_secret/);
});

test('OAuth callback requires the same browser and is consumed exactly once',async()=>{
 const app=await setup();const flow=await app.start();assert(flow.cookie.startsWith('__Secure-'));
 const responseUrl=`${callback}?state=${flow.state}&code=one-use-code`;
 const rejected=await app.handler(new Request(responseUrl));assert(rejected.headers.get('location').includes('youtube_browser_mismatch'));assert.equal(app.exchanges,0);
 const done=await app.handler(new Request(responseUrl,{headers:{Cookie:flow.cookie}}));assert.equal(done.status,303);
 assert(done.headers.get('location').includes('youtube=connected'));assert(!done.headers.get('location').includes('code='));assert.equal(app.exchanges,1);
 assert.equal(app.saved.channel_id,channel.id);assert(!app.saved.encrypted_tokens.includes('private-refresh'));
 const replay=await app.handler(new Request(responseUrl,{headers:{Cookie:flow.cookie}}));assert(replay.headers.get('location').includes('youtube_authorization_expired'));assert.equal(app.exchanges,1);
});

test('another Google account or cancelled consent cannot replace the connection',async()=>{
 const mismatch=await setup({identity:async()=>({subject:'other',email:'other@example.test'})});const f=await mismatch.start();
 const result=await mismatch.handler(new Request(`${callback}?state=${f.state}&code=code`,{headers:{Cookie:f.cookie}}));assert(result.headers.get('location').includes('youtube_account_mismatch'));assert.equal(mismatch.saved,null);
 const cancel=await setup();const c=await cancel.start();const r=await cancel.handler(new Request(`${callback}?state=${c.state}&error=access_denied`,{headers:{Cookie:c.cookie}}));
 assert(r.headers.get('location').includes('youtube=cancelled'));assert.equal(cancel.exchanges,0);
});

test('YouTube status and verify expose channel metadata only; disconnect preserves application login',async()=>{
 const app=await setup();const flow=await app.start();await app.handler(new Request(`${callback}?state=${flow.state}&code=code`,{headers:{Cookie:flow.cookie}}));
 const verify=await app.handler(post({action:'verify'}));assert.equal(verify.status,200);const body=await verify.json();assert.equal(body.channel.title,channel.title);assert.equal(body.uploadAuthorized,true);
 assert.doesNotMatch(JSON.stringify(body),/private-access|private-refresh|encrypted_tokens/);assert.equal(app.refreshes,0);
 assert.equal((await app.handler(post({action:'select-channel',channelId:'UCnot-owned-channelxxxxx'}))).status,409);
 const disconnected=await app.handler(post({action:'disconnect'}));assert.equal((await disconnected.json()).connected,false);
 assert.equal((await app.handler(post({action:'status'}))).status,200);
});

test('Google REST refresh retains the refresh token and refuses partial permissions',async()=>{
 let calls=0;
 const api=createGoogleYouTube('client','secret',callback,async(url,options)=>{
  calls++;assert.equal(url,'https://oauth2.googleapis.com/token');assert.equal(options.redirect,'error');
  const params=new URLSearchParams(options.body);assert.equal(params.get('client_secret'),'secret');assert.equal(params.get('grant_type'),'refresh_token');
  return Response.json({access_token:'new-access',expires_in:3600,scope:youtubeScopes.join(' ')});
 });
 const refreshed=await api.refresh(token());assert.equal(refreshed.refresh_token,'private-refresh');assert.equal(refreshed.access_token,'new-access');assert.equal(calls,1);
 const partial=createGoogleYouTube('client','secret',callback,async()=>Response.json({access_token:'access',refresh_token:'refresh',expires_in:3600,scope:'openid email'}));
 await assert.rejects(partial.exchange('code','verifier'),e=>e.code==='youtube_permissions_missing');
});

test('expired access is renewed on the server, and revoked refresh marks only the original connection',async()=>{
 const app=await setup({exchange:async()=>({...token(),expires_at:Date.now()-1000})});
 const flow=await app.start();await app.handler(new Request(`${callback}?state=${flow.state}&code=code`,{headers:{Cookie:flow.cookie}}));
 assert.equal((await app.handler(post({action:'verify'}))).status,200);assert.equal(app.refreshes,1);
 let expired;
 const revoked=await setup({exchange:async()=>({...token(),expires_at:Date.now()-1000}),refresh:async()=>{throw new YouTubeError('youtube_reauthorization_required','Reconnect',409);},expire:async(...args)=>{expired=args;}});
 const f=await revoked.start();await revoked.handler(new Request(`${callback}?state=${f.state}&code=code`,{headers:{Cookie:f.cookie}}));
 const previous=revoked.saved.encrypted_tokens;
 assert.equal((await revoked.handler(post({action:'verify'}))).status,409);assert.deepEqual(expired,[uid,previous]);
});

test('a verification finishing after disconnect cannot recreate a saved connection',async()=>{
 const app=await setup({update:async()=>false});const flow=await app.start();
 await app.handler(new Request(`${callback}?state=${flow.state}&code=code`,{headers:{Cookie:flow.cookie}}));
 const r=await app.handler(post({action:'verify'}));assert.equal(r.status,409);assert.equal((await r.json()).error.code,'youtube_connection_changed');
});

test('Postgres keeps OAuth tokens private and prevents completion after disconnect or replay',async()=>{
 const db=new PGlite();
 try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);');
  await db.exec(await readFile(new URL('../supabase/migrations/20261106233237_youtube_connection.sql',import.meta.url),'utf8'));
  await db.query('insert into auth.users values($1)',[uid]);
  const hash='a'.repeat(64);
  const begin=()=>db.query("select public.mv_begin_youtube_oauth($1,$2,'owner@example.test','encrypted-verifier')",[uid,hash]);
  const finish=()=>db.query("select public.mv_finish_youtube_connection($1,$2,'subject','owner@example.test',$3,'Canal','encrypted-tokens',array['scope'])",[uid,hash,channel.id]);
  await begin();await assert.rejects(finish(),/youtube_authorization_expired/);
  await db.query('update public.mv_youtube_oauth_states set opened_at=now(),consumed_at=now() where state_hash=$1',[hash]);
  await finish();assert.equal((await db.query('select * from public.mv_youtube_connections')).rows.length,1);
  await assert.rejects(finish(),/youtube_authorization_expired/);
  await begin();await db.query('update public.mv_youtube_oauth_states set opened_at=now(),consumed_at=now()');
  await db.query('select public.mv_disconnect_youtube($1)',[uid]);await assert.rejects(finish(),/youtube_authorization_expired/);
  assert.equal((await db.query('select * from public.mv_youtube_connections')).rows.length,0);
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select * from public.mv_youtube_connections'),/permission denied/);
  await assert.rejects(db.query('select * from public.mv_youtube_oauth_states'),/permission denied/);
  await assert.rejects(begin(),/permission denied/);
 }finally{await db.close();}
});
