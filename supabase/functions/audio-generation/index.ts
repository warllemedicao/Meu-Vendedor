import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { AudioError } from "./_shared/elevenlabs.ts";
import { createGoogleTts, googleSpeechModel, presenterVoices } from "./_shared/google-tts.ts";
import { createAudioHandler, type AudioGenerationRow } from "./_shared/handler.ts";

const env = (name: string) => Deno.env.get(name) ?? "";
const url = env("SUPABASE_URL");
const admin = createClient(url, env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
const auth = createClient(url, env("SUPABASE_ANON_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
const credentials = env("GOOGLE_TTS_SERVICE_ACCOUNT_JSON");
const project = env("GOOGLE_TTS_PROJECT_ID");
const provider = createGoogleTts(credentials, project);
const requestedLimit = Number(env("GOOGLE_TTS_MONTHLY_CHARACTER_LIMIT") || 900000);
const monthlyLimit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(900000, requestedLimit) : 900000;
const storage = admin.storage.from("mv-video-assets");

Deno.serve(createAudioHandler({
  providerId: "google-tts", model: googleSpeechModel, presenterVoices,
  configured: () => Boolean(credentials && project),
  authenticate: async (token) => {
    const { data, error } = await auth.auth.getUser(token);
    return error ? null : data.user?.id ?? null;
  },
  account: async () => {
    // Exact aggregate without returning ledger rows to the client.
    const { data, error } = await admin.rpc("mv_google_audio_reserved_characters");
    if (error) throw new AudioError(503, "audio_storage_unavailable", "Não foi possível verificar o limite mensal de narração.");
    const used = Number(data);
    if (!Number.isFinite(used)) throw new AudioError(503, "audio_storage_unavailable", "Não foi possível verificar o limite mensal de narração.");
    return { tier: googleSpeechModel, remaining: Math.max(0, monthlyLimit - used), commercial: true };
  },
  voices: provider.voices,
  synthesize: provider.synthesize,
  claim: async (user, requestKey, _tier, _commercial, characters) => {
    const { data, error } = await admin.rpc("mv_claim_google_audio", {
      p_user_id: user, p_request_key: requestKey, p_characters: characters, p_limit: monthlyLimit,
    });
    if (error) throw new AudioError(error.message.includes("audio_rate_limit") ? 429 : error.message.includes("audio_monthly_limit") ? 409 : 503,
      error.message.includes("audio_rate_limit") ? "audio_rate_limit" : error.message.includes("audio_monthly_limit") ? "audio_monthly_limit" : "audio_storage_unavailable",
      error.message.includes("audio_rate_limit") ? "Aguarde um minuto antes de criar outra narração." : error.message.includes("audio_monthly_limit") ? "O limite mensal de narração deste aplicativo foi atingido." : "Não foi possível registrar a narração.");
    return data as { claimed: boolean; generation: AudioGenerationRow };
  },
  upload: async (path, bytes) => {
    const { error } = await storage.upload(path, bytes, { contentType: "audio/mpeg", upsert: false });
    if (error) throw new Error("audio_storage_unavailable");
  },
  complete: async (id, path) => {
    const { error } = await admin.from("mv_audio_generations").update({ status: "completed", result_path: path }).eq("id", id);
    if (error) throw new Error("audio_storage_unavailable");
  },
  fail: async (id, uncertain, code) => {
    const { error } = await admin.from("mv_audio_generations").update({ status: uncertain ? "uncertain" : "failed", error_code: code }).eq("id", id);
    if (error) throw new Error("audio_storage_unavailable");
  },
  read: async (user, id) => {
    const { data, error } = await admin.from("mv_audio_generations").select("id,status,result_path,commercial,tier").eq("user_id", user).eq("id", id).maybeSingle();
    if (error) throw new Error("audio_storage_unavailable");
    return data;
  },
  sign: async (path) => {
    const { data, error } = await storage.createSignedUrl(path, 300);
    if (error || !data?.signedUrl) throw new Error("audio_storage_unavailable");
    return data.signedUrl;
  },
}));
