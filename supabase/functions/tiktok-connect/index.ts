import { createClient } from "npm:@supabase/supabase-js@2.119.0";
const PROJECT = Deno.env.get("SUPABASE_URL") ?? "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CLIENT = Deno.env.get("TIKTOK_CLIENT_KEY") ?? "";
const SECRET = Deno.env.get("TIKTOK_CLIENT_SECRET") ?? "";
const ENC = Deno.env.get("TIKTOK_TOKEN_ENCRYPTION_KEY") ?? "";
const SITE = "https://meu-vendedor.httpsgithubcomwarllemedicaosunshine-budget-guidegit.workers.dev";
const CALLBACK = PROJECT + "/functions/v1/tiktok-connect/callback";
const db = createClient(PROJECT, SERVICE, {auth:{persistSession:false}});
const headers = {"Content-Type":"application/json","Cache-Control":"no-store","Access-Control-Allow-Origin":SITE,"Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply = (status:number, code:string, extra:Record<string,unknown>={}) => new Response(JSON.stringify({code,...extra}),{status,headers});
const encode = (bytes:Uint8Array) => btoa(String.fromCharCode(...bytes));
const decode = (v:string) => Uint8Array.from(atob(v),c=>c.charCodeAt(0));
const sha = async (s:string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,"0")).join("");
const random = () => encode(crypto.getRandomValues(new Uint8Array(32))).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
async function key() { const raw=decode(ENC);if(raw.length!==32)throw Error("Invalid key");return crypto.subtle.importKey("raw",raw,"AES-GCM",false,["encrypt","decrypt"]); }
async function seal(s:string) {const iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv},await key(),new TextEncoder().encode(s));return {ciphertext:encode(new Uint8Array(encrypted)),iv:encode(iv)};}
async function unseal(ciphertext:string,iv:string) {return new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:decode(iv)},await key(),decode(ciphertext)));}
async function user(req:Request) {const bearer=req.headers.get("authorization")??"";if(!bearer.startsWith("Bearer "))return null;const client=createClient(PROJECT,ANON,{auth:{persistSession:false}});const {data,error}=await client.auth.getUser(bearer.slice(7));return error||!data.user||data.user.is_anonymous?null:data.user;}
async function token(body:URLSearchParams) {const res=await fetch("https://open.tiktokapis.com/v2/oauth/token/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body});const data=await res.json();if(!res.ok||!data.access_token)throw Error("token_exchange_failed");return data;}
async function fresh(connection:any) {
 if(Date.parse(connection.access_expires_at)>Date.now()+120000)return unseal(connection.access_ciphertext,connection.access_iv);
 if(Date.parse(connection.refresh_expires_at)<=Date.now())throw Error("refresh_expired");
 const t=await token(new URLSearchParams({client_key:CLIENT,client_secret:SECRET,grant_type:"refresh_token",refresh_token:await unseal(connection.refresh_ciphertext,connection.refresh_iv)}));
 const a=await seal(t.access_token),r=await seal(t.refresh_token);
 const {error}=await db.from("tiktok_connections").update({access_ciphertext:a.ciphertext,access_iv:a.iv,refresh_ciphertext:r.ciphertext,refresh_iv:r.iv,access_expires_at:new Date(Date.now()+t.expires_in*1000).toISOString(),refresh_expires_at:new Date(Date.now()+t.refresh_expires_in*1000).toISOString(),scopes:t.scope??connection.scopes}).eq("user_id",connection.user_id);
 if(error)throw Error("storage_failed");return t.access_token;
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 const url=new URL(req.url);
 const finish=(status:string)=>Response.redirect(SITE+"/entrar?tiktok="+encodeURIComponent(status)+"#google",303);
 if(!PROJECT||!ANON||!SERVICE||!CLIENT||!SECRET||!ENC)return reply(503,"oauth_not_configured");
 if(url.pathname.endsWith("/callback")&&req.method==="GET"){
   const state=url.searchParams.get("state")??"",code=url.searchParams.get("code")??"";
   if(!state||!code||state.length>256||code.length>4000)return finish("cancelled");
   const {data:row,error}=await db.from("tiktok_oauth_states").update({consumed_at:new Date().toISOString()}).eq("state_hash",await sha(state)).is("consumed_at",null).gt("expires_at",new Date().toISOString()).select("user_id").maybeSingle();
   if(error||!row)return finish("invalid_state");
   try{
    const t=await token(new URLSearchParams({client_key:CLIENT,client_secret:SECRET,code,grant_type:"authorization_code",redirect_uri:CALLBACK}));
    const a=await seal(t.access_token),r=await seal(t.refresh_token);
    const profileResponse=await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url",{headers:{Authorization:"Bearer "+t.access_token}});
    const profile=await profileResponse.json().catch(()=>({}));
    const info=profileResponse.ok?profile.data?.user??{}:{};
    const {error:saveError}=await db.from("tiktok_connections").upsert({user_id:row.user_id,open_id:t.open_id,display_name:info.display_name??null,avatar_url:info.avatar_url??null,scopes:t.scope??"",access_ciphertext:a.ciphertext,access_iv:a.iv,refresh_ciphertext:r.ciphertext,refresh_iv:r.iv,access_expires_at:new Date(Date.now()+t.expires_in*1000).toISOString(),refresh_expires_at:new Date(Date.now()+t.refresh_expires_in*1000).toISOString(),connected_at:new Date().toISOString()});
    return finish(saveError?"storage_failed":"connected");
   }catch{return finish("authorization_failed");}
 }
 if(req.method!=="POST")return reply(405,"method_not_allowed");
 const actor=await user(req);if(!actor)return reply(401,"unauthorized");
 const payload=await req.json().catch(()=>null);if(!payload||typeof payload.action!=="string")return reply(400,"invalid_request");
 if(payload.action==="start"){
  const state=random();
  const {error}=await db.from("tiktok_oauth_states").insert({state_hash:await sha(state),user_id:actor.id,expires_at:new Date(Date.now()+600000).toISOString()});
  if(error)return reply(500,"storage_failed");
  const auth=new URL("https://www.tiktok.com/v2/auth/authorize/");
  auth.search=new URLSearchParams({client_key:CLIENT,response_type:"code",scope:"user.info.basic,video.upload",redirect_uri:CALLBACK,state}).toString();
  return reply(200,"ok",{authorization_url:auth.toString()});
 }
 if(payload.action==="status"){
  const {data,error}=await db.from("tiktok_connections").select("display_name,avatar_url,scopes,connected_at").eq("user_id",actor.id).maybeSingle();
  return error?reply(500,"storage_failed"):reply(200,"ok",{connected:Boolean(data),account:data});
 }
 if(payload.action==="disconnect"){
  const {data}=await db.from("tiktok_connections").select("*").eq("user_id",actor.id).maybeSingle();
  if(data){try{const access=await fresh(data);await fetch("https://open.tiktokapis.com/v2/oauth/revoke/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_key:CLIENT,client_secret:SECRET,token:access})});}catch{/* local removal still proceeds */}}
  const {error}=await db.from("tiktok_connections").delete().eq("user_id",actor.id);
  return error?reply(500,"storage_failed"):reply(200,"ok");
 }
 if(payload.action==="upload_init"){
  const {data}=await db.from("tiktok_connections").select("*").eq("user_id",actor.id).maybeSingle();
  if(!data)return reply(409,"not_connected");
  if(!data.scopes.split(",").includes("video.upload"))return reply(403,"scope_not_granted");
  const size=payload.size, type=payload.mime_type;
  if(!Number.isSafeInteger(size)||size<1||size>64*1024*1024||type!=="video/mp4")return reply(400,"invalid_video");
  try {
   const access=await fresh(data);
   const chunkSize=size<=5*1024*1024?size:5*1024*1024;
   const total=Math.ceil(size/chunkSize);
   const response=await fetch("https://open.tiktokapis.com/v2/post/publish/inbox/video/init/",{method:"POST",headers:{Authorization:"Bearer "+access,"Content-Type":"application/json"},body:JSON.stringify({source_info:{source:"FILE_UPLOAD",video_size:size,chunk_size:chunkSize,total_chunk_count:total}})});
   const result=await response.json();
   if(!response.ok||result.error?.code!=="ok"||!result.data?.upload_url)return reply(502,"tiktok_api_error",{detail:result.error?.code??"invalid_response"});
   return reply(200,"ok",{upload_url:result.data.upload_url,publish_id:result.data.publish_id,chunk_size:chunkSize,total_chunk_count:total});
  }catch{return reply(502,"tiktok_api_error");}
 }
 if(payload.action==="upload_status"){
  const {data}=await db.from("tiktok_connections").select("*").eq("user_id",actor.id).maybeSingle();
  if(!data)return reply(409,"not_connected");
  if(typeof payload.publish_id!=="string"||payload.publish_id.length>300)return reply(400,"invalid_request");
  try{const access=await fresh(data);const response=await fetch("https://open.tiktokapis.com/v2/post/publish/status/fetch/",{method:"POST",headers:{Authorization:"Bearer "+access,"Content-Type":"application/json"},body:JSON.stringify({publish_id:payload.publish_id})});const result=await response.json();return reply(response.ok?200:502,response.ok?"ok":"tiktok_api_error",{data:result.data??null,detail:result.error?.code});}catch{return reply(502,"tiktok_api_error");}
 }
 if(payload.action==="creator_info"){
  const {data}=await db.from("tiktok_connections").select("*").eq("user_id",actor.id).maybeSingle();
  if(!data)return reply(409,"not_connected");
  try{const access=await fresh(data);if(!data.scopes.split(",").includes("video.publish"))return reply(403,"scope_not_granted");
   const response=await fetch("https://open.tiktokapis.com/v2/post/publish/creator_info/query/",{method:"POST",headers:{Authorization:"Bearer "+access,"Content-Type":"application/json"},body:"{}"});
   const result=await response.json();return reply(response.ok?200:502,response.ok?"ok":"tiktok_api_error",{data:response.ok?result.data:undefined});
  }catch{return reply(502,"tiktok_api_error");}
 }
 return reply(400,"invalid_action");
});
