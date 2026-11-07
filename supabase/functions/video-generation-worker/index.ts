import { createOneminVideoProvider, oneminVideoModel } from "../video-generation/_shared/providers/onemin.ts";
import { referenceImagePrompt, referenceVideoPrompt } from "../video-generation/_shared/visual-direction.ts";
import { allowsVideoProvider } from "../video-generation/_shared/generation-tools.ts";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { imageCacheKey } from "../video-generation/_shared/image-cache.ts";
import { productionServiceInventory } from "../video-generation/_shared/provider-inventory.ts";
import { auditProviders } from "../video-generation/_shared/provider-audit.ts";
import { createGoogleVideoProvider, googleVideoModel } from "../video-generation/_shared/providers/google-video.ts";
import {
  AIProviderFailure,
  type AIProviderAdapter,
  type AIProviderAttemptStore,
  type AIProviderReadiness,
  type AIRoutingPolicy,
} from "../video-generation/_shared/ai-provider-router.ts";
import {
  createCloudflareWorkersAIProvider,
  type AIImageReference,
} from "../video-generation/_shared/providers/cloudflare-workers-ai.ts";
import {
  createMagicHourVideoProvider,
} from "../video-generation/_shared/providers/magic-hour.ts";
import {
  createReplicateVideoProvider,
  replicateVideoEstimateUsd,
} from "../video-generation/_shared/providers/replicate.ts";
import {
  createVideoProcessor,
  type VideoGenerationRequest,
  type VideoProcessingJob,
  type VideoProcessorAdvance,
} from "../video-generation/_shared/processor.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const workerSecret = Deno.env.get("MV_VIDEO_WORKER_SECRET") ?? "";
const bucket = "mv-video-assets";
const admin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

function workerEnabled(): boolean {
  return Boolean(admin && anonKey && workerSecret.length >= 32);
}

function configuredProviders(): ReadonlySet<string> {
  return new Set(["cloudflare-workers-ai", "magic-hour", "google-gemini", "replicate", "onemin"]);
}


function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function ownedInputPath(job: VideoProcessingJob, path: unknown): path is string {
  return typeof path === "string" &&
    new RegExp(`^${job.user_id}/inputs/[A-Za-z0-9._-]+\\.jpg$`).test(path);
}

function jpegDimensions(bytes: Uint8Array): { width: number; height: number } {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new AIProviderFailure("reference_image_format_invalid", "incompatible", "not-started");
  }
  const frameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (segmentLength < 2 || offset + 2 + segmentLength > bytes.length) break;
    if (frameMarkers.has(marker)) {
      const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
      const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
      if (width > 0 && height > 0) return { width, height };
      break;
    }
    offset += 2 + segmentLength;
  }
  throw new AIProviderFailure("reference_image_dimensions_invalid", "incompatible", "not-started");
}

function modelFor(providerId: string): string {
  if (providerId === "cloudflare-workers-ai") return "@cf/black-forest-labs/flux-2-dev";
  if (providerId === "magic-hour") return "ltx-2.5";
  if (providerId === "replicate") return "alibaba/happyhorse-1.0";
  if (providerId === "onemin") return oneminVideoModel;
  if (providerId === "google-gemini") return googleVideoModel;
  throw new Error("video_provider_unknown");
}

async function rpcOk<T>(name: string, parameters: Record<string, unknown>): Promise<T> {
  if (!admin) throw new Error("video_database_unavailable");
  const { data, error } = await admin.rpc(name, parameters);
  if (error) throw new Error(`${name}:${error.code ?? "database_error"}`);
  return data as T;
}

function createAttemptStore(
  job: VideoProcessingJob,
  stage: "image" | "video",
): AIProviderAttemptStore {
  return {
    async record(attempt) {
      if (attempt.status === "started") {
        const marked = await rpcOk<boolean>("mv_mark_video_job_submitting", {
          p_job_id: job.id,
          p_lease_token: job.lease_token,
          p_stage: stage === "image" ? "image_generating" : "video_submitting",
        });
        if (!marked) throw new Error("video_job_lease_lost");
      }
      const { error } = await admin!.rpc("mv_record_video_ai_attempt", {
        p_job_id: job.id,
        p_stage: stage,
        p_provider_id: attempt.providerId,
        p_model: attempt.model,
        p_status: attempt.status,
        p_reason_code: attempt.reason ?? null,
        p_estimated_cost_usd: attempt.estimatedCostUsd ?? null,
      });
      if (error) throw new Error(`mv_record_video_ai_attempt:${error.code ?? "database_error"}`);
    },
    // A conta do fornecedor controla o saldo. O registro "started" mantém a lease/idempotência.
    async reserve() { return true; },
    async settle() {},
    async release() {},
    async setCooldown(providerId, until) {
      await rpcOk<void>("mv_set_video_ai_cooldown", {
        p_provider_id: providerId,
        p_cooldown_until: new Date(until).toISOString(),
        p_reason_code: "provider_temporarily_unavailable",
      });
    },
  };
}

