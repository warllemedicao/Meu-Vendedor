import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {signedBody,fetchShopeeProducts,generateShopeeLink,normalizeProduct,shopeeRequest,validateCredentials,shopeeUrl} from '../supabase/functions/marketplace/_shared/shopee.ts';
import {encryptionKey,encryptCredentials,decryptCredentials,secretMatches} from '../supabase/functions/marketplace/_shared/credentials.ts';
const credentials={appId:'12345',secret:'test-secret-only-not-a-real-key'};
const product={itemId:'9007199254740993',shopId:'123',productName:'Produto de teste',productLink:'https://shopee.com.br/product/123/9007199254740993',price:'10.50',priceMin:'10.50',priceMax:'12',commissionRate:'0.1',commission:'1.05',sales:'50',ratingStar:'4.5',priceDiscountRate:10,periodEndTime:2000000000};
test('assinatura usa o mesmo corpo UTF-8 enviado, credencial e timestamp oficiais',async()=>{
 const query='query Test{productOfferV2{nodes{productName}}}';const variables={keyword:'ação'};
 const result=await signedBody(credentials,query,variables,1700000000);
 const hash=createHash('sha256').update(credentials.appId+'1700000000'+result.body+credentials.secret).digest('hex');
 assert.equal(result.authorization,`SHA256 Credential=12345, Timestamp=1700000000, Signature=${hash}`);
 assert.deepEqual(JSON.parse(result.body),{query,variables});assert.ok(!result.authorization.includes(credentials.secret));
});
test('consulta pagina, limita a 60 ofertas, preserva Int64 e normaliza preço/comissão',async()=>{
 let count=0;
 const mock=async(url,options)=>{
  assert.equal(url,'https://open-api.affiliate.shopee.com.br/graphql');assert.equal(options.method,'POST');
  const {variables}=JSON.parse(options.body);assert.equal(variables.page,++count);assert.equal(variables.limit,20);
  return new Response(`{"data":{"productOfferV2":{"nodes":[${JSON.stringify({...product,itemId:undefined}).replace('"shopId":"123"','"itemId":9007199254740993,"shopId":123')}],"pageInfo":{"hasNextPage":true}}}}`);
 };
 const result=await fetchShopeeProducts(credentials,mock);assert.equal(count,3);assert.equal(result.length,1);
 assert.equal(result[0].item_id,'9007199254740993');assert.equal(result[0].external_id,'123:9007199254740993');assert.equal(result[0].commission_rate,0.1);assert.equal(result[0].price_min,10.5);
});
test('lista vazia válida não inventa produtos; falha de uma página aborta sincronização',async()=>{
 assert.deepEqual(await fetchShopeeProducts(credentials,async()=>new Response(JSON.stringify({data:{productOfferV2:{nodes:[],pageInfo:{hasNextPage:false}}}}))),[]);
 let n=0;
 await assert.rejects(fetchShopeeProducts(credentials,async()=>++n===1?new Response(JSON.stringify({data:{productOfferV2:{nodes:[product],pageInfo:{hasNextPage:true}}}})):new Response('error',{status:503})),error=>error.code==='provider_unavailable');
});
test('erros de provedor são sanitizados e credenciais/URLs inválidas são rejeitadas',async()=>{
 await assert.rejects(shopeeRequest(credentials,'query{}',{},async()=>new Response(JSON.stringify({errors:[{message:credentials.secret}]}))),error=>!error.message.includes(credentials.secret)&&error.code==='provider_rejected');
 await assert.rejects(shopeeRequest(credentials,'query{}',{},async()=>new Response('',{status:429})),error=>error.code==='rate_limited');
 await assert.rejects(shopeeRequest(credentials,'query{}',{},async()=>{throw Error(credentials.secret);}),error=>error.code==='provider_unavailable'&&!error.message.includes(credentials.secret));
 assert.throws(()=>validateCredentials({appId:'123\nInjected',secret:'test'}));assert.throws(()=>normalizeProduct({...product,productLink:'javascript:alert(1)'}));
 for(const url of ['https://shopee.com.br.evil.test/a','http://shopee.com.br/a','https://user:pass@shopee.com.br/a','https://evil.test/a'])assert.equal(shopeeUrl(url),null);
});
test('link usa a conta autenticada na API e nunca aceita resposta fora dos domínios Shopee',async()=>{
 const fetcher=async(_url,options)=>{
  const body=JSON.parse(options.body);assert.equal(body.variables.input.originUrl,product.productLink);assert.match(body.query,/generateShortLink/);
  return new Response(JSON.stringify({data:{generateShortLink:{shortLink:'https://s.shopee.com.br/example'}}}));
 };
 assert.equal(await generateShopeeLink(credentials,product.productLink,fetcher),'https://s.shopee.com.br/example');
 await assert.rejects(generateShopeeLink(credentials,product.productLink,async()=>new Response(JSON.stringify({data:{generateShortLink:{shortLink:'https://evil.test'}}}))),error=>error.code==='invalid_response');
});
test('AES-GCM associa credenciais ao usuário, detecta adulteração e usa IV aleatório',async()=>{
 const key=await encryptionKey(btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))));
 const a=await encryptCredentials(credentials,key,'alice');const b=await encryptCredentials(credentials,key,'alice');assert.notEqual(a,b);assert.ok(!a.includes(credentials.secret));
 assert.deepEqual(await decryptCredentials(a,key,'alice'),credentials);
 await assert.rejects(decryptCredentials(a,key,'bob'));
 const pieces=a.split('.');pieces[2]=(pieces[2][0]==='A'?'B':'A')+pieces[2].slice(1);await assert.rejects(decryptCredentials(pieces.join('.'),key,'alice'));
 assert.equal(await secretMatches('abc','abc'),true);assert.equal(await secretMatches('abc','xyz'),false);assert.equal(await secretMatches(null,'abc'),false);
});

test('corpo de requisição é limitado inclusive sem Content-Length e só aceita objeto JSON',async()=>{
 const {readLimitedObject}=await import('../supabase/functions/marketplace/_shared/http.ts');
 assert.deepEqual(await readLimitedObject(new Request('https://example.test',{method:'POST',body:'{"action":"sync"}'})),{action:'sync'});
 for(const body of ['[]','null','invalid'])await assert.rejects(readLimitedObject(new Request('https://example.test',{method:'POST',body})),error=>error.status===400);
 await assert.rejects(readLimitedObject(new Request('https://example.test',{method:'POST',body:'x'.repeat(4097)})),error=>error.status===413);
});
