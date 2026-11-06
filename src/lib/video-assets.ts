import type { SupabaseClient } from "@supabase/supabase-js";

export const VIDEO_ASSET_BUCKET = "mv-video-assets";
export const MAX_VIDEO_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_RESULT_BYTES = 100 * 1024 * 1024;
export const MAX_VIDEO_DEMO_BYTES = 10 * 1024 * 1024;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const imageExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function uploadVideoProductImage(
  client: SupabaseClient,
  userId: string,
  file: File,
): Promise<string> {
  const extension = imageExtensions[file.type];
  if (!uuidPattern.test(userId)) throw new Error("Não foi possível identificar a conta autenticada.");
  if (!extension) throw new Error("Use uma imagem PNG, JPEG ou WebP.");
  if (file.size > MAX_VIDEO_IMAGE_BYTES) throw new Error("A imagem deve ter no máximo 10 MB.");

  const path = `${userId}/inputs/${crypto.randomUUID()}.${extension}`;
  const { error } = await client.storage.from(VIDEO_ASSET_BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error("Não foi possível salvar a imagem no armazenamento privado.");
  return path;
}

export interface VideoAIReference {
  path: string;
  width: number;
  height: number;
}

async function uploadAIReference(
  client: SupabaseClient,
  userId: string,
  source: Blob,
): Promise<VideoAIReference> {
  if (!uuidPattern.test(userId)) throw new Error("Não foi possível identificar a conta autenticada.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(source);
  } catch {
    throw new Error("Não foi possível preparar a imagem para a geração.");
  }
  const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Não foi possível preparar a imagem para a geração.");
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const resized = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!resized || resized.size === 0 || resized.size > MAX_VIDEO_IMAGE_BYTES) {
    throw new Error("Não foi possível preparar a imagem para a geração.");
  }
  const digest = await crypto.subtle.digest("SHA-256", await resized.arrayBuffer());
  const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const path = `${userId}/inputs/ref-${fingerprint}.jpg`;
  const storage = client.storage.from(VIDEO_ASSET_BUCKET);
  const { data: existing } = await storage.download(path);
  if (existing) {
    const existingDigest = await crypto.subtle.digest("SHA-256", await existing.arrayBuffer());
    const existingFingerprint = Array.from(new Uint8Array(existingDigest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    if (existingFingerprint !== fingerprint) throw new Error("A referência armazenada foi alterada. Selecione uma nova imagem.");
    return { path, width, height };
  }
  const { error } = await storage.upload(path, resized, {
    cacheControl: "3600",
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) {
    // Duas abas podem preparar a mesma referência ao mesmo tempo.
    const { data: concurrent } = await storage.download(path);
    if (!concurrent || concurrent.size !== resized.size) throw new Error("Não foi possível salvar a referência privada para processamento.");
    const actual = await crypto.subtle.digest("SHA-256", await concurrent.arrayBuffer());
    if (Array.from(new Uint8Array(actual), (byte) => byte.toString(16).padStart(2, "0")).join("") !== fingerprint) {
      throw new Error("Não foi possível validar a referência privada para processamento.");
    }
  }
  return { path, width, height };
}

export async function createVideoProductAIReference(
  client: SupabaseClient,
  userId: string,
  sourcePath: string,
): Promise<VideoAIReference> {
  const ownedInputPath = new RegExp(`^${userId}/inputs/[A-Za-z0-9_-]+\\.(?:jpg|png|webp)$`);
  if (!uuidPattern.test(userId) || !ownedInputPath.test(sourcePath)) {
    throw new Error("A imagem do produto não pertence a esta conta.");
  }
  const { data, error } = await client.storage.from(VIDEO_ASSET_BUCKET).download(sourcePath);
  if (error || !data) throw new Error("Não foi possível recuperar a imagem privada do produto.");
  return uploadAIReference(client, userId, data);
}

export async function createVideoPresenterAIReference(
  client: SupabaseClient,
  userId: string,
  imagePath: string,
): Promise<VideoAIReference> {
  if (!uuidPattern.test(userId) || !/^\/presenters\/(?:ana|lucas)\.webp$/.test(imagePath)) {
    throw new Error("A referência visual deste personagem não está aprovada para processamento.");
  }
  const response = await fetch(imagePath, { credentials: "same-origin", redirect: "error" })
    .catch(() => { throw new Error("Não foi possível carregar a referência visual do personagem."); });
  if (!response.ok || response.headers.get("Content-Type")?.split(";")[0] !== "image/webp") {
    throw new Error("Não foi possível carregar a referência visual do personagem.");
  }
  return uploadAIReference(client, userId, await response.blob());
}

export async function uploadVideoResult(
  client: SupabaseClient,
  userId: string,
  file: File,
): Promise<string> {
  if (!uuidPattern.test(userId)) throw new Error("Não foi possível identificar a conta autenticada.");
  if (file.type !== "video/mp4") throw new Error("Use um arquivo MP4.");
  if (file.size === 0 || file.size > MAX_VIDEO_RESULT_BYTES) {
    throw new Error("O vídeo deve ter entre 1 byte e 100 MB.");
  }

  const path = `${userId}/outputs/${crypto.randomUUID()}.mp4`;
  const { error } = await client.storage.from(VIDEO_ASSET_BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: "video/mp4",
    upsert: false,
  });
  if (error) throw new Error("Não foi possível salvar o vídeo no armazenamento privado.");
  return path;
}

export async function createVideoAssetUrl(
  client: SupabaseClient,
  userId: string,
  path: string,
): Promise<string> {
  const ownedAssetPath = new RegExp(`^${userId}/(?:inputs/[A-Za-z0-9_-]+\\.(?:jpg|png|webp)|outputs/[A-Za-z0-9_-]+\\.mp4)$`);
  if (!uuidPattern.test(userId) || !ownedAssetPath.test(path)) {
    throw new Error("O arquivo não pertence a esta conta.");
  }
  const { data, error } = await client.storage.from(VIDEO_ASSET_BUCKET).createSignedUrl(path, 300);
  if (error || !data?.signedUrl) throw new Error("Não foi possível acessar o arquivo privado.");
  return data.signedUrl;
}
