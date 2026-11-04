import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { amazonProducts } from '../supabase/functions/catalog/_shared/amazon.ts';
import { aliexpressProducts, aliSignature } from '../supabase/functions/catalog/_shared/aliexpress.ts';
import { tiktokProducts, tiktokSignature, TIKTOK_PRODUCT_PATH } from '../supabase/functions/catalog/_shared/tiktok.ts';
import { mercadoLivreProducts } from '../supabase/functions/catalog/_shared/mercadolivre.ts';
import { providerJson, queryInput, https } from '../supabase/functions/catalog/_shared/common.ts';
import { accountConfigurations, createCatalogHandler, sourceStatuses } from '../supabase/functions/catalog/_shared/service.ts';

const query = {keywords:'',categoryId:'',discountsOnly:false};
const json = value => new Response(JSON.stringify(value), {headers:{'Content-Type':'application/json'}});
const amazonConfig = {clientId:'test-client',clientSecret:'test-secret-not-real',partnerTag:'test-owner-20'};
const aliConfig = {appKey:'test-key',appSecret:'test-secret-not-real',trackingId:'test-tracking'};
const tiktokConfig = {appKey:'test-key',appSecret:'test-secret-not-real',accessToken:'test-creator-token'};
const mlConfig = {accessToken:'test-owner-token',categoryId:'MLB432825'};
const amazonItem = {asin:'B000000001',detailPageURL:'https://www.amazon.com.br/dp/B000000001?tag=test-owner-20',itemInfo:{title:{displayValue:'Produto de teste'}},images:{primary:{medium:{url:'https://m.media-amazon.com/images/test.jpg'}}},offersV2:{listings:[{violatesMAP:false,price:{money:{amount:90,currency:'BRL'},savings:{percentage:10}},merchantInfo:{name:'Loja teste'}}]}};

test('Amazon: OAuth client_credentials, marketplace BR, filtro de desconto e resposta OffersV2',async()=>{
 const calls=[];
 const result=await amazonProducts(amazonConfig,{...query,keywords:'cafeteira',discountsOnly:true},async(url,init)=>{
  calls.push(url);const body=JSON.parse(init.body);assert.equal(init.redirect,'error');
  if(calls.length===1){assert.equal(url,'https://api.amazon.com/auth/o2/token');assert.equal(body.grant_type,'client_credentials');assert.equal(body.scope,'creatorsapi::default');assert.equal(body.client_secret,amazonConfig.clientSecret);return json({access_token:'test-access-token',expires_in:3600});}
  assert.equal(url,'https://creatorsapi.amazon/catalog/v1/searchItems');assert.equal(init.headers.Authorization,'Bearer test-access-token');assert.equal(init.headers['x-marketplace'],'www.amazon.com.br');
  assert.equal(body.marketplace,'www.amazon.com.br');assert.equal(body.partnerTag,amazonConfig.partnerTag);assert.equal(body.minSavingPercent,1);assert.equal(body.itemCount,10);
  return json({searchResult:{items:[amazonItem]}});
 });
 assert.equal(calls.length,2);assert.equal(result.products[0].price,90);assert.equal(result.products[0].currency,'BRL');assert.equal(result.products[0].discountPercent,10);assert.equal(result.products[0].rank,null);
 assert.ok(!JSON.stringify(result).includes(amazonConfig.clientSecret));
});

test('Amazon: preço MAP oculto, erros parciais e domínio de produto incorreto não viram sucesso',async()=>{
 const mock=item=>async(url)=>url.includes('/auth/')?json({access_token:'test-token'}):json({searchResult:{items:[item]}});
 const result=await amazonProducts(amazonConfig,query,mock({...amazonItem,offersV2:{listings:[{...amazonItem.offersV2.listings[0],violatesMAP:true}]}}));
 assert.equal(result.products[0].price,null);assert.equal(result.products[0].discountPercent,null);
 await assert.rejects(amazonProducts(amazonConfig,query,mock({...amazonItem,detailPageURL:'https://amazon.com.br.attacker.test/item'})),e=>e.code==='invalid_response');
 await assert.rejects(amazonProducts(amazonConfig,query,async(url)=>url.includes('/auth/')?json({access_token:'test-token'}):json({errors:[{message:amazonConfig.clientSecret}],searchResult:{items:[amazonItem]}})),e=>e.code==='provider_rejected'&&!e.message.includes(amazonConfig.clientSecret));
});

