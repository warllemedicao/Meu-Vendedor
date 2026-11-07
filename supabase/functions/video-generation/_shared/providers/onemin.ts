import { AIProviderFailure, type AIProviderAdapter, type AIProviderCapabilities } from "../ai-provider-router.ts";
import type { VideoGenerationRequest, VideoSubmission } from "../processor.ts";
import type { MagicHourVideoStatus } from "./magic-hour.ts";

// Reference-to-video uses the documented TEXT_TO_VIDEO contract with uploaded image keys.
export const oneminVideoModel = "bytedance/seedance-2.0-fast";
export const oneminVideoCapabilities: AIProviderCapabilities = {
  id: "onemin", task: "video", model: oneminVideoModel,
  inputModes: ["text", "image-reference"], maxReferenceImages: 1,
  durationsSeconds: [6], aspectRatios: ["9:16"], maxResolution: "720p",
  nativeAudio: true, lipSync: false, commercialUse: "not-confirmed",
  freeTier: "unknown", supportsBalanceQuery: false, costUsdPerUnit: null, costUnit: "second",
};
const origin = "https://api.1min.ai";
const record = (v: unknown): Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};

async function boundedBytes(response: Response, limit: number): Promise<Uint8Array> {
  if (!response.body) throw new Error("body_missing");
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength; if (size > limit) throw new Error("body_too_large");
      chunks.push(part.value);
    }
  } finally { await reader.cancel(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

function resultPath(id: string): string {
  if (!/^[a-zA-Z0-9_-]{10,100}$/.test(id)) throw new AIProviderFailure("onemin_record_id_invalid", "incompatible", "not-started");
  return `${origin}/api/results/${id}`;
}

function trustedOutput(value: unknown): string {
  let url: URL;
  try { url = new URL(String(value)); } catch { throw new AIProviderFailure("onemin_output_url_invalid", "incompatible", "accepted"); }
  // Restrict both current and documented legacy S3 URLs to the 1min bucket.
  const trusted = url.hostname === "storage.1min.ai" || url.hostname === "asset.1min.ai.s3.us-east-1.amazonaws.com" ||
    (url.hostname === "s3.us-east-1.amazonaws.com" && url.pathname.startsWith("/asset.1min.ai/"));
  if (url.protocol !== "https:" || !trusted || url.port || url.username || url.password) {
    throw new AIProviderFailure("onemin_output_url_invalid", "incompatible", "accepted");
  }
  return url.href;
}

export function createOneminVideoProvider(options: { apiKey: string; fetcher?: typeof fetch }): AIProviderAdapter<VideoGenerationRequest, VideoSubmission> & {
  status(id: string): Promise<MagicHourVideoStatus>;
  download(reference: string): Promise<Uint8Array>;
} {
  const fetcher = options.fetcher ?? fetch;
  const headers = { "API-KEY": options.apiKey };
  async function request(url: string, init: RequestInit, submission = false): Promise<Record<string, unknown>> {
    let response: Response;
    try { response = await fetcher(url, { ...init, redirect: "error", signal: AbortSignal.timeout(30_000) }); }
    catch { throw new AIProviderFailure(submission ? "onemin_submission_uncertain" : "onemin_request_unavailable", submission ? "uncertain" : "transient", submission ? "unknown" : "not-started"); }
    if (!response.ok) {
      // Only machine-readable codes are inspected; provider messages and account details are never returned.
      let code = "";
      try { const body = record(JSON.parse(new TextDecoder().decode(await boundedBytes(response, 262144)))); code = String(record(body.error).code ?? body.code ?? ""); } catch { /* sanitized below */ }
      const credits = response.status === 402 || /insufficient.*(credit|quota)|credit.*insufficient/i.test(code);
      const category = credits ? "credits" : [401, 403].includes(response.status) ? "auth" : response.status === 429 ? "rate-limit" : response.status >= 500 ? "uncertain" : "incompatible";
      throw new AIProviderFailure(`onemin_${credits ? "insufficient_credits" : `http_${response.status}`}`, category,
        submission && response.status >= 500 ? "unknown" : "rejected", credits ? 900_000 : response.status === 429 ? 60_000 : 0);
    }
    try { return record(JSON.parse(new TextDecoder().decode(await boundedBytes(response, 262144)))); }
    catch { throw new AIProviderFailure("onemin_response_invalid", submission ? "uncertain" : "transient", submission ? "accepted" : "not-started"); }
  }
  async function get(id: string) { return record((await request(resultPath(id), { headers })).aiRecord); }
  return {
    capabilities: oneminVideoCapabilities,
    async readiness() { return { authenticated: Boolean(options.apiKey), available: Boolean(options.apiKey), funding: "unknown", balanceUnits: null }; },
    async estimate(request) { return { units: request.durationSeconds, usd: null }; },
    async generate(input) {
      if (input.durationSeconds !== 6 || input.aspectRatio !== "9:16" || !input.prompt.trim() || input.prompt.length > 5000 ||
        !["image/jpeg", "image/png", "image/webp"].includes(input.imageMimeType) || !input.image.length || input.image.length > 10 * 1024 * 1024) {
        throw new AIProviderFailure("onemin_request_invalid", "incompatible", "not-started");
      }
      const form = new FormData();
      form.append("asset", new Blob([new Uint8Array(input.image)], { type: input.imageMimeType }), `reference.${input.imageMimeType === "image/jpeg" ? "jpg" : input.imageMimeType.split("/")[1]}`);
      const uploaded = await request(`${origin}/api/assets`, { method: "POST", headers, body: form });
      const path = record(uploaded.asset).key;
      if (typeof path !== "string" || !/^images\/[A-Za-z0-9_./-]+$/.test(path) || path.includes("..") || path.length > 1000) {
        throw new AIProviderFailure("onemin_asset_invalid", "transient", "not-started");
      }
      // No upstream idempotency guarantee: never retry an uncertain generation POST.
      const body = await request(`${origin}/api/features`, {
        method: "POST", headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "TEXT_TO_VIDEO", model: oneminVideoModel, conversationId: "TEXT_TO_VIDEO", async: true,
          promptObject: { prompt: input.prompt, imageUrls: [path], duration: 6, resolution: "720p", ratio: "9:16", generateAudio: true } }),
      }, true);
      const row = record(body.aiRecord);
      if (typeof row.uuid !== "string") throw new AIProviderFailure("onemin_submission_uncertain", "uncertain", "accepted");
      try { resultPath(row.uuid); } catch { throw new AIProviderFailure("onemin_submission_uncertain", "uncertain", "accepted"); }
      return { providerJobId: row.uuid, estimatedCostUsd: null };
    },
    async status(id) {
      const row = await get(id);
      if (row.status === "PROCESSING") return { status: "processing", progress: 50 };
      if (row.status === "FAILURE" || row.status === "FAILED") {
        const code = record(record(row.aiRecordDetail).resultObject).code;
        return { status: "failed", progress: 0, errorCode: code === "INSUFFICIENT_CREDITS" ? "onemin_insufficient_credits" : "onemin_generation_failed" };
      }
      if (row.status !== "SUCCESS") throw new AIProviderFailure("onemin_status_invalid", "transient", "accepted");
      trustedOutput(row.temporaryUrl);
      // Resolve a fresh signed URL on download, without persisting it or exposing it to clients.
      return { status: "completed", progress: 100, downloadUrl: `onemin-record:${id}` };
    },
    async download(reference) {
      if (!reference.startsWith("onemin-record:")) throw new AIProviderFailure("onemin_reference_invalid", "incompatible", "accepted");
      const row = await get(reference.slice("onemin-record:".length));
      if (row.status !== "SUCCESS") throw new AIProviderFailure("onemin_output_not_ready", "transient", "accepted");
      const url = trustedOutput(row.temporaryUrl);
      try {
        const response = await fetcher(url, { redirect: "error", signal: AbortSignal.timeout(60_000) });
        if (!response.ok) throw new Error("download_failed");
        const bytes = await boundedBytes(response, 100 * 1024 * 1024);
        if (bytes.length < 12 || String.fromCharCode(...bytes.slice(4, 8)) !== "ftyp") throw new Error("invalid_mp4");
        return bytes;
      } catch { throw new AIProviderFailure("onemin_download_failed", "transient", "accepted"); }
    },
  };
}
