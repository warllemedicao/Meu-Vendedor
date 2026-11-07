import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { audioKeyNames, AudioError, createElevenLabs } from "./_shared/elevenlabs.ts";
import { createAudioHandler, type AudioGenerationRow } from "./_shared/handler.ts";

const env = (name: string) => Deno.env.get(name) ?? "";
const url = env("SUPABASE_URL");
const admin = createClient(url, env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
const auth = createClient(url, env("SUPABASE_ANON_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
const key = audioKeyNames.map(env).find(Boolean) ?? "";
const provider = createElevenLabs(key);
const storage = admin.storage.from("mv-video-assets");

Deno.serve(createAudioHandler({
  configured: () => Boolean(key),
  authenticate: async (token) => {
    const { data, error } = await auth.auth.getUser(token);
    return error ? null : data.user?.id ?? null;
  },
  account: provider.account,
  voices: provider.voices,
  synthesize: provider.synthesize,
  claim: async (user, requestKey, tier, commercial) => {
    const { data, error } = await admin.rpc("mv_claim_audio_generation", {
      p_user_id: user, p_request_key: requestKey, p_tier: tier, p_commercial: commercial,
    });
    if (error) throw new AudioError(error.message.includes("audio_rate_limit") ? 429 : 503,
      error.message.includes("audio_rate_limit") ? "audio_rate_limit" : "audio_storage_unavailable",
      error.message.includes("audio_rate_limit") ? "Aguarde um minuto antes de criar outra narração." : "Não foi possível registrar a narração.");
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
