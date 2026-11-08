import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { digest, kernelSource, validId } from "../hybrid-video/_shared/contracts.ts";
import { assertReviewedInput, engines, importableVideoUrl, limitedBytes, ownedReference, validateInput, videoSignature } from "./_shared/contracts.ts";
import { motionRunner } from "./_shared/runner.ts";
const url = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const auth = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false } });
const storage = admin.storage.from("mv-video-assets");
const token = Deno.env.get("KAGGLE_API_TOKEN") ?? "";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const response = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });
async function kaggle(method: string, body: Record<string, unknown>) {
 const r = await fetch(`https://api.kaggle.com/v1/${method}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body), redirect: "error", signal: AbortSignal.timeout(30000) });
 if (!r.ok) { await r.body?.cancel(); throw new Error(r.status === 403 ? "kaggle_permission_missing" : "kaggle_unavailable"); }
 return await r.json() as { active?: boolean; username?: string; gpuQuota?: { totalTimeAllowed?: string; timeUsed?: string; timeReserved?: string }; status?: string; error?: unknown; ref?: string; kernelId?: number };
}
async function signed(path: string) {
 const { data, error } = await storage.createSignedUrl(path, 5400); if (error) throw new Error("media_unavailable"); return data.signedUrl;
}
async function imageHash(path: string) {
 const r = await fetch(await signed(path), { redirect: "error", signal: AbortSignal.timeout(25000) });
 const bytes = await limitedBytes(r, 10 * 1024 * 1024);
 const hash = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer);
 return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("");
}
async function publicJob(j: Record<string, unknown>) {
 const pending = ["submitting", "running", "uncertain"].includes(String(j.status));
 const status = pending && Date.parse(String(j.expires_at)) < Date.now() ? "expired" : pending && j.cancel_requested ? "cancelling" : j.status;
 let resultUrl; let error = j.error_code;
 if (j.status === "completed" && typeof j.result_path === "string") { try { resultUrl = await signed(j.result_path); } catch { error = "result_unavailable"; } }
 const report = (j.report ?? {}) as Record<string, unknown>;
 return { id: j.id, engine: j.engine, status, url: resultUrl, resultPath: j.status === "completed" ? j.result_path : undefined, kind: j.engine === "fashn" ? "image" : "video", createdAt: j.created_at, phase: report.phase, elapsed: report.total_seconds, stepsCompleted: report.steps_completed, stepsTotal: report.steps_total, error };
}
export async function handler(req: Request): Promise<Response> {
 if (req.method === "OPTIONS") return new Response(null, { headers: cors });
 if (req.method !== "POST") return response({ error: "method_not_allowed" }, 405);
 try {
  const raw = await req.text(); if (raw.length > 10000) return response({ error: "request_too_large" }, 413);
  let b; try { b = JSON.parse(raw); if (!b || typeof b !== "object" || Array.isArray(b)) throw 0; } catch { return response({ error: "invalid_request" }, 400); }
  if (b.action === "callback") {
   const gate = req.headers.get("x-job-token") ?? "";
   if (!validId(b.id) || !/^[a-f0-9]{64}$/.test(gate)) return response({ error: "unauthorized" }, 401);
   const { data: j } = await admin.from("mv_motion_jobs").select("*").eq("id", b.id).maybeSingle();
   if (!j || j.callback_hash !== await digest(gate) || Date.parse(j.expires_at) < Date.now()) return response({ error: "unauthorized" }, 401);
   if (["completed", "failed", "cancelled"].includes(j.status)) return response({ accepted: true, cancel: j.status === "cancelled" });
   if (j.cancel_requested) { const { error } = await admin.from("mv_motion_jobs").update({ status: "cancelled", error_code: null }).eq("id", j.id).in("status", ["submitting", "running", "uncertain"]); if (error) throw error; return response({ accepted: true, cancel: true }); }
   if (!["running", "completed", "failed"].includes(b.state)) return response({ error: "invalid_state" }, 400);
   const report: Record<string, unknown> = { ...j.report, heartbeat_at: new Date().toISOString() };
   for (const key of ["phase", "adapter", "error_type", "failure_code"]) if (typeof b.report?.[key] === "string" && /^[\w .:-]{1,100}$/.test(b.report[key])) report[key] = b.report[key];
   if (b.state === "failed" && typeof b.report?.error_detail === "string") report.error_detail = b.report.error_detail.slice(-2500).replace(/https?:\/\/[^\s]+/g, "[url]");
   for (const key of ["steps_completed", "steps_total", "setup_seconds", "inference_seconds", "total_seconds", "duration_seconds", "width", "height", "frames", "fps", "bytes", "peak_gpu_bytes"]) if (typeof b.report?.[key] === "number" && Number.isFinite(b.report[key]) && b.report[key] >= 0) report[key] = b.report[key];
   if (typeof b.report?.sha256 === "string" && /^[a-f0-9]{64}$/.test(b.report.sha256)) report.sha256 = b.report.sha256;
   if (b.state === "completed") {
    const { data: info, error } = await storage.info(j.result_path);
    if (error || !info || Number(info.size) !== report.bytes || !report.sha256 || info.contentType !== (j.engine === "fashn" ? "image/png" : "video/mp4")) return response({ error: "result_unavailable" }, 409);
   }
   const { data: updated, error } = await admin.from("mv_motion_jobs").update({ status: b.state, report, error_code: b.state === "failed" ? String(report.failure_code ?? "executor_failed") : null }).eq("id", j.id).eq("cancel_requested", false).in("status", ["submitting", "running", "uncertain"]).select("id");
   if (error) throw error;
   return response({ accepted: true, cancel: !updated?.length });
  }
  const { data: identity, error: identityError } = await auth.auth.getUser(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
  if (identityError || !identity.user) return response({ error: "unauthorized" }, 401);
  const user = identity.user.id;
  if (b.action === "capabilities") {
   const { data: assets, error } = await admin.from("mv_presenter_assets").select("id,presenter_id,name").eq("approved", true).eq("kind", "image"); if (error) throw error;
   return response({ engines: engines.map(e => ({ ...e, available: Boolean(token) && e.supported && e.id !== "wan-animate", reason: e.id === "wan-animate" ? "Desabilitado: o piloto encerrou durante a geração; a correção de memória ainda não foi validada." : e.reason, experimental: true })), assets, maxSeconds: 4, maxVideoBytes: 40 * 1024 * 1024, nativeAudio: false, paidFallback: false });
  }
  if (b.action === "import-video") {
   const source = importableVideoUrl(b.url);
   const bytes = await limitedBytes(await fetch(source, { redirect: "error", signal: AbortSignal.timeout(30000) }), 40 * 1024 * 1024);
   if (!videoSignature(bytes)) return response({ error: "video_invalid" }, 400);
   const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer)), v => v.toString(16).padStart(2, "0")).join("");
   const path = `${user}/inputs/motion-${hash}.${source.pathname.toLowerCase().endsWith(".webm") ? "webm" : "mp4"}`;
   const { error } = await storage.upload(path, bytes, { contentType: path.endsWith(".webm") ? "video/webm" : "video/mp4", upsert: false });
   if (error && error.message !== "The resource already exists") throw error;
   return response({ path });
  }
  if (b.action === "list") { const { data, error } = await admin.from("mv_motion_jobs").select("*").eq("user_id", user).order("created_at", { ascending: false }).limit(40); if (error) throw error; return response({ jobs: await Promise.all((data ?? []).map(publicJob)) }); }
  if (["result", "cancel", "recover"].includes(b.action)) {
   if (!validId(b.id)) return response({ error: "invalid_request" }, 400);
   const { data: j, error } = await admin.from("mv_motion_jobs").select("*").eq("id", b.id).eq("user_id", user).maybeSingle(); if (error) throw error; if (!j) return response({ error: "not_found" }, 404);
   const active = ["submitting", "running", "uncertain"].includes(j.status);
   if (b.action === "cancel" && active) { const { error } = await admin.from("mv_motion_jobs").update({ cancel_requested: true }).eq("id", j.id).in("status", ["submitting", "running", "uncertain"]); if (error) throw error; j.cancel_requested = true; }
   if (b.action === "recover" && active && !j.cancel_requested) {
    const { data: info } = j.result_path ? await storage.info(j.result_path) : { data: null };
    let patch;
    if (info && Number(info.size) > 0 && Number(info.size) < 80 * 1024 * 1024 && info.contentType === (j.engine === "fashn" ? "image/png" : "video/mp4")) patch = { status: "completed", error_code: null, report: { ...j.report, phase: "recovered", bytes: info.size } };
    else if (j.kernel_slug) {
     try {
      const who = await kaggle("security.OAuthService/IntrospectToken", { token });
      const remote = await kaggle("kernels.KernelsApiService/GetKernelSessionStatus", { userName: who.username, kernelSlug: j.kernel_slug });
      if (["ERROR", "CANCELLED", "COMPLETE"].includes(remote.status ?? "")) patch = { status: "failed", error_code: "result_missing" };
     } catch { return response(await publicJob({ ...j, error_code: "remote_status_unavailable" })); }
    }
    if (patch) { const { data: updated, error } = await admin.from("mv_motion_jobs").update(patch).eq("id", j.id).eq("cancel_requested", false).in("status", ["submitting", "running", "uncertain"]).select("*").maybeSingle(); if (error) throw error; if (updated) return response(await publicJob(updated)); }
   }
   return response(await publicJob(j));
  }
  if (!["generate", "inspect-inputs"].includes(b.action)) return response({ error: "invalid_action" }, 400);
  if (!token) return response({ error: "kaggle_unavailable" }, 503);
  const input = validateInput(user, b.input ?? {});
  if (input.engine === "wan-animate") throw new Error("engine_unavailable");
  const { data: asset, error: ae } = await admin.from("mv_presenter_assets").select("object_path").eq("id", input.assetId).eq("approved", true).eq("kind", "image").single(); if (ae) throw new Error("input_invalid");
  for (const path of [input.referencePath, input.productPath, input.driverPath, input.maskPath].filter((p): p is string => Boolean(p))) {
   if (!(path.startsWith(`${user}/inputs/`) || ownedReference(user, path))) throw new Error("input_invalid");
   const { data: info, error } = await storage.info(path); if (error || !info || !Number.isFinite(Number(info.size)) || Number(info.size) <= 0 || Number(info.size) > (/\.(mp4|webm)$/.test(path) ? 40 : 10) * 1024 * 1024) throw new Error("media_unavailable");
  }
  let sourceProduct;
  if (input.sourceProductId) {
   const { data, error } = await admin.from("mv_products").select("id,title,image_url").eq("id", input.sourceProductId).eq("user_id", user).maybeSingle();
   if (error || !data || !input.productPath?.startsWith(`${user}/inputs/product-${data.id}-`)) throw new Error("product_source_mismatch");
   sourceProduct = data;
  }
  const referencePath = input.referencePath ?? asset.object_path;
  const [productHash, referenceHash] = await Promise.all([imageHash(input.productPath!), imageHash(referencePath)]);
  let prepared = null;
  if (input.preparedJobId) {
   const { data, error } = await admin.from("mv_motion_jobs").select("asset_id,status,engine,result_path,input").eq("id", input.preparedJobId).eq("user_id", user).maybeSingle();
   if (error) throw error;
   prepared = data;
  }
  // Inspection never claims a job or calls Kaggle. It binds review to these exact bytes.
  if (b.action === "inspect-inputs") {
   assertReviewedInput({ ...input, reviewedProductSha256: productHash, reviewedReferenceSha256: referenceHash }, productHash, referenceHash, prepared);
   return response({ approvedReferenceUrl: await signed(asset.object_path), productUrl: await signed(input.productPath!), referenceUrl: await signed(referencePath), productSha256: productHash, referenceSha256: referenceHash, sourceProduct });
  }
  assertReviewedInput(input, productHash, referenceHash, prepared);
  const gate = Array.from(crypto.getRandomValues(new Uint8Array(32)), v => v.toString(16).padStart(2, "0")).join("");
  const { data: claim, error } = await admin.rpc("mv_claim_motion", { p_user: user, p_asset: input.assetId, p_engine: input.engine, p_input: input, p_fingerprint: await digest(JSON.stringify(input)), p_hash: await digest(gate) });
  if (error) { const code = ["motion_busy", "motion_daily_limit", "input_invalid"].find(x => error.message.includes(x)); return response({ error: code ?? "motion_unavailable" }, code ? 409 : 503); }
  const j = claim.job; if (!claim.claimed) return response(await publicJob(j));
  let submitted = false;
  try {
   const who = await kaggle("security.OAuthService/IntrospectToken", { token }); if (who.active !== true || !/^[\w-]{1,100}$/.test(who.username ?? "")) throw new Error("kaggle_unavailable");
   const q = await kaggle("kernels.KernelsApiService/GetAcceleratorQuotaStatistics", {});
   const seconds = (v: unknown) => typeof v === "string" && /^\d+(\.\d+)?s$/.test(v) ? Number(v.slice(0, -1)) : NaN;
   const remaining = seconds(q.gpuQuota?.totalTimeAllowed) - seconds(q.gpuQuota?.timeUsed) - seconds(q.gpuQuota?.timeReserved);
   if (!Number.isFinite(remaining) || remaining < 3600) throw new Error("quota_unavailable");
   const path = `${user}/motion/${j.id}.${input.engine === "fashn" ? "png" : "mp4"}`;
   const { data: upload, error: ue } = await storage.createSignedUploadUrl(path, { upsert: false }); if (ue) throw ue;
   const slug = `mv-motion-${j.id.slice(0, 18)}`;
   const { error: updateError } = await admin.from("mv_motion_jobs").update({ result_path: path, kernel_slug: slug }).eq("id", j.id); if (updateError) throw updateError;
   const config = { ...input, id: j.id, gate, callback: `${url}/functions/v1/motion-generation`, upload: upload.signedUrl, reference: await signed(input.referencePath ?? asset.object_path), product: input.productPath ? await signed(input.productPath) : undefined, driver: input.driverPath ? await signed(input.driverPath) : undefined, mask: input.maskPath ? await signed(input.maskPath) : undefined };
   submitted = true;
   const saved = await kaggle("kernels.KernelsApiService/SaveKernel", { slug: `${who.username}/${slug}`, newTitle: `MV Motion ${input.engine} ${j.id.slice(0, 8)}`, text: kernelSource(motionRunner, config), language: "python", kernelType: "script", isPrivate: true, enableGpu: true, enableInternet: true, machineShape: "NvidiaTeslaT4", sessionTimeoutSeconds: 3600 });
   if (saved.error || (!saved.ref && !saved.kernelId)) throw new Error("submission_uncertain");
   return response({ id: j.id, engine: input.engine, kind: input.engine === "fashn" ? "image" : "video", status: "submitting" }, 202);
  } catch (e) {
   const code = submitted ? "submission_uncertain" : e instanceof Error && e.message === "quota_unavailable" ? "quota_unavailable" : "preparation_failed";
   await admin.from("mv_motion_jobs").update({ status: submitted ? "uncertain" : "failed", error_code: code }).eq("id", j.id).eq("status", "submitting");
   return response({ id: j.id, engine: input.engine, status: submitted ? "uncertain" : "failed", error: code }, 503);
  }
 } catch (e) { const code = e instanceof Error ? e.message : ""; return response({ error: ["input_review_required", "prepared_reference_mismatch", "product_source_mismatch", "input_invalid", "input_required", "mask_required", "engine_unavailable", "media_unavailable", "video_url_invalid", "video_url_unsupported", "media_too_large"].includes(code) ? code : "motion_unavailable" }, 400); }
}
Deno.serve(handler);
