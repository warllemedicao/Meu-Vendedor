/**
 * Executor Playwright separado do Supabase Edge Runtime.
 * Execute em Node.js 22+ com: npm install --no-save playwright-core
 * HYPERBROWSER_WS_ENDPOINT=wss://... node scripts/hyperbrowser-flow-navigate.mjs
 * Nunca grave endpoints com tokens em logs ou no Git.
 */
import { chromium } from "playwright-core";

const endpoint = process.env.HYPERBROWSER_WS_ENDPOINT;
if (!endpoint || !endpoint.startsWith("wss://")) {
  console.error("HYPERBROWSER_WS_ENDPOINT ausente ou inválido.");
  process.exitCode = 2;
} else {
  let browser;
  try {
    browser = await chromium.connectOverCDP(endpoint, { timeout: 20000 });
    const context = browser.contexts()[0];
    if (!context) throw new Error("Sessão CDP sem contexto de navegador.");
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto("https://flow.google.com/", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    console.log(JSON.stringify({
      success: true,
      destination: new URL(page.url()).origin,
      title: (await page.title()).slice(0, 100),
    }));
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      stage: "navigate",
      name: error instanceof Error ? error.name : "unknown",
    }));
    process.exitCode = 1;
  } finally {
    // Disconnect only; do not stop the Hyperbrowser session or discard its profile.
    if (browser) await browser.close().catch(() => {});
  }
}
