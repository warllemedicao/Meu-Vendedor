export class AudioError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}

const base = "https://api.elevenlabs.io";
export const speechModel = "eleven_multilingual_v2";
export const audioKeyNames = ["ELEVENLABS_API_KEY", "ELEVENLABS_API", "ELEVEN_LABS_API_KEY", "XI_API_KEY"];
export interface SpeechVoice { id: string; name: string; gender: string; language: string; category: string }
export function voicesForAccount(voices: SpeechVoice[], tier: string): SpeechVoice[] {
  // Free accounts can list library voices that the API refuses with payment_required.
  return tier.toLowerCase() === "free" ? voices.filter(v => v.category === "premade") : voices;
}

async function limited(response: Response, max: number): Promise<Uint8Array> {
  if (Number(response.headers.get("content-length")) > max) {
    await response.body?.cancel();
    throw new AudioError(502, "audio_response_invalid", "O serviço retornou um arquivo acima do limite.");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new AudioError(502, "audio_response_invalid", "O serviço retornou um arquivo vazio.");
  const parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) { await reader.cancel(); throw new AudioError(502, "audio_response_invalid", "Resposta acima do limite."); }
    parts.push(value);
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

export function createElevenLabs(key: string, fetcher: typeof fetch = fetch) {
  async function call(path: string, options: RequestInit = {}) {
    if (!key) throw new AudioError(503, "audio_not_configured", "A chave ElevenLabs não está configurada.");
    let response: Response;
    try {
      response = await fetcher(`${base}${path}`, {
        ...options, headers: { "xi-api-key": key, ...options.headers },
        redirect: "error", signal: AbortSignal.timeout(options.method === "POST" ? 45000 : 12000),
      });
    } catch {
      throw new AudioError(503, options.method === "POST" ? "audio_submission_uncertain" : "audio_unavailable",
        options.method === "POST" ? "O envio não foi confirmado. Não repetimos a síntese automaticamente." : "ElevenLabs indisponível agora.");
    }
    if (!response.ok) {
      const status = response.status;
      await response.body?.cancel();
      throw new AudioError(status === 401 || status === 403 ? 503 : status === 429 ? 429 : 502,
        status === 401 || status === 403 ? "audio_credentials_rejected" : status === 429 ? "audio_rate_limit" : "audio_provider_rejected",
        status === 401 || status === 403 ? "A chave não tem acesso ao recurso ElevenLabs solicitado."
          : status === 429 ? "ElevenLabs atingiu um limite temporário. Aguarde antes de tentar." : "ElevenLabs recusou a síntese. Confira saldo e permissões da conta.");
    }
    return response;
  }
  async function json(path: string): Promise<Record<string, unknown>> {
    const response = await call(path);
    try { return JSON.parse(new TextDecoder().decode(await limited(response, 1024 * 1024))); }
    catch (error) { if (error instanceof AudioError) throw error; throw new AudioError(502, "audio_response_invalid", "Resposta inválida do serviço de áudio."); }
  }
  return {
    async account() {
      const value = await json("/v1/user/subscription");
      const limit = Number(value.character_limit), used = Number(value.character_count);
      const tier = typeof value.tier === "string" ? value.tier : "unknown";
      return { tier, remaining: Number.isFinite(limit) && Number.isFinite(used) ? Math.max(0, limit - used) : null,
        commercial: ["starter", "creator", "pro", "scale", "business", "enterprise"].includes(tier.toLowerCase()) };
    },
    async voices(): Promise<SpeechVoice[]> {
      const value = await json("/v2/voices?page_size=100");
      if (!Array.isArray(value.voices)) throw new AudioError(502, "audio_response_invalid", "Não foi possível consultar as vozes.");
      return value.voices.filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
        .filter((v) => typeof v.voice_id === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(v.voice_id) && typeof v.name === "string")
        .map((v) => {
          const labels = v.labels && typeof v.labels === "object" ? v.labels as Record<string, unknown> : {};
          return { id: v.voice_id as string, name: (v.name as string).slice(0, 100),
            gender: typeof labels.gender === "string" ? labels.gender.slice(0, 30) : "",
            language: typeof labels.language === "string" ? labels.language.slice(0, 50) : "",
            category: typeof v.category === "string" ? v.category : "unknown" };
        });
    },
    async synthesize(text: string, voiceId: string): Promise<Uint8Array> {
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(voiceId) || text.trim().length < 2 || text.length > 1500) {
        throw new AudioError(400, "invalid_audio_request", "Escolha uma voz e informe um texto de 2 a 1.500 caracteres.");
      }
      const response = await call(`/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({ text: text.trim(), model_id: speechModel,
          voice_settings: { stability: 0.5, similarity_boost: 0.75, use_speaker_boost: true } }),
      });
      if (!response.headers.get("content-type")?.startsWith("audio/")) {
        await response.body?.cancel(); throw new AudioError(502, "audio_response_invalid", "O serviço não retornou áudio.");
      }
      const bytes = await limited(response, 8 * 1024 * 1024);
      if (bytes.length < 128 || !(new TextDecoder().decode(bytes.slice(0, 3)) === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0))) {
        throw new AudioError(502, "audio_response_invalid", "O arquivo MP3 retornado não é válido.");
      }
      return bytes;
    },
  };
}
