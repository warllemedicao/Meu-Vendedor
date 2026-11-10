// Temporary experiment coordinator. Replace placeholders at deployment; close after tests.
// No administrative credential is ever returned or passed to a notebook.
import { createClient } from "npm:@supabase/supabase-js@2.119.0";
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {auth:{persistSession:false}});
const storage = admin.storage.from("mv-video-assets");
const research = admin.storage.from("mv-video-research");
const controlHash = "__CONTROL_HASH__";
const expires = "__EXPIRES__";
const experiment = "video-research-20261109-motion-first-r7";
const stage2 = false;
const runner = "__RUNNER__";
const reply = (body:unknown,status=200) => Response.json(body,{status});
async function sha(value:string) { return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))),v=>v.toString(16).padStart(2,"0")).join(""); }
async function kaggle(method:string, body:unknown) {
 const r = await fetch(`https://api.kaggle.com/v1/${method}`,{method:"POST",headers:{Authorization:`Bearer ${Deno.env.get("KAGGLE_API_TOKEN")}`,"Content-Type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
 if(!r.ok) { await r.body?.cancel(); throw new Error(`kaggle_http_${r.status}`); }
 return await r.json();
}
async function current() { const {data,error}=await admin.from("mv_ai_provider_audits").select("report").eq("provider_id",experiment).maybeSingle(); if(error)throw error;return data?.report; }
async function save(report:unknown) {const {error}=await admin.from("mv_ai_provider_audits").update({report,checked_at:new Date().toISOString()}).eq("provider_id",experiment);if(error)throw error;}
Deno.serve(async req=>{
 if(!Number.isFinite(Date.parse(expires))||controlHash.startsWith("__")||Date.now()>Date.parse(expires))return reply({error:"research_closed"},410);
 if(req.method!=="POST")return reply({error:"unauthorized"},401);
 try {
  const raw=await req.text();if(raw.length>12000)return reply({error:"too_large"},413);
  const b=JSON.parse(raw);
  if(b.action==="callback") {
   const report=await current();
   if(!report||await sha(req.headers.get("x-job-token")??"")!==report.callback_hash)return reply({error:"unauthorized"},401);
   if(report.terminal||report.cancel)return reply({cancel:true});
   const fields=JSON.parse(JSON.stringify(b.report??{}).replace(/https?:\/\/[^\s"<>]+/g,"[url]"));
   const safe:Record<string,unknown>={};
   for(const key of ["phase","state","setup_seconds","total_seconds","inference_seconds","gpu","torch","error","experiments","bytes","sha256","width","height","frames","fps","peak_gpu_bytes"])if(fields[key]!==undefined)safe[key]=fields[key];
   if(JSON.stringify(safe).length>5500)return reply({error:"too_large"},413);
   await save({...report,...safe,heartbeat:new Date().toISOString(),terminal:["completed","failed","cancelled"].includes(fields.state)});
   return reply({accepted:true,cancel:false});
  }
  if(await sha(req.headers.get("x-research-token")??"")!==controlHash)return reply({error:"unauthorized"},401);
  if(b.action==="probe") {
   const who=await kaggle("security.OAuthService/IntrospectToken",{token:Deno.env.get("KAGGLE_API_TOKEN")});
   const quota=await kaggle("kernels.KernelsApiService/GetAcceleratorQuotaStatistics",{});
   return reply({active:who.active,quota:quota.gpuQuota});
  }
  if(b.action==="status") {const report=await current();if(!report)return reply({state:"not_started"});const {callback_hash,...safe}=report;return reply(safe);}
  if(b.action==="remote") {
   const report=await current();if(!report)return reply({error:"missing"},404);
   const who=await kaggle("security.OAuthService/IntrospectToken",{token:Deno.env.get("KAGGLE_API_TOKEN")});
   const result=await kaggle("kernels.KernelsApiService/GetKernelSessionStatus",{userName:who.username,kernelSlug:report.slug});
   return reply({status:result.status,error:result.error??null});
  }
  if(b.action==="inputs") {
   const {data,error}=await storage.createSignedUrl("operator/hybrid-assets/carla-v2.webp",3600);if(error)throw error;
   return reply({carla:data.signedUrl});
  }
  if(b.action==="upload-product") {
   const {data,error}=await research.createSignedUploadUrl("operator/research/2026-11-09/garment-flamengo.png",{upsert:false});if(error)throw error;
   return reply({url:data.signedUrl,sha256:"9a7d5a590429c156aaee8ed491c920b523091a3d108aa9f0e0e87515b2a6a1f3"});
  }
  if(b.action==="cancel") {const report=await current();if(report)await save({...report,cancel:true});return reply({cancel_requested:true});}
  if(b.action==="download") {const report=await current();if(!report?.artifact)return reply({error:"missing"},404);const {data,error}=await research.createSignedUrl(report.artifact,600);if(error)throw error;return reply({url:data.signedUrl});}
  if(b.action!=="submit"||runner==="__RUNNER__")return reply({error:"research_preparing"},409);
  // Only one fixed experiment can be submitted, even after a timeout.
  const previous=await current();if(previous)return reply({state:previous.state,already_claimed:true});
  const who=await kaggle("security.OAuthService/IntrospectToken",{token:Deno.env.get("KAGGLE_API_TOKEN")});
  if(!who.active||!/^[-\w]{1,100}$/.test(who.username))throw new Error("kaggle_identity_invalid");
  const quota=await kaggle("kernels.KernelsApiService/GetAcceleratorQuotaStatistics",{});
  const sec=(s:string)=>/^\d+(\.\d+)?s$/.test(s)?Number(s.slice(0,-1)):NaN;
  const remaining=sec(quota.gpuQuota.totalTimeAllowed)-sec(quota.gpuQuota.timeUsed)-sec(quota.gpuQuota.timeReserved);
  if(!Number.isFinite(remaining)||remaining<3600)return reply({error:"quota_unavailable"},409);
  for(const table of ["mv_motion_jobs","mv_hybrid_jobs"]){const {count,error}=await admin.from(table).select("id",{count:"exact",head:true}).in("status",["submitting","running","uncertain"]).gt("expires_at",new Date().toISOString());if(error)throw error;if(count)return reply({error:"gpu_busy"},409);}
  const gate=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,"0")).join("");
  const slug="mv-research-20261109-motion-first-r7";
  const artifact="operator/research/2026-11-09/motion-first-r7.zip";
  const initial={state:"claimed",phase:"preparing",callback_hash:await sha(gate),slug,artifact,started:new Date().toISOString(),quota_before:quota.gpuQuota};
  const {error:bucketError}=await admin.storage.createBucket("mv-video-research",{public:false,allowedMimeTypes:["application/zip","video/mp4","image/png","image/jpeg","image/webp"]});
  if(bucketError&&!/already exists/i.test(bucketError.message))throw bucketError;
  const {error:claimError}=await admin.from("mv_ai_provider_audits").insert({provider_id:experiment,status:"checked",report:initial});
  if(claimError)return reply({error:"already_claimed"},409);
  const {data:reference,error:re}=await storage.createSignedUrl("operator/hybrid-assets/carla-v2.webp",7200);if(re)throw re;
  const {data:upload,error:ue}=await research.createSignedUploadUrl(artifact,{upsert:false});if(ue)throw ue;
  const cfg:Record<string,unknown>={reference:reference.signedUrl,reference_sha256:"acf2757d16f9f3c724dc731250a83390eeab2901c2884455ecbf94ed0dbb40f9",callback:`${Deno.env.get("SUPABASE_URL")}/functions/v1/video-research`,gate,upload:upload.signedUrl};
  if(stage2){
   const {data:prior,error:pe}=await admin.from("mv_ai_provider_audits").select("report").eq("provider_id","video-research-20261109-motion-first-r7").single();
   if(pe||prior?.report?.state!=="completed"||!prior.report.sha256)throw new Error("motion_source_not_completed");
   const {data:source,error:se}=await research.createSignedUrl(prior.report.artifact,7200);if(se)throw se;
   const {data:product,error:ge}=await research.createSignedUrl("operator/research/2026-11-09/garment-flamengo.png",7200);if(ge)throw ge;
   const bytes=await (await fetch(product.signedUrl)).arrayBuffer();
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),v=>v.toString(16).padStart(2,"0")).join("");
   if(hash!=="9a7d5a590429c156aaee8ed491c920b523091a3d108aa9f0e0e87515b2a6a1f3")throw new Error("product_sha256_mismatch");
   cfg.source_archive=source.signedUrl;cfg.source_sha256=prior.report.sha256;cfg.product=product.signedUrl;cfg.product_sha256=hash;
  }
  const text=`import json\nRESEARCH_CONFIG=json.loads(${JSON.stringify(JSON.stringify(cfg))})\n${runner}`;
  await save({...initial,state:"submitting"});
  let result;
  try {result=await kaggle("kernels.KernelsApiService/SaveKernel",{slug:`${who.username}/${slug}`,newTitle:slug,text,language:"python",kernelType:"script",isPrivate:true,enableGpu:true,enableInternet:true,machineShape:"NvidiaTeslaT4",sessionTimeoutSeconds:3600});}
  catch(e) {const message=e instanceof Error?e.message:"submission_transport_error";const rejected=/kaggle_http_4\d\d/.test(message);await save({...initial,state:rejected?"rejected":"uncertain",terminal:rejected,error:message});return reply({state:rejected?"rejected":"uncertain",error:message},503);}
  if(result.error||(!result.ref&&!result.kernelId)){
   const detail=JSON.stringify(result.error??{response_keys:Object.keys(result)}).replace(/https?:\/\/[^\s"<>]+/g,"[url]").slice(0,1800);
   await save({...initial,state:result.error?"rejected":"uncertain",terminal:Boolean(result.error),error:detail});
   return reply({state:result.error?"rejected":"uncertain",error:detail},503);
  }
  // Callback may have arrived already: never overwrite its state.
  return reply({state:"submitted",slug},202);
 }catch(e){return reply({error:e instanceof Error?e.message.slice(0,150):"research_error"},500);}
});
