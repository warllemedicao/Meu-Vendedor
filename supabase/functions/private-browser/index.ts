import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Private bridge between an authenticated Meu Vendedor account and the isolated
 * Chromium service. Do not deploy until a private dedicated browser service is
 * provisioned and tested. This endpoint never exposes the control bearer.
 */
const cors = {
  "access-control-allow-origin": Deno.env.get("MV_APP_ORIGIN") ?? "https://invalid.example",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
  "vary": "Origin",
};
const reply = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { ...cors, "cache-control": "no-store" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
  const origin = Deno.env.get("MV_APP_ORIGIN");
  if (!origin || req.headers.get("origin") !== origin) return reply({ error: "origin_not_allowed" }, 403);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceUrl = Deno.env.get("MV_PRIVATE_BROWSER_URL");
  const serviceSecret = Deno.env.get("MV_PRIVATE_BROWSER_SECRET");
  const owner = Deno.env.get("MV_PRIVATE_BROWSER_OWNER_USER_ID");
  if (!url || !anon || !serviceUrl || !serviceSecret || !owner || serviceSecret.length < 32)
    return reply({ error: "browser_not_configured" }, 503);
  let base: URL;
  try {
    base = new URL(serviceUrl);
    if (base.protocol !== "https:" || base.pathname !== "/" || base.search || base.hash || !base.hostname)
      return reply({ error: "browser_not_configured" }, 503);
  } catch { return reply({ error: "browser_not_configured" }, 503); }
  const bearer = req.headers.get("authorization") ?? "";
  if (!/^Bearer [A-Za-z0-9_.-]{20,8192}$/.test(bearer)) return reply({ error: "unauthorized" }, 401);
  const auth = await fetch(url + "/auth/v1/user", {
    headers: { apikey: anon, authorization: bearer },
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!auth?.ok) return reply({ error: "unauthorized" }, 401);
  const user = await auth.json().catch(() => null);
  if (!user?.id || user.id !== owner || !user.email_confirmed_at)
    return reply({ error: "forbidden" }, 403);
  const input = await req.json().catch(() => null);
  const routes: Record<string, { path: string; method: string }> = {
    status: { path: "/session/status", method: "GET" },
    inspect: { path: "/session/inspect", method: "GET" },
    stage: { path: "/session/stage", method: "POST" },
    start: { path: "/session/start", method: "POST" },
    stop: { path: "/session/stop", method: "POST" },
    view: { path: "/session/view-ticket", method: "POST" },
  };
  const action = input?.action;
  if (typeof action !== "string" || !Object.hasOwn(routes, action))
    return reply({ error: "invalid_action" }, 400);
  if (action === "stage") {
    if (typeof input?.prompt !== "string" || input.prompt.trim().length < 1 || input.prompt.length > 4000 || !Array.isArray(input.images) || input.images.length > 3 || (input.images.length > 0 && input.imageRightsConfirmed !== true)) return reply({ error: "invalid_draft" }, 400);
    if (JSON.stringify(input).length > 3_800_000) return reply({ error: "payload_too_large" }, 413);
  }
  const target = routes[action];
  const response = await fetch(new URL(target.path, base), {
    method: target.method,
    headers: { authorization: "Bearer " + serviceSecret, ...(action === "stage" ? { "content-type": "application/json" } : {}) },
    ...(action === "stage" ? { body: JSON.stringify({ prompt: input?.prompt, images: input?.images, imageRightsConfirmed: input?.imageRightsConfirmed }) } : {}),
    signal: AbortSignal.timeout(action === "start" || action === "stage" ? 60000 : 12000),
  }).catch(() => null);
  if (!response) return reply({ error: "browser_unavailable" }, 502);
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    // Forward only known, fixed browser error codes; never relay arbitrary upstream content.
    const allowed = new Set([
      "browser_not_running", "flow_page_not_active", "flow_project_not_active",
      "new_project_button_not_found", "prompt_field_not_unique",
      "flow_upload_action_not_found", "flow_interaction_failed",
      "invalid_draft", "payload_too_large",
    ]);
    const code = typeof result?.detail === "string" && allowed.has(result.detail)
      ? result.detail : "browser_unavailable";
    return reply({ error: code }, response.status === 409 ? 409 : 502);
  }
  if (action === "view") {
    if (typeof result?.ticket !== "string" || !/^[A-Za-z0-9_-]{32,128}$/.test(result.ticket))
      return reply({ error: "invalid_ticket" }, 502);
    return reply({ viewUrl: new URL("/viewer?ticket=" + encodeURIComponent(result.ticket), base).toString(), expiresInSeconds: 60 });
  }
  return reply(result);
});
