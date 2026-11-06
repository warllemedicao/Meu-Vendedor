import { callFlowExecutor } from "./flow-executor.ts";
import { DurableObject } from "cloudflare:workers";
import { flowInspection, flowConnectionState, flowFailure, flowBrowserAlive, safeLiveView, type FlowSessionView } from "./google-flow.ts";

type Env = WorkerBindings & { MV_VIDEO_WORKER_SECRET: string; MV_FLOW_EXECUTOR_URL?: string; MV_FLOW_EXECUTOR_SECRET?: string };
type SavedBrowser = { sessionId: string; targetId: string; expires: number };
type CdpResult = { result?: { value?: unknown } };
const ttl = 10 * 60_000;

async function command(socket: WebSocket, method: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const id = crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff;
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); socket.removeEventListener("message", receive); socket.removeEventListener("close", closed); };
    const closed = () => { cleanup(); reject(new Error("cdp_closed")); };
    const receive = (event: MessageEvent) => {
      let body: { id?: number; error?: unknown; result?: Record<string, unknown> };
      try { body = JSON.parse(String(event.data)); } catch { return; }
      if (body.id !== id) return;
      cleanup();
      if (body.error) reject(new Error("cdp_command_failed")); else resolve(body.result ?? {});
    };
    const timer = setTimeout(() => { cleanup(); reject(new Error("cdp_timeout")); }, 15_000);
    socket.addEventListener("message", receive); socket.addEventListener("close", closed);
    try { socket.send(JSON.stringify({ id, method, params })); } catch { cleanup(); reject(new Error("cdp_send_failed")); }
  });
}

