import type { CloudflareImageRequest } from "./providers/cloudflare-workers-ai.ts";

export async function sha256(bytes: Uint8Array): Promise<string> {
  const buffer = new Uint8Array(bytes).buffer;
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// A identidade inclui conteúdo, direção, modelo e parâmetros; nunca URLs temporárias.
export async function imageCacheKey(request: CloudflareImageRequest): Promise<string> {
  const references = await Promise.all(request.references.map(async (image) => ({
    digest: await sha256(image.bytes), mimeType: image.mimeType, width: image.width, height: image.height,
  })));
  return sha256(new TextEncoder().encode(JSON.stringify({
    version: 1, model: "@cf/black-forest-labs/flux-2-dev", prompt: request.prompt,
    width: request.outputWidth, height: request.outputHeight, steps: request.steps, references,
  })));
}
