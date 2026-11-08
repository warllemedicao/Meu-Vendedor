import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { approvedCrop, digest, kernelSource, validId } from "./_shared/contracts.ts";
import { runner } from "./_shared/runner.ts";
const url=Deno.env.get("SUPABASE_URL")!;
const admin=createClient(url,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
const auth=createClient(url,Deno.env.get("SUPABASE_ANON_KEY")!,{auth:{persistSession:false}});
const storage=admin.storage.from("mv-video-assets");
const token=Deno.env.get("KAGGLE_API_TOKEN")??"";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"};
const response=(body:unknown,status=200)=>Response.json(body,{status,headers:cors});
async function kaggle(method:string,body:Record<string,unknown>) {
 const r=await fetch(`https://api.kaggle.com/v1/${method}`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(body),redirect:"error",signal:AbortSignal.timeout(30000)});
 if(!r.ok) {await r.body?.cancel();throw new Error("kaggle_unavailable");}
 return await r.json() as { active?: boolean; username?: string; gpuQuota?: {totalTimeAllowed?: string;timeUsed?: string;timeReserved?: string}; error?: unknown; ref?: string; kernelId?: number; status?: string };
}
async function publicJob(j:Record<string,unknown>) {
 const expired=Date.parse(String(j.expires_at))<Date.now();
 const pending=["running","submitting","uncertain"].includes(String(j.status));
 const state=j.cancel_requested&&pending&&!expired?"cancelling":expired&&["running","submitting","uncertain"].includes(String(j.status))?"expired":j.status;
 let resultUrl:string|undefined;
 let resultError:string|undefined;
 if(j.status==="completed"&&typeof j.result_path==="string") {
  const {data,error}=await storage.createSignedUrl(j.result_path,300);
  if(error)resultError="hybrid_result_unavailable";else resultUrl=data.signedUrl;
 }
 const report=(j.report??{}) as Record<string,unknown>;
 return {id:j.id,status:state,report:{phase:report.phase,total_seconds:report.total_seconds,duration_seconds:report.duration_seconds},presenterId:j.presenter_id,createdAt:j.created_at,url:resultUrl,error:resultError??j.error_code};
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{headers:cors});
 if(req.method!=="POST")return response({error:"method_not_allowed"},405);
 const raw=await req.text();if(raw.length>10000)return response({error:"request_too_large"},413);
 let b;try{b=JSON.parse(raw);if(!b||typeof b!=="object"||Array.isArray(b))throw 0;}catch{return response({error:"invalid_request"},400);}
 try {
  if(b.action==="callback") {
   if(!validId(b.id))return response({error:"invalid_request"},400);
   const gate=req.headers.get("x-job-token")??"";
   if(!/^[a-f0-9]{64}$/.test(gate))return response({error:"unauthorized"},401);
   const {data:j}=await admin.from("mv_hybrid_jobs").select("*").eq("id",b.id).maybeSingle();
   if(!j||j.callback_hash!==await digest(gate)||Date.parse(j.expires_at)<Date.now())return response({error:"unauthorized"},401);
   if(!["running","completed","failed"].includes(b.state))return response({error:"invalid_state"},400);
   if(["completed","failed","cancelled"].includes(j.status))return response({accepted:true,cancel:j.status==="cancelled"});
   if(j.cancel_requested) {
    const {error}=await admin.from("mv_hybrid_jobs").update({status:"cancelled",error_code:null}).eq("id",j.id).in("status",["submitting","running","uncertain"]);
    if(error)throw error;return response({accepted:true,cancel:true});
   }
   const report:Record<string,unknown>={};
   if(b.state==="completed"||b.state==="failed") {report.finished_at=new Date().toISOString();report.request_elapsed_seconds=Math.round((Date.now()-Date.parse(j.created_at))/1000);}
   for(const key of ["setup_seconds","preprocess_seconds","inference_seconds","total_seconds","duration_seconds","width","height","frames","fps","bytes","peak_gpu_bytes"])
    if(typeof b.report?.[key]==="number"&&Number.isFinite(b.report[key])&&b.report[key]>=0)report[key]=b.report[key];
   if(typeof b.report?.sha256==="string"&&/^[a-f0-9]{64}$/.test(b.report.sha256))report.sha256=b.report.sha256;
   for(const key of ["phase","adapter","gpu","error_type"])
    if(typeof b.report?.[key]==="string"&&/^[\w .:-]{1,100}$/.test(b.report[key]))report[key]=b.report[key];
   if(b.state==="failed"&&typeof b.report?.error_detail==="string") report.error_detail=b.report.error_detail.slice(-2500).replace(/https?:\/\/[^\s]+/g,"[url]");
   if(b.state==="completed") {
    const {data:info,error}=await storage.info(j.result_path);
    if(error||!info||!report.bytes||Number(report.bytes)>80*1024*1024)return response({error:"result_unavailable"},409);
   }
   const {data:updated,error}=await admin.from("mv_hybrid_jobs").update({status:b.state,report,error_code:b.state==="failed"?"hybrid_executor_failed":null}).eq("id",j.id).eq("cancel_requested",false).in("status",["submitting","running","uncertain"]).select("id");
   if(error)throw error;
   if(!updated?.length) {
    const {data:cancelled,error:cancelError}=await admin.from("mv_hybrid_jobs").update({status:"cancelled",error_code:null}).eq("id",j.id).eq("cancel_requested",true).in("status",["submitting","running","uncertain"]).select("id");
    if(cancelError)throw cancelError;
    const {data:current}=await admin.from("mv_hybrid_jobs").select("status,cancel_requested").eq("id",j.id).single();
    return response({accepted:true,cancel:Boolean(cancelled?.length)||current?.status==="cancelled"||current?.cancel_requested===true});
   }
   return response({accepted:true});
  }
  const bearer=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"")??"";
  const {data:identity,error:identityError}=await auth.auth.getUser(bearer);
  if(identityError||!identity.user)return response({error:"unauthorized"},401);
  const user=identity.user.id;
  if(b.action==="capabilities") {
   const {data,error}=await admin.from("mv_presenter_assets").select("id,presenter_id,name,scene,kind").eq("approved",true);
   if(error)throw error;
   const {data:profiles,error:profileError}=await admin.from("mv_presenter_profiles").select("id,name,body_type,visual_identity,reference_image,google_voice,preferences").eq("visual_approved",true);
   if(profileError)throw profileError;
   return response({profiles:profiles??[],available:Boolean(token)&&Boolean(data?.length),experimental:true,maxAudioSeconds:15,assets:data??[],pipeline:["Google TTS","MuseTalk 1.5 · Kaggle","FFmpeg"],paidFallback:false});
  }
  if(b.action==="recover") {
   if(!validId(b.id))return response({error:"invalid_request"},400);
   const {data:j,error}=await admin.from("mv_hybrid_jobs").select("*").eq("id",b.id).eq("user_id",user).maybeSingle();
   if(error)throw error;if(!j)return response({error:"not_found"},404);
   if(!["submitting","running","uncertain"].includes(j.status)||j.cancel_requested)return response(await publicJob(j));
   const info=j.result_path?await storage.info(j.result_path):null;
   const size=Number(info?.data?.size);
   if(info?.data&&size>0&&size<=80*1024*1024&&info.data.contentType==="video/mp4") {
    const report={...j.report,phase:"recovered",bytes:size,recovered_from_storage:true};
    const {error:updateError}=await admin.from("mv_hybrid_jobs").update({status:"completed",report,error_code:null}).eq("id",j.id).eq("cancel_requested",false).in("status",["submitting","running","uncertain"]);
    if(updateError)throw updateError;
   } else if(token&&j.kernel_slug) {
    const who=await kaggle("security.OAuthService/IntrospectToken",{token});
    if(who.active!==true||!who.username)throw new Error("token_invalid");
    const remote=await kaggle("kernels.KernelsApiService/GetKernelSessionStatus",{userName:who.username,kernelSlug:j.kernel_slug});
    if(["ERROR","CANCELLED","COMPLETE"].includes(remote.status??"")) {
     const {error:updateError}=await admin.from("mv_hybrid_jobs").update({status:"failed",error_code:"hybrid_result_missing"}).eq("id",j.id).eq("cancel_requested",false).in("status",["submitting","running","uncertain"]);
     if(updateError)throw updateError;
    }
   }
   const {data:current,error:readError}=await admin.from("mv_hybrid_jobs").select("*").eq("id",j.id).eq("user_id",user).single();
   if(readError)throw readError;return response(await publicJob(current));
  }
  if(b.action==="cancel") {
   if(!validId(b.id))return response({error:"invalid_request"},400);
   const {error}=await admin.from("mv_hybrid_jobs").update({cancel_requested:true}).eq("id",b.id).eq("user_id",user).in("status",["submitting","running","uncertain"]);
   if(error)throw error;
   const {data,error:readError}=await admin.from("mv_hybrid_jobs").select("*").eq("id",b.id).eq("user_id",user).maybeSingle();
   if(readError)throw readError;if(!data)return response({error:"not_found"},404);
   return response(await publicJob(data));
  }
  if(b.action==="list") {
   const {data,error}=await admin.from("mv_hybrid_jobs").select("id,status,report,result_path,error_code,created_at,expires_at,cancel_requested,mv_presenter_assets(presenter_id)").eq("user_id",user).order("created_at",{ascending:false}).limit(50);
   if(error)throw error;
   return response({jobs:await Promise.all((data??[]).map(j=>publicJob({...j,presenter_id:(j.mv_presenter_assets as unknown as {presenter_id:string})?.presenter_id})))});
  }
  if(b.action==="result") {
   if(!validId(b.id))return response({error:"invalid_request"},400);
   const {data,error}=await admin.from("mv_hybrid_jobs").select("*").eq("id",b.id).eq("user_id",user).maybeSingle();
   if(error)throw error;if(!data)return response({error:"not_found"},404);
   return response(await publicJob(data));
  }
  if(b.action!=="generate"||!validId(b.assetId)||!validId(b.audioId))return response({error:"invalid_request"},400);
  if(!token)return response({error:"kaggle_not_configured"},503);
  const gate=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,"0")).join("");
  const {data:claim,error}=await admin.rpc("mv_claim_hybrid",{p_user:user,p_asset:b.assetId,p_audio:b.audioId,p_hash:await digest(gate),p_product:typeof b.productPath==="string"?b.productPath:null});
  if(error) {
   const code=["hybrid_busy","hybrid_daily_limit","hybrid_input_unavailable"].find(x=>error.message.includes(x));
   return response({error:code??"hybrid_unavailable"},code?409:503);
  }
  const j=claim.job;
  if(!claim.claimed)return response(await publicJob(j));
  let submitting=false;
  try {
   const {data:a,error:ae}=await admin.from("mv_presenter_assets").select("*").eq("id",j.asset_id).eq("approved",true).single();
   const {data:audio,error:audioError}=await admin.from("mv_audio_generations").select("result_path").eq("id",j.audio_id).eq("user_id",user).eq("status","completed").single();
   if(ae||audioError||!approvedCrop(a.face_crop)||!audio?.result_path?.startsWith(`${user}/audio/`))throw new Error("invalid_asset");
   const who=await kaggle("security.OAuthService/IntrospectToken",{token});
   if(who.active!==true||! /^[a-zA-Z0-9_-]{1,100}$/.test(who.username??""))throw new Error("token_invalid");
   const quota=await kaggle("kernels.KernelsApiService/GetAcceleratorQuotaStatistics",{});
   const sec=(v:unknown)=>typeof v==="string"&&/^\d+(\.\d+)?s$/.test(v)?Number(v.slice(0,-1)):NaN;
   if(sec(quota.gpuQuota?.totalTimeAllowed)-sec(quota.gpuQuota?.timeUsed)-sec(quota.gpuQuota?.timeReserved)<1800)throw new Error("quota_unavailable");
   // Fail closed if quota is unknown.
   if(!Number.isFinite(sec(quota.gpuQuota?.totalTimeAllowed)-sec(quota.gpuQuota?.timeUsed)-sec(quota.gpuQuota?.timeReserved)))throw new Error("quota_unavailable");
   const visual=await storage.createSignedUrl(a.object_path,5400);
   const speech=await storage.createSignedUrl(audio.result_path,5400);
   let product:string|undefined;
   if(j.product_path) {
    const owned=new RegExp(`^${user}/inputs/[A-Za-z0-9_-]+[.](jpg|png|webp)$`);
    if(!owned.test(j.product_path))throw new Error("invalid_product");
    const signed=await storage.createSignedUrl(j.product_path,5400);if(signed.error)throw signed.error;product=signed.data.signedUrl;
   }
   const path=`${user}/hybrid/${j.id}.mp4`;
   const upload=await storage.createSignedUploadUrl(path,{upsert:false});
   if(visual.error||speech.error||upload.error)throw new Error("storage_unavailable");
   const slug=`mv-hybrid-${j.id.slice(0,18)}`;
   const {error:updateError}=await admin.from("mv_hybrid_jobs").update({kernel_slug:slug,result_path:path}).eq("id",j.id);if(updateError)throw updateError;
   const source=kernelSource(runner,{id:j.id,gate,callback:`${url}/functions/v1/hybrid-video`,visual:visual.data.signedUrl,audio:speech.data.signedUrl,upload:upload.data.signedUrl,crop:a.face_crop,kind:a.kind,product});
   submitting=true;
   const saved=await kaggle("kernels.KernelsApiService/SaveKernel",{slug:`${who.username}/${slug}`,newTitle:`Meu Vendedor Hybrid ${j.id.slice(0,8)}`,text:source,language:"python",kernelType:"script",isPrivate:true,enableGpu:true,enableInternet:true,machineShape:"NvidiaTeslaT4",sessionTimeoutSeconds:1800});
   if(saved.error||(!saved.ref&&!saved.kernelId))throw new Error("submission_uncertain");
   await admin.from("mv_hybrid_jobs").update({kernel_slug:typeof saved.ref==="string"?saved.ref.split("/").pop():slug}).eq("id",j.id);
   return response({id:j.id,status:"submitting"},202);
  } catch {
   await admin.from("mv_hybrid_jobs").update({status:submitting?"uncertain":"failed",error_code:submitting?"hybrid_submission_uncertain":"hybrid_preparation_failed"}).eq("id",j.id).eq("status","submitting");
   return response({id:j.id,status:submitting?"uncertain":"failed",error:submitting?"hybrid_submission_uncertain":"hybrid_preparation_failed"},503);
  }
 }catch{return response({error:"hybrid_unavailable"},503);}
});
