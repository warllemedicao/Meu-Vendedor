export const youtubeScopes = ["openid", "email", "https://www.googleapis.com/auth/youtube.readonly", "https://www.googleapis.com/auth/youtube.upload"];
export class YouTubeError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status = 503) { super(message); this.code = code; this.status = status; }
}
export interface GoogleTokens { access_token: string; refresh_token: string; expires_at: number; scope: string }
export interface YouTubeChannel { id: string; title: string }
export async function sha256(value: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}
function base64url(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, ""); }
export function randomToken() { return base64url(crypto.getRandomValues(new Uint8Array(48))); }
export async function authorizationUrl(clientId: string, callback: string, state: string, verifier: string, email: string) {
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: callback, response_type: "code", scope: youtubeScopes.join(" "),
    state, access_type: "offline", prompt: "consent select_account", code_challenge: challenge, code_challenge_method: "S256", login_hint: email });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}
export async function encryptGoogleValue(value: unknown, key: CryptoKey, user: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(`mv:youtube:${user}:v1`) }, key, new TextEncoder().encode(JSON.stringify(value)));
  return `v1.${base64url(iv)}.${base64url(new Uint8Array(cipher))}`;
}
export async function decryptGoogleValue(value: string, key: CryptoKey, user: string): Promise<unknown> {
  const [version, iv, cipher] = value.split(".");
  if (version !== "v1" || !iv || !cipher) throw new YouTubeError("youtube_storage_unavailable", "Não foi possível abrir a conexão salva.");
  const decode = (text: string) => Uint8Array.from(atob(text.replaceAll("-", "+").replaceAll("_", "/")), c => c.charCodeAt(0));
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(iv), additionalData: new TextEncoder().encode(`mv:youtube:${user}:v1`) }, key, decode(cipher));
  return JSON.parse(new TextDecoder().decode(plain));
}
export function createGoogleYouTube(clientId: string, clientSecret: string, callback: string, fetcher: typeof fetch = fetch) {
  async function json(url: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
    let response: Response;
    try { response = await fetcher(url, { ...init, redirect: "error", signal: AbortSignal.timeout(15000) }); }
    catch { throw new YouTubeError("youtube_unavailable", "O Google não respondeu agora. Tente novamente mais tarde."); }
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = []; let total = 0;
    if (reader) {
      try { while (true) { const { done, value } = await reader.read(); if (done) break;
        total += value.length; if (total > 1024 * 1024) throw new YouTubeError("youtube_response_invalid", "Resposta do Google acima do limite."); chunks.push(value); }
      } finally { await reader.cancel(); }
    }
    const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    let body: Record<string, unknown> = {};
    try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { /* Sanitized below. */ }
    if (!response.ok) {
      if (body.error === "invalid_client") throw new YouTubeError("youtube_client_rejected", "O Google recusou o Client ID ou Client Secret configurado.");
      if (body.error === "invalid_grant" || response.status === 401) throw new YouTubeError("youtube_reauthorization_required", "A autorização expirou ou foi revogada. Conecte o YouTube novamente.", 409);
      if (response.status === 403) throw new YouTubeError("youtube_access_denied", "O Google recusou a consulta. Confira a API ativada e as permissões concedidas.", 403);
      throw new YouTubeError("youtube_unavailable", "Não foi possível consultar o YouTube agora.");
    }
    return body;
  }
  async function token(params: Record<string, string>, previous?: GoogleTokens): Promise<GoogleTokens> {
    const body = await json("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params }) });
    const refresh = typeof body.refresh_token === "string" ? body.refresh_token : previous?.refresh_token;
    const scope = typeof body.scope === "string" ? body.scope : previous?.scope;
    if (typeof body.access_token !== "string" || !refresh || !scope || !Number.isFinite(body.expires_in) || (body.expires_in as number) <= 0) {
      throw new YouTubeError("youtube_offline_access_missing", "O Google não concedeu acesso renovável. Conecte novamente e aceite as permissões solicitadas.", 409);
    }
    if (!youtubeScopes.filter(s => s.startsWith("https://")).every(s => scope.split(" ").includes(s))) {
      throw new YouTubeError("youtube_permissions_missing", "Autorize a consulta da conta e o envio de vídeos para conectar o YouTube.", 409);
    }
    return { access_token: body.access_token, refresh_token: refresh, scope, expires_at: Date.now() + (body.expires_in as number) * 1000 };
  }
  return {
    exchange: (code: string, verifier: string) => token({ grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: callback }),
    refresh: (previous: GoogleTokens) => token({ grant_type: "refresh_token", refresh_token: previous.refresh_token }, previous),
    async identity(tokens: GoogleTokens): Promise<{ subject: string; email: string }> {
      const body = await json("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` } });
      if (typeof body.sub !== "string" || !body.sub || typeof body.email !== "string" || body.email_verified !== true) throw new YouTubeError("youtube_identity_unverified", "O Google não confirmou a identidade desta conta.", 403);
      return { subject: body.sub, email: body.email };
    },
    async channels(tokens: GoogleTokens): Promise<YouTubeChannel[]> {
      const body = await json("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true&maxResults=50", { headers: { Authorization: `Bearer ${tokens.access_token}` } });
      if (!Array.isArray(body.items)) throw new YouTubeError("youtube_response_invalid", "O YouTube não retornou os canais esperados.");
      return body.items.flatMap((value: unknown) => {
        if (!value || typeof value !== "object") return [];
        const row = value as Record<string, unknown>; const snippet = row.snippet as Record<string, unknown> | undefined;
        return typeof row.id === "string" && /^UC[A-Za-z0-9_-]{22}$/.test(row.id) && typeof snippet?.title === "string" ? [{ id: row.id, title: snippet.title.slice(0, 200) }] : [];
      });
    },
  };
}
