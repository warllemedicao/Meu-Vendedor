import {
  AIProviderFailure,
  initialProviderCapabilities,
  type AIProviderAdapter,
  type AIProviderReadiness,
} from "../ai-provider-router.ts";

export interface MagicHourVideoRequest {
  image: Uint8Array;
  imageMimeType: "image/jpeg" | "image/png" | "image/webp";
  prompt: string;
  durationSeconds: number;
  aspectRatio: "9:16";
}

export interface MagicHourVideoSubmission {
  providerJobId: string;
  creditsCharged: number;
  estimatedCostUsd: number | null;
}

export interface MagicHourVideoStatus {
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  progress: number;
  downloadUrl?: string;
  errorCode?: string;
}

export interface MagicHourAccount {
  tier: "free" | "creator" | "pro" | "business";
  credits: number;
}

export interface MagicHourOptions {
  freeOnly?: boolean;
  apiKey: string;
  creditUsd: number | null;
  commercialUseConfirmed: boolean;
  freeCreditsConfirmed: boolean;
  paidSpendAuthorized: boolean;
  fetcher?: typeof fetch;
}

const apiOrigin = "https://api.magichour.ai";
const model = "ltx-2.5";
const resolution = "480p";
const creditsPerSecond = 24;
const maxImageBytes = 10 * 1024 * 1024;
const maxResultBytes = 100 * 1024 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fileExtension(mimeType: MagicHourVideoRequest["imageMimeType"]): string {
  return mimeType === "image/jpeg" ? "jpg" : mimeType === "image/png" ? "png" : "webp";
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function assertTrustedAssetUrl(value: unknown): string {
  if (typeof value !== "string") throw new AIProviderFailure("magichour_invalid_asset_url", "incompatible");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AIProviderFailure("magichour_invalid_asset_url", "incompatible");
  }
  if (url.protocol !== "https:" || url.hostname !== "videos.magichour.ai" || url.username || url.password) {
    throw new AIProviderFailure("magichour_invalid_asset_url", "incompatible");
  }
  return url.href;
}

function asProviderFailure(response: Response, prefix: string): AIProviderFailure {
  if (response.status === 401 || response.status === 403) {
    return new AIProviderFailure(`${prefix}_authentication_failed`, "auth");
  }
  if (response.status === 402) return new AIProviderFailure(`${prefix}_insufficient_credits`, "credits");
  if (response.status === 429) {
    const raw = response.headers.get("Retry-After");
    const seconds = Number(raw);
    const retryAfter = Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : 0;
    return new AIProviderFailure(`${prefix}_rate_limited`, "rate-limit", "rejected", retryAfter);
  }
  if (response.status >= 500) {
    return new AIProviderFailure(`${prefix}_submission_uncertain`, "uncertain", "unknown");
  }
  return new AIProviderFailure(`${prefix}_request_rejected`, "incompatible");
}

export function magicHourEstimatedCredits(durationSeconds: number): number {
  if (!Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 60) {
    throw new AIProviderFailure("magichour_duration_unsupported", "incompatible", "not-started");
  }
  return durationSeconds * creditsPerSecond;
}

