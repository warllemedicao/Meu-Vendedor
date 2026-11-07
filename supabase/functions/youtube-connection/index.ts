import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { encryptionKey } from "../marketplace/_shared/credentials.ts";
import { createGoogleYouTube, YouTubeError } from "./_shared/google.ts";
import { createYouTubeHandler } from "./_shared/handler.ts";
import type { Connection, OAuthState, YouTubeUser } from "./_shared/handler.ts";

const env = (name: string) => Deno.env.get(name) ?? "";
const url = env("SUPABASE_URL");
const admin = createClient(url, env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
const auth = createClient(url, env("SUPABASE_ANON_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
const clientId = env("GOOGLE_CLIENT_ID");
const clientSecret = env("GOOGLE_CLIENT_SECRET");
const callback = `${url}/functions/v1/youtube-connection`;
const provider = createGoogleYouTube(clientId, clientSecret, callback);
const ready = () => {
  try { return clientId.endsWith(".apps.googleusercontent.com") && Boolean(clientSecret) && atob(env("MV_CREDENTIAL_ENCRYPTION_KEY")).length === 32; }
  catch { return false; }
};
const key = () => encryptionKey(env("MV_CREDENTIAL_ENCRYPTION_KEY"));
const userView = (user: { id: string; email?: string; email_confirmed_at?: string } | null): YouTubeUser | null =>
  user?.email ? { id: user.id, email: user.email, confirmed: Boolean(user.email_confirmed_at) } : null;
function check(error: { message: string } | null) {
  if (!error) return;
  if (error.message.includes("youtube_connection_rate_limit")) throw new YouTubeError("youtube_connection_rate_limit", "Aguarde dez minutos antes de iniciar outra conexão.", 429);
  throw new YouTubeError("youtube_storage_unavailable", "Não foi possível acessar a conexão privada agora.");
}
const fields = "user_id,google_subject,google_email,channel_id,channel_title,encrypted_tokens,scopes,status,verified_at";

Deno.serve(createYouTubeHandler({
  clientId, callback, ready, key,
  authenticate: async token => {
    const { data, error } = await auth.auth.getUser(token);
    return error ? null : userView(data.user);
  },
  user: async id => {
    const { data, error } = await admin.auth.admin.getUserById(id);
    return error ? null : userView(data.user);
  },
  begin: async row => {
    const { error } = await admin.rpc("mv_begin_youtube_oauth", { p_user_id: row.user_id, p_state_hash: row.state_hash,
      p_expected_email: row.expected_email, p_encrypted_verifier: row.encrypted_verifier });
    check(error);
  },
  open: async hash => {
    const { data, error } = await admin.from("mv_youtube_oauth_states").update({ opened_at: new Date().toISOString() })
      .eq("state_hash", hash).is("opened_at", null).is("consumed_at", null).gt("expires_at", new Date().toISOString())
      .select("state_hash,user_id,expected_email,encrypted_verifier").maybeSingle();
    check(error); return data as OAuthState | null;
  },
  consume: async hash => {
    const { data, error } = await admin.from("mv_youtube_oauth_states").update({ consumed_at: new Date().toISOString() })
      .eq("state_hash", hash).not("opened_at", "is", null).is("consumed_at", null).gt("expires_at", new Date().toISOString())
      .select("state_hash,user_id,expected_email,encrypted_verifier").maybeSingle();
    check(error); return data as OAuthState | null;
  },
  finish: async (hash, row) => {
    const { error } = await admin.rpc("mv_finish_youtube_connection", { p_user_id: row.user_id, p_state_hash: hash,
      p_subject: row.google_subject, p_email: row.google_email, p_channel_id: row.channel_id,
      p_channel_title: row.channel_title, p_encrypted_tokens: row.encrypted_tokens, p_scopes: row.scopes });
    check(error);
  },
  get: async user => {
    const { data, error } = await admin.from("mv_youtube_connections").select(fields).eq("user_id", user).maybeSingle();
    check(error); return data as Connection | null;
  },
  update: async (user, previous, tokens, channel) => {
    const { data, error } = await admin.from("mv_youtube_connections").update({ encrypted_tokens: tokens, channel_id: channel.id,
      channel_title: channel.title, verified_at: new Date().toISOString(), status: "connected" }).eq("user_id", user).eq("encrypted_tokens", previous).select("user_id").maybeSingle();
    check(error); return Boolean(data);
  },
  expire: async (user, previous) => {
    const { error } = await admin.from("mv_youtube_connections").update({ status: "reauthorization_required" }).eq("user_id", user).eq("encrypted_tokens", previous);
    check(error);
  },
  disconnect: async user => { const { error } = await admin.rpc("mv_disconnect_youtube", { p_user_id: user }); check(error); },
  exchange: provider.exchange, refresh: provider.refresh, identity: provider.identity, channels: provider.channels,
}));
