import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {canAttemptGoogleSignIn,googleAuthAvailability,googleSignInOptions} from '../src/lib/google-auth.ts';

test('OAuth pode ser tentado após falha temporária, mas aguarda confirmação durante a consulta e respeita disabled',()=>{
 assert.equal(canAttemptGoogleSignIn('loading'),false);
 assert.equal(canAttemptGoogleSignIn('enabled'),true);
 assert.equal(canAttemptGoogleSignIn('unavailable'),true);
 assert.equal(canAttemptGoogleSignIn('disabled'),false);
});

test('login Google confirma provedor no Supabase sem confundir configuração ausente com habilitação',async()=>{
 for(const [body,expected] of [[{external:{google:true}},'enabled'],[{external:{google:false}},'disabled'],[{},'unavailable']]){
  assert.equal(await googleAuthAvailability('https://project.supabase.co/','public',async(url,init)=>{
   assert.equal(url,'https://project.supabase.co/auth/v1/settings');assert.equal(init.headers.apikey,'public');assert.equal(init.redirect,'error');return Response.json(body);
  }),expected);
 }
 assert.equal(await googleAuthAvailability('https://project.supabase.co','public',async()=>new Response('',{status:503})),'unavailable');
 assert.equal(await googleAuthAvailability('https://project.supabase.co','public',async()=>{throw Error('network')}),'unavailable');
});
test('OAuth solicita somente identidade e retorna ao próprio site, sem autorizar Flow ou YouTube',()=>{
 const options=googleSignInOptions('https://meu-vendedor.example/somewhere?next=https://attacker.example');
 assert.equal(options.provider,'google');assert.equal(options.options.redirectTo,'https://meu-vendedor.example/entrar');
 assert.equal(options.options.scopes,'openid email profile');assert.equal(options.options.queryParams.prompt,'select_account');
 assert.equal(googleSignInOptions('http://localhost:3000').options.redirectTo,'http://localhost:3000/entrar');
 assert.throws(()=>googleSignInOptions('http://example.com'));
 assert.throws(()=>googleSignInOptions('javascript:alert(1)'));
});

test('formulário mantém login Google e PKCE, com conexão Flow em Contas',async()=>{
 const [form,provider,client,hub,redirect,studio]=await Promise.all([
  readFile(new URL('../src/components/auth/AuthForm.tsx',import.meta.url),'utf8'),
  readFile(new URL('../src/components/auth/AuthProvider.tsx',import.meta.url),'utf8'),
  readFile(new URL('../src/lib/supabase/client.ts',import.meta.url),'utf8'),
  readFile(new URL('../src/components/auth/AccountHub.tsx',import.meta.url),'utf8'),
  readFile(new URL('../src/components/auth/AccountRedirect.tsx',import.meta.url),'utf8'),
  readFile(new URL('../src/components/videos/ProductVideoStudio.tsx',import.meta.url),'utf8'),
 ]);
 assert.match(form,/Continuar com Google/);
 assert.match(form,/canAttemptGoogleSignIn\(googleAvailability\)/);
 assert.match(provider,/onAuthStateChange/);
 assert.match(provider,/auth\.getSession\(\)/);
 assert.match(provider,/eventReceived/);
 assert.match(client,/flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true/);
 assert.match(hub,/<GoogleFlowConnection/);
 assert.match(hub,/import \{ GoogleFlowConnection \} from "\.\/GoogleFlowConnection"/);
 assert.match(studio,/Abrir Google Flow/);
 assert.match(studio,/https:\/\/labs\.google\/fx\/tools\/flow/);
 assert.match(hub,/<YouTubeConnection/);
 assert.match(redirect,/router\.replace\("\/entrar#lojas"\)/);
});
