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

type InputPayload = {
  action?: string;
  prompt?: string;
  images?: unknown[];
  imageRightsConfirmed?: boolean;
  configureAndGenerate?: boolean;
  downloadId?: string;
  accountId?: string;
  label?: string;
  purpose?: "flow" | "account_login";
};
type VideoPayload = { id?: string; name?: string; bytes?: number; modifiedAt?: number };
type DiagnosticPayload = {
  stage?: string; reason?: string; flowProjectTabs?: number;
  videoCandidates?: number; toolbarCandidates?: number;
  resolutionCandidates?: number; previewClicked?: boolean;
  editorOpen?: boolean; downloadMenuClicked?: boolean;
  resolutionClicked?: boolean;
  frames?: Array<Record<string, unknown>>;
};
type BrowserResult = {
  detail?: string | { code?: string; diagnostic?: DiagnosticPayload };
  diagnostics?: { events?: Array<Record<string, unknown>>; processExited?: boolean };
  running?: boolean; status?: string; video?: VideoPayload;
  videos?: Array<Record<string, unknown>>;
  ticket?: string; bytes?: number;
};


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
  const user = await auth.json().catch(() => null) as { id?: string; email_confirmed_at?: string } | null;
  if (!user?.id || user.id !== owner || !user.email_confirmed_at)
    return reply({ error: "forbidden" }, 403);
  const input = await req.json().catch(() => null) as InputPayload | null;
  const routes: Record<string, { path: string; method: string }> = {
    status: { path: "/session/status", method: "GET" },
    accounts_list: { path: "/session/accounts", method: "GET" },
    accounts_login_status: { path: "/session/accounts/login-status", method: "GET" },
    accounts_create: { path: "/session/accounts/create", method: "POST" },
    accounts_select: { path: "/session/accounts/select", method: "POST" },
    inspect: { path: "/session/inspect", method: "GET" },
    diagnose: { path: "/session/diagnose", method: "GET" },
    learning_start: { path: "/session/learning/start", method: "POST" },
    learning_stop: { path: "/session/learning/stop", method: "POST" },
    learning_status: { path: "/session/learning/status", method: "GET" },
    stage: { path: "/session/stage", method: "POST" },
    video_download: { path: "/session/video/prepare", method: "POST" },
    video_list: { path: "/session/video/downloads", method: "GET" },
    video_train: { path: "/session/video/train-download", method: "POST" },
    video_generated_ready: { path: "/session/video/generated-ready", method: "GET" },
    video_generation_error: { path: "/session/video/generation-error", method: "GET" },
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
  if (action === "start" && input?.purpose !== undefined &&
      input.purpose !== "flow" && input.purpose !== "account_login")
    return reply({ error: "invalid_browser_purpose" }, 400);
  if (action === "accounts_select" &&
      (typeof input?.accountId !== "string" || !/^(primary|account-[a-f0-9]{16})$/.test(input.accountId)))
    return reply({ error: "invalid_account" }, 400);
  const target = routes[action];
  const startedAt = Date.now();
  const response = await fetch(new URL(target.path, base), {
    method: target.method,
    headers: { authorization: "Bearer " + serviceSecret, ...(action === "stage" || action === "learning_start" || action === "video_download" || action === "accounts_create" || action === "accounts_select" || action === "start" ? { "content-type": "application/json" } : {}) },
    ...(action === "stage" || action === "learning_start" ? { body: JSON.stringify({ prompt: input?.prompt, images: input?.images, imageRightsConfirmed: input?.imageRightsConfirmed, configureAndGenerate: input?.configureAndGenerate === true }) }
      : action === "video_download" ? { body: JSON.stringify({ appOrigin: origin, downloadId: input?.downloadId }) }
      : action === "accounts_create" ? { body: JSON.stringify({}) }
      : action === "accounts_select" ? { body: JSON.stringify({ accountId: input?.accountId }) }
      : action === "start" ? { body: JSON.stringify({ purpose: input?.purpose ?? "flow" }) } : {}),
    signal: AbortSignal.timeout(action === "stage" ? 120000 : (action === "video_download" || action === "video_train") ? 45000 : action === "video_generated_ready" ? 30000 : action === "start" || action === "learning_start" ? 60000 : 12000),
  }).catch(() => null);
  if (!response) {
    console.log(JSON.stringify({ source: "private_browser_bridge", action, outcome: "upstream_unreachable",
      elapsedMs: Date.now() - startedAt }));
    return reply({ error: "browser_unavailable" }, 502);
  }
  const result = await response.json().catch(() => null) as BrowserResult | null;
  if (!response.ok) {
    console.log(JSON.stringify({ source: "private_browser_bridge", action, outcome: "upstream_error",
      upstreamStatus: response.status, elapsedMs: Date.now() - startedAt }));
    // Forward only known, fixed browser error codes; never relay arbitrary upstream content.
    const allowed = new Set([
      "browser_not_running", "flow_page_not_active", "flow_project_not_active",
      "invalid_account", "invalid_browser_purpose", "account_setup_required", "browser_must_be_stopped", "account_limit_reached",
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
      "flow_video_project_not_unique", "flow_video_not_unique", "flow_video_editor_not_open",
      "flow_video_download_control_not_unique", "flow_video_download_not_started",
      "flow_generated_video_not_ready", "flow_native_download_behavior_unverified",
      "flow_download_file_not_found", "invalid_download_selection",
      "flow_video_download_failed", "flow_video_invalid_mp4", "browser_not_running",
    ]);
    const detail = result?.detail;
    const upstreamCode = typeof detail === "string" ? detail : detail?.code;
    const code = typeof upstreamCode === "string" && allowed.has(upstreamCode)
      ? upstreamCode : "browser_unavailable";
    if (action === "video_train") {
      const source = typeof detail === "object" && detail !== null ? detail?.diagnostic : null;
      const safeStage = ["initializing", "browser_check", "project_check", "start",
        "find_video_preview", "click_video_preview", "wait_for_editor", "editor_check",
        "editor_open", "find_download_button", "find_720p", "wait_for_mp4", "completed"];
      const safeReason = ["not_started", "chrome_not_running", "project_tab_count_not_one",
        "started", "no_eligible_video", "no_video_dom_elements", "video_filtered_out", "verified", "click_not_dispatched",
        "editor_navigation_pending", "editor_url_not_confirmed", "already_in_editor",
        "toolbar_button_count_not_one", "resolution_not_verified", "mp4_not_confirmed",
        "mp4_confirmed", "download_timeout"];
      const count = (value: unknown) => typeof value === "number" && Number.isInteger(value)
        && value >= 0 && value <= 1000 ? value : null;
      const diagnostic = {
        stage: safeStage.includes(source?.stage) ? source.stage : "initializing",
        reason: safeReason.includes(source?.reason) ? source.reason : "not_started",
        flowProjectTabs: count(source?.flowProjectTabs),
        videoCandidates: count(source?.videoCandidates),
        toolbarCandidates: count(source?.toolbarCandidates),
        resolutionCandidates: count(source?.resolutionCandidates),
        previewClicked: source?.previewClicked === true,
        editorOpen: source?.editorOpen === true,
        downloadMenuClicked: source?.downloadMenuClicked === true,
        resolutionClicked: source?.resolutionClicked === true,
        frames: Array.isArray(source?.frames) ? source.frames.slice(0, 8).map(
          (frame: Record<string, unknown>) => ({
            frame: count(frame?.frame),
            eligible: typeof frame?.eligible === "number" &&
              Number.isInteger(frame.eligible) && frame.eligible >= -1 &&
              frame.eligible <= 1000 ? frame.eligible : null,
            raw: count(frame?.raw),
            visible: count(frame?.visible),
            rejectedSize: count(frame?.rejectedSize),
            rejectedPosition: count(frame?.rejectedPosition),
          })) : [],
      };
      return reply({ error: code, diagnostic }, response.status === 409 ? 409 : 502);
    }
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
  if (action === "video_train") {
    const video = result?.video;
    if (result?.status !== "download_completed" || typeof video?.id !== "string" ||
        !/^[a-f0-9]{64}$/.test(video.id) ||
        typeof video?.bytes !== "number" || video.bytes <= 0 || video.bytes > 100 * 1024 * 1024) {
      return reply({ error: "browser_unavailable" }, 502);
    }
    return reply({ status: "download_completed", video: {
      id: video.id,
      name: typeof video.name === "string" ? video.name.slice(0,120) : "google-flow-video.mp4",
      bytes: video.bytes,
      modifiedAt: typeof video.modifiedAt === "number" ? video.modifiedAt : 0,
    } });
  }
  if (action === "video_list") {
    const videos = Array.isArray(result?.videos) ? result.videos.slice(0, 20)
      .filter((video: unknown) => typeof video === "object" && video !== null)
      .map((video: Record<string, unknown>) => ({
        id: typeof video.id === "string" && /^[a-f0-9]{64}$/.test(video.id) ? video.id : "",
        name: typeof video.name === "string" ? video.name.slice(0, 120) : "",
        bytes: typeof video.bytes === "number" && video.bytes > 0 && video.bytes <= 100 * 1024 * 1024 ? video.bytes : 0,
        modifiedAt: typeof video.modifiedAt === "number" ? video.modifiedAt : 0,
      })).filter((video: { id: string; bytes: number }) => video.id && video.bytes) : [];
    return reply({ videos });
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