export class GoogleFlowSession extends DurableObject<Env> {
  private busy = false;
  async act(action: string, expectedEmail: string): Promise<FlowSessionView> {
    if (this.busy) throw new Error("flow_session_busy");
    this.busy = true;
    let throttled = false;
    try {
      if (this.env.MV_FLOW_EXECUTOR_URL) return await this.remote(action, expectedEmail);
      const blocked = await this.ctx.storage.get<{ until: number; code: string }>("blocked");
      if (action !== "disconnect" && blocked && blocked.until > Date.now()) { throttled = true; throw new Error(blocked.code); }
      return await this.perform(action, expectedEmail);
    }
    catch (error) {
      if (this.env.MV_FLOW_EXECUTOR_URL) console.warn(JSON.stringify({ event: "flow_executor_operation_failed", action,
        reason: error instanceof Error && /^[a-z_]{1,80}$/.test(error.message) ? error.message : "unclassified_failure" }));
      const failure = flowFailure(error);
      if (!throttled && ["flow_daily_limit", "flow_browser_rate_limited"].includes(failure.error)) {
        const until = new Date();
        if (failure.error === "flow_daily_limit") until.setUTCHours(24, 0, 0, 0);
        else until.setTime(Date.now() + (failure.retryAfter ?? 60) * 1000);
        await this.ctx.storage.put("blocked", { until: until.getTime(), code: failure.error });
      }
      throw new Error(failure.error);
    }
    finally { this.busy = false; }
  }
  private async close() {
    const browser = await this.ctx.storage.get<SavedBrowser>("browser");
    if (browser) {
      // Keep the alarm and reference on failure so cleanup can be retried.
      try { await this.env.BROWSER.closeSession(browser.sessionId); }
      catch (error) {
        if (!(error instanceof Error) || !/404|not found|does not exist|no such session/i.test(error.message)) throw new Error("flow_close_unavailable");
      }
      await this.ctx.storage.delete("browser");
    }
    const saved = await this.ctx.storage.get<{ expires: number }>("cookies");
    if (saved && saved.expires > Date.now()) await this.ctx.storage.setAlarm(saved.expires);
    else { await this.ctx.storage.delete("cookies"); await this.ctx.storage.deleteAlarm(); }
  }
  async alarm() { await this.close(); await this.closeRemote(); }
  private async closeRemote() {
    if (await this.ctx.storage.get("remote")) {
      await callFlowExecutor(this.env, this.ctx.id.toString(), "disconnect");
      await this.ctx.storage.delete("remote");
    }
    const saved = await this.ctx.storage.get<{ expires: number }>("cookies");
    if (saved && saved.expires > Date.now()) await this.ctx.storage.setAlarm(saved.expires);
    else { await this.ctx.storage.delete("cookies"); await this.ctx.storage.deleteAlarm(); }
  }
  private async remote(action: string, expectedEmail: string): Promise<FlowSessionView> {
    const empty: FlowSessionView = { state: "disconnected", email: null, credits: null, checkedAt: new Date().toISOString() };
    if (await this.ctx.storage.get("browser")) await this.close();
    await this.ctx.storage.delete("blocked"); // Browser Run quota does not apply to the external executor.
    if (action === "disconnect") {
      await this.ctx.storage.delete("cookies");
      await this.closeRemote();
      return empty;
    }
    let cookies: unknown[] | undefined;
    const saved = await this.ctx.storage.get<{ iv: number[]; data: number[]; expires: number; email: string }>("cookies");
    if (saved && saved.expires <= Date.now()) await this.ctx.storage.delete("cookies");
    if (action === "start" && saved && saved.expires > Date.now() && saved.email === expectedEmail.toLowerCase()) {
      try {
        const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(saved.iv), additionalData: new TextEncoder().encode(this.ctx.id.toString()) }, await this.sessionKey(), new Uint8Array(saved.data));
        cookies = JSON.parse(new TextDecoder().decode(plain));
      } catch { await this.ctx.storage.delete("cookies"); }
    }
    if (action !== "start" && !await this.ctx.storage.get("remote")) return { ...empty, saved: Boolean(await this.ctx.storage.get("cookies")) };
    const result = await callFlowExecutor(this.env, this.ctx.id.toString(), action, cookies);
    if (!result.active) { await this.ctx.storage.delete("remote"); await this.closeRemote(); return { ...empty, saved: Boolean(await this.ctx.storage.get("cookies")) }; }
    if (!Number.isSafeInteger(result.expires) || result.expires! <= Date.now() || result.expires! > Date.now() + ttl + 5000) throw new Error("flow_executor_invalid_expiry");
    await this.ctx.storage.put("remote", { expires: result.expires });
    await this.ctx.storage.setAlarm(result.expires!);
    const view: FlowSessionView = { ...empty, state: action === "start" || action === "status" ? "browser_open" : flowConnectionState(result.observed, expectedEmail),
      expiresAt: new Date(result.expires!).toISOString(), saved: Boolean(await this.ctx.storage.get("cookies")) };
    const email = typeof result.observed?.email === "string" ? result.observed.email.toLowerCase() : null;
    view.email = email;
    if (email === expectedEmail.toLowerCase() && Number.isSafeInteger(result.observed?.credits) && Number(result.observed?.credits) >= 0) view.credits = Number(result.observed?.credits);
    if (action === "start" && result.liveViewUrl) view.liveViewUrl = safeLiveView(result.liveViewUrl);
    if (action === "save") {
      if (view.state !== "connected") throw new Error("verified_google_account_required");
      const clean = (result.cookies ?? []).filter((cookie): cookie is Record<string, unknown> => {
        if (!cookie || typeof cookie !== "object") return false;
        const domain = String((cookie as Record<string, unknown>).domain).replace(/^\./, "");
        return domain === "google.com" || domain.endsWith(".google.com") || domain === "labs.google";
      });
      if (JSON.stringify(clean).length > 131072) throw new Error("flow_cookie_limit");
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(this.ctx.id.toString()) }, await this.sessionKey(), new TextEncoder().encode(JSON.stringify(clean)));
      await this.ctx.storage.put("cookies", { iv: [...iv], data: [...new Uint8Array(encrypted)], expires: Date.now() + 7 * 86400_000, email: expectedEmail.toLowerCase() });
      view.saved = true;
    }
    return view;
  }
  private async socket(browser: SavedBrowser) {
    const connection = await this.env.BROWSER.connectSession(browser.sessionId, { targetId: browser.targetId });
    const response = await connection.webSocket.fetch("https://browser-binding.invalid", { headers: { Upgrade: "websocket" } });
    if (!response.webSocket) throw new Error("flow_cdp_unavailable");
    response.webSocket.accept();
    return response.webSocket;
  }
  private async sessionKey() {
    if (this.env.MV_VIDEO_WORKER_SECRET.length < 32) throw new Error("session_encryption_not_configured");
    const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`google-flow-session-v1:${this.env.MV_VIDEO_WORKER_SECRET}`));
    return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  }
  private async perform(action: string, expectedEmail: string): Promise<FlowSessionView> {
    const empty: FlowSessionView = { state: "disconnected", email: null, credits: null, checkedAt: new Date().toISOString() };
    if (action === "disconnect") {
      // Remove the saved login even when closing an expired remote browser fails.
      await this.ctx.storage.delete("cookies");
      await this.close();
      return empty;
    }
    let browser = await this.ctx.storage.get<SavedBrowser>("browser");
    if (browser && !await flowBrowserAlive(browser.sessionId, id => this.env.BROWSER.getSession(id))) {
      await this.ctx.storage.delete("browser");
      await this.close(); // Preserve saved-login cleanup even if the remote browser vanished early.
      browser = undefined;
    }
    if (browser && browser.expires <= Date.now()) { await this.close(); browser = undefined; }
    if (!browser && action !== "start") return { ...empty, saved: Boolean(await this.ctx.storage.get("cookies")) };
    if (!browser) {
      const session = await this.env.BROWSER.acquire({ keepAlive: 60_000, targets: true,
        guardrails: { allowedDomains: ["google.com", "*.google.com", "labs.google", "*.gstatic.com", "*.googleapis.com", "*.googleusercontent.com", "*.recaptcha.net", "*.googlevideo.com"] } });
      const target = session.targets?.find(t => t.type === "page");
      if (!target) { await this.env.BROWSER.closeSession(session.sessionId); throw new Error("flow_target_missing"); }
      browser = { sessionId: session.sessionId, targetId: target.id, expires: Date.now() + ttl };
      await this.ctx.storage.put("browser", browser);
      await this.ctx.storage.setAlarm(browser.expires);
      const socket = await this.socket(browser);
      try {
        const saved = await this.ctx.storage.get<{ iv: number[]; data: number[]; expires: number; email: string }>("cookies");
        if (saved && saved.expires > Date.now() && saved.email === expectedEmail.toLowerCase()) {
          try {
            const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(saved.iv), additionalData: new TextEncoder().encode(this.ctx.id.toString()) }, await this.sessionKey(), new Uint8Array(saved.data));
            await command(socket, "Storage.setCookies", { cookies: JSON.parse(new TextDecoder().decode(plain)) });
          } catch { await this.ctx.storage.delete("cookies"); }
        }
        await command(socket, "Page.navigate", { url: "https://flow.google.com/" });
      } finally { socket.close(); }
    }
    if (action === "status") return { ...empty, state: "browser_open", expiresAt: new Date(browser.expires).toISOString(), saved: Boolean(await this.ctx.storage.get("cookies")) };
    if (action === "start") {
      const live = await this.env.BROWSER.getLiveView(browser.sessionId, { targetId: browser.targetId, mode: "full", expiresInMs: 60_000 });
      return { ...empty, state: "browser_open", expiresAt: new Date(browser.expires).toISOString(), saved: Boolean(await this.ctx.storage.get("cookies")), liveViewUrl: safeLiveView(live.devtoolsFrontendUrl) };
    }
    // Sign-in may open another tab; inspect the Flow tab, never arbitrary pages.
    const targets = await this.env.BROWSER.devtools.listTargets(browser.sessionId);
    const flowTarget = targets.find(t => t.type === "page" && (t.url.startsWith("https://flow.google.com/") || t.url.startsWith("https://labs.google/fx")));
    if (flowTarget && flowTarget.id !== browser.targetId) {
      browser = { ...browser, targetId: flowTarget.id };
      await this.ctx.storage.put("browser", browser);
    }
    const socket = await this.socket(browser);
    let view: FlowSessionView;
    try {
      const result = await command(socket, "Runtime.evaluate", { expression: flowInspection, returnByValue: true }) as CdpResult;
      const raw = result.result?.value as { email?: unknown; credits?: unknown; editor?: unknown; loginRequired?: unknown } | undefined;
      const email = typeof raw?.email === "string" ? raw.email.toLowerCase() : null;
      const matched = email === expectedEmail.toLowerCase();
      view = { ...empty, state: flowConnectionState(raw, expectedEmail),
        email, credits: matched && Number.isSafeInteger(raw?.credits) && Number(raw?.credits) >= 0 ? Number(raw?.credits) : null,
        expiresAt: new Date(browser.expires).toISOString(), saved: Boolean(await this.ctx.storage.get("cookies")) };
      if (action === "save") {
        if (view.state !== "connected") throw new Error("verified_google_account_required");
        const rawCookies = await command(socket, "Storage.getCookies");
        const cookies = (Array.isArray(rawCookies.cookies) ? rawCookies.cookies : []).filter(c => {
          const domain = String(c.domain).replace(/^\./, ""); return domain === "google.com" || domain.endsWith(".google.com") || domain === "labs.google";
        }).map(c => ({ name: c.name, value: c.value, domain: c.domain, path: c.path,
          secure: c.secure, httpOnly: c.httpOnly, ...(c.expires > 0 ? { expires: c.expires } : {}),
          ...(c.sameSite ? { sameSite: c.sameSite } : {}), ...(c.partitionKey ? { partitionKey: c.partitionKey } : {}) }));
        if (JSON.stringify(cookies).length > 131072) throw new Error("flow_cookie_limit");
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(this.ctx.id.toString()) }, await this.sessionKey(), new TextEncoder().encode(JSON.stringify(cookies)));
        await this.ctx.storage.put("cookies", { iv: [...iv], data: [...new Uint8Array(encrypted)], expires: Date.now() + 7 * 86400_000, email: expectedEmail.toLowerCase() });
        view.saved = true;
      }
    } finally { socket.close(); }
    // Verification must not mint a new URL or reload the user's login iframe.
    return view;
  }
}
