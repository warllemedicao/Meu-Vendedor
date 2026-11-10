import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { IntegrationError, validateCredentials, fetchShopeeProducts, generateShopeeLink, fetchShopeePage, validateBrowseQuery } from "./_shared/shopee.ts";
import { readLimitedObject } from "./_shared/http.ts";
import { encryptionKey, encryptCredentials, decryptCredentials, secretMatches } from "./_shared/credentials.ts";

type Connection = { id:string;user_id:string;platform_id:string;status:string;last_sync_at:string|null };
const appUrl = "https://meu-vendedor.httpsgithubcomwarllemedicaosunshine-budget-guidegit.workers.dev";
const origins = new Set([appUrl,"http://localhost:3000"]);
const db = createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
function checked<T>(result:{data:T;error:unknown}):T {
  if(result.error)throw new IntegrationError("storage_error","Não foi possível salvar ou consultar os dados. Tente novamente.",500);
  return result.data;
}
async function getConnection(userId:string):Promise<Connection|null> {
  return checked(await db.from("mv_connections").select("id,user_id,platform_id,status,last_sync_at").eq("user_id",userId).eq("platform_id","shopee").maybeSingle()) as Connection|null;
}
async function credentialsFor(connectionId:string,userId:string,key:CryptoKey) {
  const row=checked(await db.from("mv_connection_secrets").select("encrypted_value").eq("connection_id",connectionId).single());
  try{if(!row)throw new Error("missing_credentials");return validateCredentials(await decryptCredentials(row.encrypted_value,key,userId));}
  catch{throw new IntegrationError("credentials_unavailable","Reconecte a conta Shopee para atualizar suas credenciais.",409);}
}
const browseCache = new Map<string, { expires: number; pending: Promise<unknown> }>();
async function browse(userId: string, body: Record<string, unknown>) {
  const query = validateBrowseQuery(body);
  const connection = await getConnection(userId);
  if (!connection) throw new IntegrationError("not_connected", "Conecte sua conta Shopee para consultar os produtos.", 409);
  const cacheKey = JSON.stringify([userId, connection.id, query]);
  const cached = browseCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.pending;
  const pending = (async () => {
    const key = await encryptionKey(Deno.env.get("MV_CREDENTIAL_ENCRYPTION_KEY") ?? "");
    const credentials = await credentialsFor(connection.id, userId, key);
    const result = await fetchShopeePage(credentials, query);
    const syncedAt = new Date().toISOString();
    const products = result.products.length ? checked(await db.from("mv_products").upsert(result.products.map(product => ({ ...product, user_id: userId, connection_id: connection.id, platform_id: "shopee", synced_at: syncedAt, in_latest_sync: true })), { onConflict: "connection_id,external_id" }).select("*")) : [];
    const ordered = result.products.map(product => (products ?? []).find(row => row.external_id === product.external_id));
    return { products: ordered, page: result.page, hasNextPage: result.hasNextPage, searchFallback: result.searchFallback, fetchedAt: syncedAt };
  })();
  for (const [id, entry] of browseCache) if (entry.expires <= Date.now()) browseCache.delete(id);
  if (browseCache.size >= 128) browseCache.delete(browseCache.keys().next().value!);
  browseCache.set(cacheKey, { expires: Date.now() + 10000, pending });
  try { return await pending; } catch (error) { browseCache.delete(cacheKey); throw error; }
}
async function perform(action:string,userId:string,body:Record<string,unknown>) {
  const lockId=crypto.randomUUID();
  const acquired=checked(await db.rpc("mv_acquire_connector_lock",{p_user_id:userId,p_lock_id:lockId}));
  if(!acquired)throw new IntegrationError("operation_busy","Existe uma operação em andamento ou muito recente. Aguarde alguns segundos.",429);
  const started=new Date().toISOString();let connection:Connection|null=null;
  try {
    connection=await getConnection(userId);
    if(action==="disconnect") {
      if(connection)checked(await db.from("mv_connections").delete().eq("id",connection.id).eq("user_id",userId));
      return {disconnected:true,message:"Conexão e credenciais removidas do Meu Vendedor. A revogação da chave na Shopee é feita no portal oficial."};
    }
    const key=await encryptionKey(Deno.env.get("MV_CREDENTIAL_ENCRYPTION_KEY") ?? "");
    if(action==="connect") {
      const credentials=validateCredentials(body);
      const products=await fetchShopeeProducts(credentials);
      const encrypted=await encryptCredentials(credentials,key,userId);
      const id=checked(await db.rpc("mv_publish_shopee_sync",{p_user_id:userId,p_lock_id:lockId,p_products:products,p_credentials:encrypted,p_started_at:started}));
      return {connectionId:id,productsCount:products.length,syncedAt:new Date().toISOString()};
    }
    if(!connection)throw new IntegrationError("not_connected","Conecte sua conta Shopee antes de continuar.",409);
    const credentials=await credentialsFor(connection.id,userId,key);
    if(action==="sync") {
      const products=await fetchShopeeProducts(credentials);
      checked(await db.rpc("mv_publish_shopee_sync",{p_user_id:userId,p_lock_id:lockId,p_products:products,p_started_at:started}));
      return {productsCount:products.length,syncedAt:new Date().toISOString()};
    }
    if(action==="generate_link") {
      if(typeof body.productId!=="string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.productId))throw new IntegrationError("invalid_product","Selecione um produto válido.",400);
      const product=checked(await db.from("mv_products").select("id,title,product_url,offer_ends_at,synced_at,in_latest_sync").eq("id",body.productId).eq("connection_id",connection.id).eq("user_id",userId).maybeSingle());
      if(!product)throw new IntegrationError("product_not_found","Produto não encontrado na sua conta.",404);
      if(Date.parse(product.synced_at)<Date.now()-3600000)throw new IntegrationError("stale_product","Atualize os produtos antes de gerar este link.",409);
      if(product.offer_ends_at && Date.parse(product.offer_ends_at)<=Date.now())throw new IntegrationError("offer_expired","Esta oferta expirou. Atualize a lista de produtos.",409);
      const url=await generateShopeeLink(credentials,product.product_url);
      return checked(await db.rpc("mv_save_generated_link",{p_user_id:userId,p_lock_id:lockId,p_product_id:product.id,p_url:url}));
    }
    throw new IntegrationError("invalid_action","Operação inválida.",400);
  } catch(error) {
    if(connection && action==="sync") {
      const code=error instanceof IntegrationError?error.code:"internal_error";
      // Não guardar respostas brutas, credenciais ou dados pessoais em erros/logs.
      await db.from("mv_connections").update({last_error_code:code,...(code==="provider_rejected"?{status:"error"}:{})}).eq("id",connection.id).eq("user_id",userId);
      await db.from("mv_sync_runs").insert({connection_id:connection.id,user_id:userId,status:"failed",error_code:code,started_at:started});
    }
    throw error;
  } finally { await db.rpc("mv_release_connector_lock",{p_user_id:userId,p_lock_id:lockId}); }
}
Deno.serve(async(request:Request) => {
  const origin=request.headers.get("Origin");
  const cors={"Access-Control-Allow-Origin":origin&&origins.has(origin)?origin:appUrl,"Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin","Cache-Control":"no-store"};
  const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:cors});
  if(origin && !origins.has(origin))return reply({error:{code:"origin_denied",message:"Origem não permitida."}},403);
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  if(request.method!=="POST")return reply({error:{code:"method_not_allowed",message:"Use POST."}},405);
  try {
    if(await secretMatches(request.headers.get("x-mv-job-token"),Deno.env.get("MV_SYNC_JOB_TOKEN")??"")) {
      const cutoff=new Date(Date.now()-25*60000).toISOString();
      const connections=checked(await db.from("mv_connections").select("user_id").eq("platform_id","shopee").eq("status","connected").lt("last_sync_at",cutoff).order("last_sync_at").limit(2));
      const results=[];
      for(const connection of connections??[]) {
        try{await perform("sync",connection.user_id,{});results.push({ok:true});}
        catch{results.push({ok:false});}
      }
      return reply({processed:results.length,results});
    }
    const token=request.headers.get("Authorization")?.match(/^Bearer (.+)$/i)?.[1];
    if(!token)throw new IntegrationError("unauthorized","Entre na sua conta do Meu Vendedor.",401);
    const {data:{user},error}=await db.auth.getUser(token);
    if(error || !user)throw new IntegrationError("unauthorized","Sua sessão expirou. Entre novamente.",401);
    const body=await readLimitedObject(request);
    if(body.platform!=="shopee")throw new IntegrationError("not_implemented","Esta plataforma ainda depende de integração e liberação próprias.",400);
    if(!["connect","sync","disconnect","generate_link","browse_products"].includes(String(body.action)))throw new IntegrationError("invalid_action","Operação inválida.",400);
    if(body.action === "browse_products") return reply(await browse(user.id, body));
    return reply(await perform(String(body.action),user.id,body));
  } catch(error) {
    if(error instanceof IntegrationError)return reply({error:{code:error.code,message:error.message}},error.status);
    const id=crypto.randomUUID();console.error(JSON.stringify({code:"internal_error",correlationId:id}));
    return reply({error:{code:"internal_error",message:"Não foi possível concluir a operação. Tente novamente.",correlationId:id}},500);
  }
});
