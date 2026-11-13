import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const PROJECT_URL = Deno.env.get("SUPABASE_URL") ?? "";
const PUBLIC_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_ID = Deno.env.get("META_APP_ID") ?? "";
const APP_SECRET = Deno.env.get("META_APP_SECRET") ?? "";
const CONFIG_ID = Deno.env.get("META_LOGIN_CONFIG_ID") ?? "";
const RETURN_URL = Deno.env.get("META_OAUTH_RETURN_URL") ?? "";
const SITE_URL = Deno.env.get("META_OAUTH_SITE_URL") ?? "";
const KEY = Deno.env.get("META_TOKEN_ENCRYPTION_KEY") ?? "";
const PAGE_ID = Deno.env.get("META_PAGE_ID") ?? "";
const VERSION = Deno.env.get("META_GRAPH_API_VERSION") ?? "v24.0";
const redirectUri = PROJECT_URL + "/functions/v1/facebook-connect/callback";
const db = createClient(PROJECT_URL, SERVICE_KEY, { auth: { persistSession: false } });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json", "Cache-Control": "no-store" };
const json = (status: number, value: Record<string, unknown>) => new Response(JSON.stringify(value), { status, headers: cors });
const fail = (status: number, code: string) => json(status, { ok: false, code });
const bytes = (v: Uint8Array) => btoa(String.fromCharCode(...v));
const fromB64 = (v: string) => Uint8Array.from(atob(v), c => c.charCodeAt(0));
const hash = async (v: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)))).map(b => b.toString(16).padStart(2, "0")).join("");
const ready = () => Boolean(PROJECT_URL && PUBLIC_KEY && SERVICE_KEY && APP_ID && APP_SECRET && CONFIG_ID && RETURN_URL === redirectUri && SITE_URL.startsWith("https://") && KEY && PAGE_ID);
async function encrypt(value: string) {
  const raw = fromB64(KEY);
  if (raw.byteLength !== 32) throw new Error("Invalid encryption key");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cryptoKey = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt"]);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, new TextEncoder().encode(value));
  return { token_ciphertext: bytes(new Uint8Array(cipher)), token_iv: bytes(iv) };
}
async function currentUser(req: Request) {
  const bearer = req.headers.get("authorization") ?? "";
  if (!bearer.startsWith("Bearer ")) return null;
  const client = createClient(PROJECT_URL, PUBLIC_KEY, { auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(bearer.slice(7));
  return error || !data.user || data.user.is_anonymous ? null : data.user;
}
async function graph(url: string) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const body = await response.json();
  if (!response.ok || body.error) throw new Error("Meta request failed");
  return body;
}
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const url = new URL(req.url);
  if (!ready()) return fail(503, "oauth_not_configured");
  if (url.pathname.endsWith("/callback") && req.method === "GET") {
    const state = url.searchParams.get("state") ?? "";
    const code = url.searchParams.get("code") ?? "";
    const finish = (status: string) => Response.redirect(SITE_URL + "/videos?facebook=" + encodeURIComponent(status), 303);
    if (!state || !code || state.length > 200 || code.length > 3000) return finish("cancelled");
    const stateHash = await hash(state);
    const { data: consumed, error: stateError } = await db.from("facebook_oauth_states").update({ consumed_at: new Date().toISOString() }).eq("state_hash", stateHash).is("consumed_at", null).gt("expires_at", new Date().toISOString()).select("user_id").maybeSingle();
    if (stateError || !consumed) return finish("invalid_state");
    try {
      const exchange = new URL("https://graph.facebook.com/" + VERSION + "/oauth/access_token");
      exchange.search = new URLSearchParams({ client_id: APP_ID, client_secret: APP_SECRET, redirect_uri: redirectUri, code }).toString();
      const tokenData = await graph(exchange.toString());
      if (!tokenData.access_token) return finish("authorization_failed");
      const pages = await graph("https://graph.facebook.com/" + VERSION + "/me/accounts?" + new URLSearchParams({ fields: "id,name,access_token,tasks", access_token: tokenData.access_token }).toString());
      const page = (pages.data ?? []).find((p: { id: string }) => p.id === PAGE_ID);
      if (!page?.access_token) return finish("page_not_authorized");
      const encrypted = await encrypt(page.access_token);
      const { error } = await db.from("facebook_page_connections").upsert({ user_id: consumed.user_id, page_id: PAGE_ID, page_name: page.name, ...encrypted, connected_at: new Date().toISOString() });
      return finish(error ? "storage_failed" : "connected");
    } catch { return finish("authorization_failed"); }
  }
  if (req.method !== "POST") return fail(405, "method_not_allowed");
  const user = await currentUser(req);
  if (!user) return fail(401, "unauthorized");
  let payload: { action?: string };
  try { payload = await req.json(); } catch { return fail(400, "invalid_json"); }
  if (payload.action === "status") {
    const { data } = await db.from("facebook_page_connections").select("page_id,page_name,connected_at").eq("user_id", user.id).maybeSingle();
    return json(200, { ok: true, connected: Boolean(data), page: data ?? null });
  }
  if (payload.action === "disconnect") {
    const { error } = await db.from("facebook_page_connections").delete().eq("user_id", user.id);
    return error ? fail(500, "storage_failed") : json(200, { ok: true });
  }
  if (payload.action !== "start") return fail(400, "invalid_action");
  const state = bytes(crypto.getRandomValues(new Uint8Array(32))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  const { error } = await db.from("facebook_oauth_states").insert({ state_hash: await hash(state), user_id: user.id, expires_at: new Date(Date.now() + 10 * 60_000).toISOString() });
  if (error) return fail(500, "storage_failed");
  const auth = new URL("https://www.facebook.com/" + VERSION + "/dialog/oauth");
  auth.search = new URLSearchParams({ client_id: APP_ID, redirect_uri: redirectUri, state, response_type: "code", config_id: CONFIG_ID, scope: "pages_show_list,pages_read_engagement,pages_manage_posts" }).toString();
  return json(200, { ok: true, authorization_url: auth.toString() });
});
