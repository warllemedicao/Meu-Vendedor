import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Hyperbrowser } from "npm:@hyperbrowser/sdk";
import { chromium } from "npm:playwright-core";
const cors={"access-control-allow-origin":"*","access-control-allow-headers":"authorization, x-client-info, apikey, content-type","access-control-allow-methods":"POST, OPTIONS"};
const respond=(value:unknown,status=200)=>Response.json(value,{status,headers:{"cache-control":"no-store",...cors}});
const openFlow=async(endpoint:unknown)=>{if(typeof endpoint!=="string"||!endpoint.startsWith("wss://"))return false;let browser;try{browser=await chromium.connectOverCDP(endpoint,{timeout:12000});const context=browser.contexts()[0];if(!context)return false;const page=context.pages()[0]??await context.newPage();await page.goto("https://flow.google.com/",{waitUntil:"domcontentloaded",timeout:20000});return true;}catch(e){console.warn("hyperbrowser_flow_navigation_failed",{name:e instanceof Error?e.name:"unknown"});return false;}finally{await browser?.close().catch(()=>{});}};
const validLive=(value:unknown)=>{if(typeof value!=="string")return null;try{const u=new URL(value);return u.protocol==="https:"&&u.searchParams.has("token")&&((u.hostname==="app.hyperbrowser.ai"&&u.pathname==="/live")||(/^dp-[a-z0-9-]+\.hxproxy\.io$/.test(u.hostname)&&/^\/browser\/[0-9a-f-]{36}\/live\/vnc\.html$/.test(u.pathname)&&u.searchParams.has("path")))?value:null;}catch{return null;}};
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return respond({error:"method_not_allowed"},405);
 const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),admin=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),key=Deno.env.get("HYPERBROWSER_API_KEY");
 if(!url||!anon||!admin)return respond({error:"backend_not_configured"},503);
 const bearer=req.headers.get("authorization")??"";
 if(!/^Bearer [A-Za-z0-9_.-]{20,8192}$/.test(bearer))return respond({error:"unauthorized"},401);
 try{
  const auth=await fetch(url+"/auth/v1/user",{headers:{apikey:anon,authorization:bearer},signal:AbortSignal.timeout(8000)});
  if(!auth.ok)return respond({error:"unauthorized"},401);
  const user=await auth.json();
  if(!user?.id||!user?.email_confirmed_at)return respond({error:"confirmed_account_required"},403);
  const input=await req.json().catch(()=>({}));
  if(!["status","create-profile","start-login","save-login"].includes(input.action))return respond({error:"invalid_action"},400);
  const path=url+"/rest/v1/hyperbrowser_profiles?user_id=eq."+encodeURIComponent(user.id);
  const headers={apikey:admin,authorization:"Bearer "+admin};
  const existing=await fetch(path+"&select=profile_id,session_id,session_started_at,login_saved",{headers,signal:AbortSignal.timeout(8000)});
  if(!existing.ok)return respond({error:"profile_storage_unavailable"},503);
  const rows=await existing.json();let row=rows[0];
  if(input.action==="status")return respond({configured:Boolean(key),profileReady:Boolean(row),loginSaved:Boolean(row?.login_saved),sessionActive:Boolean(row?.session_id)});
  if(!key)return respond({error:"hyperbrowser_key_missing"},503);
  let stage="initialize_client";
  const client=new Hyperbrowser({apiKey:key});
  const update=async(data:Record<string,unknown>)=>{
   const res=await fetch(path,{method:"PATCH",headers:{...headers,"content-type":"application/json","prefer":"return=minimal"},body:JSON.stringify(data),signal:AbortSignal.timeout(8000)});
   if(!res.ok)throw new Error("profile_update_failed");
  };
  if(!row){
   stage="create_profile";
   const profile=await client.profiles.create({name:"meu-vendedor-google-flow-"+user.id});
   if(!profile?.id)return respond({error:"profile_creation_failed"},502);
   const saved=await fetch(url+"/rest/v1/hyperbrowser_profiles",{method:"POST",headers:{...headers,"content-type":"application/json","prefer":"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify({user_id:user.id,profile_id:profile.id}),signal:AbortSignal.timeout(8000)});
   if(!saved.ok)return respond({error:"profile_storage_failed"},503);
   row={profile_id:profile.id,session_id:null,login_saved:false};
  }
  if(input.action==="create-profile")return respond({configured:true,profileReady:true,loginSaved:Boolean(row.login_saved)});
  if(input.action==="save-login"){
   if(!row.session_id)return respond({error:"no_active_session"},409);
   await client.sessions.stop(row.session_id);
   await update({session_id:null,session_started_at:null,login_saved:true});
   return respond({configured:true,profileReady:true,loginSaved:true,sessionActive:false});
  }
  if(row.session_id){
   try{
    stage="get_existing_session";
    const old=await client.sessions.get(row.session_id);
    const live=validLive(old?.liveUrl);
    const started=row.session_started_at?new Date(row.session_started_at).getTime():0;
    if(live&&started&&Date.now()-started<12*60*1000)return respond({configured:true,profileReady:true,sessionActive:true,loginSaved:Boolean(row.login_saved),liveViewUrl:live,navigationReady:await openFlow(old?.wsEndpoint)});
    await client.sessions.stop(row.session_id).catch(()=>{});
   }catch{/* expired remote session */}
   await update({session_id:null,session_started_at:null});
  }
  stage="create_session";
  const session=await client.sessions.create({profile:{id:row.profile_id,persistChanges:true}});
  stage="validate_live_url";
  const live=validLive(session?.liveUrl);
  if(!live){let shape:Record<string,unknown>={};try{const u=new URL(String(session?.liveUrl??""));shape={protocol:u.protocol,hostname:u.hostname,pathname:u.pathname,queryKeys:[...u.searchParams.keys()].sort()};}catch{shape={parseable:false};}console.error("hyperbrowser_session_missing_live_url",{stage,hasSessionId:Boolean(session?.id),hasLiveUrl:Boolean(session?.liveUrl),liveUrlType:typeof session?.liveUrl,shape});}
  if(!session?.id||!live){if(session?.id)await client.sessions.stop(session.id).catch(()=>{});return respond({error:"live_view_unavailable"},502);}
  stage="persist_session";
  try{await update({session_id:session.id,session_started_at:new Date().toISOString()});}
  catch(e){await client.sessions.stop(session.id).catch(()=>{});throw e;}
  return respond({configured:true,profileReady:true,sessionActive:true,loginSaved:Boolean(row.login_saved),liveViewUrl:live,navigationReady:await openFlow(session?.wsEndpoint)});
 }catch(e){console.error("google_flow_login_setup_error",{stage:typeof stage==="string"?stage:"unknown",errorName:e instanceof Error?e.name:"unknown",message:e instanceof Error?e.message.slice(0,300):"unknown"});return respond({error:"hyperbrowser_unavailable"},502);}
});