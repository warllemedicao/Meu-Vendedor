import test from 'node:test';
import assert from 'node:assert/strict';
import { approvedPhoto, listingPhotos, discoverPhotos, readPhoto } from '../supabase/functions/product-gallery/gallery.ts';
import { createGalleryHandler } from '../supabase/functions/product-gallery/service.ts';
import { assessProductPhoto } from '../src/lib/product-photo-filter.ts';
const product={platform:'shopee',shopId:'1426423897',itemId:'23599671693',title:'Garrafa térmica',imageUrl:'https://cf.shopee.com.br/file/cover-image-hash-123'};
const user='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
const image=(value)=>`https://cf.shopee.com.br/file/valid-image-hash-${value}`;
test('gallery reads only the matching item and skips recommendations, variants and duplicate thumbnails',()=>{
 const html='<script type="application/json">'+JSON.stringify({item:{itemid:product.itemId,shopid:product.shopId,images:[image(1),image(2),image(1)+'_tn'],models:[{images:[image('variant')]}]},recommendations:[{itemid:'other',shopid:product.shopId,images:[image('unrelated')]}]})+'</script><img src="'+image('banner')+'">';
 assert.deepEqual(listingPhotos(html,product),[image(1),image(2)]);
 const ld=images=>`<script type="application/ld+json">${JSON.stringify({'@type':'Product',name:product.title,url:'https://shopee.com.br/product/1/2',image:images})}</script>`;
 assert.deepEqual(listingPhotos(ld([image('wrong-same-title')]),product),[]);
 const wrongId=`<script type="application/ld+json">${JSON.stringify({'@type':'Product',name:product.title,itemid:'999',shopid:product.shopId,image:[image('wrong-id-same-title')]})}</script>`;
 assert.deepEqual(listingPhotos(wrongId,product),[]);
 assert.deepEqual(listingPhotos(ld([image('wrong')]).replace('/product/1/2',`/product/${product.shopId}/${product.itemId}`),product),[image('wrong')]);
});
test('gallery preserves Int64 IDs and refuses arbitrary hosts, credentials and ports',()=>{
 const big={...product,itemId:'9007199254740993'};
 const html='<script type="application/json">{"itemid":9007199254740993,"shopid":1426423897,"images":["'+image('big')+'"]}</script>';
 assert.deepEqual(listingPhotos(html,big),[image('big')]);
 for(const url of ['http://cf.shopee.com.br/file/x','https://127.0.0.1/file/x','https://cf.shopee.com.br.evil.test/file/x','https://cf.shopee.com.br:444/file/x','https://user:secret@cf.shopee.com.br/file/x']) assert.equal(approvedPhoto(url),null);
});
test('SPA shells, blocking and redirects fall back honestly to the cover without following arbitrary pages',async()=>{
 for(const response of [()=>new Response('<html><script src="spa.js"></script></html>'),()=>new Response('blocked',{status:403}),()=>new Response(null,{status:302,headers:{Location:'https://evil.test'}})]){
  let calls=0;const result=await discoverPhotos(product,async(url,options)=>{calls++;assert.equal(options.redirect,'manual');assert.equal(url,`https://shopee.com.br/product/${product.shopId}/${product.itemId}`);return response()});
  assert.equal(result.source,'cover');assert.deepEqual(result.urls,[product.imageUrl]);assert.match(result.warning,/só conseguimos importar a foto principal/);assert.equal(calls,1);
 }
});
test('photo download checks redirects, bytes and maximum size before saving',async()=>{
 const bytes=new Uint8Array(40);bytes.set([255,216,255]);
 assert.equal((await readPhoto(image('safe'),async()=>new Response(bytes))).mime,'image/jpeg');
 await assert.rejects(readPhoto(image('bad'),async()=>new Response('<html>not an image</html>')),/invalid_photo_content/);
 await assert.rejects(readPhoto(image('big'),async()=>new Response(bytes,{headers:{'content-length':String(6*1024*1024)}})),/source_too_large/);
 let calls=0;await assert.rejects(readPhoto(image('redirect'),async()=>{calls++;return new Response(null,{status:302,headers:{Location:'http://127.0.0.1/private'}})}),/invalid_photo_redirect/);assert.equal(calls,1);
});
test('gallery handler authenticates, scopes product lookup, deduplicates bytes and does not accept client URLs',async()=>{
 const stored=[];let lookup;
 const bytes=new Uint8Array(40);bytes.set([255,216,255]);
 const html=`<script type="application/json">${JSON.stringify({itemid:product.itemId,shopid:product.shopId,images:[image(1),image(2)]})}</script>`;
 const handler=createGalleryHandler({authenticate:async t=>t==='valid'?user:null,findProduct:async(...args)=>{lookup=args;return product},store:async(...args)=>stored.push(args),fetcher:async url=>new Response(url.includes('/product/')?html:bytes)});
 const req=token=>new Request('https://app.test',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({productId:id,userId:'victim',url:'https://evil.test'})});
 assert.equal((await handler(req('bad'))).status,401);assert.equal(lookup,undefined);
 const response=await handler(req('valid'));assert.equal(response.status,200);assert.deepEqual(lookup,[user,id]);
 const payload=await response.json();assert.equal(payload.photos.length,1);assert.equal(payload.listingUrl,`https://shopee.com.br/product/${product.shopId}/${product.itemId}`);assert.equal(stored.length,1);assert.ok(stored[0][0].startsWith(`${user}/inputs/gallery-${id}-`));
 assert.equal((await handler(req('valid'))).status,429);
});
test('unknown product causes no external requests and response errors do not expose internals',async()=>{
 let fetched=false;const handler=createGalleryHandler({authenticate:async()=>user,findProduct:async()=>null,store:async()=>{},fetcher:async()=>{fetched=true;throw Error('secret')}});
 const response=await handler(new Request('https://app.test',{method:'POST',body:JSON.stringify({productId:id})}));assert.equal(response.status,404);assert.equal(fetched,false);
});
test('OCR filter excludes specification tables and long descriptions but preserves brand labels',()=>{
 assert.equal(assessProductPhoto('TABELA DE MEDIDAS\nAltura 30 cm\nLargura 20 cm\nComprimento 15 cm',95).decision,'specification');
 assert.equal(assessProductPhoto('Conheça este produto de alta qualidade para seu dia a dia com todos os detalhes e benefícios descritos nesta imagem de divulgação comercial',90).decision,'description');
 assert.equal(assessProductPhoto('ACME',90).decision,'photo');
 assert.equal(assessProductPhoto('',0).decision,'photo');
 assert.equal(assessProductPhoto('Largura 20 cm',90).decision,'review');
 assert.equal(assessProductPhoto('ilegivel',12).decision,'review');
});
