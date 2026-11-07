import { GROQ_SCRIPT_MODEL } from "./provider-models.ts";

// Somente GETs de conta/catálogo. Nenhuma inferência ou alteração de faturamento.
export interface ProviderAudit {
  provider_id: string;
  checked_at: string;
  status: "not_configured" | "checked" | "invalid_credentials" | "permission_missing" | "unavailable" | "no_inference_endpoint";
  report: Record<string, unknown>;
}

export async function auditProviders(
  env: (name: string) => string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<ProviderAudit[]> {
  const key = (...names: string[]) => names.map(env).find(Boolean) ?? "";
  const account = key("CLOUDFLARE_ACCOUNT_ID");
  const definitions = [
    { id: "elevenlabs", token: key("ELEVENLABS_API_KEY", "ELEVENLABS_API", "ELEVEN_LABS_API_KEY", "XI_API_KEY"), url: "https://api.elevenlabs.io/v1/user/subscription", elevenlabs: true, summarize: (body: Record<string, unknown>) => ({
      tier: short(body.tier), subscription_status: short(body.status),
      character_count: amount(body.character_count), character_limit: amount(body.character_limit),
      remaining_credits: amount(body.character_count) !== null && amount(body.character_limit) !== null ? Math.max(0, (body.character_limit as number) - (body.character_count as number)) : null,
      next_reset_unix: amount(body.next_character_count_reset_unix),
      commercial_use: body.tier === "free" ? "not_included" : "not_verified",
      quota_verified: false, reason: "free_plan_noncommercial_paid_license_requires_terms_review",
    }) },
    { id: "cloudflare-workers-ai", token: key("CLOUDFLARE_BILLING_READ_TOKEN"), url: /^[a-f0-9]{32}$/i.test(account) ? `https://api.cloudflare.com/client/v4/accounts/${account}/subscriptions` : "", summarize: (body: Record<string, unknown>) => ({
      subscriptions: Array.isArray(body.result) ? body.result.slice(0, 30).map((item) => {
        const row = record(item); const rate = record(row.rate_plan);
        return { state: short(row.state), plan_id: short(rate.id), plan_name: short(rate.public_name ?? rate.name) };
      }) : [],
      quota_verified: false,
      reason: "subscription_does_not_prove_remaining_workers_ai_units_or_model_license",
    }) },
    { id: "magic-hour", token: key("MAGIC_HOUR_API_KEY"), url: "https://api.magichour.ai/v1/account", summarize: (body: Record<string, unknown>) => ({ tier: short(body.tier), total_credits: amount(body.credits), subscription_active: record(body.subscription).status === "active", quota_verified: false, reason: "balance_mixes_purchased_and_subscription_credits" }) },
    { id: "openrouter", token: key("OPENROUTER_API_KEY"), url: "https://openrouter.ai/api/v1/key", summarize: (body: Record<string, unknown>) => ({ is_free_tier: record(body.data).is_free_tier === true, limit_remaining: amount(record(body.data).limit_remaining), quota_verified: false, reason: "key_limit_is_not_account_balance" }) },
    { id: "openrouter-balance", token: key("OPENROUTER_API_KEY"), url: "https://openrouter.ai/api/v1/credits", summarize: (body: Record<string, unknown>) => ({ total_credits: amount(record(body.data).total_credits), total_usage: amount(record(body.data).total_usage), quota_verified: false, reason: "management_key_required_for_account_balance" }) },
    { id: "runway", token: key("RUNWAYML_API_SECRET", "RUNWAY_API_KEY"), url: "https://api.dev.runwayml.com/v1/organization", summarize: (body: Record<string, unknown>) => ({ credit_balance: amount(body.creditBalance), quota_verified: false, reason: "api_project_balance_not_web_subscription" }) },
    { id: "groq", token: key("GROQ_API_KEY"), url: "https://api.groq.com/openai/v1/models", summarize: (body: Record<string, unknown>) => ({ configured_model_available: Array.isArray(body.data) && body.data.some((item) => record(item).id === GROQ_SCRIPT_MODEL), available_models: Array.isArray(body.data) ? body.data.map((item) => short(record(item).id)).filter((id) => id && /^[a-zA-Z0-9/_.-]+$/.test(id)).slice(0, 25) : [], quota_verified: false, reason: "model_catalog_does_not_prove_billing_tier" }) },
    { id: "google-gemini", token: key("GEMINI_API_KEY", "GOOGLE_API_KEY"), url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash", google: true, summarize: (body: Record<string, unknown>) => ({ model: short(body.name), quota_verified: false, reason: "model_catalog_does_not_prove_billing_tier" }) },
    { id: "google-video", token: key("GEMINI_API_KEY", "GOOGLE_API_KEY"), url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-omni-1.2-flash", google: true, summarize: (body: Record<string, unknown>) => ({ model: short(body.name), quota_verified: false, reason: "api_project_not_flow_subscription" }) },
    { id: "replicate", token: key("REPLICATE_API_TOKEN"), url: "https://api.replicate.com/v1/account", summarize: (body: Record<string, unknown>) => ({ account_type: short(body.type), quota_verified: false, reason: "account_endpoint_has_no_free_credit_balance" }) },
    { id: "huggingface", token: key("HUGGINGFACE_API_KEY", "HUGGINGFACE_API_TOKEN", "HUGGINGFACE_TOKEN", "HUGGING_FACE_TOKEN", "HF_TOKEN"), url: "https://huggingface.co/api/whoami-v2", summarize: (body: Record<string, unknown>) => ({ is_pro: body.isPro === true, quota_verified: false, reason: "identity_does_not_prove_inference_credit_balance_or_adapter" }) },
  ];
  const reports = await Promise.all(definitions.map(async (definition): Promise<ProviderAudit> => {
    const base = { provider_id: definition.id, checked_at: new Date().toISOString() };
    if (!definition.token || !definition.url) return { ...base, status: "not_configured", report: { quota_verified: false, reason: definition.id === "cloudflare-workers-ai" ? "billing_token_or_account_missing" : "credential_missing" } };
    try {
      const headers: Record<string, string> = definition.elevenlabs ? { "xi-api-key": definition.token } : definition.google ? { "x-goog-api-key": definition.token } : { Authorization: `Bearer ${definition.token}` };
      if (definition.id === "runway") headers["X-Runway-Version"] = "2024-11-06";
      const response = await fetcher(definition.url, { method: "GET", headers, redirect: "error", signal: AbortSignal.timeout(10_000) });
      if (!response.ok) {
        await response.body?.cancel();
        return { ...base, status: response.status === 401 ? "invalid_credentials" : response.status === 403 ? "permission_missing" : "unavailable", report: { http_status: response.status, quota_verified: false } };
      }
      // Limit bytes before JSON parsing. Raw responses are never persisted/logged.
      const reader = response.body?.getReader();
      if (!reader) throw new Error("missing_body");
      const chunks: Uint8Array[] = []; let length = 0;
      try {
        for (;;) {
          const chunk = await reader.read(); if (chunk.done) break;
          length += chunk.value.byteLength; if (length > 262144) throw new Error("oversize");
          chunks.push(chunk.value);
        }
      } finally { await reader.cancel(); }
      const bytes = new Uint8Array(length); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      const body = record(JSON.parse(new TextDecoder().decode(bytes)));
      if (body.success === false) throw new Error("upstream_failure");
      return { ...base, status: "checked", report: definition.summarize(body) };
    } catch {
      return { ...base, status: "unavailable", report: { quota_verified: false, reason: "account_check_failed" } };
    }
  }));
  for (const [id, configured] of [
    ["modal", Boolean(key("MODAL_TOKEN_ID") && key("MODAL_TOKEN_SECRET"))],
    ["kaggle", Boolean(key("KAGGLE_API_TOKEN"))],
  ] as const) reports.push({ provider_id: id, checked_at: new Date().toISOString(), status: configured ? "no_inference_endpoint" : "not_configured", report: { quota_verified: false, reason: "video_adapter_not_implemented" } });
  reports.push({ provider_id: "onemin", checked_at: new Date().toISOString(), status: key("ONEMIN_API_KEY") ? "checked" : "not_configured", report: {
    credential_present: Boolean(key("ONEMIN_API_KEY")), credentials_validated: false, quota_verified: false, model: "bytedance/seedance-2.0-fast", reason: "configuration_only_no_documented_balance_endpoint",
  } });
  const clientId = key("GOOGLE_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_ID", "SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID");
  const clientSecret = key("GOOGLE_CLIENT_SECRET", "GOOGLE_OAUTH_CLIENT_SECRET", "SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET");
  reports.push({ provider_id: "google-auth-config", checked_at: new Date().toISOString(), status: "checked", report: {
    gemini_api_key_present: Boolean(key("GEMINI_API_KEY", "GOOGLE_API_KEY")),
    oauth_client_id_present: Boolean(clientId), oauth_client_secret_present: Boolean(clientSecret),
    oauth_client_id_format_valid: Boolean(clientId && /^[a-zA-Z0-9.-]+\.apps\.googleusercontent\.com$/.test(clientId)),
    quota_verified: false, reason: "edge_secrets_do_not_enable_auth_provider",
  } });
  return reports;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function short(value: unknown): string | null { return typeof value === "string" ? value.slice(0, 160) : null; }
function amount(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null; }
