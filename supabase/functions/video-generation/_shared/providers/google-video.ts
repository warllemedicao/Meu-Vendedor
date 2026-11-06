import { AIProviderFailure, type AIProviderAdapter, type AIProviderCapabilities } from "../ai-provider-router.ts";
import type { VideoGenerationRequest, VideoSubmission } from "../processor.ts";
import type { MagicHourVideoStatus } from "./magic-hour.ts";

export const googleVideoModel = "gemini-omni-1.2-flash";
export const googleVideoCapabilities: AIProviderCapabilities = {
  id: "google-gemini", task: "video", model: googleVideoModel,
  inputModes: ["text", "image-reference"], maxReferenceImages: 6,
  durationsSeconds: [6], aspectRatios: ["9:16"], maxResolution: "720p",
  nativeAudio: true, lipSync: false, commercialUse: "not-confirmed",
  freeTier: "unknown", supportsBalanceQuery: false, costUsdPerUnit: null, costUnit: "second",
};
const origin = "https://generativelanguage.googleapis.com";
const maxJsonBytes = 32 * 1024 * 1024;
const record = (v: unknown): Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
function interactionPath(id: string): string {
  if (!/^[A-Za-z0-9_-]{1,500}$/.test(id)) throw new AIProviderFailure("google_video_id_invalid", "incompatible", "not-started");
  return `${origin}/v1beta/interactions/${id}`;
}
async function json(response: Response, submitting = false): Promise<Record<string, unknown>> {
  if (!response.ok) {
    await response.body?.cancel();
    const category = response.status === 401 || response.status === 403 ? "auth" : response.status === 402 ? "credits" : response.status === 429 ? "rate-limit" : response.status >= 500 ? "uncertain" : "incompatible";
    throw new AIProviderFailure(`google_video_http_${response.status}`, category,
      submitting && response.status >= 500 ? "unknown" : submitting ? "rejected" : "accepted", response.status === 429 ? 60_000 : 0);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new AIProviderFailure("google_video_response_empty", "uncertain", "accepted");
  let total = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxJsonBytes) throw new Error("oversize");
      chunks.push(value);
    }
    const bytes = new Uint8Array(total); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return record(JSON.parse(new TextDecoder().decode(bytes)));
  } catch { throw new AIProviderFailure("google_video_response_invalid", "uncertain", "accepted"); }
  finally { await reader.cancel(); }
}
function output(body: Record<string, unknown>): Record<string, unknown> {
  // output_video is SDK-only. REST returns model_output in steps.
  for (const step of Array.isArray(body.steps) ? body.steps : []) {
    const row = record(step);
    if (row.type !== "model_output") continue;
    for (const item of Array.isArray(row.content) ? row.content : []) {
      const media = record(item);
      if (media.type === "video" && media.mime_type === "video/mp4") return media;
    }
  }
  return {};
}

export function createGoogleVideoProvider(options: { apiKey: string; fetcher?: typeof fetch }): AIProviderAdapter<VideoGenerationRequest, VideoSubmission> & {
  status(id: string): Promise<MagicHourVideoStatus>;
  download(reference: string): Promise<Uint8Array>;
} {
  const fetcher = options.fetcher ?? fetch;
  const headers = { "x-goog-api-key": options.apiKey, "Content-Type": "application/json" };
  async function get(id: string) {
    const response = await fetcher(interactionPath(id), { headers, redirect: "error", signal: AbortSignal.timeout(30_000) })
      .catch(() => { throw new AIProviderFailure("google_video_status_unavailable", "transient", "accepted"); });
    return json(response);
  }
  return {
    capabilities: googleVideoCapabilities,
    async readiness() {
      // API funding belongs to the application project, never to the user's Flow subscription.
      return { authenticated: Boolean(options.apiKey), available: Boolean(options.apiKey), funding: "unknown", balanceUnits: null };
    },
    async estimate(request) { return { units: request.durationSeconds, usd: null }; },
    async generate(request) {
      if (request.durationSeconds !== 6 || request.aspectRatio !== "9:16" || !request.prompt.trim() || request.prompt.length > 5000 ||
        !["image/jpeg", "image/png", "image/webp"].includes(request.imageMimeType) || !request.image.byteLength || request.image.byteLength > 10 * 1024 * 1024) {
        throw new AIProviderFailure("google_video_request_invalid", "incompatible", "not-started");
      }
      let binary = "";
      for (let i = 0; i < request.image.length; i += 8192) binary += String.fromCharCode(...request.image.subarray(i, i + 8192));
      const response = await fetcher(`${origin}/v1beta/interactions`, {
        method: "POST", headers, redirect: "error", signal: AbortSignal.timeout(60_000),
        body: JSON.stringify({ model: googleVideoModel, background: true, store: true,
          input: [{ type: "image", mime_type: request.imageMimeType, data: btoa(binary) }, { type: "text", text: request.prompt }],
          response_format: { type: "video", aspect_ratio: "9:16", duration: "6s", resolution: "720p", delivery: "uri" } }),
      }).catch(() => { throw new AIProviderFailure("google_video_submission_uncertain", "uncertain", "unknown"); });
      const body = await json(response, true);
      if (typeof body.id !== "string" || !/^[A-Za-z0-9_-]{1,500}$/.test(body.id)) throw new AIProviderFailure("google_video_submission_uncertain", "uncertain", "accepted");
      return { providerJobId: body.id, estimatedCostUsd: null };
    },
    async status(id) {
      const body = await get(id);
      if (body.status === "in_progress") return { status: "processing", progress: 50 };
      if (body.status === "cancelled") return { status: "cancelled", progress: 0 };
      if (body.status === "failed") return { status: "failed", progress: 0, errorCode: "google_video_generation_failed" };
      if (body.status !== "completed" || !output(body).data) throw new AIProviderFailure("google_video_status_invalid", "transient", "accepted");
      // Retrieval returns base64 even when creation requested URI delivery. Download through this adapter.
      return { status: "completed", progress: 100, downloadUrl: `google-interaction:${id}` };
    },
    async download(reference) {
      if (!reference.startsWith("google-interaction:")) throw new AIProviderFailure("google_video_reference_invalid", "incompatible", "accepted");
      const media = output(await get(reference.slice("google-interaction:".length)));
      if (typeof media.data !== "string" || media.data.length > maxJsonBytes) throw new AIProviderFailure("google_video_output_missing", "transient", "accepted");
      let binary: string;
      try { binary = atob(media.data); } catch { throw new AIProviderFailure("google_video_output_invalid", "incompatible", "accepted"); }
      const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
      if (bytes.length < 12 || String.fromCharCode(...bytes.slice(4, 8)) !== "ftyp") throw new AIProviderFailure("google_video_output_invalid", "incompatible", "accepted");
      return bytes;
    },
  };
}