function routingPolicy(): AIRoutingPolicy {
  return { billingMode: "account-credits", allowPaidGeneration: true, allowUnconfirmedCommercialUse: true,
    maxCostUsdPerTask: 0, remainingDailyBudgetUsd: 0, paidProviders: new Set() };
}

function cloudflareReadiness(): Promise<AIProviderReadiness> {
  return persistentReadiness("cloudflare-workers-ai", Boolean(Deno.env.get("CLOUDFLARE_ACCOUNT_ID") && Deno.env.get("CLOUDFLARE_AI_API_TOKEN")), async () => ({
    authenticated: Boolean(Deno.env.get("CLOUDFLARE_AI_API_TOKEN")),
    available: Boolean(Deno.env.get("CLOUDFLARE_ACCOUNT_ID") && Deno.env.get("CLOUDFLARE_AI_API_TOKEN")),
    funding: "unknown", balanceUnits: null,
  }));
}

async function persistentReadiness(
  providerId: string,
  configured: boolean,
  load: () => Promise<AIProviderReadiness>,
): Promise<AIProviderReadiness> {
  const { data, error } = await admin!.from("mv_video_ai_provider_cooldowns")
    .select("cooldown_until")
    .eq("provider_id", providerId)
    .maybeSingle();
  if (error) throw new Error("video_provider_cooldown_unavailable");
  const until = data ? Date.parse(data.cooldown_until) : null;
  if (until !== null && !Number.isFinite(until)) throw new Error("video_provider_cooldown_invalid");
  if (until !== null && until > Date.now()) {
    return {
      authenticated: configured,
      available: configured,
      funding: "unknown",
      balanceUnits: null,
      cooldownUntil: until,
    };
  }
  return { ...await load(), cooldownUntil: until };
}

function magicHourClient() {
  return createMagicHourVideoProvider({
    apiKey: Deno.env.get("MAGIC_HOUR_API_KEY") ?? "",
    creditUsd: null,
    freeOnly: false,
    commercialUseConfirmed: false,
    freeCreditsConfirmed: false,
    paidSpendAuthorized: true,
  });
}

function replicateClient() {
  return createReplicateVideoProvider({
    apiToken: Deno.env.get("REPLICATE_API_TOKEN") ?? "",
    supabaseUrl,
    paidSpendAuthorized: true,
    commercialUseConfirmed: false,
  });
}

function oneminClient() {
  return createOneminVideoProvider({ apiKey: Deno.env.get("ONEMIN_API_KEY") ?? "" });
}

async function getVideoStatus(providerId: string, remoteJobId: string) {
  if (providerId === "onemin") return oneminClient().status(remoteJobId);
  if (providerId === "google-gemini") return googleVideoClient().status(remoteJobId);
  if (providerId === "magic-hour") return await magicHourClient().status(remoteJobId);
  if (providerId === "replicate") return await replicateClient().status(remoteJobId);
  throw new Error("video_provider_unknown");
}

