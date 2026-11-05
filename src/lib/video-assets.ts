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