test('AliExpress: assinatura TOP ignora sign, campos BRL/PT/BR e IDs Int64 preservados',async()=>{
 const params={b:'ação',a:'1',sign:'ignored'};
 assert.equal(aliSignature(params,'test-secret'),createHash('md5').update('test-secret'+'a1bação'+'test-secret').digest('hex').toUpperCase());
 const result=await aliexpressProducts(aliConfig,query,async(url,init)=>{
  assert.equal(url,'https://eco.taobao.com/router/rest');const p=Object.fromEntries(new URLSearchParams(init.body));
  assert.equal(p.method,'aliexpress.affiliate.hotproduct.query');assert.equal(p.target_currency,'BRL');assert.equal(p.target_language,'PT');assert.equal(p.ship_to_country,'BR');assert.equal(p.page_size,'20');assert.equal(p.sort,'LAST_VOLUME_DESC');
  assert.equal(p.sign,aliSignature(p,aliConfig.appSecret));assert.match(p.timestamp,/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  return new Response('{"aliexpress_affiliate_hotproduct_query_response":{"resp_result":{"resp_code":200,"result":{"current_record_count":1,"products":{"product":[{"product_id":9007199254740993,"product_title":"Produto teste","product_detail_url":"https://www.aliexpress.com/item/9007199254740993.html","target_sale_price":"19.90","target_sale_price_currency":"BRL","discount":"20%","lastest_volume":123}]}}}}}');
 });
 assert.equal(result.products[0].id,'9007199254740993');assert.equal(result.products[0].sales,'123');assert.equal(result.products[0].price,19.9);assert.equal(result.products[0].discountPercent,20);
});

test('AliExpress: lista vazia, resposta comercial recusada e moeda ausente preservam estado real',async()=>{
 assert.deepEqual((await aliexpressProducts(aliConfig,query,async()=>json({aliexpress_affiliate_hotproduct_query_response:{resp_result:{resp_code:200,result:{current_record_count:0}}}}))).products,[]);
 await assert.rejects(aliexpressProducts(aliConfig,query,async()=>json({error_response:{msg:aliConfig.appSecret}})),e=>e.code==='provider_rejected'&&!e.message.includes(aliConfig.appSecret));
});

test('TikTok: usa token de criador e assinatura do corpo exato; ordena units_sold sem inventar desconto',async()=>{
 const params={timestamp:'1700000000',app_key:'key',sign:'ignored',access_token:'ignored'};
 const body='{"title_keywords":["ação"]}';
 assert.equal(tiktokSignature('/test',params,body,'secret'),createHmac('sha256','secret').update('secret/testapp_keykeytimestamp1700000000'+body+'secret').digest('hex'));
 const result=await tiktokProducts(tiktokConfig,query,async(raw,init)=>{
  const url=new URL(raw),params=Object.fromEntries(url.searchParams);
  assert.equal(url.pathname,TIKTOK_PRODUCT_PATH);assert.equal(params.sort_field,'units_sold');assert.equal(params.sort_order,'DESC');assert.equal(params.page_size,'20');
  assert.equal(params.sign,tiktokSignature(url.pathname,params,init.body,tiktokConfig.appSecret));assert.equal(init.headers['x-tts-access-token'],tiktokConfig.accessToken);
  return new Response('{"code":0,"data":{"products":[{"id":9007199254740993,"title":"Produto teste","detail_link":"https://shop.tiktok.com/view/product/9007199254740993","units_sold":55,"original_price":{"minimum_amount":"100","maximum_amount":"200","currency":"BRL"},"sales_price":{"minimum_amount":"80","maximum_amount":"150","currency":"BRL"}}]}}');
 });
 assert.equal(result.products[0].id,'9007199254740993');assert.equal(result.products[0].price,80);assert.equal(result.products[0].discountPercent,null);assert.equal(result.products[0].sales,'55');
 await assert.rejects(tiktokProducts(tiktokConfig,query,async()=>json({code:401,message:tiktokConfig.accessToken})),e=>e.code==='provider_rejected'&&!e.message.includes(tiktokConfig.accessToken));
});

test('TikTok: desconto só é calculado com preços únicos e moedas iguais',async()=>{
 const item={id:'12345',title:'Produto teste',detail_link:'https://shop.tiktok.com/view/product/12345',original_price:{minimum_amount:'100',maximum_amount:'100',currency:'BRL'},sales_price:{minimum_amount:'80',maximum_amount:'80',currency:'BRL'}};
 const result=await tiktokProducts(tiktokConfig,{...query,discountsOnly:true},async()=>json({code:0,data:{products:[item,{...item,id:'12346',original_price:{...item.original_price,currency:'USD'}}]}}));
 assert.equal(result.products.length,1);assert.equal(result.products[0].discountPercent,20);
});

test('Mercado Livre: trata ITEM, PRODUCT e USER_PRODUCT, preserva ranking e não presume preço de catálogo',async()=>{
 const result=await mercadoLivreProducts(mlConfig,query,async(url,init)=>{
  assert.equal(init.headers.Authorization,'Bearer test-owner-token');
  if(url.includes('/highlights/'))return json({content:[{id:'MLB1',position:1,type:'ITEM'},{id:'MLB2',position:2,type:'PRODUCT'},{id:'MLBU3',position:3,type:'USER_PRODUCT'}]});
  if(url.endsWith('/items/MLB1'))return json({title:'Item teste',price:80,original_price:100,currency_id:'BRL',permalink:'https://produto.mercadolivre.com.br/MLB-1',pictures:[{secure_url:'https://http2.mlstatic.com/test.jpg'}]});
  if(url.endsWith('/products/MLB2'))return json({name:'Produto catálogo',permalink:'https://www.mercadolivre.com.br/p/MLB2'});
  if(url.endsWith('/user-products/MLBU3'))return json({name:'User product teste'});
  throw Error('Unexpected endpoint');
 });
 assert.deepEqual(result.products.map(p=>p.rank),[1,2,3]);assert.equal(result.products[0].discountPercent,20);assert.equal(result.products[1].price,null);assert.equal(result.products[2].productUrl,null);
});

test('Mercado Livre: detalhe recusado gera aviso sem renumerar ranking; 429 aborta a consulta',async()=>{
 const mock=async(url)=>url.includes('/highlights/')?json({content:[{id:'MLB1',position:1,type:'ITEM'},{id:'MLB2',position:2,type:'PRODUCT'}]}):url.endsWith('MLB1')?new Response('private',{status:403}):json({name:'Produto teste'});
 const result=await mercadoLivreProducts(mlConfig,query,mock);assert.equal(result.products[0].rank,2);assert.match(result.warnings.join(' '),/1 detalhes/);
 await assert.rejects(mercadoLivreProducts(mlConfig,query,async(url)=>url.includes('/highlights/')?json({content:[{id:'MLB1',position:1,type:'ITEM'}]}):new Response('rate limited',{status:429})),e=>e.code==='rate_limited');
 await assert.rejects(mercadoLivreProducts({...mlConfig,categoryId:'../../secret'},query),e=>e.code==='invalid_category');
});

test('HTTP: timeout/redirecionamento, tamanho, JSON inválido e erros são sanitizados',async()=>{
 for(const status of [401,403,429,500])await assert.rejects(providerJson('https://example.test',{},async()=>new Response('private-token',{status})),e=>!e.message.includes('private-token')&&e.status!==200);
 await assert.rejects(providerJson('https://example.test',{},async()=>{throw Error('private-token');}),e=>e.code==='provider_unavailable'&&!e.message.includes('private-token'));
 await assert.rejects(providerJson('https://example.test',{},async()=>new Response('x'.repeat(2_000_001))),e=>e.code==='invalid_response');
 for(const raw of ['null','[]','invalid'])await assert.rejects(providerJson('https://example.test',{},async()=>new Response(raw)),e=>e.code==='invalid_response');
 for(const url of ['javascript:alert(1)','http://example.test','https://user:pass@example.test','https://amazon.com.br.attacker.test'])assert.equal(https(url,['amazon.com.br']),null);
 assert.throws(()=>queryInput({keywords:'a'.repeat(121)}));assert.throws(()=>queryInput({categoryId:'../../x'}));assert.throws(()=>queryInput({discountsOnly:'true'}));
});

const accounts=JSON.stringify({alice:{amazon:amazonConfig,mercadolivre:mlConfig,tiktok:tiktokConfig,aliexpress:aliConfig},bob:{}});
const request=(body,token='alice',origin)=>new Request('https://example.test/catalog',{method:'POST',headers:{...(token?{Authorization:`Bearer ${token}`} : {}),...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});

test('handler: autenticação obrigatória, CORS, método e limite de corpo antes de consultar provedores',async()=>{
 let calls=0;
 const handler=createCatalogHandler({authenticate:async token=>token==='alice'?'alice':null,accounts:()=>accounts,fetcher:async()=>{calls++;return json({});}});
 assert.equal((await handler(request({action:'status'},null))).status,401);
 assert.equal((await handler(request({action:'status'},'invalid'))).status,401);
 assert.equal((await handler(request({action:'status'},'alice','https://attacker.test'))).status,403);
 assert.equal((await handler(new Request('https://example.test',{method:'GET'}))).status,405);
 assert.equal((await handler(request({action:'search',platform:'amazon',keywords:'a'.repeat(5000)}))).status,413);
 assert.equal(calls,0);
});

test('handler: credenciais isoladas por usuário verificado e ausentes das respostas de status',async()=>{
 const handler=createCatalogHandler({authenticate:async token=>['alice','bob'].includes(token)?token:null,accounts:()=>accounts});
 const a=await (await handler(request({action:'status'}))).json();assert.equal(a.sources.filter(p=>p.configured).length,4);assert.ok(!JSON.stringify(a).includes(amazonConfig.clientSecret));
 const b=await (await handler(request({action:'status',userId:'alice'},'bob'))).json();assert.equal(b.sources.filter(p=>p.configured).length,0);
 const denied=await handler(request({action:'search',platform:'amazon',userId:'alice'},'bob'));assert.equal(denied.status,409);assert.equal((await denied.json()).error.code,'credentials_required');
 for(const platform of ['magalu','shein']){const response=await handler(request({action:'search',platform}));assert.equal(response.status,409);assert.equal((await response.json()).error.code,'not_implemented');}
 assert.deepEqual(accountConfigurations(accounts,'__proto__'),{});
 assert.equal(sourceStatuses({}).filter(p=>p.implemented).length,4);
});

test('handler: bloqueio de concorrência/cooldown e falhas de uma conta não simulam conexão',async()=>{
 let now=10000,resolve;
 const pending=new Promise(r=>{resolve=r;});
 const handler=createCatalogHandler({authenticate:async()=> 'alice',accounts:()=>accounts,now:()=>now,fetcher:async(url)=>{
  if(url.includes('/auth/')){await pending;return json({access_token:'test-token'});}
  return json({searchResult:{items:[]}});
 }});
 const first=handler(request({action:'search',platform:'amazon'}));
 await new Promise(r=>setTimeout(r,0));
 assert.equal((await handler(request({action:'search',platform:'amazon'}))).status,429);
 resolve();const response=await first;assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.deepEqual((await response.json()).products,[]);
 assert.equal((await handler(request({action:'search',platform:'amazon'}))).status,429);
 now+=5001;assert.equal((await handler(request({action:'search',platform:'amazon'}))).status,200);
});