function googleVideoClient() {
  return createGoogleVideoProvider({ apiKey: Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GOOGLE_API_KEY") ?? "" });
}

const processor = admin ? createVideoProcessor({
  async claim() {
    return await rpcOk<VideoProcessingJob | null>("mv_claim_video_job", { p_lease_seconds: 180 });
  },
  async createImageRequest(job) {
    const request = job.request_data;
    const product = request.product;
    if (!isRecord(product) || !ownedInputPath(job, product.aiReferenceStoragePath) ||
      !ownedInputPath(job, request.presenterReferenceStoragePath)) {
      throw new AIProviderFailure("video_reference_path_invalid", "incompatible", "not-started");
    }
    const referenceInputs = [
      { path: product.aiReferenceStoragePath, width: product.aiReferenceWidth, height: product.aiReferenceHeight },
      { path: request.presenterReferenceStoragePath, width: request.presenterReferenceWidth, height: request.presenterReferenceHeight },
    ];
    const references: AIImageReference[] = [];
    for (const reference of referenceInputs) {
      if (!Number.isInteger(reference.width) || !Number.isInteger(reference.height) ||
        (reference.width as number) < 1 || (reference.width as number) > 512 ||
        (reference.height as number) < 1 || (reference.height as number) > 512) {
        throw new AIProviderFailure("video_reference_dimensions_invalid", "incompatible", "not-started");
      }
      const { data, error } = await admin!.storage.from(bucket).download(reference.path);
      if (error || !data) throw new Error("video_reference_download_failed");
      const bytes = new Uint8Array(await data.arrayBuffer());
      const dimensions = jpegDimensions(bytes);
      if (dimensions.width !== reference.width || dimensions.height !== reference.height) {
        throw new AIProviderFailure("video_reference_dimensions_mismatch", "incompatible", "not-started");
      }
      references.push({ bytes, mimeType: "image/jpeg", width: dimensions.width, height: dimensions.height });
    }
    const prompt = referenceImagePrompt(request);
    return { prompt, references, outputWidth: 512, outputHeight: 910, steps: 25 };
  },
  createImageRouter() {
    return createCloudflareWorkersAIProvider({
      accountId: Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ?? "",
      apiToken: Deno.env.get("CLOUDFLARE_AI_API_TOKEN") ?? "",
      readiness: cloudflareReadiness,
      commercialUseConfirmed: false,
    });
  },
  async findCachedImage(job, request) {
    const key = await imageCacheKey(request);
    const { data, error } = await admin!.from("mv_video_image_cache")
      .select("object_path").eq("user_id", job.user_id).eq("cache_key", key)
      .gt("expires_at", new Date().toISOString()).maybeSingle();
    if (error) throw new Error("video_image_cache_unavailable");
    if (!data || !new RegExp(`^${job.user_id}/intermediate/[A-Za-z0-9._-]+$`).test(data.object_path)) return null;
    const { data: file, error: missing } = await admin!.storage.from(bucket).download(data.object_path);
    if (missing || !file || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) return null;
    return data.object_path;
  },
  async rememberImage(job, request, path) {
    const { error } = await admin!.from("mv_video_image_cache").upsert({
      user_id: job.user_id, cache_key: await imageCacheKey(request), object_path: path,
      expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
    }, { onConflict: "user_id,cache_key" });
    if (error) throw new Error("video_image_cache_write_failed");
  },
  async storeIntermediate(job, bytes, mimeType) {
    const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
    const path = `${job.user_id}/intermediate/${job.id}-reference.${extension}`;
    const { error } = await admin!.storage.from(bucket).upload(path, bytes, {
      contentType: mimeType,
      upsert: false,
    });
    if (error) throw new Error("video_intermediate_storage_failed");
    return path;
  },
  async loadIntermediate(job) {
    if (!job.intermediate_image_path ||
      !new RegExp(`^${job.user_id}/intermediate/[A-Za-z0-9-]+-reference\\.(?:jpg|png|webp)$`).test(job.intermediate_image_path)) {
      throw new Error("video_intermediate_path_invalid");
    }
    const { data, error } = await admin!.storage.from(bucket).download(job.intermediate_image_path);
    if (error || !data) throw new Error("video_intermediate_download_failed");
    const bytes = new Uint8Array(await data.arrayBuffer());
    const mimeType = data.type === "image/jpeg" || data.type === "image/png" || data.type === "image/webp"
      ? data.type
      : null;
    if (!mimeType) throw new Error("video_intermediate_mime_invalid");
    return { bytes, mimeType };
  },
  createVideoRouter(_job, _image, excludeProviders) {
    const providers: AIProviderAdapter<VideoGenerationRequest, { providerJobId: string; estimatedCostUsd: number | null }>[] = [];
    if (Deno.env.get("ONEMIN_API_KEY") && !excludeProviders.has("onemin")) {
      const onemin = oneminClient();
      providers.push({ ...onemin, readiness: () => persistentReadiness("onemin", true, () => onemin.readiness()) });
    }
    const key = Deno.env.get("MAGIC_HOUR_API_KEY") ?? "";
    if (key && configuredProviders().has("magic-hour") && !excludeProviders.has("magic-hour")) {
      const magicHour = magicHourClient();
      providers.push({
        capabilities: magicHour.capabilities,
        readiness: () => persistentReadiness(
          "magic-hour",
          Boolean(Deno.env.get("MAGIC_HOUR_API_KEY")),
          () => magicHour.readiness(),
        ),
        estimate: (request) => magicHour.estimate({
          image: request.image,
          imageMimeType: request.imageMimeType,
          prompt: request.prompt,
          durationSeconds: request.durationSeconds,
          aspectRatio: request.aspectRatio,
        }),
        generate: async (request, key) => {
          const result = await magicHour.generate({
            image: request.image,
            imageMimeType: request.imageMimeType,
            prompt: request.prompt,
            durationSeconds: request.durationSeconds,
            aspectRatio: request.aspectRatio,
          }, key);
          return {
            providerJobId: result.providerJobId,
            estimatedCostUsd: result.estimatedCostUsd,
          };
        },
      });
    }
    if ((Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY")) && !excludeProviders.has("google-gemini")) {
      const google = googleVideoClient();
      providers.push({ ...google, readiness: () => persistentReadiness("google-gemini", true, () => google.readiness()) });
    }
    const replicateKey = Deno.env.get("REPLICATE_API_TOKEN") ?? "";
    if (replicateKey && configuredProviders().has("replicate") && !excludeProviders.has("replicate")) {
      const replicate = replicateClient();
      providers.push({
        capabilities: replicate.capabilities,
        readiness: () => persistentReadiness(
          "replicate",
          Boolean(Deno.env.get("REPLICATE_API_TOKEN")),
          () => replicate.readiness(),
        ),
        estimate: (request) => replicate.estimate({
          imageUrl: request.imageUrl,
          prompt: request.prompt,
          durationSeconds: request.durationSeconds,
          aspectRatio: request.aspectRatio,
        }),
        generate: async (request, key) => {
          const result = await replicate.generate({
            imageUrl: request.imageUrl,
            prompt: request.prompt,
            durationSeconds: request.durationSeconds,
            aspectRatio: request.aspectRatio,
          }, key);
          return { providerJobId: result.providerJobId, estimatedCostUsd: replicateVideoEstimateUsd };
        },
      });
    }
    return providers.filter((provider) => allowsVideoProvider(_job.request_data.generationTool, provider.capabilities.id));
  },
  async createVideoRequest(job, image) {
    if (!job.intermediate_image_path) throw new Error("video_intermediate_missing");
    const { data, error } = await admin!.storage.from(bucket)
      .createSignedUrl(job.intermediate_image_path, 600);
    if (error || !data?.signedUrl) throw new Error("video_intermediate_signing_failed");
    const request = job.request_data;
    if (!isRecord(request.product)) throw new Error("video_product_missing");
    const prompt = referenceVideoPrompt(request);
    return {
      image: image.bytes,
      imageMimeType: image.mimeType,
      imageUrl: data.signedUrl,
      prompt,
      durationSeconds: 6,
      aspectRatio: "9:16",
    };
  },
  videoStatus: getVideoStatus,
  async cancelVideo(providerId, remoteJobId) {
    if (providerId !== "replicate") throw new Error("video_provider_cancel_unsupported");
    const apiToken = Deno.env.get("REPLICATE_API_TOKEN") ?? "";
    await createReplicateVideoProvider({
      apiToken,
      supabaseUrl,
      paidSpendAuthorized: true,
      commercialUseConfirmed: false,
    }).cancel(remoteJobId);
  },
  async downloadVideo(providerId, url) {
    if (providerId === "onemin") return oneminClient().download(url);
    if (providerId === "google-gemini") return googleVideoClient().download(url);
    if (providerId === "magic-hour") return await magicHourClient().download(url);
    if (providerId === "replicate") {
      return await replicateClient().download(url);
    }
    throw new Error("provider_download_not_supported");
  },
  async outputUrl(providerId, remoteJobId) {
    const status = await getVideoStatus(providerId, remoteJobId);
    if ("outputUrl" in status) return status.outputUrl ?? null;
    return "downloadUrl" in status ? status.downloadUrl ?? null : null;
  },
  async storeResult(job, path, bytes) {
    const { error } = await admin!.storage.from(bucket).upload(path, bytes, {
      contentType: "video/mp4",
      upsert: false,
    });
    if (error) throw new Error("video_result_storage_failed");
  },
  async readStoredResult(_job, path) {
    const { data, error } = await admin!.storage.from(bucket).download(path);
    if (!error && data) return new Uint8Array(await data.arrayBuffer());
    if (error?.statusCode === "404") return null;
    if (error) throw new Error("video_result_storage_unavailable");
    return null;
  },
  async triedVideoProviders(jobId) {
    const { data, error } = await admin!.from("mv_video_ai_attempts")
      .select("provider_id,remote_job_id,status")
      .eq("job_id", jobId)
      .eq("stage", "video")
      .in("status", ["started", "succeeded", "failed", "uncertain"]);
    if (error) throw new Error("video_attempts_unavailable");
    return new Set((data ?? []).filter((row) => row.remote_job_id || row.status === "uncertain").map((row) => row.provider_id));
  },
  async recordVideoStatusFailure(job, code) {
    if (code === "onemin_insufficient_credits") {
      await rpcOk<void>("mv_set_video_ai_cooldown", {
        p_provider_id: "onemin", p_cooldown_until: new Date(Date.now() + 900_000).toISOString(), p_reason_code: code,
      });
    }
    const { error } = await admin!.rpc("mv_record_video_ai_attempt", {
      p_job_id: job.id,
      p_stage: "video",
      p_provider_id: job.provider,
      p_model: modelFor(job.provider),
      p_status: "failed",
      p_reason_code: code,
      p_estimated_cost_usd: null,
    });
    if (error) throw new Error("video_attempt_record_failed");
  },
  async advance(job, update: VideoProcessorAdvance) {
    const result = await rpcOk<Record<string, unknown>>("mv_advance_video_job", {
      p_job_id: job.id,
      p_lease_token: job.lease_token,
      p_stage: update.stage,
      p_progress: update.progress,
      p_provider: update.provider ?? null,
      p_provider_job_id: update.providerJobId ?? null,
      p_intermediate_image_path: update.intermediateImagePath ?? null,
      p_result_object_path: update.resultObjectPath ?? null,
      p_error_code: update.errorCode ?? null,
      p_delay_seconds: update.delaySeconds ?? 0,
    });
    if (!result) throw new Error("video_job_advance_failed");
  },
  createAttemptStore(job, stage) {
    return createAttemptStore(job, stage);
  },
  routingPolicy,
}) : null;

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

// Diagnóstico operacional: somente nomes/estados, nunca valores de credenciais.
console.info(JSON.stringify({
  event: "video_worker_readiness",
  processor_available: workerEnabled(),
  billing_mode: "account-credits",
  paid_generation_allowed: true,
  services: productionServiceInventory((name) => Boolean(Deno.env.get(name))),
  credential_names: Object.keys(Deno.env.toObject())
    .filter((name) => /(?:KEY|TOKEN|SECRET)/.test(name) && !name.startsWith("SUPABASE_") && !name.startsWith("MV_"))
    .sort(),
}));

async function refreshProviderAudits(): Promise<void> {
  if (!admin) return;
  const { data, error } = await admin.rpc("mv_claim_provider_audit");
  if (error || !data) return;
  const reports = await auditProviders((name) => Deno.env.get(name));
  reports.push({ provider_id: "elevenlabs-config", checked_at: new Date().toISOString(), status: "checked", report: {
    related_secret_names: Object.keys(Deno.env.toObject()).filter((name) => /eleven|11labs|xi_api/i.test(name)).sort(),
    quota_verified: false, reason: "names_only_no_secret_values",
  } });
  const { error: saveError } = await admin.from("mv_ai_provider_audits").upsert(reports);
  if (saveError) console.error("provider-audit-save-failed");
}

// Verificação horária atômica, inclusive com várias instâncias.
EdgeRuntime.waitUntil(refreshProviderAudits().catch(() => console.error("provider-audit-failed")));

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response(null, { status: 405 });
  if (workerSecret.length < 32 || !safeEqual(request.headers.get("x-worker-secret") ?? "", workerSecret)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!workerEnabled() || !processor) return Response.json({ error: "processor_disabled" }, { status: 503 });
  EdgeRuntime.waitUntil(refreshProviderAudits().catch(() => console.error("provider-audit-failed")));
  EdgeRuntime.waitUntil(Promise.resolve(admin!.from("mv_ai_audit_state").update({ last_worker_request_at: new Date().toISOString() }).eq("id", true)).then(({ error }) => {
    if (error) console.error("video-worker-heartbeat-failed");
  }));
  const task = processor.processNext().then(async (stage) => {
    if (stage === "image_ready" || stage === "validating" || stage === "queued" || stage === "completed") {
      const kick = fetch(`${supabaseUrl}/functions/v1/video-generation-worker`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          "x-worker-secret": workerSecret,
        },
        body: "{}",
      }).then((response) => {
        if (!response.ok) console.error("video-worker-follow-up-failed");
      });
      EdgeRuntime.waitUntil(kick);
    }
  }).catch(() => {
    console.error("video-worker-step-failed");
  });
  EdgeRuntime.waitUntil(task);
  return Response.json({ accepted: true }, { status: 202 });
});
