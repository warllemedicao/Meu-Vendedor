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
    { id: "cloudflare-workers-ai", token: key("CLOUDFLARE_BILLING_READ_TOKEN"), url: /^[a-f0-9]{32}$/i.test(account) ? `https://api.cloudflare.com/client/v4/accounts/${account}/subscriptions` : "", summarize: (body: Record<string, unknown>) => ({
      subscriptions: Array.isArray(body.result) ? body.result.slice(0, 30).map((item) => {
        const row = record(item); const rate = record(row.rate_plan);
        return { state: short(row.state), plan_id: short(rate.id), plan_name: short(rate.public_name ?? rate.name) };
      }) : [],
      quota_verified: false,
      reason: "subscription_does_not_prove_remaining_workers_ai_units_or_model_license",
    }) },
    { id: "magic-hour", token: key("MAGIC_HOUR_API_KEY"), url: "https://api.magichour.ai/v1/account", summarize: (body: Record<string, unknown>) => ({ tier: short(body.tier), total_credits: amount(body.credits), subscription_active: record(body.subscription).status === "active", quota_verified: false, reason: "balance_mixes_purchased_and_subscription_credits" }) },
    { id: "openrouter", token: key("OPENROUTER_API_KEY"), url: "https://openrouter.ai/api/v1/key", summarize: (body: Record<string, unknown>) => ({ is_free_tier: record(body.data).is_free_tier === true, limit_remaining: amount(record(body.data).limit_remaining), quota_verified: false, reason: "use_only_zero_price_routing_model" }) },
    { id: "groq", token: key("GROQ_API_KEY"), url: "https://api.groq.com/openai/v1/models", summarize: (body: Record<string, unknown>) => ({ configured_model_available: Array.isArray(body.data) && body.data.some((item) => record(item).id === GROQ_SCRIPT_MODEL), available_models: Array.isArray(body.data) ? body.data.map((item) => short(record(item).id)).filter((id) => id && /^[a-zA-Z0-9/_.-]+$/.test(id)).slice(0, 25) : [], quota_verified: false, reason: "model_catalog_does_not_prove_billing_tier" }) },
    { id: "google-gemini", token: key("GEMINI_API_KEY", "GOOGLE_API_KEY"), url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash", google: true, summarize: (body: Record<string, unknown>) => ({ model: short(body.name), quota_verified: false, reason: "model_catalog_does_not_prove_billing_tier" }) },
    { id: "replicate", token: key("REPLICATE_API_TOKEN"), url: "https://api.replicate.com/v1/account", summarize: (body: Record<string, unknown>) => ({ account_type: short(body.type), quota_verified: false, reason: "account_endpoint_has_no_free_credit_balance" }) },
    { id: "huggingface", token: key("HUGGINGFACE_API_KEY", "HUGGINGFACE_API_TOKEN", "HUGGINGFACE_TOKEN", "HUGGING_FACE_TOKEN", "HF_TOKEN"), url: "https://huggingface.co/api/whoami-v2", summarize: (body: Record<string, unknown>) => ({ is_pro: body.isPro === true, quota_verified: false, reason: "identity_does_not_prove_inference_credit_balance_or_adapter" }) },
  ];
  const reports = await Promise.all(definitions.map(async (definition): Promise<ProviderAudit> => {
    const base = { provider_id: definition.id, checked_at: new Date().toISOString() };
    if (!definition.token || !definition.url) return { ...base, status: "not_configured", report: { quota_verified: false, reason: definition.id === "cloudflare-workers-ai" ? "billing_token_or_account_missing" : "credential_missing" } };
    try {
      const headers: Record<string, string> = definition.google ? { "x-goog-api-key": definition.token } : { Authorization: `Bearer ${definition.token}` };
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
    ["runway", Boolean(key("RUNWAYML_API_SECRET", "RUNWAY_API_KEY"))],
    ["modal", Boolean(key("MODAL_TOKEN_ID") && key("MODAL_TOKEN_SECRET"))],
    ["kaggle", Boolean(key("KAGGLE_API_TOKEN"))],
  ] as const) reports.push({ provider_id: id, checked_at: new Date().toISOString(), status: configured ? "no_inference_endpoint" : "not_configured", report: { quota_verified: false, reason: "video_adapter_not_implemented" } });
  return reports;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function short(value: unknown): string | null { return typeof value === "string" ? value.slice(0, 160) : null; }
function amount(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null; }
