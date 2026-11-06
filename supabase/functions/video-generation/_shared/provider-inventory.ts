import { auditProviders } from "./provider-audit.ts";

export interface ProductionService {
  id: string;
  name: string;
  stage: "script" | "image" | "video" | "audio" | "unassigned";
  configured: boolean;
  integrated: boolean;
  balanceCredits?: number | null;
  balanceCheckedAt?: string;
  balanceUnit?: "credits" | "USD";
  balanceScope?: "account" | "key-limit";
  balanceStatus?: "verified" | "unsupported" | "unavailable" | "permission_missing" | "invalid_credentials" | "not_configured";
  balanceMessage?: string;
  balanceUrl?: string;
}

// Apenas contas/catálogos oficiais; nenhuma inferência ou resposta bruta no navegador.
export async function productionServicesWithBalance(
  env: (name: string) => string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<ProductionService[]> {
  const services = productionServiceInventory((name) => Boolean(env(name)));
  const reports = await auditProviders(env, fetcher);
  const dashboards: Record<string, [string, string]> = {
    "elevenlabs": ["Recursos de áudio; plano Free sem licença comercial. Geração não habilitada.", "https://elevenlabs.io/app/subscription"],
    "google-gemini": ["Saldo da API no AI Studio; assinatura do Flow é separada.", "https://aistudio.google.com/billing"],
    "google-video": ["Geração pela API Gemini; usa o projeto do aplicativo. Não usa créditos do Flow ou YouTube Create.", "https://aistudio.google.com/billing"],
    "cloudflare-workers-ai": ["Uso e franquia de Workers AI no painel; saldo não informado nesta consulta.", "https://dash.cloudflare.com/"],
    "magic-hour": ["Saldo não informado pela API.", "https://magichour.ai/"],
    "replicate": ["Endpoint de conta não informa saldo. Consulte o faturamento.", "https://replicate.com/account/billing"],
    "runway": ["Saldo da API não informado. Créditos do site são separados.", "https://dev.runwayml.com/"],
    "groq": ["Saldo não disponível na API consultada. Limites e uso no painel.", "https://console.groq.com/settings/billing"],
    "openrouter": ["Saldo da conta exige chave de gerenciamento; limite da chave pode ser consultado.", "https://openrouter.ai/settings/credits"],
    "huggingface": ["Identidade não informa saldo. Consulte o painel de faturamento.", "https://huggingface.co/settings/billing"],
    "modal": ["Relatórios de consumo via SDK ainda não integrados; consulte o painel.", "https://modal.com/"],
    "kaggle": ["Cota de GPU/TPU no painel de notebooks; não é saldo de API de vídeo.", "https://www.kaggle.com/code"],
  };
  for (const service of services) {
    const audit = reports.find((item) => item.provider_id === service.id);
    [service.balanceMessage, service.balanceUrl] = dashboards[service.id];
    service.balanceCredits = null;
    service.balanceStatus = !service.configured ? "not_configured" : "unsupported";
    if (!service.configured) { service.balanceMessage = "Credencial não configurada."; continue; }
    if (!audit) continue;
    if (["invalid_credentials", "permission_missing", "unavailable"].includes(audit.status)) {
      service.balanceStatus = audit.status as ProductionService["balanceStatus"];
      service.balanceMessage = audit.status === "invalid_credentials" ? "Credencial recusada ao consultar a conta."
        : audit.status === "permission_missing" ? "A credencial não tem permissão para consultar esta informação."
        : "Consulta indisponível agora. Tente atualizar.";
      continue;
    }
    if (audit.status === "checked") service.balanceCheckedAt = audit.checked_at;
    const wallet = service.id === "openrouter" ? reports.find((item) => item.provider_id === "openrouter-balance" && item.status === "checked") : null;
    const total = wallet?.report.total_credits;
    const used = wallet?.report.total_usage;
    const hasWallet = typeof total === "number" && typeof used === "number";
    const value = hasWallet ? Math.max(0, total - used)
      : service.id === "elevenlabs" ? audit.report.remaining_credits
      : service.id === "magic-hour" ? audit.report.total_credits
      : service.id === "runway" ? audit.report.credit_balance
      : service.id === "openrouter" ? audit.report.limit_remaining : null;
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      service.balanceCredits = value;
      service.balanceUnit = service.id === "openrouter" ? "USD" : "credits";
      service.balanceScope = service.id === "openrouter" && !hasWallet ? "key-limit" : "account";
      service.balanceStatus = "verified";
      service.balanceMessage = service.id === "openrouter" ? hasWallet ? "Saldo da conta em dólares; limite da chave pode ser menor." : "Limite restante da chave; não representa saldo total da conta."
        : service.id === "elevenlabs" ? `Créditos restantes; plano ${audit.report.tier ?? "desconhecido"}. ${audit.report.commercial_use === "not_included" ? "Free sem licença comercial; geração de anúncios não habilitada." : "Licença comercial e integração de áudio ainda precisam de validação."}`
        : service.id === "runway" ? "Créditos do projeto de API; integração de vídeo pendente."
        : "Créditos informados pela API da conta.";
    }
  }
  return services;
}

// Presença de credencial não equivale a saldo, licença ou adaptador implementado.
export function productionServiceInventory(has: (name: string) => boolean): ProductionService[] {
  const definitions = [
    { id: "elevenlabs", name: "ElevenLabs", stage: "audio", keys: ["ELEVENLABS_API_KEY", "ELEVENLABS_API", "ELEVEN_LABS_API_KEY", "XI_API_KEY"], integrated: false },
    { id: "google-gemini", name: "Gemini", stage: "script", keys: ["GEMINI_API_KEY", "GOOGLE_API_KEY"], integrated: true },
    { id: "google-video", name: "Google vídeo — Omni", stage: "video", keys: ["GEMINI_API_KEY", "GOOGLE_API_KEY"], integrated: true },
    { id: "cloudflare-workers-ai", name: "Cloudflare", stage: "image", keys: ["CLOUDFLARE_AI_API_TOKEN"], integrated: true },
    { id: "magic-hour", name: "Magic Hour", stage: "video", keys: ["MAGIC_HOUR_API_KEY"], integrated: true },
    { id: "replicate", name: "Replicate", stage: "video", keys: ["REPLICATE_API_TOKEN"], integrated: true },
    { id: "runway", name: "Runway", stage: "video", keys: ["RUNWAYML_API_SECRET", "RUNWAY_API_KEY"], integrated: false },
    { id: "groq", name: "Groq", stage: "script", keys: ["GROQ_API_KEY"], integrated: true },
    { id: "openrouter", name: "OpenRouter", stage: "script", keys: ["OPENROUTER_API_KEY"], integrated: true },
    { id: "kaggle", name: "Kaggle", stage: "unassigned", keys: ["KAGGLE_API_TOKEN"], integrated: false },
    { id: "huggingface", name: "Hugging Face", stage: "unassigned", keys: ["HUGGINGFACE_API_KEY", "HUGGINGFACE_API_TOKEN", "HUGGINGFACE_TOKEN", "HUGGING_FACE_TOKEN", "HF_TOKEN"], integrated: false },
    { id: "modal", name: "Modal", stage: "unassigned", keys: ["MODAL_TOKEN_ID", "MODAL_TOKEN_SECRET"], integrated: false },
  ] as const;
  return definitions.map(({ keys, ...service }) => ({ ...service, configured:
    service.id === "modal" ? keys.every(has) :
    service.id === "cloudflare-workers-ai" ? keys.some(has) && has("CLOUDFLARE_ACCOUNT_ID") : keys.some(has) }));
}
