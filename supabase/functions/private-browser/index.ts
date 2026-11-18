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
    diagnose: { path: "/session/diagnose", method: "GET" },
    learning_start: { path: "/session/learning/start", method: "POST" },
    learning_stop: { path: "/session/learning/stop", method: "POST" },
    learning_status: { path: "/session/learning/status", method: "GET" },
    stage: { path: "/session/stage", method: "POST" },
    video_download: { path: "/session/video/prepare", method: "POST" },
    start: { path: "/session/start", method: "POST" },
    stop: { path: "/session/stop", method: "POST" },
    view: { path: "/session/view-ticket", method: "POST" },
  };
  const action = input?.action;
  if (typeof action !== "string" || !Object.hasOwn(routes, action))
    return reply({ error: "invalid_action" }, 400);
  if (action === "stage" || action === "learning_start") {
    if ((action === "stage" && (typeof input?.prompt !== "string" || input.prompt.trim().length < 1 || input.prompt.length > 4000)) || !Array.isArray(input.images) || input.images.length > 3 || (input.images.length > 0 && input.imageRightsConfirmed !== true)) return reply({ error: "invalid_draft" }, 400);
    if (JSON.stringify(input).length > 3_800_000) return reply({ error: "payload_too_large" }, 413);
  }
  const target = routes[action];
  const startedAt = Date.now();
  const response = await fetch(new URL(target.path, base), {
    method: target.method,
    headers: { authorization: "Bearer " + serviceSecret, ...(action === "stage" || action === "learning_start" || action === "video_download" ? { "content-type": "application/json" } : {}) },
    ...(action === "stage" || action === "learning_start" ? { body: JSON.stringify({ prompt: input?.prompt, images: input?.images, imageRightsConfirmed: input?.imageRightsConfirmed, configureAndGenerate: input?.configureAndGenerate === true }) }
      : action === "video_download" ? { body: JSON.stringify({ appOrigin: origin }) } : {}),,
    signal: AbortSignal.timeout(action === "stage" ? 120000 : action === "video_download" ? 45000 : action === "start" || action === "learning_start" ? 60000 : 12000),
  }).catch(() => null);
  if (!response) {
    console.log(JSON.stringify({ source: "private_browser_bridge", action, outcome: "upstream_unreachable",
      elapsedMs: Date.now() - startedAt }));
    return reply({ error: "browser_unavailable" }, 502);
  }
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    console.log(JSON.stringify({ source: "private_browser_bridge", action, outcome: "upstream_error",
      upstreamStatus: response.status, elapsedMs: Date.now() - startedAt }));
    // Forward only known, fixed browser error codes; never relay arbitrary upstream content.
    const allowed = new Set([
      "browser_not_running", "flow_page_not_active", "flow_project_not_active",
      "new_project_button_not_found", "prompt_field_not_unique",
      "flow_upload_action_not_found", "flow_upload_incomplete",
      "flow_add_elements_not_found", "flow_add_elements_ambiguous",
      "flow_image_rights_unresolved", "flow_reference_selection_unavailable",
      "flow_reference_include_unavailable", "flow_settings_button_not_found",
      "flow_settings_button_ambiguous", "flow_settings_panel_not_found",
      "flow_settings_option_not_found", "flow_settings_model_unverified",
      "flow_settings_save_not_found", "flow_generate_button_unverified",
      "flow_interaction_failed",
      "invalid_draft", "payload_too_large",
      "flow_video_project_not_unique", "flow_video_not_unique",
      "flow_video_download_control_not_unique", "flow_video_download_not_started",
      "flow_video_download_failed", "flow_video_invalid_mp4", "browser_not_running",
    ]);
    const code = typeof result?.detail === "string" && allowed.has(result.detail)
      ? result.detail : "browser_unavailable";
    return reply({ error: code }, response.status === 409 ? 409 : 502);
  }
  // Status requests carry a bounded, fixed-code diagnostic ring from Modal.
  // Log only allowlisted event codes and coarse process state, never browser content.
  if (action === "status" && Array.isArray(result?.diagnostics?.events)) {
    const allowedEvents = new Set(["chrome_started", "chrome_already_running", "chrome_stopped",
      "chrome_exited", "chrome_start_failed", "chrome_not_running", "viewer_ticket_issued",
      "viewer_rejected", "viewer_connected", "viewer_disconnected", "viewer_proxy_failed",
      "stage_started", "stage_completed", "stage_failed", "stage_prompt_filled",
      "click_new_project", "click_prompt", "click_add_elements", "click_upload",
      "click_settings", "click_generate", "click_rights", "click_reference",
      "click_include", "add_elements_not_found", "upload_not_found",
      "upload_incomplete", "service_started", "service_stopped"]);
    const events = result.diagnostics.events.slice(-20)
      .filter((event: unknown) => typeof event === "object" && event !== null)
      .map((event: Record<string, unknown>) => ({
        code: typeof event.code === "string" && allowedEvents.has(event.code) ? event.code : "unknown",
        at: typeof event.at === "number" && Number.isInteger(event.at) ? event.at : 0,
      }));
    console.log(JSON.stringify({ source: "private_browser_diagnostics",
      running: result.running === true, processExited: result.diagnostics.processExited === true, events }));
  }
  if (action === "video_download") {
    if (typeof result?.ticket !== "string" || !/^[A-Za-z0-9_-]{32,128}$/.test(result.ticket)
        || typeof result?.bytes !== "number" || result.bytes <= 0 || result.bytes > 100 * 1024 * 1024) {
      return reply({ error: "browser_unavailable" }, 502);
    }
    return reply({
      downloadUrl: new URL("/session/video/file?ticket=" + encodeURIComponent(result.ticket), base).toString(),
      bytes: result.bytes,
    });
  }
  if (action === "view") {
    if (typeof result?.ticket !== "string" || !/^[A-Za-z0-9_-]{32,128}$/.test(result.ticket))
      return reply({ error: "invalid_ticket" }, 502);
    return reply({ viewUrl: new URL("/viewer?ticket=" + encodeURIComponent(result.ticket), base).toString(), expiresInSeconds: 60 });
  }
  return reply(result);
});
