import { authorizationUrl, decryptGoogleValue, encryptGoogleValue, randomToken, sha256, YouTubeError } from "./google.ts";
import type { GoogleTokens, YouTubeChannel } from "./google.ts";

export interface YouTubeUser { id: string; email: string; confirmed: boolean }
export interface OAuthState { state_hash: string; user_id: string; expected_email: string; encrypted_verifier: string }
export interface Connection { user_id: string; google_subject: string; google_email: string; channel_id: string; channel_title: string; encrypted_tokens: string; scopes: string[]; status: string; verified_at: string }
export interface YouTubeDependencies {
  clientId: string;
  callback: string;
  ready(): boolean;
  key(): Promise<CryptoKey>;
  authenticate(token: string): Promise<YouTubeUser | null>;
  user(id: string): Promise<YouTubeUser | null>;
  begin(row: OAuthState): Promise<void>;
  open(hash: string): Promise<OAuthState | null>;
  consume(hash: string): Promise<OAuthState | null>;
  finish(hash: string, row: Omit<Connection, "status" | "verified_at">): Promise<void>;
  get(user: string): Promise<Connection | null>;
  update(user: string, previous: string, tokens: string, channel: YouTubeChannel): Promise<boolean>;
  expire(user: string, previous: string): Promise<void>;
  disconnect(user: string): Promise<void>;
  exchange(code: string, verifier: string): Promise<GoogleTokens>;
  refresh(tokens: GoogleTokens): Promise<GoogleTokens>;
  identity(tokens: GoogleTokens): Promise<{ subject: string; email: string }>;
  channels(tokens: GoogleTokens): Promise<YouTubeChannel[]>;
}
const appOrigin = "https://meu-vendedor.httpsgithubcomwarllemedicaosunshine-budget-guidegit.workers.dev";
const cookieName = "__Secure-mv-youtube-state";
const cookiePath = "/functions/v1/youtube-connection";
const cookie = (value: string, age: number) => `${cookieName}=${value}; Path=${cookiePath}; Secure; HttpOnly; SameSite=Lax; Max-Age=${age}`;
const safe = (row: Connection | null) => row ? { connected: row.status === "connected", status: row.status, email: row.google_email,
  channel: { id: row.channel_id, title: row.channel_title }, checkedAt: row.verified_at, uploadAuthorized: row.scopes.includes("https://www.googleapis.com/auth/youtube.upload") } : { connected: false, status: "disconnected" };

async function body(req: Request): Promise<Record<string, unknown>> {
  const reader = req.body?.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  if (!reader) throw new YouTubeError("invalid_request", "Solicitação inválida.", 400);
  try { while (true) { const { done, value } = await reader.read(); if (done) break; total += value.length;
    if (total > 4096) throw new YouTubeError("invalid_request", "Solicitação acima do limite.", 413); chunks.push(value); }
  } finally { await reader.cancel(); }
  const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { const value = JSON.parse(new TextDecoder().decode(bytes)); if (value && typeof value === "object" && !Array.isArray(value)) return value; } catch { /* Invalid request below. */ }
  throw new YouTubeError("invalid_request", "Solicitação inválida.", 400);
}

