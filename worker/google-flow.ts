export interface FlowSessionView {
  state: "disconnected" | "browser_open" | "login_required" | "account_unverified" | "account_mismatch" | "connected";
  email: string | null;
  credits: number | null;
  checkedAt: string;
  expiresAt?: string;
  saved?: boolean;
  liveViewUrl?: string;
}

export function flowConnectionState(observed: { email?: unknown; editor?: unknown; loginRequired?: unknown } | undefined, expectedEmail: string): FlowSessionView["state"] {
  const email = typeof observed?.email === "string" ? observed.email.toLowerCase() : null;
  if (email && email !== expectedEmail.toLowerCase()) return "account_mismatch";
  if (email && observed?.editor === true) return "connected";
  return observed?.loginRequired === true ? "login_required" : "account_unverified";
}

export function privateJson(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } });
}

export function flowFailure(error: unknown): { error: string; message: string; status: number; retryAfter?: number } {
  const raw = error !== null && typeof error === "object" ? error as { message?: unknown; status?: unknown; statusCode?: unknown } : {};
  const message = typeof raw.message === "string" ? raw.message : "";
  if (/flow_daily_limit|browser time limit|daily.*(quota|limit)|quota.*(day|daily)/i.test(message)) return {
    error: "flow_daily_limit", status: 429, message: "O tempo diário do navegador remoto foi esgotado na Cloudflare. O acesso fica indisponível até a renovação da cota. Sua conta Google não é a causa desse bloqueio.",
  };
  if (/flow_session_busy/.test(message)) return { error: "flow_session_busy", status: 409, message: "Já existe uma verificação em andamento. Aguarde alguns segundos e tente novamente.", retryAfter: 5 };
  if (/flow_browser_rate_limited|429|rate.?limit|too many requests|too many browsers|maximum.*(browser|session)/i.test(message) || raw.status === 429 || raw.statusCode === 429) return {
    error: "flow_browser_rate_limited", status: 429, message: "A Cloudflare limitou a abertura do navegador remoto. Aguarde antes de tentar novamente. Esse limite é separado da sua conta e dos créditos Google.", retryAfter: 60,
  };
  if (/flow_session_expired|404|not found|does not exist|no such session|session.*(closed|expired)|browser.*(closed|expired)/i.test(message)) return {
    error: "flow_session_expired", status: 410, message: "A sessão do navegador expirou. Clique em Conectar / reabrir Flow para abrir outra janela.",
  };
  return { error: "flow_browser_unavailable", status: 503, message: "O navegador remoto está indisponível agora. Tente novamente mais tarde. Nenhuma geração foi enviada." };
}

export async function flowBrowserAlive(id: string, getSession: (id: string) => Promise<{ endTime?: number } | null>): Promise<boolean> {
  try { const session = await getSession(id); return session !== null && session.endTime === undefined; }
  catch (error) { if (flowFailure(error).error === "flow_session_expired") return false; throw error; }
}

// No user-provided identifiers, URLs, cookies or browser commands are accepted.
export async function handleGoogleFlow(request: Request, env: {
  MV_SUPABASE_PUBLISHABLE_KEY: string;
  GOOGLE_FLOW_SESSIONS: { getByName(name: string): { act(action: string, email: string): Promise<FlowSessionView> } };
}, fetcher: typeof fetch = fetch): Promise<Response> {
  const url = new URL(request.url);
  if (request.method !== "POST") return privateJson({ error: "method_not_allowed" }, 405);
  if (request.headers.get("Origin") !== url.origin || request.headers.get("Sec-Fetch-Site") === "cross-site") return privateJson({ error: "origin_not_allowed" }, 403);
  if (!request.headers.get("Content-Type")?.startsWith("application/json")) return privateJson({ error: "invalid_request" }, 400);
  const bearer = request.headers.get("Authorization") ?? "";
  if (!/^Bearer [A-Za-z0-9_.-]{20,8192}$/.test(bearer)) return privateJson({ error: "unauthorized" }, 401);
  let response: Response;
  try {
    response = await fetcher("https://jzchlrvxdaffnrgbvabv.supabase.co/auth/v1/user", {
      headers: { apikey: env.MV_SUPABASE_PUBLISHABLE_KEY, Authorization: bearer }, redirect: "manual", signal: AbortSignal.timeout(8000),
    });
  } catch { return privateJson({ error: "auth_unavailable" }, 503); }
  if (!response.ok) { await response.body?.cancel(); return privateJson({ error: "unauthorized" }, 401); }
  const user = await response.json() as { id?: string; email?: string; email_confirmed_at?: string };
  if (!user.id || !user.email || !user.email_confirmed_at) return privateJson({ error: "confirmed_account_required" }, 403);
  const action = url.pathname.split("/").at(-1) ?? "";
  if (!["status", "start", "verify", "save", "disconnect"].includes(action)) return privateJson({ error: "invalid_action" }, 404);
  try { return privateJson(await env.GOOGLE_FLOW_SESSIONS.getByName(user.id).act(action, user.email)); }
  catch (error) {
    const failure = flowFailure(error);
    console.warn(JSON.stringify({ event: "google_flow_connection_failed", action, code: failure.error }));
    const response = privateJson({ error: failure.error, message: failure.message }, failure.status);
    if (failure.retryAfter) response.headers.set("Retry-After", String(failure.retryAfter));
    return response;
  }
}

export function safeLiveView(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "live.browser.run" || url.username || url.password) throw new Error("invalid_live_view");
  return url.href;
}

// Read only a small, explicit subset of the Flow UI. No API tokens, cookies,
// complete page content, or internal endpoints are returned.
export const flowInspection = `(() => {
  if (location.hostname === 'accounts.google.com') return { email: null, credits: null, editor: false, loginRequired: true };
  if (location.hostname !== 'flow.google.com' && !(location.hostname === 'labs.google' && location.pathname.startsWith('/fx'))) return { email: null, credits: null, editor: false };
  const labels = Array.from(document.querySelectorAll('[aria-label],[title]')).slice(0, 1000).map(e => e.getAttribute('aria-label') || e.getAttribute('title') || '');
  const accountLabels = labels.filter(s => /google.*(account|conta)|(account|conta).*google/i.test(s));
  const emails = [...new Set(accountLabels.flatMap(s => s.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/ig) || []))];
  const creditNodes = Array.from(document.querySelectorAll('button,[role="menuitem"],span')).slice(0, 2000).map(e => e.textContent?.trim() || '').filter(s => /^\\d+\\s+(credits|créditos)$/i.test(s));
  const amounts = [...new Set(creditNodes.map(s => Number(s.match(/^\\d+/)[0])))];
  const loginRequired = Array.from(document.querySelectorAll('button,a')).some(e => /^(sign in|log in|fazer login|entrar|sign in with google|continue with google)$/i.test(e.textContent.trim()));
  return { email: emails.length === 1 ? emails[0] : null, credits: amounts.length === 1 ? amounts[0] : null, editor: Boolean(document.querySelector('[contenteditable="true"],textarea')), loginRequired };
})()`;
