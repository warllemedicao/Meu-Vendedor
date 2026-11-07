import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { createKagglePilotClient } from "./_shared/client.ts";

// Operator-only pilot. Never executes client code, enables billing or exposes the API token.
const secret = Deno.env.get("MV_VIDEO_WORKER_SECRET") ?? "";
const token = Deno.env.get("KAGGLE_API_TOKEN") ?? "";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const client = createKagglePilotClient(token);
Deno.serve(async req => {
  if (req.method !== "POST") return new Response(null, { status: 405 });
  const supplied = req.headers.get("x-worker-secret") ?? "";
  let mismatch = secret.length ^ supplied.length;
  for (let i = 0; i < secret.length; i++) mismatch |= secret.charCodeAt(i) ^ (supplied.charCodeAt(i) || 0);
  if (secret.length < 32 || mismatch) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!token) return Response.json({ error: "kaggle_not_configured" }, { status: 503 });
  const text = await req.text(); if (text.length > 1024) return Response.json({ error: "request_too_large" }, { status: 413 });
  let action: unknown; try { action = JSON.parse(text).action; } catch { return Response.json({ error: "invalid_request" }, { status: 400 }); }
  if (!["check", "start", "status"].includes(String(action))) return Response.json({ error: "invalid_action" }, { status: 400 });
  try {
    if (action === "check") return Response.json(await client.check());
    if (action === "status") {
      const result = await client.status();
      await db.from("mv_ai_provider_audits").update({ checked_at: new Date().toISOString(), report: { state: result.status, ...result, quota_verified: false } }).eq("provider_id", "kaggle-pilot");
      return Response.json(result);
    }
    // A primary-key claim prevents duplicate GPU launches across retries/instances.
    const { error } = await db.from("mv_ai_provider_audits").insert({ provider_id: "kaggle-pilot", status: "checked", checked_at: new Date().toISOString(), report: { state: "submitting", quota_verified: false } });
    if (error) return Response.json({ error: "pilot_already_claimed_or_database_unavailable", message: "Consulte o estado; não reenviar automaticamente." }, { status: 409 });
    const result = await client.start();
    await db.from("mv_ai_provider_audits").update({ checked_at: new Date().toISOString(), report: { state: "submitted", ...result, quota_verified: false } }).eq("provider_id", "kaggle-pilot");
    return Response.json(result, { status: 202 });
  } catch (e) {
    const code = e instanceof Error && /^kaggle_[a-z0-9_]+$/.test(e.message) ? e.message : "kaggle_pilot_unavailable";
    return Response.json({ error: code }, { status: 503 });
  }
});