export function createYouTubeHandler(deps: YouTubeDependencies) {
  return async (req: Request) => {
    const url = new URL(req.url);
    const origin = req.headers.get("origin");
    if (origin && ![appOrigin, "http://localhost:3000"].includes(origin)) return new Response(null, { status: 403 });
    const headers = { "Content-Type": "application/json", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
      "Access-Control-Allow-Origin": origin ?? appOrigin, "Access-Control-Allow-Headers": "authorization,content-type,apikey,x-client-info",
      "Access-Control-Allow-Methods": "POST,OPTIONS,GET", Vary: "Origin" };
    const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers });
    const redirect = (state: string) => new Response(null, { status: 303, headers: { ...headers, "Set-Cookie": cookie("", 0), Location: `${appOrigin}/entrar?youtube=${encodeURIComponent(state)}#google` } });
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
    const isCallback = req.method === "GET" && url.searchParams.has("state");
    try {
      if (req.method === "GET") {
        if (!deps.ready()) throw new YouTubeError("youtube_not_configured", "A conexão YouTube ainda precisa de configuração.");
        const state = url.searchParams.get(isCallback ? "state" : "begin") ?? "";
        if (!/^[a-f0-9]{64}$/.test(state)) throw new YouTubeError("youtube_authorization_expired", "A solicitação expirou. Abra a conexão novamente.", 400);
        const hash = await sha256(state);
        if (!isCallback) {
          const row = await deps.open(hash);
          if (!row) throw new YouTubeError("youtube_authorization_expired", "A solicitação expirou. Abra a conexão novamente.", 409);
          const verifier = await decryptGoogleValue(row.encrypted_verifier, await deps.key(), row.user_id);
          if (typeof verifier !== "string") throw new Error("invalid_verifier");
          return new Response(null, { status: 302, headers: { ...headers, "Set-Cookie": cookie(state, 600),
            Location: await authorizationUrl(deps.clientId, deps.callback, state, verifier, row.expected_email) } });
        }
        const savedCookie = (req.headers.get("cookie") ?? "").split(";").map(s => s.trim()).find(s => s.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
        if (!savedCookie || !/^[a-f0-9]{64}$/.test(savedCookie) || await sha256(savedCookie) !== hash) throw new YouTubeError("youtube_browser_mismatch", "Conclua a autorização no mesmo navegador em que abriu a conexão.", 403);
        const row = await deps.consume(hash);
        if (!row) throw new YouTubeError("youtube_authorization_expired", "A autorização expirou ou já foi utilizada.", 409);
        if (url.searchParams.has("error")) return redirect("cancelled");
        const code = url.searchParams.get("code");
        if (!code || code.length > 4096) throw new YouTubeError("invalid_request", "Código de autorização inválido.", 400);
        const user = await deps.user(row.user_id);
        if (!user?.confirmed || user.email.toLowerCase() !== row.expected_email.toLowerCase()) throw new YouTubeError("youtube_account_changed", "A conta do aplicativo foi alterada. Conecte novamente.", 403);
        const key = await deps.key();
        const verifier = await decryptGoogleValue(row.encrypted_verifier, key, row.user_id);
        if (typeof verifier !== "string") throw new Error("invalid_verifier");
        const tokens = await deps.exchange(code, verifier);
        const identity = await deps.identity(tokens);
        if (identity.email.toLowerCase() !== user.email.toLowerCase()) throw new YouTubeError("youtube_account_mismatch", "Use a mesma conta Google do seu acesso ao Meu Vendedor.", 403);
        const channels = await deps.channels(tokens);
        if (!channels.length) throw new YouTubeError("youtube_channel_missing", "Esta conta Google não retornou um canal YouTube.", 409);
        await deps.finish(hash, { user_id: user.id, google_subject: identity.subject, google_email: identity.email,
          channel_id: channels[0].id, channel_title: channels[0].title, encrypted_tokens: await encryptGoogleValue(tokens, key, user.id), scopes: tokens.scope.split(" ") });
        return redirect("connected");
      }
      if (req.method !== "POST") return reply({ error: { code: "method_not_allowed", message: "Método não permitido." } }, 405);
      const token = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
      const user = token ? await deps.authenticate(token) : null;
      if (!user) throw new YouTubeError("unauthorized", "Entre na sua conta para conectar o YouTube.", 401);
      const input = await body(req);
      if (input.action === "disconnect") { await deps.disconnect(user.id); return reply({ configured: deps.ready(), ...safe(null) }); }
      if (input.action === "status") return reply({ configured: deps.ready(), callback: deps.callback, ...safe(await deps.get(user.id)) });
      if (!deps.ready()) throw new YouTubeError("youtube_not_configured", "Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e a chave de cifragem no backend.");
      if (!user.confirmed) throw new YouTubeError("confirmed_account_required", "Confirme o e-mail antes de conectar o YouTube.", 403);
      if (input.action === "start") {
        const state = await sha256(randomToken());
        await deps.begin({ state_hash: await sha256(state), user_id: user.id, expected_email: user.email,
          encrypted_verifier: await encryptGoogleValue(randomToken(), await deps.key(), user.id) });
        return reply({ url: `${deps.callback}?begin=${state}` });
      }
      if (input.action === "verify" || input.action === "select-channel") {
        const row = await deps.get(user.id);
        if (!row) throw new YouTubeError("youtube_disconnected", "Conecte o YouTube primeiro.", 409);
        let tokens = await decryptGoogleValue(row.encrypted_tokens, await deps.key(), user.id) as GoogleTokens;
        if (tokens.expires_at <= Date.now() + 60000) {
          try { tokens = await deps.refresh(tokens); }
          catch (error) { if (error instanceof YouTubeError && error.code === "youtube_reauthorization_required") await deps.expire(user.id, row.encrypted_tokens); throw error; }
        }
        const channels = await deps.channels(tokens);
        const requestedId = input.action === "select-channel" ? input.channelId : row.channel_id;
        const selected = channels.find(c => c.id === requestedId);
        if (!selected) throw new YouTubeError("youtube_channel_unavailable", "O canal selecionado não está disponível nesta autorização. Conecte novamente.", 409);
        const updated = await deps.update(user.id, row.encrypted_tokens, await encryptGoogleValue(tokens, await deps.key(), user.id), selected);
        if (!updated) throw new YouTubeError("youtube_connection_changed", "A conexão foi alterada durante a consulta. Atualize o estado antes de continuar.", 409);
        return reply({ configured: true, ...safe({ ...row, status: "connected", channel_id: selected.id, channel_title: selected.title, verified_at: new Date().toISOString() }), channels });
      }
      throw new YouTubeError("invalid_request", "Ação não reconhecida.", 400);
    } catch (error) {
      const failure = error instanceof YouTubeError ? error : new YouTubeError("youtube_unavailable", "Não foi possível concluir a conexão YouTube agora.");
      if (isCallback) return redirect(failure.code);
      return reply({ error: { code: failure.code, message: failure.message } }, failure.status);
    }
  };
}
