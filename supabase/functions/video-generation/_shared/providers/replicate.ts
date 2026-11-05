import {
  AIProviderFailure,
  initialProviderCapabilities,
  type AIProviderAdapter,
  type AIProviderReadiness,
} from "../ai-provider-router.ts";

export interface ReplicateVideoRequest {
  imageUrl: string;
  prompt: string;
  durationSeconds: 6;
  aspectRatio: "9:16";
}

export interface ReplicatePrediction {
  providerJobId: string;
  statusUrl: string;
}

export interface ReplicateVideoStatus {
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  progress: number;
  outputUrl?: string;
  errorCode?: string;
}

export interface ReplicateOptions {
  apiToken: string;
  supabaseUrl: string;
  paidSpendAuthorized: boolean;
  commercialUseConfirmed: boolean;
  fetcher?: typeof fetch;
}

const apiOrigin = "https://api.replicate.com";
const modelEndpoint = `${apiOrigin}/v1/models/alibaba/happyhorse-1.0/predictions`;
const model = "alibaba/happyhorse-1.0";
const durationSeconds = 6;
const estimatedUsd = 0.84;
const maxImageUrlLength = 4096;
const maxResultBytes = 100 * 1024 * 1024;
const fileOrigin = /\.replicate\.delivery$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function trustedInputUrl(value: string, supabaseUrl: string): string {
  let url: URL;
  let supabase: URL;
  try {
    url = new URL(value);
    supabase = new URL(supabaseUrl);
  } catch {
    throw new AIProviderFailure("replicate_input_url_invalid", "incompatible", "not-started");
  }
  if (url.protocol !== "https:" || url.origin !== supabase.origin ||
    !url.pathname.startsWith("/storage/v1/object/sign/mv-video-assets/") ||
    url.username || url.password || value.length > maxImageUrlLength) {
    throw new AIProviderFailure("replicate_input_url_invalid", "incompatible", "not-started");
  }
  return url.href;
}

function safeOutputUrl(value: unknown): string {
  if (typeof value !== "string") {
    throw new AIProviderFailure("replicate_output_url_invalid", "uncertain", "accepted");
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AIProviderFailure("replicate_output_url_invalid", "uncertain", "accepted");
  }
  if (url.protocol !== "https:" || !fileOrigin.test(url.hostname) || url.username || url.password) {
    throw new AIProviderFailure("replicate_output_url_invalid", "uncertain", "accepted");
  }
  return url.href;
}

function responseFailure(response: Response, prefix: string): AIProviderFailure {
  if (response.status === 401 || response.status === 403) {
    return new AIProviderFailure(`${prefix}_authentication_failed`, "auth");
  }
  if (response.status === 402) return new AIProviderFailure(`${prefix}_insufficient_credits`, "credits");
  if (response.status === 429) {
    const seconds = Number(response.headers.get("Retry-After"));
    return new AIProviderFailure(
      `${prefix}_rate_limited`,
      "rate-limit",
      "rejected",
      Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : 0,
    );
  }
  if (response.status >= 500) {
    return new AIProviderFailure(`${prefix}_submission_uncertain`, "uncertain", "unknown");
  }
  return new AIProviderFailure(`${prefix}_request_rejected`, "incompatible");
}

function validateMp4(bytes: Uint8Array): void {
  if (bytes.byteLength < 12 || String.fromCharCode(...bytes.slice(4, 8)) !== "ftyp") {
    throw new AIProviderFailure("replicate_result_invalid", "incompatible", "accepted");
  }
}