export function createMagicHourVideoProvider(
  options: MagicHourOptions,
): AIProviderAdapter<MagicHourVideoRequest, MagicHourVideoSubmission> & {
  getAccount(): Promise<MagicHourAccount>;
  status(providerJobId: string): Promise<MagicHourVideoStatus>;
  download(url: string): Promise<Uint8Array>;
} {
  const fetcher = options.fetcher ?? fetch;
  const capabilities = {
    ...initialProviderCapabilities[1],
    commercialUse: options.commercialUseConfirmed ? "confirmed" as const : "not-confirmed" as const,
  };
  const authorizationHeaders = {
    Authorization: `Bearer ${options.apiKey}`,
    "Content-Type": "application/json",
  };

  async function getAccount(): Promise<MagicHourAccount> {
    let response: Response;
    try {
      response = await fetcher(`${apiOrigin}/v1/account`, {
        headers: { Authorization: `Bearer ${options.apiKey}` },
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new AIProviderFailure("magichour_account_unavailable", "transient", "not-started");
    }
    if (!response.ok) throw asProviderFailure(response, "magichour_account");
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new AIProviderFailure("magichour_account_invalid_response", "transient", "not-started");
    }
    if (!isRecord(body) || !["free", "creator", "pro", "business"].includes(String(body.tier)) ||
      typeof body.credits !== "number" || !Number.isFinite(body.credits) || body.credits < 0) {
      throw new AIProviderFailure("magichour_account_invalid_response", "transient", "not-started");
    }
    return { tier: body.tier as MagicHourAccount["tier"], credits: body.credits };
  }

  return {
    capabilities,
    async readiness(): Promise<AIProviderReadiness> {
      try {
        const account = await getAccount();
        return {
          authenticated: true,
          available: account.credits > 0,
          funding: options.paidSpendAuthorized
            ? "paid-authorized"
            : options.freeCreditsConfirmed && account.tier === "free"
              ? "free-confirmed"
              : "unknown",
          balanceUnits: account.credits,
        };
      } catch (error) {
        return {
          authenticated: !(error instanceof AIProviderFailure && error.category === "auth"),
          available: false,
          funding: "unknown",
          balanceUnits: null,
        };
      }
    },
    async estimate(request) {
      return {
        units: magicHourEstimatedCredits(request.durationSeconds),
        usd: options.freeOnly ? 0 : options.creditUsd === null ? null : magicHourEstimatedCredits(request.durationSeconds) * options.creditUsd,
      };
    },
    async generate(request) {
      if (request.durationSeconds !== 6 || request.aspectRatio !== "9:16" ||
        !request.prompt.trim() || request.prompt.length > 2000 ||
        request.image.byteLength === 0 || request.image.byteLength > maxImageBytes) {
        throw new AIProviderFailure("magichour_request_invalid", "incompatible", "not-started");
      }
      const uploadResponse = await fetcher(`${apiOrigin}/v1/files/upload-urls`, {
        method: "POST",
        headers: authorizationHeaders,
        body: JSON.stringify({ items: [{ type: "image", extension: fileExtension(request.imageMimeType) }] }),
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
      }).catch(() => {
        throw new AIProviderFailure("magichour_upload_url_unavailable", "transient", "not-started");
      });
      if (!uploadResponse.ok) throw asProviderFailure(uploadResponse, "magichour_upload_url");
      const uploadBody: unknown = await uploadResponse.json().catch(() => null);
      const item = isRecord(uploadBody) && Array.isArray(uploadBody.items) ? uploadBody.items[0] : null;
      if (!isRecord(item) || typeof item.file_path !== "string") {
        throw new AIProviderFailure("magichour_upload_url_invalid", "transient", "not-started");
      }
      const uploadUrl = assertTrustedAssetUrl(item.upload_url);
      const uploaded = await fetcher(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": request.imageMimeType },
        body: toArrayBuffer(request.image),
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      }).catch(() => {
        throw new AIProviderFailure("magichour_asset_upload_failed", "transient", "not-started");
      });
      if (!uploaded.ok) throw asProviderFailure(uploaded, "magichour_asset_upload");

      let submitted: Response;
      try {
        submitted = await fetcher(`${apiOrigin}/v1/image-to-video`, {
          method: "POST",
          headers: authorizationHeaders,
          body: JSON.stringify({
            name: "Meu Vendedor — anúncio vertical",
            end_seconds: request.durationSeconds,
            model,
            resolution,
            audio: true,
            style: { prompt: request.prompt },
            assets: { image_file_path: item.file_path },
          }),
          redirect: "error",
          signal: AbortSignal.timeout(30_000),
        });
      } catch {
        throw new AIProviderFailure("magichour_submission_uncertain", "uncertain", "unknown");
      }
      if (!submitted.ok) throw asProviderFailure(submitted, "magichour_video");
      const result: unknown = await submitted.json().catch(() => null);
      if (!isRecord(result) || typeof result.id !== "string" ||
        !Number.isFinite(result.credits_charged)) {
        throw new AIProviderFailure("magichour_submission_uncertain", "uncertain", "accepted");
      }
      return {
        providerJobId: result.id,
        creditsCharged: Number(result.credits_charged),
        estimatedCostUsd: options.freeOnly ? 0 : options.creditUsd === null
          ? null
          : Number(result.credits_charged) * options.creditUsd,
      };
    },
    async getAccount() {
      return getAccount();
    },
    async status(providerJobId) {
      if (!/^[A-Za-z0-9_-]{1,200}$/.test(providerJobId)) {
        throw new AIProviderFailure("magichour_job_id_invalid", "incompatible", "not-started");
      }
      let response: Response;
      try {
        response = await fetcher(`${apiOrigin}/v1/video-projects/${encodeURIComponent(providerJobId)}`, {
          headers: { Authorization: `Bearer ${options.apiKey}` },
          redirect: "error",
          signal: AbortSignal.timeout(15_000),
        });
      } catch {
        throw new AIProviderFailure("magichour_status_unavailable", "transient", "accepted");
      }
      if (!response.ok) throw asProviderFailure(response, "magichour_status");
      const body: unknown = await response.json().catch(() => null);
      if (!isRecord(body) || typeof body.status !== "string") {
        throw new AIProviderFailure("magichour_status_invalid_response", "transient", "accepted");
      }
      if (body.status === "queued" || body.status === "rendering") {
        return { status: body.status === "queued" ? "queued" : "processing", progress: body.status === "queued" ? 0 : 50 };
      }
      if (body.status === "canceled") return { status: "cancelled", progress: 0 };
      if (body.status === "error") return { status: "failed", progress: 0, errorCode: "magichour_generation_failed" };
      if (body.status !== "complete" || !Array.isArray(body.downloads) || !isRecord(body.downloads[0])) {
        throw new AIProviderFailure("magichour_status_invalid_response", "transient", "accepted");
      }
      return { status: "completed", progress: 100, downloadUrl: assertTrustedAssetUrl(body.downloads[0].url) };
    },
    async download(url) {
      const trustedUrl = assertTrustedAssetUrl(url);
      let response: Response;
      try {
        response = await fetcher(trustedUrl, {
          redirect: "error",
          signal: AbortSignal.timeout(30_000),
        });
      } catch {
        throw new AIProviderFailure("magichour_download_unavailable", "transient", "accepted");
      }
      if (!response.ok) throw new AIProviderFailure("magichour_download_failed", "transient", "accepted");
      const declaredLength = Number(response.headers.get("Content-Length"));
      if (Number.isFinite(declaredLength) && declaredLength > maxResultBytes) {
        throw new AIProviderFailure("magichour_result_too_large", "incompatible", "accepted");
      }
      if (!response.body) throw new AIProviderFailure("magichour_result_empty", "transient", "accepted");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxResultBytes) {
          await reader.cancel();
          throw new AIProviderFailure("magichour_result_too_large", "incompatible", "accepted");
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      if (bytes.byteLength < 12 ||
        String.fromCharCode(...bytes.slice(4, 8)) !== "ftyp") {
        throw new AIProviderFailure("magichour_result_invalid", "incompatible", "accepted");
      }
      return bytes;
    },
  };
}
