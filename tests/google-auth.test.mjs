import test from 'node:test';
import assert from 'node:assert/strict';
import {googleAuthAvailability,googleSignInOptions} from '../src/lib/google-auth.ts';

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
