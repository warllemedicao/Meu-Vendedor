import test from 'node:test';
import assert from 'node:assert/strict';
import { importSyncedProductImage } from '../supabase/functions/video-generation/_shared/product-image.ts';
import { importVideoProductImage } from '../src/lib/video-submission.ts';
import { createVideoGenerationHandler } from '../supabase/functions/video-generation/_shared/service.ts';

const user='11111111-1111-4111-8111-111111111111';
const product='22222222-2222-4222-8222-222222222222';
const bytes=new Uint8Array(40);bytes.set([0xff,0xd8,0xff]);
function deps(overrides={}){
 const stored=new Map();const calls=[];
 return {stored,calls,
  findProduct:async(uid,id)=>{calls.push(['lookup',uid,id]);return {platformId:'shopee',imageUrl:'https://cf.shopee.com.br/file/product-photo'};},
  existing:async path=>stored.get(path)??null,
  upload:async(path,body,mime)=>{calls.push(['upload',path,mime]);stored.set(path,body);},
  fetcher:async(url,options)=>{calls.push(['fetch',url,options]);return new Response(bytes,{headers:{'content-type':'image/jpeg'}});},
  ...overrides};
}
test('synced image is imported under the authenticated owner and reused without overwrite',async()=>{
 const d=deps();const first=await importSyncedProductImage(user,product,d);const again=await importSyncedProductImage(user,product,d);
 assert.equal(first.path,again.path);assert.match(first.path,new RegExp(`^${user}/inputs/product-${product}-[a-f0-9]{64}\\.jpg$`));
 assert.deepEqual(d.calls[0],['lookup',user,product]);assert.equal(d.calls.filter(c=>c[0]==='upload').length,1);
 const options=d.calls.find(c=>c[0]==='fetch')[2];assert.equal(options.redirect,'manual');assert(!('Authorization' in options.headers));
});
test('products outside the account and missing photos never cause an external request',async()=>{
 for(const value of [null,{platformId:'shopee',imageUrl:null}]){
  const d=deps({findProduct:async()=>value});await assert.rejects(importSyncedProductImage(user,product,d),e=>['product_not_found','product_image_missing'].includes(e.code));
  assert.equal(d.calls.length,0);
 }
});
test('image import refuses arbitrary URLs, credentials, private addresses and external redirects',async()=>{
 for(const url of ['http://cf.shopee.com.br/image','https://127.0.0.1/image','https://cf.shopee.com.br.evil.test/image','https://user:secret@cf.shopee.com.br/image','https://cf.shopee.com.br:444/image']){
  const d=deps({findProduct:async()=>({platformId:'shopee',imageUrl:url})});await assert.rejects(importSyncedProductImage(user,product,d),e=>e.code==='product_image_source_invalid');assert.equal(d.calls.length,0);
 }
 let requests=0;
 const d=deps({fetcher:async()=>{requests++;return new Response(null,{status:302,headers:{Location:'https://internal.evil.test/image'}});}});
 await assert.rejects(importSyncedProductImage(user,product,d),e=>e.code==='product_image_source_invalid');assert.equal(requests,1);
});
test('a redirect between approved CDNs is followed with no authorization headers',async()=>{
 let count=0;
 const d=deps({fetcher:async(url,options)=>{count++;assert(!options.headers.Authorization);return count===1?new Response(null,{status:302,headers:{Location:'https://down-br.img.susercontent.com/file/image'}}):new Response(bytes);}});
 assert((await importSyncedProductImage(user,product,d)).path.endsWith('.jpg'));assert.equal(count,2);
});
test('HTML and oversized images are rejected before storage',async()=>{
 for(const response of [()=>new Response('<html>Access denied</html>',{headers:{'content-type':'image/jpeg'}}),()=>new Response(bytes,{headers:{'content-length':String(10*1024*1024+1)}}),()=>new Response(new Uint8Array(10*1024*1024+1))]){
  const d=deps({fetcher:async()=>response()});await assert.rejects(importSyncedProductImage(user,product,d),e=>['product_image_format_invalid','product_image_too_large'].includes(e.code));assert.equal(d.stored.size,0);
 }
});
test('concurrent imports validate existing bytes rather than overwriting or trusting a collision',async()=>{
 let path;
 const d=deps({upload:async p=>{path=p;d.stored.set(p,bytes);throw new Error('duplicate');}});
 assert.equal((await importSyncedProductImage(user,product,d)).path,path);
 const invalid=deps({existing:async()=>new Uint8Array([1,2,3])});await assert.rejects(importSyncedProductImage(user,product,invalid),e=>e.code==='product_image_storage_invalid');
});
test('client imports by product ID only and validates the returned private image path',async()=>{
 const path=`${user}/inputs/synced-photo.jpg`;
 const client={functions:{invoke:async(name,options)=>{assert.equal(name,'video-generation');assert.deepEqual(options.body,{action:'import-product-image',productId:product});return {data:{path},error:null};}}};
 assert.equal(await importVideoProductImage(client,user,product),path);
 const wrongOwner={functions:{invoke:async()=>({data:{path:'another-user/inputs/image.jpg'},error:null})}};
 await assert.rejects(importVideoProductImage(wrongOwner,user,product),/área privada/);
});
test('image import handler requires authentication and ignores any URL/user ID supplied by the client',async()=>{
 let imported;
 const handler=createVideoGenerationHandler({authenticate:async t=>t==='session'?user:null,importProductImage:async(...args)=>{imported=args;return {path:`${user}/inputs/photo.jpg`};}});
 const req=(token,productId=product)=>new Request('https://example.test',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({action:'import-product-image',productId,userId:'victim',url:'https://evil.test/image'})});
 assert.equal((await handler(req('invalid'))).status,401);assert.equal(imported,undefined);
 assert.equal((await handler(req('session','not-a-uuid'))).status,400);
 const response=await handler(req('session'));assert.equal(response.status,200);assert.deepEqual(imported,[user,product]);
});
