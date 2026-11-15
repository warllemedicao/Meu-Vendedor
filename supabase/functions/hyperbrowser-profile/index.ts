import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Hyperbrowser } from "npm:@hyperbrowser/sdk";
import { requestFlowExecutor, type FlowMode } from "../_shared/flow-executor-diagnostics.ts";
const cors={"access-control-allow-origin":"*","access-control-allow-headers":"authorization, x-client-info, apikey, content-type","access-control-allow-methods":"POST, OPTIONS"};
const respond=(value:unknown,status=200)=>Response.json(value,{status,headers:{"cache-control":"no-store",...cors}});
const openFlow=(endpoint:unknown,mode:FlowMode="navigate",prompt?:string,imageMime?:string,imageBase64?:string,images?:Array<{mime:string;data:string}>,imageRightsConfirmed?:boolean,traceId=crypto.randomUUID())=>requestFlowExecutor({endpoint,mode,prompt,imageMime,imageBase64,images,imageRightsConfirmed,traceId,target:Deno.env.get("MV_HYPERBROWSER_EXECUTOR_URL"),secret:Deno.env.get("MV_HYPERBROWSER_EXECUTOR_SECRET")});
const validLive=(value:unknown)=>{if(typeof value!=="string")return null;try{const u=new URL(value);return u.protocol==="https:"&&u.searchParams.has("token")&&((u.hostname==="app.hyperbrowser.ai"&&u.pathname==="/live")||(/^dp-[a-z0-9-]+\.hxproxy\.io$/.test(u.hostname)&&/^\/browser\/[0-9a-f-]{36}\/live\/vnc\.html$/.test(u.pathname)&&u.searchParams.has("path")))?value:null;}catch{return null;}};
Deno.serve(async(req:Request)=>{
 const traceId=crypto.randomUUID();
 const reply=(value:Record<string,unknown>,status=200)=>respond({...value,traceId},status);
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return reply({error:"method_not_allowed"},405);
 const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),admin=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),key=Deno.env.get("HYPERBROWSER_API_KEY");
 if(!url||!anon||!admin)return reply({error:"backend_not_configured"},503);
 const bearer=req.headers.get("authorization")??"";
 if(!/^Bearer [A-Za-z0-9_.-]{20,8192}$/.test(bearer))return reply({error:"unauthorized"},401);
 try{
  const auth=await fetch(url+"/auth/v1/user",{headers:{apikey:anon,authorization:bearer},signal:AbortSignal.timeout(8000)});
  if(!auth.ok)return reply({error:"unauthorized"},401);
  const user=await auth.json();
  if(!user?.id||!user?.email_confirmed_at)return reply({error:"confirmed_account_required"},403);
  const input=await req.json().catch(()=>({}));
  if(!["status","create-profile","start-login","save-login","inspect-controls","create-flow-project","inspect-flow-editor","stage-flow-prompt","prepare-flow-draft","prepare-flow-image","inspect-flow-settings","click-flow-generate","start-click-recording","read-click-recording","stop-click-recording"].includes(input.action))return reply({error:"invalid_action"},400);
  const path=url+"/rest/v1/hyperbrowser_profiles?user_id=eq."+encodeURIComponent(user.id);
  const headers={apikey:admin,authorization:"Bearer "+admin};
  const existing=await fetch(path+"&select=profile_id,session_id,session_started_at,login_saved",{headers,signal:AbortSignal.timeout(8000)});
  if(!existing.ok)return reply({error:"profile_storage_unavailable"},503);
  const rows=await existing.json();let row=rows[0];
  if(input.action==="status")return reply({configured:Boolean(key),profileReady:Boolean(row),loginSaved:Boolean(row?.login_saved),sessionActive:Boolean(row?.session_id)});
  if(!key)return reply({error:"hyperbrowser_key_missing"},503);
  let stage="initialize_client";
  const client=new Hyperbrowser({apiKey:key});
  const update=async(data:Record<string,unknown>)=>{
   const res=await fetch(path,{method:"PATCH",headers:{...headers,"content-type":"application/json","prefer":"return=minimal"},body:JSON.stringify(data),signal:AbortSignal.timeout(8000)});
   if(!res.ok)throw new Error("profile_update_failed");
  };
  if(!row){
   stage="create_profile";
   const profile=await client.profiles.create({name:"meu-vendedor-google-flow-"+user.id});
   if(!profile?.id)return reply({error:"profile_creation_failed"},502);
   const saved=await fetch(url+"/rest/v1/hyperbrowser_profiles",{method:"POST",headers:{...headers,"content-type":"application/json","prefer":"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify({user_id:user.id,profile_id:profile.id}),signal:AbortSignal.timeout(8000)});
   if(!saved.ok)return reply({error:"profile_storage_failed"},503);
   row={profile_id:profile.id,session_id:null,login_saved:false};
  }
  if(input.action==="create-profile")return reply({configured:true,profileReady:true,loginSaved:Boolean(row.login_saved)});
  if(["inspect-controls","create-flow-project","inspect-flow-editor","inspect-flow-settings","stage-flow-prompt","prepare-flow-draft","click-flow-generate"].includes(input.action)){
   if(!row.session_id)return reply({error:"no_active_session"},409);
   stage="inspect_existing_session";
   const current=await client.sessions.get(row.session_id);
   if(current?.status!=="active"||!validLive(current?.liveUrl))return reply({error:"no_active_session"},409);
   if(["stage-flow-prompt","prepare-flow-draft","prepare-flow-image"].includes(input.action)&&(typeof input.prompt!=="string"||input.prompt.trim().length<1||input.prompt.length>4000))return reply({error:"invalid_prompt"},400);
   if(input.action==="prepare-flow-image"&&(!["image/png","image/jpeg","image/webp"].includes(input.imageMime)||typeof input.imageBase64!=="string"||input.imageBase64.length>4000000||input.imageBase64.length<8))return reply({error:"invalid_image"},400);
   if(input.action==="prepare-flow-draft"&&input.images!==undefined&&(!Array.isArray(input.images)||input.images.length>3||input.images.some((img:unknown)=>!img||typeof img!=="object"||!["image/png","image/jpeg","image/webp"].includes((img as {mime?:string}).mime??"")||typeof (img as {data?:string}).data!=="string"||!/^[-A-Za-z0-9+/]*={0,2}$/.test((img as {data:string}).data))||input.images.reduce((sum:number,img:{data:string})=>sum+img.data.length,0)>3400000))return reply({error:"invalid_image"},400);
   if(input.action==="prepare-flow-draft"&&Array.isArray(input.images)&&input.images.length>0&&input.imageRightsConfirmed!==true)return reply({error:"image_rights_confirmation_required"},400);
   const result=await openFlow(current.wsEndpoint,input.action==="create-flow-project"?"create-project":input.action==="inspect-flow-editor"?"inspect-editor":input.action==="prepare-flow-image"?"prepare-image":input.action==="inspect-flow-settings"?"inspect-settings":input.action==="prepare-flow-draft"?"prepare-draft":input.action==="click-flow-generate"?"click-generate":input.action==="start-click-recording"?"record-user-clicks":input.action==="read-click-recording"?"read-user-clicks":input.action==="stop-click-recording"?"stop-user-clicks":input.action==="stage-flow-prompt"?"stage-prompt":"inspect",["stage-flow-prompt","prepare-flow-draft","prepare-flow-image"].includes(input.action)?input.prompt:undefined,input.action==="prepare-flow-image"?input.imageMime:undefined,input.action==="prepare-flow-image"?input.imageBase64:undefined,input.action==="prepare-flow-draft"?input.images:undefined,input.action==="prepare-flow-draft"?input.imageRightsConfirmed:undefined,traceId);
   if(!result||typeof result!=="object"||"error" in result)return reply({error:(result&&typeof result==="object"&&"error" in result)?result.error:"flow_inspection_unavailable",diagnostics:result&&typeof result==="object"?result.diagnostics:null},502);
   return reply({referencesIncluded:result.referencesIncluded===true,referencesVerified:result.referencesVerified===true,generateClicked:result.generateClicked===true,clickCaptureActive:result.clickCaptureActive===true,manualClicks:Array.isArray(result.manualClicks)?result.manualClicks:[],diagnostics:result.diagnostics,inspectionReady:true,controls:result.controls??[],visibleCount:result.visibleCount??0,frameCount:result.frameCount??0,inspectedFrames:result.inspectedFrames??0,scanErrors:result.scanErrors??0,flowPage:result.flowPage===true,projectClicked:result.projectClicked===true,promptStaged:result.promptStaged===true,imageAttached:result.imageAttached===true,imageCount:result.imageCount??0,settingsInspection:result.settingsInspection??null,editorControls:result.editorControls??[],editorFrames:result.editorFrames??0,editorErrors:result.editorErrors??0});
  }
  if(input.action==="save-login"){
   if(!row.session_id)return reply({error:"no_active_session"},409);
   await client.sessions.stop(row.session_id);
   await update({session_id:null,session_started_at:null,login_saved:true});
   return reply({configured:true,profileReady:true,loginSaved:true,sessionActive:false});
  }
  if(row.session_id){
   try{
    stage="get_existing_session";
    const old=await client.sessions.get(row.session_id);
    const live=validLive(old?.liveUrl);
    const started=row.session_started_at?new Date(row.session_started_at).getTime():0;
    if(old?.status==="active"&&live&&started&&Date.now()-started<12*60*1000){const ready=await openFlow(old?.wsEndpoint);if(ready)return reply({configured:true,profileReady:true,sessionActive:true,loginSaved:Boolean(row.login_saved),liveViewUrl:live,navigationReady:true});console.warn("hyperbrowser_existing_session_navigation_failed",{hasSessionId:true});return reply({error:"flow_navigation_unavailable",retryable:true,sessionPreserved:true},502);}
    await client.sessions.stop(row.session_id).catch(()=>{});
   }catch{/* expired remote session */}
   await update({session_id:null,session_started_at:null});
  }
  stage="create_session";
  const session=await client.sessions.create({timeoutMinutes:20,profile:{id:row.profile_id,persistChanges:true}});
  stage="validate_live_url";
  const live=validLive(session?.liveUrl);
  if(!live){let shape:Record<string,unknown>={};try{const u=new URL(String(session?.liveUrl??""));shape={protocol:u.protocol,hostname:u.hostname,pathname:u.pathname,queryKeys:[...u.searchParams.keys()].sort()};}catch{shape={parseable:false};}console.error("hyperbrowser_session_missing_live_url",{stage,hasSessionId:Boolean(session?.id),hasLiveUrl:Boolean(session?.liveUrl),liveUrlType:typeof session?.liveUrl,shape});}
  if(!session?.id||!live||session?.status!=="active"){if(session?.id)await client.sessions.stop(session.id).catch(()=>{});return reply({error:"live_view_unavailable"},502);}
  stage="persist_session";
  try{await update({session_id:session.id,session_started_at:new Date().toISOString()});}
  catch(e){await client.sessions.stop(session.id).catch(()=>{});throw e;}
  const navigationReady=await openFlow(session?.wsEndpoint);if(!navigationReady){console.warn("hyperbrowser_new_session_navigation_failed",{hasSessionId:true});return reply({error:"flow_navigation_unavailable",retryable:true,sessionPreserved:true},502);}return reply({configured:true,profileReady:true,sessionActive:true,loginSaved:Boolean(row.login_saved),liveViewUrl:live,navigationReady:true});
 }catch(e){console.error("google_flow_login_setup_error",{stage:typeof stage==="string"?stage:"unknown",errorName:e instanceof Error?e.name:"unknown",message:e instanceof Error?e.message.slice(0,300):"unknown"});return reply({error:"hyperbrowser_unavailable"},502);}
});