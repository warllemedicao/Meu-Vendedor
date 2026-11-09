export const MAX_AUDIO_DOWNLOAD_BYTES = 50 * 1024 * 1024;

export function parseDirectAudioUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Informe um link válido para o arquivo MP3.");
  }

  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Use um link HTTPS válido, sem usuário ou senha na URL.");
  }

  return url;
}

export function isMp3ContentType(contentType: string | null, pathname: string): boolean {
  const mimeType = contentType?.split(";")[0]?.trim().toLowerCase();
  return mimeType === "audio/mpeg" || pathname.toLowerCase().endsWith(".mp3");
}

export function hasMp3Signature(bytes: Uint8Array): boolean {
  if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true;
  return bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
}

export async function downloadDirectMp3(
  value: string,
  fetcher: typeof fetch = fetch,
): Promise<{ blob: Blob; filename: "audio.mp3" }> {
  const url = parseDirectAudioUrl(value);
  let response: Response;
  try {
    response = await fetcher(url.toString(), { mode: "cors", credentials: "omit", redirect: "follow" });
  } catch {
    throw new Error("Não foi possível acessar o arquivo. Verifique o link e se o site permite acesso pelo navegador (CORS).");
  }

  if (!response.ok) throw new Error(`O site de origem respondeu com erro HTTP ${response.status}.`);
  const finalUrl = parseDirectAudioUrl(response.url || url.toString());
  if (!isMp3ContentType(response.headers.get("content-type"), finalUrl.pathname)) {
    throw new Error("O link não retornou um arquivo MP3 direto.");
  }

  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_AUDIO_DOWNLOAD_BYTES) {
    throw new Error("O arquivo excede o limite de 50 MB.");
  }

  if (!response.body) throw new Error("O navegador não conseguiu ler o arquivo retornado pelo site.");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_AUDIO_DOWNLOAD_BYTES) {
        await reader.cancel();
        throw new Error("O arquivo excede o limite de 50 MB.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const fileBuffer = new ArrayBuffer(size);
  const fileBytes = new Uint8Array(fileBuffer);
  let offset = 0;
  for (const chunk of chunks) {
    fileBytes.set(chunk, offset);
    offset += chunk.length;
  }
  if (!hasMp3Signature(fileBytes.subarray(0, 10))) {
    throw new Error("O conteúdo recebido não parece ser um arquivo MP3 válido.");
  }

  return { blob: new Blob([fileBuffer], { type: "audio/mpeg" }), filename: "audio.mp3" };
}
