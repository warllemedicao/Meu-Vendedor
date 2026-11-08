import { AudioError, type SpeechVoice } from "./elevenlabs.ts";

export const googleSpeechModel = "google-chirp3-hd";
export const presenterVoices = {
  ana: "pt-BR-Chirp3-HD-Aoede", carla: "pt-BR-Chirp3-HD-Kore",
  rafael: "pt-BR-Chirp3-HD-Charon", lucas: "pt-BR-Chirp3-HD-Puck",
} as const;
const voicePattern = /^pt-BR-Chirp3-HD-[A-Za-z]+$/;
const invalid = () => new AudioError(503, "google_tts_credentials_invalid", "Confira o JSON da conta de serviço e o projeto nos Secrets Google TTS.");
const encode = (value: Uint8Array) => btoa(String.fromCharCode(...value)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

async function readJson(response: Response, max: number): Promise<Record<string, unknown>> {
  const reader = response.body?.getReader();
  if (!reader) throw new AudioError(502, "audio_response_invalid", "Resposta de áudio vazia.");
  const parts: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > max) { await reader.cancel(); throw new Error(); }
      parts.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.length; }
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch { throw new AudioError(502, "audio_response_invalid", "Resposta inválida do Google TTS."); }
}

// Credentials and OAuth tokens never leave the backend. Fixed hosts prevent redirects/SSRF.
export function createGoogleTts(rawCredentials: string, projectId: string, fetcher: typeof fetch = fetch) {
  let cached: { token: string; until: number } | null = null;
  let pending: Promise<string> | null = null;
  let cachedVoices: { voices: SpeechVoice[]; until: number } | null = null;
  async function token(): Promise<string> {
    if (cached && cached.until > Date.now()) return cached.token;
    if (pending) return pending;
    pending = (async () => {
      let credentials;
      try { credentials = JSON.parse(rawCredentials); } catch { throw invalid(); }
      if (!credentials || typeof credentials !== "object" || Array.isArray(credentials) || credentials.type !== "service_account" || credentials.project_id !== projectId ||
        !/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(projectId) ||
        typeof credentials.client_email !== "string" || !credentials.client_email.endsWith(".iam.gserviceaccount.com") ||
        typeof credentials.private_key !== "string") throw invalid();
      const now = Math.floor(Date.now() / 1000);
      const header = encode(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
      const claims = encode(new TextEncoder().encode(JSON.stringify({ iss: credentials.client_email,
        scope: "https://www.googleapis.com/auth/cloud-platform", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })));
      let signed: string;
      try {
        const pem = credentials.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
        const key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), c => c.charCodeAt(0)),
          { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
        signed = encode(new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claims}`))));
      } catch { throw invalid(); }
      let response;
      try { response = await fetcher("https://oauth2.googleapis.com/token", { method: "POST", redirect: "error", signal: AbortSignal.timeout(12000),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${header}.${claims}.${signed}` }).toString() }); }
      catch { throw new AudioError(503, "google_tts_auth_unavailable", "Não foi possível autenticar no Google TTS agora."); }
      if (!response.ok) { await response.body?.cancel(); throw invalid(); }
      const payload = await readJson(response, 16384);
      if (typeof payload.access_token !== "string" || !payload.access_token || typeof payload.expires_in !== "number") throw invalid();
      cached = { token: payload.access_token, until: Date.now() + Math.max(0, Math.min(payload.expires_in, 3600) - 60) * 1000 };
      return cached.token;
    })().finally(() => { pending = null; });
    return pending;
  }
  async function call(path: string, body?: unknown) {
    const accessToken = await token();
    let response;
    try { response = await fetcher(`https://texttospeech.googleapis.com/v1/${path}`, {
      method: body ? "POST" : "GET", redirect: "error", signal: AbortSignal.timeout(body ? 45000 : 12000),
      headers: { Authorization: `Bearer ${accessToken}`, "x-goog-user-project": projectId, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }); } catch { throw new AudioError(503, body ? "audio_submission_uncertain" : "audio_unavailable",
      body ? "A síntese Google não foi confirmada. Não repetimos o envio automaticamente." : "Google TTS indisponível agora."); }
    if (!response.ok) {
      const status = response.status;
      // Only an allowlisted reason is interpreted; never return raw provider responses.
      let reason = "";
      try {
        const failure = await readJson(response, 32768);
        const error = failure.error as { details?: { reason?: string }[] } | undefined;
        reason = error?.details?.find(d => ["SERVICE_DISABLED", "BILLING_DISABLED"].includes(d.reason ?? ""))?.reason ?? "";
      } catch { /* sanitized fallback */ }
      if (status === 401) cached = null;
      throw new AudioError(status === 429 ? 429 : status === 400 ? 400 : 503,
        reason === "SERVICE_DISABLED" ? "google_tts_api_disabled" : reason === "BILLING_DISABLED" ? "google_tts_billing_disabled" :
          status === 429 ? "audio_rate_limit" : status === 401 || status === 403 ? "audio_credentials_rejected" : "audio_provider_rejected",
        reason === "SERVICE_DISABLED" ? "Ative a Cloud Text-to-Speech API no projeto das credenciais." :
          reason === "BILLING_DISABLED" ? "Vincule o faturamento ao projeto Google TTS." :
          status === 429 ? "Google TTS atingiu um limite temporário. Aguarde antes de tentar." :
          status === 401 || status === 403 ? "Confira as permissões da conta de serviço, a API e o faturamento Google TTS." : "Google TTS recusou a solicitação de áudio.");
    }
    return readJson(response, body ? 12 * 1024 * 1024 : 1024 * 1024);
  }
  return {
    async voices(): Promise<SpeechVoice[]> {
      if (cachedVoices && cachedVoices.until > Date.now()) return cachedVoices.voices;
      const payload = await call("voices?languageCode=pt-BR");
      if (!Array.isArray(payload.voices)) throw new AudioError(502, "audio_response_invalid", "Lista de vozes Google inválida.");
      const voices = payload.voices.filter(v => v && typeof v.name === "string" && voicePattern.test(v.name) && v.languageCodes?.includes("pt-BR"))
        .map(v => ({ id: v.name as string, name: (v.name as string).replace("pt-BR-Chirp3-HD-", ""),
          gender: v.ssmlGender === "FEMALE" ? "female" : v.ssmlGender === "MALE" ? "male" : "neutral", language: "pt-BR", category: "google" }));
      cachedVoices = { voices, until: Date.now() + 300000 }; return voices;
    },
    async synthesize(text: string, voice: string): Promise<Uint8Array> {
      if (!voicePattern.test(voice) || text.trim().length < 2 || text.length > 1500) throw new AudioError(400, "invalid_audio_request", "Escolha uma voz brasileira e um roteiro de 2 a 1.500 caracteres.");
      const payload = await call("text:synthesize", { input: { text: text.trim() }, voice: { languageCode: "pt-BR", name: voice }, audioConfig: { audioEncoding: "MP3", sampleRateHertz: 24000 } });
      try {
        if (typeof payload.audioContent !== "string") throw new Error();
        const bytes = Uint8Array.from(atob(payload.audioContent), c => c.charCodeAt(0));
        if (bytes.length < 128 || bytes.length > 8 * 1024 * 1024 || !(new TextDecoder().decode(bytes.slice(0, 3)) === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0))) throw new Error();
        return bytes;
      } catch { throw new AudioError(502, "audio_response_invalid", "O Google não retornou um MP3 válido."); }
    },
  };
}