export function createReplicateVideoProvider(
  options: ReplicateOptions,
): AIProviderAdapter<ReplicateVideoRequest, ReplicatePrediction> & {
  status(providerJobId: string): Promise<ReplicateVideoStatus>;
  cancel(providerJobId: string): Promise<void>;
  download(url: string): Promise<Uint8Array>;
} {
  const fetcher = options.fetcher ?? fetch;
  const capabilities = {
    ...initialProviderCapabilities[2],
    commercialUse: options.commercialUseConfirmed ? "confirmed" as const : "not-confirmed" as const,
  };
  const authorizationHeaders = {
    Authorization: `Bearer ${options.apiToken}`,
    "Content-Type": "application/json",
  };

  function predictionUrl(id: string): string {
    if (!/^[a-z0-9]{10,64}$/i.test(id)) {
      throw new AIProviderFailure("replicate_prediction_id_invalid", "incompatible", "not-started");
    }
    return `${apiOrigin}/v1/predictions/${encodeURIComponent(id)}`;
  }

  return {
    capabilities,
    async readiness(): Promise<AIProviderReadiness> {
      return {
        authenticated: Boolean(options.apiToken),
        available: Boolean(options.apiToken),
        funding: options.paidSpendAuthorized ? "paid-authorized" : "unknown",
        balanceUnits: null,
      };
    },
    async estimate(request) {
      if (request.durationSeconds !== durationSeconds || request.aspectRatio !== "9:16") {
        throw new AIProviderFailure("replicate_video_parameters_unsupported", "incompatible", "not-started");
      }
      return { units: durationSeconds, usd: estimatedUsd };
    },
    async generate(request) {
      const image = trustedInputUrl(request.imageUrl, options.supabaseUrl);
      if (request.durationSeconds !== durationSeconds || request.aspectRatio !== "9:16" ||
        !request.prompt.trim() || request.prompt.length > 2000) {
        throw new AIProviderFailure("replicate_video_request_invalid", "incompatible", "not-started");
      }
      let response: Response;
      try {
        response = await fetcher(modelEndpoint, {
          method: "POST",
          headers: authorizationHeaders,
          body: JSON.stringify({
            input: {
              image,
              prompt: request.prompt,
              duration: durationSeconds,
              resolution: "720p",
            },
          }),
          redirect: "error",
          signal: AbortSignal.timeout(30_000),
        });
      } catch {
        throw new AIProviderFailure("replicate_submission_uncertain", "uncertain", "unknown");
      }
      if (!response.ok) throw responseFailure(response, "replicate_video");
      const prediction: unknown = await response.json().catch(() => null);
      if (!isRecord(prediction) || typeof prediction.id !== "string" ||
        typeof prediction.status !== "string" || !["starting", "processing", "succeeded"].includes(prediction.status)) {
        throw new AIProviderFailure("replicate_submission_uncertain", "uncertain", "accepted");
      }
      return { providerJobId: prediction.id, statusUrl: predictionUrl(prediction.id) };
    },
    async status(providerJobId) {
      let response: Response;
      try {
        response = await fetcher(predictionUrl(providerJobId), {
          headers: { Authorization: `Bearer ${options.apiToken}` },
          redirect: "error",
          signal: AbortSignal.timeout(15_000),
        });
      } catch {
        throw new AIProviderFailure("replicate_status_unavailable", "transient", "accepted");
      }
      if (!response.ok) throw responseFailure(response, "replicate_status");
      const prediction: unknown = await response.json().catch(() => null);
      if (!isRecord(prediction) || typeof prediction.status !== "string") {
        throw new AIProviderFailure("replicate_status_invalid_response", "transient", "accepted");
      }
      if (prediction.status === "starting") return { status: "queued", progress: 5 };
      if (prediction.status === "processing") return { status: "processing", progress: 50 };
      if (prediction.status === "canceled") return { status: "cancelled", progress: 0 };
      if (prediction.status === "failed") return { status: "failed", progress: 0, errorCode: "replicate_generation_failed" };
      if (prediction.status !== "succeeded") {
        throw new AIProviderFailure("replicate_status_invalid_response", "transient", "accepted");
      }
      const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
      return { status: "completed", progress: 100, outputUrl: safeOutputUrl(output) };
    },
    async cancel(providerJobId) {
      let response: Response;
      try {
        response = await fetcher(`${predictionUrl(providerJobId)}/cancel`, {
          method: "POST",
          headers: { Authorization: `Bearer ${options.apiToken}` },
          redirect: "error",
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        throw new AIProviderFailure("replicate_cancel_unavailable", "transient", "accepted");
      }
      if (response.ok || response.status === 409) return;
      throw responseFailure(response, "replicate_cancel");
    },
    async download(url) {
      const trustedUrl = safeOutputUrl(url);
      let response: Response;
      try {
        response = await fetcher(trustedUrl, {
          redirect: "error",
          signal: AbortSignal.timeout(60_000),
        });
      } catch {
        throw new AIProviderFailure("replicate_download_unavailable", "transient", "accepted");
      }
      if (!response.ok || !response.body) {
        throw new AIProviderFailure("replicate_download_failed", "transient", "accepted");
      }
      const declaredLength = Number(response.headers.get("Content-Length"));
      if (Number.isFinite(declaredLength) && declaredLength > maxResultBytes) {
        throw new AIProviderFailure("replicate_result_too_large", "incompatible", "accepted");
      }
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxResultBytes) {
          await reader.cancel();
          throw new AIProviderFailure("replicate_result_too_large", "incompatible", "accepted");
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      validateMp4(bytes);
      return bytes;
    },
  };
}

export { model as replicateVideoModel, estimatedUsd as replicateVideoEstimateUsd };
