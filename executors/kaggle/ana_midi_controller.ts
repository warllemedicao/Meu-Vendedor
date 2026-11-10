// Temporary, fixed-input comparison. Build placeholders locally; close after tests.
import { createClient } from "npm:@supabase/supabase-js@2.119.0";
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const bucket = admin.storage.from("mv-video-assets");
const research = admin.storage.from("mv-video-research");
const controlHash = "__CONTROL_HASH__";
const deadline = "__DEADLINE__";
const sources: Record<string, string> = __SOURCES__;
const supervisor = __SUPERVISOR__;
const sourcePrefix = "operator/ana-vidi-20261108/";
const inputs = {
 reference: { path: sourcePrefix + "motion/1d1ca4cd-685c-415a-82eb-419dacb3705f.png", hash: "5df249ae228a9c7b6658fd4fd80a281c66a037ce87980f7b69682f5202ba4182" },
 product: { path: sourcePrefix + "inputs/product-vidi.jpg", hash: "f8369d01d66b48319d3e4878e0bdd410d46923f96acbe410b1c8074423ce1c6b" },
 driver: { path: sourcePrefix + "inputs/ana-driver.mp4", hash: "268918740bf2de47870c52ae4767551e8ac673fa371fc1557bab891d3371c65e" },
};
const response = (b: unknown, status = 200) => Response.json(b, { status });
async function digest(s: string | ArrayBuffer) {
 const b = typeof s === "string" ? new TextEncoder().encode(s) : s;
 return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", b)), v => v.toString(16).padStart(2, "0")).join("");
}
async function kaggle(method: string, b: unknown) {
 const r = await fetch("https://api.kaggle.com/v1/" + method, { method: "POST", headers: { Authorization: "Bearer " + Deno.env.get("KAGGLE_API_TOKEN"), "Content-Type": "application/json" }, body: JSON.stringify(b), signal: AbortSignal.timeout(method.endsWith("/SaveKernel") ? 60000 : 30000) });
 if (!r.ok) { await r.body?.cancel(); throw new Error("kaggle_http_" + r.status); }
 return await r.json();
}
const attempt = (_engine: string) => "r2";
const key = (engine: string) => "ana-midi-20261109-" + engine + "-" + attempt(engine);
async function current(engine: string) {
 const { data, error } = await admin.from("mv_ai_provider_audits").select("report").eq("provider_id", key(engine)).maybeSingle();
 if (error) throw error; return data?.report;
}
async function save(engine: string, report: unknown) {
 const { error } = await admin.from("mv_ai_provider_audits").update({ report, checked_at: new Date().toISOString() }).eq("provider_id", key(engine));
 if (error) throw error;
}
Deno.serve(async req => {
 if (Date.now() > Date.parse(deadline) || controlHash.startsWith("__")) return response({ error: "closed" }, 410);
 if (req.method !== "POST") return response({ error: "unauthorized" }, 401);
 try {
  const raw = await req.text(); if (raw.length > 20000) return response({ error: "too_large" }, 413);
  const b = JSON.parse(raw);
  if (b.action === "callback") {
   const engine = ["hunyuan", "wan"].find(e => key(e) === b.id); if (!engine) return response({ error: "unauthorized" }, 401);
   const previous = await current(engine);
   if (!previous || await digest(req.headers.get("x-job-token") ?? "") !== previous.callback_hash) return response({ error: "unauthorized" }, 401);
   if (previous.terminal || previous.cancel) return response({ cancel: true });
   const fields = JSON.parse(JSON.stringify(b.report ?? {}).replace(/https?:\/\/[^\s"<>]+/g, "[url]"));
   // Child reports cannot finalize the supervisor before durable archive upload.
   const terminal = ["finished", "finished_without_archive"].includes(fields.phase);
   const state = terminal ? fields.state : "running";
   if (JSON.stringify(fields).length > 15000) return response({ error: "too_large" }, 413);
   const next = { ...previous, ...fields, state, terminal, heartbeat: new Date().toISOString() };
   // Keep the last specific model stage when the supervisor merely sends a heartbeat.
   if (fields.phase === "supervising") next.phase = previous.phase;
   await save(engine, next); return response({ accepted: true, cancel: false });
  }
  if (await digest(req.headers.get("x-control") ?? "") !== controlHash) return response({ error: "unauthorized" }, 401);
  if (b.action === "probe") {
   const who = await kaggle("security.OAuthService/IntrospectToken", { token: Deno.env.get("KAGGLE_API_TOKEN") });
   const q = await kaggle("kernels.KernelsApiService/GetAcceleratorQuotaStatistics", {});
   return response({ active: who.active, quota: q.gpuQuota });
  }
  if (b.action === "provenance") {
   const who = await kaggle("security.OAuthService/IntrospectToken", { token: Deno.env.get("KAGGLE_API_TOKEN") });
   const attempts = [];
   for (const engine of b.engine === "image" ? ["fashn"] : ["scail", "wan-animate", "vace"]) {
    const slug = "mv-motion-" + engine + (b.engine === "image" ? "-1d1ca4cd" : "-52e3dabb");
    try {
     const result = await kaggle("kernels.KernelsApiService/GetKernel", { userName: who.username, kernelSlug: slug });
     const text = JSON.stringify(result);
     const match = String(result.blob?.source ?? "").match(/^HYBRID_CONFIG\s*=\s*json\.loads\(("(?:[^"\\]|\\.)*")\)/m);
     const config = match ? JSON.parse(JSON.parse(match[1])) : null;
     const output = await kaggle("kernels.KernelsApiService/ListKernelSessionOutput", { userName: who.username, kernelSlug: slug });
     const reports = [];
     let page = output;
     const importantFiles = [];
     for (let index = 0; index < 20; index++) {
     for (const file of page.files ?? []) {
      if (/\/(report\.json|final\.mp4)$/.test(file.fileName)) importantFiles.push(file.fileName);
      if (/\/report\.json$/.test(file.fileName) || file.fileName === "report.json") {
       const r = await fetch(file.url); const content = await r.text();
       if (content.length < 15000) reports.push(JSON.parse(content));
      }
     }
     if (!page.nextPageToken || reports.length) break;
     page = await kaggle("kernels.KernelsApiService/ListKernelSessionOutput", { userName: who.username, kernelSlug: slug, pageToken: page.nextPageToken });
     }
     return response({ found: true, slug, expected_engine_from_title: engine, config: config ? { id: config.id, engine: config.engine, seed: config.seed, seconds: config.seconds, mode: config.mode } : null, blob_keys: Object.keys(result.blob ?? {}), engine_mentions: ["scail", "wan-animate", "vace", "hunyuan"].filter(e => text.includes(e)), reports, files: importantFiles, log_tail: String(output.log ?? "").replace(/https?:\/\/\S+/g, "[url]").slice(-1500) });
    } catch (e) { attempts.push({ slug, error: String(e) }); }
   }
   return response({ found: false, attempts });
  }
  if (b.action === "outputs") {
   const who = await kaggle("security.OAuthService/IntrospectToken", { token: Deno.env.get("KAGGLE_API_TOKEN") });
   const selected = b.engine === "wan" ? "wan" : "hunyuan";
   const slug = b.engine === "old" ? "mv-motion-52e3dabb-0175-4990" : "mv-ana-midi-20261109-" + selected + "-" + attempt(selected);
   const result = await kaggle("kernels.KernelsApiService/ListKernelSessionOutput", { userName: who.username, kernelSlug: slug });
   const status = b.engine === "old" ? null : await kaggle("kernels.KernelsApiService/GetKernelSessionStatus", { userName: who.username, kernelSlug: slug });
   let metadata;
   try { const saved = await kaggle("kernels.KernelsApiService/GetKernel", { userName: who.username, kernelSlug: slug }); metadata = { ...saved.metadata, slug: saved.blob?.slug, source_length: saved.blob?.source?.length, keys: Object.keys(saved) }; }
   catch (e) { metadata = { error: String(e) }; }
   return response({ keys: Object.keys(result), metadata, status, files: result.files?.map((f: { fileName: string }) => f.fileName), log: String(result.log ?? "").replace(/https?:\/\/\S+/g, "[url]").slice(-10000) });
  }
  if (b.action === "queue") {
   const who = await kaggle("security.OAuthService/IntrospectToken", { token: Deno.env.get("KAGGLE_API_TOKEN") });
   const result = await kaggle("kernels.KernelsApiService/ListKernels", { group: "PROFILE", user: who.username, language: "all", kernelType: "all", outputType: "all", sortBy: "DATE_CREATED", search: "mv-ana-midi", pageSize: 10 });
   return response(result);
  }
  const engine = b.engine; if (!["hunyuan", "wan"].includes(engine)) return response({ error: "invalid_engine" }, 400);
  if (b.action === "cancel-queued") {
   const p = await current(engine); if (!p || p.terminal || !["submitting", "uncertain"].includes(p.state)) return response({ error: "not_queued" }, 409);
   const who = await kaggle("security.OAuthService/IntrospectToken", { token: Deno.env.get("KAGGLE_API_TOKEN") });
   const remote = await kaggle("kernels.KernelsApiService/GetKernelSessionStatus", { userName: who.username, kernelSlug: p.slug });
   if (remote.status && remote.status !== "QUEUED") return response({ error: "not_queued", status: remote.status }, 409);
   await save(engine, { ...p, cancel: true });
   await kaggle("kernels.KernelsApiService/DeleteKernel", { userName: who.username, kernelSlug: p.slug });
   let removed = false;
   try { await kaggle("kernels.KernelsApiService/GetKernel", { userName: who.username, kernelSlug: p.slug }); }
   catch (e) { removed = /kaggle_http_403|kaggle_http_404/.test(String(e)); }
   if (!removed) return response({ error: "removal_unconfirmed" }, 409);
   await save(engine, { ...p, cancel: true, terminal: true, state: "cancelled", note: "No callback, GPU reservation or output before queued notebook removal; not a model inference failure." });
   return response({ removed: true });
  }
  if (b.action === "status") { const p = await current(engine); if (!p) return response({ state: "not_started" }); const { callback_hash, ...safe } = p; return response(safe); }
  if (b.action === "cancel") { const p = await current(engine); if (p) await save(engine, { ...p, cancel: true }); return response({ cancel_requested: true }); }
  if (b.action === "download") {
   const p = await current(engine); if (!p?.terminal) return response({ error: "not_finished" }, 409);
   const urls: Record<string, string> = {};
   for (const kind of ["video", "archive"]) {
    const store = kind === "video" ? bucket : research;
    const { data } = await store.createSignedUrl(p[kind + "_path"], 600); if (data) urls[kind] = data.signedUrl;
   }
   return response(urls);
  }
  if (b.action !== "submit") return response({ error: "invalid_action" }, 400);
  const prior = await current(engine); if (prior) return response({ already_claimed: true, state: prior.state });
  if (engine === "wan") { const first = await current("hunyuan"); if (!first?.terminal) return response({ error: "hunyuan_not_finished" }, 409); }
  for (const other of ["hunyuan", "wan"]) { const job = await current(other); if (job && !job.terminal) return response({ error: "comparison_busy" }, 409); }
  for (const table of ["mv_motion_jobs", "mv_hybrid_jobs"]) {
   const { count, error } = await admin.from(table).select("id", { count: "exact", head: true }).in("status", ["submitting", "running", "uncertain"]).gt("expires_at", new Date().toISOString());
   if (error) throw error; if (count) return response({ error: "gpu_busy" }, 409);
  }
  const quota = await kaggle("kernels.KernelsApiService/GetAcceleratorQuotaStatistics", {});
  const sec = (v: string) => /^\d+(\.\d+)?s$/.test(v) ? Number(v.slice(0, -1)) : NaN;
  const q = quota.gpuQuota;
  if (sec(q.totalTimeAllowed) - sec(q.timeUsed) - sec(q.timeReserved) < 3600 || !Number.isFinite(sec(q.timeUsed))) return response({ error: "quota_unavailable" }, 409);
  const cfg: Record<string, unknown> = { id: key(engine), engine, budget_seconds: engine === "hunyuan" ? 1800 : 3300 };
  for (const [name, input] of Object.entries(inputs)) {
   const { data, error } = await bucket.createSignedUrl(input.path, 7200); if (error) throw error;
   const fetched = await fetch(data.signedUrl); if (!fetched.ok) throw new Error("input_missing");
   const bytes = await fetched.arrayBuffer(); if (bytes.byteLength > 40 * 1024 * 1024 || await digest(bytes) !== input.hash) throw new Error("input_hash_mismatch");
   cfg[name] = data.signedUrl; cfg[name + "_sha256"] = input.hash;
  }
  const callbackGate = Array.from(crypto.getRandomValues(new Uint8Array(32)), v => v.toString(16).padStart(2, "0")).join("");
  const video_path = "operator/ana-midi-20261109/" + engine + "-" + attempt(engine) + ".mp4";
  const archive_path = "operator/ana-midi-20261109/" + engine + "-" + attempt(engine) + ".zip";
  const slug = "mv-ana-midi-20261109-" + engine + "-" + attempt(engine);
  const initial = { state: "claimed", terminal: false, engine, slug, video_path, archive_path, inputs, quota_before: q, callback_hash: await digest(callbackGate), started: new Date().toISOString() };
  const { error: claimError } = await admin.from("mv_ai_provider_audits").insert({ provider_id: key(engine), status: "checked", report: initial });
  if (claimError) return response({ error: "already_claimed" }, 409);
  const { data: video, error: ve } = await bucket.createSignedUploadUrl(video_path, { upsert: false });
  const { data: archive, error: ae } = await research.createSignedUploadUrl(archive_path, { upsert: false });
  if (ve || ae) { await save(engine, { ...initial, state: "failed", terminal: true, error: "upload_preparation_failed" }); throw new Error("upload_preparation_failed"); }
  Object.assign(cfg, { gate: callbackGate, callback: Deno.env.get("SUPABASE_URL") + "/functions/v1/ana-midi-test", video_upload: video.signedUrl, upload: video.signedUrl, archive_upload: archive.signedUrl });
  const who = await kaggle("security.OAuthService/IntrospectToken", { token: Deno.env.get("KAGGLE_API_TOKEN") });
  if (!who.active || !/^[-\w]{1,100}$/.test(who.username)) throw new Error("identity_invalid");
  const text = "import json\nTEST_CONFIG=json.loads(" + JSON.stringify(JSON.stringify(cfg)) + ")\nTEST_SOURCE=" + JSON.stringify(sources[engine]) + "\n" + supervisor;
  await save(engine, { ...initial, state: "submitting" });
  try {
   const result = await kaggle("kernels.KernelsApiService/SaveKernel", { slug: who.username + "/" + slug, newTitle: slug, text, language: "python", kernelType: "script", kernelExecutionType: "SAVE_AND_RUN_ALL", isPrivate: true, enableGpu: true, enableInternet: true, machineShape: "NvidiaTeslaT4", sessionTimeoutSeconds: engine === "hunyuan" ? 2100 : 3600 });
   if (result.error || (!result.ref && !result.kernelId)) throw new Error("submission_uncertain");
   return response({ state: "submitted", engine, slug, remote_ref: result.ref, kernel_id: result.kernelId, version: result.versionNumber }, 202);
  } catch (e) {
   const message = String(e); const rejected = /kaggle_http_4\d\d/.test(message);
   await save(engine, { ...initial, state: rejected ? "rejected" : "uncertain", terminal: rejected, error: message });
   return response({ state: rejected ? "rejected" : "uncertain", error: message }, 503);
  }
 } catch (e) { return response({ error: String(e).replace(/https?:\/\/\S+/g, "[url]").slice(0, 200) }, 500); }
});
