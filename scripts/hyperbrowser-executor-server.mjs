import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { chromium } from "playwright-core";

const secret = process.env.MV_HYPERBROWSER_EXECUTOR_SECRET;
const port = Number(process.env.PORT ?? 8080);
if (!secret || secret.length < 32) throw new Error("Configure MV_HYPERBROWSER_EXECUTOR_SECRET (mínimo 32 caracteres).");
function authorized(value) {
  const supplied = value?.startsWith("Bearer ") ? value.slice(7) : "";
  const a = Buffer.from(supplied), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
function respond(res, status, data) {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(data));
}
const server = createServer(async (req, res) => {
  if (req.url === "/health" && req.method === "GET") return respond(res, 200, { ok: true });
  if (req.url !== "/navigate" || req.method !== "POST") return respond(res, 404, { error: "not_found" });
  if (!authorized(req.headers.authorization)) return respond(res, 401, { error: "unauthorized" });
  let raw = "";
  try {
    for await (const chunk of req) {
      raw += chunk.toString();
      if (raw.length > 16000) return respond(res, 413, { error: "too_large" });
    }
    const { wsEndpoint } = JSON.parse(raw);
    const url = new URL(wsEndpoint);
    if (url.protocol !== "wss:" || !(/(^|\\.)hyperbrowser\\.ai$|(^|\\.)hxproxy\\.io$/.test(url.hostname)))
      return respond(res, 400, { error: "invalid_endpoint" });
    let browser;
    try {
      browser = await chromium.connectOverCDP(wsEndpoint, { timeout: 20000 });
      const context = browser.contexts()[0];
      if (!context) throw new Error("no_context");
      const page = context.pages()[0] ?? await context.newPage();
      await page.goto("https://flow.google.com/", { waitUntil: "domcontentloaded", timeout: 30000 });
      return respond(res, 200, { navigationReady: true });
    } finally {
      await browser?.close().catch(() => {});
    }
  } catch (error) {
    console.warn("hyperbrowser_executor_failed", { name: error instanceof Error ? error.name : "unknown" });
    return respond(res, 502, { navigationReady: false, error: "navigation_failed" });
  }
});
server.listen(port, "0.0.0.0", () => console.info("hyperbrowser_executor_listening", { port }));
