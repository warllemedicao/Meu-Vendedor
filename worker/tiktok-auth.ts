/**
 * TikTok Login Kit web OAuth. The token exchange stays server-side.
 * Connection persistence must be implemented before this route is enabled.
 */
export interface TikTokEnv {
  TIKTOK_CLIENT_KEY?: string;
  TIKTOK_CLIENT_SECRET?: string;
}
const cookieName = "mv_tiktok_oauth_state";
const ttl = 600;
const callbackPath = "/api/auth/tiktok/callback";
const noStore = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
function redirectUri(request: Request) {
  return new URL(callbackPath, request.url).toString();
}
function cookie(value: string, maxAge: number) {
  return `${cookieName}=${value}; Path=/api/auth/tiktok; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}
export async function handleTikTok(request: Request, env: TikTokEnv): Promise<Response> {
  const url = new URL(request.url);
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405, headers: noStore });
  if (url.pathname === "/api/auth/tiktok/start") {
    if (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET) return new Response("TikTok is not configured", { status: 503, headers: noStore });
    // Prevent launching a flow until connection persistence and identity binding exist.
    return new Response("TikTok account connection is not yet enabled", { status: 503, headers: noStore });
  }
  if (url.pathname === callbackPath) {
    return new Response("TikTok callback is not yet enabled", { status: 503, headers: noStore });
  }
  return new Response("Not found", { status: 404, headers: noStore });
}
export const tiktokCallbackPath = callbackPath;
