import { AudioError, speechModel, voicesForAccount } from "./elevenlabs.ts";
import type { SpeechVoice } from "./elevenlabs.ts";

export interface AudioGenerationRow { id: string; status: string; result_path: string | null; commercial: boolean; tier: string }
export interface AudioDependencies {
  providerId?: string;
  model?: string;
  presenterVoices?: Record<string, string>;
  authenticate(token: string): Promise<string | null>;
  configured(): boolean;
  account(): Promise<{ tier: string; remaining: number | null; commercial: boolean }>;
  voices(): Promise<SpeechVoice[]>;
  synthesize(text: string, voice: string): Promise<Uint8Array>;
  claim(user: string, key: string, tier: string, commercial: boolean, characters: number): Promise<{ claimed: boolean; generation: AudioGenerationRow }>;
  complete(id: string, path: string): Promise<void>;
  fail(id: string, uncertain: boolean, code: string): Promise<void>;
  upload(path: string, bytes: Uint8Array): Promise<void>;
  sign(path: string): Promise<string>;
  read(user: string, id: string): Promise<AudioGenerationRow | null>;
}
const origin = "https://meu-vendedor.httpsgithubcomwarllemedicaosunshine-budget-guidegit.workers.dev";
export function createAudioHandler(deps: AudioDependencies) {
  const activeModel = deps.model ?? speechModel;
  return async (req: Request) => {
    const requestOrigin = req.headers.get("origin");
    if (requestOrigin && ![origin, "http://localhost:3000"].includes(requestOrigin)) return new Response(null, { status: 403 });
    const headers = { "Content-Type": "application/json", "Cache-Control": "no-store", Vary: "Origin",
      "Access-Control-Allow-Origin": requestOrigin ?? origin, "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info",
      "Access-Control-Allow-Methods": "POST,OPTIONS" };
    const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (req.method !== "POST") return reply({ error: { code: "method_not_allowed", message: "Método não permitido." } }, 405);
    let generationId: string | null = null;
    let submitting = false;
    try {
      const token = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
      const user = token ? await deps.authenticate(token) : null;
      if (!user) throw new AudioError(401, "unauthorized", "Entre na sua conta para gerar narração.");
      if (Number(req.headers.get("content-length")) > 10000) throw new AudioError(413, "invalid_request", "Solicitação acima do limite.");
      const raw = await req.text();
      if (new TextEncoder().encode(raw).length > 10000) throw new AudioError(413, "invalid_request", "Solicitação acima do limite.");
      let body: Record<string, unknown>;
      try { body = JSON.parse(raw); if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error(); }
      catch { throw new AudioError(400, "invalid_request", "Solicitação inválida."); }
      if (body.action === "result") {
        if (typeof body.id !== "string" || !/^[a-f0-9-]{36}$/.test(body.id)) throw new AudioError(400, "invalid_request", "Resultado inválido.");
        const row = await deps.read(user, body.id);
        if (!row?.result_path || row.status !== "completed") throw new AudioError(404, "audio_not_found", "Narração não encontrada nesta conta.");
        return reply({ id: row.id, url: await deps.sign(row.result_path), commercial: row.commercial, tier: row.tier });
      }
      if (!deps.configured()) throw new AudioError(503, "audio_not_configured", "O serviço de narração não está configurado no servidor.");
      if (body.action === "capabilities") {
        const [account, voices] = await Promise.all([deps.account(), deps.voices()]);
        const eligible = voicesForAccount(voices, account.tier);
        return reply({ available: eligible.length > 0, ...account, voices: eligible, model: activeModel,
          provider: deps.providerId ?? "elevenlabs", presenterVoices: deps.presenterVoices ?? {},
          ...(deps.providerId === "google-tts" ? { usageScope: "app-reservations", billingNotice: "Limite local de caracteres; não é saldo do Google. Outros usos do projeto e excedentes podem gerar cobrança." } : {}) });
      }
      if (body.action !== "generate" || typeof body.text !== "string" || body.text.trim().length < 2 || body.text.length > 1500 ||
        typeof body.voiceId !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(body.voiceId) || !["preview", "commercial"].includes(String(body.purpose))) {
        throw new AudioError(400, "invalid_audio_request", "Escolha uma voz e informe um texto de 2 a 1.500 caracteres.");
      }
      const text = body.text.trim();
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([user, text, body.voiceId, activeModel, body.purpose])));
      const key = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
      const [account, voices] = await Promise.all([deps.account(), deps.voices()]);
      if (!voicesForAccount(voices, account.tier).some(v => v.id === body.voiceId)) throw new AudioError(400, "invalid_audio_voice", "Escolha uma voz disponível para a API no plano desta conta.");
      if (body.purpose === "commercial" && !account.commercial) throw new AudioError(409, "audio_commercial_license_required", "O plano atual permite prévias não comerciais. Para anúncios, use um plano ElevenLabs com licença comercial.");
      const claim = await deps.claim(user, key, account.tier, account.commercial, Array.from(text).length);
      const row = claim.generation;
      if (!claim.claimed) {
        if (row.status === "completed" && row.result_path) return reply({ id: row.id, url: await deps.sign(row.result_path), cached: true, commercial: row.commercial, tier: row.tier });
        throw new AudioError(409, "audio_already_submitted", "Este texto e voz já foram enviados. Não repetimos uma síntese sem resultado confirmado. Revise o histórico ou altere o texto.");
      }
      generationId = row.id;
      if (account.remaining !== null && account.remaining < Array.from(text).length) throw new AudioError(409, "audio_insufficient_credits", "O limite disponível de narração não cobre este texto.");
      submitting = true;
      const bytes = await deps.synthesize(text, body.voiceId);
      const path = `${user}/audio/${row.id}.mp3`;
      await deps.upload(path, bytes);
      await deps.complete(row.id, path);
      generationId = null;
      return reply({ id: row.id, url: await deps.sign(path), commercial: account.commercial, tier: account.tier }, 201);
    } catch (error) {
      const known = error instanceof AudioError ? error : new AudioError(503, submitting ? "audio_submission_uncertain" : "audio_unavailable", submitting ? "O áudio pode ter sido gerado, mas a entrega não foi confirmada. Não repetimos a síntese automaticamente." : "Não foi possível consultar o serviço de áudio agora.");
      if (generationId) await deps.fail(generationId, submitting && (known.code === "audio_submission_uncertain" || known.code === "audio_response_invalid"), known.code).catch(() => {});
      return reply({ error: { code: known.code, message: known.message } }, known.status);
    }
  };
}
