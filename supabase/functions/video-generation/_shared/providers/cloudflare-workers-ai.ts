import {
  AIProviderFailure,
  initialProviderCapabilities,
  type AIProviderAdapter,
  type AIProviderReadiness,
} from "../ai-provider-router.ts";

export interface AIImageReference {
  bytes: Uint8Array;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
}

export interface CloudflareImageRequest {
  prompt: string;
  references: readonly AIImageReference[];
  outputWidth: number;
  outputHeight: number;
  steps: number;
}

export interface CloudflareImageResult {
  bytes: Uint8Array;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  model: string;
  estimatedCostUsd: number;
}

export interface CloudflareWorkersAIOptions {
  accountId: string;
  apiToken: string;
  readiness(): Promise<AIProviderReadiness>;
  fetcher?: typeof fetch;
}

const model = "@cf/black-forest-labs/flux-2-dev";
const maxInputImageBytes = 10 * 1024 * 1024;
const maxOutputImageBytes = 20 * 1024 * 1024;

function estimate(request: CloudflareImageRequest): { units: number; usd: number } {
  const inputTiles = request.references.reduce((total, image) => {
    if (!Number.isInteger(image.width) || !Number.isInteger(image.height) ||
      image.width < 1 || image.height < 1 || image.width > 512 || image.height > 512) {
      throw new AIProviderFailure("reference_image_dimensions_unsupported", "incompatible", "not-started");
    }
    return total + Math.ceil(image.width / 512) * Math.ceil(image.height / 512);
  }, 0);
  const outputTiles = Math.ceil(request.outputWidth / 512) * Math.ceil(request.outputHeight / 512);
  if (!Number.isInteger(request.steps) || request.steps < 1 || request.steps > 25 ||
    request.outputWidth < 256 || request.outputHeight < 256 ||
    request.outputWidth > 1920 || request.outputHeight > 1920) {
    throw new AIProviderFailure("image_generation_parameters_invalid", "incompatible", "not-started");
  }
  const cost = request.steps * (inputTiles * 0.00021 + outputTiles * 0.00041);
  return {
    units: Math.ceil(cost / 0.000011),
    usd: Number(cost.toFixed(8)),
  };
}

function imageMimeType(bytes: Uint8Array): CloudflareImageResult["mimeType"] {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && String.fromCharCode(...bytes.slice(1, 4)) === "PNG") return "image/png";
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  throw new AIProviderFailure("cloudflare_output_image_invalid", "uncertain", "accepted");
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function retryAfterMs(response: Response): number {
  const value = response.headers.get("Retry-After");
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
}

export function createCloudflareWorkersAIProvider(
  options: CloudflareWorkersAIOptions,
): AIProviderAdapter<CloudflareImageRequest, CloudflareImageResult> {
  const fetcher = options.fetcher ?? fetch;
  return {
    capabilities: initialProviderCapabilities[0],
    readiness: options.readiness,
    async estimate(request) {
      return estimate(request);
    },
    async generate(request) {
      const { usd } = estimate(request);
      if (!request.prompt.trim() || request.prompt.length > 2048 || request.references.length > 4) {
        throw new AIProviderFailure("image_generation_request_invalid", "incompatible", "not-started");
      }
      if (request.references.some((image) =>
        image.bytes.byteLength === 0 || image.bytes.byteLength > maxInputImageBytes
      )) {
        throw new AIProviderFailure("reference_image_size_invalid", "incompatible", "not-started");
      }

      const form = new FormData();
      form.set("prompt", request.prompt);
      form.set("steps", String(request.steps));
      form.set("width", String(request.outputWidth));
      form.set("height", String(request.outputHeight));
      request.references.forEach((image, index) => {
        form.set(`input_image_${index}`, new Blob([toArrayBuffer(image.bytes)], { type: image.mimeType }), `reference-${index}.${image.mimeType.split("/")[1]}`);
      });

      let upstream: Response;
      try {
        upstream = await fetcher(
          `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(options.accountId)}/ai/run/${model}`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${options.apiToken}` },
            body: form,
            redirect: "error",
            signal: AbortSignal.timeout(90_000),
          },
        );
      } catch {
        throw new AIProviderFailure("cloudflare_submission_uncertain", "uncertain", "unknown");
      }

      if (upstream.status === 401 || upstream.status === 403) {
        throw new AIProviderFailure("cloudflare_authentication_failed", "auth");
      }
      if (upstream.status === 402) {
        throw new AIProviderFailure("cloudflare_insufficient_balance", "credits");
      }
      if (upstream.status === 429) {
        throw new AIProviderFailure("cloudflare_rate_limited", "rate-limit", "rejected", retryAfterMs(upstream));
      }
      if (upstream.status >= 500) {
        throw new AIProviderFailure("cloudflare_submission_uncertain", "uncertain", "unknown");
      }
      if (!upstream.ok) {
        throw new AIProviderFailure("cloudflare_request_rejected", "incompatible");
      }

      let payload: unknown;
      try {
        payload = await upstream.json();
      } catch {
        throw new AIProviderFailure("cloudflare_invalid_response", "uncertain", "accepted");
      }
      if (!payload || typeof payload !== "object" || !("result" in payload)) {
        throw new AIProviderFailure("cloudflare_invalid_response", "uncertain", "accepted");
      }
      const result = (payload as { result?: { image?: unknown } }).result;
      if (typeof result?.image !== "string") {
        throw new AIProviderFailure("cloudflare_invalid_response", "uncertain", "accepted");
      }
      let binary: string;
      try {
        binary = atob(result.image);
      } catch {
        throw new AIProviderFailure("cloudflare_invalid_image", "uncertain", "accepted");
      }
      if (!binary.length || binary.length > maxOutputImageBytes) {
        throw new AIProviderFailure("cloudflare_output_size_invalid", "uncertain", "accepted");
      }
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      return { bytes, mimeType: imageMimeType(bytes), model, estimatedCostUsd: usd };
    },
  };
}
